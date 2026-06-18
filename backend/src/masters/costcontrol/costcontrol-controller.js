import { connectDB } from "../../pool.js";

// ✅ CREATE COST CENTER
export const createCostCenter = async (req, res) => {
  try {
    const {
      name,
      code,
      type,
      manager_id,
      manager_name,
      budget_monthly,
      is_active,
      warehouse_id
    } = req.body;

    // ✅ Validation
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Cost Center Name is required" });
    }
    if (!code || !code.trim()) {
      return res.status(400).json({ success: false, message: "Cost Center Code is required" });
    }
    if (!type || !type.trim()) {
      return res.status(400).json({ success: false, message: "Cost Center Type is required" });
    }
    if (budget_monthly !== undefined && (isNaN(Number(budget_monthly)) || Number(budget_monthly) < 0)) {
      return res.status(400).json({ success: false, message: "Valid Monthly Budget is required" });
    }

    // ✅ Duplicate check on Cost Center Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public."Cost-Centers" 
       WHERE LOWER(code) = LOWER($1)`,
      [code.trim()]
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Cost Center with this Code already exists",
      });
    }

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Cost-Centers"
      (name, code, type, manager_id, manager_name, budget_monthly, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        name.trim(),
        code.trim(),
        type.trim().toUpperCase(),
        manager_id || null,
        manager_name || null,
        budget_monthly !== undefined ? Number(budget_monthly) : 0,
        is_active ?? true,
        warehouse_id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Cost Center created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATE COST CENTER
export const updateCostCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      type,
      manager_id,
      manager_name,
      budget_monthly,
      is_active,
      warehouse_id
    } = req.body;

    // 🔍 Check if cost center exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Cost-Centers" WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cost Center not found",
      });
    }

    // 🔍 Code duplicate check if code is being changed
    if (code && code.trim().toLowerCase() !== existing.rows[0].code.toLowerCase()) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Cost-Centers" 
         WHERE LOWER(code) = LOWER($1) AND id <> $2`,
        [code.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another Cost Center with this Code already exists",
        });
      }
    }

    // 🔍 Budget validation if changing
    if (budget_monthly !== undefined && (isNaN(Number(budget_monthly)) || Number(budget_monthly) < 0)) {
      return res.status(400).json({ success: false, message: "Valid Monthly Budget is required" });
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Cost-Centers" SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        type = COALESCE($3, type),
        manager_id = CASE WHEN $4 = 'null' THEN NULL WHEN $4 IS NULL THEN manager_id ELSE $4::UUID END,
        manager_name = CASE WHEN $5 = 'null' THEN NULL WHEN $5 IS NULL THEN manager_name ELSE $5 END,
        budget_monthly = COALESCE($6, budget_monthly),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($9, warehouse_id)
      WHERE id = $8
      RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim() : null,
        type ? type.trim().toUpperCase() : null,
        manager_id === null ? 'null' : (manager_id || null),
        manager_name === null ? 'null' : (manager_name || null),
        budget_monthly !== undefined ? Number(budget_monthly) : null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null
      ]
    );

    res.json({
      success: true,
      message: "Cost Center updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ DELETE COST CENTER
export const deleteCostCenter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Cost-Centers"  
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cost Center not found",
      });
    }

    res.json({
      success: true,
      message: "Cost Center deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ GET ALL COST CENTERS
export const getAllCostCenters = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Cost-Centers"
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
