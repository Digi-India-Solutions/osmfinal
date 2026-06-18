import { connectDB } from "../../pool.js";

const VALID_TYPES = ['PASS_FAIL', 'NUMERIC', 'TEXT'];
const VALID_APPLICABLE = ['INCOMING', 'IN_PROCESS', 'FINAL', 'ALL'];

// ✅ CREATE QUALITY PARAMETER
export const createQualityParameter = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      unit,
      min_value,
      max_value,
      applicable_to,
      is_active,
      warehouse_id
    } = req.body;

    // ✅ Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Name is required" });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: "Code is required" });
    }
    if (!type || !VALID_TYPES.includes(type.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Type must be one of: ${VALID_TYPES.join(', ')}` 
      });
    }
    if (!applicable_to || !VALID_APPLICABLE.includes(applicable_to.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Applicable To must be one of: ${VALID_APPLICABLE.join(', ')}` 
      });
    }

    // Min/Max numeric check if NUMERIC type
    let minVal = null;
    let maxVal = null;
    if (type.toUpperCase() === 'NUMERIC') {
      if (min_value !== undefined && min_value !== null && min_value !== '') {
        minVal = Number(min_value);
        if (isNaN(minVal)) return res.status(400).json({ success: false, message: "Min value must be a number" });
      }
      if (max_value !== undefined && max_value !== null && max_value !== '') {
        maxVal = Number(max_value);
        if (isNaN(maxVal)) return res.status(400).json({ success: false, message: "Max value must be a number" });
      }
      if (minVal !== null && maxVal !== null && minVal > maxVal) {
        return res.status(400).json({ success: false, message: "Min value cannot be greater than Max value" });
      }
    }

    // ✅ Duplicate check on Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public."Quality-Parameters" 
       WHERE LOWER(code) = LOWER($1)`,
      [code.trim()]
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Quality Parameter Code already exists",
      });
    }

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Quality-Parameters"
      (name, code, type, unit, min_value, max_value, applicable_to, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        type.toUpperCase(),
        unit ? unit.trim() : null,
        minVal,
        maxVal,
        applicable_to.toUpperCase(),
        is_active ?? true,
        warehouse_id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Quality Parameter created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATE QUALITY PARAMETER
export const updateQualityParameter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      type,
      unit,
      min_value,
      max_value,
      applicable_to,
      is_active,
      warehouse_id
    } = req.body;

    // 🔍 Check if quality parameter exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Quality-Parameters" WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quality Parameter not found",
      });
    }

    const currentType = type ? type.toUpperCase() : existing.rows[0].type;

    // 🔍 Code duplicate check if code is being changed
    if (code && code.trim().toLowerCase() !== existing.rows[0].code.toLowerCase()) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Quality-Parameters" 
         WHERE LOWER(code) = LOWER($1) AND id <> $2`,
        [code.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another Quality Parameter with this Code already exists",
        });
      }
    }

    // 🔍 Type validation if changing
    if (type && !VALID_TYPES.includes(type.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Type must be one of: ${VALID_TYPES.join(', ')}` 
      });
    }

    // 🔍 Applicable to validation if changing
    if (applicable_to && !VALID_APPLICABLE.includes(applicable_to.toUpperCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Applicable To must be one of: ${VALID_APPLICABLE.join(', ')}` 
      });
    }

    // Min/Max numeric check if NUMERIC type
    let minVal = existing.rows[0].min_value;
    let maxVal = existing.rows[0].max_value;

    if (currentType === 'NUMERIC') {
      if (min_value !== undefined) {
        minVal = (min_value !== null && min_value !== '') ? Number(min_value) : null;
        if (minVal !== null && isNaN(minVal)) return res.status(400).json({ success: false, message: "Min value must be a number" });
      }
      if (max_value !== undefined) {
        maxVal = (max_value !== null && max_value !== '') ? Number(max_value) : null;
        if (maxVal !== null && isNaN(maxVal)) return res.status(400).json({ success: false, message: "Max value must be a number" });
      }
      if (minVal !== null && maxVal !== null && minVal > maxVal) {
        return res.status(400).json({ success: false, message: "Min value cannot be greater than Max value" });
      }
    } else {
      // Clear min/max values if changing type from NUMERIC to PASS_FAIL or TEXT
      if (type && type.toUpperCase() !== 'NUMERIC') {
        minVal = null;
        maxVal = null;
      }
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Quality-Parameters" SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        type = COALESCE($3, type),
        unit = COALESCE($4, unit),
        min_value = $5,
        max_value = $6,
        applicable_to = COALESCE($7, applicable_to),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($10, warehouse_id)
      WHERE id = $9
      RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        type ? type.toUpperCase() : null,
        unit !== undefined ? (unit ? unit.trim() : null) : existing.rows[0].unit,
        minVal,
        maxVal,
        applicable_to ? applicable_to.toUpperCase() : null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null
      ]
    );

    res.json({
      success: true,
      message: "Quality Parameter updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ DELETE QUALITY PARAMETER
export const deleteQualityParameter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Quality-Parameters"  
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Quality Parameter not found",
      });
    }

    res.json({
      success: true,
      message: "Quality Parameter deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ GET ALL QUALITY PARAMETERS
export const getAllQualityParameters = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Quality-Parameters"
       ORDER BY created_at DESC`
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
