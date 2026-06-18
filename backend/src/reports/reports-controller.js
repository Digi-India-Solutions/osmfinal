import pool from '../pool.js';

export const getStockSummary = async (req, res) => {
  try {
    const { warehouseId, categoryId } = req.query;

    const values = [];
    let where = `WHERE i.is_active = true`;

    // ✅ Filter by warehouse
    if (warehouseId) {
      values.push(warehouseId);
      where += ` AND ws.warehouse_id = $${values.length}`;
    }

    // ✅ Filter by category
    if (categoryId) {
      values.push(categoryId);
      where += ` AND i.category_id = $${values.length}`;
    }

    const query = `
      SELECT
        i.id,
        i.code,
        i.name,
        i.category,
        i.unit_name AS unit,

        -- ✅ Current Stock
        COALESCE(ws.quantity, 0) AS "currentStock",

        -- ✅ Total IN quantity
        COALESCE(SUM(
          CASE 
            WHEN sm.movement_type IN ('PURCHASE','RETURN_IN','ADJUSTMENT_IN','TRANSFER_IN')
            THEN sm.quantity ELSE 0 
          END
        ), 0) AS "inQty",

        -- ✅ Total OUT quantity
        COALESCE(SUM(
          CASE 
            WHEN sm.movement_type IN ('SALE','RETURN_OUT','ADJUSTMENT_OUT','TRANSFER_OUT')
            THEN sm.quantity ELSE 0 
          END
        ), 0) AS "outQty",

        -- ✅ Min Level
        i.min_stock_level AS "minLevel",

        -- ✅ Stock Value
        (COALESCE(ws.quantity, 0) * COALESCE(i.purchase_rate, 0)) AS "stockValue",

        -- ✅ Status
        CASE
          WHEN COALESCE(ws.quantity, 0) <= 0 THEN 'CRITICAL'
          WHEN COALESCE(ws.quantity, 0) <= COALESCE(i.min_stock_level, 0) THEN 'LOW'
          ELSE 'NORMAL'
        END AS status

      FROM items i

      LEFT JOIN warehouse_stock ws 
        ON ws.item_id = i.id

      LEFT JOIN stock_movements sm 
        ON sm.item_id = i.id
        ${warehouseId ? `AND sm.warehouse_id = $1` : ''}

      ${where}

      GROUP BY 
        i.id,
        i.code,
        i.name,
        i.category,
        i.unit_name,
        i.min_stock_level,
        i.purchase_rate,
        ws.quantity

      ORDER BY i.name ASC
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows,
    });

  } catch (err) {
    console.error('Stock Summary Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching stock summary',
    });
  }
};


export const getStockLedger = async (req, res) => {
  try {
    const { itemId, warehouseId, fromDate, toDate } = req.query;

    let values = [];
    let where = `WHERE 1=1`;

    if (itemId) {
      values.push(itemId);
      where += ` AND sm.item_id = $${values.length}`;
    }

    if (warehouseId) {
      values.push(warehouseId);
      where += ` AND sm.warehouse_id = $${values.length}`;
    }

    if (fromDate) {
      values.push(fromDate);
      where += ` AND sm.created_at::date >= $${values.length}`;
    }

    if (toDate) {
      values.push(toDate);
      where += ` AND sm.created_at::date <= $${values.length}`;
    }

    const query = `
      SELECT
        sm.id,
        TO_CHAR(sm.created_at, 'DD-MM-YYYY') AS date,
        i.id        AS item_id,
        i.code      AS item_code,
        i.name      AS item_name,
        i.purchase_rate,
        i.sale_rate,
        w.name      AS warehouse,
        sm.movement_type,
        sm.reference_type,
        sm.reference_number,
        sm.notes,

        /* ── Voucher Type ── */
        CASE sm.reference_type
          WHEN 'GRN'              THEN 'GRN'
          WHEN 'ADJUSTMENT'       THEN 'Adjustment'
          WHEN 'SALE_INVOICE'     THEN 'Sale'
          WHEN 'SALE_RETURN'      THEN 'Sale Return'
          WHEN 'PURCHASE_INVOICE' THEN 'Purchase'
          WHEN 'PURCHASE_RETURN'  THEN 'Purchase Return'
          WHEN 'TRANSFER'         THEN 'Transfer'
          WHEN 'DSE'              THEN 'Opening'
          ELSE sm.reference_type
        END AS "voucherType",

        /* ── Voucher Number ── */
        CASE sm.reference_type
          WHEN 'GRN'              THEN sm.notes        -- "GRN GRN-2026-0001" stored in notes
          WHEN 'ADJUSTMENT'       THEN sa.adjustment_number
          WHEN 'PURCHASE_RETURN'  THEN sm.reference_number
          WHEN 'PURCHASE_INVOICE' THEN sm.reference_number
          WHEN 'SALE_INVOICE'     THEN sm.reference_number
          WHEN 'SALE_RETURN'      THEN sm.reference_number
          WHEN 'TRANSFER'         THEN st.transfer_number
          ELSE COALESCE(sm.reference_number, '—')
        END AS "voucherNo",

        /* ── In Qty ── */
        CASE
          WHEN sm.movement_type IN ('PURCHASE_IN','RETURN_IN','ADJUSTMENT_IN','TRANSFER_IN','OPENING')
          THEN sm.quantity ELSE 0
        END AS in_qty,

        /* ── Out Qty ── */
        CASE
          WHEN sm.movement_type IN ('SALE_OUT','RETURN_OUT','ADJUSTMENT_OUT','TRANSFER_OUT')
          THEN sm.quantity ELSE 0
        END AS out_qty,

        /* ── Rate ── */
        CASE
          WHEN sm.movement_type IN ('PURCHASE_IN','RETURN_IN','ADJUSTMENT_IN','TRANSFER_IN','OPENING')
          THEN COALESCE(i.purchase_rate, 0)
          ELSE COALESCE(i.sale_rate, 0)
        END AS rate,

        /* ── Value ── */
        CASE
          WHEN sm.movement_type IN ('PURCHASE_IN','RETURN_IN','ADJUSTMENT_IN','TRANSFER_IN','OPENING')
          THEN sm.quantity * COALESCE(i.purchase_rate, 0)
          ELSE sm.quantity * COALESCE(i.sale_rate, 0)
        END AS value

      FROM stock_movements sm
      JOIN items      i  ON i.id = sm.item_id
      JOIN warehouses w  ON w.id = sm.warehouse_id

      /* Stock Adjustment — reference_id points to stock_adjustments */
      LEFT JOIN stock_adjustments sa
        ON sa.id = sm.reference_id
        AND sm.reference_type = 'ADJUSTMENT'

      /* Stock Transfer — reference_id points to stock_transfers */
      LEFT JOIN stock_transfers st
        ON st.id = sm.reference_id
        AND sm.reference_type = 'TRANSFER'

      ${where}
      ORDER BY sm.created_at ASC
    `;

    const result = await pool.query(query, values);

    let balance = 0;
    const ledger = result.rows.map((row) => {
      balance += Number(row.in_qty || 0) - Number(row.out_qty || 0);
      return {
        id:          row.id,
        date:        row.date,
        voucherType: row.voucherType,
        voucherNo:   row.voucherNo ?? '—',
        source:      row.reference_type ?? '—',
        inQty:       Number(row.in_qty  || 0),
        outQty:      Number(row.out_qty || 0),
        balance,
        rate:        Number(row.rate  || 0),
        value:       Number(row.value || 0),
      };
    });

    res.json({
      success: true,
      data: ledger,
    });

  } catch (err) {
    console.error('Stock Ledger Error:', err);
    res.status(500).json({ message: 'Error fetching stock ledger' });
  }
};

export const getLowStock = async (req, res) => {
  try {
    const { warehouseId } = req.query;

    const values = [];

    let warehouseJoin = `
      LEFT JOIN warehouse_stock ws 
        ON ws.item_id = i.id
    `;

    let warehouseSelect = `'All Warehouses' AS warehouse`;

    // ✅ Handle warehouse filter safely with correct indexing
    if (warehouseId) {
      const idx = values.length + 1;
      values.push(warehouseId);

      warehouseJoin = `
        LEFT JOIN warehouse_stock ws 
          ON ws.item_id = i.id 
         AND ws.warehouse_id = $${idx}
      `;

      warehouseSelect = `
        COALESCE(
          (SELECT name FROM warehouses WHERE id = $${idx}),
          'Unknown Warehouse'
        ) AS warehouse
      `;
    }

    const query = `
      WITH last_purchase AS (
        SELECT DISTINCT ON (pii.item_id)
          pii.item_id,
          pii.rate AS last_purchase_rate,
          TO_CHAR(pi.invoice_date, 'DD-MM-YYYY') AS last_purchase_date
        FROM purchase_invoice_items pii
        JOIN purchase_invoices pi ON pi.id = pii.invoice_id
        ORDER BY pii.item_id, pi.invoice_date DESC
      )

      SELECT
        i.id,
        i.code,
        i.name,
        i.category,
        i.unit_name AS unit,

        ${warehouseSelect},

        COALESCE(ws.quantity, 0) AS "currentStock",
        COALESCE(i.min_stock_level, 0) AS "minLevel",

        GREATEST(
          COALESCE(i.min_stock_level, 0) - COALESCE(ws.quantity, 0),
          0
        ) AS shortage,

        COALESCE(lp.last_purchase_rate, i.purchase_rate, 0) AS "lastPurchaseRate",
        COALESCE(lp.last_purchase_date, '—') AS "lastPurchaseDate"

      FROM items i
      ${warehouseJoin}
      LEFT JOIN last_purchase lp ON lp.item_id = i.id

      WHERE i.is_active = true
        AND COALESCE(ws.quantity, 0) < COALESCE(i.min_stock_level, 0)

      ORDER BY shortage DESC, i.name ASC
    `;

    const result = await pool.query(query, values);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error('Low Stock Error:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock report'
    });
  }
};

export const getPurchaseInvoiceRegister = async (req, res) => {
  try {
    const { from, to, supplierId, warehouseId, paymentStatus } = req.query;
    const values = [];
 
    let where = 'WHERE 1=1';
    if (supplierId)     { values.push(supplierId);     where += ` AND pi.supplier_id     = $${values.length}`; }
    if (warehouseId)    { values.push(warehouseId);    where += ` AND pi.warehouse_id    = $${values.length}`; }
    if (paymentStatus)  { values.push(paymentStatus);  where += ` AND pi.payment_status  = $${values.length}`; }
    if (from && to) {
  values.push(from, to);
  where += ` AND pi.invoice_date BETWEEN $${values.length - 1} AND $${values.length}`;
}

 
    const query = `
      SELECT
        pi.id,
        pi.invoice_number                           AS "invoiceNo",
        pi.supplier_invoice_no                      AS "supplierInvoiceNo",
        TO_CHAR(pi.invoice_date, 'DD-MM-YYYY')      AS date,
        p.name                                      AS supplier,
        p.gstin                                     AS "supplierGstin",
        w.name                                      AS warehouse,
        pi.subtotal,
        pi.discount_amount                          AS "discountAmount",
        pi.taxable_amount                           AS "taxableAmount",
        pi.cgst,
        pi.sgst,
        pi.igst,
        (pi.cgst + pi.sgst + pi.igst)               AS "totalTax",
        pi.round_off                                AS "roundOff",
        pi.total_amount                             AS "totalAmount",
        pi.paid_amount                              AS "paidAmount",
        (pi.total_amount - pi.paid_amount)          AS "balanceDue",
        pi.payment_status                           AS "paymentStatus",
 
        /* item count */
        COUNT(pii.id)                               AS "lineCount",
 
        /* taxable breakup by GST slab */
        COALESCE(SUM(CASE WHEN pii.tax_rate = 0  THEN pii.taxable_amount ELSE 0 END), 0) AS "t0",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 5  THEN pii.taxable_amount ELSE 0 END), 0) AS "t5",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 12 THEN pii.taxable_amount ELSE 0 END), 0) AS "t12",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 18 THEN pii.taxable_amount ELSE 0 END), 0) AS "t18",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 28 THEN pii.taxable_amount ELSE 0 END), 0) AS "t28"
 
      FROM purchase_invoices pi
      JOIN  parties    p   ON p.id  = pi.supplier_id
      JOIN  warehouses w   ON w.id  = pi.warehouse_id
      LEFT JOIN purchase_invoice_items pii ON pii.invoice_id = pi.id
      ${where}
      GROUP BY pi.id, p.name, p.gstin, w.name
      ORDER BY pi.invoice_date DESC
    `;
 
    const result = await pool.query(query, values);
    const rows   = result.rows;
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalInvoices:  rows.length,
        totalTaxable:   rows.reduce((s, r) => s + Number(r.taxableAmount || 0), 0),
        totalCGST:      rows.reduce((s, r) => s + Number(r.cgst          || 0), 0),
        totalSGST:      rows.reduce((s, r) => s + Number(r.sgst          || 0), 0),
        totalIGST:      rows.reduce((s, r) => s + Number(r.igst          || 0), 0),
        totalAmount:    rows.reduce((s, r) => s + Number(r.totalAmount   || 0), 0),
        totalPaid:      rows.reduce((s, r) => s + Number(r.paidAmount    || 0), 0),
        totalDue:       rows.reduce((s, r) => s + Number(r.balanceDue    || 0), 0),
      },
    });
  } catch (err) {
    console.error('Purchase Invoice Register Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching purchase invoice register' });
  }
};
 
export const getGSTPurchaseRegister = async (req, res) => {
  try {
    const { from, to, supplierId, warehouseId } = req.query;
    const values = [];
 
    let where = 'WHERE 1=1';
    if (supplierId)  { values.push(supplierId);  where += ` AND pi.supplier_id  = $${values.length}`; }
    if (warehouseId) { values.push(warehouseId); where += ` AND pi.warehouse_id = $${values.length}`; }
    if (from && to) {
  values.push(from, to);
  where += ` AND pi.invoice_date BETWEEN $${values.length - 1} AND $${values.length}`;
    }
 
    const query = `
      SELECT
        pi.id,
        TO_CHAR(pi.invoice_date, 'DD-MM-YYYY')       AS date,
        pi.invoice_number                            AS "invoiceNo",
        pi.supplier_invoice_no                       AS "supplierInvoiceNo",
        p.name                                       AS supplier,
        p.gstin                                      AS "supplierGstin",
 
        /* taxable by slab */
        COALESCE(SUM(CASE WHEN pii.tax_rate = 0  THEN pii.taxable_amount ELSE 0 END), 0) AS "t0",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 5  THEN pii.taxable_amount ELSE 0 END), 0) AS "t5",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 12 THEN pii.taxable_amount ELSE 0 END), 0) AS "t12",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 18 THEN pii.taxable_amount ELSE 0 END), 0) AS "t18",
        COALESCE(SUM(CASE WHEN pii.tax_rate = 28 THEN pii.taxable_amount ELSE 0 END), 0) AS "t28",
 
        pi.cgst,
        pi.sgst,
        pi.igst,
        pi.total_amount                              AS total
 
      FROM purchase_invoices pi
      JOIN  parties p  ON p.id = pi.supplier_id
      LEFT JOIN purchase_invoice_items pii ON pii.invoice_id = pi.id
      ${where}
      GROUP BY pi.id, p.name, p.gstin
      ORDER BY pi.invoice_date DESC
    `;
 
    const result = await pool.query(query, values);
    const rows   = result.rows;
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalInvoices: rows.length,
        totalTaxable:  rows.reduce((s, r) => s + Number(r.t0||0) + Number(r.t5||0) + Number(r.t12||0) + Number(r.t18||0) + Number(r.t28||0), 0),
        totalCGST:     rows.reduce((s, r) => s + Number(r.cgst  || 0), 0),
        totalSGST:     rows.reduce((s, r) => s + Number(r.sgst  || 0), 0),
        totalIGST:     rows.reduce((s, r) => s + Number(r.igst  || 0), 0),
        grandTotal:    rows.reduce((s, r) => s + Number(r.total || 0), 0),
      },
    });
  } catch (err) {
    console.error('GST Purchase Register Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching GST purchase register' });
  }
};

const dateFilter = (col, from, to, values) => {
  const parts = [];
  if (from) { values.push(from);             parts.push(`${col} >= $${values.length}`); }
  if (to)   { values.push(to);               parts.push(`${col} <= $${values.length}`); }
  return parts.length ? 'AND ' + parts.join(' AND ') : '';
};
 

export const getSalesRegister = async (req, res) => {
  try {
    const { from, to, customerId, warehouseId, paymentStatus } = req.query;
    const values = [];
 
    let where = `WHERE si.is_active = true`;
    if (customerId)   { values.push(customerId);   where += ` AND si.customer_id   = $${values.length}`; }
    if (warehouseId)  { values.push(warehouseId);  where += ` AND si.warehouse_id  = $${values.length}`; }
    if (paymentStatus){ values.push(paymentStatus);where += ` AND si.payment_status = $${values.length}`; }
    where += ' ' + dateFilter('si.invoice_date', from, to, values);
 
    const query = `
      SELECT
        si.id,
        TO_CHAR(si.invoice_date, 'DD-MM-YYYY')          AS date,
        si.invoice_number                                AS "invoiceNo",
        p.name                                           AS customer,
        p.gstin                                          AS "customerGstin",
        si.payment_mode                                  AS "paymentMode",
        si.payment_status                                AS "paymentStatus",
        si.total_amount                                  AS "grandTotal",
        si.paid_amount                                   AS "paidAmount",
        si.balance_due                                   AS "balanceDue",
 
        /* ── aggregated from line items ── */
        COUNT(sii.id)                                    AS "itemCount",
        COALESCE(SUM(sii.taxable_amount), 0)             AS "taxableAmount",
        COALESCE(SUM(sii.cgst), 0)                       AS cgst,
        COALESCE(SUM(sii.sgst), 0)                       AS sgst,
        COALESCE(SUM(sii.igst), 0)                       AS igst,
        COALESCE(SUM(sii.cgst + sii.sgst + sii.igst), 0) AS "totalTax"
 
      FROM sales_invoices si
      JOIN  parties p   ON p.id  = si.customer_id
      LEFT JOIN sales_invoice_items sii ON sii.sales_invoice_id = si.id
 
      ${where}
 
      GROUP BY si.id, p.name, p.gstin
      ORDER BY si.invoice_date DESC
    `;
 
    const result = await pool.query(query, values);
    const rows   = result.rows;
 
    const active = rows.filter(r => r.paymentStatus !== 'CANCELLED');
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalInvoices:  active.length,
        totalTaxable:   active.reduce((s, r) => s + Number(r.taxableAmount || 0), 0),
        totalTax:       active.reduce((s, r) => s + Number(r.totalTax      || 0), 0),
        totalAmount:    active.reduce((s, r) => s + Number(r.grandTotal    || 0), 0),
        totalPaid:      active.reduce((s, r) => s + Number(r.paidAmount    || 0), 0),
        totalDue:       active.reduce((s, r) => s + Number(r.balanceDue    || 0), 0),
        cashSales:      active.filter(r => r.paymentMode === 'CASH')
                              .reduce((s, r) => s + Number(r.grandTotal || 0), 0),
        creditSales:    active.filter(r => r.paymentMode === 'CREDIT')
                              .reduce((s, r) => s + Number(r.grandTotal || 0), 0),
      },
    });
  } catch (err) {
    console.error('Sales Register Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching sales register' });
  }
};
 
export const getGSTSalesRegister = async (req, res) => {
  try {
    const { from, to, customerId, warehouseId } = req.query;
    const values = [];
 
    let where = `WHERE si.is_active = true`;
    if (customerId)  { values.push(customerId);  where += ` AND si.customer_id  = $${values.length}`; }
    if (warehouseId) { values.push(warehouseId); where += ` AND si.warehouse_id = $${values.length}`; }
    where += ' ' + dateFilter('si.invoice_date', from, to, values);
 
    const query = `
      SELECT
        si.id,
        TO_CHAR(si.invoice_date, 'DD-MM-YYYY')    AS date,
        si.invoice_number                          AS "invoiceNo",
        p.name                                     AS customer,
        p.gstin                                    AS "customerGstin",
 
        /* ── taxable amount by GST slab ── */
        COALESCE(SUM(
          CASE WHEN sii.tax_rate = 0  THEN sii.taxable_amount ELSE 0 END
        ), 0)  AS t0,
        COALESCE(SUM(
          CASE WHEN sii.tax_rate = 5  THEN sii.taxable_amount ELSE 0 END
        ), 0)  AS t5,
        COALESCE(SUM(
          CASE WHEN sii.tax_rate = 12 THEN sii.taxable_amount ELSE 0 END
        ), 0)  AS t12,
        COALESCE(SUM(
          CASE WHEN sii.tax_rate = 18 THEN sii.taxable_amount ELSE 0 END
        ), 0)  AS t18,
        COALESCE(SUM(
          CASE WHEN sii.tax_rate = 28 THEN sii.taxable_amount ELSE 0 END
        ), 0)  AS t28,
 
        /* ── tax totals ── */
        COALESCE(SUM(sii.cgst), 0)                AS cgst,
        COALESCE(SUM(sii.sgst), 0)                AS sgst,
        COALESCE(SUM(sii.igst), 0)                AS igst,
 
        /* ── invoice total from header (authoritative) ── */
        si.total_amount                            AS total
 
      FROM sales_invoices si
      JOIN  parties p   ON p.id = si.customer_id
      LEFT JOIN sales_invoice_items sii ON sii.sales_invoice_id = si.id
 
      ${where}
 
      GROUP BY si.id, p.name, p.gstin
      ORDER BY si.invoice_date DESC
    `;
 
    const result = await pool.query(query, values);
    const rows   = result.rows;
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalInvoices: rows.length,
        totalTaxable:  rows.reduce((s, r) =>
          s + Number(r.t0||0) + Number(r.t5||0) + Number(r.t12||0) + Number(r.t18||0) + Number(r.t28||0), 0),
        totalCGST:     rows.reduce((s, r) => s + Number(r.cgst  || 0), 0),
        totalSGST:     rows.reduce((s, r) => s + Number(r.sgst  || 0), 0),
        totalIGST:     rows.reduce((s, r) => s + Number(r.igst  || 0), 0),
        grandTotal:    rows.reduce((s, r) => s + Number(r.total || 0), 0),
      },
    });
  } catch (err) {
    console.error('GST Sales Register Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching GST sales register' });
  }
};
export const getOutstanding = async (req, res) => {
  try {
    const { asOfDate, warehouseId } = req.query;
    const dateLimit = asOfDate || new Date().toISOString().split('T')[0];
    const values = [dateLimit];
    let whereClause = '';
    if (warehouseId) {
      values.push(warehouseId);
      whereClause = ` AND si.warehouse_id = $2`;
    }
 
    // due_date = invoice_date + credit_days (from party)
    // aging    = asOfDate - due_date
    // only UNPAID and PARTIAL invoices with balance_due > 0
    const query = `
      SELECT
        si.id,
        p.name                                                        AS customer,
        si.invoice_number                                             AS "invoiceNo",
        TO_CHAR(si.invoice_date, 'DD-MM-YYYY')                        AS "invoiceDate",
 
        /* due date = invoice_date + party credit_days */
        TO_CHAR(
          si.invoice_date + COALESCE(p.credit_days, 0),
          'DD-MM-YYYY'
        )                                                             AS "dueDate",
 
        si.total_amount                                               AS "invoiceAmount",
        si.paid_amount                                                AS paid,
        si.balance_due                                                AS balance,
 
        /* aging in days from due date to asOfDate */
        GREATEST(
          ($1::date) - (si.invoice_date + COALESCE(p.credit_days, 0)),
          0
        )                                                             AS "agingDays",
 
        /* aging bucket */
        CASE
          WHEN ($1::date) - (si.invoice_date + COALESCE(p.credit_days, 0)) <= 30
            THEN '0-30'
          WHEN ($1::date) - (si.invoice_date + COALESCE(p.credit_days, 0)) <= 60
            THEN '31-60'
          WHEN ($1::date) - (si.invoice_date + COALESCE(p.credit_days, 0)) <= 90
            THEN '61-90'
          ELSE '90+'
        END                                                           AS "agingBucket"
 
      FROM sales_invoices si
      JOIN parties p ON p.id = si.customer_id
 
      WHERE si.is_active = true
        AND si.payment_status IN ('UNPAID', 'PARTIAL')
        AND si.balance_due > 0
        AND si.invoice_date <= $1::date
        ${whereClause}
 
      ORDER BY p.name ASC, "agingDays" DESC
    `;
 
    const result = await pool.query(query, values);
    const rows   = result.rows;
 
    const total    = rows.reduce((s, r) => s + Number(r.balance || 0), 0);
    const bucket30 = rows.filter(r => r.agingBucket === '0-30') .reduce((s, r) => s + Number(r.balance || 0), 0);
    const bucket60 = rows.filter(r => r.agingBucket === '31-60').reduce((s, r) => s + Number(r.balance || 0), 0);
    const bucket90 = rows.filter(r => r.agingBucket === '61-90').reduce((s, r) => s + Number(r.balance || 0), 0);
    const bucket90p= rows.filter(r => r.agingBucket === '90+')  .reduce((s, r) => s + Number(r.balance || 0), 0);
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalOutstanding: total,
        bucket30,
        bucket60,
        bucketOld: bucket90 + bucket90p,
        totalInvoices: rows.length,
      },
    });
  } catch (err) {
    console.error('Outstanding Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching outstanding invoices' });
  }
};
 
// ─────────────────────────────────────────────────────────────
// 2. DAY BOOK
//    GET /api/v1/reports/day-book
//    ?date=YYYY-MM-DD
// ─────────────────────────────────────────────────────────────
export const getDayBook = async (req, res) => {
  try {
    const { date, warehouseId } = req.query;
    const dateVal = date || new Date().toISOString().split('T')[0];
    const rows = [];
 
    // ── Sales Invoices ───────────────────────────────────────
    const siParams = [dateVal];
    let siWhere = '';
    if (warehouseId) {
      siParams.push(warehouseId);
      siWhere = ` AND si.warehouse_id = $2`;
    }
    const siRes = await pool.query(`
      SELECT
        si.id,
        'Sales'                                       AS "group",
        TO_CHAR(si.created_at, 'HH24:MI')            AS time,
        'Sales Invoice'                               AS "voucherType",
        si.invoice_number                             AS "voucherNo",
        p.name                                        AS party,
        COALESCE(si.notes, 'Sales Invoice - ' || p.name) AS narration,
        0                                             AS debit,
        si.total_amount                               AS credit
      FROM sales_invoices si
      JOIN parties p ON p.id = si.customer_id
      WHERE si.invoice_date = $1
        AND si.is_active = true
        ${siWhere}
      ORDER BY si.created_at ASC
    `, siParams);
    rows.push(...siRes.rows);
 
    // ── Sales Payments / Receipts ────────────────────────────
    const spParams = [dateVal];
    let spWhere = '';
    if (warehouseId) {
      spParams.push(warehouseId);
      spWhere = ` AND si.warehouse_id = $2`;
    }
    const spRes = await pool.query(`
      SELECT
        sp.id,
        'Sales'                                       AS "group",
        TO_CHAR(sp.created_at, 'HH24:MI')            AS time,
        'Receipt'                                     AS "voucherType",
        sp.receipt_number                             AS "voucherNo",
        p.name                                        AS party,
        'Payment received - ' || sp.payment_mode      AS narration,
        0                                             AS debit,
        sp.payment_amount                             AS credit
      FROM sales_payments sp
      JOIN sales_invoices si ON si.id = sp.invoice_id
      JOIN parties p ON p.id = si.customer_id
      WHERE sp.payment_date = $1
        AND sp.is_active = true
        ${spWhere}
      ORDER BY sp.created_at ASC
    `, spParams);
    rows.push(...spRes.rows);
 
    // ── Purchase Invoices ────────────────────────────────────
    const piParams = [dateVal];
    let piWhere = '';
    if (warehouseId) {
      piParams.push(warehouseId);
      piWhere = ` AND pi.warehouse_id = $2`;
    }
    const piRes = await pool.query(`
      SELECT
        pi.id,
        'Purchase'                                    AS "group",
        TO_CHAR(pi.created_at, 'HH24:MI')            AS time,
        'Purchase Invoice'                            AS "voucherType",
        pi.invoice_number                             AS "voucherNo",
        p.name                                        AS party,
        COALESCE(pi.notes, 'Purchase - ' || p.name)  AS narration,
        pi.total_amount                               AS debit,
        0                                             AS credit
      FROM purchase_invoices pi
      JOIN parties p ON p.id = pi.supplier_id
      WHERE pi.invoice_date = $1
        ${piWhere}
      ORDER BY pi.created_at ASC
    `, piParams);
    rows.push(...piRes.rows);
 
    // ── Purchase Payments ────────────────────────────────────
    const ppParams = [dateVal];
    let ppJoin = '';
    let ppWhere = '';
    if (warehouseId) {
      ppParams.push(warehouseId);
      ppJoin = ` JOIN purchase_invoices pi ON pi.id = pp.invoice_id`;
      ppWhere = ` AND pi.warehouse_id = $2`;
    }
    const ppRes = await pool.query(`
      SELECT
        pp.id,
        'Purchase'                                    AS "group",
        TO_CHAR(pp.created_at, 'HH24:MI')            AS time,
        'Payment'                                     AS "voucherType",
        pp.voucher_number                             AS "voucherNo",
        p.name                                        AS party,
        'Payment made - ' || pp.payment_mode          AS narration,
        pp.payment_amount                             AS debit,
        0                                             AS credit
      FROM purchase_payments pp
      JOIN parties p ON p.id = pp.supplier_id
      ${ppJoin}
      WHERE pp.date = $1
        ${ppWhere}
      ORDER BY pp.created_at ASC
    `, ppParams);
    rows.push(...ppRes.rows);
 
    // ── Purchase Returns ─────────────────────────────────────
    const prParams = [dateVal];
    let prWhere = '';
    if (warehouseId) {
      prParams.push(warehouseId);
      prWhere = ` AND pr.warehouse_id = $2`;
    }
    const prRes = await pool.query(`
      SELECT
        pr.id,
        'Purchase Return'                             AS "group",
        TO_CHAR(pr.created_at, 'HH24:MI')            AS time,
        'Purchase Return'                             AS "voucherType",
        pr.return_number                              AS "voucherNo",
        p.name                                        AS party,
        COALESCE(pr.reason, 'Purchase Return')        AS narration,
        0                                             AS debit,
        pr.total_amount                               AS credit
      FROM purchase_returns pr
      JOIN parties p ON p.id = pr.supplier_id
      WHERE pr.refund_date = $1
        ${prWhere}
      ORDER BY pr.created_at ASC
    `, prParams);
    rows.push(...prRes.rows);
 
    // ── Sale Returns ─────────────────────────────────────────
    const srParams = [dateVal];
    let srWhere = '';
    if (warehouseId) {
      srParams.push(warehouseId);
      srWhere = ` AND sr.warehouse_id = $2`;
    }
    const srRes = await pool.query(`
      SELECT
        sr.id,
        'Sale Return'                                 AS "group",
        TO_CHAR(sr.created_at, 'HH24:MI')            AS time,
        'Sale Return'                                 AS "voucherType",
        sr.return_number                              AS "voucherNo",
        p.name                                        AS party,
        'Sale Return'                                 AS narration,
        sr.total_amount                               AS debit,
        0                                             AS credit
      FROM sale_returns sr
      JOIN parties p ON p.id = sr.customer_id
      WHERE sr.return_date = $1
        ${srWhere}
      ORDER BY sr.created_at ASC
    `, srParams);
    rows.push(...srRes.rows);
 
    // ── Stock Adjustments ────────────────────────────────────
    const saParams = [dateVal];
    let saWhere = '';
    if (warehouseId) {
      saParams.push(warehouseId);
      saWhere = ` AND sa.warehouse_id = $2`;
    }
    const saRes = await pool.query(`
      SELECT
        sa.id,
        'Adjustment'                                  AS "group",
        TO_CHAR(sa.created_at, 'HH24:MI')            AS time,
        CASE 
          WHEN sa.type = 'INCREASE' THEN 'Adj-In'
          WHEN sa.type = 'DECREASE' THEN 'Adj-Out'
        END
        ,
        sa.adjustment_number                          AS "voucherNo",
        w.name                                        AS party,
        sa.reason                                     AS narration,
        CASE WHEN sa.type = 'DECREASE'
          THEN sa.quantity * COALESCE(i.purchase_rate, 0) ELSE 0 END AS debit,
        CASE WHEN sa.type = 'INCREASE'
          THEN sa.quantity * COALESCE(i.purchase_rate, 0) ELSE 0 END AS credit
      FROM stock_adjustments sa
      JOIN warehouses w ON w.id = sa.warehouse_id
      JOIN items i ON i.id = sa.item_id
      WHERE sa.adjustment_date = $1
        ${saWhere}
      ORDER BY sa.created_at ASC
    `, saParams);
    rows.push(...saRes.rows);
 
    // ── Stock Transfers ──────────────────────────────────────
    const stParams = [dateVal];
    let stWhere = '';
    if (warehouseId) {
      stParams.push(warehouseId);
      stWhere = ` AND (st.from_warehouse_id = $2 OR st.to_warehouse_id = $2)`;
    }
    const stRes = await pool.query(`
      SELECT
        st.id,
        'Transfer'                                    AS "group",
        TO_CHAR(st.created_at, 'HH24:MI')            AS time,
        'Stock Transfer'                              AS "voucherType",
        st.transfer_number                            AS "voucherNo",
        wf.name || ' → ' || wt.name                  AS party,
        COALESCE(st.notes, 'Stock Transfer')          AS narration,
        0                                             AS debit,
        0                                             AS credit
      FROM stock_transfers st
      JOIN warehouses wf ON wf.id = st.from_warehouse_id
      JOIN warehouses wt ON wt.id = st.to_warehouse_id
      WHERE st.transfer_date = $1
        ${stWhere}
      ORDER BY st.created_at ASC
    `, stParams);
    rows.push(...stRes.rows);
 
    // sort everything by time
    rows.sort((a, b) => (a.time > b.time ? 1 : -1));
 
    const totalDebit  = rows.reduce((s, r) => s + Number(r.debit  || 0), 0);
    const totalCredit = rows.reduce((s, r) => s + Number(r.credit || 0), 0);
 
    res.json({
      success: true,
      data: rows,
      summary: {
        totalTransactions: rows.length,
        totalSales:    rows.filter(r => r.group === 'Sales')   .reduce((s, r) => s + Number(r.credit || 0), 0),
        totalPurchase: rows.filter(r => r.group === 'Purchase').reduce((s, r) => s + Number(r.debit  || 0), 0),
        totalDebit,
        totalCredit,
        net: totalCredit - totalDebit,
      },
    });
  } catch (err) {
    console.error('Day Book Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching day book' });
  }
};
 
// ─────────────────────────────────────────────────────────────
// 3. PARTY LEDGER
//    GET /api/v1/reports/party-ledger
//    ?partyId=&from=&to=
// ─────────────────────────────────────────────────────────────
export const getPartyLedger = async (req, res) => {
  try {
    const { partyId, from, to, warehouseId } = req.query;
    if (!partyId) return res.status(400).json({ success: false, message: 'partyId is required' });
 
    // ── fetch party info + opening balance ───────────────────
    const partyRes = await pool.query(
      `SELECT name, type, gstin, opening_balance, credit_days FROM parties WHERE id = $1`,
      [partyId]
    );
    if (!partyRes.rows.length)
      return res.status(404).json({ success: false, message: 'Party not found' });
 
    const party = partyRes.rows[0];
    const isSupplier = party.type === 'SUPPLIER';
 
    const rows = [];
 
    // ── Opening balance row ──────────────────────────────────
    // For customer: opening_balance > 0 = Dr (they owe us)
    // For supplier: opening_balance > 0 = Cr (we owe them)
    const ob = Number(party.opening_balance || 0);
    rows.push({
      id:          'opening',
      date:        from || '',
      voucherType: 'Opening Balance',
      voucherNo:   '—',
      narration:   'Balance brought forward',
      debit:       isSupplier ? 0   : (ob > 0 ? ob : 0),
      credit:      isSupplier ? ob  : (ob < 0 ? Math.abs(ob) : 0),
      balance:     ob,
    });
 
    const txns = [];
 
    if (!isSupplier) {
      // ── CUSTOMER: Sales Invoices (Debit — customer owes us) ─
      const siValues = [partyId];
      let siWhere = '';
      if (warehouseId) {
        siValues.push(warehouseId);
        siWhere = ` AND si.warehouse_id = $2`;
      }
      const siFilter = dateFilter('si.invoice_date', from, to, siValues);
      const siRes = await pool.query(`
        SELECT
          si.id,
          si.invoice_date::date                        AS txn_date,
          TO_CHAR(si.invoice_date, 'DD-MM-YYYY')       AS date,
          'Sales'                                      AS "voucherType",
          si.invoice_number                            AS "voucherNo",
          'Sales Invoice'                              AS narration,
          si.total_amount                              AS debit,
          0                                            AS credit
        FROM sales_invoices si
        WHERE si.customer_id = $1
          AND si.is_active = true
          ${siWhere}
          ${siFilter}
        ORDER BY si.invoice_date ASC
      `, siValues);
      txns.push(...siRes.rows);
 
      // ── CUSTOMER: Receipts (Credit — customer paid us) ──────
      const spValues = [partyId];
      let spWhere = '';
      if (warehouseId) {
        spValues.push(warehouseId);
        spWhere = ` AND si.warehouse_id = $2`;
      }
      const spFilter = dateFilter('sp.payment_date', from, to, spValues);
      const spRes = await pool.query(`
        SELECT
          sp.id,
          sp.payment_date::date                        AS txn_date,
          TO_CHAR(sp.payment_date, 'DD-MM-YYYY')       AS date,
          'Receipt'                                    AS "voucherType",
          sp.receipt_number                            AS "voucherNo",
          'Payment received - ' || sp.payment_mode     AS narration,
          0                                            AS debit,
          sp.payment_amount                            AS credit
        FROM sales_payments sp
        JOIN sales_invoices si ON si.id = sp.invoice_id
        WHERE si.customer_id = $1
          AND sp.is_active = true
          ${spWhere}
          ${spFilter}
        ORDER BY sp.payment_date ASC
      `, spValues);
      txns.push(...spRes.rows);
 
      // ── CUSTOMER: Sale Returns (Credit — we returned goods) ─
      const srValues = [partyId];
      let srWhere = '';
      if (warehouseId) {
        srValues.push(warehouseId);
        srWhere = ` AND sr.warehouse_id = $2`;
      }
      const srFilter = dateFilter('sr.return_date', from, to, srValues);
      const srRes = await pool.query(`
        SELECT
          sr.id,
          sr.return_date::date                         AS txn_date,
          TO_CHAR(sr.return_date, 'DD-MM-YYYY')        AS date,
          'Sales Return'                               AS "voucherType",
          sr.return_number                             AS "voucherNo",
          'Sale Return'                                AS narration,
          0                                            AS debit,
          sr.total_amount                              AS credit
        FROM sale_returns sr
        WHERE sr.customer_id = $1
          ${srWhere}
          ${srFilter}
        ORDER BY sr.return_date ASC
      `, srValues);
      txns.push(...srRes.rows);
 
    } else {
      // ── SUPPLIER: Purchase Invoices (Credit — we owe them) ──
      const piValues = [partyId];
      let piWhere = '';
      if (warehouseId) {
        piValues.push(warehouseId);
        piWhere = ` AND pi.warehouse_id = $2`;
      }
      const piFilter = dateFilter('pi.invoice_date', from, to, piValues);
      const piRes = await pool.query(`
        SELECT
          pi.id,
          pi.invoice_date::date                        AS txn_date,
          TO_CHAR(pi.invoice_date, 'DD-MM-YYYY')       AS date,
          'Purchase'                                   AS "voucherType",
          pi.invoice_number                            AS "voucherNo",
          'Purchase Invoice'                           AS narration,
          0                                            AS debit,
          pi.total_amount                              AS credit
        FROM purchase_invoices pi
        WHERE pi.supplier_id = $1
          ${piWhere}
          ${piFilter}
        ORDER BY pi.invoice_date ASC
      `, piValues);
      txns.push(...piRes.rows);
 
      // ── SUPPLIER: Payments (Debit — we paid them) ───────────
      const ppValues = [partyId];
      let ppJoin = '';
      let ppWhere = '';
      if (warehouseId) {
        ppValues.push(warehouseId);
        ppJoin = ` JOIN purchase_invoices pi ON pi.id = pp.invoice_id`;
        ppWhere = ` AND pi.warehouse_id = $2`;
      }
      const ppFilter = dateFilter('pp.date', from, to, ppValues);
      const ppRes = await pool.query(`
        SELECT
          pp.id,
          pp.date::date                                AS txn_date,
          TO_CHAR(pp.date, 'DD-MM-YYYY')               AS date,
          'Payment'                                    AS "voucherType",
          pp.voucher_number                            AS "voucherNo",
          'Payment made - ' || pp.payment_mode         AS narration,
          pp.payment_amount                            AS debit,
          0                                            AS credit
        FROM purchase_payments pp
        ${ppJoin}
        WHERE pp.supplier_id = $1
          ${ppWhere}
          ${ppFilter}
        ORDER BY pp.date ASC
      `, ppValues);
      txns.push(...ppRes.rows);
 
      // ── SUPPLIER: Purchase Returns (Debit — they owe us back)
      const prValues = [partyId];
      let prWhere = '';
      if (warehouseId) {
        prValues.push(warehouseId);
        prWhere = ` AND pr.warehouse_id = $2`;
      }
      const prFilter = dateFilter('pr.return_date', from, to, prValues);
      const prRes = await pool.query(`
        SELECT
          pr.id,
          pr.return_date::date                         AS txn_date,
          TO_CHAR(pr.return_date, 'DD-MM-YYYY')        AS date,
          'Purchase Return'                            AS "voucherType",
          pr.return_number                             AS "voucherNo",
          COALESCE(pr.reason, 'Purchase Return')       AS narration,
          pr.total_amount                              AS debit,
          0                                            AS credit
        FROM purchase_returns pr
        WHERE pr.supplier_id = $1
          ${prWhere}
          ${prFilter}
        ORDER BY pr.return_date ASC
      `, prValues);
      txns.push(...prRes.rows);
    }
 
    // ── sort by date then build running balance ───────────────
    txns.sort((a, b) => new Date(a.txn_date) - new Date(b.txn_date));
 
    let balance = ob;
    for (const t of txns) {
      balance += Number(t.debit || 0) - Number(t.credit || 0);
      rows.push({ ...t, balance });
    }
 
    const totalDebit  = txns.reduce((s, r) => s + Number(r.debit  || 0), 0);
    const totalCredit = txns.reduce((s, r) => s + Number(r.credit || 0), 0);
    const closing     = balance;
 
    res.json({
      success: true,
      party: {
        name:       party.name,
        type:       party.type,
        gstin:      party.gstin,
        creditDays: party.credit_days,
      },
      data: rows,
      summary: {
        openingBalance: ob,
        totalDebit,
        totalCredit,
        closingBalance: closing,
      },
    });
  } catch (err) {
    console.error('Party Ledger Error:', err);
    res.status(500).json({ success: false, message: 'Error fetching party ledger' });
  }
};