import pool from "../../pool.js";

const VALID_STATUSES = ["PENDING", "PARTIAL", "COMPLETED", "CANCELLED"];
const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"];

const generatePONumber = async (client, company_id) => {
  const { rows } = await client.query(
    "SELECT generate_po_number($1) AS po_number",
    [company_id]
  );
  return rows[0].po_number;
};

const getValidItems = (items = []) =>
  items.filter(
    (i) =>
      (i.itemId || i.itemName) &&   // ✔️ allow either
      Number(i.orderedQty) > 0 &&
      Number(i.rate) > 0
  );


const insertItems = async (client, poId, items) => {
  const inserted = [];

  for (const item of items) {
    const { rows } = await client.query(
      `INSERT INTO purchase_order_items
        (po_id, item_id, item_name, hsn_code,
         ordered_qty, received_qty,
         unit_name, rate, gst_rate,
        size_color, group_name, brand, article_no)
        
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        poId,
        item.itemId      || null,
        item.itemName    || null,
        item.hsnCode     || null,
        Number(item.orderedQty),
        Number(item.receivedQty) || 0,
        item.unit        || null,
        Number(item.rate),
        Number(item.gstRate)     || 0,
        item.size        || null,   // ← from frontend POItem
        item.group       || null,   // ← from frontend POItem
       item.brand       || null,   // ← from frontend POItem
        item.articleNo   || null,   // ← from frontend POItem
      ]
    );
    inserted.push(rows[0]);
  }

  return inserted;
};

const formatPO = (po) => ({
  id:               po.id,
  poNumber:         po.po_number,
  supplierId:       po.supplier_id,
  date:             po.po_date,
  expectedDelivery: po.expected_delivery,
  status:           po.status,
  priority:         po.priority,
  totalAmount:      parseFloat(po.total_amount) || 0,
  createdAt:        po.created_at,
});

const formatItem = (i) => ({
  id:          i.id,
  itemId:      i.item_id,
  itemName:    i.item_name,
  hsnCode:     i.hsn_code,
  orderedQty:  parseFloat(i.ordered_qty),
  receivedQty: parseFloat(i.received_qty),
  pendingQty:  parseFloat(i.pending_qty),
  unitName:    i.unit_name,
  rate:        parseFloat(i.rate),
  gstRate:     parseFloat(i.gst_rate),
  amount:      parseFloat(i.amount),
   size:        i.size_color,   // ← new
  group:       i.group_name,   // ← new
  brand:       i.brand,        // ← new
  articleNo:   i.article_no,   // ← new
});

// ─────────────────────────────────────────────
// CREATE PURCHASE ORDER
// ─────────────────────────────────────────────
export const createPurchaseOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
       console.log("User:", req.user);
    const {
      supplierId,
      warehouseId,
      date,
      expectedDelivery,
      priority,
      billingAddress,
      deliveryAddress,
      paymentTerms,
      termsConditions,
      notes,
      items,
      totalAmount
    } = req.body;

    // Validation
    if (!supplierId)
      return res.status(400).json({ success: false, message: "Supplier is required" });

    if (priority && !VALID_PRIORITIES.includes(priority))
      return res.status(400).json({ success: false, message: "Invalid priority" });

    const validItems = getValidItems(items);

    if (validItems.length === 0)
      return res.status(400).json({ success: false, message: "Add at least one valid item" });

       for (const item of validItems) {
  if (!item.itemId && !item.itemName) {
    return res.status(400).json({
      success: false,
      message: "Each item must have itemId or itemName",
    });
  }
}
    // Check supplier exists
    const { rows: supplierRows } = await client.query(
      "SELECT id FROM parties WHERE id = $1",
      [supplierId]
    );

    if (supplierRows.length === 0)
      return res.status(400).json({ success: false, message: "Supplier not found" });

    // Generate PO Number
    const po_number = await generatePONumber(client, company_id);

    // console.log("Creating PO with data:", {po_number, supplierId, warehouseId, date, expectedDelivery, priority, billingAddress, deliveryAddress, paymentTerms, termsConditions, notes, items: validItems});

    // Insert PO
    const { rows: poRows } = await client.query(
      `INSERT INTO purchase_orders
        (company_id, warehouse_id, supplier_id,
         po_number, po_date, expected_delivery,
         priority, billing_address, delivery_address,
         payment_terms, terms_conditions, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        company_id,
        warehouseId       || null,
        supplierId,
        po_number,
        date              || new Date(),
        expectedDelivery  || null,
        priority          || "NORMAL",
        billingAddress    || null,
        deliveryAddress   || null,
        paymentTerms      || null,
        termsConditions   || null,
        notes             || null,
        req.user.id,
      ]
    );

    const po = poRows[0];

 

    // Insert Items
    const insertedItems = await insertItems(client, po.id, validItems);

   
   

    await client.query(
      "UPDATE purchase_orders SET total_amount = $1 WHERE id = $2",
      [totalAmount, po.id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      success: true,
      message: `${po_number} created successfully`,
      data: {
        ...formatPO(po),
        totalAmount,
        items: insertedItems.map(formatItem),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create PO Error:", error);
    return res.status(500).json({ success: false, message: "Server error", error: error.message });
  } finally {
    client.release();
  }
};

export const getAllPurchaseOrders = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      search = "",
      status = "",
      supplier_id = "",
      warehouse_id = "",
      from_date = "",
      to_date = "",
    } = req.query;

    let query = `
      SELECT
        po.*,

        -- ✅ Supplier
        p.name  AS supplier_name,
        p.phone AS supplier_phone,
        p.email AS supplier_email,

        -- ✅ Warehouse
        w.name AS warehouse_name,

        -- ✅ Created By
        u.name AS created_by_name,

        -- ✅ Aggregates
        COUNT(poi.id) AS item_count,
        COALESCE(SUM(poi.ordered_qty), 0)  AS total_ordered_qty,
        COALESCE(SUM(poi.received_qty), 0) AS total_received_qty

      FROM purchase_orders po

      LEFT JOIN parties p ON po.supplier_id = p.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      LEFT JOIN users u ON po.created_by = u.id
      LEFT JOIN purchase_order_items poi ON po.id = poi.po_id

      WHERE po.company_id = $1
    `;

    const values = [company_id];
    let index = 2;

    if (search) {
      query += ` AND (po.po_number ILIKE $${index} OR p.name ILIKE $${index})`;
      values.push(`%${search}%`);
      index++;
    }

    if (status && status !== "ALL") {
      query += ` AND po.status = $${index}`;
      values.push(status.toUpperCase());
      index++;
    }

    if (supplier_id) {
      query += ` AND po.supplier_id = $${index}`;
      values.push(supplier_id);
      index++;
    }

    if (warehouse_id) {
      query += ` AND po.warehouse_id = $${index}`;
      values.push(warehouse_id);
      index++;
    }

    if (from_date) {
      query += ` AND po.po_date >= $${index}`;
      values.push(from_date);
      index++;
    }

    if (to_date) {
      query += ` AND po.po_date <= $${index}`;
      values.push(to_date);
      index++;
    }

    query += `
      GROUP BY 
        po.id,
        p.name, p.phone, p.email,
        w.name,
        u.name

      ORDER BY po.created_at DESC
    `;

    const { rows } = await pool.query(query, values);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatted = rows.map((po) => {
      let overdueDays = 0;
      let isOverdue = false;

      if (
        po.expected_delivery &&
        ["PENDING", "PARTIAL"].includes(po.status)
      ) {
        const expected = new Date(po.expected_delivery);
        expected.setHours(0, 0, 0, 0);

        if (expected < today) {
          overdueDays = Math.floor(
            (today - expected) / (1000 * 60 * 60 * 24)
          );
          isOverdue = true;
        }
      }

      return {
        id: po.id,
        poNumber: po.po_number,

        supplier: {
          id: po.supplier_id,
          name: po.supplier_name,
          phone: po.supplier_phone,
          email: po.supplier_email,
        },

        warehouse: {
          id: po.warehouse_id,
          name: po.warehouse_name,
        },

        createdBy: {
          id: po.created_by,
          name: po.created_by_name,
        },

        date: po.po_date,
        expectedDelivery: po.expected_delivery,
        status: po.status,
        priority: po.priority,

        paymentTerms: po.payment_terms,
        termsConditions: po.terms_conditions,

        itemCount: Number(po.item_count),
        totalOrderedQty: Number(po.total_ordered_qty),
        totalReceivedQty: Number(po.total_received_qty),
        totalAmount: Number(po.total_amount),

        isOverdue,
        overdueDays,

        createdAt: po.created_at,
      };
    });

    return res.status(200).json({
      success: true,
      count: formatted.length,
      data: formatted,
    });

  } catch (error) {
    console.error("Get All POs Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows: poRows } = await pool.query(
  `SELECT
    po.*,
    p.name       AS supplier_name,
    p.phone      AS supplier_phone,
    p.email      AS supplier_email,
    p.state_code AS supplier_state_code,
    w.name       AS warehouse_name,
    u.name       AS created_by_name
  FROM purchase_orders po
  LEFT JOIN parties p ON po.supplier_id = p.id
  LEFT JOIN warehouses w ON po.warehouse_id = w.id
  LEFT JOIN users u ON po.created_by = u.id
  WHERE po.id = $1`,
  [id]
);

    if (poRows.length === 0)
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });

    const { rows: itemRows } = await pool.query(
      `SELECT * 
       FROM purchase_order_items 
       WHERE po_id = $1 
       ORDER BY created_at`,
      [id]
    );

    return res.status(200).json({
      success: true,
      data: {
        id: poRows[0].id,
        poNumber: poRows[0].po_number,

        supplier: {
          id: poRows[0].supplier_id,
          name: poRows[0].supplier_name,
          phone: poRows[0].supplier_phone,
          email: poRows[0].supplier_email,
          stateCode:  poRows[0].supplier_state_code ?? null,
        },

        warehouse: {
          id: poRows[0].warehouse_id,
          name: poRows[0].warehouse_name,
        },

        createdBy: {
          id: poRows[0].created_by,
          name: poRows[0].created_by_name,
        },

        date: poRows[0].po_date,
        expectedDelivery: poRows[0].expected_delivery,
        status: poRows[0].status,
        priority: poRows[0].priority,

        paymentTerms: poRows[0].payment_terms,
        termsConditions: poRows[0].terms_conditions,
        billingAddress: poRows[0].billing_address,
        deliveryAddress: poRows[0].delivery_address,
        notes: poRows[0].notes,

        totalAmount: Number(poRows[0].total_amount),

        items: itemRows.map((i) => ({
          id: i.id,
          itemId: i.item_id,
          itemName: i.item_name,
          hsnCode: i.hsn_code,
          orderedQty: Number(i.ordered_qty),
          receivedQty: Number(i.received_qty),
          pendingQty: Number(i.pending_qty),
          unitName: i.unit_name,
          rate: Number(i.rate),
          gstRate: Number(i.gst_rate),
          amount: Number(i.amount),

          size: i.size_color,
          group: i.group_name,
          brand: i.brand,
          articleNo: i.article_no,
        })),

        createdAt: poRows[0].created_at,
      },
    });

  } catch (error) {
    console.error("Get PO By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─────────────────────────────────────────────
// DELETE PO
// ─────────────────────────────────────────────
export const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any stock has been received
    const { rows: receivedRows } = await pool.query(
      "SELECT id FROM purchase_order_items WHERE po_id = $1 AND received_qty > 0 LIMIT 1",
      [id]
    );

    if (receivedRows.length > 0) {
      // Stock received — cancel instead of delete
      const { rows } = await pool.query(
        `UPDATE purchase_orders SET status = 'CANCELLED'
         WHERE id = $1 AND status NOT IN ('COMPLETED','CANCELLED')
         RETURNING po_number`,
        [id]
      );

      if (rows.length === 0)
        return res.status(409).json({
          success: false,
          message: "Cannot cancel a completed or already cancelled PO",
        });

      return res.status(200).json({
        success: true,
        message: `${rows[0].po_number} cancelled (stock already received)`,
      });
    }

    // No stock received — safe to hard delete
    const { rows } = await pool.query(
      "DELETE FROM purchase_orders WHERE id = $1 RETURNING po_number",
      [id]
    );

    if (rows.length === 0)
      return res.status(404).json({ success: false, message: "Purchase order not found" });

    return res.status(200).json({
      success: true,
      message: `${rows[0].po_number} deleted successfully`,
    });

  } catch (error) {
    console.error("Delete PO Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


export const getPurchaseOrderStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const query = `
      SELECT
        COUNT(*) AS total,

        COUNT(*) FILTER (
          WHERE status = 'PENDING'
        ) AS pending,

        COUNT(*) FILTER (
          WHERE status = 'PARTIAL'
        ) AS partial, 

        COUNT(*) FILTER (
          WHERE status = 'COMPLETED'
        ) AS completed,

        COUNT(*) FILTER (
          WHERE status IN ('PENDING', 'PARTIAL')
          AND expected_delivery IS NOT NULL
          AND expected_delivery < CURRENT_DATE
        ) AS overdue

      FROM purchase_orders
      WHERE company_id = $1
    `;

    const { rows } = await pool.query(query, [company_id]);

    const stats = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        total: Number(stats.total),
        pending: Number(stats.pending),
        partial: Number(stats.partial), 
        completed: Number(stats.completed),
        overdue: Number(stats.overdue),
      },
    });

  } catch (error) {
    console.error("PO Stats Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const updatePurchaseOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const company_id = req.user.company_id;
    const { id } = req.params;

    const {
      supplierId,
      warehouseId,
      date,
      expectedDelivery,
      priority,
      billingAddress,
      deliveryAddress,
      paymentTerms,
      termsConditions,
      notes,
      items,
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, message: "PO id is required" });
    }

    const validItems = getValidItems(items);

    if (validItems.length === 0) {
      return res.status(400).json({ success: false, message: "Add at least one valid item" });
    }

    // 🔹 Check PO exists
    const { rows } = await client.query(
      "SELECT * FROM purchase_orders WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (!rows.length) {
      throw new Error("Purchase order not found");
    }

    // 🔹 Update header
    await client.query(
      `UPDATE purchase_orders
       SET supplier_id = $1,
           warehouse_id = $2,
           po_date = $3,
           expected_delivery = $4,
           priority = $5,
           billing_address = $6,
           delivery_address = $7,
           payment_terms = $8,
           terms_conditions = $9,
           notes = $10,
           updated_at = NOW()
       WHERE id = $11`,
      [
        supplierId,
        warehouseId || null,
        date || new Date(),
        expectedDelivery || null,
        priority || "NORMAL",
        billingAddress || null,
        deliveryAddress || null,
        paymentTerms || null,
        termsConditions || null,
        notes || null,
        id,
      ]
    );

    // 🔥 Delete old items
    await client.query("DELETE FROM purchase_order_items WHERE po_id = $1", [id]);

    // 🔹 Insert new items
    const insertedItems = await insertItems(client, id, validItems);

    // 🔹 Recalculate total
    const totalAmount = insertedItems.reduce(
      (sum, i) => sum + Number(i.amount),
      0
    );

    await client.query(
      "UPDATE purchase_orders SET total_amount = $1 WHERE id = $2",
      [totalAmount, id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "Purchase order updated successfully",
      data: {
        totalAmount,
        items: insertedItems.map(formatItem),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update PO Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Server error",
    });
  } finally {
    client.release();
  }
};

export const cancelPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;

    // Check PO exists
    const { rows } = await pool.query(
      "SELECT status, po_number FROM purchase_orders WHERE id = $1",
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({
        success: false,
        message: "Purchase order not found",
      });
    }

    const po = rows[0];

    // ❌ Already completed or cancelled
    if (["COMPLETED", "CANCELLED"].includes(po.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel a ${po.status} PO`,
      });
    }

    // ✅ Cancel
    await pool.query(
      `UPDATE purchase_orders
       SET status = 'CANCELLED',
           updated_at = NOW()
       WHERE id = $1`,
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `${po.po_number} cancelled successfully`,
    });

  } catch (error) {
    console.error("Cancel PO Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
