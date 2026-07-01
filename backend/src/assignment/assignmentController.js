// src/assignments/assignment-controller.js
import pool from '../pool.js';

// ─── GET UNASSIGNED SHEETS ──────────────────────────────────────

// src/assignments/assignment-controller.js

// ─── GET UNASSIGNED SHEETS ──────────────────────────────────────

export const getUnassignedSheets = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        s.id, s.roll_no, s.student_name, s.barcode, s.file_name,
        s.status as sheet_status
      FROM sheets s
      LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'assigned'
      WHERE s.exam_id = $1 
        AND (a.id IS NULL OR a.status != 'assigned')
        AND (s.status = 'uploaded' OR s.status = 'linked')  -- ✅ Added 'linked'
      ORDER BY s.id ASC`,
      [examId]
    );

    return res.status(200).json({
      success: true,
      message: 'Unassigned sheets retrieved successfully',
      data: result.rows
    });
  } catch (error) {
    console.error('getUnassignedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unassigned sheets',
      error: error.message
    });
  }
};
// ─── GET AVAILABLE CHECKERS ─────────────────────────────────────

export const getAvailableCheckers = async (req, res) => {
  try {
    const { examId } = req.params;

    // Get exam subject
    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    const examSubject = examResult.rows[0]?.subject || null;

    // Get available checkers (checker or teacher_checker)
    const result = await pool.query(
      `SELECT 
        u.id, u.name, u.email, u.role, u.subject,
        COUNT(a.id) AS assigned_count
      FROM users u
      LEFT JOIN assignments a ON u.id = a.checker_id AND a.status = 'assigned'
      WHERE (u.role = 'checker' OR u.role = 'teacher_checker')
        AND u.is_active = true
      GROUP BY u.id
      ORDER BY assigned_count ASC, u.name ASC`,
      [],
    );

    const checkers = result.rows.map((checker) => {
      // Check for subject conflict
      let hasConflict = false;
      let conflictReason = null;

      if (checker.role === 'teacher_checker' && checker.subject) {
        if (examSubject && checker.subject !== examSubject) {
          hasConflict = true;
          conflictReason = `Subject mismatch: Can only check ${checker.subject}`;
        }
      }

      return {
        ...checker,
        hasConflict,
        conflictReason,
        canAssign: !hasConflict,
      };
    });

    return res.status(200).json({
      success: true,
      message: 'Available checkers retrieved successfully',
      data: checkers,
    });
  } catch (error) {
    console.error('getAvailableCheckers error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get available checkers',
      error: error.message,
    });
  }
};

// ─── ASSIGN SHEETS TO CHECKER ──────────────────────────────────

export const assignSheets = async (req, res) => {
  try {
    const { examId } = req.params;
    const { checkerId, sheetIds } = req.body;
    const userId = req.user.id;

    if (
      !checkerId ||
      !sheetIds ||
      !Array.isArray(sheetIds) ||
      sheetIds.length === 0
    ) {
      return res.status(400).json({
        success: false,
        message: 'checkerId and sheetIds array are required',
      });
    }

    // Validate checker
    const checkerResult = await pool.query(
      `SELECT id, role, subject FROM users 
       WHERE id = $1 AND is_active = true 
       AND (role = 'checker' OR role = 'teacher_checker')`,
      [checkerId],
    );

    if (checkerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Checker not found or not eligible',
      });
    }

    const checker = checkerResult.rows[0];

    // Get exam subject
    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    const examSubject = examResult.rows[0]?.subject || null;

    // Check subject conflict
    if (checker.role === 'teacher_checker' && checker.subject && examSubject) {
      if (checker.subject !== examSubject) {
        return res.status(400).json({
          success: false,
          message: `Checker can only check ${checker.subject} subject`,
        });
      }
    }

    const client = await pool.connect();
    let assignedCount = 0;
    const errors = [];

    try {
      await client.query('BEGIN');

      for (const sheetId of sheetIds) {
        try {
          // Check if sheet exists and is unassigned
          const sheetCheck = await client.query(
            `SELECT s.id, s.status 
             FROM sheets s
             LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'assigned'
             WHERE s.id = $1 AND s.exam_id = $2 
             AND (a.id IS NULL OR a.status != 'assigned')
             AND s.status IN ('uploaded', 'linked')`, // ✅ Both statuses allowed
            [sheetId, examId],
          );

          if (sheetCheck.rows.length === 0) {
            errors.push({
              sheetId,
              error: 'Sheet not found or already assigned',
            });
            continue;
          }

          // Insert assignment
          await client.query(
            `INSERT INTO assignments (
              exam_id, sheet_id, checker_id, assigned_by, status
            ) VALUES ($1, $2, $3, $4, 'assigned')`,
            [examId, sheetId, checkerId, userId],
          );

          // Update sheet status to 'assigned'
          await client.query(
            `UPDATE sheets SET status = 'assigned' WHERE id = $1`,
            [sheetId],
          );

          assignedCount++;
        } catch (err) {
          errors.push({ sheetId, error: err.message });
        }
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `${assignedCount} sheets assigned successfully`,
        data: {
          assigned: assignedCount,
          errors: errors,
          checker: {
            id: checker.id,
            name: checker.name,
          },
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('assignSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign sheets',
      error: error.message,
    });
  }
};


// ─── RANDOM ASSIGNMENT ──────────────────────────────────────────

export const randomAssignment = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;

    // Get exam subject
    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    const examSubject = examResult.rows[0]?.subject || null;

    // Get unassigned sheets (both uploaded and linked)
    const sheetsResult = await pool.query(
      `SELECT s.id 
       FROM sheets s
       LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'assigned'
       WHERE s.exam_id = $1 
         AND (a.id IS NULL OR a.status != 'assigned')
         AND s.status IN ('uploaded', 'linked')`, // ✅ Both statuses allowed
      [examId],
    );

    const unassignedSheetIds = sheetsResult.rows.map((row) => row.id);

    if (unassignedSheetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No unassigned sheets available',
      });
    }

    // Get eligible checkers
    const checkersResult = await pool.query(
      `SELECT u.id, u.name, u.role, u.subject
       FROM users u
       WHERE (u.role = 'checker' OR u.role = 'teacher_checker')
         AND u.is_active = true
       ORDER BY (
         SELECT COUNT(*) FROM assignments a 
         WHERE a.checker_id = u.id AND a.status = 'assigned'
       ) ASC`,
      [],
    );

    let eligibleCheckers = checkersResult.rows;

    if (examSubject) {
      eligibleCheckers = eligibleCheckers.filter((checker) => {
        if (checker.role === 'teacher_checker' && checker.subject) {
          return checker.subject === examSubject;
        }
        return true;
      });
    }

    if (eligibleCheckers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No eligible checkers available',
      });
    }

    const assignments = [];
    const sheetsPerChecker = Math.ceil(
      unassignedSheetIds.length / eligibleCheckers.length,
    );
    let sheetIndex = 0;

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const checker of eligibleCheckers) {
        const start = sheetIndex;
        const end = Math.min(
          start + sheetsPerChecker,
          unassignedSheetIds.length,
        );

        for (let i = start; i < end; i++) {
          const sheetId = unassignedSheetIds[i];

          await client.query(
            `INSERT INTO assignments (
              exam_id, sheet_id, checker_id, assigned_by, status
            ) VALUES ($1, $2, $3, $4, 'assigned')`,
            [examId, sheetId, checker.id, userId],
          );

          await client.query(
            `UPDATE sheets SET status = 'assigned' WHERE id = $1`,
            [sheetId],
          );

          assignments.push({
            sheetId,
            checkerId: checker.id,
            checkerName: checker.name,
          });
        }

        sheetIndex = end;
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `Randomly assigned ${assignments.length} sheets to ${eligibleCheckers.length} checkers`,
        data: {
          totalAssigned: assignments.length,
          checkersUsed: eligibleCheckers.length,
          assignments: assignments,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('randomAssignment error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to assign randomly',
      error: error.message,
    });
  }
};


// ─── GET ASSIGNMENTS BY EXAM ────────────────────────────────────

export const getAssignmentsByExam = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        a.id, a.sheet_id, a.checker_id, a.assigned_by, a.assigned_at,
        s.roll_no, s.student_name, s.barcode,
        c.name AS checker_name, c.email AS checker_email,
        assigned_by_user.name AS assigned_by_name
      FROM assignments a
      JOIN sheets s ON a.sheet_id = s.id
      JOIN users c ON a.checker_id = c.id
      JOIN users assigned_by_user ON a.assigned_by = assigned_by_user.id
      WHERE a.exam_id = $1 AND a.status = 'assigned'
      ORDER BY a.assigned_at DESC`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Assignments retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getAssignmentsByExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get assignments',
      error: error.message,
    });
  }
};

// ─── GET ASSIGNMENTS BY CHECKER ────────────────────────────────

export const getAssignmentsByChecker = async (req, res) => {
  try {
    const { checkerId } = req.params;

    const result = await pool.query(
      `SELECT 
        a.id, a.exam_id, a.sheet_id, a.assigned_at,
        e.name AS exam_name, e.subject AS exam_subject,
        s.roll_no, s.student_name, s.barcode, s.file_name
      FROM assignments a
      JOIN exams e ON a.exam_id = e.id
      JOIN sheets s ON a.sheet_id = s.id
      WHERE a.checker_id = $1 AND a.status = 'assigned'
      ORDER BY a.assigned_at DESC`,
      [checkerId],
    );

    return res.status(200).json({
      success: true,
      message: 'Checker assignments retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getAssignmentsByChecker error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker assignments',
      error: error.message,
    });
  }
};

// ─── UNASSIGN SHEET ─────────────────────────────────────────────

export const unassignSheet = async (req, res) => {
  try {
    const { assignmentId } = req.params;

    const result = await pool.query(
      `UPDATE assignments 
       SET status = 'unassigned', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND status = 'assigned'
       RETURNING sheet_id`,
      [assignmentId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Assignment not found or already unassigned',
      });
    }

    // Update sheet status back to uploaded
    await pool.query(`UPDATE sheets SET status = 'uploaded' WHERE id = $1`, [
      result.rows[0].sheet_id,
    ]);

    return res.status(200).json({
      success: true,
      message: 'Sheet unassigned successfully',
    });
  } catch (error) {
    console.error('unassignSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to unassign sheet',
      error: error.message,
    });
  }
};
