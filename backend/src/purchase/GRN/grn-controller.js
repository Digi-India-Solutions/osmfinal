import { randomUUID } from "crypto";
import pool from "../../pool.js";

// ─────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────
const VALID_STATUSES = ["CONFIRMED", "INVOICED"];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const generateGRNNumber = async (client, company_id) => {
  await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, current_value)
     VALUES ($1, 'GRN', 0)
     ON CONFLICT (company_id, doc_type) DO NOTHING`,
    [company_id]
  );

  const { rows: seqRows } = await client.query(
    `UPDATE document_sequences
     SET current_value = current_value + 1
     WHERE company_id = $1 AND doc_type = 'GRN'
     RETURNING current_value`,
    [company_id]
  );

  const year = new Date().getFullYear();
  return `GRN-${year}-${String(seqRows[0].current_value).padStart(4, "0")}`;
};

const getValidItems = (items = []) =>
  items.filter(
    (i) => (i.itemId || i.itemName) && Number(i.quantity ?? i.qty) > 0
  );

const isUUID = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value));

const resolvePurchaseOrder = async (client, company_id, item) => {
  if (item.poId) {
    return { poId: item.poId, poNumber: item.poNumber || null };
  }

  if (item.poNumber) {
    const { rows } = await client.query(
      `SELECT id, po_number
       FROM purchase_orders
       WHERE company_id = $1 AND po_number = $2`,
      [company_id, item.poNumber]
    );

    if (rows.length > 0) {
      return { poId: rows[0].id, poNumber: rows[0].po_number };
    }
  }

  return { poId: null, poNumber: item.poNumber || null };
};

const insertGRNItems = async (client, company_id, grnId, items) => {
  const inserted = [];

  for (const item of items) {
    const po = await resolvePurchaseOrder(client, company_id, item);
    const quantity = Number(item.quantity ?? item.qty);

    const { rows } = await client.query(
      `INSERT INTO grn_items
        (grn_id, item_id, po_id, po_number,
         hsn_code, quantity, unit_name, rate,
         barcode, company_barcode)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        grnId,
        item.itemId         || null,
        po.poId             || null,
        po.poNumber         || null,
        item.hsnCode        || null,
        quantity,
        item.unitName       || null,
        Number(item.rate)   || 0,
        item.barcode        || null,
        item.companyBarcode || null,
      ]
    );
    inserted.push(rows[0]);
  }

  return inserted;
};

// FIX #2: Insert PURCHASE_IN stock_movements records
const insertStockMovements = async (client, company_id, warehouseId, grnId, grnNumber, items, userId) => {
  for (const item of items) {
    if (!item.item_id) continue;

    await client.query(
      `INSERT INTO stock_movements
        (id, company_id, warehouse_id, item_id, movement_type,
         quantity, reference_type, reference_id,
         created_by, notes)
       VALUES ($1, $2, $3, $4, 'PURCHASE_IN', $5, 'GRN', $6,
               $7, $8)`,
      [
        randomUUID(),
        company_id,
        warehouseId,
        item.item_id,
        Number(item.quantity),
        grnId,
        userId,
        `GRN ${grnNumber}`,
      ]
    );
  }
};

const updatePOReceivedQty = async (client, items) => {
  const poIds = new Set();

  for (const item of items) {
    if (!item.po_id || !item.item_id) continue;

    await client.query(
      `UPDATE purchase_order_items
       SET received_qty = received_qty + $1
       WHERE po_id = $2 AND item_id = $3`,
      [Number(item.quantity), item.po_id, item.item_id]
    );

    poIds.add(item.po_id);
  }

  for (const poId of poIds) {
    await client.query(
      `UPDATE purchase_orders
       SET
         status = CASE
           WHEN (
             SELECT COALESCE(SUM(pending_qty), 0)
             FROM purchase_order_items
             WHERE po_id = $1
           ) <= 0 THEN 'COMPLETED'
           ELSE 'PARTIAL'
         END,
         updated_at = NOW()
       WHERE id = $1
         AND status NOT IN ('CANCELLED', 'COMPLETED')`,
      [poId]
    );
  }
};

const formatGRN = (grn) => ({
  id:            grn.id,
  grnNumber:     grn.grn_number,
  companyId:     grn.company_id,
  warehouseId:   grn.warehouse_id,
  warehouseName: grn.warehouse_name || null,
  supplierId:    grn.supplier_id,
  supplierName:  grn.supplier_name  || null,
  date:          grn.date,
  status:        grn.status,
  totalQty:      parseFloat(grn.total_qty)   || 0,
  totalValue:    parseFloat(grn.total_value) || 0,
  createdBy:     grn.created_by_name || grn.created_by,
  createdByName: grn.created_by_name || null,
  createdAt:     grn.created_at,
});

const formatGRNItem = (i) => ({
  id:             i.id,
  grnId:          i.grn_id,
  itemId:         i.item_id,
  itemName:       i.item_name   || null,
  poId:           i.po_id,
  poNumber:       i.po_number,
  hsnCode:        i.hsn_code,
  quantity:       parseFloat(i.quantity),
  unitName:       i.unit_name,
  rate:           parseFloat(i.rate),
  total:          parseFloat(i.total),
  barcode:        i.barcode,
  companyBarcode: i.company_barcode,
});

// ─────────────────────────────────────────────
// CREATE GRN
// ─────────────────────────────────────────────
export const createGRN = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;

    const { warehouseId, supplierId, date, items } = req.body;

    // ── Validation ──
    // FIX #1: All early returns now call ROLLBACK before responding
    if (!warehouseId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Warehouse is required" });
    }

    const validItems = getValidItems(items);

    if (validItems.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Add at least one valid item" });
    }

    for (const item of validItems) {
      if (!item.itemId) continue;

      if (!isUUID(item.itemId)) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Invalid itemId format: ${item.itemId}`,
        });
      }

      const { rowCount } = await client.query(
        "SELECT 1 FROM items WHERE id = $1 AND company_id = $2",
        [item.itemId, company_id]
      );

      if (rowCount === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `Item not found: ${item.itemId}`,
        });
      }
    }

    // FIX #3: All existence checks now include company_id to prevent cross-tenant data leaks
    const { rows: whRows } = await client.query(
      "SELECT id, name FROM warehouses WHERE id = $1 AND company_id = $2",
      [warehouseId, company_id]
    );
    if (whRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Warehouse not found" });
    }

    if (supplierId) {
      const { rows: supplierRows } = await client.query(
        "SELECT id FROM parties WHERE id = $1 AND company_id = $2",
        [supplierId, company_id]
      );
      if (supplierRows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Supplier not found" });
      }
    }

    const grn_number = await generateGRNNumber(client, company_id);

    const { rows: grnRows } = await client.query(
      `INSERT INTO grns
        (company_id, warehouse_id, supplier_id,
         grn_number, date, created_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       RETURNING *`,
      [
        company_id,
        warehouseId,
        supplierId || null,
        grn_number,
        date       || new Date(),
        req.user.id,
      ]
    );

    const grn = grnRows[0];

    const { rows: creatorRows } = await client.query(
      `SELECT name FROM users WHERE id = $1 LIMIT 1`,
      [req.user.id]
    );
    const created_by_name = creatorRows[0]?.name || null;

    const insertedItems = await insertGRNItems(client, company_id, grn.id, validItems);

    await updatePOReceivedQty(client, insertedItems);

    const totalQty   = insertedItems.reduce((sum, i) => sum + Number(i.quantity), 0);
    const totalValue = insertedItems.reduce((sum, i) => sum + (Number(i.quantity) * Number(i.rate)), 0);

    await client.query(
      "UPDATE grns SET total_qty = $1, total_value = $2 WHERE id = $3",
      [totalQty, totalValue, grn.id]
    );

    for (const item of insertedItems) {
      if (!item.item_id) continue;

      await client.query(
        `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (company_id, warehouse_id, item_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
        [randomUUID(), company_id, warehouseId, item.item_id, Number(item.quantity)]
      );
    }

    // FIX #2: Insert PURCHASE_IN stock_movement rows for every item received
    await insertStockMovements(
      client, company_id, warehouseId,
      grn.id, grn_number, insertedItems, req.user.id
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${grn_number} created successfully`,
      data: {
        ...formatGRN({ ...grn, total_qty: totalQty, total_value: totalValue, created_by_name }),
        items: insertedItems.map(formatGRNItem),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create GRN Error:", error);

    if (error?.code === "23503") {
      return res.status(400).json({
        success: false,
        message: error.detail || "Invalid reference in GRN payload",
      });
    }

    if (error?.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Invalid UUID value in GRN payload",
      });
    }

    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────
// GET ALL GRNs
// ─────────────────────────────────────────────
export const getAllGRNs = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      search       = "",
      status       = "",
      supplier_id  = "",
      warehouse_id = "",
      from_date    = "",
      to_date      = "",
    } = req.query;

    let query = `
      SELECT
        g.*,
        w.name                                              AS warehouse_name,
        p.name                                              AS supplier_name,
        u.name                                              AS created_by_name,
        COUNT(gi.id)                                        AS item_count,
        COALESCE(SUM(gi.quantity), 0)                       AS total_items_qty,
        COUNT(gi.id) FILTER (WHERE gi.po_id IS NULL)        AS unmatched_count,
        COUNT(gi.id) FILTER (WHERE gi.po_id IS NOT NULL)    AS po_linked_count

      FROM grns g
      LEFT JOIN warehouses w  ON g.warehouse_id = w.id AND w.company_id = $1
      LEFT JOIN parties    p  ON g.supplier_id  = p.id AND p.company_id = $1
      LEFT JOIN users      u  ON g.created_by   = u.id AND u.company_id = $1
      LEFT JOIN grn_items  gi ON g.id           = gi.grn_id
      WHERE g.company_id = $1
    `;

    // FIX #3: company_id is already enforced in WHERE g.company_id = $1 above.
    // Joins also scoped to same company_id to avoid cross-tenant name leakage.
    const values = [company_id];
    let index = 2;

    if (search) {
      query += ` AND (g.grn_number ILIKE $${index} OR p.name ILIKE $${index})`;
      values.push(`%${search}%`);
      index++;
    }

    if (status && status !== "ALL") {
      query += ` AND g.status = $${index}`;
      values.push(status.toUpperCase());
      index++;
    }

    if (supplier_id) {
      query += ` AND g.supplier_id = $${index}`;
      values.push(supplier_id);
      index++;
    }

    if (warehouse_id) {
      query += ` AND g.warehouse_id = $${index}`;
      values.push(warehouse_id);
      index++;
    }

    if (from_date) {
      query += ` AND g.date >= $${index}`;
      values.push(from_date);
      index++;
    }

    if (to_date) {
      query += ` AND g.date <= $${index}`;
      values.push(to_date);
      index++;
    }

    query += ` GROUP BY g.id, w.name, p.name, u.name ORDER BY g.created_at DESC`;

    const { rows } = await pool.query(query, values);

    const formatted = rows.map((grn) => ({
      ...formatGRN(grn),
      itemCount:      Number(grn.item_count),
      totalItemsQty:  Number(grn.total_items_qty),
      unmatchedCount: Number(grn.unmatched_count),
      poLinkedCount:  Number(grn.po_linked_count),
    }));

    return res.status(200).json({
      success: true,
      count:   formatted.length,
      data:    formatted,
    });

  } catch (error) {
    console.error("Get All GRNs Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// GET GRN BY ID
// ─────────────────────────────────────────────
export const getGRNById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // FIX #3: Scope lookup to company_id to prevent cross-tenant GRN access
    const { rows: grnRows } = await pool.query(
      `SELECT g.*, w.name AS warehouse_name, p.name AS supplier_name, u.name AS created_by_name
       FROM grns g
       LEFT JOIN warehouses w ON g.warehouse_id = w.id AND w.company_id = $2
       LEFT JOIN parties    p ON g.supplier_id  = p.id AND p.company_id = $2
       LEFT JOIN users      u ON g.created_by   = u.id AND u.company_id = $2
       WHERE g.id = $1 AND g.company_id = $2`,
      [id, company_id]
    );

    if (grnRows.length === 0)
      return res.status(404).json({ success: false, message: "GRN not found" });

    const { rows: itemRows } = await pool.query(
      `SELECT gi.*, i.name AS item_name
       FROM grn_items gi
       LEFT JOIN items i ON gi.item_id = i.id AND i.company_id = $2
       WHERE gi.grn_id = $1
       ORDER BY gi.id`,
      [id, company_id]
    );

    return res.status(200).json({
      success: true,
      data: {
        ...formatGRN(grnRows[0]),
        items: itemRows.map(formatGRNItem),
      },
    });

  } catch (error) {
    console.error("Get GRN By ID Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// GET GRNs BY SUPPLIER (for invoice creation)
// ─────────────────────────────────────────────
export const getGRNsBySupplier = async (req, res) => {
  try {
    const company_id      = req.user.company_id;
    const { supplier_id } = req.params;

    const { rows } = await pool.query(
      `SELECT g.*, w.name AS warehouse_name, p.name AS supplier_name
       FROM grns g
       LEFT JOIN warehouses w ON g.warehouse_id = w.id AND w.company_id = $1
       LEFT JOIN parties    p ON g.supplier_id  = p.id AND p.company_id = $1
       WHERE g.company_id  = $1
         AND g.supplier_id = $2
         AND g.status      = 'CONFIRMED'
       ORDER BY g.date DESC`,
      [company_id, supplier_id]
    );

    const grnIds = rows.map((g) => g.id);

    let itemsByGRN = {};
    if (grnIds.length > 0) {
      const { rows: allItems } = await pool.query(
        `SELECT gi.*, i.name AS item_name
         FROM grn_items gi
         LEFT JOIN items i ON gi.item_id = i.id AND i.company_id = $2
         WHERE gi.grn_id = ANY($1)`,
        [grnIds, company_id]
      );
      allItems.forEach((item) => {
        if (!itemsByGRN[item.grn_id]) itemsByGRN[item.grn_id] = [];
        itemsByGRN[item.grn_id].push(formatGRNItem(item));
      });
    }

    const formatted = rows.map((grn) => ({
      ...formatGRN(grn),
      items: itemsByGRN[grn.id] || [],
    }));

    return res.status(200).json({
      success: true,
      count:   formatted.length,
      data:    formatted,
    });

  } catch (error) {
    console.error("Get GRNs By Supplier Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─────────────────────────────────────────────
// GET GRN STATS
// ─────────────────────────────────────────────
export const getGRNStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
        COUNT(DISTINCT g.id)                                          AS total,
        COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'CONFIRMED')   AS confirmed,
        COUNT(DISTINCT g.id) FILTER (WHERE g.status = 'INVOICED')    AS invoiced,
        COUNT(DISTINCT g.id) FILTER (
          WHERE g.date >= date_trunc('month', CURRENT_DATE)
        )                                                             AS this_month,
        COALESCE(SUM(gi.quantity), 0)                                 AS total_items_qty,
        COUNT(gi.id) FILTER (WHERE gi.po_id IS NULL)                  AS unmatched_count

       FROM grns g
       LEFT JOIN grn_items gi ON gi.grn_id = g.id
       WHERE g.company_id = $1`,
      [company_id]
    );

    const stats = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        total:          Number(stats.total),
        confirmed:      Number(stats.confirmed),
        invoiced:       Number(stats.invoiced),
        thisMonth:      Number(stats.this_month),
        totalItemsQty:  Number(stats.total_items_qty),
        unmatchedCount: Number(stats.unmatched_count),
      },
    });

  } catch (error) {
    console.error("GRN Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─────────────────────────────────────────────
// DELETE GRN
// ─────────────────────────────────────────────
export const deleteGRN = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { id }     = req.params;
    const company_id = req.user.company_id;

    // FIX #3: company_id guard prevents deleting another tenant's GRN
    const { rows: grnRows } = await client.query(
      "SELECT * FROM grns WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (grnRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "GRN not found" });
    }

    const grn = grnRows[0];

    if (grn.status === "INVOICED") {
      await client.query("ROLLBACK");
      return res.status(409).json({
        success: false,
        message: `${grn.grn_number} cannot be deleted — it is already linked to an invoice`,
      });
    }

    const { rows: itemRows } = await client.query(
      "SELECT * FROM grn_items WHERE grn_id = $1",
      [id]
    );

    const resolvedItems = [];
    for (const item of itemRows) {
      if (item.po_id || !item.po_number) {
        resolvedItems.push(item);
        continue;
      }

      const { rows: poRows } = await client.query(
        `SELECT id
         FROM purchase_orders
         WHERE company_id = $1 AND po_number = $2`,
        [company_id, item.po_number]
      );

      resolvedItems.push({
        ...item,
        po_id: poRows[0]?.id || null,
      });
    }

    // Reverse warehouse_stock
    for (const item of resolvedItems) {
      if (!item.item_id) continue;

      await client.query(
        `UPDATE warehouse_stock
         SET quantity = GREATEST(0, quantity - $1)
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [Number(item.quantity), company_id, grn.warehouse_id, item.item_id]
      );
    }

    // Reverse PO received_qty
    const poIds = new Set();
    for (const item of resolvedItems) {
      if (!item.po_id || !item.item_id) continue;

      await client.query(
        `UPDATE purchase_order_items
         SET received_qty = GREATEST(0, received_qty - $1)
         WHERE po_id = $2 AND item_id = $3`,
        [Number(item.quantity), item.po_id, item.item_id]
      );

      poIds.add(item.po_id);
    }

    // Recalculate PO status
    for (const poId of poIds) {
      await client.query(
        `UPDATE purchase_orders
         SET
           status = CASE
             WHEN (
               SELECT COALESCE(SUM(received_qty), 0)
               FROM purchase_order_items
               WHERE po_id = $1
             ) = 0 THEN 'PENDING'
             ELSE 'PARTIAL'
           END,
           updated_at = NOW()
         WHERE id = $1 AND status NOT IN ('CANCELLED')`,
        [poId]
      );
    }

    // FIX #4: Delete PURCHASE_IN stock_movements tied to this GRN before deleting the GRN
    await client.query(
      `DELETE FROM stock_movements
       WHERE reference_type = 'GRN'
         AND reference_id   = $1
         AND company_id     = $2`,
      [id, company_id]
    );

    // Delete GRN (grn_items cascade)
    await client.query("DELETE FROM grns WHERE id = $1", [id]);

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${grn.grn_number} deleted successfully`,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete GRN Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};


export const updateGRN = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;
    const { warehouseId, supplierId, date, items } = req.body;

    if (!id || !warehouseId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "GRN id & warehouse required" });
    }

    // 🔹 Get existing GRN
    const { rows: grnRows } = await client.query(
      `SELECT * FROM grns WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!grnRows.length) throw new Error("GRN not found");

    const grn = grnRows[0];

    // 🔥 Get old items
    const { rows: oldItems } = await client.query(
      `SELECT * FROM grn_items WHERE grn_id = $1`,
      [id]
    );

    // 🔥 Reverse stock
    for (const item of oldItems) {
      await client.query(
        `UPDATE warehouse_stock
         SET quantity = quantity - $1
         WHERE company_id = $2 AND warehouse_id = $3 AND item_id = $4`,
        [item.quantity, company_id, grn.warehouse_id, item.item_id]
      );
    }

    // 🔥 Reverse PO received qty
    for (const item of oldItems) {
      if (item.po_id) {
        await client.query(
          `UPDATE purchase_order_items
           SET received_qty = received_qty - $1
           WHERE po_id = $2 AND item_id = $3`,
          [item.quantity, item.po_id, item.item_id]
        );
      }
    }

    // 🔥 Delete old items
    await client.query(`DELETE FROM grn_items WHERE grn_id = $1`, [id]);

    // 🔹 Insert new items
    const insertedItems = await insertGRNItems(client, company_id, id, items);

    // 🔹 Apply PO received qty again
    await updatePOReceivedQty(client, insertedItems);

    // 🔹 Calculate totals
    const totalQty = insertedItems.reduce((s, i) => s + Number(i.quantity), 0);
    const totalValue = insertedItems.reduce((s, i) => s + (i.quantity * i.rate), 0);

    // 🔹 Update GRN
    await client.query(
      `UPDATE grns
       SET warehouse_id = $1,
           supplier_id = $2,
           date = $3,
           total_qty = $4,
           total_value = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [warehouseId, supplierId || null, date || new Date(), totalQty, totalValue, id]
    );

    // 🔥 Apply stock again
    for (const item of insertedItems) {
      await client.query(
        `INSERT INTO warehouse_stock (id, company_id, warehouse_id, item_id, quantity)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (company_id, warehouse_id, item_id)
         DO UPDATE SET quantity = warehouse_stock.quantity + EXCLUDED.quantity`,
        [randomUUID(), company_id, warehouseId, item.item_id, item.quantity]
      );
    }

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "GRN updated successfully",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateGRN error:", err);
    return res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
};