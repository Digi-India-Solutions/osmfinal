import { connectDB } from '../../pool.js';

// ✅ CREATE MACHINE
export const createMachine = async (req, res) => {
  try {
    const {
      name,
      model,
      work_center_id,
      capacity_per_hour,
      status,
      last_maintenance_date,
      maintenance_frequency_days,
      is_active,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Machine Name is required',
      });
    }

    // ✅ Duplicate check (case-insensitive)
    const existing = await connectDB.query(
      `SELECT 1 FROM public."Machines" 
       WHERE LOWER(name) = LOWER($1)`,
      [name.trim()],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Machine with this name already exists',
      });
    }

    // Check status check constraint
    const allowedStatuses = ['RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'];
    const finalStatus = status ? status.toUpperCase() : 'IDLE';
    if (!allowedStatuses.includes(finalStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be RUNNING, IDLE, MAINTENANCE, or BREAKDOWN',
      });
    }

    // ✅ Safe defaults
    const finalIsActive = is_active ?? true;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO public."Machines"
      (name, model, work_center_id, capacity_per_hour, status, last_maintenance_date, maintenance_frequency_days, is_active,warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8,$9)
      RETURNING *`,
      [
        name.trim(),
        model || null,
        work_center_id || null,
        capacity_per_hour !== undefined ? capacity_per_hour : null,
        finalStatus,
        last_maintenance_date || null,
        maintenance_frequency_days !== undefined
          ? maintenance_frequency_days
          : null,
        finalIsActive,
        warehouse_id || null,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Machine created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ UPDATE MACHINE
export const updateMachine = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      model,
      work_center_id,
      capacity_per_hour,
      status,
      last_maintenance_date,
      maintenance_frequency_days,
      is_active,
      warehouse_id,
    } = req.body;

    // 🔍 Check if machine exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Machines" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found',
      });
    }

    // 🔍 Name duplicate check if name is being changed
    if (
      name &&
      name.trim().toLowerCase() !== existing.rows[0].name.toLowerCase()
    ) {
      const dupCheck = await connectDB.query(
        `SELECT 1 FROM public."Machines" 
         WHERE LOWER(name) = LOWER($1) AND id <> $2`,
        [name.trim(), id],
      );
      if (dupCheck.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Another Machine with this name already exists',
        });
      }
    }

    // Validate status if provided
    if (status) {
      const allowedStatuses = ['RUNNING', 'IDLE', 'MAINTENANCE', 'BREAKDOWN'];
      if (!allowedStatuses.includes(status.toUpperCase())) {
        return res.status(400).json({
          success: false,
          message: 'Status must be RUNNING, IDLE, MAINTENANCE, or BREAKDOWN',
        });
      }
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE public."Machines" SET
        name = COALESCE($1, name),
        model = COALESCE($2, model),
        work_center_id = COALESCE($3, work_center_id),
        capacity_per_hour = COALESCE($4, capacity_per_hour),
        status = COALESCE($5, status),
        last_maintenance_date = COALESCE($6, last_maintenance_date),
        maintenance_frequency_days = COALESCE($7, maintenance_frequency_days),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($9, warehouse_id)
      WHERE id = $10
      RETURNING *`,
      [
        name ? name.trim() : null,
        model || null,
        work_center_id || null,
        capacity_per_hour !== undefined ? capacity_per_hour : null,
        status ? status.toUpperCase() : null,
        last_maintenance_date || null,
        maintenance_frequency_days !== undefined
          ? maintenance_frequency_days
          : null,
        is_active !== undefined ? is_active : null,
        warehouse_id || null,
        id,
      ],
    );

    res.json({
      success: true,
      message: 'Machine updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ DELETE MACHINE
export const deleteMachine = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM public."Machines"  
       WHERE id = $1
       RETURNING *`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found',
      });
    }

    res.json({
      success: true,
      message: 'Machine deleted successfully',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ✅ GET ALL MACHINES
export const getAllMachines = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT m.*, wc.name as work_center_name 
       FROM public."Machines" m
       LEFT JOIN public."Work-Center" wc ON m.work_center_id = wc.id
       ORDER BY m.created_at DESC`,
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

// ✅ GET MACHINES FOR DROPDOWN (Only id and name - Active machines)
export const getMachinesForDropdown = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT id, name 
       FROM public."Machines" 
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
