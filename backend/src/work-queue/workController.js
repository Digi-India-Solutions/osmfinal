// src/work-queue/workController.js

import pool from '../pool.js';

// ─── GET ALL SHEETS ─────────────────────────────────────────────

export const getSheets = async (req, res) => {
  try {
    const { examId, status, search, page = 1, limit = 50 } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    // Apply filters
    if (examId) {
      conditions.push(`s.exam_id = $${paramCount}`);
      params.push(examId);
      paramCount++;
    }

    if (status) {
      const statuses = status.split(',');
      const placeholders = statuses
        .map((_, i) => `$${paramCount + i}`)
        .join(',');
      conditions.push(`s.status IN (${placeholders})`);
      params.push(...statuses);
      paramCount += statuses.length;
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

    // ✅ Query with actual columns from your table
    const query = `
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
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS uploaded_by_name,
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr 
          WHERE rr.sheet_id = s.id AND rr.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.uploaded_by = u.id
      ${whereClause}
      ORDER BY s.created_at DESC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const dataParams = [...params, parseInt(limit), offset];
    const { rows } = await pool.query(query, dataParams);

    // Get total count
    const countParams = params.slice(0, -2);
    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM sheets s ${whereClause}`,
      countParams,
    );
    const total = countResult.rows[0]?.total || 0;

    // Get status counts for tabs
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) AS all_count,
        COUNT(*) FILTER (WHERE s.status IN ('uploaded', 'assigned')) AS pending_count,
        COUNT(*) FILTER (WHERE s.status = 'checking') AS checking_count,
        COUNT(*) FILTER (WHERE s.status = 'recheck') AS rechecking_count,
        COUNT(*) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS completed_count
      FROM sheets s
      ${whereClause}`,
      countParams,
    );
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
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr 
          WHERE rr.sheet_id = s.id AND rr.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.uploaded_by = u.id
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
    const { status, marks } = req.body;
    const userId = req.user.id;

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

    // Validation
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

    // Check if sheet exists
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

    // Check if rechecker exists
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
          `UPDATE sheets SET status = 'recheck', updated_at = NOW() WHERE id = $1`,
          [sheetId],
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
