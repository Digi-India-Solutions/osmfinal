import { connectDB } from '../../../pool.js';

// GET /api/v1/item/:id/variants
export const getVariants = async (req, res) => {
  try {
    const { id } = req.params;

    const itemCheck = await connectDB.query(
      'SELECT id FROM items WHERE id = $1',
      [id],
    );
    if (itemCheck.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Item not found' });
    }

    const result = await connectDB.query(
      `SELECT id, parent_item_id, variant_name, code, variant_sku,
        sale_rate, purchase_rate, mrp, initial_stock,
        is_active, variant_attributes, warehouse_id,
        created_at, updated_at
       FROM item_variants
       WHERE parent_item_id = $1
       ORDER BY created_at ASC`,
      [id],
    );

    return res.json({
      success: true,
      count: result.rowCount,
      data: result.rows,
    });
  } catch (err) {
    console.error('getVariants error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

// POST /api/v1/item/:id/variants
export const createVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      variantName,
      code,
      variantSku,
      saleRate,
      purchaseRate,
      mrp,
      initialStock,
      isActive,
      variantAttributes,
      warehouseId,
    } = req.body;

    if (!variantName?.trim())
      return res
        .status(400)
        .json({ success: false, message: 'Variant name is required' });
    if (!code?.trim())
      return res
        .status(400)
        .json({ success: false, message: 'Variant code is required' });

    const itemCheck = await connectDB.query(
      'SELECT id FROM items WHERE id = $1 AND enable_variants = true',
      [id],
    );
    if (itemCheck.rowCount === 0) {
      return res
        .status(404)
        .json({
          success: false,
          message: 'Parent item not found or variants not enabled',
        });
    }

    const dupCheck = await connectDB.query(
      'SELECT id FROM item_variants WHERE code = $1',
      [code.trim()],
    );
    if (dupCheck.rowCount > 0) {
      return res
        .status(409)
        .json({
          success: false,
          message: `Variant code "${code}" already exists`,
        });
    }

    const result = await connectDB.query(
      `INSERT INTO item_variants 
        (parent_item_id, variant_name, code, variant_sku, sale_rate,
         purchase_rate, mrp, initial_stock, is_active, variant_attributes, warehouse_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        id,
        variantName.trim(),
        code.trim(),
        variantSku?.trim() || code.trim(),
        saleRate ?? 0,
        purchaseRate ?? 0,
        mrp ?? 0,
        initialStock ?? 0,
        isActive ?? true,
        variantAttributes ? JSON.stringify(variantAttributes) : null,
        warehouseId || null,
      ],
    );

    return res
      .status(201)
      .json({
        success: true,
        message: 'Variant created successfully',
        data: result.rows[0],
      });
  } catch (err) {
    console.error('createVariant error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateVariant = async (req, res) => {
  try {
    const { id, variantId } = req.params;
    const {
      variantName,
      variantSku,
      saleRate,
      purchaseRate,
      mrp,
      isActive,
      variantAttributes,
    } = req.body;

    const result = await connectDB.query(
      `UPDATE item_variants SET
        variant_name = COALESCE($1, variant_name),
        variant_sku = COALESCE($2, variant_sku),
        sale_rate = COALESCE($3, sale_rate),
        purchase_rate = COALESCE($4, purchase_rate),
        mrp = COALESCE($5, mrp),
        is_active = COALESCE($6, is_active),
        variant_attributes = $7,
        updated_at = NOW()
       WHERE id = $8 AND parent_item_id = $9
       RETURNING *`,
      [
        variantName?.trim() || null,
        variantSku?.trim() || null,
        saleRate ?? null,
        purchaseRate ?? null,
        mrp ?? null,
        isActive ?? null,
        variantAttributes ? JSON.stringify(variantAttributes) : null,
        variantId,
        id,
      ],
    );

    if (result.rowCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Variant not found' });
    }

    return res.json({
      success: true,
      message: 'Variant updated',
      data: result.rows[0],
    });
  } catch (err) {
    console.error('updateVariant error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
};
