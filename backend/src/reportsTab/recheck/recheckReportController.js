// src/controllers/recheckReportController.js

import pool from '../../pool.js';

// ─── GET RECHECK REPORT DATA ──────────────────────────────────

export const getRecheckReport = async (req, res) => {
  try {
    const { examId } = req.params;

    console.log('🔍 Fetching recheck report for exam:', examId);

    // Check if exam exists
    const examResult = await pool.query(
      `SELECT id, name, subject FROM exams WHERE id = $1`,
      [examId],
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const exam = examResult.rows[0];
    console.log('✅ Exam found:', exam.name);

    // Get completed recheck requests for this exam
    const recheckResult = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.reason,
        rr.status,
        rr.final_marks_rule,
        rr.created_at,
        rr.resolved_at,
        rr.remarks,
        s.roll_no,
        s.student_name,
        s.marks AS current_marks,
        cm.marks_data AS original_marks_data,
        cm.total_marks AS original_total,
        rm.marks_data AS recheck_marks_data,
        rm.total_marks AS recheck_total,
        u.name AS rechecker_name
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN checker_markings cm ON s.id = cm.sheet_id AND cm.is_submitted = true
      LEFT JOIN recheck_markings rm ON rr.id = rm.recheck_request_id AND rm.is_submitted = true
      LEFT JOIN users u ON rr.resolved_by = u.id
      WHERE rr.exam_id = $1 
        AND rr.status = 'completed'
      ORDER BY rr.created_at DESC`,
      [examId],
    );

    console.log(`📊 Found ${recheckResult.rows.length} recheck records`);

    if (recheckResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No recheck records found for this exam',
        data: {
          exam: {
            id: exam.id,
            name: exam.name,
            subject: exam.subject,
          },
          rechecks: [],
          stats: {
            total: 0,
            increased: 0,
            decreased: 0,
            noChange: 0,
          },
        },
      });
    }

    // Process recheck data
    const rechecks = recheckResult.rows.map((row) => {
      const originalTotal = parseFloat(row.original_total) || 0;
      const recheckTotal = parseFloat(row.recheck_total) || originalTotal;
      const diff = parseFloat((recheckTotal - originalTotal).toFixed(2));

      return {
        id: row.id,
        sheetId: row.sheet_id,
        rollNo: row.roll_no || 'N/A',
        studentName: row.student_name || 'Unknown',
        originalTotal: originalTotal,
        recheckedTotal: recheckTotal,
        diff: diff,
        finalMarksRule: row.final_marks_rule || 'higher',
        reason: row.reason,
        remarks: row.remarks,
        recheckerName: row.rechecker_name || 'Unknown',
        createdAt: row.created_at,
        resolvedAt: row.resolved_at,
        originalMarksData: row.original_marks_data || {},
        recheckMarksData: row.recheck_marks_data || {},
      };
    });

    // Calculate stats
    const total = rechecks.length;
    const increased = rechecks.filter((r) => r.diff > 0).length;
    const decreased = rechecks.filter((r) => r.diff < 0).length;
    const noChange = rechecks.filter((r) => r.diff === 0).length;

    console.log('📊 Stats:', { total, increased, decreased, noChange });

    return res.status(200).json({
      success: true,
      message: 'Recheck report retrieved successfully',
      data: {
        exam: {
          id: exam.id,
          name: exam.name,
          subject: exam.subject,
        },
        rechecks: rechecks,
        stats: {
          total,
          increased,
          decreased,
          noChange,
        },
      },
    });
  } catch (error) {
    console.error('❌ getRecheckReport error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck report',
      error: error.message,
    });
  }
};

// ─── GET RECHECK SUMMARY BY EXAM ──────────────────────────────

export const getRecheckSummary = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) AS total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
        COUNT(*) FILTER (WHERE COALESCE(final_marks_rule, 'higher') = 'higher') AS higher_rule,
        COUNT(*) FILTER (WHERE final_marks_rule = 'recheck_marks') AS recheck_marks_rule,
        COUNT(*) FILTER (WHERE final_marks_rule = 'average') AS average_rule
      FROM recheck_requests
      WHERE exam_id = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Recheck summary retrieved successfully',
      data: result.rows[0] || {
        total_requests: 0,
        pending: 0,
        completed: 0,
        rejected: 0,
        escalated: 0,
        higher_rule: 0,
        recheck_marks_rule: 0,
        average_rule: 0,
      },
    });
  } catch (error) {
    console.error('❌ getRecheckSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck summary',
      error: error.message,
    });
  }
};

// ─── GET RECHECK DETAILS BY REQUEST ID ────────────────────────

export const getRecheckDetail = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        rr.*,
        s.roll_no,
        s.student_name,
        s.marks AS current_marks,
        cm.marks_data AS original_marks_data,
        cm.total_marks AS original_total,
        rm.marks_data AS recheck_marks_data,
        rm.total_marks AS recheck_total,
        u.name AS rechecker_name,
        u2.name AS requested_by_name
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN checker_markings cm ON s.id = cm.sheet_id AND cm.is_submitted = true
      LEFT JOIN recheck_markings rm ON rr.id = rm.recheck_request_id AND rm.is_submitted = true
      LEFT JOIN users u ON rr.resolved_by = u.id
      LEFT JOIN users u2 ON rr.requested_by = u2.id
      WHERE rr.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck detail retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('❌ getRecheckDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck detail',
      error: error.message,
    });
  }
};
