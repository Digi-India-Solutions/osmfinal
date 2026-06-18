import pool from "../../pool.js";
import { generateDocumentNumber } from "../../../utils/generateDocumentNumber.js";
import { randomUUID } from "node:crypto";
const VALID_REFUND_MODES = ["CASH", "UPI", "NEFT", "RTGS", "CHEQUE"];
import { generateVoucherNumber } from "../payment/payment-controller.js";
const calcPaymentStatus = (paid, total) => {
  if (paid <= 0)     return "UNPAID";
  if (paid >= total) return "PAID";
  return "PARTIAL";
};

const resolveCompanyId = async (user) => {
  if (user?.company_id) return user.company_id;
  if (user?.companyId) return user.companyId;
  if (!user?.id) return null;

  const { rows } = await pool.query(
    `SELECT company_id FROM users WHERE id = $1 LIMIT 1`,
    [user.id]
  );
  return rows[0]?.company_id || null;
};

const applySupplierPurseDelta = async (client, company_id, supplierId, delta) => {
  const { rows } = await client.query(
    `SELECT opening_balance
     FROM parties
     WHERE id = $1 AND company_id = $2
     FOR UPDATE`,
    [supplierId, company_id]
  );

  if (rows.length === 0) {
    throw new Error("Supplier not found for purse update");
  }

  const current = Number(rows[0].opening_balance || 0);
  const next = Number((current + Number(delta || 0)).toFixed(2));

  await client.query(
    `UPDATE parties
     SET opening_balance = $1
     WHERE id = $2 AND company_id = $3`,
    [next, supplierId, company_id]
  );

  return next;
};

// All credit/refund state lives directly on the purchase_returns row
const formatReturn = (row) => ({
  id:                      row.id,
  returnNumber:            row.return_number,
  companyId:               row.company_id,
  originalInvoiceId:       row.original_invoice_id,
  originalInvoiceNo:       row.original_invoice_no          || null,
  supplierId:              row.supplier_id,
  supplierName:            row.supplier_name                 || null,
  warehouseId:             row.warehouse_id,
  warehouseName:           row.warehouse_name               || null,
  date:                    row.date,
  totalAmount:             parseFloat(row.total_amount)      || 0,
  settlementAmount:         parseFloat(row.settlement_amount ?? row.total_amount) || 0,
  adjustmentAmount:         parseFloat(row.adjustment_amount) || 0,
  reason:                  row.reason                       || null,
  // Payment handling — stored entirely on this row, no external tables
  paymentHandled:          row.payment_handled,
  paymentType:             row.payment_type                 || null, // 'credit' | 'refund' | null
  // Refund fields (only set when paymentType = 'refund')
  refundMode:              row.refund_mode                  || null,
  refundReference:         row.refund_reference             || null,
  refundDate:              row.refund_date                  || null,
  // Credit fields (only set when paymentType = 'credit')
  creditIsUsed:            row.credit_is_used               || false,
  creditUsedOnInvoiceId:   row.credit_used_on_invoice_id   || null,
  creditUsedAt:            row.credit_used_at               || null,
  createdBy:               row.created_by,
  createdAt:               row.created_at,
});

const formatReturnItem = (i) => ({
  id:        i.id,
  returnId:  i.return_id,
  itemId:    i.item_id,
  itemName:  i.item_name,
  hsnCode:   i.hsn_code  || null,
  returnQty: parseFloat(i.return_qty),
  unitId:    i.unit_id   || null,
  unitName:  i.unit_name || null,
  rate:      parseFloat(i.rate),
  amount:    parseFloat(i.amount),
  reason:    i.reason    || null,
});

// ─────────────────────────────────────────────
// CREATE PURCHASE RETURN
// ─────────────────────────────────────────────
export const createPurchaseReturn = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { originalInvoiceId, date, items = [], reason } = req.body;

    // ── Validations ──
    if (!originalInvoiceId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Original invoice ID is required" });
    }

    const validItems = items.filter(
      (i) => i.itemId && Number(i.qty) > 0 && Number(i.rate) >= 0
    );
    if (validItems.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Select at least one item to return" });
    }

    // ── Fetch & validate original invoice ──
    const { rows: invRows } = await client.query(
      `SELECT pi.*, p.name AS supplier_name, w.name AS warehouse_name
       FROM purchase_invoices pi
       LEFT JOIN parties    p ON pi.supplier_id  = p.id
       LEFT JOIN warehouses w ON pi.warehouse_id = w.id
       WHERE pi.id = $1 AND pi.company_id = $2`,
      [originalInvoiceId, company_id]
    );

    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Original invoice not found" });
    }

    const invoice = invRows[0];

    // ── Validate return qty doesn't exceed original per item ──
    for (const item of validItems) {
      const { rows: invItemRows } = await client.query(
        `SELECT qty FROM purchase_invoice_items
         WHERE invoice_id = $1 AND item_id = $2`,
        [originalInvoiceId, item.itemId]
      );

      if (invItemRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Item not found in original invoice" });
      }

      const { rows: alreadyRows } = await client.query(
        `SELECT COALESCE(SUM(pri.return_qty), 0) AS already_returned
         FROM purchase_return_items pri
         JOIN purchase_returns pr ON pri.return_id = pr.id
         WHERE pr.original_invoice_id = $1 AND pri.item_id = $2`,
        [originalInvoiceId, item.itemId]
      );

      const maxReturnable =
        parseFloat(invItemRows[0].qty) - parseFloat(alreadyRows[0].already_returned);

      if (Number(item.qty) > maxReturnable) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Return qty ${item.qty} exceeds returnable qty ${maxReturnable.toFixed(3)}`,
        });
      }
    }

    // ── Generate return number ──

    const return_number = await generateDocumentNumber({
      client,
      company_id,
      doc_type: "PURCHASE_RETURN",
    });

    // ── Calculate total ──
    const totalAmount = validItems.reduce(
      (sum, i) => sum + Number(i.qty) * Number(i.rate), 0
    );

    // ── Insert return header ──
    const { rows: retRows } = await client.query(
      `INSERT INTO purchase_returns
        (company_id, original_invoice_id, supplier_id, warehouse_id,
         return_number, date, total_amount, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        company_id,
        originalInvoiceId,
        invoice.supplier_id,
        invoice.warehouse_id,
        return_number,
        date || new Date(),
        totalAmount.toFixed(2),
        reason || null,
        req.user.id,
      ]
    );

    const purchaseReturn = retRows[0];

    // ── Insert items + reverse stock ──
    const insertedItems = [];
    for (const item of validItems) {
      const { rows: itemMaster } = await client.query(
        "SELECT name, hsn_code FROM items WHERE id = $1 AND company_id = $2",
        [item.itemId, company_id]
      );
      if (itemMaster.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: `Item not found: ${item.itemId}` });
      }

      const { rows: riRows } = await client.query(
        `INSERT INTO purchase_return_items
          (return_id, item_id, item_name, hsn_code,
           return_qty, unit_id, rate, amount, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          purchaseReturn.id,
          item.itemId,
          itemMaster[0].name,
          item.hsnCode || itemMaster[0].hsn_code || null,
          Number(item.qty),
          item.unitId  || null,
          Number(item.rate),
          (Number(item.qty) * Number(item.rate)).toFixed(2),
          item.reason  || reason || null,
        ]
      );
      insertedItems.push(riRows[0]);

      // Reverse stock
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = GREATEST(0, quantity - $1)
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [Number(item.qty), company_id, invoice.warehouse_id, item.itemId]
      );

      // Stock movement
      await client.query(
        `INSERT INTO stock_movements
          (id, company_id, warehouse_id, item_id, movement_type,
           quantity, reference_type, reference_id, reference_number, created_by)
         VALUES ($1,$2,$3,$4,'RETURN_OUT',$5,'PURCHASE_RETURN',$6,$7,$8)`,
        [
          randomUUID(), company_id, invoice.warehouse_id, item.itemId,
          Number(item.qty), purchaseReturn.id, return_number, req.user.id,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success:        true,
      message:        `${return_number} created successfully`,
      invoiceWasPaid: true,
      data: {
        ...formatReturn({
          ...purchaseReturn,
          original_invoice_no: invoice.invoice_number,
          supplier_name:       invoice.supplier_name,
          warehouse_name:      invoice.warehouse_name,
        }),
        items: insertedItems.map(formatReturnItem),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Purchase Return Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// GET ALL PURCHASE RETURNS
// ─────────────────────────────────────────────
export const getAllPurchaseReturns = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { search = "", supplier_id = "", warehouse_id = "", from_date = "", to_date = "" } = req.query;

    let baseQuery = `
  FROM purchase_returns pr
  LEFT JOIN purchase_invoices pi  ON pr.original_invoice_id = pi.id
  LEFT JOIN parties p             ON pr.supplier_id = p.id AND p.company_id = $1
  LEFT JOIN warehouses w          ON pr.warehouse_id = w.id AND w.company_id = $1
  LEFT JOIN purchase_return_items pri ON pri.return_id = pr.id
  WHERE pr.company_id = $1
`;

const values = [company_id];
let idx = 2;

if (warehouse_id) {
  baseQuery += ` AND pr.warehouse_id = $${idx}`;
  values.push(warehouse_id);
  idx++;
}

// ✅ Apply filters BEFORE GROUP BY
if (search) {
  baseQuery += ` AND (pr.return_number ILIKE $${idx} OR p.name ILIKE $${idx} OR pi.invoice_number ILIKE $${idx})`;
  values.push(`%${search}%`);
  idx++;
}
if (supplier_id) {
  baseQuery += ` AND pr.supplier_id = $${idx}`;
  values.push(supplier_id);
  idx++;
}
if (from_date) {
  baseQuery += ` AND pr.date >= $${idx}`;
  values.push(from_date);
  idx++;
}
if (to_date) {
  baseQuery += ` AND pr.date <= $${idx}`;
  values.push(to_date);
  idx++;
}


    const finalQuery = `
  SELECT
    pr.*,
    pi.invoice_number AS original_invoice_no,
    p.name            AS supplier_name,
    w.name            AS warehouse_name,

    COUNT(pri.id)::int AS item_count,

    COALESCE(
      json_agg(
        json_build_object(
          'itemName', pri.item_name,
          'returnQty', pri.return_qty,
          'rate', pri.rate,
          'amount', pri.amount,
          'reason', pri.reason
        )
      ) FILTER (WHERE pri.id IS NOT NULL),
      '[]'
    ) AS items

  ${baseQuery}

  GROUP BY pr.id, pi.invoice_number, p.name, w.name
  ORDER BY pr.created_at DESC
`;


    const { rows } = await pool.query(finalQuery, values);

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data: rows.map((row) => ({
  ...formatReturn(row),
  itemCount: Number(row.item_count),
  items: row.items || [],
}))

    
    });

  } catch (error) {
    console.error("Get All Returns Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET PURCHASE RETURN BY ID
// ─────────────────────────────────────────────
export const getPurchaseReturnById = async (req, res) => {
  try {
    const { id }     = req.params;
    const company_id = req.user.company_id;

    const { rows: retRows } = await pool.query(
      `SELECT pr.*, pi.invoice_number AS original_invoice_no,
              p.name AS supplier_name, w.name AS warehouse_name
       FROM purchase_returns pr
       LEFT JOIN purchase_invoices pi ON pr.original_invoice_id = pi.id
       LEFT JOIN parties           p  ON pr.supplier_id         = p.id
       LEFT JOIN warehouses        w  ON pr.warehouse_id        = w.id
       WHERE pr.id = $1 AND pr.company_id = $2`,
      [id, company_id]
    );

    if (retRows.length === 0)
      return res.status(404).json({ success: false, message: "Purchase return not found" });

    const { rows: itemRows } = await pool.query(
      `SELECT pri.*, u.name AS unit_name
       FROM purchase_return_items pri
       LEFT JOIN units u ON pri.unit_id = u.id
       WHERE pri.return_id = $1
       ORDER BY pri.id`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...formatReturn(retRows[0]),
        items: itemRows.map(formatReturnItem),
      },
    });

  } catch (error) {
    console.error("Get Return By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// PATCH /api/purchase-returns/:id/payment
// Handle return payment — Refund or Credit
// ─────────────────────────────────────────────
export const handleReturnPayment = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({ success: false, message: "Company context missing in token" });
  }

  const incomingType = String(req.body?.paymentType || req.body?.type || "").toUpperCase();
  const paymentMode = req.body?.paymentMode || req.body?.refundMode || null;
  const amount = Number(req.body?.amount ?? req.body?.settlementAmount ?? 0);
  const adjustmentAmount = Math.max(0, Number(req.body?.adjustmentAmount || 0));
  const providedRefundReference = String(req.body?.refundReference || req.body?.referenceNo || "").trim();

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT pr.*
       FROM purchase_returns pr
       WHERE pr.id = $1 AND pr.company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Purchase return not found" });
    }

    const purchaseReturn = rows[0];

    if (purchaseReturn.payment_handled) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Payment for this return has already been handled",
      });
    }

    const totalReturnAmount = Number(purchaseReturn.total_amount || 0);
    const remainingToSettle = totalReturnAmount - adjustmentAmount;

    // If adjustment amount fully covers the return, just settle without requiring payment type/amount
    if (remainingToSettle <= 0) {
      if (adjustmentAmount > 0) {
        await applySupplierPurseDelta(client, company_id, purchaseReturn.supplier_id, adjustmentAmount);
      }

      await client.query(
        `UPDATE purchase_returns
         SET payment_handled = true,
             payment_type = 'credit',
             updated_at = NOW()
         WHERE id = $1 AND company_id = $2`,
        [id, company_id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: `Return settled via adjustment of ₹${adjustmentAmount.toFixed(2)}`,
        settled: true,
      });
    }

    // Otherwise, require payment type and validation for remaining amount
    if (!["REFUND", "CREDIT"].includes(incomingType)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "paymentType must be REFUND or CREDIT",
      });
    }

    if (incomingType === "REFUND") {
      if (!paymentMode || !VALID_REFUND_MODES.includes(String(paymentMode).toUpperCase())) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `paymentMode must be one of: ${VALID_REFUND_MODES.join(", ")}`,
        });
      }

      if (!Number.isFinite(amount) || amount <= 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "amount is required for REFUND",
        });
      }
    }

    // For CREDIT: either amount or adjustmentAmount must be provided
    const hasValidPayment = (amount > 0) || (adjustmentAmount > 0);
    if (incomingType === "CREDIT" && !hasValidPayment) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "amount or adjustmentAmount is required for CREDIT",
      });
    }

    const settlementAmount = Number(amount || 0);
    const paymentTypeDb = incomingType.toLowerCase();

    let refundReference = null;
    let refundMode = null;
    let refundDate = null;

    if (incomingType === "REFUND") {
      refundMode = String(paymentMode).toUpperCase();
      refundDate = req.body?.refundDate || new Date();
      refundReference = providedRefundReference || (await generateVoucherNumber(client, company_id));
    }

    if (adjustmentAmount > 0) {
      await applySupplierPurseDelta(client, company_id, purchaseReturn.supplier_id, adjustmentAmount);
    }

    if (incomingType === "CREDIT" && settlementAmount > 0) {
      await applySupplierPurseDelta(client, company_id, purchaseReturn.supplier_id, settlementAmount);
    }

    await client.query(
      `UPDATE purchase_returns
       SET payment_handled = true,
           payment_type = $1,
           refund_mode = $2,
           refund_reference = $3,
           refund_date = $4,
           updated_at = NOW()
       WHERE id = $5 AND company_id = $6`,
      [
        paymentTypeDb,
        refundMode,
        refundReference,
        refundDate,
        id,
        company_id,
      ]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Return payment processed as ${incomingType}`,
      settled: true,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("handleReturnPayment error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};


// GET RETURN STATS

export const getPurchaseReturnStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
        COUNT(*)                                                                   AS total,
        COALESCE(SUM(total_amount), 0)                                             AS total_value,
        COUNT(*) FILTER (WHERE payment_handled = false)                            AS pending_payment,
        COUNT(*) FILTER (WHERE payment_type = 'credit')                            AS as_credit,
        COUNT(*) FILTER (WHERE payment_type = 'credit' AND credit_is_used = false) AS unused_credits,
        COUNT(*) FILTER (WHERE payment_type = 'refund')                            AS as_refund,
        COUNT(*) FILTER (WHERE date >= date_trunc('month', CURRENT_DATE))          AS this_month,
        COALESCE(SUM(total_amount) FILTER (
          WHERE payment_type = 'credit' AND credit_is_used = false
        ), 0)                                                                      AS unused_credit_total
       FROM purchase_returns
       WHERE company_id = $1`,
      [company_id]
    );

    const s = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        total:             Number(s.total),
        totalValue:        parseFloat(s.total_value),
        pendingPayment:    Number(s.pending_payment),
        asCredit:          Number(s.as_credit),
        unusedCredits:     Number(s.unused_credits),
        asRefund:          Number(s.as_refund),
        thisMonth:         Number(s.this_month),
        unusedCreditTotal: parseFloat(s.unused_credit_total),
      },
    });

  } catch (error) {
    console.error("Return Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updatePurchaseReturn = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;
    const { items = [], reason, date } = req.body;

    if (!id) throw new Error("Return id required");

    // ── Get existing return ──
    const { rows } = await client.query(
      `SELECT * FROM purchase_returns WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );
    if (!rows.length) throw new Error("Purchase return not found");
    const oldReturn = rows[0];

    if (oldReturn.payment_handled) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cannot edit a finalized purchase return",
      });
    }

    // ── Get original invoice ──
    const { rows: invRows } = await client.query(
      `SELECT * FROM purchase_invoices WHERE id = $1`,
      [oldReturn.original_invoice_id]
    );
    if (!invRows.length) throw new Error("Original invoice not found");
    const invoice = invRows[0];

    // ── Restore old stock ──
    const { rows: oldItems } = await client.query(
      `SELECT * FROM purchase_return_items WHERE return_id = $1`,
      [id]
    );

    for (const item of oldItems) {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [item.return_qty, company_id, oldReturn.warehouse_id, item.item_id]
      );
    }

    // ── Delete old items ──
    await client.query(
      `DELETE FROM purchase_return_items WHERE return_id = $1`,
      [id]
    );

    // ── Validate new items against invoice ──
    const validItems = items.filter(
      (i) => i.itemId && Number(i.qty) > 0 && Number(i.rate) >= 0
    );

    for (const item of validItems) {
      const { rows: invItemRows } = await client.query(
        `SELECT qty FROM purchase_invoice_items
         WHERE invoice_id = $1 AND item_id = $2`,
        [oldReturn.original_invoice_id, item.itemId]
      );
      if (!invItemRows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Item not found in original invoice`,
        });
      }
      if (Number(item.qty) > Number(invItemRows[0].qty)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Return qty (${item.qty}) exceeds sold qty (${invItemRows[0].qty})`,
        });
      }
    }

    // ── Insert new items + update stock ──
    let newTotal = 0;

    for (const item of validItems) {
      const qty = Number(item.qty);
      const rate = Number(item.rate);
      const amount = qty * rate;
      newTotal += amount;

      // Fetch item master for name/hsn
      const { rows: itemMaster } = await client.query(
        `SELECT name, hsn_code FROM items WHERE id = $1 AND company_id = $2`,
        [item.itemId, company_id]
      );
      if (!itemMaster.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Item not found: ${item.itemId}`,
        });
      }

      await client.query(
        `INSERT INTO purchase_return_items
           (return_id, item_id, item_name, hsn_code,
            return_qty, unit_id, rate, amount, reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          id,
          item.itemId,
          itemMaster[0].name,
          item.hsnCode || itemMaster[0].hsn_code || null,
          qty,
          item.unitId || null,
          rate,
          amount.toFixed(2),
          item.reason || reason || null,   // ← reason saved per item
        ]
      );

      // Reduce stock again
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = GREATEST(0, quantity - $1)
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [qty, company_id, oldReturn.warehouse_id, item.itemId]
      );
    }

    // ── Update return header ──
    await client.query(
      `UPDATE purchase_returns
       SET total_amount = $1,
           reason = $2,
           date = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [newTotal.toFixed(2), reason || null, date || new Date(), id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Purchase return updated successfully",
      data: { id, totalAmount: newTotal, itemCount: validItems.length },
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updatePurchaseReturn error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};

export const deletePurchaseReturn = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!id) throw new Error("Return id required");

    // 🔹 Get return
    const { rows } = await client.query(
      `SELECT * FROM purchase_returns WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Return not found");

    const purchaseReturn = rows[0];

    // 🔹 Get invoice
    const { rows: invRows } = await client.query(
      `SELECT * FROM purchase_invoices WHERE id = $1`,
      [purchaseReturn.original_invoice_id]
    );

    const invoice = invRows[0];

    // 🔹 Get items
    const { rows: items } = await client.query(
      `SELECT * FROM purchase_return_items WHERE return_id = $1`,
      [id]
    );

    let total = 0;

    for (const item of items) {
      total += Number(item.amount);

      // 🔥 Restore stock
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [item.return_qty, company_id, purchaseReturn.warehouse_id, item.item_id]
      );
    }

    // 🔥 Reverse invoice adjustment
    let paid = Number(invoice.paid_amount);
    paid = Math.max(paid - total, 0);

    const newStatus = calcPaymentStatus(paid, Number(invoice.total_amount));

    await client.query(
      `UPDATE purchase_invoices
       SET paid_amount = $1,
           payment_status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [paid.toFixed(2), newStatus, invoice.id]
    );

    // 🔥 Delete return
    await client.query(`DELETE FROM purchase_returns WHERE id = $1`, [id]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Purchase return deleted successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deletePurchaseReturn error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};