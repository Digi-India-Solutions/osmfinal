import { connectDB } from "../../pool.js";

// ✅ CREATE WORK CENTER
export const createWorkCenter = async (req, res) => {
  try {
    const {
      name,
      type,
      capacity_per_hour,
      warehouse_id,
      description,
      is_active
    } = req.body;

    // ✅ Validation
    if (!name || !type || capacity_per_hour === undefined || capacity_per_hour === null) {
      return res.status(400).json({
        success: false,
        message: "Name, type, and capacity per hour are required",
      });
    }

    // ✅ Duplicate check (case-insensitive)
    const existing = await connectDB.query(
      `SELECT 1 FROM public."Work-Center" 
       WHERE LOWER(name) = LOWER($1)`,
      [name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Work Center with this name already exists",
      });
    }

    // ✅ Safe defaults
    const finalIsActive = is_active ?? true;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Work-Center"
      (name, type, capacity_per_hour, warehouse_id, description, is_active)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        name.trim(),
        type,
        capacity_per_hour,
        warehouse_id || null,
        description || null,
        finalIsActive
      ]
    );

    res.status(201).json({
      success: true,
      message: "Work Center created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATE WORK CENTER
export const updateWorkCenter = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      type,
      capacity_per_hour,
      warehouse_id,
      description,
      is_active
    } = req.body;

    // 🔍 Check if work center exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Work-Center" WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Work Center not found",
      });
    }

    // 🔍 Name duplicate check if name is being changed
    if (name && name.trim().toLowerCase() !== existing.rows[0].name.toLowerCase()) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Work-Center" 
         WHERE LOWER(name) = LOWER($1) AND id <> $2`,
        [name.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another Work Center with this name already exists",
        });
      }
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Work-Center" SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        capacity_per_hour = COALESCE($3, capacity_per_hour),
        warehouse_id = COALESCE($4, warehouse_id),
        description = COALESCE($5, description),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $7
      RETURNING *`,
      [
        name ? name.trim() : null,
        type || null,
        capacity_per_hour !== undefined ? capacity_per_hour : null,
        warehouse_id || null,
        description || null,
        is_active !== undefined ? is_active : null,
        id
      ]
    );

    res.json({
      success: true,
      message: "Work Center updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ DELETE WORK CENTER
export const deleteWorkCenter = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Work-Center"  
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Work Center not found",
      });
    }

    res.json({
      success: true,
      message: "Work Center deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ GET ALL WORK CENTERS
export const getAllWorkCenters = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Work-Center"
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
