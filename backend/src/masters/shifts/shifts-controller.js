import { connectDB } from "../../pool.js";

// ✅ CREATE SHIFT
export const createShift = async (req, res) => {
  try {
    const {
      name,
      start_time,
      end_time,
      break_minutes,
      working_days,
      is_active,
      warehouse_id
    } = req.body;

    // ✅ Validation
    if (!name) {
      return res.status(400).json({ success: false, message: "Shift Name is required" });
    }
    if (!start_time) {
      return res.status(400).json({ success: false, message: "Start Time is required" });
    }
    if (!end_time) {
      return res.status(400).json({ success: false, message: "End Time is required" });
    }
    if (!working_days || !Array.isArray(working_days)) {
      return res.status(400).json({ success: false, message: "Working days must be an array" });
    }

    // ✅ Duplicate check (case-insensitive)
    const existing = await connectDB.query(
      `SELECT 1 FROM public."Shifts" 
       WHERE LOWER(name) = LOWER($1)`,
      [name.trim()]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Shift with this name already exists",
      });
    }

    // ✅ Safe defaults
    const finalBreakMinutes = break_minutes !== undefined ? break_minutes : 0;
    const finalIsActive = is_active ?? true;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Shifts"
      (name, start_time, end_time, break_minutes, working_days, is_active,warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        name.trim(),
        start_time,
        end_time,
        finalBreakMinutes,
        working_days,
        finalIsActive,
        warehouse_id,
      ]
    );

    res.status(201).json({
      success: true,
      message: "Shift created successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ UPDATE SHIFT
export const updateShift = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      start_time,
      end_time,
      break_minutes,
      working_days,
      is_active,
      warehouse_id
    } = req.body;

    // 🔍 Check if shift exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Shifts" WHERE id = $1`,
      [id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    // 🔍 Name duplicate check if name is being changed
    if (name && name.trim().toLowerCase() !== existing.rows[0].name.toLowerCase()) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Shifts" 
         WHERE LOWER(name) = LOWER($1) AND id <> $2`,
        [name.trim(), id]
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Another Shift with this name already exists",
        });
      }
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Shifts" SET
        name = COALESCE($1, name),
        start_time = COALESCE($2, start_time),
        end_time = COALESCE($3, end_time),
        break_minutes = COALESCE($4, break_minutes),
        working_days = COALESCE($5, working_days),
        is_active = COALESCE($6, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($8, warehouse_id),
      WHERE id = $7
      RETURNING *`,
      [
        name ? name.trim() : null,
        start_time || null,
        end_time || null,
        break_minutes !== undefined ? break_minutes : null,
        working_days || null,
        is_active !== undefined ? is_active : null,
        id,
        warehouse_id || null
      ]
    );

    res.json({
      success: true,
      message: "Shift updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ DELETE SHIFT
export const deleteShift = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Shifts"  
       WHERE id = $1
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Shift not found",
      });
    }

    res.json({
      success: true,
      message: "Shift deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ✅ GET ALL SHIFTS
export const getAllShifts = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT * FROM public."Shifts"
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

// ✅ GET SHIFTS FOR DROPDOWN (only id and name)
export const getShiftsForDropdown = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT id, name 
       FROM public."Shifts" 
       WHERE is_active = true
       ORDER BY name ASC`
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};
