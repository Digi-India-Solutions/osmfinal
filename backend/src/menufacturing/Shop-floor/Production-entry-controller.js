import { connectDB } from '../../pool.js';


function isValidUUID(id) {
  if (!id) return false;
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}


// ✅ CREATE PRODUCTION ENTRY
export const createProductionEntry = async (req, res) => {
  try {
    const {
      production_order_id,
      work_order_id,
      date,
      shift_id,
      operator_id,
      machine_id,
      start_time,
      end_time,
      produced_qty,
      rejected_qty,
      rejection_code_id,
      notes,
      warehouse_id,
    } = req.body;

    // ✅ Validation
    if (!production_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Production Order ID is required',
      });
    }

    // ✅ Check if valid UUID format
    if (!isValidUUID(production_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Production Order ID format. Must be a valid UUID.',
      });
    }

    if (!work_order_id) {
      return res.status(400).json({
        success: false,
        message: 'Work Order ID is required',
      });
    }

    if (!isValidUUID(work_order_id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Work Order ID format. Must be a valid UUID.',
      });
    }

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date is required',
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
    if (!start_time) {
      return res.status(400).json({
        success: false,
        message: 'Start Time is required',
      });
    }
    if (!end_time) {
      return res.status(400).json({
        success: false,
        message: 'End Time is required',
      });
    }
    if (start_time >= end_time) {
      return res.status(400).json({
        success: false,
        message: 'End Time must be after Start Time',
      });
    }
    if (
      produced_qty === undefined ||
      produced_qty === null ||
      produced_qty < 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'Valid Produced Quantity is required',
      });
    }
    if (rejected_qty && rejected_qty < 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejected Quantity cannot be negative',
      });
    }

    // ❌ REMOVED: production_order_id validation
    // ❌ REMOVED: work_order_id validation
    // ❌ REMOVED: rejection_code_id validation

    // ✅ Calculate actual time in minutes
    const actualTimeMinutes = calculateTimeDifference(start_time, end_time);

    // ✅ Get production order details - ONLY IF production_order_id EXISTS
    let po = null;
    if (production_order_id) {
      try {
        const poResult = await connectDB.query(
          `SELECT * FROM public.production_orders WHERE id = $1`,
          [production_order_id],
        );
        if (poResult.rows.length > 0) {
          po = poResult.rows[0];
        }
      } catch (error) {
        // Ignore error, po remains null
        console.log(
          'Production Order not found or invalid:',
          production_order_id,
        );
      }
    }

    // ✅ Get work order details - ONLY IF work_order_id EXISTS
    let wo = null;
    if (work_order_id) {
      try {
        const woResult = await connectDB.query(
          `SELECT * FROM public.work_orders WHERE id = $1`,
          [work_order_id],
        );
        if (woResult.rows.length > 0) {
          wo = woResult.rows[0];
        }
      } catch (error) {
        // Ignore error, wo remains null
        console.log('Work Order not found or invalid:', work_order_id);
      }
    }

    // ✅ Get shift details
    let shift = null;
    if (shift_id) {
      try {
        const shiftResult = await connectDB.query(
          `SELECT * FROM public.shifts WHERE id = $1`,
          [shift_id],
        );
        if (shiftResult.rows.length > 0) {
          shift = shiftResult.rows[0];
        }
      } catch (error) {
        // Ignore error, shift remains null
        console.log('Shift not found or invalid:', shift_id);
      }
    }

    // ✅ Get operator details
    let operator = null;
    if (operator_id) {
      try {
        const operatorResult = await connectDB.query(
          `SELECT * FROM public.operators WHERE id = $1`,
          [operator_id],
        );
        if (operatorResult.rows.length > 0) {
          operator = operatorResult.rows[0];
        }
      } catch (error) {
        // Ignore error, operator remains null
        console.log('Operator not found or invalid:', operator_id);
      }
    }

    // ✅ Get machine details - ONLY IF machine_id EXISTS
    let machine = null;
    if (machine_id) {
      try {
        const machineResult = await connectDB.query(
          `SELECT * FROM public.machines WHERE id = $1`,
          [machine_id],
        );
        if (machineResult.rows.length > 0) {
          machine = machineResult.rows[0];
        }
      } catch (error) {
        // Ignore error, machine remains null
        console.log('Machine not found or invalid:', machine_id);
      }
    }

    // ✅ Get work center details - ONLY IF wo EXISTS and has work_center_id
    let wc = null;
    if (wo && wo.work_center_id) {
      try {
        const wcResult = await connectDB.query(
          `SELECT * FROM public.work_centers WHERE id = $1`,
          [wo.work_center_id],
        );
        if (wcResult.rows.length > 0) {
          wc = wcResult.rows[0];
        }
      } catch (error) {
        // Ignore error, wc remains null
        console.log('Work Center not found or invalid:', wo.work_center_id);
      }
    }

    // ✅ Generate entry number
    const countResult = await connectDB.query(
      `SELECT COUNT(*) FROM public.production_entries`,
    );
    const count = parseInt(countResult.rows[0].count) + 1;
    const entryNumber = `PE-2024-${String(count).padStart(3, '0')}`;

    // ✅ Insert production entry - ALLOW NULL for production_order_id, work_order_id, rejection_code_id
    const result = await connectDB.query(
      `INSERT INTO public.production_entries
      (entry_number, production_order_id, production_order_number, work_order_id, 
       work_order_number, stage_name, work_center_id, work_center_name, 
       machine_id, machine_name, operator_id, operator_name, shift_id, shift_name,
       date, produced_qty, rejected_qty, unit, start_time, end_time, 
       actual_time_minutes, notes, entered_by, status, warehouse_id, rejection_code_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 
              $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      RETURNING *`,
      [
        entryNumber,
        production_order_id || null,
        po ? po.po_number : null,
        work_order_id || null,
        wo ? wo.wo_number : null,
        wo ? wo.stage_name : null,
        wo ? wo.work_center_id : null,
        wc ? wc.name : null,
        machine_id || null,
        machine ? machine.name : null,
        operator_id || null,
        operator ? operator.name : null,
        shift_id || null,
        shift ? shift.name : null,
        date,
        produced_qty,
        rejected_qty || 0,
        po ? po.unit : 'Pcs',
        start_time,
        end_time,
        actualTimeMinutes,
        notes || null,
        operator_id || null,
        'PENDING',
        warehouse_id || null,
        rejection_code_id || null,
      ],
    );

    // ✅ Update Work Order quantities - ONLY IF work_order_id EXISTS and valid
    if (work_order_id && wo) {
      try {
        await connectDB.query(
          `UPDATE public.work_orders 
           SET completed_qty = completed_qty + $1,
               rejected_qty = rejected_qty + $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [produced_qty, rejected_qty || 0, work_order_id],
        );

        // ✅ Check if Work Order is completed
        const updatedWO = await connectDB.query(
          `SELECT * FROM public.work_orders WHERE id = $1`,
          [work_order_id],
        );
        if (updatedWO.rows.length > 0) {
          if (
            updatedWO.rows[0].completed_qty >= updatedWO.rows[0].planned_qty
          ) {
            await connectDB.query(
              `UPDATE public.work_orders 
               SET status = 'COMPLETED',
                   actual_end_date = $1,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [date, work_order_id],
            );
          } else if (updatedWO.rows[0].completed_qty > 0) {
            await connectDB.query(
              `UPDATE public.work_orders 
               SET status = 'IN_PROGRESS',
                   actual_start_date = COALESCE(actual_start_date, $1),
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $2`,
              [date, work_order_id],
            );
          }
        }
      } catch (error) {
        // Ignore update error
        console.log('Error updating work order:', error.message);
      }
    }

    // ✅ Update Production Order quantities - ONLY IF production_order_id EXISTS and valid
    if (production_order_id && po) {
      try {
        await connectDB.query(
          `UPDATE public.production_orders 
           SET completed_qty = completed_qty + $1,
               rejected_qty = rejected_qty + $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [produced_qty, rejected_qty || 0, production_order_id],
        );
      } catch (error) {
        // Ignore update error
        console.log('Error updating production order:', error.message);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Production entry created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error creating production entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while creating production entry',
    });
  }
};

// ✅ GET ALL PRODUCTION ENTRIES

// ✅ GET ALL PRODUCTION ENTRIES - With proper JOIN
export const getAllProductionEntries = async (req, res) => {
  try {
    const { date, production_order_id, work_center_id, operator_id, status } =
      req.query;

    let query = `
      SELECT 
        pe.*,
        po.po_number as production_order_number,
        wo.wo_number as work_order_number,
        wo.stage_name,
        wc.name as work_center_name,
        m.name as machine_name,
        o.name as operator_name,
        s.name as shift_name
      FROM public.production_entries pe
      LEFT JOIN public.production_orders po ON pe.production_order_id::UUID = po.id
      LEFT JOIN public.work_orders wo ON pe.work_order_id::UUID = wo.id
      LEFT JOIN public.work_centers wc ON pe.work_center_id::UUID = wc.id
      LEFT JOIN public.machines m ON pe.machine_id::UUID = m.id
      LEFT JOIN public.operators o ON pe.operator_id::UUID = o.id
      LEFT JOIN public.shifts s ON pe.shift_id::UUID = s.id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (date) {
      query += ` AND pe.date = $${paramIndex}`;
      params.push(date);
      paramIndex++;
    }
    if (production_order_id) {
      query += ` AND pe.production_order_id = $${paramIndex}`;
      params.push(production_order_id);
      paramIndex++;
    }
    if (work_center_id) {
      query += ` AND pe.work_center_id = $${paramIndex}`;
      params.push(work_center_id);
      paramIndex++;
    }
    if (operator_id) {
      query += ` AND pe.operator_id = $${paramIndex}`;
      params.push(operator_id);
      paramIndex++;
    }
    if (status) {
      query += ` AND pe.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY pe.created_at DESC`;

    console.log('📦 Final Query:', query); // Debug ke liye

    const result = await connectDB.query(query, params);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error fetching production entries:', error);
    
    // ✅ Agar JOIN fail ho toh fallback query
    try {
      const fallbackQuery = `
        SELECT * FROM public.production_entries
        ORDER BY created_at DESC
      `;
      const fallbackResult = await connectDB.query(fallbackQuery);
      
      res.json({
        success: true,
        count: fallbackResult.rows.length,
        data: fallbackResult.rows,
        warning: 'JOIN failed, returning entries without related data'
      });
    } catch (fallbackError) {
      res.status(500).json({
        success: false,
        message: 'Server error while fetching production entries',
      });
    }
  }
};
// ✅ GET PRODUCTION ENTRY BY ID
// ✅ GET PRODUCTION ENTRY BY ID - With proper JOIN
export const getProductionEntryById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        pe.*,
        po.po_number as production_order_number,
        wo.wo_number as work_order_number,
        wo.stage_name,
        wc.name as work_center_name,
        m.name as machine_name,
        o.name as operator_name,
        s.name as shift_name
      FROM public.production_entries pe
      LEFT JOIN public.production_orders po ON pe.production_order_id::UUID = po.id
      LEFT JOIN public.work_orders wo ON pe.work_order_id::UUID = wo.id
      LEFT JOIN public.work_centers wc ON pe.work_center_id::UUID = wc.id
      LEFT JOIN public.machines m ON pe.machine_id::UUID = m.id
      LEFT JOIN public.operators o ON pe.operator_id::UUID = o.id
      LEFT JOIN public.shifts s ON pe.shift_id::UUID = s.id
      WHERE pe.id = $1
    `;

    const result = await connectDB.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Production entry not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error fetching production entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching production entry',
    });
  }
};

// ✅ UPDATE PRODUCTION ENTRY
export const updateProductionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      production_order_id,
      work_order_id,
      date,
      shift_id,
      operator_id,
      machine_id,
      start_time,
      end_time,
      produced_qty,
      rejected_qty,
      rejection_code_id,
      notes,
      warehouse_id,
    } = req.body;

    // 🔍 Check if entry exists
    const existing = await connectDB.query(
      `SELECT * FROM public.production_entries WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Production entry not found',
      });
    }

    const oldEntry = existing.rows[0];

    // ✅ Validation (only for time and quantities)
    if (start_time && end_time && start_time >= end_time) {
      return res.status(400).json({
        success: false,
        message: 'End Time must be after Start Time',
      });
    }
    if (rejected_qty && rejected_qty < 0) {
      return res.status(400).json({
        success: false,
        message: 'Rejected Quantity cannot be negative',
      });
    }

    // ❌ REMOVED: rejection_code_id validation

    const finalProducedQty =
      produced_qty !== undefined ? produced_qty : oldEntry.produced_qty;
    const finalRejectedQty =
      rejected_qty !== undefined ? rejected_qty : oldEntry.rejected_qty;
    const finalWorkOrderId = work_order_id || oldEntry.work_order_id;
    const finalProductionOrderId =
      production_order_id || oldEntry.production_order_id;

    // ✅ Calculate actual time
    const finalStartTime = start_time || oldEntry.start_time;
    const finalEndTime = end_time || oldEntry.end_time;
    const actualTimeMinutes = calculateTimeDifference(
      finalStartTime,
      finalEndTime,
    );

    // ✅ Update Work Order quantities - ONLY IF work_order_id EXISTS
    if (finalWorkOrderId && oldEntry.work_order_id) {
      try {
        await connectDB.query(
          `UPDATE public.work_orders 
           SET completed_qty = completed_qty - $1 + $2,
               rejected_qty = rejected_qty - $3 + $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            oldEntry.produced_qty,
            finalProducedQty,
            oldEntry.rejected_qty,
            finalRejectedQty,
            finalWorkOrderId,
          ],
        );
      } catch (error) {
        console.log('Error updating work order:', error.message);
      }
    }

    // ✅ Update Production Order quantities - ONLY IF production_order_id EXISTS
    if (finalProductionOrderId && oldEntry.production_order_id) {
      try {
        await connectDB.query(
          `UPDATE public.production_orders 
           SET completed_qty = completed_qty - $1 + $2,
               rejected_qty = rejected_qty - $3 + $4,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $5`,
          [
            oldEntry.produced_qty,
            finalProducedQty,
            oldEntry.rejected_qty,
            finalRejectedQty,
            finalProductionOrderId,
          ],
        );
      } catch (error) {
        console.log('Error updating production order:', error.message);
      }
    }

    // ✅ Update production entry
    const result = await connectDB.query(
      `UPDATE public.production_entries SET
        production_order_id = COALESCE($1, production_order_id),
        work_order_id = COALESCE($2, work_order_id),
        date = COALESCE($3, date),
        shift_id = COALESCE($4, shift_id),
        operator_id = COALESCE($5, operator_id),
        machine_id = COALESCE($6, machine_id),
        start_time = COALESCE($7, start_time),
        end_time = COALESCE($8, end_time),
        produced_qty = COALESCE($9, produced_qty),
        rejected_qty = COALESCE($10, rejected_qty),
        actual_time_minutes = $11,
        notes = COALESCE($12, notes),
        rejection_code_id = COALESCE($13, rejection_code_id),
        updated_at = CURRENT_TIMESTAMP,
        warehouse_id = COALESCE($15, warehouse_id)
      WHERE id = $14
      RETURNING *`,
      [
        production_order_id || null,
        work_order_id || null,
        date || null,
        shift_id || null,
        operator_id || null,
        machine_id || null,
        start_time || null,
        end_time || null,
        produced_qty !== undefined ? produced_qty : null,
        rejected_qty !== undefined ? rejected_qty : null,
        actualTimeMinutes,
        notes || null,
        rejection_code_id || null,
        id,
        warehouse_id || null,
      ],
    );

    res.json({
      success: true,
      message: 'Production entry updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error updating production entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating production entry',
    });
  }
};

// ✅ APPROVE PRODUCTION ENTRY
export const approveProductionEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { supervisor_id } = req.body;

    const existing = await connectDB.query(
      `SELECT * FROM public.production_entries WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Production entry not found',
      });
    }

    if (existing.rows[0].status === 'APPROVED') {
      return res.status(400).json({
        success: false,
        message: 'Production entry is already approved',
      });
    }

    const result = await connectDB.query(
      `UPDATE public.production_entries 
       SET status = 'APPROVED',
           supervisor_id = $1,
           approved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [supervisor_id || null, id],
    );

    res.json({
      success: true,
      message: 'Production entry approved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error approving production entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while approving production entry',
    });
  }
};

// ✅ DELETE PRODUCTION ENTRY
export const deleteProductionEntry = async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await connectDB.query(
      `SELECT * FROM public.production_entries WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Production entry not found',
      });
    }

    const entry = existing.rows[0];

    // ✅ Reverse quantities from Work Order - ONLY IF work_order_id EXISTS
    if (entry.work_order_id) {
      try {
        await connectDB.query(
          `UPDATE public.work_orders 
           SET completed_qty = completed_qty - $1,
               rejected_qty = rejected_qty - $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [entry.produced_qty, entry.rejected_qty, entry.work_order_id],
        );
      } catch (error) {
        console.log('Error updating work order on delete:', error.message);
      }
    }

    // ✅ Reverse quantities from Production Order - ONLY IF production_order_id EXISTS
    if (entry.production_order_id) {
      try {
        await connectDB.query(
          `UPDATE public.production_orders 
           SET completed_qty = completed_qty - $1,
               rejected_qty = rejected_qty - $2,
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $3`,
          [entry.produced_qty, entry.rejected_qty, entry.production_order_id],
        );
      } catch (error) {
        console.log(
          'Error updating production order on delete:',
          error.message,
        );
      }
    }

    // ✅ Delete entry
    await connectDB.query(
      `DELETE FROM public.production_entries WHERE id = $1`,
      [id],
    );

    res.json({
      success: true,
      message: 'Production entry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting production entry:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while deleting production entry',
    });
  }
};

// ✅ Helper function
function calculateTimeDifference(startTime, endTime) {
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  return endH * 60 + endM - (startH * 60 + startM);
}
