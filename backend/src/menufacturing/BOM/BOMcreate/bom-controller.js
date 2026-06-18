import connectDB from '../../../pool.js';

// ============================================
// HELPER FUNCTIONS
// ============================================

// Generate BOM code with auto-increment (per product)
const generateBomCode = async (company_id, productCode = null) => {
  let prefix = 'BOM';
  if (productCode) {
    const cleanCode = productCode.replace(/[^A-Za-z0-9]/g, '');
    prefix = `BOM-${cleanCode}`;
  }

  const result = await connectDB.query(
    `SELECT code FROM bom_master 
     WHERE company_id = $1 AND code LIKE $2
     ORDER BY CAST(SUBSTRING(code FROM '-([0-9]+)$') AS INTEGER) DESC NULLS LAST
     LIMIT 1`,
    [company_id, `${prefix}-%`],
  );

  let nextNumber = 1;
  if (result.rows.length > 0) {
    const lastCode = result.rows[0].code;
    const match = lastCode.match(/-(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  const paddedNumber = nextNumber.toString().padStart(3, '0');
  return `${prefix}-${paddedNumber}`;
};

// Get item details
const getItemDetails = async (itemId) => {
  const result = await connectDB.query(
    'SELECT purchase_rate, item_type, unit_name FROM items WHERE id = $1',
    [itemId],
  );
  return {
    rate: parseFloat(result.rows[0]?.purchase_rate || 0),
    type: result.rows[0]?.item_type || 'RAW_MATERIAL',
    unit: result.rows[0]?.unit_name || 'Pcs',
  };
};

// Calculate item totals with scrap
const calculateItemTotals = async (items) => {
  if (!items || !Array.isArray(items)) {
    return { itemsWithPrice: [], totalCost: 0 };
  }

  let totalCost = 0;
  const itemsWithPrice = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const {
      rate: unitPrice,
      type: itemType,
      unit: unitName,
    } = await getItemDetails(item.itemId);
    const scrapFactor = 1 + (item.scrapPercentage || 0) / 100;
    const totalPrice = unitPrice * item.quantity * scrapFactor;
    totalCost += totalPrice;

    itemsWithPrice.push({
      ...item,
      unitPrice,
      totalPrice,
      itemType,
      unitName,
    });
  }

  return { itemsWithPrice, totalCost };
};

// Calculate BOM levels
const calculateLevels = async (items, visited = new Set()) => {
  let maxLevel = 1;

  for (const item of items) {
    if (visited.has(item.itemId)) continue;
    visited.add(item.itemId);

    const result = await connectDB.query(
      `SELECT levels FROM bom_master 
       WHERE product_id = $1 AND status = 'ACTIVE' 
       LIMIT 1`,
      [item.itemId],
    );

    if (result.rows.length > 0) {
      maxLevel = Math.max(maxLevel, result.rows[0].levels + 1);
    }
  }

  return maxLevel;
};

// Get BOM by ID with all details
const getBOMById = async (id, client) => {
  const bomResult = await client.query(
    `SELECT b.*, i.name as product_name, i.code as product_code, i.item_type as product_type,
            w.name as warehouse_name
     FROM bom_master b
     JOIN items i ON b.product_id = i.id
     LEFT JOIN warehouses w ON b.warehouse_id = w.id
     WHERE b.id = $1`,
    [id],
  );

  if (bomResult.rows.length === 0) return null;

  const bom = bomResult.rows[0];

  const itemsResult = await client.query(
    `SELECT bi.*, i.name as item_name, i.code as item_code, i.item_type
     FROM bom_items bi
     JOIN items i ON bi.item_id = i.id
     WHERE bi.bom_id = $1
     ORDER BY bi.sequence_no`,
    [id],
  );

  let rawTotal = 0,
    semiTotal = 0,
    consumableTotal = 0,
    packagingTotal = 0,
    scrapTotal = 0;

  for (const item of itemsResult.rows) {
    const baseCost = item.quantity * parseFloat(item.unit_price);
    const scrapAmount = baseCost * (item.scrap_percentage / 100);
    scrapTotal += scrapAmount;

    if (item.item_type === 'RAW_MATERIAL') rawTotal += baseCost + scrapAmount;
    else if (item.item_type === 'SEMI_FINISHED')
      semiTotal += baseCost + scrapAmount;
    else if (item.item_type === 'CONSUMABLE')
      consumableTotal += baseCost + scrapAmount;
    else if (item.item_type === 'PACKAGING')
      packagingTotal += baseCost + scrapAmount;
  }

  const total = rawTotal + semiTotal + consumableTotal + packagingTotal;

  return {
    ...bom,
    items: itemsResult.rows,
    summary: {
      raw: rawTotal,
      semi: semiTotal,
      consumable: consumableTotal,
      packaging: packagingTotal,
      total: total,
      scrapCost: scrapTotal,
    },
  };
};

// ============================================
// 📌 CREATE BOM
// ============================================
export const createBom = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const {
      code,
      productId,
      version,
      effectiveFrom,
      effectiveTo,
      isVariantBom,
      variantName,
      warehouseId,
      linkToItemMaster,
      items,
    } = req.body;

    const company_id = req.user.company_id;
    const created_by = req.user.id;

    if (!productId || !version || !effectiveFrom || !warehouseId) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message:
          'Missing required fields: productId, version, effectiveFrom, warehouseId',
      });
    }

    if (!items || items.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'At least one component is required',
      });
    }

    const warehouseCheck = await client.query(
      `SELECT id FROM warehouses WHERE id = $1 AND company_id = $2`,
      [warehouseId, company_id],
    );

    if (warehouseCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Invalid warehouse for this company',
      });
    }

    const productCheck = await client.query(
      `SELECT id, name, code, item_type FROM items WHERE id = $1 AND company_id = $2`,
      [productId, company_id],
    );

    if (productCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'Product not found',
      });
    }

    const productCode = productCheck.rows[0].code;
    const bomCode = code || (await generateBomCode(company_id, productCode));
    const { itemsWithPrice, totalCost } = await calculateItemTotals(items);
    const levels = await calculateLevels(items);
    const totalItems = items.length;

    const bomResult = await client.query(
      `INSERT INTO bom_master 
       (code, product_id, version, status, is_variant_bom, variant_name, 
        effective_from, effective_to, levels, total_items, total_material_cost,
        warehouse_id, company_id, created_by, updated_by, link_to_item_master)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING *`,
      [
        bomCode,
        productId,
        version,
        'DRAFT',
        isVariantBom || false,
        variantName || null,
        effectiveFrom,
        effectiveTo || null,
        levels,
        totalItems,
        totalCost,
        warehouseId,
        company_id,
        created_by,
        created_by,
        linkToItemMaster || false,
      ],
    );

    const bom = bomResult.rows[0];

    for (let i = 0; i < itemsWithPrice.length; i++) {
      const item = itemsWithPrice[i];
      await client.query(
        `INSERT INTO bom_items 
         (bom_id, item_id, quantity, scrap_percentage, unit_price, total_price, sequence_no, item_type, unit_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          bom.id,
          item.itemId,
          item.quantity,
          item.scrapPercentage || 0,
          item.unitPrice,
          item.totalPrice,
          item.sequenceNo || i + 1,
          item.itemType,
          item.unitName,
        ],
      );
    }

    // ✅ FIX: Update item with bom_id, bom_version when linked
    if (linkToItemMaster) {
      await client.query(
        `UPDATE items SET 
          bom_id = $1, 
          bom_version = $2, 
          standard_cost = $3,
          updated_at = NOW()
         WHERE id = $4 AND company_id = $5`,
        [bom.id, version, totalCost, productId, company_id],
      );
    }

    await client.query('COMMIT');

    const completeBom = await getBOMById(bom.id, client);

    res.status(201).json({
      success: true,
      data: completeBom,
      message: 'BOM created successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('createBom error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 GET ALL BOMS
// ============================================
export const getAllBoms = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const {
      status,
      type,
      search,
      warehouseId,
      page = '1',
      limit = '20',
    } = req.query;

    let query = `
      SELECT b.*, 
             i.name as product_name,
             i.code as product_code,
             w.name as warehouse_name,
             COALESCE((SELECT COUNT(*) FROM bom_items WHERE bom_id = b.id), 0) as actual_items
      FROM bom_master b
      JOIN items i ON b.product_id = i.id
      LEFT JOIN warehouses w ON b.warehouse_id = w.id
      WHERE b.company_id = $1
    `;
    const params = [company_id];
    let paramIndex = 2;

    if (warehouseId) {
      query += ` AND b.warehouse_id = $${paramIndex++}`;
      params.push(warehouseId);
    }
    if (status && status !== 'ALL') {
      query += ` AND b.status = $${paramIndex++}`;
      params.push(status);
    }
    if (type === 'REGULAR') {
      query += ` AND b.is_variant_bom = false`;
    } else if (type === 'VARIANT') {
      query += ` AND b.is_variant_bom = true`;
    }
    if (search) {
      query += ` AND (b.code ILIKE $${paramIndex++} OR i.name ILIKE $${paramIndex++} OR i.code ILIKE $${paramIndex++})`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY b.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));

    const result = await connectDB.query(query, params);

    let countQuery = `SELECT COUNT(*) FROM bom_master b WHERE b.company_id = $1`;
    const countParams = [company_id];
    let countIndex = 2;

    if (warehouseId) {
      countQuery += ` AND b.warehouse_id = $${countIndex++}`;
      countParams.push(warehouseId);
    }
    if (status && status !== 'ALL') {
      countQuery += ` AND b.status = $${countIndex++}`;
      countParams.push(status);
    }

    const countResult = await connectDB.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        totalPages: Math.ceil(
          parseInt(countResult.rows[0].count) / parseInt(limit),
        ),
      },
    });
  } catch (error) {
    console.error('getAllBoms error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============================================
// 📌 GET SINGLE BOM
// ============================================
export const getBomById = async (req, res) => {
  const client = await connectDB.connect();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const verify = await client.query(
      `SELECT id FROM bom_master WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (verify.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    const bom = await getBOMById(id, client);

    res.json({
      success: true,
      data: bom,
    });
  } catch (error) {
    console.error('getBomById error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 UPDATE BOM
// ============================================
export const updateBom = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const company_id = req.user.company_id;
    const {
      version,
      status,
      effectiveFrom,
      effectiveTo,
      variantName,
      warehouseId,
      linkToItemMaster,
      items,
    } = req.body;

    const existingBom = await client.query(
      `SELECT id, product_id FROM bom_master WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (existingBom.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    const productId = existingBom.rows[0].product_id;

    const updateFields = [];
    const values = [];
    let paramIndex = 1;

    if (version !== undefined) {
      updateFields.push(`version = $${paramIndex++}`);
      values.push(version);
    }
    if (status !== undefined) {
      updateFields.push(`status = $${paramIndex++}`);
      values.push(status);
    }
    if (effectiveFrom !== undefined) {
      updateFields.push(`effective_from = $${paramIndex++}`);
      values.push(effectiveFrom);
    }
    if (effectiveTo !== undefined) {
      updateFields.push(`effective_to = $${paramIndex++}`);
      values.push(effectiveTo);
    }
    if (variantName !== undefined) {
      updateFields.push(`variant_name = $${paramIndex++}`);
      values.push(variantName);
    }
    if (warehouseId !== undefined) {
      updateFields.push(`warehouse_id = $${paramIndex++}`);
      values.push(warehouseId);
    }
    if (linkToItemMaster !== undefined) {
      updateFields.push(`link_to_item_master = $${paramIndex++}`);
      values.push(linkToItemMaster);
    }

    updateFields.push(`updated_at = NOW()`);

    if (updateFields.length > 1) {
      values.push(id);
      await client.query(
        `UPDATE bom_master SET ${updateFields.join(', ')} WHERE id = $${paramIndex}`,
        values,
      );
    }

    if (items && items.length > 0) {
      await client.query('DELETE FROM bom_items WHERE bom_id = $1', [id]);

      const { itemsWithPrice, totalCost } = await calculateItemTotals(items);
      const levels = await calculateLevels(items);

      for (let i = 0; i < itemsWithPrice.length; i++) {
        const item = itemsWithPrice[i];
        await client.query(
          `INSERT INTO bom_items 
           (bom_id, item_id, quantity, scrap_percentage, unit_price, total_price, sequence_no, item_type, unit_name)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            id,
            item.itemId,
            item.quantity,
            item.scrapPercentage || 0,
            item.unitPrice,
            item.totalPrice,
            item.sequenceNo || i + 1,
            item.itemType,
            item.unitName,
          ],
        );
      }

      await client.query(
        `UPDATE bom_master SET total_items = $1, total_material_cost = $2, levels = $3 WHERE id = $4`,
        [items.length, totalCost, levels, id],
      );

      // ✅ FIX: Update item when linked/unlinked
      if (linkToItemMaster === true) {
        await client.query(
          `UPDATE items SET 
            bom_id = $1, 
            bom_version = $2, 
            standard_cost = $3,
            updated_at = NOW()
           WHERE id = $4 AND company_id = $5`,
          [id, version, totalCost, productId, company_id],
        );
      } else if (linkToItemMaster === false) {
        await client.query(
          `UPDATE items SET 
            bom_id = NULL, 
            bom_version = NULL,
            updated_at = NOW()
           WHERE id = $1 AND company_id = $2`,
          [productId, company_id],
        );
      }
    }

    await client.query('COMMIT');

    const updatedBom = await getBOMById(id, client);

    res.json({
      success: true,
      data: updatedBom,
      message: 'BOM updated successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateBom error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 DELETE BOM
// ============================================
export const deleteBom = async (req, res) => {
  const client = await connectDB.connect();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const checkResult = await client.query(
      'SELECT id FROM bom_master WHERE id = $1 AND company_id = $2',
      [id, company_id],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    // First, get product_id to clear item's bom_id
    const bomResult = await client.query(
      'SELECT product_id FROM bom_master WHERE id = $1 AND company_id = $2',
      [id, company_id],
    );

    if (bomResult.rows.length > 0) {
      // Clear item's bom_id and bom_version
      await client.query(
        `UPDATE items SET 
          bom_id = NULL, 
          bom_version = NULL,
          updated_at = NOW()
         WHERE id = $1 AND company_id = $2`,
        [bomResult.rows[0].product_id, company_id],
      );
    }

    await client.query('DELETE FROM bom_items WHERE bom_id = $1', [id]);
    await client.query(
      'DELETE FROM bom_master WHERE id = $1 AND company_id = $2',
      [id, company_id],
    );

    await client.query('COMMIT');

    res.json({ success: true, message: 'BOM deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteBom error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 DUPLICATE BOM
// ============================================
export const duplicateBom = async (req, res) => {
  const client = await connectDB.connect();

  try {
    await client.query('BEGIN');

    const { id } = req.params;
    const company_id = req.user.company_id;
    const user_id = req.user.id;

    const existingBom = await client.query(
      `SELECT b.*, i.name as product_name, i.code as product_code 
       FROM bom_master b
       JOIN items i ON b.product_id = i.id
       WHERE b.id = $1 AND b.company_id = $2`,
      [id, company_id],
    );

    if (existingBom.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    const bom = existingBom.rows[0];

    const versionParts = bom.version.split('.');
    const major = parseInt(versionParts[0]);
    const minor = parseInt(versionParts[1]) || 0;
    const newVersion = `${major}.${minor + 1}`;

    const newCode = await generateBomCode(company_id, bom.product_code);

    const existingItems = await client.query(
      `SELECT item_id, quantity, scrap_percentage, unit_price, sequence_no, item_type, unit_name
       FROM bom_items WHERE bom_id = $1`,
      [id],
    );

    const newBomResult = await client.query(
      `INSERT INTO bom_master 
       (code, product_id, version, status, is_variant_bom, variant_name, 
        effective_from, levels, total_items, total_material_cost,
        warehouse_id, company_id, created_by, updated_by, link_to_item_master)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        newCode,
        bom.product_id,
        newVersion,
        'DRAFT',
        bom.is_variant_bom,
        bom.variant_name,
        new Date().toISOString().split('T')[0],
        bom.levels,
        bom.total_items,
        bom.total_material_cost,
        bom.warehouse_id,
        company_id,
        user_id,
        user_id,
        false,
      ],
    );

    const newBom = newBomResult.rows[0];

    for (const item of existingItems.rows) {
      await client.query(
        `INSERT INTO bom_items (bom_id, item_id, quantity, scrap_percentage, unit_price, sequence_no, item_type, unit_name)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          newBom.id,
          item.item_id,
          item.quantity,
          item.scrap_percentage,
          item.unit_price,
          item.sequence_no,
          item.item_type,
          item.unit_name,
        ],
      );
    }

    await client.query('COMMIT');

    const completeBom = await getBOMById(newBom.id, client);

    res.status(201).json({
      success: true,
      data: completeBom,
      message: 'BOM duplicated successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('duplicateBom error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 LINK TO ITEM MASTER
// ============================================
export const linkToItemMaster = async (req, res) => {
  const client = await connectDB.connect();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const bomResult = await client.query(
      `SELECT b.id, b.product_id, b.total_material_cost, b.version
       FROM bom_master b
       WHERE b.id = $1 AND b.company_id = $2`,
      [id, company_id],
    );

    if (bomResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    const bom = bomResult.rows[0];

    await client.query('BEGIN');

    await client.query(
      `UPDATE bom_master SET link_to_item_master = true, updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    await client.query(
      `UPDATE items SET 
        bom_id = $1, 
        bom_version = $2, 
        standard_cost = $3,
        updated_at = NOW()
       WHERE id = $4 AND company_id = $5`,
      [id, bom.version, bom.total_material_cost, bom.product_id, company_id],
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'BOM linked to item master successfully',
      data: {
        linkToItemMaster: true,
        standardCost: bom.total_material_cost,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('linkToItemMaster error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};

// ============================================
// 📌 UNLINK FROM ITEM MASTER
// ============================================
export const unlinkFromItemMaster = async (req, res) => {
  const client = await connectDB.connect();

  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const bomResult = await client.query(
      `SELECT product_id FROM bom_master 
       WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (bomResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'BOM not found' });
    }

    const productId = bomResult.rows[0].product_id;

    await client.query('BEGIN');

    await client.query(
      `UPDATE bom_master SET link_to_item_master = false, updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    await client.query(
      `UPDATE items SET 
        bom_id = NULL, 
        bom_version = NULL,
        updated_at = NOW()
       WHERE id = $1 AND company_id = $2`,
      [productId, company_id],
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'BOM unlinked from item master successfully',
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('unlinkFromItemMaster error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};
