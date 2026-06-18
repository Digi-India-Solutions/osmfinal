import { connectDB } from '../../pool.js';
import crypto from 'crypto';

// ✅ CREATE ROUTING
export const createRouting = async (req, res) => {
  try {
    const {
      id,
      name,
      code,
      item_id,
      item_name,
      version,
      status,
      stages,
      total_time_minutes,
      is_active,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Name is required' });
    }
    if (!code || !code.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Code is required' });
    }
    if (
      !status ||
      !['ACTIVE', 'DRAFT', 'OBSOLETE'].includes(status.toUpperCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid Status is required ('ACTIVE', 'DRAFT', 'OBSOLETE')",
      });
    }

    // ✅ Duplicate check on Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public.routings WHERE LOWER(code) = LOWER($1)`,
      [code.trim()],
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Routing Code already exists',
      });
    }

    const finalId = id || crypto.randomUUID();
    const finalStages = stages
      ? typeof stages === 'string'
        ? stages
        : JSON.stringify(stages)
      : '[]';
    const finalTotalTime =
      total_time_minutes !== undefined ? Number(total_time_minutes) : 0;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public.routings
      (id, name, code, item_id, item_name, version, status, stages, total_time_minutes, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        finalId,
        name.trim(),
        code.trim().toUpperCase(),
        item_id || null,
        item_name || null,
        version || '1.0',
        status.toUpperCase(),
        finalStages,
        finalTotalTime,
        is_active ?? true,
        warehouse_id || null,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Routing created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ UPDATE ROUTING
export const updateRouting = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      item_id,
      item_name,
      version,
      status,
      stages,
      total_time_minutes,
      is_active,
      warehouse_id,
    } = req.body;

    // 🔍 Check if routing exists
    const existing = await connectDB.query(
      `SELECT * FROM public.routings WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Routing not found',
      });
    }

    // 🔍 Code duplicate check if code is being changed
    if (
      code &&
      code.trim().toLowerCase() !== existing.rows[0].code.toLowerCase()
    ) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public.routings WHERE LOWER(code) = LOWER($1) AND id <> $2`,
        [code.trim(), id],
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Another Routing with this Code already exists',
        });
      }
    }

    // Validate status if provided
    if (
      status &&
      !['ACTIVE', 'DRAFT', 'OBSOLETE'].includes(status.toUpperCase())
    ) {
      return res.status(400).json({
        success: false,
        message: "Valid Status is required ('ACTIVE', 'DRAFT', 'OBSOLETE')",
      });
    }

    const finalStages =
      stages !== undefined
        ? typeof stages === 'string'
          ? stages
          : JSON.stringify(stages)
        : null;

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public.routings SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        item_id = COALESCE($3, item_id),
        item_name = COALESCE($4, item_name),
        version = COALESCE($5, version),
        status = COALESCE($6, status),
        stages = COALESCE($7, stages),
        total_time_minutes = COALESCE($8, total_time_minutes),
        is_active = COALESCE($9, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($11, warehouse_id)
      WHERE id = $10
      RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        item_id || null,
        item_name || null,
        version || null,
        status ? status.toUpperCase() : null,
        finalStages,
        total_time_minutes !== undefined ? Number(total_time_minutes) : null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null,
      ],
    );

    res.json({
      success: true,
      message: 'Routing updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ DELETE ROUTING
export const deleteRouting = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public.routings WHERE id = $1 RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Routing not found',
      });
    }

    res.json({
      success: true,
      message: 'Routing deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ GET ALL ROUTINGS
export const getAllRoutings = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public.routings ORDER BY created_at DESC`,
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ GET ROUTINGS FOR DROPDOWN (id + name only)
export const getRoutingsForDropdown = async (req, res) => {
  try {
    // Temporary fix - remove company_id filter
    const query = `
      SELECT id, name, code, status
      FROM public.routings
      WHERE status = 'ACTIVE'
      ORDER BY name ASC
    `;

    const result = await connectDB.query(query, []);

    console.log('Routings found:', result.rows.length); // ✅ Debug log

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('getRoutingsForDropdown error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};