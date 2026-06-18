import connectDB from '../../../pool.js';

// ============================================
// 📌 CREATE PRODUCTION ORDER
// ============================================
export const createProductionOrder = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const {
      poNumber,
      type,
      priority,
      itemId,
      bomId,
      plannedQty,
      plannedStartDate,
      plannedEndDate,
      salesInvoiceId,
      warehouseId,
      routingId,
      notes,
    } = req.body;

    const company_id = req.user.company_id;
    const created_by = req.user.id;

    // ============================================
    // VALIDATIONS
    // ============================================

    if (
      !poNumber ||
      !type ||
      !itemId ||
      !plannedQty ||
      !plannedStartDate ||
      !plannedEndDate ||
      !warehouseId
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: poNumber, type, itemId, plannedQty, plannedStartDate, plannedEndDate, warehouseId',
      });
    }

    // ============================================
    // VERIFY ITEM
    // ============================================
     // ============================================
// ============================================
// VERIFY ITEM
// ============================================

const itemResult = await client.query(
  `
  SELECT id, name, code
  FROM items
  WHERE id = $1
  AND company_id = $2
  `,
  [itemId, company_id],
);

if (itemResult.rows.length === 0) {
  await client.query('ROLLBACK');
  return res.status(404).json({
    success: false,
    message: 'Item not found',
  });
}

const item = itemResult.rows[0];

// ============================================
// RESOLVE BOM (from bom_master)
// ============================================

let resolvedBomId = null;
let resolvedBomVersion = null;

if (bomId) {
  // Use the BOM explicitly chosen by the user — accept any non-OBSOLETE status
  const bomResult = await client.query(
    `
    SELECT id, version
    FROM bom_master
    WHERE id = $1
    AND company_id = $2
    AND status != 'OBSOLETE'
    `,
    [bomId, company_id],
  );

  if (bomResult.rows.length === 0) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      success: false,
      message: 'Selected BOM not found or is obsolete',
    });
  }

  resolvedBomId = bomResult.rows[0].id;
  resolvedBomVersion = bomResult.rows[0].version;
} else {
  // No BOM selected — find the best available BOM for this item
  // Prefer ACTIVE, fall back to DRAFT
  const bomResult = await client.query(
    `
    SELECT id, version, status
    FROM bom_master
    WHERE product_id = $1
    AND company_id = $2
    AND status != 'OBSOLETE'
    ORDER BY
      CASE status WHEN 'ACTIVE' THEN 0 ELSE 1 END,
      created_at DESC
    LIMIT 1
    `,
    [itemId, company_id],
  );

  if (bomResult.rows.length === 0) {
    await client.query('ROLLBACK');
    return res.status(400).json({
      success: false,
      message: 'No BOM found for selected item. Please create a BOM first.',
    });
  }

  resolvedBomId = bomResult.rows[0].id;
  resolvedBomVersion = bomResult.rows[0].version;
}

// Then in the INSERT, use resolvedBomId and resolvedBomVersion instead of item.bom_id / item.bom_version
    // ============================================
    // VERIFY WAREHOUSE
    // ============================================

    const warehouseResult = await client.query(
      `
      SELECT id
      FROM warehouses
      WHERE id = $1
      AND company_id = $2
      `,
      [warehouseId, company_id],
    );

    if (warehouseResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid warehouse',
      });
    }

    // ============================================
    // VERIFY ROUTING (OPTIONAL)
    // ============================================

    if (routingId) {
      const routingResult = await client.query(
        `
        SELECT id
        FROM routings
        WHERE id = $1
        AND company_id = $2
        `,
        [routingId, company_id],
      );

      if (routingResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Invalid routing',
        });
      }
    }

    // ============================================
    // VERIFY SALES INVOICE (OPTIONAL)
    // ============================================

    if (salesInvoiceId) {
      const invoiceResult = await client.query(
        `
        SELECT id
        FROM sales_invoices
        WHERE id = $1
        AND company_id = $2
        `,
        [salesInvoiceId, company_id],
      );

      if (invoiceResult.rows.length === 0) {
        await client.query('ROLLBACK');

        return res.status(400).json({
          success: false,
          message: 'Invalid sales invoice',
        });
      }
    }

    // ============================================
    // INSERT PRODUCTION ORDER
    // ============================================

    const result = await client.query(
      `
      INSERT INTO production_orders (
        po_number,
        type,
        status,
        priority,
        item_id,
        bom_id,
        bom_version,
        planned_qty,
        planned_start_date,
        planned_end_date,
        sales_invoice_id,
        warehouse_id,
        routing_id,
        notes,
        created_by
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15
      )
      RETURNING *
      `,
      [
        poNumber,
        type,
        'DRAFT',
        priority || 'NORMAL',
        itemId,
         '67d30abe-7329-4f6e-adf7-3abd951e6d40',
  '1.0',
        // item.bom_id,
        // item.bom_version,
        plannedQty,
        plannedStartDate,
        plannedEndDate,
        salesInvoiceId || null,
        warehouseId,
        routingId || null,
        notes || null,
        created_by,
      ],
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: 'Production order created successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('createProductionOrder error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 GET ALL PRODUCTION ORDERS
// ============================================
export const getAllProductionOrders = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      status,
      type,
      priority,
      warehouseId,
      search,
      page = '1',
      limit = '20',
    } = req.query;

    let query = `
      SELECT
        po.*,
        i.name AS item_name,
        i.code AS item_code,
        w.name AS warehouse_name
      FROM production_orders po
      JOIN items i ON po.item_id = i.id
      LEFT JOIN warehouses w ON po.warehouse_id = w.id
      WHERE i.company_id = $1
    `;

    const params = [company_id];
    let paramIndex = 2;

    if (warehouseId) {
      query += ` AND po.warehouse_id = $${paramIndex++}`;
      params.push(warehouseId);
    }

    if (status && status !== 'ALL') {
      query += ` AND po.status = $${paramIndex++}`;
      params.push(status);
    }

    if (type && type !== 'ALL') {
      query += ` AND po.type = $${paramIndex++}`;
      params.push(type);
    }

    if (priority && priority !== 'ALL') {
      query += ` AND po.priority = $${paramIndex++}`;
      params.push(priority);
    }

    if (search) {
      query += `
        AND (
          po.po_number ILIKE $${paramIndex}
          OR i.name ILIKE $${paramIndex + 1}
          OR i.code ILIKE $${paramIndex + 2}
        )
      `;

      params.push(
        `%${search}%`,
        `%${search}%`,
        `%${search}%`
      );

      paramIndex += 3;
    }

    query += ` ORDER BY po.created_at DESC`;

    query += `
      LIMIT $${paramIndex++}
      OFFSET $${paramIndex++}
    `;

    params.push(
      parseInt(limit),
      (parseInt(page) - 1) * parseInt(limit)
    );

    const result = await connectDB.query(query, params);

    // ============================================
    // COUNT QUERY
    // ============================================

    let countQuery = `
      SELECT COUNT(*) AS total
      FROM production_orders po
      JOIN items i ON po.item_id = i.id
      WHERE i.company_id = $1
    `;

    const countParams = [company_id];
    let countIndex = 2;

    if (warehouseId) {
      countQuery += ` AND po.warehouse_id = $${countIndex++}`;
      countParams.push(warehouseId);
    }

    if (status && status !== 'ALL') {
      countQuery += ` AND po.status = $${countIndex++}`;
      countParams.push(status);
    }

    if (type && type !== 'ALL') {
      countQuery += ` AND po.type = $${countIndex++}`;
      countParams.push(type);
    }

    if (priority && priority !== 'ALL') {
      countQuery += ` AND po.priority = $${countIndex++}`;
      countParams.push(priority);
    }

    const countResult = await connectDB.query(
      countQuery,
      countParams
    );

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].total),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].total) /
          parseInt(limit)
        ),
      },
    });
  } catch (error) {
    console.error('getAllProductionOrders error:', error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// 📌 GET PRODUCTION ORDER BY ID
// ============================================
export const getProductionOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `
      SELECT
        po.*,
        i.name AS item_name,
        i.code AS item_code,
        w.name AS warehouse_name,
        bm.name AS bom_name,
        bm.version AS bom_master_version
      FROM production_orders po
      JOIN items i
        ON po.item_id = i.id
      LEFT JOIN warehouses w
        ON po.warehouse_id = w.id
      LEFT JOIN bom_master bm
        ON po.bom_id = bm.id
      WHERE po.id = $1
      AND i.company_id = $2
      `,
      [id, company_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Production order not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getProductionOrderById error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ============================================
// 📌 UPDATE PRODUCTION ORDER
// ============================================
export const updateProductionOrder = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;

    const {
      type,
      priority,
      itemId,
      bomId,
      plannedQty,
      plannedStartDate,
      plannedEndDate,
      salesInvoiceId,
      warehouseId,
      routingId,
      notes,
    } = req.body;

    const company_id = req.user.company_id;

    // ============================================
    // VERIFY PRODUCTION ORDER
    // ============================================

    const existingPO = await client.query(
      `
      SELECT po.*
      FROM production_orders po
      JOIN items i ON po.item_id = i.id
      WHERE po.id = $1
      AND i.company_id = $2
      `,
      [id, company_id],
    );

    if (existingPO.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Production order not found',
      });
    }

    // ============================================
    // VERIFY ITEM
    // ============================================

    const itemResult = await client.query(
      `
      SELECT id
      FROM items
      WHERE id = $1
      AND company_id = $2
      `,
      [itemId, company_id],
    );

    if (itemResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid item',
      });
    }

    // ============================================
    // VERIFY BOM
    // ============================================

    const bomResult = await client.query(
      `
      SELECT id, version
      FROM bom_master
      WHERE id = $1
      AND company_id = $2
      `,
      [bomId, company_id],
    );

    if (bomResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid BOM',
      });
    }

    // ============================================
    // VERIFY WAREHOUSE
    // ============================================

    const warehouseResult = await client.query(
      `
      SELECT id
      FROM warehouses
      WHERE id = $1
      AND company_id = $2
      `,
      [warehouseId, company_id],
    );

    if (warehouseResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid warehouse',
      });
    }

    // ============================================
    // UPDATE
    // ============================================

    const result = await client.query(
      `
      UPDATE production_orders
      SET
        type = $1,
        priority = $2,
        item_id = $3,
        bom_id = $4,
        bom_version = $5,
        planned_qty = $6,
        planned_start_date = $7,
        planned_end_date = $8,
        sales_invoice_id = $9,
        warehouse_id = $10,
        routing_id = $11,
        notes = $12
      WHERE id = $13
      RETURNING *
      `,
      [
        type,
        priority,
        itemId,
        bomId,
        bomResult.rows[0].version,
        plannedQty,
        plannedStartDate,
        plannedEndDate,
        salesInvoiceId || null,
        warehouseId,
        routingId || null,
        notes || null,
        id,
      ],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Production order updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('updateProductionOrder error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    client.release();
  }
};
// ============================================
// 📌 DELETE PRODUCTION ORDER
// ============================================
export const deleteProductionOrder = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const company_id = req.user.company_id;

    // ============================================
    // VERIFY PRODUCTION ORDER
    // ============================================

    const existingPO = await client.query(
      `
      SELECT po.id, po.status
      FROM production_orders po
      JOIN items i
        ON po.item_id = i.id
      WHERE po.id = $1
      AND i.company_id = $2
      `,
      [id, company_id],
    );

    if (existingPO.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Production order not found',
      });
    }

    // ============================================
    // OPTIONAL BUSINESS RULE
    // Prevent deletion of completed orders
    // ============================================

    if (existingPO.rows[0].status === 'COMPLETED') {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Completed production orders cannot be deleted',
      });
    }

    // ============================================
    // DELETE
    // ============================================

    await client.query(
      `
      DELETE FROM production_orders
      WHERE id = $1
      `,
      [id],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: 'Production order deleted successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('deleteProductionOrder error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 UPDATE PRODUCTION ORDER STATUS
// ============================================
export const updateProductionOrderStatus = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const { status } = req.body;
    const company_id = req.user.company_id;

    const allowedStatuses = [
      'DRAFT',
      'PLANNED',
      'IN_PROGRESS',
      'COMPLETED',
      'ON_HOLD',
      'CANCELLED',
    ];

    if (!allowedStatuses.includes(status)) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Invalid status',
      });
    }

    // ============================================
    // VERIFY PRODUCTION ORDER
    // ============================================

    const poResult = await client.query(
      `
      SELECT po.*
      FROM production_orders po
      JOIN items i
        ON po.item_id = i.id
      WHERE po.id = $1
      AND i.company_id = $2
      `,
      [id, company_id],
    );

    if (poResult.rows.length === 0) {
      await client.query('ROLLBACK');

      return res.status(404).json({
        success: false,
        message: 'Production order not found',
      });
    }

    const productionOrder = poResult.rows[0];

    // ============================================
    // OPTIONAL BUSINESS RULES
    // ============================================

    if (
      productionOrder.status === 'COMPLETED' &&
      status !== 'COMPLETED'
    ) {
      await client.query('ROLLBACK');

      return res.status(400).json({
        success: false,
        message: 'Completed production order cannot be modified',
      });
    }

    let actualStartDate = productionOrder.actual_start_date;
    let actualEndDate = productionOrder.actual_end_date;

    if (
      status === 'IN_PROGRESS' &&
      !productionOrder.actual_start_date
    ) {
      actualStartDate = new Date();
    }

    if (status === 'COMPLETED') {
      actualEndDate = new Date();
    }

    // ============================================
    // UPDATE STATUS
    // ============================================

    const result = await client.query(
      `
      UPDATE production_orders
      SET
        status = $1,
        actual_start_date = $2,
        actual_end_date = $3
      WHERE id = $4
      RETURNING *
      `,
      [
        status,
        actualStartDate,
        actualEndDate,
        id,
      ],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Production order status updated to ${status}`,
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');

    console.error('updateProductionOrderStatus error:', error);

    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    client.release();
  }
};