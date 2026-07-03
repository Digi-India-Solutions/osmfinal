// src/checker/checker-marking-controller.js

import pool from '../pool.js';

// ─── SAVE DRAFT MARKS ──────────────────────────────────────────

// ─── SAVE DRAFT MARKS ──────────────────────────────────────────

export const saveDraft = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const { marksData, annotationsData, stampsData, totalMarks, remarks } =
      req.body;

    // Check if sheet is assigned to this checker
    const assignmentCheck = await pool.query(
      `SELECT a.sheet_id, s.exam_id 
       FROM assignments a
       JOIN sheets s ON a.sheet_id = s.id
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const examId = assignmentCheck.rows[0].exam_id;

    // ✅ CRITICAL FIX: Check if already submitted
    const existing = await pool.query(
      `SELECT id, is_submitted FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    // ✅ If already submitted, don't allow draft save
    if (existing.rows.length > 0 && existing.rows[0].is_submitted === true) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save draft for already submitted sheet',
      });
    }

    let result;

    if (existing.rows.length > 0) {
      // Update existing - always save as draft, don't change submitted status
      result = await pool.query(
        `UPDATE checker_markings 
         SET marks_data = $1,
             annotations_data = $2,
             stamps_data = $3,
             total_marks = $4,
             remarks = $5,
             is_draft = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE sheet_id = $6 AND checker_id = $7
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          sheetId,
          userId,
        ],
      );
    } else {
      // Insert new
      result = await pool.query(
        `INSERT INTO checker_markings (
          sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data,
          total_marks, remarks, is_draft
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
        RETURNING *`,
        [
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
    }

    // Update sheet status to 'checking' if it's not already
    await pool.query(
      `UPDATE sheets 
       SET marks = $1, 
           status = 'checking', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [totalMarks || 0, sheetId],
    );

    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('saveDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
    });
  }
};

// ─── SUBMIT MARKS ──────────────────────────────────────────────
// ✅ FIXED: Allows re-submission (overwrites previous submission)

export const submitMarks = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const { marksData, annotationsData, stampsData, totalMarks, remarks } =
      req.body;

    // Check if sheet is assigned to this checker
    const assignmentCheck = await pool.query(
      `SELECT a.sheet_id, s.exam_id 
       FROM assignments a
       JOIN sheets s ON a.sheet_id = s.id
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const examId = assignmentCheck.rows[0].exam_id;

    // ✅ REMOVED: The check that prevents re-submission
    // Now we just upsert (insert or update) regardless of previous submission status

    // Check if marking record exists
    const existing = await pool.query(
      `SELECT id FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    let result;

    if (existing.rows.length > 0) {
      // ✅ Update existing record - allow overwriting previous submission
      result = await pool.query(
        `UPDATE checker_markings 
         SET marks_data = $1,
             annotations_data = $2,
             stamps_data = $3,
             total_marks = $4,
             remarks = $5,
             is_draft = false,
             is_submitted = true,
             submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE sheet_id = $6 AND checker_id = $7
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          sheetId,
          userId,
        ],
      );
    } else {
      // Insert new record
      result = await pool.query(
        `INSERT INTO checker_markings (
          sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data,
          total_marks, remarks, is_draft, is_submitted, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
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
    }

    // ✅ CRITICAL: Update sheet marks and status
    await pool.query(
      `UPDATE sheets 
       SET marks = $1, 
           status = 'checked', 
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [totalMarks || 0, sheetId],
    );

    return res.status(200).json({
      success: true,
      message: 'Marks submitted successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('submitMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit marks',
      error: error.message,
    });
  }
};

// ─── GET SAVED DRAFT ───────────────────────────────────────────

export const getDraft = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        cm.*,
        s.status AS sheet_status,
        s.student_name,
        s.roll_no,
        e.name AS exam_name,
        e.subject AS exam_subject
       FROM checker_markings cm
       JOIN sheets s ON cm.sheet_id = s.id
       JOIN exams e ON cm.exam_id = e.id
       WHERE cm.sheet_id = $1 AND cm.checker_id = $2`,
      [sheetId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No draft found for this sheet',
        data: null,
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Draft retrieved successfully',
      data: {
        id: row.id,
        sheet_id: row.sheet_id,
        checker_id: row.checker_id,
        exam_id: row.exam_id,
        marks_data: row.marks_data || {},
        annotations_data: row.annotations_data || [],
        stamps_data: row.stamps_data || [],
        total_marks: row.total_marks,
        remarks: row.remarks,
        is_draft: row.is_draft,
        is_submitted: row.is_submitted,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sheet_status: row.sheet_status,
        student_name: row.student_name,
        roll_no: row.roll_no,
        exam_name: row.exam_name,
        exam_subject: row.exam_subject,
      },
    });
  } catch (error) {
    console.error('getDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get draft',
      error: error.message,
    });
  }
};

// ─── GET SUBMITTED MARKS ───────────────────────────────────────

export const getSubmittedMarks = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        cm.*,
        s.status AS sheet_status,
        s.student_name,
        s.roll_no,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS checker_name
       FROM checker_markings cm
       JOIN sheets s ON cm.sheet_id = s.id
       JOIN exams e ON cm.exam_id = e.id
       JOIN users u ON cm.checker_id = u.id
       WHERE cm.sheet_id = $1 AND cm.is_submitted = true`,
      [sheetId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No submitted marks found for this sheet',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Submitted marks retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getSubmittedMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submitted marks',
      error: error.message,
    });
  }
};

// ─── ESCALATE SHEET ─────────────────────────────────────────────

export const escalateSheet = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const { reason, remarks } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for escalation',
      });
    }

    // Check if sheet is assigned to this checker
    const assignmentCheck = await pool.query(
      `SELECT sheet_id FROM assignments 
       WHERE sheet_id = $1 AND checker_id = $2 AND status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    // Update sheet status to 'escalated'
    await pool.query(
      `UPDATE sheets SET status = 'escalated', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [sheetId],
    );

    // Save escalation log
    await pool.query(
      `INSERT INTO sheet_activity_logs (sheet_id, action, performed_by, details)
       VALUES ($1, 'escalated', $2, $3)`,
      [sheetId, userId, JSON.stringify({ reason, remarks })],
    );

    return res.status(200).json({
      success: true,
      message: 'Sheet escalated successfully',
    });
  } catch (error) {
    console.error('escalateSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to escalate sheet',
      error: error.message,
    });
  }
};
