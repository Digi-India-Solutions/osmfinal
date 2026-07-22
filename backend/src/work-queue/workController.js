// src/work-queue/workController.js

import pool from '../pool.js';

// ─── GET ALL SHEETS ─────────────────────────────────────────────

// src/work-queue/workController.js

// src/work-queue/workController.js

export const getSheets = async (req, res) => {
  try {
    const { examId, status, search, page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // ─── STATUS CONDITIONS (for main items list only) ──────────
    if (status && status.trim() !== '') {
      const statuses = status.split(',');
      const placeholders = statuses
        .map((_, i) => `$${paramCount + i}`)
        .join(',');
      conditions.push(`s.status IN (${placeholders})`);
      params.push(...statuses);
      paramCount += statuses.length;
    } else {
      conditions.push(`s.status NOT IN ('unlinked')`);
    }

    if (examId) {
      conditions.push(`s.exam_id = $${paramCount}`);
      params.push(examId);
      paramCount++;
    }

    if (search) {
      conditions.push(
        `(s.student_name ILIKE $${paramCount} OR s.roll_no ILIKE $${paramCount})`,
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // ─── MAIN QUERY ────────────────────────────────────────────
    let query = `
      SELECT 
        s.id,
        s.exam_id,
        s.student_id,
        s.roll_no,
        s.student_name,
        s.barcode,
        s.file_name,
        s.file_url,
        s.file_size,
        s.mime_type,
        s.status,
        s.marks,
        s.uploaded_by,
        s.created_at,
        s.updated_at,
        s.escalate_reason,
        s.escalate_type,
        s.escalate_remarks,
        s.escalated_by,
        s.escalated_at,
        s.assigned_to,
        COALESCE(
          rr.time_spent,
          cm.time_spent,
          s.checking_time_spent,
          0
        ) AS time_spent,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."maxMarks" AS total_marks,
        u.name AS uploaded_by_name,
        assigned_user.name AS assigned_to_name,
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr2 
          WHERE rr2.sheet_id = s.id AND rr2.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.uploaded_by = u.id
      LEFT JOIN users assigned_user ON s.assigned_to = assigned_user.id
      LEFT JOIN checker_markings cm ON s.id = cm.sheet_id AND cm.is_submitted = true
      LEFT JOIN recheck_requests rr ON s.id = rr.sheet_id AND rr.status = 'completed'
      ${whereClause}
      ORDER BY s.created_at DESC
    `;

    const dataParams = [...params];
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    dataParams.push(parseInt(limit), offset);

    const { rows } = await pool.query(query, dataParams);

    // ─── TOTAL COUNT (for pagination — respects status filter) ──
    let countQuery = `SELECT COUNT(*)::int AS total FROM sheets s`;
    if (whereClause) {
      countQuery += ` ${whereClause}`;
    }
    const countResult = await pool.query(countQuery, params);
    const total = countResult.rows[0]?.total || 0;

    // ─── STATS QUERY (tab-independent — only examId + search) ──
    const statsConditions = [];
    const statsParams = [];
    let statsParamCount = 1;

    if (examId) {
      statsConditions.push(`s.exam_id = $${statsParamCount}`);
      statsParams.push(examId);
      statsParamCount++;
    }

    if (search) {
      statsConditions.push(
        `(s.student_name ILIKE $${statsParamCount} OR s.roll_no ILIKE $${statsParamCount})`,
      );
      statsParams.push(`%${search}%`);
      statsParamCount++;
    }

    statsConditions.push(`s.status NOT IN ('unlinked')`);
    const statsWhereClause = `WHERE ${statsConditions.join(' AND ')}`;

    const statsQuery = `
      SELECT 
        COUNT(*) AS all_count,
        COUNT(*) FILTER (WHERE s.status IN ('linked', 'uploaded', 'assigned', 'recheck')) AS pending_count,
        COUNT(*) FILTER (WHERE s.status = 'checking') AS checking_count,
        COUNT(*) FILTER (WHERE s.status = 'recheck') AS rechecking_count,
        COUNT(*) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS completed_count,
        COUNT(*) FILTER (WHERE s.status = 'escalated') AS escalated_count
      FROM sheets s
      ${statsWhereClause}
    `;

    const statsResult = await pool.query(statsQuery, statsParams);
    const stats = statsResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Sheets retrieved successfully',
      data: {
        items: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        stats: {
          all: parseInt(stats.all_count || 0),
          pending: parseInt(stats.pending_count || 0),
          checking: parseInt(stats.checking_count || 0),
          rechecking: parseInt(stats.rechecking_count || 0),
          completed: parseInt(stats.completed_count || 0),
          escalated: parseInt(stats.escalated_count || 0),
        },
      },
    });
  } catch (error) {
    console.error('getSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheets',
      error: error.message,
    });
  }
};
// ─── GET SINGLE SHEET ──────────────────────────────────────────

export const getSheetById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        s.*,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS uploaded_by_name,
        assigned_user.name AS assigned_to_name,
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr 
          WHERE rr.sheet_id = s.id AND rr.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.uploaded_by = u.id
      LEFT JOIN users assigned_user ON s.assigned_to = assigned_user.id
      WHERE s.id = $1`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('getSheetById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheet',
      error: error.message,
    });
  }
};

// ─── UPDATE SHEET STATUS ───────────────────────────────────────

export const updateSheetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, marks, assigned_to } = req.body;

    const validStatuses = [
      'uploaded',
      'assigned',
      'checking',
      'checked',
      'recheck',
      'rechecked',
    ];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (status) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (marks !== undefined && marks !== null) {
      updates.push(`marks = $${paramCount}`);
      values.push(marks);
      paramCount++;
    }

    if (assigned_to !== undefined) {
      updates.push(`assigned_to = $${paramCount}`);
      values.push(assigned_to);
      paramCount++;

      if (assigned_to && !status) {
        updates.push(`status = $${paramCount}`);
        values.push('assigned');
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    updates.push(`updated_at = NOW()`);
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE sheets 
       SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values,
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('updateSheetStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update sheet',
      error: error.message,
    });
  }
};

// ─── FLAG FOR RECHECK ──────────────────────────────────────────

export const flagForRecheck = async (req, res) => {
  try {
    const { id } = req.params;
    const { scope = 'single', assignTo, reason } = req.body;
    const userId = req.user.id;

    if (!assignTo) {
      return res.status(400).json({
        success: false,
        message: 'Please select an evaluator',
      });
    }

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please enter at least 5 characters for the reason',
      });
    }

    const sheetResult = await pool.query(
      `SELECT id, exam_id, status FROM sheets WHERE id = $1`,
      [id],
    );

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    const sheet = sheetResult.rows[0];

    const recheckerResult = await pool.query(
      `SELECT id, name FROM users 
       WHERE id = $1 AND role = 'rechecking' AND is_active = true`,
      [assignTo],
    );

    if (recheckerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid recheck evaluator selected',
      });
    }

    const rechecker = recheckerResult.rows[0];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let sheetIds = [];

      if (scope === 'single') {
        sheetIds = [parseInt(id)];
      } else if (scope === 'entire') {
        const examSheets = await client.query(
          `SELECT id FROM sheets WHERE exam_id = $1`,
          [sheet.exam_id],
        );
        sheetIds = examSheets.rows.map((row) => row.id);
      }

      for (const sheetId of sheetIds) {
        await client.query(
          `INSERT INTO recheck_requests (
            sheet_id, exam_id, reason, requested_by, assign_to, status
          ) VALUES ($1, $2, $3, $4, $5, $6)`,
          [sheetId, sheet.exam_id, reason, userId, assignTo, 'pending'],
        );

        await client.query(
          `UPDATE sheets 
           SET status = 'recheck', 
               assigned_to = $1,
               updated_at = NOW() 
           WHERE id = $2`,
          [assignTo, sheetId],
        );
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `${sheetIds.length} sheet(s) flagged for recheck successfully`,
        data: {
          sheetId: id,
          scope,
          assignTo: rechecker.name,
          assignToId: assignTo,
          reason,
          totalSheetsFlagged: sheetIds.length,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('flagForRecheck error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to flag for recheck',
      error: error.message,
    });
  }
};

// ─── GET RECHECK REQUESTS ──────────────────────────────────────

export const getRecheckRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let conditions = ['1=1'];
    const params = [];
    let paramCount = 1;

    if (status) {
      conditions.push(`rr.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await pool.query(
      `SELECT 
        rr.*,
        s.student_name,
        s.roll_no,
        e.name AS exam_name,
        u.name AS assign_to_name,
        u2.name AS requested_by_name,
        u3.name AS resolved_by_name
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.assign_to = u.id
      LEFT JOIN users u2 ON rr.requested_by = u2.id
      LEFT JOIN users u3 ON rr.resolved_by = u3.id
      WHERE ${whereClause}
      ORDER BY rr.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), offset],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM recheck_requests rr WHERE ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Recheck requests retrieved successfully',
      data: {
        items: rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getRecheckRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck requests',
      error: error.message,
    });
  }
};

// ─── GET RECHECK REQUEST BY ID ─────────────────────────────────

export const getRecheckRequestById = async (req, res) => {
  try {
    const { id } = req.params;

    const { rows } = await pool.query(
      `SELECT 
        rr.*,
        s.student_name,
        s.roll_no,
        e.name AS exam_name,
        u.name AS assign_to_name,
        u2.name AS requested_by_name,
        u3.name AS resolved_by_name
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.assign_to = u.id
      LEFT JOIN users u2 ON rr.requested_by = u2.id
      LEFT JOIN users u3 ON rr.resolved_by = u3.id
      WHERE rr.id = $1`,
      [id],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('getRecheckRequestById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck request',
      error: error.message,
    });
  }
};

// ─── UPDATE RECHECK REQUEST STATUS ─────────────────────────────

export const updateRecheckRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user.id;

    const validStatuses = ['pending', 'assigned', 'completed', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    let query = `
      UPDATE recheck_requests 
      SET status = $1, updated_at = NOW()
    `;
    const values = [status];
    let paramCount = 2;

    if (status === 'completed' || status === 'rejected') {
      query += `, resolved_by = $${paramCount}, resolved_at = NOW()`;
      values.push(userId);
      paramCount++;
    }

    if (remarks) {
      query += `, remarks = $${paramCount}`;
      values.push(remarks);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found',
      });
    }

    if (status === 'completed') {
      await pool.query(
        `UPDATE sheets SET status = 'rechecked', updated_at = NOW() WHERE id = $1`,
        [rows[0].sheet_id],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('updateRecheckRequestStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update recheck request',
      error: error.message,
    });
  }
};

// ─── GET RECHECK USERS ─────────────────────────────────────────

export const getRecheckUsers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, email, subject 
       FROM users 
       WHERE role = 'rechecking' AND is_active = true
       ORDER BY name ASC`,
    );

    return res.status(200).json({
      success: true,
      message: 'Recheck users retrieved successfully',
      data: rows,
    });
  } catch (error) {
    console.error('getRecheckUsers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck users',
      error: error.message,
    });
  }
};

// ─── ASSIGN SHEET TO CHECKER ──────────────────────────────────

export const assignSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;

    if (!assigned_to) {
      return res.status(400).json({
        success: false,
        message: 'Please select a checker to assign',
      });
    }

    const sheetResult = await pool.query(
      `SELECT id, status FROM sheets WHERE id = $1`,
      [id],
    );

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    const userResult = await pool.query(
      `SELECT id, name FROM users 
       WHERE id = $1 AND (role = 'checker' OR role = 'admin') AND is_active = true`,
      [assigned_to],
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid checker selected',
      });
    }

    const result = await pool.query(
      `UPDATE sheets 
       SET assigned_to = $1, 
           status = 'assigned',
           updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [assigned_to, id],
    );

    return res.status(200).json({
      success: true,
      message: 'Sheet assigned successfully',
      data: {
        sheet: result.rows[0],
        assigned_to_name: userResult.rows[0].name,
      },
    });
  } catch (error) {
    console.error('assignSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign sheet',
      error: error.message,
    });
  }
};

// ─── REASSIGN RECHECK REQUESTS ──────────────────────────────────

// src/work-queue/workController.js

// ─── REASSIGN RECHECK REQUESTS ──────────────────────────────────

export const reassignRecheckRequests = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const { assignTo, sheetIds } = req.body;
    const userId = req.user.id;

    if (!assignTo) {
      return res.status(400).json({
        success: false,
        message: 'Please select an evaluator to reassign',
      });
    }

    const recheckerResult = await pool.query(
      `SELECT id, name, email, role FROM users 
       WHERE id = $1 AND role = 'rechecking' AND is_active = true`,
      [assignTo],
    );

    if (recheckerResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          'Invalid recheck evaluator selected. User must have "rechecking" role.',
      });
    }

    const rechecker = recheckerResult.rows[0];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      let processedSheetIds = [];

      if (sheetId === 'bulk' && sheetIds && Array.isArray(sheetIds)) {
        processedSheetIds = sheetIds;
      } else if (sheetId !== 'bulk') {
        processedSheetIds = [parseInt(sheetId)];
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid request: sheetIds required for bulk reassign',
        });
      }

      let reassignedCount = 0;
      const errors = [];

      for (const id of processedSheetIds) {
        try {
          const sheetCheck = await client.query(
            `SELECT s.id, s.status, rr.id as recheck_id, rr.status as recheck_status, rr.assign_to as current_rechecker
             FROM sheets s
             INNER JOIN recheck_requests rr ON s.id = rr.sheet_id
             WHERE s.id = $1 
               AND rr.status = 'pending'
               AND s.status = 'recheck'`,
            [id],
          );

          if (sheetCheck.rows.length === 0) {
            errors.push({
              sheetId: id,
              error: 'Sheet not found or no pending recheck request',
            });
            continue;
          }

          const sheet = sheetCheck.rows[0];

          // ✅ Check if columns exist before using them
          // Simple approach: Update without reassigned_by/reassigned_at if they don't exist
          // Or use COALESCE with NULL

          await client.query(
            `UPDATE recheck_requests 
             SET assign_to = $1, 
                 updated_at = NOW()
             WHERE id = $2 AND status = 'pending'`,
            [assignTo, sheet.recheck_id],
          );

          await client.query(
            `UPDATE sheets 
             SET assigned_to = $1, updated_at = NOW()
             WHERE id = $2`,
            [assignTo, id],
          );

          reassignedCount++;
        } catch (err) {
          console.error(`Error reassigning sheet ${id}:`, err);
          errors.push({ sheetId: id, error: err.message });
        }
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `${reassignedCount} sheet(s) reassigned successfully to ${rechecker.name}`,
        data: {
          reassigned: reassignedCount,
          errors: errors,
          assignTo: {
            id: rechecker.id,
            name: rechecker.name,
            role: rechecker.role,
          },
          processedSheetIds: processedSheetIds,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('reassignRecheckRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reassign recheck requests',
      error: error.message,
    });
  }
};

// ─── GET AVAILABLE RECHECKERS ──────────────────────────────────

export const getAvailableRecheckers = async (req, res) => {
  try {
    const excludeId = req.params.excludeId || req.query.excludeId || null;

    let query = `
      SELECT u.id, u.name, u.email, u.subject, u.role,
        COUNT(DISTINCT rr.id) as pending_count
      FROM users u
      LEFT JOIN recheck_requests rr ON u.id = rr.assign_to AND rr.status = 'pending'
      WHERE u.role = 'rechecking' AND u.is_active = true
    `;

    const params = [];
    if (excludeId) {
      query += ` AND u.id != $1`;
      params.push(excludeId);
    }

    query += ` GROUP BY u.id ORDER BY pending_count ASC, u.name ASC`;

    const { rows } = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Available recheckers retrieved successfully',
      data: rows,
    });
  } catch (error) {
    console.error('getAvailableRecheckers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get available recheckers',
      error: error.message,
    });
  }
};


// src/work-queue/workController.js

// ─── GET CHECKED SHEET BY ID ──────────────────────────────────

// src/recheck-queue/recheckController.js ya workQueueController.js mein
// src/controllers/workQueueController.js

export const getCheckedSheetById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const isAdmin = role === 'admin' || role === 'super_admin';

    // ✅ Pehle check karo ki sheet exist karti hai ya nahi
    const sheetCheck = await pool.query(
      `SELECT s.id, s.exam_id, s.status, s.marks, s.checking_time_spent, 
              s.archived_folder, s.file_url, s.checked_at, s.student_name, 
              s.roll_no, s.barcode
       FROM sheets s
       WHERE s.id = $1`,
      [id]
    );
   
    if (sheetCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    const sheet = sheetCheck.rows[0];

    // ✅ Agar admin nahi hai toh assignment check karo
    if (!isAdmin) {
      const assignmentCheck = await pool.query(
        `SELECT a.id, a.checker_id, a.status 
         FROM assignments a
         WHERE a.sheet_id = $1 
         AND a.checker_id = $2 
         AND a.status IN ('assigned', 'completed')
         LIMIT 1`,
        [id, userId]
      );

      if (assignmentCheck.rows.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'You do not have access to this sheet',
        });
      }
    }

    // ✅ ADMIN: Simple query without assignments join
    // ✅ CHECKER: Query with assignments join
    let fullQuery;
    let queryParams = [id];

    if (isAdmin) {
      // ✅ Admin ke liye - assignments join nahi karna
      fullQuery = `
        SELECT 
          s.id,
          s.student_name,
          s.roll_no,
          s.barcode,
          s.marks,
          s.checking_time_spent,
          s.archived_folder,
          s.file_url,
          s.checked_at,
          s.status AS sheet_status,
          e.name AS exam_name,
          e.subject AS exam_subject,
          e."maxMarks" AS total_marks,
          u.name AS checker_name,
          cm.marks_data,
          cm.annotations_data,
          cm.stamps_data,
          cm.notes_data,
          cm.remarks,
          cm.submitted_at
        FROM sheets s
        LEFT JOIN exams e ON s.exam_id = e.id
        LEFT JOIN users u ON s.checked_by = u.id
        LEFT JOIN checker_markings cm ON cm.sheet_id = s.id AND cm.is_submitted = true
        WHERE s.id = $1
      `;
    } else {
      // ✅ Checker ke liye - assignments join ke saath
      fullQuery = `
        SELECT 
          s.id,
          s.student_name,
          s.roll_no,
          s.barcode,
          s.marks,
          s.checking_time_spent,
          s.archived_folder,
          s.file_url,
          s.checked_at,
          s.status AS sheet_status,
          e.name AS exam_name,
          e.subject AS exam_subject,
          e."maxMarks" AS total_marks,
          u.name AS checker_name,
          cm.marks_data,
          cm.annotations_data,
          cm.stamps_data,
          cm.notes_data,
          cm.remarks,
          cm.submitted_at
        FROM sheets s
        LEFT JOIN exams e ON s.exam_id = e.id
        LEFT JOIN assignments a ON a.sheet_id = s.id AND a.status IN ('assigned', 'completed')
        LEFT JOIN users u ON a.checker_id = u.id
        LEFT JOIN checker_markings cm ON cm.sheet_id = s.id AND cm.is_submitted = true
        WHERE s.id = $1
      `;
    }

    const result = await pool.query(fullQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet data not found',
      });
    }

    const row = result.rows[0];

    // Parse JSON data
    let marksData = {};
    let annotationsData = [];
    let stampsData = [];
    let notesData = [];

    try {
      if (row.marks_data) {
        marksData = typeof row.marks_data === 'string' ? JSON.parse(row.marks_data) : row.marks_data;
      }
      if (row.annotations_data) {
        annotationsData = typeof row.annotations_data === 'string' ? JSON.parse(row.annotations_data) : row.annotations_data;
      }
      if (row.stamps_data) {
        stampsData = typeof row.stamps_data === 'string' ? JSON.parse(row.stamps_data) : row.stamps_data;
      }
      if (row.notes_data) {
        notesData = typeof row.notes_data === 'string' ? JSON.parse(row.notes_data) : row.notes_data;
      }
    } catch (e) {
      console.error('Parse error:', e);
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet retrieved successfully',
      data: {
        id: row.id,
        student_name: row.student_name || sheet.student_name,
        roll_no: row.roll_no || sheet.roll_no,
        barcode: row.barcode || sheet.barcode,
        marks: row.marks || sheet.marks || '0',
        checking_time_spent: row.checking_time_spent || sheet.checking_time_spent || 0,
        archived_folder: row.archived_folder || sheet.archived_folder || '',
        file_url: row.file_url || sheet.file_url || '',
        checked_at: row.checked_at || sheet.checked_at || '',
        exam_name: row.exam_name || 'Unknown',
        exam_subject: row.exam_subject || '—',
        total_marks: row.total_marks || 0,
        checker_name: row.checker_name || '—',
        marks_data: marksData,
        annotations_data: annotationsData,
        stamps_data: stampsData,
        notes_data: notesData,
        remarks: row.remarks || '',
        submitted_at: row.submitted_at || '',
      },
    });
  } catch (error) {
    console.error('getCheckedSheetById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checked sheet',
      error: error.message,
    });
  }
};

// ─── GET ALL CHECKED SHEETS ────────────────────────────────────

export const getCheckedSheets = async (req, res) => {
  try {
    const { examId, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        s.id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.marks,
        s.checking_time_spent,
        s.archived_folder,
        s.file_url,
        s.checked_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."maxMarks" AS total_marks,
        u.name AS checker_name
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'completed'
      LEFT JOIN users u ON a.checker_id = u.id
      WHERE s.is_checked = true AND s.status = 'checked'
    `;

    const params = [];
    let paramCount = 1;

    if (examId) {
      query += ` AND s.exam_id = $${paramCount}`;
      params.push(examId);
      paramCount++;
    }

    query += ` ORDER BY s.checked_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    // Count total
    let countQuery = `
      SELECT COUNT(*)::int AS total 
      FROM sheets s
      WHERE s.is_checked = true AND s.status = 'checked'
    `;
    const countParams = [];
    if (examId) {
      countQuery += ` AND s.exam_id = $1`;
      countParams.push(examId);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Checked sheets retrieved successfully',
      data: {
        items: result.rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getCheckedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checked sheets',
      error: error.message,
    });
  }
};

// ─── GET ESCALATED SHEETS ──────────────────────────────────────

export const getEscalatedSheets = async (req, res) => {
  try {
    const { examId, page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = `
      SELECT 
        s.id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.status,
        s.escalate_reason,
        s.escalate_type,
        s.escalate_remarks,
        s.escalated_by,
        s.escalated_at,
        s.checking_time_spent,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS escalated_by_name
      FROM sheets s
      JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.escalated_by = u.id
      WHERE s.status = 'escalated'
    `;

    const params = [];
    let paramCount = 1;

    if (examId) {
      query += ` AND s.exam_id = $${paramCount}`;
      params.push(examId);
      paramCount++;
    }

    query += ` ORDER BY s.escalated_at DESC LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(parseInt(limit), offset);

    const result = await pool.query(query, params);

    let countQuery = `
      SELECT COUNT(*)::int AS total 
      FROM sheets s
      WHERE s.status = 'escalated'
    `;
    const countParams = [];
    if (examId) {
      countQuery += ` AND s.exam_id = $1`;
      countParams.push(examId);
    }
    const countResult = await pool.query(countQuery, countParams);
    const total = countResult.rows[0]?.total || 0;

    return res.status(200).json({
      success: true,
      message: 'Escalated sheets retrieved successfully',
      data: {
        items: result.rows,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('getEscalatedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get escalated sheets',
      error: error.message,
    });
  }
};