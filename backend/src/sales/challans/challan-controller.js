import { randomUUID } from "node:crypto";
import pool from "../../pool.js";
import { generateDocumentNumber } from "../../../utils/generateDocumentNumber.js";

const normalizePagination = (query) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.max(1, parseInt(query.limit, 10) || 50);
  return { page, limit };
};

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

 
export const listChallans = async (req, res) => {
  const { company_id } = req.user;

  const { page, limit } = normalizePagination(req.query);

  const warehouseId = req.query.warehouseId || req.user.warehouse_id;

  if (!warehouseId) {
    return res.status(400).json({
      success: false,
      message: 'Warehouse id is required',
    });
  }

  const offset = (page - 1) * limit;

  try {
    const countQuery = `
      SELECT COUNT(*)::int AS total
      FROM challans
      WHERE company_id = $1
        AND is_active = true
        AND warehouse_id = $2
    `;

    const countParams = [company_id, warehouseId];

    const { rows: countRows } = await pool.query(countQuery, countParams);

    let query = `
      SELECT
         c.id,
         c.customer_id,
         c.warehouse_id,
         c.challan_number,
         c.challan_date,
         c.status,
         p.name AS party_name,
         w.name AS warehouse_name,
         COALESCE(ci.item_count, 0) AS item_count,
         COALESCE(ci.grand_total, 0) AS grand_total
       FROM challans c
       LEFT JOIN parties p ON p.id = c.customer_id
       LEFT JOIN warehouses w ON w.id = c.warehouse_id
       LEFT JOIN (
         SELECT challan_id,
                COUNT(*)::int AS item_count,
                COALESCE(SUM(amount),0) AS grand_total
         FROM challan_items
         GROUP BY challan_id
       ) ci ON ci.challan_id = c.id
       WHERE c.company_id = $1
         AND c.is_active = true
         AND c.warehouse_id = $2
       ORDER BY c.created_at DESC
       LIMIT $3
       OFFSET $4
    `;

    const params = [company_id, warehouseId, limit, offset];

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      data: {
        items: rows.map((row) => ({
          id: row.id,
          customerId: row.customer_id,
          warehouseId: row.warehouse_id,
          invoiceNo: row.challan_number,
          date: row.challan_date,
          partyName: row.party_name || '',
          warehouseName: row.warehouse_name || '',
          itemCount: row.item_count,
          grandTotal: Number(row.grand_total || 0),
          status: row.status || 'DISPATCHED',
          paymentMode: 'CREDIT',
        })),
        total: countRows[0]?.total || 0,
        page,
        limit,
      },
    });
  } catch (error) {
    console.error('listChallans error:', error);

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};


//   const page = Math.max(1, parseInt(req.query.page, 10) || 1);
//   const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
//   const offset = (page - 1) * limit;

//   try {
//     // ✅ TEMP: removed company_id filter
//     const { rows: countRows } = await pool.query(
//       `SELECT COUNT(*)::int AS total
//        FROM challans
//        WHERE is_active = true`
//     );

//     const { rows } = await pool.query(
//       `SELECT
//          c.id,
//          c.challan_number,
//          c.challan_date,
//          c.status,
//          p.name AS party_name,
//          w.name AS warehouse_name,
//          COALESCE(ci.item_count, 0) AS item_count,
//          COALESCE(ci.grand_total, 0) AS grand_total
//        FROM challans c
//        LEFT JOIN parties p ON p.id = c.customer_id
//        LEFT JOIN warehouses w ON w.id = c.warehouse_id
//        LEFT JOIN (
//          SELECT challan_id,
//                 COUNT(*)::int AS item_count,
//                 0 AS grand_total  -- ✅ TEMP: avoid SUM error
//          FROM challan_items
//          GROUP BY challan_id
//        ) ci ON ci.challan_id = c.id
//        WHERE c.is_active = true
//        ORDER BY c.created_at DESC
//        LIMIT $1 OFFSET $2`,
//       [limit, offset]
//     );

//     const items = rows.map((row) => ({
//       id: row.id,
//       challanNo: row.challan_number,
//       date: row.challan_date,
//       partyName: row.party_name || "",
//       warehouseName: row.warehouse_name || "",
//       itemCount: row.item_count,
//       grandTotal: Number(row.grand_total || 0),
//       status: row.status || "SAVED",
//       paymentMode: "CREDIT",
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
//   } catch (error) {
//     console.error("listChallans error:", error);
//     return res.status(500).json({
//       success: false,
//       message: error.message, // 🔥 show real error
//     });
//   }
// };

export const createChallan = async (req, res) => {
  const { company_id, id: userId } = req.user;
  const { customerId, warehouseId, date, challanNo, vehicleNo, driverName, lrNo, items } = req.body;

  if (!customerId || !warehouseId || !date || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "customerId, warehouseId, date and items are required",
    });
  }

  const normalizedItems = items.map((item) => {
    const qty = toNumber(item.qty, 0);
    const rate = toNumber(item.rate, 0);
    const taxableAmount = toNumber(item.taxableAmount, Number((qty * rate).toFixed(2)));
    return {
      itemId: item.itemId,
      qty,
      unit: item.unit || "Pcs",
      rate,
      amount: Number((qty * rate).toFixed(2)),
      taxRate: toNumber(item.taxRate, 0),
      taxableAmount,
      cgst: toNumber(item.cgst, 0),
      sgst: toNumber(item.sgst, 0),
      igst: toNumber(item.igst, 0),
    };
  });

  const grandTotal = normalizedItems.reduce((sum, item) => sum + item.amount, 0);
  const challanId = randomUUID();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    let generatedChallanNo = challanNo;
    if (!generatedChallanNo) {
      generatedChallanNo = await generateDocumentNumber({
        client,
        company_id,
        doc_type: "DELIVERY_CHALLAN",
      });
    }

    // 1️⃣ Insert challan header FIRST
    await client.query(
      `INSERT INTO challans
        (id, company_id, customer_id, warehouse_id, challan_number, challan_date,
         vehicle_no, driver_name, lr_no, status, converted_to_invoice, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DISPATCHED',false,$10)`,
      [challanId, company_id, customerId, warehouseId, generatedChallanNo,
       date, vehicleNo || null, driverName || null, lrNo || null, userId]
    );

    // 2️⃣ Insert items with tax fields
    for (const item of normalizedItems) {
      await client.query(
        `INSERT INTO challan_items
          (id, challan_id, item_id, quantity, unit, rate, amount,
           tax_rate, taxable_amount, cgst, sgst, igst)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          randomUUID(), challanId, item.itemId, item.qty, item.unit, item.rate, item.amount,
          item.taxRate, item.taxableAmount, item.cgst, item.sgst, item.igst,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      data: {
        id: challanId,
        invoiceNo: generatedChallanNo,
        date,
        partyName: req.body.partyName || "",
        warehouseName: req.body.warehouseName || "",
        itemCount: normalizedItems.length,
        grandTotal: Number(grandTotal.toFixed(2)),
        status: "DISPATCHED",
        paymentMode: "CREDIT",
      },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("createChallan error:", error.message);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  } finally {
    client.release();
  }
};

export const getChallanById = async (req, res) => {
  const { company_id } = req.user;
  const { id } = req.params;

  try {
    const { rows: headerRows } = await pool.query(
      `SELECT
         c.id,
         c.customer_id,
         c.warehouse_id,
         c.challan_number,
         c.challan_date,
         c.status,
         c.vehicle_no,
         c.driver_name,
         c.lr_no,
         p.name AS party_name,
         p.billing_address,
         w.name AS warehouse_name
       FROM challans c
       LEFT JOIN parties p ON p.id = c.customer_id
       LEFT JOIN warehouses w ON w.id = c.warehouse_id
       WHERE c.id = $1 AND c.company_id = $2 AND c.is_active = true
       LIMIT 1`,
      [id, company_id]
    );

    if (!headerRows.length) {
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    const { rows: itemRows } = await pool.query(
      `SELECT
   ci.id, ci.item_id, ci.quantity, ci.unit, ci.rate, ci.amount,
   ci.tax_rate, ci.taxable_amount, ci.cgst, ci.sgst, ci.igst,
   i.name AS item_name
 FROM challan_items ci
       LEFT JOIN items i ON i.id = ci.item_id
       WHERE ci.challan_id = $1
       ORDER BY ci.created_at ASC`,
      [id]
    );

    const header = headerRows[0];
    const grandTotal = itemRows.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        id: header.id,
        customerId: header.customer_id,
        warehouseId: header.warehouse_id,
        invoiceNo: header.challan_number,
        date: header.challan_date,
        partyName: header.party_name || "",
        warehouseName: header.warehouse_name || "",
        itemCount: itemRows.length,
        grandTotal: Number(grandTotal.toFixed(2)),
        status: header.status || "DISPATCHED",
        paymentMode: "CREDIT",
        vehicleNo: header.vehicle_no || "",
        driverName: header.driver_name || "",
        lrNo: header.lr_no || "",
        billingAddress: header.billing_address || "",
        items: itemRows.map((item) => ({
          id: item.id,
          itemId: item.item_id,
          itemName: item.item_name || "",
          qty: Number(item.quantity || 0),
          unit: item.unit || "Pcs",
          rate: Number(item.rate || 0),
          amount: Number(item.amount || 0),
          taxRate: Number(item.tax_rate || 0),           // ✅
          taxableAmount: Number(item.taxable_amount || 0), // ✅
          cgst: Number(item.cgst || 0),                  // ✅
          sgst: Number(item.sgst || 0),                  // ✅
          igst: Number(item.igst || 0), 
        })),
      },
    });
  } catch (error) {
    console.error("getChallanById error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const convertChallanToInvoice = async (req, res) => {
  const { company_id } = req.user;
  const { id } = req.params;

  try {
    const { rows } = await pool.query(
      `UPDATE challans
       SET converted_to_invoice = true,
           status = 'CONVERTED',
           updated_at = NOW()
       WHERE id = $1 AND company_id = $2 AND is_active = true
       RETURNING id, challan_number, challan_date, status, customer_id, warehouse_id`,
      [id, company_id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Challan not found" });
    }

    const record = rows[0];
    return res.status(200).json({
      success: true,
      data: {
        id: record.id,
        invoiceNo: record.challan_number,
        date: record.challan_date,
        partyName: "",
        warehouseName: "",
        itemCount: 0,
        grandTotal: 0,
        status: record.status,
        paymentMode: "CREDIT",
      },
    });
  } catch (error) {
    console.error("convertChallanToInvoice error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const updateChallan = async (req, res) => {
  const { company_id, id: userId } = req.user;
  const { id } = req.params;

  const { customerId, warehouseId, date, vehicleNo, driverName, lrNo, items } = req.body;

  if (!id || !customerId || !warehouseId || !date || !Array.isArray(items)) {
    return res.status(400).json({
      success: false,
      message: "id, customerId, warehouseId, date and items are required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 🔹 Check if challan exists
    const existing = await client.query(
      `SELECT id FROM challans WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rows.length === 0) {
      throw new Error("Challan not found");
    }

    // 🔹 Update challan
    await client.query(
      `UPDATE challans SET
        customer_id = $1,
        warehouse_id = $2,
        challan_date = $3,
        vehicle_no = $4,
        driver_name = $5,
        lr_no = $6,
        updated_at = NOW()
       WHERE id = $7`,
      [customerId, warehouseId, date, vehicleNo || null, driverName || null, lrNo || null, id]
    );

    // 🔥 Delete old items
    await client.query(`DELETE FROM challan_items WHERE challan_id = $1`, [id]);

    // 🔹 Insert new items
    for (const item of items) {
      const qty = Number(item.qty || 0);
      const rate = Number(item.rate || 0);
      const amount = Number((qty * rate).toFixed(2));

      // In updateChallan, fix the INSERT to also include tax fields
await client.query(
  `INSERT INTO challan_items
    (id, challan_id, item_id, quantity, unit, rate, amount,
     tax_rate, taxable_amount, cgst, sgst, igst)
   VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
  [
    randomUUID(), id, item.itemId, qty, item.unit || "Pcs", rate, amount,
    toNumber(item.taxRate, 0), toNumber(item.taxableAmount, amount),
    toNumber(item.cgst, 0), toNumber(item.sgst, 0), toNumber(item.igst, 0),
  ]
);
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Challan updated successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("updateChallan error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    client.release();
  }
};

export const deleteChallan = async (req, res) => {
  const { company_id } = req.user;
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "Challan id is required",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `DELETE FROM challans
       WHERE id = $1 AND company_id = $2
       RETURNING id`,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      throw new Error("Challan not found");
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Challan deleted successfully",
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("deleteChallan error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  } finally {
    client.release();
  }
};