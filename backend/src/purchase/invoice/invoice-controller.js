import pool from "../../pool.js";
import { generateDocumentNumber } from "../../../utils/generateDocumentNumber.js";
import { generateItemCode } from "../../masters/items/items-controller.js";
import { randomUUID } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const calcItemAmounts = (qty, rate, discount_pct, tax_rate, isSameState) => {
  const gross        = qty * rate;
  const discAmt      = gross * (discount_pct / 100);
  const taxable      = gross - discAmt;
  const totalTax     = taxable * (tax_rate / 100);
  const cgst_amt     = isSameState ? totalTax / 2 : 0;
  const sgst_amt     = isSameState ? totalTax / 2 : 0;
  const igst_amt     = isSameState ? 0 : totalTax;
  const total_amount = taxable + totalTax;
  return { taxable_amount: taxable, cgst_amt, sgst_amt, igst_amt, total_amount };
};

const calcPaymentStatus = (paid_amount, total_amount) => {
  if (paid_amount <= 0)            return "UNPAID";
  if (paid_amount >= total_amount) return "PAID";
  return "PARTIAL";
};

const formatInvoice = (row) => ({
  id:                row.id,
  invoiceNumber:     row.invoice_number,
  supplierInvoiceNo: row.supplier_invoice_no || null,
  companyId:         row.company_id,
  warehouseId:       row.warehouse_id,
  warehouseName:     row.warehouse_name || null,
  supplierId:        row.supplier_id,
  supplierName:      row.supplier_name || null,
  supplierBillingAddress: row.billing_address || null, 
  supplierShippingAddress: row.shipping_address || null,  
  grnId:             row.grn_id || null,
  grnNumber:         row.grn_number || null,
  invoiceDate:       row.invoice_date,
  subtotal:          parseFloat(row.subtotal)        || 0,
  discountAmount:    parseFloat(row.discount_amount) || 0,
  taxableAmount:     parseFloat(row.taxable_amount)  || 0,
  cgst:              parseFloat(row.cgst)            || 0,
  sgst:              parseFloat(row.sgst)            || 0,
  igst:              parseFloat(row.igst)            || 0,
  roundOff:          parseFloat(row.round_off)       || 0,
  totalAmount:       parseFloat(row.total_amount)    || 0,
  paidAmount:        parseFloat(row.paid_amount)     || 0,
  balanceDue:        parseFloat(row.total_amount - row.paid_amount) || 0,
  paymentStatus:     row.payment_status,
  creditAdjustment:  parseFloat(row.credit_adjustment) || 0,
  stockUpdated:      row.stock_updated,
  notes:             row.notes || null,
  createdBy:         row.created_by,
  createdAt:         row.created_at,
});

const formatItem = (i) => ({
  id:            i.id,
  invoiceId:     i.invoice_id,
  itemId:        i.item_id,
  itemName:      i.item_name,
  hsnCode:       i.hsn_code  || null,
  qty:           parseFloat(i.qty),
  unitId:        i.unit_id   || null,
  unitName:      i.unit_name || null,
  rate:          parseFloat(i.rate),
  discountPct:   parseFloat(i.discount_pct)   || 0,
  taxableAmount: parseFloat(i.taxable_amount) || 0,
  taxRate:       parseFloat(i.tax_rate),
  cgstAmt:       parseFloat(i.cgst_amt)       || 0,
  sgstAmt:       parseFloat(i.sgst_amt)       || 0,
  igstAmt:       parseFloat(i.igst_amt)       || 0,
  totalAmount:   parseFloat(i.total_amount),
});

// ─── Unit resolver: find existing unit by name, or create it ─────────────────
const resolveUnitByName = async ({ client, company_id, createdBy, unitName }) => {
  const name = String(unitName || '').trim();
  if (!name) return null;

  // Try to find existing unit (case-insensitive)
  const { rows: existingUnits } = await client.query(
    `SELECT id FROM units
     WHERE company_id = $1
       AND LOWER(TRIM(name)) = LOWER(TRIM($2))
     LIMIT 1`,
    [company_id, name]
  );

  if (existingUnits.length > 0) {
    return existingUnits[0].id;
  }

  // Create a new unit
  const { rows: createdUnits } = await client.query(
    `INSERT INTO units (id, company_id, name, short_name, is_active, created_by)
     VALUES (gen_random_uuid(), $1, $2, $3, true, $4)
     RETURNING id`,
    [company_id, name, name.substring(0, 10), createdBy]
  );

  return createdUnits[0].id;
};

const resolveInvoiceItems = async ({ client, company_id, warehouseId, createdBy, items }) => {
  const resolvedItems = [];
  const resolvedByName = new Map();

  for (const item of items) {
    const itemName = String(item.itemName || "").trim();
    if (!itemName) continue;

    // ── Case 1: Existing item (isKnownItem=true or itemId present) ─────────
    if (item.itemId) {
      resolvedItems.push(item);
      continue;
    }

    // ── Case 2: New item — check if already resolved in this batch ──────────
    const key = itemName.toLowerCase();
    if (resolvedByName.has(key)) {
      resolvedItems.push({ ...item, itemId: resolvedByName.get(key) });
      continue;
    }

    // ── Case 3: Check if item exists in DB by name ────────────────────────
    const { rows: existingItems } = await client.query(
      `SELECT id
       FROM items
       WHERE company_id = $1
         AND LOWER(TRIM(name)) = LOWER(TRIM($2))
         AND COALESCE(is_active, true) = true
       LIMIT 1`,
      [company_id, itemName]
    );

    if (existingItems.length > 0) {
      const itemId = existingItems[0].id;
      resolvedByName.set(key, itemId);
      resolvedItems.push({ ...item, itemId });
      continue;
    }

    // ── Case 4: Truly new item — resolve unit first, then create item ──────
    // Resolve unitId: use provided unitId, or find/create unit by unitName
    let resolvedUnitId = item.unitId || null;
    let resolvedUnitName = item.unitName || item.unit || 'Pcs';

    if (!resolvedUnitId && resolvedUnitName) {
      resolvedUnitId = await resolveUnitByName({
        client,
        company_id,
        createdBy,
        unitName: resolvedUnitName,
      });
    }

    const code = await generateItemCode(company_id, client);
    const { rows: insertedItems } = await client.query(
      `INSERT INTO items (
        company_id, name, code, barcode,
        category_id, category, brand, hsn_code,
        gst_rate, primary_unit_id,
        purchase_rate, sale_rate, unit_name,
        mrp, min_stock_level,
        article_no, size_color, image_url, warehouseid,
        is_active, created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
      )
      RETURNING id`,
      [
        company_id,
        itemName,
        code,
        item.barcode || null,
        item.categoryId || null,
        item.categoryName || item.group || null,
        item.brand || null,
        item.hsnCode || null,
        Number(item.taxRate || 0),
        resolvedUnitId,
        Number(item.rate || item.purchaseRate || 0),
        Number(item.saleRate || 0),
        resolvedUnitName,
        Number(item.mrp || 0),
        Number(item.minStockLevel || 0),
        item.articleNo || null,
        item.sizeColor || null,
        item.imageUrl || null,
        warehouseId || null,
        true,
        createdBy,
      ]
    );

    const itemId = insertedItems[0].id;
    resolvedByName.set(key, itemId);
    // Carry resolved unit info forward so invoice line item gets correct unitId/unitName
    resolvedItems.push({ ...item, itemId, unitId: resolvedUnitId, unitName: resolvedUnitName });
  }

  return resolvedItems;
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE PURCHASE INVOICE
// ─────────────────────────────────────────────────────────────────────────────

export const createPurchaseInvoice = async (req, res) => {
  console.log("🔥 createPurchaseInvoice LATEST FILE RUNNING");

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
  
    const {
      supplierId,
      warehouseId,
      grnId,
      supplierInvoiceNo,
      invoiceDate,
      items            = [],
      discountAmount   = 0,
      roundOff         = 0,
      notes,
      paidAmount       = 0,
      creditAdjustment = 0,
      isSameState      = true,
    } = req.body;
console.log("AAAAAAA==>" ,req.body)
    // ── Validations ────────────────────────────────────────────────────────────
    if (!supplierId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Supplier is required" });
    }
    if (!warehouseId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Warehouse is required" });
    }

    let validItems = items.filter(
      (i) => i.itemName && Number(i.qty) > 0 && Number(i.rate) >= 0
    );
    if (validItems.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Add at least one valid item" });
    }

    // ── Fetch supplier with FOR UPDATE lock ────────────────────────────────────
    const { rows: supplierRows } = await client.query(
      `SELECT id, name, credit_limit, opening_balance
       FROM parties
       WHERE id = $1 AND company_id = $2 AND type = ANY($3)
       FOR UPDATE`,
      [supplierId, company_id, ["Supplier", "Both"]]
    );

    if (supplierRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    const supplier            = supplierRows[0];
    const currentBalance      = toNumber(supplier.opening_balance, 0);
    const supplierCreditLimit = toNumber(supplier.credit_limit, 0);

    console.log("📦 Supplier fetched:", supplier.name, "| currentBalance:", currentBalance);

    // ── Validate warehouse ─────────────────────────────────────────────────────
    const { rows: warehouseRows } = await client.query(
      "SELECT id FROM warehouses WHERE id = $1 AND company_id = $2",
      [warehouseId, company_id]
    );
    if (warehouseRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Warehouse not found" });
    }

    validItems = await resolveInvoiceItems({
      client,
      company_id,
      warehouseId,
      createdBy: req.user.id,
      items: validItems,
    });

    // ── Validate GRN ───────────────────────────────────────────────────────────
    let resolvedGrnId = null;
    if (grnId) {
      const { rows: grnRows } = await client.query(
        "SELECT id, status FROM grns WHERE id = $1 AND company_id = $2",
        [grnId, company_id]
      );
      if (grnRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "GRN not found" });
      }
      if (grnRows[0].status === "INVOICED") {
        await client.query("ROLLBACK");
        return res.status(409).json({ success: false, message: "This GRN is already linked to an invoice" });
      }
      resolvedGrnId = grnId;
    }

    // ── Calculate line items ───────────────────────────────────────────────────
    let subtotal     = 0;
    let totalTaxable = 0;
    let totalCGST    = 0;
    let totalSGST    = 0;
    let totalIGST    = 0;

    const computedItems = validItems.map((item) => {
      const calc = calcItemAmounts(
        Number(item.qty),
        Number(item.rate),
        Number(item.discountPct || 0),
        Number(item.taxRate    || 0),
        isSameState
      );
      subtotal     += Number(item.qty) * Number(item.rate);
      totalTaxable += calc.taxable_amount;
      totalCGST    += calc.cgst_amt;
      totalSGST    += calc.sgst_amt;
      totalIGST    += calc.igst_amt;
      return { ...item, ...calc };
    });

    const taxableAfterDiscount = totalTaxable - Number(discountAmount);
    const grandTotal = taxableAfterDiscount + totalCGST + totalSGST + totalIGST + Number(roundOff);

    // ── Payment calculation ────────────────────────────────────────────────────
    const received             = Math.max(0, toNumber(paidAmount, 0));
    const directPaidAmount     = Math.min(received, grandTotal);
    const remainingAfterDirect = Math.max(grandTotal - directPaidAmount, 0);

    // Credit: only usable if opening_balance is positive (supplier owes us advance)
    const usableCreditAmount = Math.max(0, currentBalance);
    const shouldApplyCredit  = Boolean(creditAdjustment);
    const creditApplied      = shouldApplyCredit
      ? Math.min(usableCreditAmount, remainingAfterDirect)
      : 0;

    const effectivePaid = Number((directPaidAmount + creditApplied).toFixed(2));
    const paymentStatus = calcPaymentStatus(effectivePaid, grandTotal);

    // ── Next supplier balance ──────────────────────────────────────────────────
    // Deduct the unpaid amount from supplier's opening_balance.
    // opening_balance goes negative = we owe the supplier
    // opening_balance goes positive = supplier owes us (advance paid)
    const nextBalance = Number((currentBalance + remainingAfterDirect).toFixed(2));

    console.log("💰 Balance calculation:");
    console.log("   grandTotal         :", grandTotal);
    console.log("   directPaidAmount   :", directPaidAmount);
    console.log("   remainingAfterDirect:", remainingAfterDirect);
    console.log("   currentBalance     :", currentBalance);
    console.log("   nextBalance        :", nextBalance);

    // ── Credit limit guard ─────────────────────────────────────────────────────
    if (nextBalance < -supplierCreditLimit) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Supplier credit limit exceeded. Available: ₹${Math.max(0, currentBalance + supplierCreditLimit).toFixed(2)}`,
      });
    }

    // ── Generate invoice number ────────────────────────────────────────────────
    const invoice_number = await generateDocumentNumber({
      client,
      company_id,
      doc_type: "PURCHASE_INVOICE",
    });

    const stockUpdated = resolvedGrnId ? false : true;

    // ── Insert invoice ─────────────────────────────────────────────────────────
    const { rows: invRows } = await client.query(
      `INSERT INTO purchase_invoices
        (company_id, warehouse_id, supplier_id, grn_id,
         invoice_number, supplier_invoice_no, invoice_date,
         subtotal, discount_amount, taxable_amount,
         cgst, sgst, igst, round_off, total_amount,
         paid_amount, payment_status, credit_adjustment,
         stock_updated, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        company_id,
        warehouseId,
        supplierId,
        resolvedGrnId,
        invoice_number,
        supplierInvoiceNo || null,
        invoiceDate       || new Date(),
        subtotal.toFixed(2),
        Number(discountAmount).toFixed(2),
        taxableAfterDiscount.toFixed(2),
        totalCGST.toFixed(2),
        totalSGST.toFixed(2),
        totalIGST.toFixed(2),
        Number(roundOff).toFixed(2),
        grandTotal.toFixed(2),
        effectivePaid.toFixed(2),
        paymentStatus,
        creditApplied.toFixed(2),
        stockUpdated,
        notes || null,
        req.user.id,
      ]
    );

    const invoice = invRows[0];
    console.log("✅ Invoice inserted:", invoice.invoice_number);

    // ── Insert line items ──────────────────────────────────────────────────────
    const insertedItems = [];
    for (const item of computedItems) {
      const { rows: itemRows } = await client.query(
        `INSERT INTO purchase_invoice_items
          (invoice_id, item_id, item_name, hsn_code,
           qty, unit_id, rate, discount_pct,
           taxable_amount, tax_rate,
           cgst_amt, sgst_amt, igst_amt, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
         RETURNING *`,
        [
          invoice.id,
          item.itemId,
          item.itemName,
          item.hsnCode        || null,
          Number(item.qty),
          item.unitId         || null,
          Number(item.rate),
          Number(item.discountPct || 0),
          item.taxable_amount.toFixed(2),
          Number(item.taxRate || 0),
          item.cgst_amt.toFixed(2),
          item.sgst_amt.toFixed(2),
          item.igst_amt.toFixed(2),
          item.total_amount.toFixed(2),
        ]
      );
      insertedItems.push(itemRows[0]);
    }

    // ── Update stock ───────────────────────────────────────────────────────────
    if (stockUpdated) {
      for (const item of insertedItems) {
        await client.query(
          `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (company_id, warehouse_id, item_id)
           DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
          [randomUUID(), company_id, warehouseId, item.item_id, Number(item.qty)]
        );

        await client.query(
          `INSERT INTO stock_movements
            (id, company_id, warehouse_id, item_id, movement_type,
             quantity, reference_type, reference_id, created_by)
           VALUES ($1,$2,$3,$4,'PURCHASE_IN',$5,'PURCHASE_INVOICE',$6,$7)`,
          [randomUUID(), company_id, warehouseId, item.item_id,
           Number(item.qty), invoice.id, req.user.id]
        );
      }
    }

    // ── Mark GRN as INVOICED ───────────────────────────────────────────────────
    if (resolvedGrnId) {
      await client.query(
        `UPDATE grns SET status = 'INVOICED' WHERE id = $1 AND company_id = $2`,
        [resolvedGrnId, company_id]
      );
    }

    // ── UPDATE parties opening_balance ─────────────────────────────────────────
    console.log("🔄 Updating parties table — supplierId:", supplierId, "| nextBalance:", nextBalance);

    const { rows: updatedPartyRows } = await client.query(
      `UPDATE parties
       SET opening_balance = $1
       WHERE id = $2 AND company_id = $3
       RETURNING id, name, credit_limit, opening_balance`,
      [nextBalance, supplierId, company_id]
    );

    console.log("📬 updatedPartyRows:", updatedPartyRows);

    if (!updatedPartyRows.length) {
      await client.query("ROLLBACK");
      return res.status(500).json({ success: false, message: "Failed to update supplier balance" });
    }

    const updatedSupplier    = updatedPartyRows[0];
    const updatedBalance     = Number(updatedSupplier.opening_balance);
    const updatedCreditLimit = Number(updatedSupplier.credit_limit);

    console.log("✅ Party balance updated from", currentBalance, "→", updatedBalance);

    await client.query("COMMIT");
    console.log("✅ COMMIT done");

    return res.status(201).json({
      success: true,
      message: `${invoice_number} created successfully`,
      data: {
        ...formatInvoice(invoice),
        items: insertedItems.map(formatItem),
        supplier: {
          id:              updatedSupplier.id,
          name:            updatedSupplier.name,
          previousBalance: currentBalance,
          openingBalance:  updatedBalance,
          creditLimit:     updatedCreditLimit,
          availableCredit: Number(Math.max(updatedBalance, 0).toFixed(2)),
          dueBalance:      Number(Math.max(-updatedBalance, 0).toFixed(2)),
          creditApplied:   Number(creditApplied.toFixed(2)),
        },
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Create Purchase Invoice Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ALL PURCHASE INVOICES
// ─────────────────────────────────────────────────────────────────────────────
export const getAllPurchaseInvoices = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const {
      search         = "",
      payment_status = "",
      supplier_id    = "",
      warehouse_id   = "",
      from_date      = "",
      to_date        = "",
    } = req.query;

    let query = `
      SELECT
        pi.*,
        w.name                             AS warehouse_name,
        p.name                             AS supplier_name,
        g.grn_number                       AS grn_number,
        COUNT(pii.id)                      AS item_count,
        (pi.total_amount - pi.paid_amount) AS balance_due
      FROM purchase_invoices pi
      LEFT JOIN warehouses w  ON pi.warehouse_id = w.id AND w.company_id = $1
      LEFT JOIN parties    p  ON pi.supplier_id  = p.id AND p.company_id = $1
      LEFT JOIN grns       g  ON pi.grn_id       = g.id AND g.company_id = $1
      LEFT JOIN purchase_invoice_items pii ON pii.invoice_id = pi.id
      WHERE pi.company_id = $1
    `;

    const values = [company_id];
    let idx = 2;

    if (search) {
      query += ` AND (pi.invoice_number ILIKE $${idx} OR p.name ILIKE $${idx} OR pi.supplier_invoice_no ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }
    if (payment_status && payment_status !== "ALL") {
      query += ` AND pi.payment_status = $${idx}`;
      values.push(payment_status.toUpperCase());
      idx++;
    }
    if (supplier_id) {
      query += ` AND pi.supplier_id = $${idx}`;
      values.push(supplier_id);
      idx++;
    }
    if (warehouse_id) {
      query += ` AND pi.warehouse_id = $${idx}`;
      values.push(warehouse_id);
      idx++;
    }
    if (from_date) {
      query += ` AND pi.invoice_date >= $${idx}`;
      values.push(from_date);
      idx++;
    }
    if (to_date) {
      query += ` AND pi.invoice_date <= $${idx}`;
      values.push(to_date);
      idx++;
    }

    query += `
      GROUP BY pi.id, w.name, p.name, g.grn_number
      ORDER BY pi.created_at DESC
    `;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((row) => ({
        ...formatInvoice(row),
        itemCount:  Number(row.item_count),
        balanceDue: parseFloat(row.balance_due) || 0,
      })),
    });

  } catch (error) {
    console.error("Get All Purchase Invoices Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET PURCHASE INVOICE BY ID
// ─────────────────────────────────────────────────────────────────────────────
export const getPurchaseInvoiceById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // ─────────────────────────────────────────────
    // 🔹 FETCH INVOICE + RELATIONS
    // ─────────────────────────────────────────────
    const { rows: invRows } = await pool.query(
      `SELECT 
        pi.*,

        -- warehouse
        w.name AS warehouse_name,
        w.address AS warehouse_address,

        -- supplier
        p.name AS supplier_name,
        p.billing_address,
        p.shipping_address,
        p.phone AS supplier_phone,
        p.gstin AS supplier_gstin,

        -- company
        c.name AS company_name,
        c.address AS company_address,
        c.gstin AS company_gstin,

        -- grn
        g.grn_number

       FROM purchase_invoices pi

       LEFT JOIN warehouses w 
         ON pi.warehouse_id = w.id AND w.company_id = $2

       LEFT JOIN parties p 
         ON pi.supplier_id = p.id AND p.company_id = $2

       LEFT JOIN companies c 
         ON pi.company_id = c.id

       LEFT JOIN grns g 
         ON pi.grn_id = g.id AND g.company_id = $2

       WHERE pi.id = $1 AND pi.company_id = $2`,
      [id, company_id]
    );

    if (!invRows.length) {
      return res.status(404).json({
        success: false,
        message: "Invoice not found",
      });
    }

    const invoiceRow = invRows[0];

    // ─────────────────────────────────────────────
    // 🔹 FETCH ITEMS WITH BARCODE DATA
    // ─────────────────────────────────────────────
    const { rows: itemRows } = await pool.query(
      `SELECT 
        pii.*,

        u.name AS unit_name,

        -- item master data
        im.barcode,
      
        im.code

       FROM purchase_invoice_items pii

       LEFT JOIN units u 
         ON pii.unit_id = u.id

       LEFT JOIN items im 
         ON pii.item_id = im.id

       WHERE pii.invoice_id = $1
       ORDER BY pii.id`,
      [id]
    );

    // ─────────────────────────────────────────────
    // 🔹 FORMAT RESPONSE
    // ─────────────────────────────────────────────
    const formattedInvoice = {
      ...formatInvoice(invoiceRow),

      // ✅ extra fields
      company: {
        name: invoiceRow.company_name,
        address: invoiceRow.company_address,
        gstin: invoiceRow.company_gstin,
      },

      warehouse: {
        id: invoiceRow.warehouse_id,
        name: invoiceRow.warehouse_name,
        address: invoiceRow.warehouse_address,
      },

      supplier: {
        id: invoiceRow.supplier_id,
        name: invoiceRow.supplier_name,
        phone: invoiceRow.supplier_phone,
        gstin: invoiceRow.supplier_gstin,
        billingAddress: invoiceRow.billing_address,
        shippingAddress: invoiceRow.shipping_address,
      },

      grnNumber: invoiceRow.grn_number || null,

      items: itemRows.map((i) => ({
        id: i.id,
        invoiceId: i.invoice_id,
        itemId: i.item_id,
        itemName: i.item_name,

        // 🔥 barcode fields
        barcode: i.barcode || null,
        sku: i.sku || null,
        itemCode: i.item_code || null,

        hsnCode: i.hsn_code || null,
        qty: parseFloat(i.qty),
        unitId: i.unit_id || null,
        unitName: i.unit_name || null,
        rate: parseFloat(i.rate),
        discountPct: parseFloat(i.discount_pct) || 0,
        taxableAmount: parseFloat(i.taxable_amount) || 0,
        taxRate: parseFloat(i.tax_rate),
        cgstAmt: parseFloat(i.cgst_amt) || 0,
        sgstAmt: parseFloat(i.sgst_amt) || 0,
        igstAmt: parseFloat(i.igst_amt) || 0,
        totalAmount: parseFloat(i.total_amount),
      })),
    };

    // ─────────────────────────────────────────────
    // 🔹 RESPONSE
    // ─────────────────────────────────────────────
    return res.status(200).json({
      success: true,
      data: formattedInvoice,
    });

  } catch (error) {
    console.error("Get Purchase Invoice By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
};


// ─────────────────────────────────────────────────────────────────────────────
// GET INVOICE STATS
// ─────────────────────────────────────────────────────────────────────────────
export const getPurchaseInvoiceStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;f

    const { rows } = await pool.query(
      `SELECT
        COUNT(*)                                                                   AS total,
        COUNT(*) FILTER (WHERE payment_status = 'UNPAID')                         AS unpaid,
        COUNT(*) FILTER (WHERE payment_status = 'PARTIAL')                        AS partial,
        COUNT(*) FILTER (WHERE payment_status = 'PAID')                           AS paid,
        COUNT(*) FILTER (WHERE invoice_date >= date_trunc('month', CURRENT_DATE)) AS this_month,
        COALESCE(SUM(total_amount), 0)                                             AS total_value,
        COALESCE(SUM(total_amount - paid_amount), 0)                               AS total_outstanding
       FROM purchase_invoices
       WHERE company_id = $1`,
      [company_id]
    );

    const s = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        total:            Number(s.total),
        unpaid:           Number(s.unpaid),
        partial:          Number(s.partial),
        paid:             Number(s.paid),
        thisMonth:        Number(s.this_month),
        totalValue:       parseFloat(s.total_value),
        totalOutstanding: parseFloat(s.total_outstanding),
      },
    });

  } catch (error) {
    console.error("Invoice Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECORD PAYMENT
// ─────────────────────────────────────────────────────────────────────────────
export const recordPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id }     = req.params;
    const company_id = req.user.company_id;
    const { amount } = req.body;

    if (!amount || Number(amount) <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Valid payment amount is required" });
    }

    const { rows: invoiceRows } = await client.query(
      "SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (invoiceRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice       = invoiceRows[0];
    const paymentAmount = Number(amount);
    const newPaid       = Math.min(
      parseFloat(invoice.paid_amount) + paymentAmount,
      parseFloat(invoice.total_amount)
    );
    const newStatus = calcPaymentStatus(newPaid, parseFloat(invoice.total_amount));

    // Lock supplier row
    const { rows: supplierRows } = await client.query(
      `SELECT id, name, credit_limit, opening_balance
       FROM parties
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [invoice.supplier_id, company_id]
    );

    if (supplierRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Supplier not found" });
    }

    // Paying supplier = our due reduces = opening_balance goes up (less negative)
    const currentOpening = toNumber(supplierRows[0].opening_balance, 0);
    const nextOpening    = Number((currentOpening + paymentAmount).toFixed(2));

    const { rows: updatedPartyRows } = await client.query(
      `UPDATE parties
       SET opening_balance = $1
       WHERE id = $2 AND company_id = $3
       RETURNING id, name, credit_limit, opening_balance`,
      [nextOpening, invoice.supplier_id, company_id]
    );

    if (!updatedPartyRows.length) {
      await client.query("ROLLBACK");
      return res.status(500).json({ success: false, message: "Failed to update supplier balance" });
    }

    const updatedSupplier    = updatedPartyRows[0];
    const updatedBalance     = Number(updatedSupplier.opening_balance);
    const updatedCreditLimit = Number(updatedSupplier.credit_limit);

    const { rows: updated } = await client.query(
      `UPDATE purchase_invoices
       SET paid_amount = $1, payment_status = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4
       RETURNING *`,
      [newPaid.toFixed(2), newStatus, id, company_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Payment recorded. Status: ${newStatus}`,
      data: {
        ...formatInvoice(updated[0]),
        supplier: {
          id:              updatedSupplier.id,
          name:            updatedSupplier.name,
          openingBalance:  updatedBalance,
          creditLimit:     updatedCreditLimit,
          availableCredit: Number(Math.max(updatedBalance, 0).toFixed(2)),
          dueBalance:      Number(Math.max(-updatedBalance, 0).toFixed(2)),
        },
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Record Payment Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE PURCHASE INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export const deletePurchaseInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id }     = req.params;
    const company_id = req.user.company_id;

    const { rows: invRows } = await client.query(
      "SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice = invRows[0];

    if (parseFloat(invoice.paid_amount) > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `${invoice.invoice_number} cannot be deleted — it has recorded payments`,
      });
    }

    const { rows: itemRows } = await client.query(
      "SELECT * FROM purchase_invoice_items WHERE invoice_id = $1",
      [id]
    );

    // Reverse stock if this invoice updated it
    if (invoice.stock_updated) {
      for (const item of itemRows) {
        await client.query(
          `UPDATE warehouse_stock
           SET quantity = GREATEST(0, quantity - $1)
           WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
          [Number(item.qty), company_id, invoice.warehouse_id, item.item_id]
        );
      }

      await client.query(
        `DELETE FROM stock_movements
         WHERE reference_type = 'PURCHASE_INVOICE'
           AND reference_id   = $1
           AND company_id     = $2`,
        [id, company_id]
      );
    }

    // Revert GRN
    if (invoice.grn_id) {
      await client.query(
        `UPDATE grns SET status = 'CONFIRMED', updated_at = NOW()
         WHERE id = $1 AND company_id = $2`,
        [invoice.grn_id, company_id]
      );
    }

    // Reverse supplier balance
    // At creation: nextBalance = currentBalance - remainingAfterDirect
    // So to reverse: add back remainingAfterDirect = totalAmount - (paidAmount - creditAdjustment)
    const totalAmt     = parseFloat(invoice.total_amount);
    const creditAdj    = parseFloat(invoice.credit_adjustment || 0);
    const cashPaid     = parseFloat(invoice.paid_amount) - creditAdj;
    const remainingWas = totalAmt - cashPaid;

    const { rows: supplierRows } = await client.query(
      `SELECT opening_balance FROM parties
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [invoice.supplier_id, company_id]
    );

    if (supplierRows.length > 0) {
      const reversedBalance = Number(
        (toNumber(supplierRows[0].opening_balance, 0) + remainingWas).toFixed(2)
      );
      await client.query(
        `UPDATE parties SET opening_balance = $1 WHERE id = $2 AND company_id = $3`,
        [reversedBalance, invoice.supplier_id, company_id]
      );
    }

    await client.query("DELETE FROM purchase_invoices WHERE id = $1", [id]);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${invoice.invoice_number} deleted successfully`,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Purchase Invoice Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET ACTIVE PURCHASE INVOICES
// ─────────────────────────────────────────────────────────────────────────────
export const getActivePurchaseInvoices = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { search = "", supplier_id = "", warehouse_id = "" } = req.query;

    let query = `
      WITH invoice_item_qty AS (
        SELECT pii.invoice_id, pii.item_id, SUM(pii.qty) AS invoice_qty
        FROM purchase_invoice_items pii
        GROUP BY pii.invoice_id, pii.item_id
      ),
      return_item_qty AS (
        SELECT pr.original_invoice_id AS invoice_id, pri.item_id, SUM(pri.return_qty) AS returned_qty
        FROM purchase_returns pr
        JOIN purchase_return_items pri ON pri.return_id = pr.id
        WHERE pr.company_id = $1
        GROUP BY pr.original_invoice_id, pri.item_id
      ),
      item_comparison AS (
        SELECT i.invoice_id, i.item_id, i.invoice_qty, COALESCE(r.returned_qty, 0) AS returned_qty
        FROM invoice_item_qty i
        LEFT JOIN return_item_qty r ON i.invoice_id = r.invoice_id AND i.item_id = r.item_id
      ),
      invoice_status AS (
        SELECT invoice_id, BOOL_AND(returned_qty >= invoice_qty) AS fully_returned
        FROM item_comparison
        GROUP BY invoice_id
      )
      SELECT
        pi.*, w.name AS warehouse_name, p.name AS supplier_name, g.grn_number,
        COUNT(pii.id) AS item_count,
        COALESCE(inv.fully_returned, false) AS fully_returned
      FROM purchase_invoices pi
      LEFT JOIN warehouses w ON pi.warehouse_id = w.id AND w.company_id = $1
      LEFT JOIN parties    p ON pi.supplier_id  = p.id AND p.company_id = $1
      LEFT JOIN grns       g ON pi.grn_id       = g.id AND g.company_id = $1
      LEFT JOIN purchase_invoice_items pii ON pii.invoice_id = pi.id
      LEFT JOIN invoice_status inv ON inv.invoice_id = pi.id
      WHERE pi.company_id = $1
    `;

    const values = [company_id];
    let idx = 2;

    if (search) {
      query += ` AND (pi.invoice_number ILIKE $${idx} OR p.name ILIKE $${idx})`;
      values.push(`%${search}%`);
      idx++;
    }
    if (supplier_id) {
      query += ` AND pi.supplier_id = $${idx}`;
      values.push(supplier_id);
      idx++;
    }
    if (warehouse_id) {
      query += ` AND pi.warehouse_id = $${idx}`;
      values.push(warehouse_id);
      idx++;
    }

    query += `
      GROUP BY pi.id, w.name, p.name, g.grn_number, inv.fully_returned
      HAVING COALESCE(inv.fully_returned, false) = false
      ORDER BY pi.created_at DESC
    `;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map((row) => ({
        ...formatInvoice(row),
        itemCount:     Number(row.item_count),
        fullyReturned: row.fully_returned,
      })),
    });

  } catch (error) {
    console.error("Get Active Purchase Invoices Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DUPLICATE PURCHASE INVOICE
// ─────────────────────────────────────────────────────────────────────────────
export const duplicatePurchaseInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id }     = req.params;

    const { rows: invRows } = await client.query(
      "SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Original invoice not found" });
    }

    const original = invRows[0];

    const { rows: items } = await client.query(
      "SELECT * FROM purchase_invoice_items WHERE invoice_id = $1",
      [id]
    );

    if (!items.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "No items found to duplicate" });
    }

    const invoice_number = await generateDocumentNumber({
      client,
      company_id,
      doc_type: "PURCHASE_INVOICE",
    });

    const { rows: newInvRows } = await client.query(
      `INSERT INTO purchase_invoices
        (company_id, warehouse_id, supplier_id, grn_id,
         invoice_number, supplier_invoice_no, invoice_date,
         subtotal, discount_amount, taxable_amount,
         cgst, sgst, igst, round_off, total_amount,
         paid_amount, payment_status, credit_adjustment,
         stock_updated, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)
       RETURNING *`,
      [
        company_id,
        original.warehouse_id,
        original.supplier_id,
        null,
        invoice_number,
        original.supplier_invoice_no,
        new Date(),
        original.subtotal,
        original.discount_amount,
        original.taxable_amount,
        original.cgst,
        original.sgst,
        original.igst,
        original.round_off,
        original.total_amount,
        0,
        "UNPAID",
        0,
        true,
        original.notes,
        req.user.id,
      ]
    );

    const newInvoice = newInvRows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO purchase_invoice_items
          (invoice_id, item_id, item_name, hsn_code,
           qty, unit_id, rate, discount_pct,
           taxable_amount, tax_rate,
           cgst_amt, sgst_amt, igst_amt, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          newInvoice.id, item.item_id, item.item_name, item.hsn_code,
          item.qty, item.unit_id, item.rate, item.discount_pct,
          item.taxable_amount, item.tax_rate,
          item.cgst_amt, item.sgst_amt, item.igst_amt, item.total_amount,
        ]
      );

      await client.query(
        `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (company_id, warehouse_id, item_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
        [randomUUID(), company_id, original.warehouse_id, item.item_id, Number(item.qty)]
      );

      await client.query(
        `INSERT INTO stock_movements
          (id, company_id, warehouse_id, item_id, movement_type,
           quantity, reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'PURCHASE_IN',$5,'PURCHASE_INVOICE',$6,$7)`,
        [randomUUID(), company_id, original.warehouse_id, item.item_id,
         Number(item.qty), newInvoice.id, req.user.id]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${invoice_number} duplicated successfully`,
      data: formatInvoice(newInvoice),
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Duplicate Invoice Error:", error.message);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

export const updatePurchaseInvoice = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;
    const {
      warehouseId,
      supplierId,
      grnId,
      items           = [],
      isSameState     = true,
      discountAmount  = 0,
      roundOff        = 0,
      notes,
      paidAmount      = 0,
      creditAdjustment = 0,
      supplierInvoiceNo,
      invoiceDate,
    } = req.body;

    if (!id) throw new Error("Invoice id required");

    const { rows } = await client.query(
      `SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );
    if (!rows.length) throw new Error("Invoice not found");

    const oldInvoice = rows[0];

    // Reverse old stock
    if (oldInvoice.stock_updated) {
      const { rows: oldItems } = await client.query(
        `SELECT * FROM purchase_invoice_items WHERE invoice_id = $1`, [id]
      );
      for (const item of oldItems) {
        await client.query(
          `UPDATE warehouse_stock
           SET quantity = quantity - $1
           WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
          [item.qty, company_id, oldInvoice.warehouse_id, item.item_id]
        );
      }
    }

    // Reset old GRN
    if (oldInvoice.grn_id) {
      await client.query(
        `UPDATE grns SET status = 'CONFIRMED' WHERE id = $1`,
        [oldInvoice.grn_id]
      );
    }

    // Delete old items
    await client.query(
      `DELETE FROM purchase_invoice_items WHERE invoice_id = $1`, [id]
    );

    // ── Recalculate with full tax logic (same as create) ──────────────────
    const validItems = items.filter(
      (i) => i.itemId && i.itemName && Number(i.qty) > 0 && Number(i.rate) >= 0
    );

    let subtotal     = 0;
    let totalTaxable = 0;
    let totalCGST    = 0;
    let totalSGST    = 0;
    let totalIGST    = 0;

    const computedItems = validItems.map((item) => {
      const calc = calcItemAmounts(
        Number(item.qty),
        Number(item.rate),
        Number(item.discountPct || 0),
        Number(item.taxRate    || 0),
        isSameState
      );
      subtotal     += Number(item.qty) * Number(item.rate);
      totalTaxable += calc.taxable_amount;
      totalCGST    += calc.cgst_amt;
      totalSGST    += calc.sgst_amt;
      totalIGST    += calc.igst_amt;
      return { ...item, ...calc };
    });

    const taxableAfterDiscount = totalTaxable - Number(discountAmount);
    const grandTotal = taxableAfterDiscount + totalCGST + totalSGST + totalIGST + Number(roundOff);

    const effectivePaid = Math.min(toNumber(paidAmount, 0), grandTotal);
    const paymentStatus = calcPaymentStatus(effectivePaid, grandTotal);

    // Insert new items with full tax fields
    for (const item of computedItems) {
      await client.query(
        `INSERT INTO purchase_invoice_items
           (invoice_id, item_id, item_name, hsn_code,
            qty, unit_id, rate, discount_pct,
            taxable_amount, tax_rate,
            cgst_amt, sgst_amt, igst_amt, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          id, item.itemId, item.itemName, item.hsnCode || null,
          Number(item.qty), item.unitId || null,
          Number(item.rate), Number(item.discountPct || 0),
          item.taxable_amount, Number(item.taxRate || 0),
          item.cgst_amt, item.sgst_amt, item.igst_amt, item.total_amount,
        ]
      );

      if (!grnId) {
        await client.query(
          `INSERT INTO warehouse_stock (company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4)
           ON CONFLICT (company_id, warehouse_id, item_id)
           DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
          [company_id, warehouseId, item.itemId, Number(item.qty)]
        );
      }
    }

    // Update invoice header with recalculated totals
    await client.query(
      `UPDATE purchase_invoices
       SET warehouse_id      = $1,
           supplier_id       = $2,
           grn_id            = $3,
           supplier_invoice_no = $4,
           invoice_date      = $5,
           subtotal          = $6,
           discount_amount   = $7,
           taxable_amount    = $8,
           cgst              = $9,
           sgst              = $10,
           igst              = $11,
           round_off         = $12,
           total_amount      = $13,
           paid_amount       = $14,
           payment_status    = $15,
           notes             = $16,
           stock_updated     = $17,
           updated_at        = NOW()
       WHERE id = $18`,
      [
        warehouseId, supplierId, grnId || null,
        supplierInvoiceNo || null,
        invoiceDate || new Date(),
        subtotal,
        Number(discountAmount),
        taxableAfterDiscount,
        totalCGST, totalSGST, totalIGST,
        Number(roundOff),
        grandTotal,
        effectivePaid,
        paymentStatus,
        notes || null,
        !grnId,
        id,
      ]
    );

    if (grnId) {
      await client.query(
        `UPDATE grns SET status = 'INVOICED' WHERE id = $1`, [grnId]
      );
    }

    await client.query("COMMIT");

    return res.json({ success: true, message: "Invoice updated successfully" });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updatePurchaseInvoice error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
