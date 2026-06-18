import { randomUUID } from "node:crypto";
import pool from "../../pool.js";

const normalizePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 100);
  return { page, limit };
};

const isChequeBounceStatus = (status) => status === "BOUNCED" || status === "INSUFFICIENT_BALANCE";

const buildReceiptNumber = async (client, companyId) => {
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

const recalcInvoicePayment = (totalAmount, paidAmount) => {
  const total = Number(totalAmount || 0);
  const paid = Math.max(0, Number(paidAmount || 0));
  const balance = Math.max(total - paid, 0);
  const status = balance <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID";
  return {
    paidAmount: Number(paid.toFixed(2)),
    balanceDue: Number(balance.toFixed(2)),
    paymentStatus: status,
  };
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

const applyCustomerPurseDelta = async (client, company_id, customerId, delta, enforceCreditLimit = false) => {
  const party = await getCustomerPurseForUpdate(client, company_id, customerId);
  if (!party) {
    throw new Error("Customer not found for purse update");
  }

  const current = Number(party.opening_balance || 0);
  const limit = Math.max(0, Number(party.credit_limit || 0));
  const next = Number((current + Number(delta || 0)).toFixed(2));

  if (enforceCreditLimit && next < -limit) {
    throw new Error("Customer credit limit exceeded");
  }

  await client.query(
    `UPDATE parties
     SET opening_balance = $1
     WHERE id = $2 AND company_id = $3`,
    [next, customerId, company_id]
  );

  return next;
};

export const listSalesReturnSettlements = async (req, res) => {
  try {
    const company_id = await resolveCompanyId(req.user);

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - company missing",
      });
    }

    const { page, limit } = normalizePagination(req.query);
    const offset = (page - 1) * limit;

    const search = (req.query.search || "").trim();
    const fromDate = req.query.fromDate || null;
    const toDate = req.query.toDate || null;

    const params = [company_id];
    const where = ["settlement.company_id = $1"];

    if (fromDate) {
      params.push(fromDate);
      where.push(`settlement.date >= $${params.length}`);
    }

    if (toDate) {
      params.push(toDate);
      where.push(`settlement.date <= $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(
        LOWER(COALESCE(settlement.number, '')) LIKE $${params.length}
        OR LOWER(COALESCE(settlement.linked_doc, '')) LIKE $${params.length}
        OR LOWER(COALESCE(settlement.customer_name, '')) LIKE $${params.length}
      )`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM (
         SELECT
           rg.id,
           rg.company_id,
           rg.created_at::date AS date,
           rg.refund_number AS number,
           sr.return_number AS linked_doc,
           p.name AS customer_name,
           rg.amount,
           rg.payment_mode,
           NULL::text AS reference_no,
           rg.created_at
         FROM refunds_given rg
         LEFT JOIN sale_returns sr ON sr.id = rg.sale_return_id
         LEFT JOIN parties p ON p.id = rg.customer_id
         UNION ALL
         SELECT
           cc.id,
           cc.company_id,
           COALESCE(sr.return_date, cc.created_at::date) AS date,
           CONCAT('CRD-', COALESCE(sr.return_number, cc.id::text)) AS number,
           COALESCE(sr.return_number, '') AS linked_doc,
           p.name AS customer_name,
           cc.amount,
           'CREDIT' AS payment_mode,
           NULL::text AS reference_no,
           cc.created_at
         FROM customer_credits cc
         LEFT JOIN sale_returns sr ON sr.id = cc.sale_return_id
         LEFT JOIN parties p ON p.id = cc.customer_id
       ) settlement
       ${whereSql}`,
      params
    );

    const { rows } = await pool.query(
      `SELECT *
       FROM (
         SELECT
           rg.id,
           rg.company_id,
           rg.created_at::date AS date,
           rg.refund_number AS number,
           sr.return_number AS linked_doc,
           p.name AS customer_name,
           rg.amount,
           rg.payment_mode,
           NULL::text AS reference_no,
           NULL::text AS notes,
           rg.created_at,
           'REFUND' AS tx_type
         FROM refunds_given rg
         LEFT JOIN sale_returns sr ON sr.id = rg.sale_return_id
         LEFT JOIN parties p ON p.id = rg.customer_id
         UNION ALL
         SELECT
           cc.id,
           cc.company_id,
           COALESCE(sr.return_date, cc.created_at::date) AS date,
           CONCAT('CRD-', COALESCE(sr.return_number, cc.id::text)) AS number,
           COALESCE(sr.return_number, '') AS linked_doc,
           p.name AS customer_name,
           cc.amount,
           'CREDIT' AS payment_mode,
           NULL::text AS reference_no,
           'Customer credit retained from sale return'::text AS notes,
           cc.created_at,
           'REFUND' AS tx_type
         FROM customer_credits cc
         LEFT JOIN sale_returns sr ON sr.id = cc.sale_return_id
         LEFT JOIN parties p ON p.id = cc.customer_id
       ) settlement
       ${whereSql}
       ORDER BY settlement.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          receiptNumber: row.number,
          date: row.date,
          invoiceId: row.linked_doc || '',
          invoiceNumber: row.linked_doc || '',
          customerId: '',
          customerName: row.customer_name || '',
          invoiceAmount: Number(row.amount || 0),
          balanceDue: 0,
          paymentAmount: Number(row.amount || 0),
          paymentMode: row.payment_mode,
          referenceNo: row.reference_no || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
          txType: row.tx_type,
        })),
        total: countRows[0]?.total || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("listSalesReturnSettlements error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

// export const listSalesPayments = async (req, res) => {
//   const { company_id } = req.user;
//   const { page, limit } = normalizePagination(req.query);
//   const offset = (page - 1) * limit;
//   const fromDate = req.query.fromDate || null;
//   const toDate = req.query.toDate || null;
//   const paymentMode = req.query.paymentMode || null;
//   const search = (req.query.search || "").trim();

//   try {
//     const where = ["sp.company_id = $1", "sp.is_active = true"];
//     const params = [company_id];

//     if (fromDate) {
//       params.push(fromDate);
//       where.push(`sp.payment_date >= $${params.length}`);
//     }
//     if (toDate) {
//       params.push(toDate);
//       where.push(`sp.payment_date <= $${params.length}`);
//     }
//     if (paymentMode && paymentMode !== "ALL") {
//       params.push(paymentMode);
//       where.push(`sp.payment_mode = $${params.length}`);
//     }
//     if (search) {
//       params.push(`%${search.toLowerCase()}%`);
//       where.push(`(
//         LOWER(sp.receipt_number) LIKE $${params.length}
//         OR LOWER(si.invoice_number) LIKE $${params.length}
//         OR LOWER(COALESCE(p.name, '')) LIKE $${params.length}
//         OR LOWER(COALESCE(sp.reference_no, '')) LIKE $${params.length}
//         OR LOWER(COALESCE(sp.cheque_no, '')) LIKE $${params.length}
//       )`);
//     }

//     const whereSql = where.join(" AND ");

//     const { rows: countRows } = await pool.query(
//       `SELECT COUNT(*)::int AS total
//        FROM sales_payments sp
//        LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
//        LEFT JOIN parties p ON p.id = si.customer_id
//        WHERE ${whereSql}`,
//       params
//     );

//     const listParams = [...params, limit, offset];

//     const { rows } = await pool.query(
//       `SELECT
//          sp.id,
//          sp.receipt_number,
//          sp.payment_date,
//          sp.invoice_id,
//          si.invoice_number,
//          si.customer_id,
//          p.name AS customer_name,
//          si.total_amount AS invoice_amount,
//          si.balance_due,
//          sp.payment_amount,
//          sp.payment_mode,
//          sp.reference_no,
//          sp.card_last_four,
//          sp.bank_name,
//          sp.cheque_no,
//          sp.cheque_date,
//          sp.cheque_status,
//          sp.bounce_reason,
//          sp.notes,
//          sp.created_at
//        FROM sales_payments sp
//        LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
//        LEFT JOIN parties p ON p.id = si.customer_id
//        WHERE ${whereSql}
//        ORDER BY sp.created_at DESC
//        LIMIT $${listParams.length - 1} OFFSET $${listParams.length}`,
//       listParams
//     );

//     return res.status(200).json({
//       success: true,
//       data: {
//         items: rows.map((row) => ({
//           id: row.id,
//           receiptNumber: row.receipt_number,
//           date: row.payment_date,
//           invoiceId: row.invoice_id,
//           invoiceNumber: row.invoice_number || "",
//           customerId: row.customer_id,
//           customerName: row.customer_name || "",
//           invoiceAmount: Number(row.invoice_amount || 0),
//           balanceDue: Number(row.balance_due || 0),
//           paymentAmount: Number(row.payment_amount || 0),
//           paymentMode: row.payment_mode,
//           referenceNo: row.reference_no || undefined,
//           cardLastFour: row.card_last_four || undefined,
//           bankName: row.bank_name || undefined,
//           chequeNo: row.cheque_no || undefined,
//           chequeDate: row.cheque_date || undefined,
//           chequeStatus: row.cheque_status || undefined,
//           bounceReason: row.bounce_reason || undefined,
//           notes: row.notes || undefined,
//           createdAt: row.created_at,
//         })),
//         total: countRows[0]?.total || 0,
//         page,
//         limit,
//       },
//     });
//   } catch (error) {
//     console.error("listSalesPayments error:", error);
//     return res.status(500).json({ success: false, message: "Internal server error" });
//   }
// };

export const listSalesPayments = async (req, res) => {
  try {
    const company_id = await resolveCompanyId(req.user);

    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized - company missing",
      });
    }

    const { page, limit } = normalizePagination(req.query);
    const offset = (page - 1) * limit;

    const { fromDate, toDate, paymentMode, warehouseId } = req.query;
    const search = (req.query.search || "").trim();

    // 🔥 WHERE builder
    const where = [];
    const params = [];

    // Optional company isolation if present
    if (company_id) {
      params.push(company_id);
      where.push(`sp.company_id = $${params.length}`);
    }

    if (fromDate) {
      params.push(fromDate);
      where.push(`sp.payment_date >= $${params.length}`);
    }

    if (warehouseId) {
      params.push(warehouseId);
      where.push(`sp.warehouse_id = $${params.length}`); // 👈
    }

    if (toDate) {
      params.push(toDate);
      where.push(`sp.payment_date <= $${params.length}`);
    }

    if (paymentMode && paymentMode !== "ALL") {
      params.push(paymentMode);
      where.push(`sp.payment_mode = $${params.length}`);
    }

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(
        LOWER(COALESCE(sp.receipt_number,'')) LIKE $${params.length}
        OR LOWER(COALESCE(si.invoice_number,'')) LIKE $${params.length}
        OR LOWER(COALESCE(p.name,'')) LIKE $${params.length}
        OR LOWER(COALESCE(sp.reference_no,'')) LIKE $${params.length}
        OR LOWER(COALESCE(sp.cheque_no,'')) LIKE $${params.length}
      )`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

    // ✅ COUNT QUERY
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total
       FROM sales_payments sp
       LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
       LEFT JOIN parties p ON p.id = si.customer_id
       ${whereSql}`,
      params
    );

    // ✅ LIST QUERY (FIXED LIMIT/OFFSET)
    const { rows } = await pool.query(
      `SELECT
         sp.id,
         sp.receipt_number,
         sp.warehouse_id,
         w.name AS warehouse_name, 
         sp.payment_date,
         sp.invoice_id,
         si.invoice_number,
         si.customer_id,
         p.name AS customer_name,
         si.total_amount AS invoice_amount,
         si.balance_due,
         sp.payment_amount,
         sp.payment_mode,
         sp.reference_no,
         sp.card_last_four,
         sp.bank_name,
         sp.cheque_no,
         sp.cheque_date,
         sp.cheque_status,
         sp.bounce_reason,
         sp.notes,
         sp.created_at
       FROM sales_payments sp
       LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
       LEFT JOIN parties p ON p.id = si.customer_id
       LEFT JOIN warehouses w ON w.id = sp.warehouse_id 
       ${whereSql}
       ORDER BY sp.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          receiptNumber: row.receipt_number,
          date: row.payment_date,
          invoiceId: row.invoice_id,
          invoiceNumber: row.invoice_number || '',
          customerId: row.customer_id,
          warehouseId: row.warehouse_id || undefined, 
          warehouseName: row.warehouse_name || undefined,
          customerName: row.customer_name || '',
          invoiceAmount: Number(row.invoice_amount || 0),
          balanceDue: Number(row.balance_due || 0),
          paymentAmount: Number(row.payment_amount || 0),
          paymentMode: row.payment_mode,
          referenceNo: row.reference_no || undefined,
          cardLastFour: row.card_last_four || undefined,
          bankName: row.bank_name || undefined,
          chequeNo: row.cheque_no || undefined,
          chequeDate: row.cheque_date || undefined,
          chequeStatus: row.cheque_status || undefined,
          bounceReason: row.bounce_reason || undefined,
          notes: row.notes || undefined,
          createdAt: row.created_at,
        })),
        total: countRows[0]?.total || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error("listSalesPayments error:", error);
    return res.status(500).json({
      success: false,
      message: error.message, // 🔥 show real error
    });
  }
};

export const createSalesPayment = async (req, res) => {
  const userId = req.user?.id;
  const company_id = await resolveCompanyId(req.user);

  if (!company_id) {
    return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
  }

  const {
    invoiceId,
    date,
    paymentAmount,
    paymentMode,
    warehouseId,
    referenceNo,
    cardLastFour,
    bankName,
    chequeNo,
    chequeDate,
    chequeStatus,
    bounceReason,
    notes,
  } = req.body;

  const amount = Number(paymentAmount || 0);
  if (!invoiceId || !date || amount <= 0 || !paymentMode) {
    return res.status(400).json({
      success: false,
      message: "invoiceId, date, paymentAmount and paymentMode are required",
    });
  }

  if (["UPI", "NEFT", "RTGS"].includes(paymentMode) && !String(referenceNo || "").trim()) {
    return res.status(400).json({ success: false, message: "referenceNo is required for selected payment mode" });
  }

  if (paymentMode === "CHEQUE") {
    if (!String(bankName || "").trim() || !String(chequeNo || "").trim() || !String(chequeDate || "").trim()) {
      return res.status(400).json({ success: false, message: "bankName, chequeNo and chequeDate are required for cheque payments" });
    }
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows: invoiceRows } = await client.query(
      `SELECT si.id, si.invoice_number, si.customer_id, si.total_amount, si.paid_amount, si.balance_due, p.name AS customer_name
       FROM sales_invoices si
       LEFT JOIN parties p ON p.id = si.customer_id
       WHERE si.id = $1 AND si.company_id = $2
       FOR UPDATE OF si`,
      [invoiceId, company_id]
    );

    if (!invoiceRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sales invoice not found" });
    }

    const invoice = invoiceRows[0];
    const currentBalance = Number(invoice.balance_due || 0);
    if (amount > currentBalance) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Payment amount cannot exceed invoice balance due" });
    }

    const paymentId = randomUUID();
    const receiptNumber = await buildReceiptNumber(client, company_id);
    const normalizedChequeStatus = paymentMode === "CHEQUE" ? (chequeStatus || "PENDING") : null;

    await client.query(
      `INSERT INTO sales_payments
        (id, company_id, invoice_id, warehouse_id, receipt_number, payment_date, payment_amount, payment_mode,
         reference_no, card_last_four, bank_name, cheque_no, cheque_date, cheque_status, bounce_reason,
         notes, created_by)
       VALUES
        ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
      [
        paymentId,
        company_id,
        invoiceId,
        warehouseId || null,
        receiptNumber,
        date,
        amount,
        paymentMode,
        referenceNo || null,
        cardLastFour || null,
        bankName || null,
        chequeNo || null,
        chequeDate || null,
        normalizedChequeStatus,
        bounceReason || null,
        notes || null,
        userId,
      ],
    );

    const nextPaid = Number(invoice.paid_amount || 0) + amount;
    const next = recalcInvoicePayment(invoice.total_amount, nextPaid);

    await client.query(
      `UPDATE sales_invoices
       SET paid_amount = $1,
           balance_due = $2,
           payment_status = $3,
           payment_mode = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [next.paidAmount, next.balanceDue, next.paymentStatus, next.paymentStatus === "PAID" ? paymentMode : "PARTIAL", invoiceId]
    );

    await applyCustomerPurseDelta(client, company_id, invoice.customer_id, amount, false);

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        id: paymentId,
        receiptNumber,
        date,
        invoiceId,
        invoiceNumber: invoice.invoice_number,
        customerId: invoice.customer_id,
        customerName: invoice.customer_name || '',
        invoiceAmount: Number(invoice.total_amount || 0),
        balanceDue: next.balanceDue,
        warehouseId: warehouseId || undefined,
        paymentAmount: amount,
        paymentMode,
        referenceNo: referenceNo || undefined,
        cardLastFour: cardLastFour || undefined,
        bankName: bankName || undefined,
        chequeNo: chequeNo || undefined,
        chequeDate: chequeDate || undefined,
        chequeStatus: normalizedChequeStatus || undefined,
        bounceReason: bounceReason || undefined,
        notes: notes || undefined,
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("createSalesPayment error:", error);
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  } finally {
    client.release();
  }
};

export const updateSalesPaymentChequeStatus = async (req, res) => {
  const company_id = await resolveCompanyId(req.user);
  if (!company_id) {
    return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
  }
  const { id } = req.params;
  const { chequeStatus, bounceReason } = req.body;

  if (!["CLEARED", "BOUNCED", "INSUFFICIENT_BALANCE"].includes(chequeStatus)) {
    return res.status(400).json({
      success: false,
      message: "chequeStatus must be CLEARED, BOUNCED or INSUFFICIENT_BALANCE",
    });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `SELECT
         sp.id,
         sp.invoice_id,
         sp.payment_amount,
         sp.payment_mode,
         sp.cheque_status,
         si.total_amount,
         si.paid_amount
       FROM sales_payments sp
       JOIN sales_invoices si ON si.id = sp.invoice_id
       WHERE sp.id = $1 AND sp.company_id = $2
       FOR UPDATE`,
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Sales payment not found" });
    }

    const payment = rows[0];
    if (payment.payment_mode !== "CHEQUE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Cheque status can only be updated for cheque payments" });
    }

    const oldStatus = payment.cheque_status || "PENDING";
    let paid = Number(payment.paid_amount || 0);
    const amount = Number(payment.payment_amount || 0);
    let purseDelta = 0;

    if (!isChequeBounceStatus(oldStatus) && isChequeBounceStatus(chequeStatus)) {
      paid = Math.max(0, paid - amount);
      purseDelta = -amount;
    }
    if (isChequeBounceStatus(oldStatus) && chequeStatus === "CLEARED") {
      paid = paid + amount;
      purseDelta = amount;
    }

    const next = recalcInvoicePayment(payment.total_amount, paid);

    await client.query(
      `UPDATE sales_invoices
       SET paid_amount = $1,
           balance_due = $2,
           payment_status = $3,
           payment_mode = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [next.paidAmount, next.balanceDue, next.paymentStatus, next.paymentStatus === "PAID" ? "CHEQUE" : "PARTIAL", payment.invoice_id]
    );

    if (purseDelta !== 0) {
      const { rows: invoiceRows } = await client.query(
        `SELECT customer_id
         FROM sales_invoices
         WHERE id = $1 AND company_id = $2
         LIMIT 1`,
        [payment.invoice_id, company_id]
      );

      if (!invoiceRows.length) {
        await client.query("ROLLBACK");
        return res.status(404).json({ success: false, message: "Sales invoice not found" });
      }

      await applyCustomerPurseDelta(
        client,
        company_id,
        invoiceRows[0].customer_id,
        purseDelta,
        purseDelta < 0,
      );
    }

    await client.query(
      `UPDATE sales_payments
       SET cheque_status = $1,
           bounce_reason = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [chequeStatus, bounceReason || null, id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      data: {
        id,
        chequeStatus,
        bounceReason: bounceReason || undefined,
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updateSalesPaymentChequeStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  } finally {
    client.release();
  }
};

export const getSalesPaymentById = async (req, res) => {
  const company_id = await resolveCompanyId(req.user);
  if (!company_id) {
    return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
  }

  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `SELECT
         sp.id,
         sp.receipt_number,
         sp.warehouse_id,
         w.name AS warehouse_name,  
         sp.payment_date,
         sp.invoice_id,
         si.invoice_number,
         si.customer_id,
         p.name AS customer_name,
         si.total_amount AS invoice_amount,
         si.paid_amount,
         si.balance_due,
         sp.payment_amount,
         sp.payment_mode,
         sp.reference_no,
         sp.card_last_four,
         sp.bank_name,
         sp.cheque_no,
         sp.cheque_date,
         sp.cheque_status,
         sp.bounce_reason,
         sp.notes,
         sp.created_at
       FROM sales_payments sp
       LEFT JOIN sales_invoices si ON si.id = sp.invoice_id
       LEFT JOIN parties p ON p.id = si.customer_id
       LEFT JOIN warehouses w ON w.id = sp.warehouse_id  
       WHERE sp.id = $1 AND sp.company_id = $2
       LIMIT 1`,
      [id, company_id],
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Payment receipt not found" });
    }

    const row = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: row.id,
        receiptNumber: row.receipt_number,
        paymentDate: row.payment_date,
        invoiceId: row.invoice_id,
        invoiceNumber: row.invoice_number || "",
        customerId: row.customer_id,
        customerName: row.customer_name || "",
        invoiceAmount: Number(row.invoice_amount || 0),
        paidAmount: Number(row.paid_amount || 0),
        balanceDue: Number(row.balance_due || 0),
        paymentAmount: Number(row.payment_amount || 0),
        paymentMode: row.payment_mode,
        referenceNo: row.reference_no || undefined,
        cardLastFour: row.card_last_four || undefined,
        bankName: row.bank_name || undefined,
        chequeNo: row.cheque_no || undefined,
        chequeDate: row.cheque_date || undefined,
        chequeStatus: row.cheque_status || undefined,
        bounceReason: row.bounce_reason || undefined,
        notes: row.notes || undefined,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error("getSalesPaymentById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const getSalesPaymentPrintData = async (req, res) => {
  return getSalesPaymentById(req, res);
};


export const updateSalesPayment = async (req, res) => {
  const userId = req.user?.id;
  const company_id = await resolveCompanyId(req.user);
  const { id } = req.params;

  const {
    paymentAmount,
    paymentMode,
    warehouseId,
    referenceNo,
    cardLastFour,
    bankName,
    chequeNo,
    chequeDate,
    chequeStatus,
    bounceReason,
    notes,
  } = req.body;

  const amount = Number(paymentAmount || 0);
  if (!id || amount <= 0 || !paymentMode) {
    return res.status(400).json({
      success: false,
      message: "id, paymentAmount and paymentMode are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔹 Get existing payment
    const { rows } = await client.query(
      `SELECT * FROM sales_payments WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Payment not found");

    const oldPayment = rows[0];

    // 🔹 Get invoice
    const { rows: invoiceRows } = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [oldPayment.invoice_id, company_id]
    );

    const invoice = invoiceRows[0];

    // 🔥 Reverse OLD payment
    const reversedPaid = Number(invoice.paid_amount || 0) - Number(oldPayment.payment_amount || 0);
    const reversed = recalcInvoicePayment(invoice.total_amount, reversedPaid);

    // 🔹 Update payment
    await client.query(
      `UPDATE sales_payments
       SET payment_amount = $1,
           payment_mode = $2,
           warehouse_id = $3, 
           reference_no = $4,
           card_last_four = $5,
           bank_name = $6,
           cheque_no = $7,
           cheque_date = $8,
           cheque_status = $9,
           bounce_reason = $10,
           notes = $11,
           updated_at = NOW()
       WHERE id = $12`,
      [
        amount,
        paymentMode,
        warehouseId || null,
        referenceNo || null,
        cardLastFour || null,
        bankName || null,
        chequeNo || null,
        chequeDate || null,
        chequeStatus || null,
        bounceReason || null,
        notes || null,
        id,
      ],
    );

    // 🔥 Apply NEW payment
    const nextPaid = reversed.paidAmount + amount;
    const next = recalcInvoicePayment(invoice.total_amount, nextPaid);

    await client.query(
      `UPDATE sales_invoices
       SET paid_amount = $1,
           balance_due = $2,
           payment_status = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [next.paidAmount, next.balanceDue, next.paymentStatus, invoice.id]
    );

    // 🔥 Adjust purse
    await applyCustomerPurseDelta(client, company_id, invoice.customer_id, oldPayment.payment_amount, true);
    await applyCustomerPurseDelta(client, company_id, invoice.customer_id, amount, false);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Payment updated successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateSalesPayment error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};


export const deleteSalesPayment = async (req, res) => {
  const company_id = await resolveCompanyId(req.user);
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Payment id is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔹 Get payment
    const { rows } = await client.query(
      `SELECT * FROM sales_payments WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Payment not found");

    const payment = rows[0];

    // 🔹 Get invoice
    const { rows: invoiceRows } = await client.query(
      `SELECT * FROM sales_invoices WHERE id = $1 AND company_id = $2 FOR UPDATE`,
      [payment.invoice_id, company_id]
    );

    const invoice = invoiceRows[0];

    // 🔥 Reverse payment
    const nextPaid = Number(invoice.paid_amount || 0) - Number(payment.payment_amount || 0);
    const next = recalcInvoicePayment(invoice.total_amount, nextPaid);

    await client.query(
      `UPDATE sales_invoices
       SET paid_amount = $1,
           balance_due = $2,
           payment_status = $3,
           updated_at = NOW()
       WHERE id = $4`,
      [next.paidAmount, next.balanceDue, next.paymentStatus, invoice.id]
    );

    // 🔥 Adjust purse
    await applyCustomerPurseDelta(client, company_id, invoice.customer_id, payment.payment_amount, true);

    // 🔥 Delete payment
    await client.query(`DELETE FROM sales_payments WHERE id = $1`, [id]);

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Payment deleted successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deleteSalesPayment error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};