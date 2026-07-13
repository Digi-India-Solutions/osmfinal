// src/controllers/checkerPerformanceController.js

import pool from '../../pool.js';

// ─── GET CHECKER PERFORMANCE DATA ─────────────────────────────

export const getCheckerPerformance = async (req, res) => {
  try {
    const { examId } = req.params;

    console.log('🔍 Fetching checker performance for exam:', examId);

    // Check if exam exists (if examId is provided)
    let examName = 'All Exams';
    if (examId) {
      const examResult = await pool.query(
        `SELECT id, name FROM exams WHERE id = $1`,
        [examId],
      );
      if (examResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Exam not found',
        });
      }
      examName = examResult.rows[0].name;
    }

    // Get checker performance data
    let query = `
      SELECT 
        u.id AS checker_id,
        u.name AS checker_name,
        u.role,
        COUNT(DISTINCT a.sheet_id) AS sheets_completed,
        COALESCE(AVG(EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60), 0) AS avg_time_minutes,
        COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS checked_count,
        COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status = 'recheck') AS recheck_count,
        COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status = 'escalated') AS escalated_count
      FROM assignments a
      JOIN users u ON a.checker_id = u.id
      JOIN sheets s ON a.sheet_id = s.id
      WHERE (u.role = 'checker' OR u.role = 'teacher_checker' OR u.role = 'rechecking')
        AND u.is_active = true
        AND a.status = 'assigned'
    `;

    const params = [];
    if (examId) {
      query += ` AND a.exam_id = $1`;
      params.push(examId);
    }

    query += `
      GROUP BY u.id, u.name, u.role
      ORDER BY sheets_completed DESC, avg_time_minutes ASC
    `;

    const result = await pool.query(query, params);

    console.log(`📊 Found ${result.rows.length} checkers`);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No checker performance data found',
        data: {
          exam: { id: examId || null, name: examName },
          checkers: [],
          stats: {
            totalCheckers: 0,
            totalSheetsCompleted: 0,
            averageTime: 0,
            mostEfficient: null,
          },
        },
      });
    }

    // Calculate overall stats
    const checkers = result.rows.map((row) => ({
      checkerId: row.checker_id,
      checkerName: row.checker_name,
      role: row.role,
      sheetsCompleted: parseInt(row.sheets_completed) || 0,
      avgTimeMinutes: parseFloat(row.avg_time_minutes) || 0,
      checkedCount: parseInt(row.checked_count) || 0,
      recheckCount: parseInt(row.recheck_count) || 0,
      escalatedCount: parseInt(row.escalated_count) || 0,
    }));

    const totalSheetsCompleted = checkers.reduce(
      (sum, c) => sum + c.sheetsCompleted,
      0,
    );
    const totalTime = checkers.reduce(
      (sum, c) => sum + c.avgTimeMinutes * c.sheetsCompleted,
      0,
    );
    const averageTime =
      totalSheetsCompleted > 0 ? totalTime / totalSheetsCompleted : 0;

    // Find most efficient checker (highest sheets with lowest avg time)
    const mostEfficient =
      checkers.length > 0
        ? checkers.reduce((a, b) =>
            a.sheetsCompleted / (a.avgTimeMinutes || 1) >
            b.sheetsCompleted / (b.avgTimeMinutes || 1)
              ? a
              : b,
          )
        : null;

    return res.status(200).json({
      success: true,
      message: 'Checker performance data retrieved successfully',
      data: {
        exam: { id: examId || null, name: examName },
        checkers: checkers,
        stats: {
          totalCheckers: checkers.length,
          totalSheetsCompleted: totalSheetsCompleted,
          averageTime: parseFloat(averageTime.toFixed(2)),
          mostEfficient: mostEfficient
            ? {
                name: mostEfficient.checkerName,
                sheetsCompleted: mostEfficient.sheetsCompleted,
                avgTimeMinutes: mostEfficient.avgTimeMinutes,
              }
            : null,
        },
      },
    });
  } catch (error) {
    console.error('❌ getCheckerPerformance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker performance data',
      error: error.message,
    });
  }
};

// ─── GET CHECKER DETAIL ────────────────────────────────────────

export const getCheckerDetail = async (req, res) => {
  try {
    const { checkerId } = req.params;
    const { examId } = req.query;

    let query = `
      SELECT 
        s.id AS sheet_id,
        s.roll_no,
        s.student_name,
        s.marks,
        s.status,
        s.created_at,
        s.updated_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        a.assigned_at,
        EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60 AS time_taken_minutes
      FROM assignments a
      JOIN sheets s ON a.sheet_id = s.id
      JOIN exams e ON s.exam_id = e.id
      WHERE a.checker_id = $1
        AND a.status = 'assigned'
        AND s.status IN ('checked', 'rechecked')
    `;

    const params = [checkerId];
    let paramCount = 2;

    if (examId) {
      query += ` AND s.exam_id = $${paramCount}`;
      params.push(examId);
      paramCount++;
    }

    query += ` ORDER BY s.updated_at DESC`;

    const result = await pool.query(query, params);

    // Get checker info
    const checkerResult = await pool.query(
      `SELECT id, name, email, role, subject FROM users WHERE id = $1`,
      [checkerId],
    );

    if (checkerResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Checker not found',
      });
    }

    const checker = checkerResult.rows[0];
    const sheets = result.rows.map((row) => ({
      sheetId: row.sheet_id,
      rollNo: row.roll_no || 'N/A',
      studentName: row.student_name || 'Unknown',
      marks: parseFloat(row.marks) || 0,
      status: row.status,
      examName: row.exam_name,
      examSubject: row.exam_subject,
      assignedAt: row.assigned_at,
      completedAt: row.updated_at,
      timeTakenMinutes: parseFloat(row.time_taken_minutes) || 0,
    }));

    // Calculate stats
    const totalSheets = sheets.length;
    const avgTime =
      totalSheets > 0
        ? sheets.reduce((sum, s) => sum + s.timeTakenMinutes, 0) / totalSheets
        : 0;

    return res.status(200).json({
      success: true,
      message: 'Checker detail retrieved successfully',
      data: {
        checker: {
          id: checker.id,
          name: checker.name,
          email: checker.email,
          role: checker.role,
          subject: checker.subject,
        },
        sheets: sheets,
        stats: {
          totalSheets: totalSheets,
          averageTime: parseFloat(avgTime.toFixed(2)),
          totalMarksGiven: sheets.reduce((sum, s) => sum + s.marks, 0),
        },
      },
    });
  } catch (error) {
    console.error('❌ getCheckerDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker detail',
      error: error.message,
    });
  }
};

// ─── GET RECHECKER PERFORMANCE ─────────────────────────────────

export const getRecheckerPerformance = async (req, res) => {
  try {
    const { examId } = req.params;

    let query = `
      SELECT 
        u.id AS rechecker_id,
        u.name AS rechecker_name,
        COUNT(rr.id) AS total_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status = 'completed') AS completed_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status = 'pending') AS pending_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status = 'escalated') AS escalated_rechecks,
        COALESCE(AVG(EXTRACT(EPOCH FROM (rr.resolved_at - rr.created_at)) / 60), 0) AS avg_time_minutes
      FROM recheck_requests rr
      JOIN users u ON rr.assign_to = u.id
      WHERE u.role = 'rechecking'
        AND u.is_active = true
    `;

    const params = [];
    if (examId) {
      query += ` AND rr.exam_id = $1`;
      params.push(examId);
    }

    query += `
      GROUP BY u.id, u.name
      ORDER BY completed_rechecks DESC
    `;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Rechecker performance data retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('❌ getRecheckerPerformance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get rechecker performance data',
      error: error.message,
    });
  }
};
