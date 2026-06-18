import pool from "../../pool.js";
import { randomUUID as uuidv4 } from "node:crypto";
import { generateDocumentNumber } from "../../../utils/generateDocumentNumber.js";

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

const applyCustomerPurseDelta = async (client, company_id, customerId, delta) => {
  const { rows } = await client.query(
    `SELECT opening_balance
     FROM parties
     WHERE id = $1 AND company_id = $2
     FOR UPDATE`,
    [customerId, company_id]
  );

  if (!rows.length) {
    throw new Error("Customer not found for purse update");
  }

  const current = Number(rows[0].opening_balance || 0);
  const next = Number((current + Number(delta || 0)).toFixed(2));

  await client.query(
    `UPDATE parties
     SET opening_balance = $1
     WHERE id = $2 AND company_id = $3`,
    [next, customerId, company_id]
  );
};
// ─────────────────────────────────────────────
// Helper: Generate return number  e.g. RTN-20240201-0001
// ─────────────────────────────────────────────



// ─────────────────────────────────────────────
// GET /sales/returns
// List all sale returns for a company
// ─────────────────────────────────────────────
// const listSaleReturns = async (req, res) => {
//   const { company_id } = req.user;
//   const page = Math.max(1, parseInt(req.query.page, 10) || 1);
//   const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
//   const offset = (page - 1) * limit;

//   try {
//     const { rows: countRows } = await pool.query(
//       `SELECT COUNT(*)::int AS total
//        FROM sale_returns sr
//        WHERE sr.company_id = $1
//          AND sr.is_active = true`,
//       [company_id]
//     );

//     const { rows } = await pool.query(
//       `SELECT
//          sr.id,
//          sr.return_number,
//          sr.return_date,
//          sr.total_amount,
//          sr.payment_handled,
//          sr.payment_type,
//          sr.original_invoice_id,
//          sr.refund_id,
//          sr.notes,
//          sr.created_at,
//          p.name  AS customer_name,
//          si.invoice_number AS original_invoice_number,
//          w.name  AS warehouse_name,
//          COALESCE(rsi.item_count, 0) AS item_count,
//          u.name  AS created_by_name
//        FROM sale_returns sr
//        LEFT JOIN parties          p  ON p.id  = sr.customer_id
//        LEFT JOIN sales_invoices   si ON si.id = sr.original_invoice_id
//        LEFT JOIN warehouses       w  ON w.id  = sr.warehouse_id
//        LEFT JOIN (
//          SELECT sale_return_id, COUNT(*)::int AS item_count
//          FROM sale_return_items
//          GROUP BY sale_return_id
//        ) rsi ON rsi.sale_return_id = sr.id
//        LEFT JOIN users            u  ON u.id  = sr.created_by
//       -- WHERE sr.company_id = $1
//        WHERE sr.is_active   = true
//        ORDER BY sr.created_at DESC
//        LIMIT $2 OFFSET $3`,
//       [company_id, limit, offset]
//     );

//     const items = rows.map((row) => ({
//       id: row.id,
//       invoiceNo: row.return_number,
//       date: row.return_date,
//       partyName: row.customer_name || "",
//       warehouseName: row.warehouse_name || "",
//       itemCount: row.item_count,
//       grandTotal: Number(row.total_amount || 0),
//       status: "SAVED",
//       paymentMode: row.payment_type || "CREDIT",
//       originalInvoiceId: row.original_invoice_id,
//       originalInvoiceNo: row.original_invoice_number || "",
//       paymentHandled: Boolean(row.payment_handled),
//       paymentType: row.payment_type || null,
//       refundId: row.refund_id || null,
//     }));

//     return res.status(200).json({
//       success: true,
//       data: {
//         items,
//         total: countRows[0]?.total || 0,
//         page,
//         limit,
//       },
//     });
//   } catch (err) {
//     console.error("listSaleReturns error:", err);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };


const listSaleReturns = async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
  const offset = (page - 1) * limit;
  const company_id = await resolveCompanyId(req.user);
  const { warehouseId } = req.query;

  try {
    const params = [company_id];
    let whereSql = `WHERE sr.company_id = $1 AND sr.is_active = true`;

    if (warehouseId) {
      params.push(warehouseId);
      whereSql += ` AND sr.warehouse_id = $${params.length}`;
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM sale_returns sr
       ${whereSql}`,
      params,
    );

    const { rows } = await pool.query(
      `SELECT
         sr.id,
         sr.return_number,
         sr.return_date,
         sr.total_amount,
         sr.payment_handled,
         sr.payment_type,
         sr.original_invoice_id,
         sr.refund_id,
         sr.notes,
         sr.created_at,
         p.name  AS customer_name,
         si.invoice_number AS original_invoice_number,
         w.name  AS warehouse_name,
         COALESCE(rsi.item_count, 0) AS item_count,
         u.name  AS created_by_name
       FROM sale_returns sr
       LEFT JOIN parties        p  ON p.id  = sr.customer_id
       LEFT JOIN sales_invoices si ON si.id = sr.original_invoice_id
       LEFT JOIN warehouses     w  ON w.id  = sr.warehouse_id
       LEFT JOIN (
         SELECT sale_return_id, COUNT(*)::int AS item_count
         FROM sale_return_items
         GROUP BY sale_return_id
       ) rsi ON rsi.sale_return_id = sr.id
       LEFT JOIN users u ON u.id = sr.created_by
       ${whereSql}
       ORDER BY sr.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    const items = rows.map((row) => ({
      id: row.id,
      invoiceNo: row.return_number,
      date: row.return_date,
      partyName: row.customer_name || '',
      warehouseName: row.warehouse_name || '',
      itemCount: row.item_count,
      grandTotal: Number(row.total_amount || 0),
      status: 'SAVED',
      paymentMode: row.payment_type || 'CREDIT',
      originalInvoiceId: row.original_invoice_id,
      originalInvoiceNo: row.original_invoice_number || '',
      paymentHandled: Boolean(row.payment_handled),
      paymentType: row.payment_type || null,
      refundId: row.refund_id || null,
    }));

    return res.status(200).json({
      success: true,
      data: {
        items,
        total: countRows[0]?.total || 0,
        page,
        limit,
      },
    });
  } catch (err) {
    console.error('listSaleReturns error:', err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
// ─────────────────────────────────────────────
// GET /sales/returns/:id
// Get single return with its line items
// ─────────────────────────────────────────────
const getSaleReturnById = async (req, res) => {
  const { id } = req.params;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({ success: false, message: "Company context missing in token" });
  }

  try {
    // Header
    const { rows: headerRows } = await pool.query(
      `SELECT
         sr.*,
         p.name  AS customer_name,
         si.invoice_number AS original_invoice_number,
         si.total_amount   AS original_invoice_amount,
         si.paid_amount    AS original_paid_amount,
         si.payment_status AS original_payment_status,
         w.name            AS warehouse_name
       FROM sale_returns sr
       LEFT JOIN parties          p  ON p.id  = sr.customer_id
       LEFT JOIN sales_invoices   si ON si.id = sr.original_invoice_id
       LEFT JOIN warehouses       w  ON w.id  = sr.warehouse_id
       WHERE sr.id = $1 AND sr.company_id = $2 AND sr.is_active = true`,
      [id, company_id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    // Line items
    const { rows: itemRows } = await pool.query(
      `SELECT
         sri.id,
         sri.item_id,
         sri.return_qty,
         sri.rate,
         sri.reason,
         sri.custom_reason,
         i.name AS item_name,
         i.hsn_code,
         i.unit_name
       FROM sale_return_items sri
       LEFT JOIN items i ON i.id = sri.item_id
       WHERE sri.sale_return_id = $1
       ORDER BY sri.created_at ASC`,
      [id]
    );

    const header = headerRows[0];

    return res.status(200).json({
      success: true,
      data: {
        id: header.id,
        invoiceNo: header.return_number,
        date: header.return_date,
        partyName: header.customer_name || "",
        warehouseName: header.warehouse_name || "",
        itemCount: itemRows.length,
        grandTotal: Number(header.total_amount || 0),
        status: "SAVED",
        originalInvoiceId: header.original_invoice_id,
        originalInvoiceNo: header.original_invoice_number || "",
        paymentHandled: Boolean(header.payment_handled),
        paymentType: header.payment_type || null,
        refundId: header.refund_id || null,
        items: itemRows.map((item) => {
          const qty = Number(item.return_qty || 0);
          const rate = Number(item.rate || 0);
          return {
            id: item.id,
            itemId: item.item_id,
            itemName: item.item_name || "",
            hsnCode: item.hsn_code || "",
            returnQty: qty,
            unit: item.unit_name || "Pcs",
            rate,
            amount: Number((qty * rate).toFixed(2)),
            reason: item.reason || "",
            customReason: item.custom_reason || null,
          };
        }),
      },
    });
  } catch (err) {
    console.error("getSaleReturnById error:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// POST /sales/returns
// Create a sale return — increases stock
// ─────────────────────────────────────────────
const createSaleReturn = async (req, res) => {
  const { id: userId } = req.user;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({ success: false, message: "Company context missing in token" });
  }

  const {
    originalInvoiceId,
    returnDate,
    date,
    warehouseId,
    notes,
    reason,
    items,
  } = req.body;
  const normalizedReturnDate = returnDate || date;
  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ({
        itemId: item.itemId,
        returnQty: Number(item.returnQty ?? item.qty ?? 0),
        rate: Number(item.rate ?? 0),
        reason: item.reason || reason || "Other",
        customReason: item.customReason || null,
      }))
    : [];
  const validItems = normalizedItems.filter((item) => item.itemId && item.returnQty > 0 && item.rate >= 0);

  // Basic validation
  if (!originalInvoiceId || !normalizedReturnDate || !validItems.length) {
    return res.status(400).json({
      success: false,
      message: "originalInvoiceId, date and items are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── 1. Fetch original invoice ──────────────────────────────────────────
    const { rows: invoiceRows } = await client.query(
      `SELECT id, company_id, customer_id, total_amount, paid_amount, payment_status, warehouse_id
       FROM sales_invoices
       WHERE id = $1 AND company_id = $2 AND is_active = true`,
      [originalInvoiceId, company_id]
    );

    if (!invoiceRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Original invoice not found" });
    }

    const invoice = invoiceRows[0];
    const invoiceWasPaid = invoice.payment_status === "PAID";
    const resolvedWarehouseId = warehouseId || invoice.warehouse_id;

    if (!resolvedWarehouseId) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "warehouseId is required",
      });
    }

    // ── 2. Validate each return item against original sold qty ─────────────
    for (const item of validItems) {
      const { rows: soldRows } = await client.query(
        `SELECT quantity AS sold_qty
         FROM sales_invoice_items
         WHERE sales_invoice_id = $1 AND item_id = $2`,
        [originalInvoiceId, item.itemId]
      );

      if (!soldRows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Item ${item.itemId} was not on the original invoice`,
        });
      }

      if (item.returnQty <= 0 || item.returnQty > soldRows[0].sold_qty) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Return qty (${item.returnQty}) exceeds sold qty (${soldRows[0].sold_qty}) for item ${item.itemId}`,
        });
      }
    }

    // ── 3. Calculate total return amount ───────────────────────────────────
    const totalAmount = validItems.reduce(
      (sum, item) => sum + item.returnQty * item.rate,
      0
    );

    // ── 4. Create sale_return header ───────────────────────────────────────
    const returnId = uuidv4();
    const returnNumber = await generateDocumentNumber({
      client,
      company_id,
      doc_type: "SALE_RETURN",
    });

    await client.query(
      `INSERT INTO sale_returns
         (id, company_id, warehouse_id, customer_id, original_invoice_id,
          return_number, return_date, total_amount, payment_handled, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,$10)`,
      [
        returnId,
        company_id,
        resolvedWarehouseId,
        invoice.customer_id,
        originalInvoiceId,
        returnNumber,
        normalizedReturnDate,
        totalAmount,
        notes || reason || null,
        userId,
      ]
    );

    // ── 5. Insert return line items + increase warehouse stock ─────────────
    for (const item of validItems) {
      const lineId = uuidv4();

      await client.query(
        `INSERT INTO sale_return_items
           (id, sale_return_id, item_id, return_qty, rate, reason, custom_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          lineId,
          returnId,
          item.itemId,
          item.returnQty,
          item.rate,
          item.reason,
          item.customReason || null,
        ]
      );

      // Increase warehouse stock (RETURN_IN movement)
      const stockUpdate = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1, updated_at = NOW()
         WHERE warehouse_id = $2 AND item_id = $3 AND company_id = $4`,
        [item.returnQty, resolvedWarehouseId, item.itemId, company_id]
      );

      if (stockUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock
             (id, company_id, warehouse_id, item_id, quantity, reserved_qty)
           VALUES ($1,$2,$3,$4,$5,0)`,
          [uuidv4(), company_id, resolvedWarehouseId, item.itemId, item.returnQty]
        );
      }

      // Record stock movement
      await client.query(
        `INSERT INTO stock_movements
           (id, company_id, warehouse_id, item_id, movement_type, quantity,
            reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'RETURN_IN',$5,'SALE_RETURN',$6,$7)`,
        [
          uuidv4(),
          company_id,
          resolvedWarehouseId,
          item.itemId,
          item.returnQty,
          returnId,
          userId,
        ]
      );
    }

    // ── 6. Handle invoice balance based on payment status ─────────────────
    if (!invoiceWasPaid) {
      // UNPAID / PARTIAL → auto-reduce the invoice balance
      const originalTotal = Number(invoice.total_amount || 0);
      const originalPaid = Number(invoice.paid_amount || 0);
      const newTotalAmount = Math.max(originalTotal - totalAmount, 0);
      const newPaidAmount = Math.min(originalPaid, newTotalAmount);
      const balanceDue = Math.max(newTotalAmount - newPaidAmount, 0);
      let newPaymentStatus;

      if (balanceDue <= 0) {
        newPaymentStatus = "PAID";
      } else if (newPaidAmount > 0) {
        newPaymentStatus = "PARTIAL";
      } else {
        newPaymentStatus = "UNPAID";
      }

      await client.query(
        `UPDATE sales_invoices
         SET total_amount    = $1,
             paid_amount     = $2,
             balance_due     = $3,
             payment_status  = $4,
             updated_at      = NOW()
         WHERE id = $5`,
        [newTotalAmount, newPaidAmount, balanceDue, newPaymentStatus, originalInvoiceId]
      );
    }
    // PAID invoice → payment_handled stays false; frontend will show modal

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        id: returnId,
        invoiceNo: returnNumber,
        date: normalizedReturnDate,
        partyName: "",
        warehouseName: "",
        itemCount: validItems.length,
        grandTotal: Number(totalAmount.toFixed(2)),
        status: "SAVED",
        paymentMode: invoiceWasPaid ? "CREDIT" : "PARTIAL",
        originalInvoiceId,
        originalInvoiceNo: "",
        paymentHandled: false,
        paymentType: null,
        refundId: null,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("createSaleReturn error:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// PATCH /sales/returns/:id/payment
// Handle return payment — Refund or Credit
// ─────────────────────────────────────────────
const handleReturnPayment = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({ success: false, message: "Company context missing in token" });
  }

  const { paymentType, paymentMode, amount } = req.body;
  const adjustmentAmount = Math.max(0, Number(req.body?.adjustmentAmount || 0));

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Fetch the return record
    const { rows } = await client.query(
      `SELECT sr.*, si.customer_id
       FROM sale_returns sr
       LEFT JOIN sales_invoices si ON si.id = sr.original_invoice_id
       WHERE sr.id = $1 AND sr.company_id = $2 AND sr.is_active = true`,
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sale return not found" });
    }

    const saleReturn = rows[0];

    if (saleReturn.payment_handled) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Payment for this return has already been handled",
      });
    }

    const totalReturnAmount = Number(saleReturn.total_amount || 0);
    const remainingToSettle = totalReturnAmount - adjustmentAmount;

    // Fully settled by due-adjustment only: do not require/store refund/credit type.
    if (remainingToSettle <= 0) {
      if (adjustmentAmount > 0) {
        await applyCustomerPurseDelta(client, company_id, saleReturn.customer_id, adjustmentAmount);
      }

      await client.query(
        `UPDATE sale_returns
         SET payment_handled = true,
             payment_type    = NULL,
             refund_id       = NULL,
             updated_at      = NOW()
         WHERE id = $1`,
        [id]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: `Return settled via adjustment of ${adjustmentAmount.toFixed(2)}`,
        settled: true,
      });
    }

    if (!["REFUND", "CREDIT"].includes(paymentType)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "paymentType must be REFUND or CREDIT",
      });
    }

    if (paymentType === "REFUND" && (!paymentMode || !amount || Number(amount) <= 0)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "paymentMode and amount are required for REFUND",
      });
    }

    const hasValidPayment = Number(amount || 0) > 0 || adjustmentAmount > 0;
    if (paymentType === "CREDIT" && !hasValidPayment) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "amount or adjustmentAmount is required for CREDIT",
      });
    }

    let refundId = null;
    const settlementAmount = Number(amount || 0);

    if (paymentType === "REFUND") {
      // Generate REF number
      const { rows: refCountRows } = await client.query(
        `SELECT COUNT(*) AS cnt FROM refunds_given WHERE company_id = $1`,
        [company_id]
      );
      const refSeq   = String(parseInt(refCountRows[0].cnt) + 1).padStart(5, "0");
      const refNumber = `REF-${refSeq}`;

      refundId = uuidv4();

      await client.query(
        `INSERT INTO refunds_given
           (id, company_id, sale_return_id, customer_id, refund_number,
            payment_mode, amount, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          refundId,
          company_id,
          id,
          saleReturn.customer_id,
          refNumber,
          paymentMode,
          settlementAmount,
          userId,
        ]
      );
    } else {
      // CREDIT → store as customer credit
      await client.query(
        `INSERT INTO customer_credits
           (id, company_id, customer_id, sale_return_id, amount, is_used, created_by)
         VALUES ($1,$2,$3,$4,$5,false,$6)`,
        [
          uuidv4(),
          company_id,
          saleReturn.customer_id,
          id,
          settlementAmount,
          userId,
        ]
      );
    }

    if (adjustmentAmount > 0) {
      await applyCustomerPurseDelta(client, company_id, saleReturn.customer_id, adjustmentAmount);
    }

    if (paymentType === "CREDIT" && settlementAmount > 0) {
      await applyCustomerPurseDelta(client, company_id, saleReturn.customer_id, settlementAmount);
    }

    // Mark return as payment_handled
    await client.query(
      `UPDATE sale_returns
       SET payment_handled = true,
           payment_type    = $1,
           refund_id       = $2,
           updated_at      = NOW()
       WHERE id = $3`,
      [paymentType, refundId, id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Return payment processed as ${paymentType}`,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("handleReturnPayment error:", err);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────
// UPDATE SALE RETURN
// PUT /sales/returns/:id
// ─────────────────────────────────────────────
export const updateSaleReturn = async (req, res) => {
  const { id } = req.params;
  const { id: userId } = req.user;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({
      success: false,
      message: "Company context missing in token",
    });
  }

  const {
    returnDate,
    date,
    warehouseId,
    notes,
    reason,
    items,
  } = req.body;

  const normalizedReturnDate = returnDate || date;

  const normalizedItems = Array.isArray(items)
    ? items.map((item) => ({
        itemId: item.itemId,
        returnQty: Number(item.returnQty ?? item.qty ?? 0),
        rate: Number(item.rate ?? 0),
        reason: item.reason || reason || "Other",
        customReason: item.customReason || null,
      }))
    : [];

  const validItems = normalizedItems.filter(
    (item) =>
      item.itemId &&
      item.returnQty > 0 &&
      item.rate >= 0
  );

  if (!normalizedReturnDate || !validItems.length) {
    return res.status(400).json({
      success: false,
      message: "date and items are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ─────────────────────────────────────────
    // 1. Fetch existing return
    // ─────────────────────────────────────────
    const { rows: returnRows } = await client.query(
      `SELECT *
       FROM sale_returns
       WHERE id = $1
         AND company_id = $2
         AND is_active = true`,
      [id, company_id]
    );

    if (!returnRows.length) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        success: false,
        message: "Sale return not found",
      });
    }

    const saleReturn = returnRows[0];

    // Prevent editing after payment handled
    if (saleReturn.payment_handled) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        success: false,
        message: "Cannot edit finalized sale return",
      });
    }

    const originalInvoiceId = saleReturn.original_invoice_id;

    const resolvedWarehouseId =
      warehouseId || saleReturn.warehouse_id;

    // ─────────────────────────────────────────
    // 2. Restore old stock first
    // (reverse previous return)
    // ─────────────────────────────────────────
    const { rows: oldItems } = await client.query(
      `SELECT item_id, return_qty
       FROM sale_return_items
       WHERE sale_return_id = $1`,
      [id]
    );

    for (const oldItem of oldItems) {
      // Remove previously returned qty from stock
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE company_id = $2
           AND warehouse_id = $3
           AND item_id = $4`,
        [
          oldItem.return_qty,
          company_id,
          resolvedWarehouseId,
          oldItem.item_id,
        ]
      );

      // Delete old stock movements
      await client.query(
        `DELETE FROM stock_movements
         WHERE reference_type = 'SALE_RETURN'
           AND reference_id = $1
           AND item_id = $2`,
        [id, oldItem.item_id]
      );
    }

    // ─────────────────────────────────────────
    // 3. Delete old return items
    // ─────────────────────────────────────────
    await client.query(
      `DELETE FROM sale_return_items
       WHERE sale_return_id = $1`,
      [id]
    );

    // ─────────────────────────────────────────
    // 4. Validate against invoice sold qty
    // ─────────────────────────────────────────
    for (const item of validItems) {
      const { rows: soldRows } = await client.query(
        `SELECT quantity AS sold_qty
         FROM sales_invoice_items
         WHERE sales_invoice_id = $1
           AND item_id = $2`,
        [originalInvoiceId, item.itemId]
      );

      if (!soldRows.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: `Item ${item.itemId} was not on original invoice`,
        });
      }

      const soldQty = Number(soldRows[0].sold_qty || 0);

      if (item.returnQty > soldQty) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: `Return qty (${item.returnQty}) exceeds sold qty (${soldQty})`,
        });
      }
    }

    // ─────────────────────────────────────────
    // 5. Calculate total
    // ─────────────────────────────────────────
    const totalAmount = validItems.reduce(
      (sum, item) =>
        sum + item.returnQty * item.rate,
      0
    );

    // ─────────────────────────────────────────
    // 6. Insert new items + stock
    // ─────────────────────────────────────────
    for (const item of validItems) {
      const lineId = uuidv4();

      await client.query(
        `INSERT INTO sale_return_items
           (
             id,
             sale_return_id,
             item_id,
             return_qty,
             rate,
             reason,
             custom_reason
           )
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          lineId,
          id,
          item.itemId,
          item.returnQty,
          item.rate,
          item.reason,
          item.customReason,
        ]
      );

      // Increase stock again
      const stockUpdate = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1,
             updated_at = NOW()
         WHERE warehouse_id = $2
           AND item_id = $3
           AND company_id = $4`,
        [
          item.returnQty,
          resolvedWarehouseId,
          item.itemId,
          company_id,
        ]
      );

      if (stockUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock
             (
               id,
               company_id,
               warehouse_id,
               item_id,
               quantity              
             )
           VALUES ($1,$2,$3,$4,$5)`,
          [
            uuidv4(),
            company_id,
            resolvedWarehouseId,
            item.itemId,
            item.returnQty,
          ]
        );
      }

      // Stock movement
      await client.query(
        `INSERT INTO stock_movements
           (
             id,
             company_id,
             warehouse_id,
             item_id,
             movement_type,
             quantity,
             reference_type,
             reference_id,
             created_by
           )
         VALUES ($1,$2,$3,$4,'RETURN_IN',$5,'SALE_RETURN',$6,$7)`,
        [
          uuidv4(),
          company_id,
          resolvedWarehouseId,
          item.itemId,
          item.returnQty,
          id,
          userId,
        ]
      );
    }

    // ─────────────────────────────────────────
    // 7. Update return header
    // ─────────────────────────────────────────
    await client.query(
      `UPDATE sale_returns
       SET
         warehouse_id = $1,
         return_date  = $2,
         total_amount = $3,
         notes        = $4,
         updated_at   = NOW()
       WHERE id = $5`,
      [
        resolvedWarehouseId,
        normalizedReturnDate,
        totalAmount,
        notes || reason || null,
        id,
      ]
    );

    // ─────────────────────────────────────────
    // 8. Commit
    // ─────────────────────────────────────────
    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Sale return updated successfully",
      data: {
        id,
        totalAmount,
        itemCount: validItems.length,
      },
    });
  } catch (err) {
    await client.query("ROLLBACK");

    console.error("updateSaleReturn error:", err);

    return res.status(500).json({
      success: false,
      message: err.message || "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const deleteSaleReturn = async (req, res) => {
  const { id: userId } = req.user;
  const company_id = await resolveCompanyId(req.user);
  const { id } = req.params;
console.log("id=>0" ,id )
  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Return id is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔹 Get return
    const { rows } = await client.query(
      `SELECT * FROM sale_returns WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Sale return not found");

    const returnData = rows[0];

    // 🔹 Get items
    const items = await client.query(
      `SELECT * FROM sale_return_items WHERE sale_return_id = $1`,
      [id]
    );

    // 🔥 Reverse stock
    for (const item of items.rows) {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE warehouse_id = $2 AND item_id = $3 AND company_id = $4`,
        [item.return_qty, returnData.warehouse_id, item.item_id, company_id]
      );
    }

    // 🔥 Delete return (items auto delete via CASCADE if set)
    await client.query(`DELETE FROM sale_returns WHERE id = $1`, [id]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Sale return deleted successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deleteSaleReturn error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};
export {
  listSaleReturns,
  getSaleReturnById,
  createSaleReturn,
  handleReturnPayment,
};
