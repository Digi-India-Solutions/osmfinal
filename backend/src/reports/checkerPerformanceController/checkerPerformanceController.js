// // src/controllers/checkerPerformanceController.js

// import pool from '../../pool.js';

// // ─── GET CHECKER PERFORMANCE DATA ─────────────────────────────

// export const getCheckerPerformance = async (req, res) => {
//   try {
//     const { examId } = req.params;

//     console.log('🔍 Fetching checker performance for exam:', examId);

//     // Check if exam exists (if examId is provided)
//     let examName = 'All Exams';
//     if (examId) {
//       const examResult = await pool.query(
//         `SELECT id, name FROM exams WHERE id = $1`,
//         [examId],
//       );
//       if (examResult.rows.length === 0) {
//         return res.status(404).json({
//           success: false,
//           message: 'Exam not found',
//         });
//       }
//       examName = examResult.rows[0].name;
//     }

//     // Get checker performance data
//     let query = `
//       SELECT 
//         u.id AS checker_id,
//         u.name AS checker_name,
//         u.role,
//         COUNT(DISTINCT a.sheet_id) AS sheets_completed,
//         COALESCE(AVG(EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60), 0) AS avg_time_minutes,
//         COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS checked_count,
//         COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status = 'recheck') AS recheck_count,
//         COUNT(DISTINCT a.sheet_id) FILTER (WHERE s.status = 'escalated') AS escalated_count
//       FROM assignments a
//       JOIN users u ON a.checker_id = u.id
//       JOIN sheets s ON a.sheet_id = s.id
//       WHERE (u.role = 'checker' OR u.role = 'teacher_checker' OR u.role = 'rechecking')
//         AND u.is_active = true
//         AND a.status = 'assigned'
//     `;

//     const params = [];
//     if (examId) {
//       query += ` AND a.exam_id = $1`;
//       params.push(examId);
//     }

//     query += `
//       GROUP BY u.id, u.name, u.role
//       ORDER BY sheets_completed DESC, avg_time_minutes ASC
//     `;

//     const result = await pool.query(query, params);

//     console.log(`📊 Found ${result.rows.length} checkers`);

//     if (result.rows.length === 0) {
//       return res.status(200).json({
//         success: true,
//         message: 'No checker performance data found',
//         data: {
//           exam: { id: examId || null, name: examName },
//           checkers: [],
//           stats: {
//             totalCheckers: 0,
//             totalSheetsCompleted: 0,
//             averageTime: 0,
//             mostEfficient: null,
//           },
//         },
//       });
//     }

//     // Calculate overall stats
//     const checkers = result.rows.map((row) => ({
//       checkerId: row.checker_id,
//       checkerName: row.checker_name,
//       role: row.role,
//       sheetsCompleted: parseInt(row.sheets_completed) || 0,
//       avgTimeMinutes: parseFloat(row.avg_time_minutes) || 0,
//       checkedCount: parseInt(row.checked_count) || 0,
//       recheckCount: parseInt(row.recheck_count) || 0,
//       escalatedCount: parseInt(row.escalated_count) || 0,
//     }));

//     const totalSheetsCompleted = checkers.reduce(
//       (sum, c) => sum + c.sheetsCompleted,
//       0,
//     );
//     const totalTime = checkers.reduce(
//       (sum, c) => sum + c.avgTimeMinutes * c.sheetsCompleted,
//       0,
//     );
//     const averageTime =
//       totalSheetsCompleted > 0 ? totalTime / totalSheetsCompleted : 0;

//     // Find most efficient checker (highest sheets with lowest avg time)
//     const mostEfficient =
//       checkers.length > 0
//         ? checkers.reduce((a, b) =>
//             a.sheetsCompleted / (a.avgTimeMinutes || 1) >
//             b.sheetsCompleted / (b.avgTimeMinutes || 1)
//               ? a
//               : b,
//           )
//         : null;

//     return res.status(200).json({
//       success: true,
//       message: 'Checker performance data retrieved successfully',
//       data: {
//         exam: { id: examId || null, name: examName },
//         checkers: checkers,
//         stats: {
//           totalCheckers: checkers.length,
//           totalSheetsCompleted: totalSheetsCompleted,
//           averageTime: parseFloat(averageTime.toFixed(2)),
//           mostEfficient: mostEfficient
//             ? {
//                 name: mostEfficient.checkerName,
//                 sheetsCompleted: mostEfficient.sheetsCompleted,
//                 avgTimeMinutes: mostEfficient.avgTimeMinutes,
//               }
//             : null,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('❌ getCheckerPerformance error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get checker performance data',
//       error: error.message,
//     });
//   }
// };

// // ─── GET CHECKER DETAIL ────────────────────────────────────────

// export const getCheckerDetail = async (req, res) => {
//   try {
//     const { checkerId } = req.params;
//     const { examId } = req.query;

//     let query = `
//       SELECT 
//         s.id AS sheet_id,
//         s.roll_no,
//         s.student_name,
//         s.marks,
//         s.status,
//         s.created_at,
//         s.updated_at,
//         e.name AS exam_name,
//         e.subject AS exam_subject,
//         a.assigned_at,
//         EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60 AS time_taken_minutes
//       FROM assignments a
//       JOIN sheets s ON a.sheet_id = s.id
//       JOIN exams e ON s.exam_id = e.id
//       WHERE a.checker_id = $1
//         AND a.status = 'assigned'
//         AND s.status IN ('checked', 'rechecked')
//     `;

//     const params = [checkerId];
//     let paramCount = 2;

//     if (examId) {
//       query += ` AND s.exam_id = $${paramCount}`;
//       params.push(examId);
//       paramCount++;
//     }

//     query += ` ORDER BY s.updated_at DESC`;

//     const result = await pool.query(query, params);

//     // Get checker info
//     const checkerResult = await pool.query(
//       `SELECT id, name, email, role, subject FROM users WHERE id = $1`,
//       [checkerId],
//     );

//     if (checkerResult.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Checker not found',
//       });
//     }

//     const checker = checkerResult.rows[0];
//     const sheets = result.rows.map((row) => ({
//       sheetId: row.sheet_id,
//       rollNo: row.roll_no || 'N/A',
//       studentName: row.student_name || 'Unknown',
//       marks: parseFloat(row.marks) || 0,
//       status: row.status,
//       examName: row.exam_name,
//       examSubject: row.exam_subject,
//       assignedAt: row.assigned_at,
//       completedAt: row.updated_at,
//       timeTakenMinutes: parseFloat(row.time_taken_minutes) || 0,
//     }));

//     // Calculate stats
//     const totalSheets = sheets.length;
//     const avgTime =
//       totalSheets > 0
//         ? sheets.reduce((sum, s) => sum + s.timeTakenMinutes, 0) / totalSheets
//         : 0;

//     return res.status(200).json({
//       success: true,
//       message: 'Checker detail retrieved successfully',
//       data: {
//         checker: {
//           id: checker.id,
//           name: checker.name,
//           email: checker.email,
//           role: checker.role,
//           subject: checker.subject,
//         },
//         sheets: sheets,
//         stats: {
//           totalSheets: totalSheets,
//           averageTime: parseFloat(avgTime.toFixed(2)),
//           totalMarksGiven: sheets.reduce((sum, s) => sum + s.marks, 0),
//         },
//       },
//     });
//   } catch (error) {
//     console.error('❌ getCheckerDetail error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get checker detail',
//       error: error.message,
//     });
//   }
// };

// // ─── GET RECHECKER PERFORMANCE ─────────────────────────────────

// export const getRecheckerPerformance = async (req, res) => {
//   try {
//     const { examId } = req.params;

//     let query = `
//       SELECT 
//         u.id AS rechecker_id,
//         u.name AS rechecker_name,
//         COUNT(rr.id) AS total_rechecks,
//         COUNT(rr.id) FILTER (WHERE rr.status = 'completed') AS completed_rechecks,
//         COUNT(rr.id) FILTER (WHERE rr.status = 'pending') AS pending_rechecks,
//         COUNT(rr.id) FILTER (WHERE rr.status = 'escalated') AS escalated_rechecks,
//         COALESCE(AVG(EXTRACT(EPOCH FROM (rr.resolved_at - rr.created_at)) / 60), 0) AS avg_time_minutes
//       FROM recheck_requests rr
//       JOIN users u ON rr.assign_to = u.id
//       WHERE u.role = 'rechecking'
//         AND u.is_active = true
//     `;

//     const params = [];
//     if (examId) {
//       query += ` AND rr.exam_id = $1`;
//       params.push(examId);
//     }

//     query += `
//       GROUP BY u.id, u.name
//       ORDER BY completed_rechecks DESC
//     `;

//     const result = await pool.query(query, params);

//     return res.status(200).json({
//       success: true,
//       message: 'Rechecker performance data retrieved successfully',
//       data: result.rows,
//     });
//   } catch (error) {
//     console.error('❌ getRecheckerPerformance error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get rechecker performance data',
//       error: error.message,
//     });
//   }
// };



// src/controllers/checkerPerformanceController.js

import pool from '../../pool.js';

// ─── GET CHECKER PERFORMANCE ───────────────────────────────────

export const getCheckerPerformance = async (req, res) => {
  try {
    const { examId } = req.params;
    // ✅ also accept examId from query (for /performance route)
    const effectiveExamId = examId || req.query.examId || null;

    let examName = 'All Exams';
    if (effectiveExamId) {
      const examResult = await pool.query(
        `SELECT id, name FROM exams WHERE id = $1`,
        [effectiveExamId],
      );
      if (examResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: 'Exam not found' });
      }
      examName = examResult.rows[0].name;
    }

    const params = [];
    let examFilter = '';
    if (effectiveExamId) {
      params.push(effectiveExamId);
      examFilter = `AND s.exam_id = $${params.length}`;
    }

    // ✅ FIX: status IN ('assigned','completed') — 'assigned' only misses already-done sheets
    // ✅ FIX: NULLIF prevents division-by-zero in avg_time; COALESCE handles NULL assigned_at
    const query = `
      SELECT
        u.id                                                            AS checker_id,
        u.name                                                          AS checker_name,
        u.role,
        COUNT(DISTINCT a.sheet_id)                                      AS sheets_assigned,
        COUNT(DISTINCT a.sheet_id)
          FILTER (WHERE s.status IN ('checked','rechecked'))            AS sheets_completed,
        COUNT(DISTINCT a.sheet_id)
          FILTER (WHERE s.status = 'recheck')                          AS recheck_count,
        COUNT(DISTINCT a.sheet_id)
          FILTER (WHERE s.status = 'escalated')                        AS escalated_count,
        COUNT(DISTINCT a.sheet_id)
          FILTER (WHERE s.status NOT IN ('checked','rechecked','recheck','escalated')) AS pending_count,
        COALESCE(
          AVG(
            CASE
              WHEN a.assigned_at IS NOT NULL
                AND s.updated_at > a.assigned_at
              THEN EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60.0
            END
          ), 0
        )                                                               AS avg_time_minutes,
        COALESCE(AVG(s.marks), 0)                                       AS avg_marks_given
      FROM assignments a
      JOIN users u ON a.checker_id = u.id
      JOIN sheets s ON a.sheet_id = s.id
      WHERE u.role IN ('checker', 'teacher_checker', 'rechecking')
        AND u.is_active = true
        AND a.status IN ('assigned', 'completed')
        ${examFilter}
      GROUP BY u.id, u.name, u.role
      ORDER BY sheets_completed DESC, avg_time_minutes ASC
    `;

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No checker performance data found',
        data: {
          exam: { id: effectiveExamId || null, name: examName },
          checkers: [],
          stats: { totalCheckers: 0, totalSheetsCompleted: 0, averageTime: 0, mostEfficient: null },
        },
      });
    }

    const checkers = result.rows.map((row) => {
      const sheetsCompleted = parseInt(row.sheets_completed) || 0;
      const avgTime = parseFloat(row.avg_time_minutes) || 0;
      // ✅ Efficiency score: more sheets + less time = higher score
      const efficiencyScore = avgTime > 0 ? (sheetsCompleted / avgTime) * 10 : 0;

      return {
        checkerId: row.checker_id,
        checkerName: row.checker_name,
        role: row.role,
        sheetsAssigned: parseInt(row.sheets_assigned) || 0,
        sheetsCompleted,
        recheckCount: parseInt(row.recheck_count) || 0,
        escalatedCount: parseInt(row.escalated_count) || 0,
        pendingCount: parseInt(row.pending_count) || 0,
        avgTimeMinutes: parseFloat(avgTime.toFixed(2)),
        avgMarksGiven: parseFloat(parseFloat(row.avg_marks_given).toFixed(2)),
        efficiencyScore: parseFloat(efficiencyScore.toFixed(2)),
        // ✅ Completion rate
        completionRate: parseInt(row.sheets_assigned) > 0
          ? parseFloat(((sheetsCompleted / parseInt(row.sheets_assigned)) * 100).toFixed(1))
          : 0,
      };
    });

    // ── Overall stats ───────────────────────────────────────────
    const totalSheetsCompleted = checkers.reduce((s, c) => s + c.sheetsCompleted, 0);
    const totalWeightedTime = checkers.reduce((s, c) => s + c.avgTimeMinutes * c.sheetsCompleted, 0);
    const averageTime = totalSheetsCompleted > 0
      ? parseFloat((totalWeightedTime / totalSheetsCompleted).toFixed(2))
      : 0;

    // ✅ Most efficient by efficiency score
    const mostEfficient = checkers.length > 0
      ? checkers.reduce((a, b) => a.efficiencyScore > b.efficiencyScore ? a : b)
      : null;

    return res.status(200).json({
      success: true,
      message: 'Checker performance data retrieved successfully',
      data: {
        exam: { id: effectiveExamId || null, name: examName },
        checkers,
        stats: {
          totalCheckers: checkers.length,
          totalSheetsCompleted,
          totalSheetsAssigned: checkers.reduce((s, c) => s + c.sheetsAssigned, 0),
          totalRecheckCount: checkers.reduce((s, c) => s + c.recheckCount, 0),
          totalEscalatedCount: checkers.reduce((s, c) => s + c.escalatedCount, 0),
          averageTime,
          mostEfficient: mostEfficient ? {
            name: mostEfficient.checkerName,
            sheetsCompleted: mostEfficient.sheetsCompleted,
            avgTimeMinutes: mostEfficient.avgTimeMinutes,
            efficiencyScore: mostEfficient.efficiencyScore,
          } : null,
        },
      },
    });
  } catch (error) {
    console.error('getCheckerPerformance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker performance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─── GET CHECKER DETAIL ────────────────────────────────────────

export const getCheckerDetail = async (req, res) => {
  try {
    const { checkerId } = req.params;
    const { examId } = req.query;

    // ✅ Checker info first — fail fast if not found
    const checkerResult = await pool.query(
      `SELECT id, name, email, role, subject, is_active FROM users WHERE id = $1`,
      [checkerId],
    );
    if (checkerResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Checker not found' });
    }

    const params = [checkerId];
    let examFilter = '';
    if (examId) {
      params.push(examId);
      examFilter = `AND s.exam_id = $${params.length}`;
    }

    const sheetsQuery = `
      SELECT
        s.id          AS sheet_id,
        s.roll_no,
        s.student_name,
        s.marks,
        s.status,
        s.barcode,
        s.created_at,
        s.updated_at,
        e.name        AS exam_name,
        e.subject     AS exam_subject,
        a.assigned_at,
        CASE
          WHEN a.assigned_at IS NOT NULL AND s.updated_at > a.assigned_at
          THEN EXTRACT(EPOCH FROM (s.updated_at - a.assigned_at)) / 60.0
          ELSE 0
        END           AS time_taken_minutes
      FROM assignments a
      JOIN sheets s ON a.sheet_id = s.id
      JOIN exams e ON s.exam_id = e.id
      WHERE a.checker_id = $1
        AND a.status IN ('assigned', 'completed')
        ${examFilter}
      ORDER BY s.updated_at DESC
    `;

    const result = await pool.query(sheetsQuery, params);
    const checker = checkerResult.rows[0];

    const sheets = result.rows.map((row) => ({
      sheetId: row.sheet_id,
      rollNo: row.roll_no || 'N/A',
      studentName: row.student_name || 'Unknown',
      barcode: row.barcode || '',
      marks: parseFloat(row.marks) || 0,
      status: row.status,
      examName: row.exam_name,
      examSubject: row.exam_subject,
      assignedAt: row.assigned_at,
      completedAt: row.updated_at,
      timeTakenMinutes: parseFloat(parseFloat(row.time_taken_minutes).toFixed(2)),
    }));

    const completed = sheets.filter((s) => ['checked', 'rechecked'].includes(s.status));
    const pending = sheets.filter((s) => !['checked', 'rechecked', 'escalated'].includes(s.status));
    const escalated = sheets.filter((s) => s.status === 'escalated');
    const recheck = sheets.filter((s) => s.status === 'recheck');

    const avgTime = completed.length > 0
      ? parseFloat((completed.reduce((s, c) => s + c.timeTakenMinutes, 0) / completed.length).toFixed(2))
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
          isActive: checker.is_active,
        },
        sheets,
        stats: {
          totalAssigned: sheets.length,
          totalCompleted: completed.length,
          totalPending: pending.length,
          totalEscalated: escalated.length,
          totalRecheck: recheck.length,
          completionRate: sheets.length > 0
            ? parseFloat(((completed.length / sheets.length) * 100).toFixed(1))
            : 0,
          averageTime,
          totalMarksGiven: parseFloat(completed.reduce((s, c) => s + c.marks, 0).toFixed(2)),
          avgMarksGiven: completed.length > 0
            ? parseFloat((completed.reduce((s, c) => s + c.marks, 0) / completed.length).toFixed(2))
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('getCheckerDetail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checker detail',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─── GET RECHECKER PERFORMANCE ─────────────────────────────────

export const getRecheckerPerformance = async (req, res) => {
  try {
    // ✅ FIX: was req.params.examId — but route has no :examId param
    const { examId } = req.query;

    const params = [];
    let examFilter = '';
    if (examId) {
      params.push(examId);
      examFilter = `AND rr.exam_id = $${params.length}`;
    }

    const query = `
      SELECT
        u.id                                                              AS rechecker_id,
        u.name                                                            AS rechecker_name,
        u.email,
        u.subject,
        COUNT(rr.id)                                                      AS total_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status = 'completed')              AS completed_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status IN ('pending','assigned'))  AS pending_rechecks,
        COUNT(rr.id) FILTER (WHERE rr.status = 'escalated')             AS escalated_rechecks,
        COALESCE(
          AVG(
            CASE
              WHEN rr.resolved_at IS NOT NULL AND rr.created_at IS NOT NULL
                AND rr.resolved_at > rr.created_at
              THEN EXTRACT(EPOCH FROM (rr.resolved_at - rr.created_at)) / 60.0
            END
          ), 0
        )                                                                 AS avg_time_minutes,
        CASE
          WHEN COUNT(rr.id) > 0
          THEN ROUND(
            COUNT(rr.id) FILTER (WHERE rr.status = 'completed')::numeric
            / COUNT(rr.id) * 100, 1
          )
          ELSE 0
        END                                                               AS completion_rate
      FROM recheck_requests rr
      JOIN users u ON rr.assign_to = u.id
      WHERE u.role = 'rechecking'
        AND u.is_active = true
        ${examFilter}
      GROUP BY u.id, u.name, u.email, u.subject
      ORDER BY completed_rechecks DESC, avg_time_minutes ASC
    `;

    const result = await pool.query(query, params);

    const recheckers = result.rows.map((row) => ({
      recheckerId: row.rechecker_id,
      recheckerName: row.rechecker_name,
      email: row.email,
      subject: row.subject,
      totalRechecks: parseInt(row.total_rechecks) || 0,
      completedRechecks: parseInt(row.completed_rechecks) || 0,
      pendingRechecks: parseInt(row.pending_rechecks) || 0,
      escalatedRechecks: parseInt(row.escalated_rechecks) || 0,
      avgTimeMinutes: parseFloat(parseFloat(row.avg_time_minutes).toFixed(2)),
      completionRate: parseFloat(row.completion_rate) || 0,
    }));

    return res.status(200).json({
      success: true,
      message: 'Rechecker performance data retrieved successfully',
      data: {
        recheckers,
        stats: {
          totalRecheckers: recheckers.length,
          totalRechecks: recheckers.reduce((s, r) => s + r.totalRechecks, 0),
          totalCompleted: recheckers.reduce((s, r) => s + r.completedRechecks, 0),
          totalPending: recheckers.reduce((s, r) => s + r.pendingRechecks, 0),
          totalEscalated: recheckers.reduce((s, r) => s + r.escalatedRechecks, 0),
          overallCompletionRate: recheckers.length > 0
            ? parseFloat((
              recheckers.reduce((s, r) => s + r.completedRechecks, 0) /
              Math.max(recheckers.reduce((s, r) => s + r.totalRechecks, 0), 1) * 100
            ).toFixed(1))
            : 0,
        },
      },
    });
  } catch (error) {
    console.error('getRecheckerPerformance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get rechecker performance data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};