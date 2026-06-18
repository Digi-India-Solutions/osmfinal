import { connectDB } from '../../../pool.js';

// ✅ CREATE DOWNTIME ENTRY
export const createDowntimeEntry = async (req, res) => {
  try {
    const {
      machine_id,
      downtime_code_id,
      date,
      start_time,
      production_order_id,
      shift_id,
      operator_id,
      description,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!machine_id) {
      return res.status(400).json({
        success: false,
        message: 'Machine ID is required',
      });
    }
    if (!downtime_code_id) {
      return res.status(400).json({
        success: false,
        message: 'Downtime Code ID is required',
      });
    }
    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required',
      });
    }
    if (!start_time) {
      return res.status(400).json({
        success: false,
        message: 'Start Time is required',
      });
    }
    if (!shift_id) {
      return res.status(400).json({
        success: false,
        message: 'Shift ID is required',
      });
    }
    if (!operator_id) {
      return res.status(400).json({
        success: false,
        message: 'Operator ID is required',
      });
    }

    // ✅ Get machine details
    const machineResult = await connectDB.query(
      `SELECT * FROM public.machines WHERE id = $1`,
      [machine_id],
    );
    if (machineResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Machine not found',
      });
    }
    const machine = machineResult.rows[0];

    // ✅ Get downtime code details
    const codeResult = await connectDB.query(
      `SELECT * FROM public."Downtime-Codes" WHERE id = $1`,
      [downtime_code_id],
    );
    if (codeResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime Code not found',
      });
    }
    const code = codeResult.rows[0];

    // ✅ Get work center details - FIXED table name
    let workCenterName = null;
    if (machine.work_center_id) {
      const wcResult = await connectDB.query(
        `SELECT name FROM public.work_centers WHERE id = $1`, // ✅ Fixed
        [machine.work_center_id],
      );
      if (wcResult.rows.length > 0) {
        workCenterName = wcResult.rows[0].name;
      }
    }

    // ✅ Get shift details
    const shiftResult = await connectDB.query(
      `SELECT * FROM public.shifts WHERE id = $1`,
      [shift_id],
    );
    const shift = shiftResult.rows[0] || null;

    // ✅ Get operator details
    const operatorResult = await connectDB.query(
      `SELECT * FROM public.operators WHERE id = $1`,
      [operator_id],
    );
    const operator = operatorResult.rows[0] || null;

    // ✅ Get production order details (if provided)
    let po = null;
    if (production_order_id) {
      const poResult = await connectDB.query(
        `SELECT * FROM public.production_orders WHERE id = $1`,
        [production_order_id],
      );
      if (poResult.rows.length > 0) {
        po = poResult.rows[0];
      }
    }

    // ✅ Generate entry number
    const countResult = await connectDB.query(
      `SELECT COUNT(*) FROM public."Downtime-Entries"`,
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const entryNumber = `DTE-2024-${String(count).padStart(3, '0')}`;

    // ✅ Insert downtime entry
    const result = await connectDB.query(
      `INSERT INTO public."Downtime-Entries"
      (entry_number, machine_id, machine_name, work_center_name, downtime_code_id, 
       downtime_code_name, category, start_time, end_time, duration_minutes, 
       production_order_id, shift_id, shift_name, operator_id, operator_name, 
       description, is_resolved, resolved_by, resolved_at, date, warehouse_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
      RETURNING *`,
      [
        entryNumber,
        machine_id,
        machine.name,
        workCenterName,
        downtime_code_id,
        code.description,
        code.category,
        start_time,
        null, // end_time - initially null
        null, // duration_minutes - initially null
        po?.id || null,
        shift_id,
        shift ? shift.name : null,
        operator_id,
        operator ? operator.name : null,
        description || null,
        false, // is_resolved - default false
        null, // resolved_by
        null, // resolved_at
        date,
        warehouse_id || null,
      ],
    );

    // ✅ Update machine status
    if (code.category === 'BREAKDOWN') {
      await connectDB.query(
        `UPDATE public.machines SET status = 'BREAKDOWN', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [machine_id],
      );
    } else if (code.category === 'PLANNED') {
      await connectDB.query(
        `UPDATE public.machines SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [machine_id],
      );
    } else {
      await connectDB.query(
        `UPDATE public.machines SET status = 'IDLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [machine_id],
      );
    }

    res.status(201).json({
      success: true,
      message: 'Downtime entry created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating downtime entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating downtime entry',
    });
  }
};

// ✅ GET ALL DOWNTIME ENTRIES
export const getAllDowntimeEntries = async (req, res) => {
  try {
    const { date_from, date_to, machine_id, category, status } = req.query;

    let query = `
      SELECT * FROM public."Downtime-Entries"
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (date_from) {
      query += ` AND date >= $${paramIndex}`;
      params.push(date_from);
      paramIndex++;
    }
    if (date_to) {
      query += ` AND date <= $${paramIndex}`;
      params.push(date_to);
      paramIndex++;
    }
    if (machine_id) {
      query += ` AND machine_id = $${paramIndex}`;
      params.push(machine_id);
      paramIndex++;
    }
    if (category) {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (status === 'ACTIVE') {
      query += ` AND is_resolved = false`;
    } else if (status === 'RESOLVED') {
      query += ` AND is_resolved = true`;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await connectDB.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching downtime entries:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching downtime entries',
    });
  }
};

// ✅ GET DOWNTIME ENTRY BY ID
export const getDowntimeEntryById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `SELECT * FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime entry not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching downtime entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching downtime entry',
    });
  }
};

// ✅ UPDATE DOWNTIME ENTRY
export const updateDowntimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      machine_id,
      downtime_code_id,
      date,
      start_time,
      production_order_id,
      shift_id,
      operator_id,
      description,
      warehouse_id,
    } = req.body;

    // 🔍 Check if entry exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime entry not found',
      });
    }

    const oldEntry = existing.rows[0];

    // ✅ Get updated machine details if changed
    let machine = null;
    if (machine_id && machine_id !== oldEntry.machine_id) {
      const machineResult = await connectDB.query(
        `SELECT * FROM public.machines WHERE id = $1`,
        [machine_id],
      );
      if (machineResult.rows.length > 0) {
        machine = machineResult.rows[0];
      }
    }

    // ✅ Get updated downtime code details if changed
    let code = null;
    if (downtime_code_id && downtime_code_id !== oldEntry.downtime_code_id) {
      const codeResult = await connectDB.query(
        `SELECT * FROM public."Downtime-Codes" WHERE id = $1`,
        [downtime_code_id],
      );
      if (codeResult.rows.length > 0) {
        code = codeResult.rows[0];
      }
    }

    // ✅ Update entry
    const result = await connectDB.query(
      `UPDATE public."Downtime-Entries" SET
        machine_id = COALESCE($1, machine_id),
        machine_name = COALESCE($2, machine_name),
        downtime_code_id = COALESCE($3, downtime_code_id),
        downtime_code_name = COALESCE($4, downtime_code_name),
        category = COALESCE($5, category),
        date = COALESCE($6, date),
        start_time = COALESCE($7, start_time),
        production_order_id = COALESCE($8, production_order_id),
        shift_id = COALESCE($9, shift_id),
        shift_name = COALESCE($10, shift_name),
        operator_id = COALESCE($11, operator_id),
        operator_name = COALESCE($12, operator_name),
        description = COALESCE($13, description),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($15, warehouse_id)
      WHERE id = $14
      RETURNING *`,
      [
        machine_id || null,
        machine ? machine.name : null,
        downtime_code_id || null,
        code ? code.description : null,
        code ? code.category : null,
        date || null,
        start_time || null,
        production_order_id || null,
        shift_id || null,
        null, // shift_name will be updated separately
        operator_id || null,
        null, // operator_name will be updated separately
        description || null,
        id,
        warehouse_id || null,
      ],
    );

    // ✅ Update shift name if shift_id changed
    if (shift_id && shift_id !== oldEntry.shift_id) {
      const shiftResult = await connectDB.query(
        `SELECT name FROM public.shifts WHERE id = $1`,
        [shift_id],
      );
      if (shiftResult.rows.length > 0) {
        await connectDB.query(
          `UPDATE public."Downtime-Entries" SET shift_name = $1 WHERE id = $2`,
          [shiftResult.rows[0].name, id],
        );
      }
    }

    // ✅ Update operator name if operator_id changed
    if (operator_id && operator_id !== oldEntry.operator_id) {
      const operatorResult = await connectDB.query(
        `SELECT name FROM public.operators WHERE id = $1`,
        [operator_id],
      );
      if (operatorResult.rows.length > 0) {
        await connectDB.query(
          `UPDATE public."Downtime-Entries" SET operator_name = $1 WHERE id = $2`,
          [operatorResult.rows[0].name, id],
        );
      }
    }

    // ✅ If machine changed, restore old machine status and update new machine status
    if (
      machine_id &&
      machine_id !== oldEntry.machine_id &&
      !oldEntry.is_resolved
    ) {
      // Restore old machine
      await connectDB.query(
        `UPDATE public.machines SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [oldEntry.machine_id],
      );

      // Update new machine status
      if (code && code.category === 'BREAKDOWN') {
        await connectDB.query(
          `UPDATE public.machines SET status = 'BREAKDOWN', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [machine_id],
        );
      } else if (code && code.category === 'PLANNED') {
        await connectDB.query(
          `UPDATE public.machines SET status = 'MAINTENANCE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [machine_id],
        );
      } else {
        await connectDB.query(
          `UPDATE public.machines SET status = 'IDLE', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [machine_id],
        );
      }
    }

    // ✅ Get final updated entry
    const finalResult = await connectDB.query(
      `SELECT * FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    res.json({
      success: true,
      message: 'Downtime entry updated successfully',
      data: finalResult.rows[0],
    });
  } catch (error) {
    console.error('Error updating downtime entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating downtime entry',
    });
  }
};

// ✅ RESOLVE DOWNTIME ENTRY
export const resolveDowntimeEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { end_time, resolved_by, notes } = req.body;

    // 🔍 Check if entry exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime entry not found',
      });
    }

    const entry = existing.rows[0];

    if (entry.is_resolved) {
      return res.status(400).json({
        success: false,
        message: 'Downtime entry is already resolved',
      });
    }

    if (!end_time) {
      return res.status(400).json({
        success: false,
        message: 'End Time is required',
      });
    }

    // ✅ Calculate duration in minutes
    const [startH, startM] = entry.start_time.split(':').map(Number);
    const [endH, endM] = end_time.split(':').map(Number);
    const durationMinutes = endH * 60 + endM - (startH * 60 + startM);

    if (durationMinutes <= 0) {
      return res.status(400).json({
        success: false,
        message: 'End Time must be after Start Time',
      });
    }

    // ✅ Update entry
    const result = await connectDB.query(
      `UPDATE public."Downtime-Entries" SET
        end_time = $1,
        duration_minutes = $2,
        is_resolved = true,
        resolved_by = $3,
        resolved_at = CURRENT_TIMESTAMP,
        notes = COALESCE($4, notes),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *`,
      [end_time, durationMinutes, resolved_by || 'System', notes || null, id],
    );

    // ✅ Update machine status back to RUNNING
    await connectDB.query(
      `UPDATE public.machines SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [entry.machine_id],
    );

    res.json({
      success: true,
      message: 'Downtime entry resolved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error resolving downtime entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resolving downtime entry',
    });
  }
};

// ✅ DELETE DOWNTIME ENTRY
export const deleteDowntimeEntry = async (req, res) => {
  try {
    const { id } = req.params;

    // 🔍 Check if entry exists
    const existing = await connectDB.query(
      `SELECT * FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Downtime entry not found',
      });
    }

    const entry = existing.rows[0];

    // ✅ Restore machine status if entry was active
    if (!entry.is_resolved) {
      await connectDB.query(
        `UPDATE public.machines SET status = 'RUNNING', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [entry.machine_id],
      );
    }

    // ✅ Delete entry
    await connectDB.query(
      `DELETE FROM public."Downtime-Entries" WHERE id = $1`,
      [id],
    );

    res.json({
      success: true,
      message: 'Downtime entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting downtime entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting downtime entry',
    });
  }
};
