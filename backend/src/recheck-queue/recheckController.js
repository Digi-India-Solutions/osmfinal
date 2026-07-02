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

    // ✅ REMOVED: rr.scope (column doesn't exist)
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
      WHERE ${whereClause}
      ORDER BY rr.created_at DESC
      `,
      params,
    );

    // Get counts
    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rejected')) AS completed_count
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

    // ✅ REMOVED: rr.scope
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
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
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

    const validStatuses = ['pending', 'assigned', 'completed', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    // Check if request exists and is assigned to current user
    const checkResult = await pool.query(
      `SELECT id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
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

    // If completed, update sheet marks and status
    if (status === 'completed' && rows.length > 0) {
      const request = rows[0];
      if (request.sheet_id) {
        await pool.query(
          `UPDATE sheets SET status = 'rechecked', updated_at = NOW() WHERE id = $1`,
          [request.sheet_id],
        );
      }
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

    // ✅ REMOVED: rr.scope
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
        ms."questionName",
        ms."maxMarks",
        ms.guidelines,
        ms.model_answer_pdf,
        ms.question_paper_pdf
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN mark_schemes ms ON ms."examId" = e.id
      WHERE rr.id = $1 AND rr.assign_to = $2 AND rr.status = 'pending'`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    // Group mark scheme by question
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

    return res.status(200).json({
      success: true,
      message: 'Recheck marking data retrieved successfully',
      data: {
        request: {
          id: request.id,
          sheet_id: request.sheet_id,
          exam_id: request.exam_id,
          reason: request.reason,
          status: request.status,
          created_at: request.created_at,
        },
        sheet: {
          id: request.sheet_id,
          student_name: request.student_name,
          roll_no: request.roll_no,
          barcode: request.barcode,
          file_name: request.file_name,
          file_url: request.file_url,
          current_marks: request.current_marks,
          status: request.sheet_status,
        },
        exam: {
          id: request.exam_id,
          name: request.exam_name,
          subject: request.exam_subject,
        },
        markScheme: markScheme,
        pdfs: {
          model_answer: request.model_answer_pdf,
          question_paper: request.question_paper_pdf,
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

    // Check if request exists and is assigned to current user
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

    // Save marks to sheet
    await pool.query(
      `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
      [marks, sheetId],
    );

    // Update recheck request with remarks
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

export const completeRecheck = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks, remarks } = req.body;
    const userId = req.user.id;

    // Check if request exists
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

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update sheet marks
      if (marks !== undefined && marks !== null) {
        await client.query(
          `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
          [marks, sheetId],
        );
      }

      // Update sheet status to rechecked
      await client.query(
        `UPDATE sheets SET status = 'rechecked', updated_at = NOW() WHERE id = $1`,
        [sheetId],
      );

      // Update recheck request status to completed
      await client.query(
        `UPDATE recheck_requests 
         SET status = 'completed', 
             resolved_by = $1, 
             resolved_at = NOW(),
             remarks = COALESCE($2, remarks),
             updated_at = NOW()
         WHERE id = $3`,
        [userId, remarks, id],
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Recheck completed successfully',
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
