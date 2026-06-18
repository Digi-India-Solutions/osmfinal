import pool from "../../pool.js";
// CONSTANTS

const VALID_MODES   = ["CASH", "UPI", "CARD", "CHEQUE", "NEFT", "RTGS"];
const VALID_CHEQUE  = ["PENDING", "CLEARED", "BOUNCED", "INSUFFICIENT_BALANCE"];

// HELPERS
export const generateVoucherNumber = async (client, company_id) => {
  await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, current_value)
     VALUES ($1, 'PAY', 0)
     ON CONFLICT (company_id, doc_type) DO NOTHING`,
    [company_id]
  );
  const { rows } = await client.query(
    `UPDATE document_sequences
     SET current_value = current_value + 1
     WHERE company_id = $1 AND doc_type = 'PAY'
     RETURNING current_value`,
    [company_id]
  );
  const year = new Date().getFullYear();
  return `PAY-${year}-${String(rows[0].current_value).padStart(4, "0")}`;
};

const calcPaymentStatus = (paid, total) => {
  if (paid <= 0)        return "UNPAID";
  if (paid >= total)    return "PAID";
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

  const { rows: updatedRows } = await client.query(
    `UPDATE parties
     SET opening_balance = $1
     WHERE id = $2 AND company_id = $3
     RETURNING opening_balance`,
    [next, supplierId, company_id]
  );

  return Number(updatedRows[0]?.opening_balance ?? next);
};

const formatVoucher = (row) => ({
  id:              row.id,
  voucherNumber:   row.voucher_number,
  companyId:       row.company_id,
  invoiceId:       row.invoice_id,
  invoiceNumber:   row.invoice_number   || null,
  supplierId:      row.supplier_id,
  supplierName:    row.supplier_name    || null,
  invoiceAmount:   parseFloat(row.invoice_amount)   || 0,
  paymentAmount:   parseFloat(row.payment_amount),
  paymentMode:     row.payment_mode,
  type:            row.type || null, 
  date:            row.date,
  referenceNo:     row.reference_no     || null,
  cardLastFour:    row.card_last_four   || null,
  bankName:        row.bank_name        || null,
  chequeNo:        row.cheque_no        || null,
  chequeDate:      row.cheque_date      || null,
  chequeStatus:    row.cheque_status    || null,
  bounceReason:    row.bounce_reason    || null,
  notes:           row.notes            || null,
  createdBy:       row.created_by,
  createdAt:       row.created_at,
});

// CREATE PAYMENT VOUCHER

// export const createPayment = async (req, res) => {
//   const client = await pool.connect();
// console.log("BODY===>" ,req.body)
//   try {
//     await client.query("BEGIN");

//     const company_id = await resolveCompanyId(req.user);
//     if (!company_id) {
//       await client.query("ROLLBACK");
//       return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
//     }

//     const {
//       invoiceId,
//       paymentAmount,
//       paymentMode,
//       date,
//       referenceNo,
//       cardLastFour,
//       bankName,
//       chequeNo,
//       chequeDate,
//       chequeStatus  = "PENDING",
//       bounceReason,
//       notes,
//     } = req.body;

//     // ── Validations ──
//     if (!invoiceId) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ success: false, message: "Invoice ID is required" });
//     }
//     if (!paymentAmount || Number(paymentAmount) <= 0) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ success: false, message: "Payment amount must be greater than 0" });
//     }
//     if (!VALID_MODES.includes(paymentMode)) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ success: false, message: `Invalid payment mode. Valid: ${VALID_MODES.join(", ")}` });
//     }

//     // Mode-specific field validation
//     if (["UPI", "NEFT", "RTGS"].includes(paymentMode) && !referenceNo?.trim()) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({ success: false, message: `Reference number is required for ${paymentMode}` });
//     }
//     if (paymentMode === "CHEQUE") {
//       if (!bankName?.trim()) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({ success: false, message: "Bank name is required for cheque payments" });
//       }
//       if (!chequeNo?.trim()) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({ success: false, message: "Cheque number is required" });
//       }
//       if (!chequeDate) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({ success: false, message: "Cheque date is required" });
//       }
//       if (!VALID_CHEQUE.includes(chequeStatus)) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({ success: false, message: "Invalid cheque status" });
//       }
//       if (["BOUNCED", "INSUFFICIENT_BALANCE"].includes(chequeStatus) && !bounceReason?.trim()) {
//         await client.query("ROLLBACK");
//         return res.status(400).json({ success: false, message: "Bounce reason is required" });
//       }
//     }
// console.log("BODY===>AAA" ,req.body ,invoiceId, company_id)
//     // ── Fetch & validate invoice ──
//     const { rows: invRows } = await client.query(
//       `SELECT pi.*, p.name AS supplier_name
//        FROM purchase_invoices pi
//        LEFT JOIN parties p ON pi.supplier_id = p.id
//        WHERE pi.id = $1 AND pi.company_id = $2`,
//       [invoiceId, company_id]
//     );
// console.log("BODY===>AAA" ,req.body ,invoiceId, company_id, invRows )
//     if (invRows.length === 0) {
//       await client.query("ROLLBACK");
//       return res.status(404).json({ success: false, message: "Invoice not found" });
//     }

//     const invoice     = invRows[0];
//     const totalAmount = parseFloat(invoice.total_amount);
//     const alreadyPaid = parseFloat(invoice.paid_amount);
//     const balanceDue  = totalAmount - alreadyPaid;

//     if (Number(paymentAmount) > balanceDue) {
//       await client.query("ROLLBACK");
//       return res.status(400).json({
//         success: false,
//         message: `Payment amount (${paymentAmount}) exceeds balance due (${balanceDue.toFixed(2)})`,
//       });
//     }

//     let supplierPurseBalance = null;

//     // ── Generate voucher number ──
//     const voucher_number = await generateVoucherNumber(client, company_id);

//     // ── Insert payment voucher ──
//     const { rows: voucherRows } = await client.query(
//       `INSERT INTO purchase_payments
//         (company_id, invoice_id, supplier_id,
//          voucher_number, date, payment_amount, payment_mode,
//          reference_no, card_last_four,
//          bank_name, cheque_no, cheque_date, cheque_status, bounce_reason,
//          notes, created_by, type)
//        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
//        RETURNING *`,
//       [
//         company_id,
//         invoiceId,
//         invoice.supplier_id,
//         voucher_number,
//         date            || new Date(),
//         Number(paymentAmount),
//         paymentMode,
//         referenceNo     || null,
//         cardLastFour    || null,
//         bankName        || null,
//         chequeNo        || null,
//         chequeDate      || null,
//         paymentMode === "CHEQUE" ? chequeStatus : null,
//         bounceReason    || null,
//         notes           || null,
//         req.user.id,
//         "PAYMENT"
//       ]
//     );

//     // ── Update invoice paid_amount + payment_status ──
//     // For CHEQUE: only count as paid if status is CLEARED — otherwise keep balance open
//     const isChequeAndNotCleared =
//       paymentMode === "CHEQUE" && chequeStatus !== "CLEARED";

//     const newPaid   = isChequeAndNotCleared
//       ? alreadyPaid   // don't add cheque amount until it clears
//       : Math.min(alreadyPaid + Number(paymentAmount), totalAmount);

//     const newStatus = calcPaymentStatus(newPaid, totalAmount);

//     await client.query(
//       `UPDATE purchase_invoices
//        SET paid_amount = $1, payment_status = $2, updated_at = NOW()
//        WHERE id = $3 and company_id = $4`,
//       [newPaid.toFixed(2), newStatus, invoiceId, company_id]
//     );

//     if (!isChequeAndNotCleared) {
//       supplierPurseBalance = await applySupplierPurseDelta(
//         client,
//         company_id,
//         invoice.supplier_id,
//         Number(paymentAmount)
//       );
//     }

//     await client.query("COMMIT");

//     return res.status(201).json({
//       success: true,
//       message: `${voucher_number} recorded successfully`,
//       data: {
//         ...formatVoucher({
//           ...voucherRows[0],
//           invoice_number: invoice.invoice_number,
//           supplier_name:  invoice.supplier_name,
//           invoice_amount: invoice.total_amount,
//         }),
//         invoicePaymentStatus: newStatus,
//         newBalanceDue:        (totalAmount - newPaid).toFixed(2),
//         supplierPurseBalance,
//       },
//     });

//   } catch (error) {
//     await client.query("ROLLBACK");
//     console.error("Create Payment Error:", error);
//     return res.status(500).json({ success: false, message: "Server error" });
//   } finally {
//     client.release();
//   }
// };


export const createPayment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ── Auth ──────────────────────────────────────────────────────────────────
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const {
      invoiceId,
      paymentAmount,
      paymentMode,
      date,
      referenceNo,
      cardLastFour,
      bankName,
      chequeNo,
      chequeDate,
      chequeStatus = "PENDING",
      bounceReason,
      notes,
      warehouseId,
      warehouseName,
    } = req.body;

    // ── Validation ────────────────────────────────────────────────────────────
    const validationError = validatePaymentBody({
      invoiceId, paymentAmount, paymentMode,
      referenceNo, bankName, chequeNo, chequeDate, chequeStatus, bounceReason,
    });
    if (validationError) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: validationError });
    }

    // ── Fetch & validate invoice ──────────────────────────────────────────────
    const { rows: invRows } = await client.query(
      `SELECT pi.*, p.name AS supplier_name, w.name AS warehouse_name
       FROM purchase_invoices pi
       LEFT JOIN parties p ON pi.supplier_id = p.id
       LEFT JOIN warehouses w ON pi.warehouse_id = w.id
       WHERE pi.id = $1 AND pi.company_id = $2`,
      [invoiceId, company_id]
    );

    if (invRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Invoice not found" });
    }

    const invoice     = invRows[0];
    const totalAmount = parseFloat(invoice.total_amount);
    const alreadyPaid = parseFloat(invoice.paid_amount);
    const balanceDue  = totalAmount - alreadyPaid;

    if (balanceDue <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Invoice is already fully paid" });
    }

    if (Number(paymentAmount) > balanceDue) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Payment amount (${Number(paymentAmount).toFixed(2)}) exceeds balance due (${balanceDue.toFixed(2)})`,
      });
    }

    // ── Insert payment record (with duplicate voucher retry) ──────────────────
    //
    // KEY FIX: The savepoint MUST be set BEFORE the INSERT attempt.
    // Once PostgreSQL throws any error inside a transaction the transaction
    // enters an aborted state — ALL subsequent queries fail with
    // "current transaction is aborted, commands ignored until end of block".
    // Setting the savepoint after the failure is too late; the transaction is
    // already dead. Set it first, try the insert, and only roll back to the
    // savepoint if the insert fails with a duplicate voucher error.

    let voucher_number;
    let voucherRows;

    for (let attempt = 1; attempt <= 5; attempt++) {
      voucher_number = await generateVoucherNumber(client, company_id);

      // On retry, append a suffix so we don't collide with the same number again
      if (attempt > 1) {
        voucher_number = `${voucher_number}-R${attempt}`;
      }

      // ✅ Set savepoint BEFORE the insert — this is the critical fix
      await client.query("SAVEPOINT pre_insert");

      try {
        const result = await client.query(
          `INSERT INTO purchase_payments
            (company_id, invoice_id, supplier_id,
             voucher_number, date, payment_amount, payment_mode,
             reference_no, card_last_four,
             bank_name, cheque_no, cheque_date, cheque_status, bounce_reason,
             notes, created_by, type, warehouse_id, warehouse_name)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
           RETURNING *`,
          [
            company_id,
            invoiceId,
            invoice.supplier_id,
            voucher_number,
            date         || new Date(),
            Number(paymentAmount),
            paymentMode,
            referenceNo  || null,
            cardLastFour || null,
            bankName     || null,
            chequeNo     || null,
            chequeDate   || null,
            paymentMode === "CHEQUE" ? chequeStatus : null,
            bounceReason || null,
            notes        || null,
            req.user.id,
            "PAYMENT",
            warehouseId  || invoice.warehouse_id  || null,
            warehouseName || invoice.warehouse_name || null,
          ]
        );

        voucherRows = result.rows;
        // Insert succeeded — release the savepoint and exit the loop
        await client.query("RELEASE SAVEPOINT pre_insert");
        break;

      } catch (insertErr) {
        // Roll back to savepoint — this restores the transaction to a healthy
        // state so we can continue or retry
        await client.query("ROLLBACK TO SAVEPOINT pre_insert");

        const isDuplicateVoucher =
          insertErr.code === "23505" &&
          insertErr.constraint === "uq_payment_voucher_per_company";

        if (isDuplicateVoucher && attempt < 5) {
          // Try again with a new voucher number
          continue;
        }

        // Non-duplicate error or retries exhausted — abort
        throw insertErr;
      }
    }

    if (!voucherRows?.length) {
      await client.query("ROLLBACK");
      return res.status(500).json({
        success: false,
        message: "Failed to generate a unique voucher number after 5 attempts. Please try again.",
      });
    }

    // ── Update invoice balance ────────────────────────────────────────────────
    // CHEQUE pending/bounced: don't credit until cleared
    const isChequeAndNotCleared =
      paymentMode === "CHEQUE" && chequeStatus !== "CLEARED";

    const newPaid   = isChequeAndNotCleared
      ? alreadyPaid
      : Math.min(alreadyPaid + Number(paymentAmount), totalAmount);

    const newStatus = calcPaymentStatus(newPaid, totalAmount);

    await client.query(
      `UPDATE purchase_invoices
       SET paid_amount = $1, payment_status = $2, updated_at = NOW()
       WHERE id = $3 AND company_id = $4`,
      [newPaid.toFixed(2), newStatus, invoiceId, company_id]
    );

    // ── Update supplier purse (only when payment actually lands) ──────────────
    let supplierPurseBalance = null;
    if (!isChequeAndNotCleared) {
      supplierPurseBalance = await applySupplierPurseDelta(
        client,
        company_id,
        invoice.supplier_id,
        Number(paymentAmount)
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${voucher_number} recorded successfully`,
      data: {
        ...formatVoucher({
          ...voucherRows[0],
          invoice_number: invoice.invoice_number,
          supplier_name:  invoice.supplier_name,
          invoice_amount: invoice.total_amount,
        }),
        invoicePaymentStatus: newStatus,
        newBalanceDue:        (totalAmount - newPaid).toFixed(2),
        supplierPurseBalance,
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Payment Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─── Validation helper ────────────────────────────────────────────────────────

function validatePaymentBody({
  invoiceId,
  paymentAmount,
  paymentMode,
  referenceNo,
  bankName,
  chequeNo,
  chequeDate,
  chequeStatus,
  bounceReason,
}) {
  if (!invoiceId)
    return "Invoice ID is required";

  if (!paymentAmount || Number(paymentAmount) <= 0)
    return "Payment amount must be greater than 0";

  if (!VALID_MODES.includes(paymentMode))
    return `Invalid payment mode. Valid: ${VALID_MODES.join(", ")}`;

  if (["UPI", "NEFT", "RTGS"].includes(paymentMode) && !referenceNo?.trim())
    return `Reference number is required for ${paymentMode}`;

  if (paymentMode === "CHEQUE") {
    if (!bankName?.trim())  return "Bank name is required for cheque payments";
    if (!chequeNo?.trim())  return "Cheque number is required";
    if (!chequeDate)        return "Cheque date is required";
    if (!VALID_CHEQUE.includes(chequeStatus))
      return "Invalid cheque status";
    if (
      ["BOUNCED", "INSUFFICIENT_BALANCE"].includes(chequeStatus) &&
      !bounceReason?.trim()
    ) return "Bounce reason is required";
  }

  return null;
}

// ─────────────────────────────────────────────
// GET ALL PAYMENTS (history page)
// ─────────────────────────────────────────────
export const getAllPayments = async (req, res) => {
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const {
      search       = "",
      payment_mode = "",
      cheque_status = "",
      from_date    = "",
      to_date      = "",
      supplier_id  = "",
      warehouse_id = "",
    } = req.query;

    let query = `
      SELECT
        pp.*,
        pi.invoice_number,
        pi.total_amount   AS invoice_amount,
        p.name            AS supplier_name
      FROM purchase_payments pp
      LEFT JOIN purchase_invoices pi ON pp.invoice_id  = pi.id
      LEFT JOIN parties           p  ON pp.supplier_id = p.id AND p.company_id = $1
      WHERE pp.company_id = $1
    `;

    const values = [company_id];
    let idx = 2;

    if (warehouse_id) {
      query += ` AND pi.warehouse_id = $${idx}`;
      values.push(warehouse_id);
      idx++;
    }

    if (search) {
      query += ` AND (
        pp.voucher_number    ILIKE $${idx} OR
        p.name               ILIKE $${idx} OR
        pi.invoice_number    ILIKE $${idx} OR
        pp.reference_no      ILIKE $${idx} OR
        pp.cheque_no         ILIKE $${idx}
      )`;
      values.push(`%${search}%`);
      idx++;
    }
    if (payment_mode && payment_mode !== "ALL") {
      query += ` AND pp.payment_mode = $${idx}`;
      values.push(payment_mode.toUpperCase());
      idx++;
    }
    if (cheque_status && cheque_status !== "ALL") {
      query += ` AND pp.cheque_status = $${idx}`;
      values.push(cheque_status.toUpperCase());
      idx++;
    }
    if (supplier_id) {
      query += ` AND pp.supplier_id = $${idx}`;
      values.push(supplier_id);
      idx++;
    }
    if (from_date) {
      query += ` AND pp.date >= $${idx}`;
      values.push(from_date);
      idx++;
    }
    if (to_date) {
      query += ` AND pp.date <= $${idx}`;
      values.push(to_date);
      idx++;
    }

    query += ` ORDER BY pp.created_at DESC`;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows.map(formatVoucher),
    });

  } catch (error) {
    console.error("Get All Payments Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET PAYMENT BY ID
// ─────────────────────────────────────────────
export const getPaymentById = async (req, res) => {
  try {
    const { id }     = req.params;
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const { rows } = await pool.query(
      `SELECT pp.*, pi.invoice_number, pi.total_amount AS invoice_amount, p.name AS supplier_name
       FROM purchase_payments pp
       LEFT JOIN purchase_invoices pi ON pp.invoice_id  = pi.id
       LEFT JOIN parties           p  ON pp.supplier_id = p.id
       WHERE pp.id = $1 AND pp.company_id = $2`,
      [id, company_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Payment not found" });

    return res.status(200).json({ success: true, data: formatVoucher(rows[0]) });

  } catch (error) {
    console.error("Get Payment By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// GET PAYMENTS BY INVOICE
// ─────────────────────────────────────────────
export const getPaymentsByInvoice = async (req, res) => {
  try {
    const { invoiceId } = req.params;
    const company_id    = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const { rows } = await pool.query(
      `SELECT pp.*, pi.invoice_number, pi.total_amount AS invoice_amount, p.name AS supplier_name
       FROM purchase_payments pp
       LEFT JOIN purchase_invoices pi ON pp.invoice_id  = pi.id
       LEFT JOIN parties           p  ON pp.supplier_id = p.id
       WHERE pp.invoice_id = $1 AND pp.company_id = $2
       ORDER BY pp.date DESC`,
      [invoiceId, company_id]
    );

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows.map(formatVoucher),
    });

  } catch (error) {
    console.error("Get Payments By Invoice Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// GET PAYMENT STATS
// ─────────────────────────────────────────────
export const getPaymentStats = async (req, res) => {
  try {
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const { rows } = await pool.query(
      `SELECT
        COUNT(*)                                                            AS total,
        COALESCE(SUM(payment_amount), 0)                                    AS total_paid,
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_mode = 'CASH'),  0) AS cash_total,
        COALESCE(SUM(payment_amount) FILTER (WHERE payment_mode = 'CHEQUE'),0) AS cheque_total,
        COALESCE(SUM(payment_amount) FILTER (
          WHERE payment_mode IN ('UPI','NEFT','RTGS','CARD')
        ), 0)                                                               AS digital_total,
        COUNT(*) FILTER (WHERE cheque_status = 'PENDING')                   AS cheque_pending,
        COUNT(*) FILTER (
          WHERE cheque_status IN ('BOUNCED','INSUFFICIENT_BALANCE')
        )                                                                   AS cheque_bounced,
        COUNT(*) FILTER (
          WHERE date >= date_trunc('month', CURRENT_DATE)
        )                                                                   AS this_month_count,
        COALESCE(SUM(payment_amount) FILTER (
          WHERE date >= date_trunc('month', CURRENT_DATE)
        ), 0)                                                               AS this_month_amount
       FROM purchase_payments
       WHERE company_id = $1`,
      [company_id]
    );

    const s = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        total:           Number(s.total),
        totalPaid:       parseFloat(s.total_paid),
        cashTotal:       parseFloat(s.cash_total),
        chequeTotal:     parseFloat(s.cheque_total),
        digitalTotal:    parseFloat(s.digital_total),
        chequePending:   Number(s.cheque_pending),
        chequeBounced:   Number(s.cheque_bounced),
        thisMonthCount:  Number(s.this_month_count),
        thisMonthAmount: parseFloat(s.this_month_amount),
      },
    });

  } catch (error) {
    console.error("Payment Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// UPDATE CHEQUE STATUS
// Frontend: "Update" button on PENDING cheques
// ─────────────────────────────────────────────
export const updateChequeStatus = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id }     = req.params;
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const { chequeStatus, bounceReason } = req.body;

    const validUpdate = ["CLEARED", "BOUNCED", "INSUFFICIENT_BALANCE"];
    if (!validUpdate.includes(chequeStatus)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `chequeStatus must be one of: ${validUpdate.join(", ")}`,
      });
    }
    if (["BOUNCED", "INSUFFICIENT_BALANCE"].includes(chequeStatus) && !bounceReason?.trim()) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Bounce reason is required" });
    }

    // Fetch payment
    const { rows: payRows } = await client.query(
      "SELECT * FROM purchase_payments WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (payRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = payRows[0];

    if (payment.payment_mode !== "CHEQUE") {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Only CHEQUE payments can be updated" });
    }
    if (payment.cheque_status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({ success: false, message: "Cheque is already resolved" });
    }

    // Update cheque status
    await client.query(
      `UPDATE purchase_payments
       SET cheque_status = $1, bounce_reason = $2, updated_at = NOW()
       WHERE id = $3 and company_id = $4`,
      [chequeStatus, bounceReason || null, id, company_id]
    );

    // Fetch invoice to recalculate payment
    const { rows: invRows } = await client.query(
      "SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2",
      [payment.invoice_id, company_id]
    );

    if (invRows.length > 0) {
      const invoice = invRows[0];

      if (chequeStatus === "CLEARED") {
        // Add cheque amount to paid_amount now that it's cleared
        const newPaid   = Math.min(
          parseFloat(invoice.paid_amount) + parseFloat(payment.payment_amount),
          parseFloat(invoice.total_amount)
        );
        const newStatus = calcPaymentStatus(newPaid, parseFloat(invoice.total_amount));
        await client.query(
          `UPDATE purchase_invoices
           SET paid_amount = $1, payment_status = $2, updated_at = NOW()
           WHERE id = $3 and company_id =$4`,
          [newPaid.toFixed(2), newStatus, payment.invoice_id, company_id]
        );

        await applySupplierPurseDelta(
          client,
          company_id,
          payment.supplier_id,
          Number(payment.payment_amount)
        );
      } else {
        // Bounced: invoice remains at old paid_amount, status stays as-is
        // No change needed — we never credited the cheque amount on creation
      }
    }

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `Cheque status updated to ${chequeStatus}`,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Cheque Status Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// DELETE PAYMENT VOUCHER
// Only allowed if cheque is PENDING/BOUNCED
// and invoice balance can be safely restored
// ─────────────────────────────────────────────
export const deletePayment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id }     = req.params;
    const company_id = await resolveCompanyId(req.user);
    if (!company_id) {
      await client.query("ROLLBACK");
      return res.status(401).json({ success: false, message: "Unauthorized - company missing" });
    }

    const { rows: payRows } = await client.query(
      "SELECT * FROM purchase_payments WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (payRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Payment not found" });
    }

    const payment = payRows[0];

    // Block delete if cheque is CLEARED (money already transferred)
    if (payment.cheque_status === "CLEARED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: "Cannot delete a cleared cheque payment. Create a debit note instead.",
      });
    }

    // Only reverse invoice paid_amount if this payment was actually credited
    // (i.e., non-cheque OR cheque that was cleared — but cleared is blocked above)
    const wasCredited = payment.payment_mode !== "CHEQUE" ||
      payment.cheque_status === "CLEARED";

    if (wasCredited) {
      const { rows: invRows } = await client.query(
        "SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2",
        [payment.invoice_id, company_id]
      );
      if (invRows.length > 0) {
        const invoice   = invRows[0];
        const newPaid   = Math.max(0, parseFloat(invoice.paid_amount) - parseFloat(payment.payment_amount));
        const newStatus = calcPaymentStatus(newPaid, parseFloat(invoice.total_amount));
        await client.query(
          `UPDATE purchase_invoices
           SET paid_amount = $1, payment_status = $2, updated_at = NOW()
           WHERE id = $3 and company_id=$4`,
          [newPaid.toFixed(2), newStatus, payment.invoice_id, company_id]
        );
      }
    }

    if (wasCredited) {
      await applySupplierPurseDelta(
        client,
        company_id,
        payment.supplier_id,
        -Number(payment.payment_amount || 0)
      );
    }

    await client.query("DELETE FROM purchase_payments WHERE id = $1", [id]);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${payment.voucher_number} deleted successfully`,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Payment Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

export const updatePayment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    const {
      paymentAmount,
      paymentMode,
      referenceNo,
      cardLastFour,
      bankName,
      chequeNo,
      chequeDate,
      chequeStatus = "PENDING",
      bounceReason,
      notes,
    } = req.body;

    if (!id) throw new Error("Payment id required");

    // 🔹 Get old payment
    const { rows } = await client.query(
      `SELECT * FROM purchase_payments WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Payment not found");

    const oldPayment = rows[0];

    // 🔹 Get invoice
    const { rows: invRows } = await client.query(
      `SELECT * FROM purchase_invoices WHERE id = $1 AND company_id = $2`,
      [oldPayment.invoice_id, company_id]
    );

    const invoice = invRows[0];

    let paid = Number(invoice.paid_amount);

    // 🔥 Reverse OLD payment (only if counted)
    const oldCounted =
      oldPayment.payment_mode !== "CHEQUE" ||
      oldPayment.cheque_status === "CLEARED";

    if (oldCounted) {
      paid -= Number(oldPayment.payment_amount);
    }

    // 🔹 Update payment row
    await client.query(
      `UPDATE purchase_payments
       SET payment_amount = $1,
           payment_mode = $2,
           reference_no = $3,
           card_last_four = $4,
           bank_name = $5,
           cheque_no = $6,
           cheque_date = $7,
           cheque_status = $8,
           bounce_reason = $9,
           notes = $10,
           updated_at = NOW()
       WHERE id = $11`,
      [
        paymentAmount,
        paymentMode,
        referenceNo || null,
        cardLastFour || null,
        bankName || null,
        chequeNo || null,
        chequeDate || null,
        paymentMode === "CHEQUE" ? chequeStatus : null,
        bounceReason || null,
        notes || null,
        id,
      ]
    );

    // 🔥 Apply NEW payment
    const newCounted =
      paymentMode !== "CHEQUE" || chequeStatus === "CLEARED";

    if (newCounted) {
      paid += Number(paymentAmount);
    }

    const totalAmount = Number(invoice.total_amount);
    const newStatus = calcPaymentStatus(paid, totalAmount);

    await client.query(
      `UPDATE purchase_invoices
       SET paid_amount = $1,
           payment_status = $2,
           updated_at = NOW()
       WHERE id = $3`,
      [paid.toFixed(2), newStatus, invoice.id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Payment updated successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updatePayment error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};
