import pool from "../../pool.js";

import { asyncHandler } from "../../../utils/asyncHandler.js";
import { success, successList, error } from "../../../utils/respons.js";

import { randomUUID } from "crypto";

// HELPERS
const generateAdjustmentNumber = async (client, company_id) => {
  await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, current_value)
     VALUES ($1, 'ADJ', 0)
     ON CONFLICT (company_id, doc_type) DO NOTHING`,
    [company_id]
  );

  const { rows } = await client.query(
    `UPDATE document_sequences
     SET current_value = current_value + 1
     WHERE company_id = $1 AND doc_type = 'ADJ'
     RETURNING current_value`,
    [company_id]
  );

  const year = new Date().getFullYear();
  return `ADJ-${year}-${String(rows[0].current_value).padStart(4, "0")}`;
};

const formatAdjustment = (a) => ({
  id:               a.id,
  companyId:        a.company_id,
  adjustmentNumber: a.adjustment_number,
  warehouseId:      a.warehouse_id,
  warehouseName:    a.warehouse_name || null,
  itemId:           a.item_id,
  itemName:         a.item_name || null,
  itemCode:         a.item_code || null,
  adjustmentDate:   a.adjustment_date,
  type:             a.type,
  quantity:         parseFloat(a.quantity),
  reason:           a.reason,
  createdBy:        a.created_by,
  createdByName:    a.created_by_name || null,
  approvedBy:       a.approved_by || null,
  createdAt:        a.created_at,
});

// CREATE ADJUSTMENT
export const createAdjustment = async (req, res) => {
  const company_id = req.user.company_id;

  const {
    warehouseId,
    itemId,
    type,
    quantity,
    reason,
    adjustmentDate,
  } = req.body;

  if (!warehouseId)
    return res.status(400).json({ success: false, message: "Warehouse is required" });

  if (!itemId)
    return res.status(400).json({ success: false, message: "Item is required" });

  if (!type || !["INCREASE", "DECREASE"].includes(type))
    return res.status(400).json({ success: false, message: "Type must be INCREASE or DECREASE" });

  if (!quantity || Number(quantity) <= 0)
    return res.status(400).json({ success: false, message: "Quantity must be greater than 0" });

  if (!reason || !reason.trim())
    return res.status(400).json({ success: false, message: "Reason is required" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Validate warehouse
    const { rows: whRows } = await client.query(
      `SELECT id FROM warehouses WHERE id = $1 AND company_id = $2`,
      [warehouseId, company_id]
    );
    if (whRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Warehouse not found" });
    }

    // Validate item
    const { rows: itemRows } = await client.query(
      `SELECT id, name FROM items WHERE id = $1 AND company_id = $2`,
      [itemId, company_id]
    );
    if (itemRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Item not found" });
    }

    const qty = Number(quantity);

    // STOCK UPDATE (RACE SAFE)
    let updatedWarehouseQty = 0;
    if (type === "INCREASE") {
      const increased = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2
           AND warehouse_id = $3
           AND item_id = $4
         RETURNING quantity`,
        [qty, company_id, warehouseId, itemId]
      );

      if (increased.rows.length === 0) {
        const inserted = await client.query(
          `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
           VALUES ($1,$2,$3,$4,$5)
           RETURNING quantity`,
          [randomUUID(), company_id, warehouseId, itemId, qty]
        );
        updatedWarehouseQty = Number(inserted.rows[0]?.quantity || 0);
      } else {
        updatedWarehouseQty = Number(increased.rows[0]?.quantity || 0);
      }
    } else {
      const result = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2
         AND warehouse_id = $3
         AND item_id = $4
         AND quantity >= $1
         RETURNING quantity`,
        [qty, company_id, warehouseId, itemId]
      );

      if (result.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Insufficient stock or stock changed, please retry",
        });
      }

      updatedWarehouseQty = Number(result.rows[0]?.quantity || 0);
    }

    const { rows: totalRows } = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) AS total_stock
       FROM warehouse_stock
       WHERE company_id = $1 AND item_id = $2`,
      [company_id, itemId]
    );

    const updatedItemTotalStock = Number(totalRows[0]?.total_stock || 0);

    // Generate number
    const adjustment_number = await generateAdjustmentNumber(client, company_id);

    // Insert adjustment
    const { rows: adjRows } = await client.query(
      `INSERT INTO stock_adjustments
       (company_id, warehouse_id, item_id, adjustment_number,
        adjustment_date, type, quantity, reason, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        company_id,
        warehouseId,
        itemId,
        adjustment_number,
        adjustmentDate || new Date(),
        type,
        qty,
        reason.trim(),
        req.user.id,
      ]
    );

    const adjustment = adjRows[0];

    // Stock movement log should not block core stock adjustment transaction.
    try {
      await client.query(
        `SELECT record_stock_movement(
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::TEXT,
          $5::NUMERIC,
          $6::UUID,
          $7::TEXT,
          $8::UUID,
          $9::TEXT
        )`,
        [
          itemId,
          warehouseId,
          company_id,
          type === "INCREASE" ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          qty,
          adjustment.id,
          "ADJUSTMENT",
          req.user.id,
          reason.trim(),
        ]
      );
    } catch (movementError) {
      console.error("Adjustment movement log warning:", movementError?.message || movementError);
    }

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${adjustment_number} created successfully`,
      data: formatAdjustment({
        ...adjustment,
        warehouse_name: null,
        item_name: itemRows[0].name,
        item_code: null,
        created_by_name: req.user?.name || null,
      }),
      meta: {
        updatedWarehouseQty,
        updatedItemTotalStock,
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Adjustment Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to create adjustment",
    });
  } finally {
    client.release();
  }
};

// GET ALL
export const getAllAdjustments = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { search = "", type = "", warehouse_id = "", from_date = "", to_date = "" } = req.query;

    let query = `
      SELECT a.*, w.name AS warehouse_name, i.name AS item_name, i.code AS item_code, u.name AS created_by_name
      FROM stock_adjustments a
      LEFT JOIN warehouses w ON a.warehouse_id = w.id
      LEFT JOIN items i ON a.item_id = i.id
      LEFT JOIN users u ON a.created_by = u.id
      WHERE a.company_id = $1
    `;

    const values = [company_id];
    let index = 2;

    if (search) {
      query += ` AND (a.adjustment_number ILIKE $${index} OR i.name ILIKE $${index})`;
      values.push(`%${search}%`);
      index++;
    }

    if (type && type !== "ALL") {
      query += ` AND a.type = $${index}`;
      values.push(type.toUpperCase());
      index++;
    }

    if (warehouse_id) {
      query += ` AND a.warehouse_id = $${index}`;
      values.push(warehouse_id);
      index++;
    }

    if (from_date) {
      query += ` AND a.adjustment_date >= $${index}`;
      values.push(from_date);
      index++;
    }

    if (to_date) {
      query += ` AND a.adjustment_date <= $${index}`;
      values.push(to_date);
      index++;
    }

    query += ` ORDER BY a.created_at DESC`;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      count: rows.length,
      data: rows.map(formatAdjustment),
    });

  } catch (error) {
    console.error("Get All Adjustments Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// GET BY ID
export const getAdjustmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT a.*, w.name AS warehouse_name, i.name AS item_name, i.code AS item_code, u.name AS created_by_name
       FROM stock_adjustments a
       LEFT JOIN warehouses w ON a.warehouse_id = w.id
       LEFT JOIN items i ON a.item_id = i.id
       LEFT JOIN users u ON a.created_by = u.id
       WHERE a.id = $1 AND a.company_id = $2`,
      [id, company_id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Adjustment not found" });

    return res.status(200).json({
      success: true,
      data: formatAdjustment(rows[0]),
    });

  } catch (error) {
    console.error("Get Adjustment By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// STATS
export const getAdjustmentStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE type='INCREASE') AS total_increases,
        COUNT(*) FILTER (WHERE type='DECREASE') AS total_decreases,
        COALESCE(SUM(quantity) FILTER (WHERE type='INCREASE'),0) AS qty_increased,
        COALESCE(SUM(quantity) FILTER (WHERE type='DECREASE'),0) AS qty_decreased,
        COUNT(*) FILTER (WHERE adjustment_date >= date_trunc('month', CURRENT_DATE)) AS this_month
       FROM stock_adjustments
       WHERE company_id = $1`,
      [company_id]
    );

    const s = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        total: Number(s.total),
        totalIncreases: Number(s.total_increases),
        totalDecreases: Number(s.total_decreases),
        qtyIncreased: Number(s.qty_increased),
        qtyDecreased: Number(s.qty_decreased),
        thisMonth: Number(s.this_month),
      },
    });

  } catch (error) {
    console.error("Adjustment Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const updateAdjustment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    const {
      warehouseId,
      itemId,
      type,
      quantity,
      reason,
      adjustmentDate,
    } = req.body;

    if (!id) throw new Error("Adjustment id required");

    const qty = Number(quantity);

    // 🔹 Get existing adjustment
    const { rows } = await client.query(
      `SELECT * FROM stock_adjustments WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Adjustment not found");

    const old = rows[0];

    // 🔥 Reverse OLD adjustment
    if (old.type === "INCREASE") {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [old.quantity, company_id, old.warehouse_id, old.item_id]
      );
    } else {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [old.quantity, company_id, old.warehouse_id, old.item_id]
      );
    }

    // 🔥 Apply NEW adjustment
    if (type === "INCREASE") {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [qty, company_id, warehouseId, itemId]
      );
    } else {
      const result = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4
         AND quantity >= $1`,
        [qty, company_id, warehouseId, itemId]
      );

      if (result.rowCount === 0) {
        throw new Error("Insufficient stock for update");
      }
    }

    // 🔹 Update adjustment record
    await client.query(
      `UPDATE stock_adjustments
       SET warehouse_id = $1,
           item_id = $2,
           type = $3,
           quantity = $4,
           reason = $5,
           adjustment_date = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [
        warehouseId,
        itemId,
        type,
        qty,
        reason,
        adjustmentDate || new Date(),
        id,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Adjustment updated successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateAdjustment error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};

export const deleteAdjustment = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!id) throw new Error("Adjustment id required");

    // 🔹 Get adjustment
    const { rows } = await client.query(
      `SELECT * FROM stock_adjustments WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Adjustment not found");

    const adjustment = rows[0];

    // 🔥 Reverse stock
    if (adjustment.type === "INCREASE") {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [adjustment.quantity, company_id, adjustment.warehouse_id, adjustment.item_id]
      );
    } else {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity + $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [adjustment.quantity, company_id, adjustment.warehouse_id, adjustment.item_id]
      );
    }

    // 🔥 Delete adjustment
    await client.query(
      `DELETE FROM stock_adjustments WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Adjustment deleted successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deleteAdjustment error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};