import { connectDB } from '../../pool.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

const isUuid = (v) => {
  if (!v || typeof v !== 'string') return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(v);
};

const formatCode = (prefix, num) => {
  return `${prefix}-${String(num).padStart(4, '0')}`;
};

// ============================================
// GENERATE ITEM CODE (Auto + Collision Safe)
// ============================================
export const generateItemCode = async (company_id, client) => {
  // 1. Ensure sequence exists
  await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, prefix, start_no, current_value)
         VALUES ($1, 'ITEM_CODE', 'ITM', 301, 300)
         ON CONFLICT (company_id, doc_type) DO NOTHING`,
    [company_id],
  );

  // 2. Lock and get current sequence
  const { rows } = await client.query(
    `SELECT prefix, current_value
         FROM document_sequences
         WHERE company_id = $1 AND doc_type = 'ITEM_CODE'
         FOR UPDATE`,
    [company_id],
  );

  if (!rows.length) {
    throw new Error('ITEM_CODE sequence not found');
  }

  const prefix = rows[0].prefix;
  let next = Number(rows[0].current_value) + 1;

  // 3. Skip existing codes (collision detection)
  const MAX_ATTEMPTS = 1000;
  let attempts = 0;

  while (attempts < MAX_ATTEMPTS) {
    const candidate = formatCode(prefix, next);
    const { rows: conflict } = await client.query(
      `SELECT 1 FROM items WHERE code = $1 AND company_id = $2 LIMIT 1`,
      [candidate, company_id],
    );
    if (!conflict.length) break;
    next++;
    attempts++;
  }

  if (attempts === MAX_ATTEMPTS) {
    throw new Error(`Unable to find free code after ${MAX_ATTEMPTS} attempts`);
  }

  // 4. Update sequence
  await client.query(
    `UPDATE document_sequences
         SET current_value = $1
         WHERE company_id = $2 AND doc_type = 'ITEM_CODE'`,
    [next, company_id],
  );

  return formatCode(prefix, next);
};

// ============================================
// MAP DATABASE ROW TO FRONTEND FORMAT
// ============================================
const mapDbToFrontend = (dbRow) => {
  if (!dbRow) return null;
  return {
    id: dbRow.id,
    name: dbRow.name,
    code: dbRow.code,
    barcode: dbRow.barcode,
    categoryId: dbRow.category_id,
    categoryName: dbRow.category,
    brand: dbRow.brand,
    hsnCode: dbRow.hsn_code,
    taxRate: parseFloat(dbRow.gst_rate || 0),
    unitId: dbRow.primary_unit_id,
    unitName: dbRow.unit_name,
    purchaseRate: parseFloat(dbRow.purchase_rate || 0),
    saleRate: parseFloat(dbRow.sale_rate || 0),
    mrp: parseFloat(dbRow.mrp || 0),
    minStockLevel: dbRow.min_stock_level || 0,
    articleNo: dbRow.article_no,
    sizeColor: dbRow.size_color,
    imageUrl: dbRow.image_url,
    warehouseId: dbRow.warehouse_id,
    isActive: dbRow.is_active,
    stock: parseInt(dbRow.stock || 0),
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at,
    // ✅ Naye fields
    itemType: dbRow.item_type,
    itemGroup: dbRow.item_group,
    drawingNumber: dbRow.drawing_number,
    specifications: dbRow.specifications,
    productionUnit: dbRow.production_unit,
    standardCost: parseFloat(dbRow.standard_cost || 0),
    supplierLeadTime: parseInt(dbRow.supplier_lead_time || 0),
    reorderPoint: parseInt(dbRow.reorder_point || 0),
    reorderQty: parseInt(dbRow.reorder_qty || 0),
    enableVariants: dbRow.enable_variants ?? false,
    enableBatchTracking: dbRow.enable_batch_tracking ?? false,
    enableSerialTracking: dbRow.enable_serial_tracking ?? false,
    requiresIncomingQC: dbRow.requires_incoming_qc ?? false,
    requiresFinalQC: dbRow.requires_final_qc ?? false,
    hasExpiryDate: dbRow.has_expiry_date ?? false,
    bomId: dbRow.bom_id, // ✅ ADD THIS
    bomVersion: dbRow.bom_version, // ✅ ADD THIS
    isBomLinked: !!dbRow.bom_id,
  };
};

// ============================================
// CREATE ITEM
// ============================================
export const createItem = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const {
      name,
      code,
      barcode,
      categoryId,
      categoryName,
      brand,
      hsnCode,
      taxRate,
      unitId,
      purchaseRate,
      saleRate,
      unitName,
      mrp,
      minStockLevel,
      articleNo,
      sizeColor,
      imageUrl,
      isActive,
      warehouseId,
      itemType,
      itemGroup,
      drawingNumber,
      specifications,
      productionUnit,
      standardCost,
      supplierLeadTime,
      reorderPoint,
      reorderQty,

      enableVariants,
      enableBatchTracking,
      enableSerialTracking,
      requiresIncomingQC,
      requiresFinalQC,
      hasExpiryDate,
    } = req.body;

    const company_id = req.user.company_id;
    const created_by = req.user.id;

    // Validation
    if (!name?.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Item name is required',
      });
    }

    if (!warehouseId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Warehouse ID is required',
      });
    }

    const cleanName = name.trim();
    const manualCode = code?.trim() || null;

    // Manual code duplicate check
    if (manualCode) {
      const { rows: existing } = await client.query(
        `SELECT 1 FROM items WHERE code = $1 AND company_id = $2 LIMIT 1`,
        [manualCode, company_id],
      );
      if (existing.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Item code "${manualCode}" already exists`,
        });
      }
    }

    // Resolve final code
    let finalCode;
    if (manualCode) {
      finalCode = manualCode;
      // Sync sequence if manual code is ahead
      const match = finalCode.match(/^([A-Za-z]+)-?(\d+)$/);
      if (match) {
        const manualPrefix = match[1].toUpperCase();
        const manualNum = parseInt(match[2], 10);
        await client.query(
          `UPDATE document_sequences
                     SET current_value = GREATEST(current_value, $1)
                     WHERE company_id = $2 AND doc_type = 'ITEM_CODE' AND UPPER(prefix) = $3`,
          [manualNum, company_id, manualPrefix],
        );
      }
    } else {
      finalCode = await generateItemCode(company_id, client);
    }

    // BARCODE HANDLING
    // Ensure barcode_settings exists
    await client.query(
      `INSERT INTO barcode_settings (company_id)
             VALUES ($1)
             ON CONFLICT (company_id) DO NOTHING`,
      [company_id],
    );

    // Lock barcode_settings
    const { rows: barcodeRows } = await client.query(
      `SELECT * FROM barcode_settings
             WHERE company_id = $1
             FOR UPDATE`,
      [company_id],
    );

    const config = barcodeRows[0];
    let finalBarcode = barcode?.trim() || null;

    // Duplicate barcode check
    if (finalBarcode) {
      const { rows: dupBarcode } = await client.query(
        `SELECT 1 FROM items WHERE barcode = $1 AND company_id = $2 LIMIT 1`,
        [finalBarcode, company_id],
      );
      if (dupBarcode.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Barcode "${finalBarcode}" already exists`,
        });
      }
    }

    // Auto-generate barcode
    if (!finalBarcode) {
      const nextNumber = (config.last_used_number || 0) + 1;
      const padLength = config.length || 6;
      const padded = String(nextNumber).padStart(padLength, '0');
      finalBarcode = `${config.prefix || ''}${padded}`;

      await client.query(
        `UPDATE barcode_settings
                 SET last_used_number = $1, updated_at = NOW()
                 WHERE company_id = $2`,
        [nextNumber, company_id],
      );
    }

    // INSERT ITEM
  const { rows: inserted } = await client.query(
    `INSERT INTO items (
    company_id, name, code, barcode,
    category_id, category, brand, hsn_code,
    gst_rate, primary_unit_id, unit_name,
    purchase_rate, sale_rate, mrp, min_stock_level,
    article_no, size_color, image_url,
    warehouse_id, is_active, created_by,
    item_type, item_group, drawing_number, specifications,
    production_unit, standard_cost, supplier_lead_time,
    reorder_point, reorder_qty,
    enable_variants, enable_batch_tracking, enable_serial_tracking,
    requires_incoming_qc, requires_final_qc,has_expiry_date
  ) VALUES (
    $1, $2, $3, $4, $5, $6, $7, $8,
    $9, $10, $11, $12, $13, $14, $15,
    $16, $17, $18, $19, $20, $21,
    $22, $23, $24, $25,
    $26, $27, $28,
    $29, $30,
    $31, $32, $33,
    $34, $35, $36
  ) RETURNING *`,
    [
      company_id,
      cleanName,
      finalCode,
      finalBarcode,
      categoryId || null,
      categoryName || null,
      brand || null,
      hsnCode || null,
      taxRate ?? 18,
      unitId || null,
      unitName || null,
      purchaseRate ?? 0,
      saleRate ?? 0,
      mrp ?? 0,
      minStockLevel ?? 5,
      articleNo || null,
      sizeColor || null,
      imageUrl || null,
      warehouseId,
      isActive ?? true,
      created_by,
      itemType || null,
      itemGroup || null,
      drawingNumber || null,
      specifications || null,
      productionUnit || null,
      standardCost ?? 0,
      supplierLeadTime ?? 0,
      reorderPoint ?? 0,
      reorderQty ?? 0,
      enableVariants ?? false,
      enableBatchTracking ?? false,
      enableSerialTracking ?? false,
      requiresIncomingQC ?? false,
      requiresFinalQC ?? false,
      hasExpiryDate ?? false,
    ],
  );

    // Initialize stock in warehouse_stock table
    await client.query(
      `INSERT INTO warehouse_stock (item_id, warehouse_id, quantity)
             VALUES ($1, $2, 0)
             ON CONFLICT (item_id, warehouse_id, batch_no) DO NOTHING`,
      [inserted[0].id, warehouseId],
    );

    await client.query('COMMIT');

    // Get stock for response
    const stockResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as stock
             FROM warehouse_stock
             WHERE item_id = $1 AND warehouse_id = $2`,
      [inserted[0].id, warehouseId],
    );

    const responseData = mapDbToFrontend({
      ...inserted[0],
      stock: parseInt(stockResult.rows[0]?.stock || 0),
    });

    return res.status(201).json({
      success: true,
      message: 'Item created successfully',
      data: responseData,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createItem error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  } finally {
    client.release();
  }
};

// ============================================
// UPDATE ITEM
// ============================================
export const updateItem = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const company_id = req.user.company_id;

    const {
      name,
      code,
      barcode,
      categoryId,
      categoryName,
      brand,
      hsnCode,
      taxRate,
      unitId,
      purchaseRate,
      saleRate,
      unitName,
      mrp,
      minStockLevel,
      articleNo,
      sizeColor,
      imageUrl,
      isActive,
      warehouseId,
      itemType,
      itemGroup,
      drawingNumber,
      specifications,
      productionUnit,
      standardCost,
      supplierLeadTime,
      reorderPoint,
      reorderQty,

      enableVariants,
      enableBatchTracking,
      enableSerialTracking,
      requiresIncomingQC,
      requiresFinalQC,
      hasExpiryDate,
    } = req.body;

    // Check if item exists
    const { rows: existing } = await client.query(
      `SELECT * FROM items WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (existing.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    // Build dynamic UPDATE query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name?.trim()) {
      updates.push(`name = $${paramIndex++}`);
      values.push(name.trim());
    }
    if (code?.trim()) {
      // Check duplicate code
      const { rows: dupCode } = await client.query(
        `SELECT 1 FROM items WHERE code = $1 AND company_id = $2 AND id != $3 LIMIT 1`,
        [code.trim(), company_id, id],
      );
      if (dupCode.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Item code already exists',
        });
      }
      updates.push(`code = $${paramIndex++}`);
      values.push(code.trim());
    }
    if (barcode?.trim()) {
      const { rows: dupBarcode } = await client.query(
        `SELECT 1 FROM items WHERE barcode = $1 AND company_id = $2 AND id != $3 LIMIT 1`,
        [barcode.trim(), company_id, id],
      );
      if (dupBarcode.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Barcode already exists',
        });
      }
      updates.push(`barcode = $${paramIndex++}`);
      values.push(barcode.trim());
    }
    if (categoryId !== undefined) {
      updates.push(`category_id = $${paramIndex++}`);
      values.push(categoryId || null);
    }
    if (categoryName !== undefined) {
      updates.push(`category = $${paramIndex++}`);
      values.push(categoryName || null);
    }
    if (brand !== undefined) {
      updates.push(`brand = $${paramIndex++}`);
      values.push(brand || null);
    }
    if (hsnCode !== undefined) {
      updates.push(`hsn_code = $${paramIndex++}`);
      values.push(hsnCode || null);
    }
    if (taxRate !== undefined) {
      updates.push(`gst_rate = $${paramIndex++}`);
      values.push(taxRate);
    }
    if (unitId !== undefined) {
      updates.push(`primary_unit_id = $${paramIndex++}`);
      values.push(unitId || null);
    }
    if (unitName !== undefined) {
      updates.push(`unit_name = $${paramIndex++}`);
      values.push(unitName || null);
    }
    if (purchaseRate !== undefined) {
      updates.push(`purchase_rate = $${paramIndex++}`);
      values.push(purchaseRate);
    }
    if (saleRate !== undefined) {
      updates.push(`sale_rate = $${paramIndex++}`);
      values.push(saleRate);
    }
    if (mrp !== undefined) {
      updates.push(`mrp = $${paramIndex++}`);
      values.push(mrp);
    }
    if (minStockLevel !== undefined) {
      updates.push(`min_stock_level = $${paramIndex++}`);
      values.push(minStockLevel);
    }
    if (articleNo !== undefined) {
      updates.push(`article_no = $${paramIndex++}`);
      values.push(articleNo || null);
    }
    if (sizeColor !== undefined) {
      updates.push(`size_color = $${paramIndex++}`);
      values.push(sizeColor || null);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramIndex++}`);
      values.push(imageUrl || null);
    }
    if (warehouseId !== undefined) {
      updates.push(`warehouse_id = $${paramIndex++}`);
      values.push(warehouseId || null);
    }
    if (isActive !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(isActive);
    }
    if (itemType !== undefined) {
      updates.push(`item_type = $${paramIndex++}`);
      values.push(itemType || null);
    }

    if (itemGroup !== undefined) {
      updates.push(`item_group = $${paramIndex++}`);
      values.push(itemGroup || null);
    }

    if (drawingNumber !== undefined) {
      updates.push(`drawing_number = $${paramIndex++}`);
      values.push(drawingNumber || null);
    }

    if (specifications !== undefined) {
      updates.push(`specifications = $${paramIndex++}`);
      values.push(specifications || null);
    }

    if (productionUnit !== undefined) {
      updates.push(`production_unit = $${paramIndex++}`);
      values.push(productionUnit || null);
    }

    if (standardCost !== undefined) {
      updates.push(`standard_cost = $${paramIndex++}`);
      values.push(standardCost);
    }

    if (supplierLeadTime !== undefined) {
      updates.push(`supplier_lead_time = $${paramIndex++}`);
      values.push(supplierLeadTime);
    }

    if (reorderPoint !== undefined) {
      updates.push(`reorder_point = $${paramIndex++}`);
      values.push(reorderPoint);
    }

    if (reorderQty !== undefined) {
      updates.push(`reorder_qty = $${paramIndex++}`);
      values.push(reorderQty);
    }

    if (enableVariants !== undefined) {
      updates.push(`enable_variants = $${paramIndex++}`);
      values.push(enableVariants);
    }

    if (enableBatchTracking !== undefined) {
      updates.push(`enable_batch_tracking = $${paramIndex++}`);
      values.push(enableBatchTracking);
    }

    if (enableSerialTracking !== undefined) {
      updates.push(`enable_serial_tracking = $${paramIndex++}`);
      values.push(enableSerialTracking);
    }

    if (requiresIncomingQC !== undefined) {
      updates.push(`requires_incoming_qc = $${paramIndex++}`);
      values.push(requiresIncomingQC);
    }

    if (requiresFinalQC !== undefined) {
      updates.push(`requires_final_qc = $${paramIndex++}`);
      values.push(requiresFinalQC);
    }
    if (hasExpiryDate !== undefined) {
      updates.push(`has_expiry_date = $${paramIndex++}`);
      values.push(hasExpiryDate);
    }
    if (req.body.bomId !== undefined) {
      updates.push(`bom_id = $${paramIndex++}`);
      values.push(req.body.bomId || null);
    }
    if (req.body.bomVersion !== undefined) {
      updates.push(`bom_version = $${paramIndex++}`);
      values.push(req.body.bomVersion || null);
    }

    updates.push(`updated_at = NOW()`);

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    values.push(id, company_id);
    const query = `
            UPDATE items 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex} AND company_id = $${paramIndex + 1}
            RETURNING *
        `;

    const { rows: updated } = await client.query(query, values);

    // Get stock
    const stockResult = await client.query(
      `SELECT COALESCE(SUM(quantity), 0) as stock
             FROM warehouse_stock
             WHERE item_id = $1`,
      [id],
    );

    await client.query('COMMIT');

    const responseData = mapDbToFrontend({
      ...updated[0],
      stock: parseInt(stockResult.rows[0]?.stock || 0),
    });

    return res.json({
      success: true,
      message: 'Item updated successfully',
      data: responseData,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateItem error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
    });
  } finally {
    client.release();
  }
};

// ============================================
// DELETE ITEM (Soft Delete - Deactivate)
// ============================================
export const deleteItem = async (req, res) => {
  const client = await connectDB.connect();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const { rows: existing } = await client.query(
      `SELECT id FROM items WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    // Soft delete - just deactivate
    await client.query(
      `UPDATE items SET is_active = false, updated_at = NOW()
             WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    return res.json({
      success: true,
      message: 'Item deactivated successfully',
    });
  } catch (error) {
    console.error('deleteItem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  } finally {
    client.release();
  }
};

// ============================================
// GET ALL ITEMS
// ============================================
export const getAllItems = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const query = `
            SELECT 
                i.*,
                   i.bom_id,
                    i.bom_version,
                COALESCE(ws.stock, 0) as stock
            FROM items i
            LEFT JOIN (
                SELECT item_id, SUM(quantity)::int as stock
                FROM warehouse_stock
                GROUP BY item_id
            ) ws ON ws.item_id = i.id
            WHERE i.company_id = $1 AND i.is_active = true
            ORDER BY i.created_at DESC
        `;

    const result = await connectDB.query(query, [company_id]);

    const data = result.rows.map((row) => mapDbToFrontend(row));

    return res.json({
      success: true,
      count: data.length,
      data: data,
    });
  } catch (error) {
    console.error('getAllItems error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ============================================
// GET ITEM BY ID
// ============================================
export const getItemById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const query = `
            SELECT 
                i.*,
                i.bom_id,
                i.bom_version,
                COALESCE(ws.stock, 0) as stock
            FROM items i
            LEFT JOIN (
                SELECT item_id, SUM(quantity)::int as stock
                FROM warehouse_stock
                GROUP BY item_id
            ) ws ON ws.item_id = i.id
            WHERE i.id = $1 AND i.company_id = $2
        `;

    const result = await connectDB.query(query, [id, company_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Item not found',
      });
    }

    const data = mapDbToFrontend(result.rows[0]);

    return res.json({
      success: true,
      data: data,
    });
  } catch (error) {
    console.error('getItemById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ============================================
// FILTER ITEMS (Advanced Search)
// ============================================


export const filterItems = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    if (!company_id) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    const {
      categoryId,
      categoryName,
      search,
      warehouseId,
      stockStatus,
      isActive,
      page = 1,
      limit = 20,
    } = req.query;

    const values = [company_id];
    let idx = 2;
    let hasWarehouseFilter = false;
    let warehouseUuid = null;

    // Validate warehouse
    if (
      warehouseId &&
      warehouseId.toUpperCase() !== 'ALL' &&
      isUuid(warehouseId)
    ) {
      warehouseUuid = warehouseId;
      hasWarehouseFilter = true;
      values.push(warehouseUuid);
      idx = 3;
    }

    // Stock JOIN based on warehouse filter
    let stockJoin;
    if (hasWarehouseFilter) {
      stockJoin = `
                LEFT JOIN (
                    SELECT item_id, SUM(quantity)::int as stock
                    FROM warehouse_stock
                    WHERE warehouse_id = $2
                    GROUP BY item_id
                ) ws ON ws.item_id = i.id
            `;
    } else {
      stockJoin = `
                LEFT JOIN (
                    SELECT item_id, SUM(quantity)::int as stock
                    FROM warehouse_stock
                    GROUP BY item_id
                ) ws ON ws.item_id = i.id
            `;
    }

    let query = `
            SELECT 
                i.*,
                 i.bom_id,
                 i.bom_version,
                COALESCE(ws.stock, 0) as stock
            FROM items i
            ${stockJoin}
            WHERE i.company_id = $1
        `;

    // Category filters
    if (
      categoryId &&
      categoryId.toUpperCase() !== 'ALL' &&
      isUuid(categoryId)
    ) {
      query += ` AND i.category_id = $${idx}`;
      values.push(categoryId);
      idx++;
    }

    if (categoryName && categoryName.toUpperCase() !== 'ALL') {
      query += ` AND LOWER(i.category) = LOWER($${idx})`;
      values.push(categoryName.trim());
      idx++;
    }

    // Search filter
    if (search && search.trim()) {
      query += ` AND (
                i.name ILIKE $${idx} OR
                i.code ILIKE $${idx} OR
                i.barcode ILIKE $${idx}
            )`;
      values.push(`%${search.trim()}%`);
      idx++;
    }

    // Stock status filter
    if (stockStatus && stockStatus.toUpperCase() !== 'ALL') {
      const status = stockStatus.toUpperCase();
      if (status === 'IN_STOCK') {
        query += ` AND COALESCE(ws.stock, 0) > 0 
                          AND COALESCE(ws.stock, 0) >= COALESCE(i.min_stock_level, 0)`;
      } else if (status === 'LOW_STOCK') {
        query += ` AND COALESCE(ws.stock, 0) > 0 
                          AND COALESCE(ws.stock, 0) < COALESCE(i.min_stock_level, 0)`;
      } else if (status === 'OUT_OF_STOCK') {
        query += ` AND COALESCE(ws.stock, 0) = 0`;
      }
    }

    // Active filter
    if (isActive && isActive.toUpperCase() !== 'ALL') {
      query += ` AND i.is_active = $${idx}`;
      values.push(isActive.toLowerCase() === 'true');
      idx++;
    }

    // Pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query += ` ORDER BY i.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(parseInt(limit), offset);

    // Get total count
    let countQuery = `
            SELECT COUNT(*) as total
            FROM items i
            ${stockJoin}
            WHERE i.company_id = $1
        `;

    // Copy filters for count query (without pagination)
    let countIdx = 2;
    let countValues = [company_id];

    if (
      categoryId &&
      categoryId.toUpperCase() !== 'ALL' &&
      isUuid(categoryId)
    ) {
      countQuery += ` AND i.category_id = $${countIdx}`;
      countValues.push(categoryId);
      countIdx++;
    }
    if (categoryName && categoryName.toUpperCase() !== 'ALL') {
      countQuery += ` AND LOWER(i.category) = LOWER($${countIdx})`;
      countValues.push(categoryName.trim());
      countIdx++;
    }
    if (search && search.trim()) {
      countQuery += ` AND (i.name ILIKE $${countIdx} OR i.code ILIKE $${countIdx} OR i.barcode ILIKE $${countIdx})`;
      countValues.push(`%${search.trim()}%`);
      countIdx++;
    }
    if (stockStatus && stockStatus.toUpperCase() !== 'ALL') {
      const status = stockStatus.toUpperCase();
      if (status === 'IN_STOCK') {
        countQuery += ` AND COALESCE(ws.stock, 0) > 0 AND COALESCE(ws.stock, 0) >= COALESCE(i.min_stock_level, 0)`;
      } else if (status === 'LOW_STOCK') {
        countQuery += ` AND COALESCE(ws.stock, 0) > 0 AND COALESCE(ws.stock, 0) < COALESCE(i.min_stock_level, 0)`;
      } else if (status === 'OUT_OF_STOCK') {
        countQuery += ` AND COALESCE(ws.stock, 0) = 0`;
      }
    }
    if (isActive && isActive.toUpperCase() !== 'ALL') {
      countQuery += ` AND i.is_active = $${countIdx}`;
      countValues.push(isActive.toLowerCase() === 'true');
    }

    const countResult = await connectDB.query(countQuery, countValues);
    const total = parseInt(countResult.rows[0]?.total || 0);

    // Execute main query
    const result = await connectDB.query(query, values);
    const data = result.rows.map((row) => mapDbToFrontend(row));

    return res.json({
      success: true,
      data: data,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('filterItems error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};



// ============================================
// GET ALL ITEMS WITH VARIANTS FOR BOM DROPDOWN (GROUPED)
// ============================================
// ============================================
// GET ALL ITEMS WITH VARIANTS FOR BOM DROPDOWN (GROUPED)
// ============================================
export const getItemsWithVariantsForBOM = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    // 1. Get all active items
    const itemsQuery = `
      SELECT 
        id, 
        name, 
        code, 
        'item' as type,
        NULL as parent_item_id,
        NULL as parent_item_name,
        NULL as variant_name,
        NULL as variant_sku,
        purchase_rate,
        sale_rate,
        unit_name,
        category,
        enable_variants,
        bom_id,
        bom_version
      FROM items
      WHERE company_id = $1 AND is_active = true
      ORDER BY name ASC
    `;
    
    const itemsResult = await connectDB.query(itemsQuery, [company_id]);
    
    // 2. Build grouped structure
    const groupedItems = [];
    
    for (const item of itemsResult.rows) {
      const group = {
        id: item.id,
        name: item.name,
        code: item.code,
        type: 'item',
        category: item.category,
        unit_name: item.unit_name,
        purchase_rate: parseFloat(item.purchase_rate || 0),
        sale_rate: parseFloat(item.sale_rate || 0),
        bom_id: item.bom_id,
        bom_version: item.bom_version,
        variants: []
      };
      
      // If item has variants, fetch them
      if (item.enable_variants) {
        const variantsQuery = `
          SELECT 
            id,
            parent_item_id,
            variant_name,
            code,
            variant_sku,
            sale_rate,
            purchase_rate,
            mrp,
            bom_id,
            bom_version
          FROM item_variants
          WHERE parent_item_id = $1 AND is_active = true
          ORDER BY variant_name ASC
        `;
        
        const variantsResult = await connectDB.query(variantsQuery, [item.id]);
        
        for (const variant of variantsResult.rows) {
          group.variants.push({
            id: variant.id,
            name: variant.variant_name,
            code: variant.code,
            type: 'variant',
            parent_item_id: variant.parent_item_id,
            parent_item_name: item.name,
            variant_name: variant.variant_name,
            variant_sku: variant.variant_sku,
            purchase_rate: parseFloat(variant.purchase_rate || 0),
            sale_rate: parseFloat(variant.sale_rate || 0),
            unit_name: item.unit_name,
            bom_id: variant.bom_id,
            bom_version: variant.bom_version,
          });
        }
      }
      
      groupedItems.push(group);
    }
    
    return res.json({
      success: true,
      count: groupedItems.length,
      data: groupedItems,
    });
    
  } catch (error) {
    console.error('getItemsWithVariantsForBOM error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};