// src/controllers/resultController.js

import pool from '../pool.js';

// ─── GET EXAM RESULTS ──────────────────────────────────────────

export const getExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    console.log('🔍 Fetching results for exam:', examId);

    // Check if exam exists
    const examResult = await pool.query(
      `SELECT id, name, subject, "maxMarks", status, is_published FROM exams WHERE id = $1`,
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

    // Get all sheets with marks for this exam
    const sheetsResult = await pool.query(
      `SELECT 
        s.id AS sheet_id,
        s.student_id,
        s.roll_no,
        s.student_name,
        s.marks,
        s.status,
        cm.marks_data,
        cm.total_marks,
        cm.is_submitted,
        cm.submitted_at
      FROM sheets s
      LEFT JOIN checker_markings cm ON s.id = cm.sheet_id AND cm.is_submitted = true
      WHERE s.exam_id = $1 
        AND s.status IN ('checked', 'rechecked')
        AND s.marks IS NOT NULL
      ORDER BY s.roll_no ASC`,
      [examId],
    );

    console.log(`📊 Found ${sheetsResult.rows.length} sheets with results`);

    if (sheetsResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No results found for this exam',
        data: {
          exam: {
            id: exam.id,
            name: exam.name,
            subject: exam.subject,
            maxMarks: exam.maxMarks || 100,
            status: exam.status,
            is_published: exam.is_published || false,
          },
          results: [],
          stats: {
            total: 0,
            average: 0,
            highest: 0,
            lowest: 0,
            passCount: 0,
            failCount: 0,
            passPercentage: 0,
          },
        },
      });
    }

    // Parse marks data and build results
    const results = sheetsResult.rows.map((row) => {
      let questionTotals = {};
      let totalMarks = parseFloat(row.marks) || 0;

      // If marks_data exists, use it for question-wise breakdown
      if (
        row.marks_data &&
        typeof row.marks_data === 'object' &&
        Object.keys(row.marks_data).length > 0
      ) {
        questionTotals = row.marks_data;
        // Recalculate total from question marks
        const sum = Object.values(row.marks_data).reduce(
          (acc, val) => acc + (parseFloat(val) || 0),
          0,
        );
        totalMarks = sum || totalMarks;
      } else {
        // ✅ If no question-wise data, distribute marks across questions
        // For now, just show total marks in first column
        // You can modify this logic based on your needs
        const totalQuestions = 10; // Default number of questions
        const perQuestion = Math.round((totalMarks / totalQuestions) * 10) / 10;
        for (let i = 1; i <= totalQuestions; i++) {
          questionTotals[`Q${i}`] = perQuestion;
        }
      }

      return {
        sheetId: row.sheet_id,
        rollNo: row.roll_no || 'N/A',
        studentName: row.student_name || 'Unknown',
        totalMarks: totalMarks,
        maxMarks: exam.maxMarks || 100,
        questionTotals: questionTotals,
        status: row.status,
        submittedAt: row.submitted_at,
      };
    });

    // Calculate stats
    const total = results.length;
    const marksArray = results.map((r) => r.totalMarks);
    const maxMarks = exam.maxMarks || 100;
    const avg = total > 0 ? marksArray.reduce((a, b) => a + b, 0) / total : 0;
    const highest = total > 0 ? Math.max(...marksArray) : 0;
    const lowest = total > 0 ? Math.min(...marksArray) : 0;
    const passCount = results.filter(
      (r) => (r.totalMarks / maxMarks) * 100 >= 40,
    ).length;
    const failCount = total - passCount;

    console.log('📊 Stats calculated:', {
      total,
      avg,
      highest,
      lowest,
      passCount,
      failCount,
    });

    return res.status(200).json({
      success: true,
      message: 'Results retrieved successfully',
      data: {
        exam: {
          id: exam.id,
          name: exam.name,
          subject: exam.subject,
          maxMarks: exam.maxMarks,
          status: exam.status,
          is_published: exam.is_published || false,
        },
        results: results,
        stats: {
          total,
          average: parseFloat(avg.toFixed(2)),
          highest,
          lowest,
          passCount,
          failCount,
          passPercentage:
            total > 0 ? parseFloat(((passCount / total) * 100).toFixed(2)) : 0,
        },
      },
    });
  } catch (error) {
    console.error('❌ getExamResults error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get exam results',
      error: error.message,
    });
  }
};

// ─── GET PUBLISHED EXAMS ────────────────────────────────────────

export const getPublishedExams = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, subject, "maxMarks", is_published, updated_at 
       FROM exams 
       WHERE is_published = true 
       ORDER BY updated_at DESC`,
    );

    return res.status(200).json({
      success: true,
      message: 'Published exams retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getPublishedExams error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get published exams',
      error: error.message,
    });
  }
};

// ─── PUBLISH EXAM RESULTS ──────────────────────────────────────

export const publishExamResults = async (req, res) => {
  try {
    const { examId } = req.params;

    const examResult = await pool.query(
      `SELECT id, name, is_published FROM exams WHERE id = $1`,
      [examId],
    );

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const exam = examResult.rows[0];

    if (exam.is_published) {
      return res.status(400).json({
        success: false,
        message: 'Results already published for this exam',
      });
    }

    await pool.query(
      `UPDATE exams 
       SET is_published = true, 
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Results published successfully',
      data: {
        examId: examId,
        publishedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('publishExamResults error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to publish results',
      error: error.message,
    });
  }
};

// ─── GET EXAM SUMMARY ──────────────────────────────────────────

export const getExamSummary = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) AS total_students,
        COUNT(*) FILTER (WHERE status IN ('checked', 'rechecked')) AS completed,
        COUNT(*) FILTER (WHERE status = 'checking') AS checking,
        COUNT(*) FILTER (WHERE status IN ('uploaded', 'assigned', 'linked')) AS pending,
        COALESCE(AVG(marks), 0) AS average_marks,
        COALESCE(MAX(marks), 0) AS highest_marks,
        COALESCE(MIN(marks), 0) AS lowest_marks
      FROM sheets
      WHERE exam_id = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Exam summary retrieved successfully',
      data: result.rows[0] || {
        total_students: 0,
        completed: 0,
        checking: 0,
        pending: 0,
        average_marks: 0,
        highest_marks: 0,
        lowest_marks: 0,
      },
    });
  } catch (error) {
    console.error('getExamSummary error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get exam summary',
      error: error.message,
    });
  }
};

// ─── GET RECENT RESULTS ────────────────────────────────────────

export const getRecentResults = async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const result = await pool.query(
      `SELECT 
        e.id AS exam_id,
        e.name AS exam_name,
        e.subject,
        COUNT(s.id) AS total_students,
        COUNT(s.id) FILTER (WHERE s.status IN ('checked', 'rechecked')) AS completed,
        e.is_published,
        e.updated_at AS published_at,
        e.created_at
      FROM exams e
      LEFT JOIN sheets s ON e.id = s.exam_id
      WHERE e.status = 'active' OR e.status = 'completed'
      GROUP BY e.id
      ORDER BY e.created_at DESC
      LIMIT $1`,
      [parseInt(limit)],
    );

    return res.status(200).json({
      success: true,
      message: 'Recent results retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getRecentResults error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recent results',
      error: error.message,
    });
  }
};
