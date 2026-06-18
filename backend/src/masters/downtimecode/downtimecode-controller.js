import { connectDB } from '../../pool.js';

const VALID_CATEGORIES = [
  'BREAKDOWN',
  'PLANNED',
  'MATERIAL',
  'POWER',
  'OPERATOR',
  'SETUP',
  'OTHER',
];

// ✅ CREATE DOWNTIME CODE
export const createDowntimeCode = async (req, res) => {
  try {
    const {
      code,
      description,
      category,
      affects_machine,
      is_active,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!code || !code.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Downtime Code is required' });
    }
    if (!description || !description.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Description is required' });
    }
    if (!category || !VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // ✅ Duplicate check on Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public."Downtime-Codes" 
       WHERE LOWER(code) = LOWER($1)`,
      [code.trim()],
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Downtime Code already exists',
      });
    }

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Downtime-Codes"
      (code, description, category, affects_machine, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        code.trim().toUpperCase(),
        description.trim(),
        category.toUpperCase(),
        affects_machine ?? false,
        is_active ?? true,
        warehouse_id || null,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Downtime Code created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ UPDATE DOWNTIME CODE
export const updateDowntimeCode = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      code,
      description,
      category,
      affects_machine,
      is_active,
      warehouse_id,
    } = req.body;

    // 🔍 Check if downtime code exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Downtime-Codes" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime Code not found',
      });
    }

    // 🔍 Code duplicate check if code is being changed
    if (
      code &&
      code.trim().toLowerCase() !== existing.rows[0].code.toLowerCase()
    ) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Downtime-Codes" 
         WHERE LOWER(code) = LOWER($1) AND id <> $2`,
        [code.trim(), id],
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Another Downtime Code with this Code already exists',
        });
      }
    }

    // 🔍 Category validation if changing
    if (category && !VALID_CATEGORIES.includes(category.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Category must be one of: ${VALID_CATEGORIES.join(', ')}`,
      });
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Downtime-Codes" SET
        code = COALESCE($1, code),
        description = COALESCE($2, description),
        category = COALESCE($3, category),
        affects_machine = COALESCE($4, affects_machine),
        is_active = COALESCE($5, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($7, warehouse_id)
      WHERE id = $6
      RETURNING *`,
      [
        code ? code.trim().toUpperCase() : null,
        description ? description.trim() : null,
        category ? category.toUpperCase() : null,
        affects_machine !== undefined ? affects_machine : null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null,
      ],
    );

    res.json({
      success: true,
      message: 'Downtime Code updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ DELETE DOWNTIME CODE
export const deleteDowntimeCode = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Downtime-Codes"  
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime Code not found',
      });
    }

    res.json({
      success: true,
      message: 'Downtime Code deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ GET ALL DOWNTIME CODES
export const getAllDowntimeCodes = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Downtime-Codes"
       ORDER BY created_at DESC`,
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

// ✅ GET DOWNTIME CODES FOR DROPDOWN (Only id, code and description - Active codes)
export const getDowntimeCodesForDropdown = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT id, code, description 
       FROM public."Downtime-Codes" 
       WHERE is_active = true
       ORDER BY code ASC`,
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
