// src/recheck-queue/recheckController.js

import pool from '../pool.js';

// ─── GET MY RECHECK REQUESTS ──────────────────────────────────

export const getMyRecheckRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let conditions = ['rr.assign_to = $1'];
    const params = [userId];
    let paramCount = 2;

    if (status) {
      conditions.push(`rr.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.resolved_at AS completed_at,
        rr.escalate_reason,
        rr.escalate_type,
        rr.escalate_remarks,
        rr.escalated_by,
        rr.escalated_at,
        rr.time_spent,  -- ✅ ADD THIS
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name,
        rm.marks_data,
        'higher' AS "finalMarksRule",
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr2 
          WHERE rr2.sheet_id = rr.sheet_id 
            AND rr2.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id
      WHERE ${whereClause}
      ORDER BY rr.created_at DESC
      `,
      params,
    );

    // Get counts
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rejected')) AS completed_count,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated_count
      FROM recheck_requests
      WHERE assign_to = $1`,
      [userId],
    );

    const counts = countResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Recheck requests retrieved successfully',
      data: {
        items: rows,
        stats: {
          pending: parseInt(counts.pending_count || 0),
          completed: parseInt(counts.completed_count || 0),
          escalated: parseInt(counts.escalated_count || 0),
        },
      },
    });
  } catch (error) {
    console.error('getMyRecheckRequests error:', error);
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
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.time_spent,  -- ✅ ADD THIS
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name,
        rm.marks_data,
        COALESCE(rr.final_marks_rule, 'higher') AS finalMarksRule
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id
      WHERE rr.id = $1 AND rr.assign_to = $2`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
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

    const validStatuses = [
      'pending',
      'assigned',
      'completed',
      'rejected',
      'escalated',
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    const checkResult = await pool.query(
      `SELECT id, sheet_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

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

    if (status === 'escalated') {
      query += `, escalated_by = $${paramCount}, escalated_at = NOW()`;
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

    if (status === 'escalated' && rows.length > 0 && sheetId) {
      await pool.query(
        `UPDATE sheets SET status = 'escalated', updated_at = NOW() WHERE id = $1`,
        [sheetId],
      );
    }

    if (status === 'completed' && rows.length > 0 && sheetId) {
      await pool.query(
        `UPDATE sheets SET status = 'rechecked', updated_at = NOW() WHERE id = $1`,
        [sheetId],
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

// ─── START RECHECK MARKING ──────────────────────────────────────

export const startRecheckMarking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const accessCheck = await pool.query(
      `SELECT id, status FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2`,
      [id, userId],
    );

    if (accessCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    const requestStatus = accessCheck.rows[0].status;
    const isCompleted =
      requestStatus === 'completed' || requestStatus === 'rejected';

    let query = `
      SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.final_marks_rule,
        rr.time_spent,  -- ✅ ADD THIS
        s.id AS sheet_id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        s.status AS sheet_status,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time,
        ms."questionName",
        ms."maxMarks",
        ms.guidelines,
        ms.model_answer_pdf,
        ms.question_paper_pdf
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN mark_schemes ms ON ms."examId" = e.id
      WHERE rr.id = $1 AND rr.assign_to = $2
    `;

    const { rows } = await pool.query(query, [id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    // Group mark scheme
    const markScheme = {};
    rows.forEach((row) => {
      if (row.questionName) {
        markScheme[row.questionName] = {
          maxMarks: row.maxMarks,
          guidelines: row.guidelines,
        };
      }
    });

    const request = rows[0];

    // Get previous marks
    let previousMarks = {};
    if (request.sheet_id) {
      const prevMarksResult = await pool.query(
        `SELECT marks_data FROM checker_markings 
         WHERE sheet_id = $1 AND is_submitted = true
         ORDER BY submitted_at DESC LIMIT 1`,
        [request.sheet_id],
      );

      if (
        prevMarksResult.rows.length > 0 &&
        prevMarksResult.rows[0].marks_data
      ) {
        previousMarks = prevMarksResult.rows[0].marks_data || {};
      }
    }

    // Get recheck marks if completed
    let recheckMarks = {};
    let recheckAnnotations = [];
    let recheckStamps = [];

    if (isCompleted) {
      const recheckResult = await pool.query(
        `SELECT marks_data, annotations_data, stamps_data, total_marks 
         FROM recheck_markings 
         WHERE recheck_request_id = $1 AND is_submitted = true
         ORDER BY submitted_at DESC LIMIT 1`,
        [id],
      );

      if (recheckResult.rows.length > 0) {
        recheckMarks = recheckResult.rows[0].marks_data || {};
        recheckAnnotations = recheckResult.rows[0].annotations_data || [];
        recheckStamps = recheckResult.rows[0].stamps_data || [];
      }
    }

    // Build full file URL
    const baseUrl =
      process.env.API_URL || 'https://osm.digiindiasolutions.com/';
    const buildFullUrl = (path) => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://'))
        return path;
      if (path.startsWith('/uploads')) return `${baseUrl}${path}`;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const finalMarksRule = request.final_marks_rule || 'higher';

    return res.status(200).json({
      success: true,
      message: isCompleted
        ? 'Recheck data retrieved successfully (readonly)'
        : 'Recheck marking data retrieved successfully',
      data: {
        request: {
          id: request.id,
          sheet_id: request.sheet_id,
          exam_id: request.exam_id,
          reason: request.reason,
          status: request.status,
          finalMarksRule: finalMarksRule,
          created_at: request.created_at,
          isReadOnly: isCompleted,
          time_spent: request.time_spent || 0, // ✅ ADD THIS
        },
        sheet: {
          id: request.sheet_id,
          student_name: request.student_name,
          roll_no: request.roll_no,
          barcode: request.barcode,
          file_name: request.file_name,
          file_url: buildFullUrl(request.file_url),
          current_marks: request.current_marks,
          status: request.sheet_status,
        },
        exam: {
          id: request.exam_id,
          name: request.exam_name,
          subject: request.exam_subject,
          spentTime: request.exam_spent_time || 0,
        },
        markScheme: markScheme,
        previousMarks: previousMarks,
        recheckMarks: recheckMarks,
        recheckAnnotations: recheckAnnotations,
        recheckStamps: recheckStamps,
        pdfs: {
          model_answer: buildFullUrl(request.model_answer_pdf),
          question_paper: buildFullUrl(request.question_paper_pdf),
        },
      },
    });
  } catch (error) {
    console.error('startRecheckMarking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck marking data',
      error: error.message,
    });
  }
};

// ─── SAVE RECHECK MARKS ─────────────────────────────────────────

export const saveRecheckMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks, remarks } = req.body;
    const userId = req.user.id;

    if (marks === undefined || marks === null) {
      return res.status(400).json({
        success: false,
        message: 'Marks are required',
      });
    }

    const checkResult = await pool.query(
      `SELECT sheet_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 AND status = 'pending'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

    await pool.query(
      `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
      [marks, sheetId],
    );

    if (remarks) {
      await pool.query(
        `UPDATE recheck_requests SET remarks = $1, updated_at = NOW() WHERE id = $2`,
        [remarks, id],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Marks saved successfully',
    });
  } catch (error) {
    console.error('saveRecheckMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save marks',
      error: error.message,
    });
  }
};

// ─── COMPLETE RECHECK ───────────────────────────────────────────

// src/recheck-queue/recheckController.js

export const completeRecheck = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      marks,
      remarks,
      marksData,
      annotationsData,
      stampsData,
      finalMarksRule,
      timeSpent, // ✅ timeSpent from frontend (rechecker ka time)
    } = req.body;
    const userId = req.user.id;

    const checkResult = await pool.query(
      `SELECT sheet_id, exam_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 AND status = 'pending'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    const { sheet_id: sheetId, exam_id: examId } = checkResult.rows[0];

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // ✅ Update marks in sheets
      if (marks !== undefined && marks !== null) {
        await client.query(
          `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
          [marks, sheetId],
        );
      }

      // ✅ CRITICAL: Update sheets status AND checking_time_spent with rechecker's time
      await client.query(
        `UPDATE sheets 
         SET status = 'rechecked', 
             checking_time_spent = COALESCE($1, checking_time_spent, 0),
             updated_at = NOW() 
         WHERE id = $2`,
        [timeSpent || 0, sheetId],
      );

      // ✅ Update recheck request with time_spent
      let updateQuery = `
        UPDATE recheck_requests 
        SET status = 'completed', 
            resolved_by = $1, 
            resolved_at = NOW(),
            remarks = COALESCE($2, remarks),
            time_spent = COALESCE($3, time_spent, 0),
            updated_at = NOW()
      `;
      let queryParams = [userId, remarks, timeSpent || 0];
      let paramCount = 4;

      if (finalMarksRule) {
        updateQuery += `, final_marks_rule = $${paramCount}`;
        queryParams.push(finalMarksRule);
        paramCount++;
      }

      updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
      queryParams.push(id);

      await client.query(updateQuery, queryParams);

      // Save recheck markings
      const existing = await client.query(
        `SELECT id FROM recheck_markings WHERE recheck_request_id = $1 AND checker_id = $2`,
        [id, userId],
      );

      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE recheck_markings 
           SET marks_data = $1, annotations_data = $2, stamps_data = $3,
               total_marks = $4, is_draft = false, is_submitted = true,
               submitted_at = NOW(), updated_at = NOW()
           WHERE recheck_request_id = $5 AND checker_id = $6`,
          [
            JSON.stringify(marksData || {}),
            JSON.stringify(annotationsData || []),
            JSON.stringify(stampsData || []),
            marks || 0,
            id,
            userId,
          ],
        );
      } else {
        await client.query(
          `INSERT INTO recheck_markings (
            recheck_request_id, sheet_id, checker_id, exam_id,
            marks_data, annotations_data, stamps_data, total_marks,
            is_draft, is_submitted, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, NOW())`,
          [
            id,
            sheetId,
            userId,
            examId,
            JSON.stringify(marksData || {}),
            JSON.stringify(annotationsData || []),
            JSON.stringify(stampsData || []),
            marks || 0,
          ],
        );
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Recheck completed successfully',
        data: {
          time_spent: timeSpent || 0,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('completeRecheck error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete recheck',
      error: error.message,
    });
  }
};

// ─── SAVE RECHECK DRAFT ─────────────────────────────────────────

// src/recheck-queue/recheckController.js

export const saveRecheckDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      marksData,
      annotationsData,
      stampsData,
      totalMarks,
      remarks,
      timeSpent,
    } = req.body;

    const checkResult = await pool.query(
      `SELECT sheet_id, exam_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 AND status = 'pending'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    const { sheet_id: sheetId, exam_id: examId } = checkResult.rows[0];

    const existing = await pool.query(
      `SELECT id FROM recheck_markings WHERE recheck_request_id = $1 AND checker_id = $2`,
      [id, userId],
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE recheck_markings 
         SET marks_data = $1, annotations_data = $2, stamps_data = $3,
             total_marks = $4, remarks = $5, is_draft = true, updated_at = CURRENT_TIMESTAMP
         WHERE recheck_request_id = $6 AND checker_id = $7
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          id,
          userId,
        ],
      );

      // ✅ Update recheck_requests with time_spent
      if (timeSpent !== undefined) {
        await pool.query(
          `UPDATE recheck_requests 
           SET time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, id],
        );
      }

      // ✅ Update sheets with time_spent during draft save
      if (timeSpent !== undefined && sheetId) {
        await pool.query(
          `UPDATE sheets 
           SET checking_time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, sheetId],
        );
      }
    } else {
      result = await pool.query(
        `INSERT INTO recheck_markings (
          recheck_request_id, sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data, total_marks, remarks, is_draft
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        RETURNING *`,
        [
          id,
          sheetId,
          userId,
          examId,
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
        ],
      );

      // ✅ Insert time_spent in recheck_requests
      if (timeSpent !== undefined) {
        await pool.query(
          `UPDATE recheck_requests 
           SET time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, id],
        );
      }

      // ✅ Update sheets with time_spent during draft save
      if (timeSpent !== undefined && sheetId) {
        await pool.query(
          `UPDATE sheets 
           SET checking_time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, sheetId],
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck draft saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('saveRecheckDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save recheck draft',
      error: error.message,
    });
  }
};
// ─── GET RECHECK DRAFT ───────────────────────────────────────────

export const getRecheckDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        rm.*,
        rr.time_spent  -- ✅ ADD THIS
       FROM recheck_markings rm
       JOIN recheck_requests rr ON rm.recheck_request_id = rr.id
       WHERE rm.recheck_request_id = $1 AND rm.checker_id = $2`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No draft found for this recheck request',
        data: null,
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      message: 'Recheck draft retrieved successfully',
      data: {
        id: row.id,
        marks_data: row.marks_data || {},
        annotations_data: row.annotations_data || [],
        stamps_data: row.stamps_data || [],
        total_marks: row.total_marks,
        remarks: row.remarks,
        is_draft: row.is_draft,
        is_submitted: row.is_submitted,
        time_spent: row.time_spent || 0, // ✅ ADD THIS
      },
    });
  } catch (error) {
    console.error('getRecheckDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck draft',
      error: error.message,
    });
  }
};

// ─── ESCALATE RECHECK REQUEST ──────────────────────────────────────

// src/recheck-queue/recheckController.js

export const escalateRecheckRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason, escalateType, remarks, timeSpent } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for escalation',
      });
    }

    const checkResult = await pool.query(
      `SELECT rr.id, rr.sheet_id, rr.status
       FROM recheck_requests rr
       WHERE rr.id = $1 AND rr.assign_to = $2`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

    // ✅ Update recheck request status to 'escalated' with time_spent
    await pool.query(
      `UPDATE recheck_requests 
       SET status = 'escalated',
           escalate_reason = $1,
           escalate_type = $2,
           escalate_remarks = $3,
           escalated_by = $4,
           escalated_at = CURRENT_TIMESTAMP,
           time_spent = COALESCE($5, time_spent, 0),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        reason,
        escalateType || 'other',
        remarks || null,
        userId,
        timeSpent || 0,
        id,
      ],
    );

    // ✅ Update sheet status to 'escalated' with time_spent
    if (sheetId) {
      await pool.query(
        `UPDATE sheets 
         SET status = 'escalated',
             escalate_reason = $1,
             escalate_type = $2,
             escalate_remarks = $3,
             escalated_by = $4,
             escalated_at = CURRENT_TIMESTAMP,
             checking_time_spent = COALESCE($5, checking_time_spent, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          reason,
          escalateType || 'other',
          remarks || null,
          userId,
          timeSpent || 0,
          sheetId,
        ],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request escalated successfully',
      data: {
        time_spent: timeSpent || 0,
      },
    });
  } catch (error) {
    console.error('escalateRecheckRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to escalate recheck request',
      error: error.message,
    });
  }
};
