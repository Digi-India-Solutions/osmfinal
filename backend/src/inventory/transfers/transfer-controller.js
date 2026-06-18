import pool from "../../pool.js";
import { randomUUID } from "crypto";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
const generateTransferNumber = async (client, company_id) => {
  await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, current_value)
     VALUES ($1, 'TRF', 0)
     ON CONFLICT (company_id, doc_type) DO NOTHING`,
    [company_id]
  );

  const { rows } = await client.query(
    `UPDATE document_sequences
     SET current_value = current_value + 1
     WHERE company_id = $1 AND doc_type = 'TRF'
     RETURNING current_value`,
    [company_id]
  );

  const year = new Date().getFullYear();
  return `TRF-${year}-${String(rows[0].current_value).padStart(4, "0")}`;
};

const getValidItems = (items = []) =>
  items.filter((i) => i.itemId && Number(i.quantity) > 0);

const formatTransfer = (t) => ({
  id:              t.id,
  companyId:       t.company_id,
  transferNumber:  t.transfer_number,
  fromWarehouseId: t.from_warehouse_id,
  fromWarehouse:   t.from_warehouse_name || null,
  toWarehouseId:   t.to_warehouse_id,
  toWarehouse:     t.to_warehouse_name || null,
  transferDate:    t.transfer_date,
  status:          t.status,
  notes:           t.notes,
  createdBy:       t.created_by,
  createdByName:   t.created_by_name || null,
  approvedBy:      t.approved_by,
  approvedAt:      t.approved_at,
  createdAt:       t.created_at,
});

const formatItem = (i) => ({
  id:       i.id,
  itemId:   i.item_id,
  itemName: i.item_name || null,
  itemCode: i.item_code || null,
  quantity: parseFloat(i.quantity),
});

// ─────────────────────────────────────────────
// CREATE TRANSFER
// ─────────────────────────────────────────────
export const createTransfer = async (req, res) => {
  const company_id = req.user.company_id;

  const { fromWarehouseId, toWarehouseId, transferDate, notes, items } = req.body;

  if (!fromWarehouseId || !toWarehouseId)
    return res.status(400).json({ success: false, message: "From and To warehouse are required" });

  if (fromWarehouseId === toWarehouseId)
    return res.status(400).json({ success: false, message: "From and To warehouse cannot be the same" });

  const validItems = getValidItems(items);
  if (validItems.length === 0)
    return res.status(400).json({ success: false, message: "Add at least one valid item" });

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: whRows } = await client.query(
      `SELECT id FROM warehouses WHERE id = ANY($1) AND company_id = $2`,
      [[fromWarehouseId, toWarehouseId], company_id]
    );

    if (whRows.length < 2) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "One or both warehouses not found" });
    }

    // Lock stock rows
    for (const item of validItems) {
      const { rows: stockRows } = await client.query(
        `SELECT quantity FROM warehouse_stock
         WHERE company_id = $1 AND warehouse_id = $2 AND item_id = $3
         FOR UPDATE`,
        [company_id, fromWarehouseId, item.itemId]
      );

      const available = stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;

      if (available < Number(item.quantity)) {
        const { rows: itemRows } = await client.query(
          `SELECT name FROM items WHERE id = $1 AND company_id = $2`,
          [item.itemId, company_id]
        );
        const itemName = itemRows[0]?.name || item.itemId;

        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${itemName}". Available: ${available}, Requested: ${item.quantity}`,
        });
      }
    }

    const transfer_number = await generateTransferNumber(client, company_id);

    const { rows: transferRows } = await client.query(
      `INSERT INTO stock_transfers
       (company_id, from_warehouse_id, to_warehouse_id, transfer_number, transfer_date, status, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,'PENDING',$6,$7)
       RETURNING *`,
      [
        company_id,
        fromWarehouseId,
        toWarehouseId,
        transfer_number,
        transferDate || new Date(),
        notes || null,
        req.user.id,
      ]
    );

    const transfer = transferRows[0];

    for (const item of validItems) {
      await client.query(
        `INSERT INTO stock_transfer_items (transfer_id, item_id, quantity)
         VALUES ($1,$2,$3)`,
        [transfer.id, item.itemId, Number(item.quantity)]
      );
    }

    const { rows: transferViewRows } = await client.query(
      `SELECT
        t.*,
        fw.name AS from_warehouse_name,
        tw.name AS to_warehouse_name,
        COUNT(ti.id) AS item_count,
        COALESCE(SUM(ti.quantity), 0) AS total_qty
      FROM stock_transfers t
      LEFT JOIN warehouses fw ON t.from_warehouse_id = fw.id
      LEFT JOIN warehouses tw ON t.to_warehouse_id = tw.id
      LEFT JOIN stock_transfer_items ti ON t.id = ti.transfer_id
      WHERE t.id = $1
      GROUP BY t.id, fw.name, tw.name`,
      [transfer.id]
    );

    await client.query("COMMIT");

    const createdTransfer = transferViewRows[0] || transfer;

    return res.status(201).json({
      success: true,
      message: `${transfer_number} created — pending approval`,
      data: {
        ...formatTransfer(createdTransfer),
        itemCount: Number(createdTransfer.item_count ?? validItems.length),
        totalQty: Number(createdTransfer.total_qty ?? validItems.reduce((sum, it) => sum + Number(it.quantity), 0)),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Transfer Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// APPROVE TRANSFER
// ─────────────────────────────────────────────
export const approveTransfer = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: transferRows } = await client.query(
      `SELECT * FROM stock_transfers
       WHERE id = $1 AND company_id = $2
       FOR UPDATE`,
      [id, company_id]
    );

    if (transferRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Transfer not found" });
    }

    const transfer = transferRows[0];

    if (transfer.status !== "PENDING") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `Transfer already ${transfer.status}`,
      });
    }

    const { rows: items } = await client.query(
      `SELECT * FROM stock_transfer_items WHERE transfer_id = $1`,
      [id]
    );

    for (const item of items) {
      const { rows: stockRows } = await client.query(
        `SELECT quantity FROM warehouse_stock
         WHERE company_id = $1 AND warehouse_id = $2 AND item_id = $3
         FOR UPDATE`,
        [company_id, transfer.from_warehouse_id, item.item_id]
      );

      const available = stockRows.length > 0 ? Number(stockRows[0].quantity) : 0;

      if (available < Number(item.quantity)) {
        const { rows: itemRows } = await client.query(
          `SELECT name FROM items WHERE id = $1`,
          [item.item_id]
        );
        const itemName = itemRows[0]?.name || item.item_id;

        throw new Error(`Insufficient stock for "${itemName}"`);
      }
    }

    for (const item of items) {
      const qty = Number(item.quantity);

      const updateResult = await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2
         AND warehouse_id = $3
         AND item_id = $4
         AND quantity >= $1
         RETURNING quantity`,
        [qty, company_id, transfer.from_warehouse_id, item.item_id]
      );

      if (updateResult.rows.length === 0) {
        throw new Error("Stock changed, please retry");
      }

      await client.query(
        `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (company_id, warehouse_id, item_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
        [randomUUID(), company_id, transfer.to_warehouse_id, item.item_id, qty]
      );

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
        item.item_id,
        transfer.from_warehouse_id,
        company_id,
        "TRANSFER_OUT",
        qty,
        id,
        "TRANSFER",
        req.user.id,
        "Transfer out"
      ]
    );
    await client.query(
      `SELECT record_stock_movement(
        $1::UUID,$2::UUID,$3::UUID,$4::TEXT,$5::NUMERIC,$6::UUID,$7::TEXT,$8::UUID,$9::TEXT
      )`,
      [
        item.item_id,
        transfer.to_warehouse_id,
        company_id,
        "TRANSFER_IN",
        qty,
        id,
        "TRANSFER",
        req.user.id,
        "Transfer in"
      ]
    );

    }

    const { rows: updatedRows } = await client.query(
      `UPDATE stock_transfers
       SET status='APPROVED', approved_by=$1, approved_at=NOW()
       WHERE id=$2 RETURNING *`,
      [req.user.id, id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${transfer.transfer_number} approved`,
      data: formatTransfer(updatedRows[0]),
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Approve Transfer Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};


// ─────────────────────────────────────────────
// GET ALL TRANSFERS
// ─────────────────────────────────────────────
export const getAllTransfers = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      search           = "",
      status           = "",
      from_warehouse_id = "",
      to_warehouse_id   = "",
      from_date        = "",
      to_date          = "",
    } = req.query;

    let query = `
      SELECT
        t.*,
        fw.name                  AS from_warehouse_name,
        tw.name                  AS to_warehouse_name,
        cu.name                  AS created_by_name,
        COUNT(ti.id)             AS item_count,
        COALESCE(SUM(ti.quantity), 0) AS total_qty
      FROM stock_transfers t
     LEFT JOIN warehouses fw ON t.from_warehouse_id = fw.id
     LEFT JOIN warehouses tw ON t.to_warehouse_id   = tw.id
     LEFT JOIN users cu ON t.created_by = cu.id
      LEFT JOIN stock_transfer_items ti ON t.id = ti.transfer_id
      WHERE t.company_id = $1
    `;

    const values = [company_id];
    let index = 2;

    if (search) {
      query += ` AND t.transfer_number ILIKE $${index}`;
      values.push(`%${search}%`);
      index++;
    }

    if (status && status !== "ALL") {
      query += ` AND t.status = $${index}`;
      values.push(status.toUpperCase());
      index++;
    }

    if (from_warehouse_id) {
      query += ` AND t.from_warehouse_id = $${index}`;
      values.push(from_warehouse_id);
      index++;
    }

    if (to_warehouse_id) {
      query += ` AND t.to_warehouse_id = $${index}`;
      values.push(to_warehouse_id);
      index++;
    }

    if (from_date) {
      query += ` AND t.transfer_date >= $${index}`;
      values.push(from_date);
      index++;
    }

    if (to_date) {
      query += ` AND t.transfer_date <= $${index}`;
      values.push(to_date);
      index++;
    }

    query += ` GROUP BY t.id, fw.name, tw.name, cu.name ORDER BY t.created_at DESC`;

    const { rows } = await pool.query(query, values);

    const formatted = rows.map((t) => ({
      ...formatTransfer(t),
      itemCount: Number(t.item_count),
      totalQty:  Number(t.total_qty),
    }));

    return res.status(200).json({
      success: true,
      count:   formatted.length,
      data:    formatted,
    });

  } catch (error) {
    console.error("Get All Transfers Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET TRANSFER BY ID
// ─────────────────────────────────────────────
export const getTransferById = async (req, res) => {
  try {
    const { id }     = req.params;
    const company_id = req.user.company_id;

    const { rows: transferRows } = await pool.query(
      `SELECT t.*,
              fw.name AS from_warehouse_name,
          tw.name AS to_warehouse_name,
          cu.name AS created_by_name
       FROM stock_transfers t
       LEFT JOIN warehouses fw ON t.from_warehouse_id = fw.id
       LEFT JOIN warehouses tw ON t.to_warehouse_id   = tw.id
        LEFT JOIN users cu ON t.created_by = cu.id
       WHERE t.id = $1 AND t.company_id = $2`,
      [id, company_id]
    );

    if (transferRows.length === 0)
      return res.status(404).json({ success: false, message: "Transfer not found" });

    const { rows: itemRows } = await pool.query(
      `SELECT ti.*, i.name AS item_name, i.code AS item_code
       FROM stock_transfer_items ti
       LEFT JOIN items i ON ti.item_id = i.id
       WHERE ti.transfer_id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...formatTransfer(transferRows[0]),
        items: itemRows.map(formatItem),
      },
    });

  } catch (error) {
    console.error("Get Transfer By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    const { fromWarehouseId, toWarehouseId, transferDate, notes, items } = req.body;

    if (!id) throw new Error("Transfer id required");

    // 🔹 Get transfer
    const { rows } = await client.query(
      `SELECT * FROM stock_transfers WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Transfer not found");

    const transfer = rows[0];

    // ❌ Only PENDING allowed
    if (transfer.status !== "PENDING") {
      throw new Error("Only pending transfers can be updated");
    }

    const validItems = getValidItems(items);

    if (validItems.length === 0) {
      throw new Error("Add at least one valid item");
    }

    // 🔥 Lock + validate stock
    for (const item of validItems) {
      const { rows: stockRows } = await client.query(
        `SELECT quantity FROM warehouse_stock
         WHERE company_id = $1 AND warehouse_id = $2 AND item_id = $3
         FOR UPDATE`,
        [company_id, fromWarehouseId, item.itemId]
      );

      const available = stockRows.length ? Number(stockRows[0].quantity) : 0;

      if (available < Number(item.quantity)) {
        throw new Error(`Insufficient stock for item ${item.itemId}`);
      }
    }

    // 🔹 Update header
    await client.query(
      `UPDATE stock_transfers
       SET from_warehouse_id = $1,
           to_warehouse_id = $2,
           transfer_date = $3,
           notes = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [
        fromWarehouseId,
        toWarehouseId,
        transferDate || new Date(),
        notes || null,
        id,
      ]
    );

    // 🔥 Replace items
    await client.query(
      `DELETE FROM stock_transfer_items WHERE transfer_id = $1`,
      [id]
    );

    for (const item of validItems) {
      await client.query(
        `INSERT INTO stock_transfer_items (transfer_id, item_id, quantity)
         VALUES ($1,$2,$3)`,
        [id, item.itemId, Number(item.quantity)]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Transfer updated successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateTransfer error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};

export const deleteTransfer = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!id) throw new Error("Transfer id required");

    // 🔹 Get transfer
    const { rows } = await client.query(
      `SELECT * FROM stock_transfers WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("Transfer not found");

    const transfer = rows[0];

    // ❌ Only PENDING allowed
    if (transfer.status !== "PENDING") {
      throw new Error("Only pending transfers can be deleted");
    }

    // 🔥 Delete transfer (items cascade)
    await client.query(
      `DELETE FROM stock_transfers WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Transfer deleted successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deleteTransfer error:", err);
    return res.status(500).json({
      success: false,
      message: err.message,
    });
  } finally {
    client.release();
  }
};