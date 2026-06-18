import { randomUUID } from "node:crypto";
import pool from "../../pool.js";
import { getCompanyId } from "../../../utils/getCompanyId.js";
import { generateDocumentNumber } from "../../../utils/generateDocumentNumber.js";

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const normalizePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 50);
  return { page, limit };
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

const buildSalesReceiptNumber = async (client, companyId) => {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS cnt
     FROM sales_payments
     WHERE company_id = $1
       AND DATE(created_at) = CURRENT_DATE`,
    [companyId]
  );
  const seq = String((rows[0]?.cnt || 0) + 1).padStart(4, "0");
  return `RCT-${datePart}-${seq}`;
};

const getCustomerPurseForUpdate = async (client, company_id, customerId) => {
  const { rows } = await client.query(
    `SELECT id, opening_balance, credit_limit
     FROM parties
     WHERE id = $1 AND company_id = $2
     FOR UPDATE`,
    [customerId, company_id]
  );
  return rows[0] || null;
};

// ✅ AFTER
const calculateInvoiceSummary = (items, isSameState = true) => {
  const normalizedItems = (items || []).map((item) => {
    const qty = toNumber(item.qty, 0);
    const rate = toNumber(item.rate, 0);
    const discount = toNumber(item.discount, 0);
    const taxRate = toNumber(item.taxRate, 0);
    const taxableAmount = qty * rate * (1 - discount / 100);
    const taxAmount = taxableAmount * (taxRate / 100);

    // ✅ Use isSameState to decide CGST/SGST vs IGST
    const cgst = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
    const sgst = isSameState ? Number((taxAmount / 2).toFixed(2)) : 0;
    const igst = isSameState ? 0 : Number(taxAmount.toFixed(2));

    return {
      id: randomUUID(),
      itemId: item.itemId,
      itemCode: item.itemCode || "",
      itemName: item.itemName || "",
      hsnCode: item.hsnCode || "",
      qty,
      unit: item.unit || "Pcs",
      unitId: item.unitId || "",
      rate,
      discount,
      taxableAmount: Number(taxableAmount.toFixed(2)),
      taxRate,
      cgst,
      sgst,
      igst,
      total: Number((taxableAmount + taxAmount).toFixed(2)),
      narration: item.narration || "",
      categoryId: item.categoryId || "",
    };
  });

  const grandTotal = normalizedItems.reduce((sum, item) => sum + item.total, 0);

  return {
    items: normalizedItems,
    grandTotal: Number(grandTotal.toFixed(2)),
    itemCount: normalizedItems.length,
  };
};

const normalizeInvoicePaymentBreakdown = (paymentBreakdown) => {
  if (!paymentBreakdown || typeof paymentBreakdown !== "object") {
    return [];
  }

  return [
    {
      paymentMode: "CASH",
      paymentAmount: toNumber(paymentBreakdown.cash, 0),
    },
    {
      paymentMode: "UPI",
      paymentAmount: toNumber(paymentBreakdown.upi, 0),
    },
    {
      paymentMode: "CARD",
      paymentAmount: toNumber(paymentBreakdown.card, 0),
    },
    {
      paymentMode: "CHEQUE",
      paymentAmount: toNumber(paymentBreakdown.cheque, 0),
      bankName: paymentBreakdown.chequeBankName || null,
      chequeNo: paymentBreakdown.chequeNo || null,
      chequeDate: paymentBreakdown.chequeDate || null,
      chequeBranch: paymentBreakdown.chequeBranch || null,
    },
  ].filter((entry) => entry.paymentAmount > 0);
};


// export const listSalesInvoices = async (req, res) => {
//   const { page, limit } = normalizePagination(req.query);
//   const offset = (page - 1) * limit;

//   try {
//     const company_id = await resolveCompanyId(req.user);
//     if (!company_id) {
//       return res.status(401).json({ success: false, message: "Company context missing in token" });
//     }

//     // Avoid stale browser/proxy cache returning 304 with old empty payloads.
//     res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
//     res.set("Pragma", "no-cache");
//     res.set("Expires", "0");

//     const { rows: countRows } = await pool.query(
//       `SELECT COUNT(*)::int AS total
//        FROM sales_invoices si
//        WHERE si.company_id = $1 AND COALESCE(si.is_active, true) = true`,
//       [company_id]
//     );

//     const { rows } = await pool.query(
//       `SELECT
//          si.id,
//          si.invoice_number,
//          si.invoice_date,
//          si.total_amount,
//          si.paid_amount,
//          si.balance_due,
//          si.payment_status,
//          si.status,
//          si.payment_mode,
//          p.name AS party_name,
//          w.name AS warehouse_name,
//          COALESCE(i.item_count, 0) AS item_count
//        FROM sales_invoices si
//        LEFT JOIN parties p ON p.id = si.customer_id
//        LEFT JOIN warehouses w ON w.id = si.warehouse_id
//        LEFT JOIN (
//          SELECT sales_invoice_id, COUNT(*)::int AS item_count
//          FROM sales_invoice_items
//          GROUP BY sales_invoice_id
//        ) i ON i.sales_invoice_id = si.id
//         WHERE COALESCE(si.is_active, true) = true
//        ORDER BY si.created_at DESC
//        LIMIT $2 OFFSET $3`,
//       [company_id, limit, offset]
//     );

//     return res.status(200).json({
//       success: true,
//       data: {
//         items: rows.map((row) => ({
//           id: row.id,
//           invoiceNo: row.invoice_number,
//           date: row.invoice_date,
//           partyName: row.party_name || "",
//           warehouseName: row.warehouse_name || "",
//           itemCount: row.item_count,
//           grandTotal: Number(row.total_amount || 0),
//           status: row.status || "SAVED",
//           paymentMode: row.payment_mode || "CREDIT",
//           paymentStatus: row.payment_status || "UNPAID",
//           paidAmount: Number(row.paid_amount || 0),
//           balanceDue: Number(row.balance_due || 0),
//         })),
//         total: countRows[0]?.total || 0,
//         page,
//         limit,
//       },
//     });
//   } catch (error) {
//     console.error("listSalesInvoices error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

export const getSalesInvoiceById = async (req, res) => {
  const { company_id } = req.user;
  const { id } = req.params;

  try {
    const { rows: headerRows } = await pool.query(
      `SELECT
            si.*,
            p.name AS party_name,
            p.gstin AS customer_gstin,
            w.name AS warehouse_name
        FROM sales_invoices si
        LEFT JOIN parties p ON p.id = si.customer_id
        LEFT JOIN warehouses w ON w.id = si.warehouse_id
        WHERE si.id = $1 AND si.company_id = $2 AND si.is_active = true`,
      [id, company_id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ success: false, message: "Sales invoice not found" });
    }

    const { rows: itemRows } = await pool.query(
      `SELECT
            sii.*,
            i.name AS item_name,
            i.code AS item_code
        FROM sales_invoice_items sii
        LEFT JOIN items i ON i.id = sii.item_id
        WHERE sii.sales_invoice_id = $1
        ORDER BY sii.created_at ASC`,
      [id]
    );

    const header = headerRows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: header.id,
        invoiceNo: header.invoice_number,
        date: header.invoice_date,
        partyName: header.party_name || "",
        warehouseName: header.warehouse_name || "",
        itemCount: itemRows.length,
        grandTotal: Number(header.total_amount || 0),
        status: header.status || "SAVED",
        paymentMode: header.payment_mode || "CREDIT",
        customerId: header.customer_id,
        customerGstin: header.customer_gstin || "",
        billingAddress: header.billing_address || "",
        shippingAddress: header.shipping_address || "",
        paidAmount: Number(header.paid_amount || 0),
        balanceDue: Number(header.balance_due || 0),
        items: itemRows.map((item) => ({
          id: item.id,
          itemId: item.item_id,
          itemCode: item.item_code || "",
          itemName: item.item_name || "",
          hsnCode: item.hsn_code || "",
          qty: Number(item.quantity || 0),
          unit: item.unit || "Pcs",
          unitId: item.unit_id || "",
          rate: Number(item.rate || 0),
          discount: Number(item.discount || 0),
          taxableAmount: Number(item.taxable_amount || 0),
          taxRate: Number(item.tax_rate || 0),
          cgst: Number(item.cgst || 0),
          sgst: Number(item.sgst || 0),
          igst: Number(item.igst || 0),
          total: Number(item.total || 0),
          narration: item.narration || "",
          categoryId: item.category_id || "",
        })),
      },
    });
  } catch (error) {
    console.error("getSalesInvoiceById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSalesInvoicePaymentHistory = async (req, res) => {
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Company context missing in token" });
    }

    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT
         sp.id,
         sp.payment_date,
         sp.payment_amount,
         sp.payment_mode,
         sp.cheque_status,
         si.payment_status AS invoice_payment_status
       FROM sales_payments sp
       LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
       WHERE sp.invoice_id = $1
         AND sp.company_id = $2
       ORDER BY sp.created_at ASC`,
      [id, company_id]
    );

    return res.status(200).json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        paymentDate: row.payment_date,
        paymentMode: row.payment_mode,
        amount: Number(row.payment_amount || 0),
        paymentStatus: row.cheque_status || row.invoice_payment_status || "PAID",
      })),
    });
  } catch (error) {
    console.error("getSalesInvoicePaymentHistory error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const listSalesInvoices = async (req, res) => {
  const { page, limit } = normalizePagination(req.query);
  const offset = (page - 1) * limit;

  const { search, paymentType, status, warehouseId } = req.query;

  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Company context missing in token" });
    }

    let conditions = [`si.company_id = $1`, `COALESCE(si.is_active, true) = true`];
    let values = [company_id];

    if (search?.trim()) {
      values.push(`%${search.trim()}%`);
      conditions.push(`(LOWER(p.name) LIKE LOWER($${values.length}) OR LOWER(si.invoice_number) LIKE LOWER($${values.length}))`);
    }

    if (paymentType && paymentType !== "ALL") {
      values.push(paymentType);
      conditions.push(`si.payment_status = $${values.length}`);
    }

    if (status && status !== "ALL") {
      values.push(status);
      conditions.push(`si.status = $${values.length}`);
    }

    // ✅ Push value FIRST, then reference values.length in the placeholder
    if (warehouseId && warehouseId !== "ALL") {
      values.push(warehouseId);
      conditions.push(`si.warehouse_id = $${values.length}`);
    }

    const whereClause = conditions.join(" AND ");

    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM sales_invoices si
      LEFT JOIN parties p ON p.id = si.customer_id
      WHERE ${whereClause}
    `;
    const { rows: countRows } = await pool.query(countQuery, values);

    // ✅ Push limit/offset AFTER all filter values, use values.length for placeholders
    values.push(limit);
    const limitIdx = values.length;
    values.push(offset);
    const offsetIdx = values.length;

    const dataQuery = `
      SELECT
        si.id, si.invoice_number, si.invoice_date, si.total_amount,
        si.paid_amount, si.balance_due, si.payment_status, si.status,
        si.payment_mode, p.name AS party_name, w.name AS warehouse_name,
        COALESCE(i.item_count, 0) AS item_count
      FROM sales_invoices si
      LEFT JOIN parties p ON p.id = si.customer_id
      LEFT JOIN warehouses w ON w.id = si.warehouse_id
      LEFT JOIN (
        SELECT sales_invoice_id, COUNT(*)::int AS item_count
        FROM sales_invoice_items
        GROUP BY sales_invoice_id
      ) i ON i.sales_invoice_id = si.id
      WHERE ${whereClause}
      ORDER BY si.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const { rows } = await pool.query(dataQuery, values);

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          invoiceNo: row.invoice_number,
          date: row.invoice_date,
          partyName: row.party_name || "",
          warehouseName: row.warehouse_name || "",
          itemCount: row.item_count,
          grandTotal: Number(row.total_amount || 0),
          status: row.status || "SAVED",
          paymentMode: row.payment_mode || "CREDIT",
          paymentStatus: row.payment_status || "UNPAID",
          paidAmount: Number(row.paid_amount || 0),
          balanceDue: Number(row.balance_due || 0),
        })),
        total: countRows[0]?.total || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("listSalesInvoices error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};



export const createSalesInvoice = async (req, res) => {
  const { id: userId } = req.user;
  const {
    customerId,
    warehouseId,
    date,
    billingAddress,
    shippingAddress,
    paymentMode,
    amountReceived,
    useCustomerCredit,
    paymentBreakdown,
    notes,
    items,
    isSameState
  } = req.body;

  if (!customerId || !warehouseId || !date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "customerId, warehouseId, date and items are required",
    });
  }

  const client = await pool.connect();
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Company context missing in token" });
    }

    await client.query("BEGIN");

    const summary = calculateInvoiceSummary(items, isSameState);
    const invoiceId = randomUUID();
    const invoiceNo = await generateDocumentNumber({
      client,
      company_id,
      doc_type: "SALES_INVOICE",
    });
    const received = toNumber(amountReceived, 0);
    const breakdownEntries = normalizeInvoicePaymentBreakdown(paymentBreakdown);
    const directPaidAmountFromBreakdown = breakdownEntries.reduce((sum, entry) => sum + toNumber(entry.paymentAmount, 0), 0);
    const directPaidAmount = breakdownEntries.length > 0
      ? Math.min(directPaidAmountFromBreakdown, summary.grandTotal)
      : Math.min(received, summary.grandTotal);
    const remainingAfterDirect = Math.max(summary.grandTotal - directPaidAmount, 0);

    const customerParty = await getCustomerPurseForUpdate(client, company_id, customerId);
    if (!customerParty) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    const currentPurse = toNumber(customerParty.opening_balance, 0);
    const creditLimit = Math.max(0, toNumber(customerParty.credit_limit, 0));
    const usableCreditAmount = Math.max(0, currentPurse);
    const shouldApplyCustomerCredit = Boolean(useCustomerCredit);
    const autoCreditAppliedAmount = shouldApplyCustomerCredit
      ? Math.min(usableCreditAmount, remainingAfterDirect)
      : 0;
    const paidAmount = Number((directPaidAmount + autoCreditAppliedAmount).toFixed(2));
    const balanceDue = Number(Math.max(summary.grandTotal - paidAmount, 0).toFixed(2));
    const paymentStatus = paidAmount >= summary.grandTotal ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
    const nextPurse = Number((currentPurse - remainingAfterDirect).toFixed(2));
    const minAllowed = -creditLimit;

    const primaryPaymentMode = breakdownEntries[0]?.paymentMode || (autoCreditAppliedAmount > 0 ? "CREDIT" : paymentMode || "CREDIT");

    if (nextPurse < minAllowed) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Customer credit limit exceeded. Available credit: ${Math.max(0, currentPurse + creditLimit).toFixed(2)}`,
      });
    }

    await client.query(
      `INSERT INTO sales_invoices
        (id, company_id, customer_id, warehouse_id, invoice_number, invoice_date,
         billing_address, shipping_address, payment_mode, amount_received,
         total_amount, paid_amount, balance_due, payment_status, status, notes, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'SAVED',$15,$16   )`,
      [
        invoiceId,
        company_id,
        customerId,
        warehouseId,
        invoiceNo,
        date,
        billingAddress || "",
        shippingAddress || "",
        primaryPaymentMode,
        breakdownEntries.length > 0 ? directPaidAmount : received,
        summary.grandTotal,
        paidAmount,
        balanceDue,
        paymentStatus,
        notes || "",
        userId,
      ]
    );

    for (const item of summary.items) {
      await client.query(
        `INSERT INTO sales_invoice_items
          (id, sales_invoice_id, item_id, quantity, unit, unit_id, rate, discount,
           taxable_amount, tax_rate, cgst, sgst, igst, total, hsn_code, narration, category_id)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          item.id,
          invoiceId,
          item.itemId,
          item.qty,
          item.unit,
          item.unitId || null,
          item.rate,
          item.discount,
          item.taxableAmount,
          item.taxRate,
          item.cgst,
          item.sgst,
          item.igst,
          item.total,
          item.hsnCode,
          item.narration || null,
          item.categoryId || null,
        ]
      );

      const stockUpdate = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1,
             updated_at = NOW()
         WHERE warehouse_id = $2
           AND item_id = $3
           AND company_id = $4`,
        [item.qty, warehouseId, item.itemId, company_id]
      );

      if (stockUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock
             (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), company_id, warehouseId, item.itemId, -item.qty]
        );
      }

      await client.query(
        `INSERT INTO stock_movements
           (id, company_id, warehouse_id, item_id, movement_type, quantity,
            reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'SALE_OUT',$5,'SALE_INVOICE',$6,$7)`,
        [
          randomUUID(),
          company_id,
          warehouseId,
          item.itemId,
          item.qty,
          invoiceId,
          userId,
        ]
      );
    }

    const receiptNotes = notes || null;

    // Record each direct receipt at invoice-save time so payment history shows the real breakdown.
    if (breakdownEntries.length > 0) {
      for (const entry of breakdownEntries) {
        const receiptNumber = await buildSalesReceiptNumber(client, company_id);
        await client.query(
          `INSERT INTO sales_payments
            (id, company_id, invoice_id, receipt_number, payment_date, payment_amount, payment_mode,
             reference_no, card_last_four, bank_name, cheque_no, cheque_date, cheque_status, bounce_reason,
             notes, created_by)
           VALUES
            ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)`,
          [
            randomUUID(),
            company_id,
            invoiceId,
            receiptNumber,
            date,
            entry.paymentAmount,
            entry.paymentMode,
            null,
            null,
            entry.bankName || null,
            entry.chequeNo || null,
            entry.chequeDate || null,
            entry.paymentMode === "CHEQUE" ? "PENDING" : null,
            null,
            receiptNotes,
            userId,
          ]
        );
      }
    } else if (directPaidAmount > 0) {
      const receiptNumber = await buildSalesReceiptNumber(client, company_id);
      const normalizedMode = String(paymentMode || "CASH").toUpperCase();
      const receiptMode = normalizedMode === "CREDIT" ? "CASH" : normalizedMode;

      await client.query(
        `INSERT INTO sales_payments
          (id, company_id, invoice_id, receipt_number, payment_date, payment_amount, payment_mode, notes, created_by)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          company_id,
          invoiceId,
          receiptNumber,
          date,
          directPaidAmount,
          receiptMode,
          receiptNotes,
          userId,
        ]
      );
    }

    // Record customer credit utilization so it is visible in payment history.
    if (autoCreditAppliedAmount > 0) {
      const receiptNumber = await buildSalesReceiptNumber(client, company_id);
      const creditNote = notes
        ? `${notes} | Settled using customer available balance`
        : "Settled using customer available balance";

      await client.query(
        `INSERT INTO sales_payments
          (id, company_id, invoice_id, receipt_number, payment_date, payment_amount, payment_mode, notes, created_by)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(),
          company_id,
          invoiceId,
          receiptNumber,
          date,
          autoCreditAppliedAmount,
          "CREDIT_AMOUNT",
          creditNote,
          userId,
        ]
      );
    }

    await client.query(
      `UPDATE parties
       SET opening_balance = $1
       WHERE id = $2 AND company_id = $3`,
      [nextPurse, customerId, company_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        id: invoiceId,
        invoiceNo,
        date,
        partyName: req.body.partyName || "",
        warehouseName: req.body.warehouseName || "",
        itemCount: summary.itemCount,
        grandTotal: summary.grandTotal,
        status: "SAVED",
        paymentMode: paymentMode || "CREDIT",
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("createSalesInvoice error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};


export const updateSalesInvoice = async (req, res) => {
  const { id: userId } = req.user;
  const { invoiceId } = req.params;

  const {
    customerId,
    warehouseId,
    date,
    billingAddress,
    shippingAddress,
    paymentMode,
    amountReceived,
    useCustomerCredit,
    notes,
    items,
    isSameState
  } = req.body;

  // ── Validation ─────────────────────────────────────────────────────────────
  if (!customerId || !warehouseId || !date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "customerId, warehouseId, date and items are required",
    });
  }

  const client = await pool.connect();
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Company context missing in token" });
    }

    await client.query("BEGIN");

    // ── 1. Load existing invoice ────────────────────────────────────────────
    const { rows: invoiceRows } = await client.query(
      `SELECT * FROM sales_invoices
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [invoiceId, company_id]
    );

    if (invoiceRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const existingInvoice = invoiceRows[0];

    // Prevent editing a cancelled invoice
    if (existingInvoice.status === "CANCELLED") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Cannot edit a cancelled invoice" });
    }

    // ── 2. Load old invoice items ───────────────────────────────────────────
    const { rows: oldItems } = await client.query(
      `SELECT item_id, quantity FROM sales_invoice_items WHERE sales_invoice_id = $1`,
      [invoiceId]
    );

    // ── 3. Reverse old stock movements ─────────────────────────────────────
    for (const old of oldItems) {
      // Add the stock back that was deducted on create
      const stockReverse = await client.query(
        `UPDATE warehouse_stock
         SET quantity   = quantity + $1,
             updated_at = NOW()
         WHERE warehouse_id = $2
           AND item_id      = $3
           AND company_id   = $4`,
        [old.quantity, existingInvoice.warehouse_id, old.item_id, company_id]
      );

      if (stockReverse.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), company_id, existingInvoice.warehouse_id, old.item_id, old.quantity]
        );
      }

      // Record reversal movement
      await client.query(
        `INSERT INTO stock_movements
           (id, company_id, warehouse_id, item_id, movement_type, quantity,
            reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'SALE_RETURN_IN',$5,'SALE_INVOICE_UPDATE',$6,$7)`,
        [randomUUID(), company_id, existingInvoice.warehouse_id, old.item_id, old.quantity, invoiceId, userId]
      );
    }

    // ── 4. Reverse old payments linked to this invoice ──────────────────────
    //    Load what was already paid (CASH/UPI/etc) and credit-amount payments
    const { rows: oldPayments } = await client.query(
      `SELECT id, payment_amount, payment_mode
       FROM sales_payments
       WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, company_id]
    );

    const oldDirectPaid = oldPayments
      .filter(p => p.payment_mode !== "CREDIT_AMOUNT")
      .reduce((sum, p) => sum + toNumber(p.payment_amount, 0), 0);

    const oldCreditUsed = oldPayments
      .filter(p => p.payment_mode === "CREDIT_AMOUNT")
      .reduce((sum, p) => sum + toNumber(p.payment_amount, 0), 0);

    // Delete old payment records — they will be recreated fresh below
    await client.query(
      `DELETE FROM sales_payments WHERE invoice_id = $1 AND company_id = $2`,
      [invoiceId, company_id]
    );

    // ── 5. Restore customer purse (undo what was applied on create) ─────────
    const customerParty = await getCustomerPurseForUpdate(client, company_id, customerId);
    if (!customerParty) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Customer not found" });
    }

    // Restore: add back credit that was consumed + add back direct paid amount
    const restoredPurse = toNumber(customerParty.opening_balance, 0) + oldCreditUsed;

    await client.query(
      `UPDATE parties
       SET opening_balance = $1
       WHERE id = $2 AND company_id = $3`,
      [restoredPurse, customerId, company_id]
    );

    // ── 6. Delete old invoice items ─────────────────────────────────────────
    await client.query(
      `DELETE FROM sales_invoice_items WHERE sales_invoice_id = $1`,
      [invoiceId]
    );

    // ── 7. Recalculate with new items ───────────────────────────────────────
    const summary = calculateInvoiceSummary(items, isSameState);
    const received = toNumber(amountReceived, 0);
    const directPaidAmount = Math.min(received, summary.grandTotal);
    const remainingAfterDirect = Math.max(summary.grandTotal - directPaidAmount, 0);

    const currentPurse = restoredPurse;
    const creditLimit = Math.max(0, toNumber(customerParty.credit_limit, 0));
    const usableCreditAmount = Math.max(0, currentPurse);
    const shouldApplyCredit = Boolean(useCustomerCredit);
    const autoCreditApplied = shouldApplyCredit
      ? Math.min(usableCreditAmount, remainingAfterDirect)
      : 0;

    const paidAmount = Number((directPaidAmount + autoCreditApplied).toFixed(2));
    const balanceDue = Number(Math.max(summary.grandTotal - paidAmount, 0).toFixed(2));
    const paymentStatus = paidAmount >= summary.grandTotal ? "PAID" : paidAmount > 0 ? "PARTIAL" : "UNPAID";
    const nextPurse = Number((currentPurse - autoCreditApplied).toFixed(2));
    const minAllowed = -creditLimit;

    if (nextPurse < minAllowed) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Customer credit limit exceeded. Available credit: ${Math.max(0, currentPurse + creditLimit).toFixed(2)}`,
      });
    }

    // ── 8. Update invoice header ────────────────────────────────────────────
    await client.query(
      `UPDATE sales_invoices SET
         customer_id      = $1,
         warehouse_id     = $2,
         invoice_date     = $3,
         billing_address  = $4,
         shipping_address = $5,
         payment_mode     = $6,
         amount_received  = $7,
         total_amount     = $8,
         paid_amount      = $9,
         balance_due      = $10,
         payment_status   = $11,
         notes            = $12,
         updated_at       = NOW()
       WHERE id = $13 AND company_id = $14`,
      [
        customerId,
        warehouseId,
        date,
        billingAddress || "",
        shippingAddress || "",
        paymentMode || "CREDIT",
        received,
        summary.grandTotal,
        paidAmount,
        balanceDue,
        paymentStatus,
        notes || "",
        invoiceId,
        company_id,
      ]
    );

    // ── 9. Insert new invoice items + deduct stock ──────────────────────────
    for (const item of summary.items) {
      await client.query(
        `INSERT INTO sales_invoice_items
          (id, sales_invoice_id, item_id, quantity, unit, unit_id, rate, discount,
           taxable_amount, tax_rate, cgst, sgst, igst, total, hsn_code, narration, category_id)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [
          item.id || randomUUID(),
          invoiceId,
          item.itemId,
          item.qty,
          item.unit,
          item.unitId || null,
          item.rate,
          item.discount,
          item.taxableAmount,
          item.taxRate,
          item.cgst,
          item.sgst,
          item.igst,
          item.total,
          item.hsnCode,
          item.narration || null,
          item.categoryId || null,
        ]
      );

      // Deduct new stock
      const stockUpdate = await client.query(
        `UPDATE warehouse_stock
         SET quantity   = quantity - $1,
             updated_at = NOW()
         WHERE warehouse_id = $2
           AND item_id      = $3
           AND company_id   = $4`,
        [item.qty, warehouseId, item.itemId, company_id]
      );

      if (stockUpdate.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), company_id, warehouseId, item.itemId, -item.qty]
        );
      }

      // Stock movement for new deduction
      await client.query(
        `INSERT INTO stock_movements
           (id, company_id, warehouse_id, item_id, movement_type, quantity,
            reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'SALE_OUT',$5,'SALE_INVOICE',$6,$7)`,
        [randomUUID(), company_id, warehouseId, item.itemId, item.qty, invoiceId, userId]
      );
    }

    // ── 10. Re-create payment records ───────────────────────────────────────
    if (directPaidAmount > 0) {
      const receiptNumber = await buildSalesReceiptNumber(client, company_id);
      const normalizedMode = String(paymentMode || "CASH").toUpperCase();
      const receiptMode = normalizedMode === "CREDIT" ? "CASH" : normalizedMode;

      await client.query(
        `INSERT INTO sales_payments
          (id, company_id, invoice_id, receipt_number, payment_date,
           payment_amount, payment_mode, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(), company_id, invoiceId,
          receiptNumber, date,
          directPaidAmount, receiptMode,
          notes || null, userId,
        ]
      );
    }

    if (autoCreditApplied > 0) {
      const receiptNumber = await buildSalesReceiptNumber(client, company_id);
      const creditNote = notes
        ? `${notes} | Settled using customer available balance`
        : "Settled using customer available balance";

      await client.query(
        `INSERT INTO sales_payments
          (id, company_id, invoice_id, receipt_number, payment_date,
           payment_amount, payment_mode, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          randomUUID(), company_id, invoiceId,
          receiptNumber, date,
          autoCreditApplied, "CREDIT_AMOUNT",
          creditNote, userId,
        ]
      );
    }

    // ── 11. Apply new purse balance ─────────────────────────────────────────
    await client.query(
      `UPDATE parties
       SET opening_balance = $1
       WHERE id = $2 AND company_id = $3`,
      [nextPurse, customerId, company_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Invoice updated successfully",
      data: {
        id: invoiceId,
        invoiceNo: existingInvoice.invoice_number,
        date,
        partyName: req.body.partyName || "",
        warehouseName: req.body.warehouseName || "",
        itemCount: summary.itemCount,
        grandTotal: summary.grandTotal,
        status: existingInvoice.status,
        paymentMode: paymentMode || "CREDIT",
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updateSalesInvoice error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    client.release();
  }
};

export const deleteSalesInvoice = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  console.log("SSSS==>", id)
  const client = await pool.connect();
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Company context missing in token" });
    }

    await client.query("BEGIN");

    // ── 1. Load & lock invoice ──────────────────────────────────────────────
    const { rows: invoiceRows } = await client.query(
      `SELECT * FROM sales_invoices
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [id, company_id]
    );

    if (invoiceRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice = invoiceRows[0];

    // Prevent deleting an already cancelled invoice
    if (invoice.status === "CANCELLED") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Invoice is already cancelled" });
    }

    // ── 2. Load invoice items ───────────────────────────────────────────────
    const { rows: invoiceItems } = await client.query(
      `SELECT item_id, quantity FROM sales_invoice_items WHERE sales_invoice_id = $1`,
      [id]
    );

    // ── 3. Reverse stock for each item ─────────────────────────────────────
    for (const item of invoiceItems) {
      // Add stock back
      const stockReverse = await client.query(
        `UPDATE warehouse_stock
         SET quantity   = quantity + $1,
             updated_at = NOW()
         WHERE warehouse_id = $2
           AND item_id      = $3
           AND company_id   = $4`,
        [item.quantity, invoice.warehouse_id, item.item_id, company_id]
      );

      if (stockReverse.rowCount === 0) {
        await client.query(
          `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4,$5)`,
          [randomUUID(), company_id, invoice.warehouse_id, item.item_id, item.quantity]
        );
      }

      // Record reversal movement
      await client.query(
        `INSERT INTO stock_movements
           (id, company_id, warehouse_id, item_id, movement_type, quantity,
            reference_type, reference_id, created_by)
         VALUES ($1,$2,$3,$4,'SALE_RETURN_IN',$5,'SALE_INVOICE_DELETE',$6,$7)`,
        [
          randomUUID(),
          company_id,
          invoice.warehouse_id,
          item.item_id,
          item.quantity,
          id,
          userId,
        ]
      );
    }

    // ── 4. Calculate credit to restore ─────────────────────────────────────
    const { rows: oldPayments } = await client.query(
      `SELECT payment_amount, payment_mode
       FROM sales_payments
       WHERE invoice_id = $1 AND company_id = $2`,
      [id, company_id]
    );

    const creditUsed = oldPayments
      .filter(p => p.payment_mode === "CREDIT_AMOUNT")
      .reduce((sum, p) => sum + toNumber(p.payment_amount, 0), 0);

    // ── 5. Restore customer purse ───────────────────────────────────────────
    if (creditUsed > 0) {
      await client.query(
        `UPDATE parties
         SET opening_balance = opening_balance + $1
         WHERE id = $2 AND company_id = $3`,
        [creditUsed, invoice.customer_id, company_id]
      );
    }

    // ── 6. Delete payments ──────────────────────────────────────────────────
    await client.query(
      `DELETE FROM sales_payments WHERE invoice_id = $1 AND company_id = $2`,
      [id, company_id]
    );

    // ── 7. Delete invoice items ─────────────────────────────────────────────
    await client.query(
      `DELETE FROM sales_invoice_items WHERE sales_invoice_id = $1`,
      [id]
    );

    // ── 8. Delete invoice ───────────────────────────────────────────────────
    await client.query(
      `DELETE FROM sales_invoices WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: "Invoice deleted successfully",
      data: {
        id: id,
        invoiceNo: invoice.invoice_number,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("deleteSalesInvoice error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  } finally {
    client.release();
  }
};
export const getSalesInvoicePrintData = async (req, res) => {
  return getSalesInvoiceById(req, res);
};
