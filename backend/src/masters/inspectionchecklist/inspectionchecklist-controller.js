import { connectDB } from "../../pool.js";

// ✅ CREATE INSPECTION CHECKLIST
export const createInspectionChecklist = async (req, res) => {
  try {
    const {
      name,
      code,
      applicable_to,
      item_type_target,
      parameter_ids,
      sampling_plan,
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
    if (!applicable_to || !applicable_to.trim()) {
      return res.status(400).json({ success: false, message: "Applicable To is required" });
    }
    if (!item_type_target || !item_type_target.trim()) {
      return res.status(400).json({ success: false, message: "Item Type Target is required" });
    }
    if (!parameter_ids || !Array.isArray(parameter_ids) || parameter_ids.length === 0) {
      return res.status(400).json({ success: false, message: "At least one quality parameter is required" });
    }
    if (!sampling_plan || !sampling_plan.trim()) {
      return res.status(400).json({ success: false, message: "Sampling Plan is required" });
    }

    // ✅ Duplicate check on Code (case-insensitive)
    const codeCheck = await connectDB.query(
      `SELECT 1 FROM public."Inspection-Checklists" 
       WHERE LOWER(code) = LOWER($1)`,
      [code.trim()]
    );

    if (codeCheck.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Inspection Checklist Code already exists",
      });
    }

    // Clean up parameters list to avoid blanks/duplicates
    const cleanParams = [...new Set(parameter_ids.map(p => String(p).trim()).filter(Boolean))];

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Inspection-Checklists"
      (name, code, applicable_to, item_type_target, parameter_ids, sampling_plan, is_active, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        name.trim(),
        code.trim().toUpperCase(),
        applicable_to.trim().toUpperCase(),
        item_type_target.trim().toUpperCase(),
        cleanParams,
        sampling_plan.trim().toUpperCase(),
        is_active ?? true,
        warehouse_id || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Inspection Checklist created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATE INSPECTION CHECKLIST
export const updateInspectionChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      code,
      applicable_to,
      item_type_target,
      parameter_ids,
      sampling_plan,
      is_active,
      warehouse_id
    } = req.body;

    // 🔍 Check if inspection checklist exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Inspection-Checklists" WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Inspection Checklist not found",
      });
    }

    // 🔍 Code duplicate check if code is being changed
    if (code && code.trim().toLowerCase() !== existing.rows[0].code.toLowerCase()) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Inspection-Checklists" 
         WHERE LOWER(code) = LOWER($1) AND id <> $2`,
        [code.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another Inspection Checklist with this Code already exists",
        });
      }
    }

    let cleanParams = existing.rows[0].parameter_ids;
    if (parameter_ids !== undefined) {
      if (!Array.isArray(parameter_ids) || parameter_ids.length === 0) {
        return res.status(400).json({ success: false, message: "At least one quality parameter is required" });
      }
      cleanParams = [...new Set(parameter_ids.map(p => String(p).trim()).filter(Boolean))];
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Inspection-Checklists" SET
        name = COALESCE($1, name),
        code = COALESCE($2, code),
        applicable_to = COALESCE($3, applicable_to),
        item_type_target = COALESCE($4, item_type_target),
        parameter_ids = COALESCE($5, parameter_ids),
        sampling_plan = COALESCE($6, sampling_plan),
        is_active = COALESCE($7, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($9, warehouse_id)
      WHERE id = $8
      RETURNING *`,
      [
        name ? name.trim() : null,
        code ? code.trim().toUpperCase() : null,
        applicable_to ? applicable_to.trim().toUpperCase() : null,
        item_type_target ? item_type_target.trim().toUpperCase() : null,
        cleanParams,
        sampling_plan ? sampling_plan.trim().toUpperCase() : null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null
      ]
    );

    res.json({
      success: true,
      message: "Inspection Checklist updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ DELETE INSPECTION CHECKLIST
export const deleteInspectionChecklist = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Inspection-Checklists"  
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Inspection Checklist not found",
      });
    }

    res.json({
      success: true,
      message: "Inspection Checklist deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ GET ALL INSPECTION CHECKLISTS
export const getAllInspectionChecklists = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Inspection-Checklists"
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
