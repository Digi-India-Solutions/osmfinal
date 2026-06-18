import { connectDB } from '../../pool.js';

const VALID_SKILLS = [
  'WELDER',
  'MACHINIST',
  'ASSEMBLER',
  'QC_INSPECTOR',
  'SUPERVISOR',
];

// ✅ CREATE OPERATOR
export const createOperator = async (req, res) => {
  try {
    const {
      name,
      employee_code,
      skill,
      wage_rate_per_hour,
      shift_id,
      phone,
      is_active,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!name || !name.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Operator Name is required' });
    }
    if (!employee_code || !employee_code.trim()) {
      return res
        .status(400)
        .json({ success: false, message: 'Employee Code is required' });
    }
    if (!skill || !VALID_SKILLS.includes(skill.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Skill must be one of: ${VALID_SKILLS.join(', ')}`,
      });
    }
    if (
      wage_rate_per_hour === undefined ||
      isNaN(Number(wage_rate_per_hour)) ||
      Number(wage_rate_per_hour) < 0
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Valid Wage Rate per Hour is required',
        });
    }

    // ✅ Duplicate check on Employee Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public."Operators" 
       WHERE LOWER(employee_code) = LOWER($1)`,
      [employee_code.trim()],
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Operator with this Employee Code already exists',
      });
    }

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Operators"
      (name, employee_code, skill, wage_rate_per_hour, shift_id, phone, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        name.trim(),
        employee_code.trim(),
        skill.toUpperCase(),
        Number(wage_rate_per_hour),
        shift_id || null,
        phone || null,
        is_active ?? true,
        warehouse_id || null,
      ],
    );

    // Get shift name if joined
    let shift_name = null;
    if (shift_id) {
      const shiftRes = await connectDB.query(
        `SELECT name FROM public."Shifts" WHERE id = $1`,
        [shift_id],
      );
      if (shiftRes.rows.length > 0) {
        shift_name = shiftRes.rows[0].name;
      }
    }

    res.status(201).json({
      success: true,
      message: 'Operator created successfully',
      data: {
        ...result.rows[0],
        shift_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ UPDATE OPERATOR
export const updateOperator = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      employee_code,
      skill,
      wage_rate_per_hour,
      shift_id,
      phone,
      is_active,
      warehouse_id,
    } = req.body;

    // 🔍 Check if operator exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Operators" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found',
      });
    }

    // 🔍 Employee Code duplicate check if code is being changed
    if (
      employee_code &&
      employee_code.trim().toLowerCase() !==
        existing.rows[0].employee_code.toLowerCase()
    ) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Operators" 
         WHERE LOWER(employee_code) = LOWER($1) AND id <> $2`,
        [employee_code.trim(), id],
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Another Operator with this Employee Code already exists',
        });
      }
    }

    // 🔍 Skill validation if changing
    if (skill && !VALID_SKILLS.includes(skill.toUpperCase())) {
      return res.status(400).json({
        success: false,
        message: `Skill must be one of: ${VALID_SKILLS.join(', ')}`,
      });
    }

    // 🔍 Wage check if changing
    if (
      wage_rate_per_hour !== undefined &&
      (isNaN(Number(wage_rate_per_hour)) || Number(wage_rate_per_hour) < 0)
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: 'Valid Wage Rate per Hour is required',
        });
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Operators" SET
        name = COALESCE($1, name),
        employee_code = COALESCE($2, employee_code),
        skill = COALESCE($3, skill),
        wage_rate_per_hour = COALESCE($4, wage_rate_per_hour),
        shift_id = CASE WHEN $5 = 'null' THEN NULL WHEN $5 IS NULL THEN shift_id ELSE $5::UUID END,
        phone = COALESCE($6, phone),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($9, warehouse_id)
      WHERE id = $8
      RETURNING *`,
      [
        name ? name.trim() : null,
        employee_code ? employee_code.trim() : null,
        skill ? skill.toUpperCase() : null,
        wage_rate_per_hour !== undefined ? Number(wage_rate_per_hour) : null,
        shift_id === null ? 'null' : shift_id || null,
        phone || null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null,
      ],
    );

    // Get shift name if joined
    let shift_name = null;
    const finalShiftId = result.rows[0].shift_id;
    if (finalShiftId) {
      const shiftRes = await connectDB.query(
        `SELECT name FROM public."Shifts" WHERE id = $1`,
        [finalShiftId],
      );
      if (shiftRes.rows.length > 0) {
        shift_name = shiftRes.rows[0].name;
      }
    }

    res.json({
      success: true,
      message: 'Operator updated successfully',
      data: {
        ...result.rows[0],
        shift_name,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ DELETE OPERATOR
export const deleteOperator = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Operators"  
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found',
      });
    }

    res.json({
      success: true,
      message: 'Operator deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ GET ALL OPERATORS
export const getAllOperators = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT o.*, s.name as shift_name 
       FROM public."Operators" o
       LEFT JOIN public."Shifts" s ON o.shift_id = s.id
       ORDER BY o.created_at DESC`,
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

// ✅ GET OPERATORS FOR DROPDOWN (Only id and name - Active operators)
export const getOperatorsForDropdown = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT id, name 
       FROM public."Operators" 
       WHERE is_active = true
       ORDER BY name ASC`,
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
