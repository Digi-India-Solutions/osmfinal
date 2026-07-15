import pool from '../pool.js';

// ─── HELPER: Case-insensitive subject compare ──────────────────

const isSubjectMatch = (subject1, subject2) => {
  if (!subject1 && !subject2) return true;
  if (!subject1 || !subject2) return false;
  return subject1.trim().toLowerCase() === subject2.trim().toLowerCase();
};

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
        AND (s.status = 'uploaded' OR s.status = 'linked')
      ORDER BY s.id ASC`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Unassigned sheets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getUnassignedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unassigned sheets',
      error: error.message,
    });
  }
};

// ─── GET AVAILABLE CHECKERS ─────────────────────────────────────

export const getAvailableCheckers = async (req, res) => {
  try {
    const { examId } = req.params;

    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    const examSubject = examResult.rows[0]?.subject || null;

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
      let hasConflict = false;
      let conflictReason = null;

      if (checker.role === 'teacher_checker' && checker.subject) {
        if (!isSubjectMatch(checker.subject, examSubject)) {
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

// ─── ASSIGN SHEETS TO CHECKER (UPDATED - SUPPORTS REASSIGN) ───

export const assignSheets = async (req, res) => {
  try {
    const { examId } = req.params;
    const { checkerId, sheetIds } = req.body;
    const userId = req.user.id;

    console.log('📋 Assign sheets request:', { examId, checkerId, sheetIds });

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

    // ✅ Check if checker exists and is eligible
    const checkerResult = await pool.query(
      `SELECT id, name, role, subject FROM users 
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

    // ✅ Get exam subject for conflict check
    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const examSubject = examResult.rows[0]?.subject || null;

    // ✅ Check subject conflict
    if (checker.role === 'teacher_checker' && checker.subject && examSubject) {
      if (!isSubjectMatch(checker.subject, examSubject)) {
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
          console.log(`🔍 Processing sheet ${sheetId} for exam ${examId}`);

          // ✅ Check if sheet exists and belongs to the exam
          const sheetCheck = await client.query(
            `SELECT s.id, s.status, s.assigned_to as current_assigned_to
             FROM sheets s
             WHERE s.id = $1 AND s.exam_id = $2 
             AND s.status IN ('uploaded', 'linked', 'assigned')`,
            [sheetId, examId],
          );

          if (sheetCheck.rows.length === 0) {
            console.log(`❌ Sheet ${sheetId} not found or not assignable`);
            errors.push({
              sheetId,
              error: 'Sheet not found or not in assignable status',
            });
            continue;
          }

          const sheet = sheetCheck.rows[0];

          // ✅ Check if assignment already exists
          const existingAssignment = await client.query(
            `SELECT id FROM assignments 
             WHERE sheet_id = $1 AND status = 'assigned'`,
            [sheetId],
          );

          if (existingAssignment.rows.length > 0) {
            // ✅ Update existing assignment
            console.log(`📝 Updating assignment for sheet ${sheetId}`);
            await client.query(
              `UPDATE assignments 
               SET checker_id = $1, 
                   assigned_by = $2,
                   updated_at = NOW()
               WHERE sheet_id = $3 AND status = 'assigned'`,
              [checkerId, userId, sheetId],
            );
          } else {
            // ✅ Insert new assignment
            console.log(`📝 Creating new assignment for sheet ${sheetId}`);
            await client.query(
              `INSERT INTO assignments (
                exam_id, sheet_id, checker_id, assigned_by, status
              ) VALUES ($1, $2, $3, $4, 'assigned')`,
              [examId, sheetId, checkerId, userId],
            );
          }

          // ✅ Update sheets table with assigned_to
          await client.query(
            `UPDATE sheets 
             SET status = 'assigned', 
                 assigned_to = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [checkerId, sheetId],
          );

          assignedCount++;
          console.log(`✅ Sheet ${sheetId} assigned successfully`);
        } catch (err) {
          console.error(`❌ Error processing sheet ${sheetId}:`, err);
          errors.push({ sheetId, error: err.message });
        }
      }

      await client.query('COMMIT');

      console.log(
        `✅ Assignment complete: ${assignedCount} assigned, ${errors.length} errors`,
      );

      return res.status(200).json({
        success: true,
        message: `${assignedCount} sheets assigned successfully`,
        data: {
          assigned: assignedCount,
          errors: errors,
          checker: {
            id: checker.id,
            name: checker.name,
            role: checker.role,
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

    const examResult = await pool.query(
      `SELECT subject FROM exams WHERE id = $1`,
      [examId],
    );

    const examSubject = examResult.rows[0]?.subject || null;

    const sheetsResult = await pool.query(
      `SELECT s.id 
       FROM sheets s
       LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'assigned'
       WHERE s.exam_id = $1 
         AND (a.id IS NULL OR a.status != 'assigned')
         AND s.status IN ('uploaded', 'linked')`,
      [examId],
    );

    const unassignedSheetIds = sheetsResult.rows.map((row) => row.id);

    if (unassignedSheetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No unassigned sheets available',
      });
    }

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
          return isSubjectMatch(checker.subject, examSubject);
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
            `UPDATE sheets 
             SET status = 'assigned', 
                 assigned_to = $1,
                 updated_at = NOW()
             WHERE id = $2`,
            [checker.id, sheetId],
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

// ─── GET MY ASSIGNED SHEETS (CHECKER WORK QUEUE) ──────────────

export const getMyAssignedSheets = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    // ✅ IMPORTANT: do NOT restrict the join to a.status = 'assigned' only.
    // When a checker submits marks (submitMarks in checkerMarkingCont.js),
    // the assignment row's status is updated to 'completed'. If this join
    // only allowed 'assigned', every checked sheet would silently vanish
    // from this checker's queue and from the stats counts below.
    let conditions = ['a.checker_id = $1'];
    const params = [userId];
    let paramCount = 2;

    if (status) {
      conditions.push(`s.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    // ✅ DISTINCT ON (s.id) so a sheet with more than one assignment row
    // for this checker (e.g. it went 'assigned' -> 'completed', or was
    // reassigned) only appears once, using the most recently updated row.
    const { rows } = await pool.query(
      `SELECT DISTINCT ON (s.id)
        s.id,
        s.exam_id,
        s.student_id,
        s.roll_no,
        s.student_name,
        s.barcode,
        s.file_name,
        s.file_url,
        s.status,
        s.marks,
        s.created_at,
        s.updated_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time,
        u.name AS checker_name,
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr 
          WHERE rr.sheet_id = s.id AND rr.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM sheets s
      INNER JOIN assignments a ON s.id = a.sheet_id 
        AND a.checker_id = $1 
        AND a.status IN ('assigned', 'completed')
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON a.checker_id = u.id
      WHERE ${whereClause}
      ORDER BY s.id, a.updated_at DESC
      `,
      params,
    );

    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE s.status IN ('assigned', 'uploaded')) AS pending_count,
        COUNT(*) FILTER (WHERE s.status = 'checking') AS checking_count,
        COUNT(*) FILTER (WHERE s.status = 'checked') AS completed_count,
        COUNT(*) FILTER (WHERE s.status = 'recheck') AS recheck_count
      FROM (
        SELECT DISTINCT ON (s.id) s.id, s.status
        FROM sheets s
        INNER JOIN assignments a ON s.id = a.sheet_id 
          AND a.checker_id = $1 
          AND a.status IN ('assigned', 'completed')
        ORDER BY s.id, a.updated_at DESC
      ) s`,
      [userId],
    );

    const counts = countResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Assigned sheets retrieved successfully',
      data: {
        items: rows,
        stats: {
          pending: parseInt(counts.pending_count || 0),
          checking: parseInt(counts.checking_count || 0),
          completed: parseInt(counts.completed_count || 0),
          recheck: parseInt(counts.recheck_count || 0),
        },
      },
    });
  } catch (error) {
    console.error('getMyAssignedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get assigned sheets',
      error: error.message,
    });
  }
};

// ─── GET SHEET FOR MARKING ─────────────────────────────────────

export const getSheetForMarking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT 
        s.id,
        s.exam_id,
        s.student_id,
        s.roll_no,
        s.student_name,
        s.barcode,
        s.file_name,
        s.file_url,
        s.status,
        s.marks,
        s.created_at,
        s.updated_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."totalQuestions",
        e."maxMarks",
        e."spentTime" AS exam_spent_time,
        ms."questionName",
        ms."maxMarks" AS questionMaxMarks,
        ms.guidelines,
        ms.model_answer_pdf,
        ms.question_paper_pdf
      FROM sheets s
      INNER JOIN assignments a ON s.id = a.sheet_id AND a.status = 'assigned'
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN mark_schemes ms ON ms."examId" = e.id
      WHERE s.id = $1 AND a.checker_id = $2`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const markScheme = {};
    rows.forEach((row) => {
      if (row.questionName) {
        markScheme[row.questionName] = {
          maxMarks: row.questionmaxmarks || row.questionMaxMarks || 0,
          guidelines: row.guidelines || '',
        };
      }
    });

    const sheet = rows[0];

    return res.status(200).json({
      success: true,
      message: 'Sheet retrieved successfully',
      data: {
        sheet: {
          id: sheet.id,
          exam_id: sheet.exam_id,
          student_id: sheet.student_id,
          roll_no: sheet.roll_no,
          student_name: sheet.student_name,
          barcode: sheet.barcode,
          file_name: sheet.file_name,
          file_url: sheet.file_url,
          status: sheet.status,
          marks: sheet.marks,
        },
        exam: {
          id: sheet.exam_id,
          name: sheet.exam_name,
          subject: sheet.exam_subject,
          totalQuestions: sheet.totalQuestions || 0,
          maxMarks: sheet.maxMarks || 0,
          spentTime: sheet.exam_spent_time || 0,
        },
        markScheme: markScheme,
        pdfs: {
          model_answer: sheet.model_answer_pdf,
          question_paper: sheet.question_paper_pdf,
        },
      },
    });
  } catch (error) {
    console.error('getSheetForMarking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheet for marking',
      error: error.message,
    });
  }
};

// ─── UPDATE CHECKER SHEET STATUS ──────────────────────────────

export const updateCheckerSheetStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, marks } = req.body;
    const userId = req.user.id;

    const validStatuses = ['assigned', 'checking', 'checked'];
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    const checkResult = await pool.query(
      `SELECT a.sheet_id 
       FROM assignments a
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
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

    return res.status(200).json({
      success: true,
      message: 'Sheet updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('updateCheckerSheetStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update sheet',
      error: error.message,
    });
  }
};

// ─── SAVE DRAFT MARKS ──────────────────────────────────────────

export const saveDraftMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks } = req.body;
    const userId = req.user.id;

    const checkResult = await pool.query(
      `SELECT a.sheet_id 
       FROM assignments a
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    await pool.query(
      `UPDATE sheets 
       SET marks = $1, updated_at = NOW()
       WHERE id = $2`,
      [marks, id],
    );

    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully',
    });
  } catch (error) {
    console.error('saveDraftMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
    });
  }
};
