// src/controllers/dashboardController.js

import pool from '../pool.js';

// ─── GET DASHBOARD STATS ───────────────────────────────────────

export const getDashboardStats = async (req, res) => {
  try {
    // Get sheet stats
    const sheetStats = await pool.query(`
      SELECT 
        COUNT(*) AS total_sheets,
        COUNT(*) FILTER (WHERE status = 'uploaded') AS uploaded,
        COUNT(*) FILTER (WHERE status = 'checking') AS checking,
        COUNT(*) FILTER (WHERE status = 'checked') AS checked,
        COUNT(*) FILTER (WHERE status = 'recheck') AS recheck,
        COUNT(*) FILTER (WHERE status = 'rechecked') AS rechecked,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated
      FROM sheets
    `);

    // Get exam count
    const examCount = await pool.query(`
      SELECT COUNT(*) AS total FROM exams WHERE status != 'archived'
    `);

    // Get user count
    const userCount = await pool.query(`
      SELECT COUNT(*) AS total FROM users WHERE is_active = true
    `);

    // Get student count
    const studentCount = await pool.query(`
      SELECT COUNT(*) AS total FROM student_records
    `);

    // Get recheck stats
    const recheckStats = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_rechecks,
        COUNT(*) FILTER (WHERE status = 'requested_by_teacher') AS teacher_disputes
      FROM recheck_requests
    `);

    // Get completed by checkers
    const checkerCompleted = await pool.query(`
      SELECT COUNT(*) AS completed
      FROM sheets 
      WHERE status IN ('checked', 'rechecked')
    `);

    const stats = sheetStats.rows[0] || {};
    const recheck = recheckStats.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Dashboard stats retrieved successfully',
      data: {
        totalSheets: parseInt(stats.total_sheets || 0),
        totalExams: parseInt(examCount.rows[0]?.total || 0),
        totalUsers: parseInt(userCount.rows[0]?.total || 0),
        totalStudents: parseInt(studentCount.rows[0]?.total || 0),
        uploaded: parseInt(stats.uploaded || 0),
        checking: parseInt(stats.checking || 0),
        checked: parseInt(stats.checked || 0),
        recheck: parseInt(stats.recheck || 0),
        rechecked: parseInt(stats.rechecked || 0),
        escalated: parseInt(stats.escalated || 0),
        pendingRechecks: parseInt(recheck.pending_rechecks || 0),
        teacherDisputes: parseInt(recheck.teacher_disputes || 0),
        completedByCheckers: parseInt(checkerCompleted.rows[0]?.completed || 0),
      },
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard stats',
      error: error.message,
    });
  }
};

// ─── GET STATUS CHART DATA ─────────────────────────────────────

export const getStatusChart = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        status,
        COUNT(*) AS count
      FROM sheets
      GROUP BY status
      ORDER BY 
        CASE status
          WHEN 'uploaded' THEN 1
          WHEN 'checking' THEN 2
          WHEN 'checked' THEN 3
          WHEN 'recheck' THEN 4
          WHEN 'rechecked' THEN 5
          WHEN 'escalated' THEN 6
          ELSE 7
        END
    `);

    const statusColors = {
      uploaded: '#9ca3af',
      checking: '#f59e0b',
      checked: '#34d399',
      recheck: '#a78bfa',
      rechecked: '#059669',
      escalated: '#ef4444',
    };

    const data = result.rows.map((row) => ({
      status: row.status.charAt(0).toUpperCase() + row.status.slice(1),
      count: parseInt(row.count),
      fill: statusColors[row.status] || '#6b7280',
    }));

    return res.status(200).json({
      success: true,
      message: 'Status chart data retrieved successfully',
      data: data,
    });
  } catch (error) {
    console.error('getStatusChart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get status chart data',
      error: error.message,
    });
  }
};

// ─── GET RECENT SHEETS ─────────────────────────────────────────

export const getRecentSheets = async (req, res) => {
  try {
    const { limit = 8 } = req.query;

    const result = await pool.query(
      `
      SELECT 
        s.id,
        s.student_name,
        s.status,
        s.created_at,
        e.name AS exam_name,
        u.name AS assigned_to_name
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.assigned_to = u.id
      ORDER BY s.created_at DESC
      LIMIT $1
    `,
      [parseInt(limit)],
    );

    return res.status(200).json({
      success: true,
      message: 'Recent sheets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getRecentSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recent sheets',
      error: error.message,
    });
  }
};

// ─── GET CHECKER STATS ─────────────────────────────────────────

export const getCheckerStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id,
        u.name,
        COUNT(a.id) AS assigned_count,
        COUNT(s.id) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS completed_count
      FROM users u
      LEFT JOIN assignments a ON u.id = a.checker_id AND a.status = 'assigned'
      LEFT JOIN sheets s ON a.sheet_id = s.id
      WHERE u.role IN ('checker', 'teacher_checker')
        AND u.is_active = true
      GROUP BY u.id, u.name
      ORDER BY completed_count DESC
    `);

    return res.status(200).json({
      success: true,
      message: 'Checker stats retrieved successfully',
      data: {
        checkers: result.rows,
        total: result.rows.length,
        completed: result.rows.reduce(
          (sum, r) => sum + parseInt(r.completed_count || 0),
          0,
        ),
      },
    });
  } catch (error) {
    console.error('getCheckerStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker stats',
      error: error.message,
    });
  }
};

// ─── GET RECHECK STATS ─────────────────────────────────────────

export const getRecheckStats = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'requested_by_teacher') AS teacher_disputes,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected
      FROM recheck_requests
    `);

    return res.status(200).json({
      success: true,
      message: 'Recheck stats retrieved successfully',
      data: result.rows[0] || {
        pending: 0,
        teacher_disputes: 0,
        completed: 0,
        rejected: 0,
      },
    });
  } catch (error) {
    console.error('getRecheckStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck stats',
      error: error.message,
    });
  }
};
