// src/teacherController/teacherController.js

import pool from '../pool.js';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const getBaseUrl = () =>
  process.env.API_URL || 'https://osmapi.digiindiasolutions.com';
const toFullUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  if (path.startsWith('/uploads')) return `${getBaseUrl()}${path}`;
  return `${getBaseUrl()}/${path}`;
};

// ─── DASHBOARD ──────────────────────────────────────────────

export const getTeacherDashboard = async (req, res) => {
  try {
    const userId = req.user.id;
    const subject = req.user.subject;

    // ✅ FIXED: Only columns that exist
    const examsResult = await pool.query(
      `SELECT id, name, subject, "totalQuestions" as total_questions, "maxMarks" as max_marks, date, status 
       FROM exams WHERE subject = $1 ORDER BY date DESC`,
      [subject],
    );

    const examIds = examsResult.rows.map((e) => e.id);

    // Get sheets count
    let totalSheets = 0,
      checking = 0,
      completed = 0,
      recheck = 0,
      pendingDisputes = 0;

    if (examIds.length > 0) {
      const sheetsResult = await pool.query(
        `SELECT status, COUNT(*) as count FROM sheets 
         WHERE exam_id = ANY($1::uuid[]) GROUP BY status`,
        [examIds],
      );
      sheetsResult.rows.forEach((row) => {
        totalSheets += parseInt(row.count);
        if (row.status === 'checking') checking += parseInt(row.count);
        if (row.status === 'checked' || row.status === 'rechecked')
          completed += parseInt(row.count);
        if (row.status === 'recheck') recheck += parseInt(row.count);
      });

      const disputesResult = await pool.query(
        `SELECT COUNT(*) as count FROM recheck_requests 
         WHERE exam_id = ANY($1::uuid[]) AND status = 'pending'`,
        [examIds],
      );
      pendingDisputes = parseInt(disputesResult.rows[0]?.count || 0);
    }

    return res.status(200).json({
      success: true,
      data: {
        exams: examsResult.rows,
        stats: {
          totalExams: examsResult.rows.length,
          totalSheets,
          checking,
          completed,
          recheck,
          pendingDisputes,
        },
      },
    });
  } catch (error) {
    console.error('getTeacherDashboard error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get dashboard',
      error: error.message,
    });
  }
};

// ─── EXAMS ──────────────────────────────────────────────────

export const getTeacherExams = async (req, res) => {
  try {
    const subject = req.user.subject;
    const { status } = req.query;

    // ✅ FIXED: Only columns that exist - removed created_by, created_at, updated_at
    let query = `SELECT id, name, subject, "totalQuestions" as total_questions, "maxMarks" as max_marks, date, status FROM exams WHERE subject = $1`;
    const params = [subject];
    if (status) {
      query += ` AND status = $2`;
      params.push(status);
    }
    query += ` ORDER BY date DESC`;

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getTeacherExams error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get exams',
      error: error.message,
    });
  }
};

export const createExam = async (req, res) => {
  try {
    const { name, total_questions, max_marks, date, status } = req.body;
    const userId = req.user.id;
    const subject = req.user.subject;

    if (!name || !date) {
      return res
        .status(400)
        .json({ success: false, message: 'Name and date are required' });
    }

    // ✅ FIXED: created_by may not exist, using createdBy or removing
    const result = await pool.query(
      `INSERT INTO exams (name, subject, "totalQuestions", "maxMarks", date, status)
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING id, name, subject, "totalQuestions" as total_questions, "maxMarks" as max_marks, date, status`,
      [
        name,
        subject,
        total_questions || 0,
        max_marks || 100,
        date,
        status || 'upcoming',
      ],
    );

    return res
      .status(201)
      .json({ success: true, message: 'Exam created', data: result.rows[0] });
  } catch (error) {
    console.error('createExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create exam',
      error: error.message,
    });
  }
};

export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, total_questions, max_marks, date, status } = req.body;
    const subject = req.user.subject;

    const check = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [id, subject],
    );
    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    // ✅ FIXED: Only columns that exist
    const result = await pool.query(
      `UPDATE exams SET name = COALESCE($1, name), 
       "totalQuestions" = COALESCE($2, "totalQuestions"),
       "maxMarks" = COALESCE($3, "maxMarks"), 
       date = COALESCE($4, date), 
       status = COALESCE($5, status)
       WHERE id = $6 
       RETURNING id, name, subject, "totalQuestions" as total_questions, "maxMarks" as max_marks, date, status`,
      [name, total_questions, max_marks, date, status, id],
    );

    return res
      .status(200)
      .json({ success: true, message: 'Exam updated', data: result.rows[0] });
  } catch (error) {
    console.error('updateExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update exam',
      error: error.message,
    });
  }
};

export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = req.user.subject;

    const check = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [id, subject],
    );
    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    await pool.query(`DELETE FROM exams WHERE id = $1`, [id]);
    return res.status(200).json({ success: true, message: 'Exam deleted' });
  } catch (error) {
    console.error('deleteExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete exam',
      error: error.message,
    });
  }
};

// ─── SHEETS ──────────────────────────────────────────────────

export const getTeacherSheets = async (req, res) => {
  try {
    const subject = req.user.subject;
    const { examId, status } = req.query;

    let query = `
      SELECT s.*, e.name as exam_name, a.checker_id, u.name as checker_name
      FROM sheets s
      JOIN exams e ON s.exam_id = e.id
      LEFT JOIN assignments a ON s.id = a.sheet_id
      LEFT JOIN users u ON a.checker_id = u.id
      WHERE e.subject = $1
    `;
    const params = [subject];
    let paramCount = 2;

    if (examId) {
      query += ` AND s.exam_id = $${paramCount}`;
      params.push(examId);
      paramCount++;
    }
    if (status) {
      query += ` AND s.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    query += ` ORDER BY s.roll_no`;

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getTeacherSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheets',
      error: error.message,
    });
  }
};

export const getSheetDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = req.user.subject;

    const result = await pool.query(
      `SELECT s.*, e.name as exam_name, a.checker_id, u.name as checker_name
       FROM sheets s
       JOIN exams e ON s.exam_id = e.id
       LEFT JOIN assignments a ON s.id = a.sheet_id
       LEFT JOIN users u ON a.checker_id = u.id
       WHERE s.id = $1 AND e.subject = $2`,
      [id, subject],
    );

    if (result.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Sheet not found' });
    }

    return res.status(200).json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getSheetDetails error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheet',
      error: error.message,
    });
  }
};

export const uploadSheet = async (req, res) => {
  try {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = 'uploads/sheets';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`);
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
    }).single('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      const { examId, rollNo, studentName, barcode } = req.body;
      const subject = req.user.subject;

      if (!examId || !rollNo || !studentName || !barcode) {
        return res
          .status(400)
          .json({ success: false, message: 'All fields are required' });
      }

      const examCheck = await pool.query(
        `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
        [examId, subject],
      );
      if (examCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Exam not found' });
      }

      const fileUrl = req.file ? `/uploads/sheets/${req.file.filename}` : null;

      const result = await pool.query(
        `INSERT INTO sheets (exam_id, roll_no, student_name, barcode, file_name, file_url, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploaded') RETURNING *`,
        [
          examId,
          rollNo,
          studentName,
          barcode,
          req.file?.originalname || null,
          fileUrl,
        ],
      );

      return res.status(201).json({
        success: true,
        message: 'Sheet uploaded',
        data: result.rows[0],
      });
    });
  } catch (error) {
    console.error('uploadSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload sheet',
      error: error.message,
    });
  }
};

export const deleteSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const subject = req.user.subject;

    const check = await pool.query(
      `SELECT s.id, s.file_url FROM sheets s JOIN exams e ON s.exam_id = e.id WHERE s.id = $1 AND e.subject = $2`,
      [id, subject],
    );
    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Sheet not found' });
    }

    const fileUrl = check.rows[0].file_url;
    if (fileUrl) {
      const filePath = path.join('uploads', 'sheets', path.basename(fileUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(`DELETE FROM sheets WHERE id = $1`, [id]);
    return res.status(200).json({ success: true, message: 'Sheet deleted' });
  } catch (error) {
    console.error('deleteSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete sheet',
      error: error.message,
    });
  }
};

// ─── MARK SCHEME ────────────────────────────────────────────

export const getMarkScheme = async (req, res) => {
  try {
    const { examId } = req.params;
    const subject = req.user.subject;

    const examCheck = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [examId, subject],
    );
    if (examCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    const result = await pool.query(
      `SELECT * FROM mark_schemes WHERE exam_id = $1 ORDER BY question_name`,
      [examId],
    );

    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getMarkScheme error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get mark scheme',
      error: error.message,
    });
  }
};

export const saveMarkScheme = async (req, res) => {
  try {
    const { examId } = req.params;
    const { scheme } = req.body;
    const subject = req.user.subject;

    const examCheck = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [examId, subject],
    );
    if (examCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM mark_schemes WHERE exam_id = $1`, [
        examId,
      ]);

      for (const item of scheme) {
        await client.query(
          `INSERT INTO mark_schemes (exam_id, question_name, max_marks, guidelines)
           VALUES ($1, $2, $3, $4)`,
          [examId, item.questionName, item.maxMarks, item.guidelines || ''],
        );
      }

      const totalQuestions = scheme.length;
      const maxMarks = scheme.reduce((sum, item) => sum + item.maxMarks, 0);

      await client.query(
        `UPDATE exams SET "totalQuestions" = $1, "maxMarks" = $2 WHERE id = $3`,
        [totalQuestions, maxMarks, examId],
      );

      await client.query('COMMIT');
      return res
        .status(200)
        .json({ success: true, message: 'Mark scheme saved' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('saveMarkScheme error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save mark scheme',
      error: error.message,
    });
  }
};

// ─── PDF UPLOADS ────────────────────────────────────────────

export const uploadModelAnswer = async (req, res) => {
  try {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = 'uploads/pdfs';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`);
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/pdf' ||
          file.originalname.endsWith('.pdf')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'));
        }
      },
    }).single('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      const { examId } = req.params;
      const subject = req.user.subject;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' });
      }

      const examCheck = await pool.query(
        `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
        [examId, subject],
      );
      if (examCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Exam not found' });
      }

      const fileUrl = `/uploads/pdfs/${req.file.filename}`;

      await pool.query(
        `UPDATE mark_schemes SET model_answer_pdf = $1 WHERE exam_id = $2`,
        [fileUrl, examId],
      );

      return res.status(200).json({
        success: true,
        message: 'Model answer uploaded',
        data: { url: toFullUrl(fileUrl) },
      });
    });
  } catch (error) {
    console.error('uploadModelAnswer error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload model answer',
      error: error.message,
    });
  }
};

export const uploadQuestionPaper = async (req, res) => {
  try {
    const storage = multer.diskStorage({
      destination: (req, file, cb) => {
        const dir = 'uploads/pdfs';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
      },
      filename: (req, file, cb) => {
        cb(null, `${uuidv4()}-${Date.now()}${path.extname(file.originalname)}`);
      },
    });

    const upload = multer({
      storage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/pdf' ||
          file.originalname.endsWith('.pdf')
        ) {
          cb(null, true);
        } else {
          cb(new Error('Only PDF files are allowed'));
        }
      },
    }).single('file');

    upload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ success: false, message: err.message });
      }

      const { examId } = req.params;
      const subject = req.user.subject;

      if (!req.file) {
        return res
          .status(400)
          .json({ success: false, message: 'No file uploaded' });
      }

      const examCheck = await pool.query(
        `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
        [examId, subject],
      );
      if (examCheck.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: 'Exam not found' });
      }

      const fileUrl = `/uploads/pdfs/${req.file.filename}`;

      await pool.query(
        `UPDATE mark_schemes SET question_paper_pdf = $1 WHERE exam_id = $2`,
        [fileUrl, examId],
      );

      return res.status(200).json({
        success: true,
        message: 'Question paper uploaded',
        data: { url: toFullUrl(fileUrl) },
      });
    });
  } catch (error) {
    console.error('uploadQuestionPaper error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload question paper',
      error: error.message,
    });
  }
};

export const deletePDF = async (req, res) => {
  try {
    const { examId, type } = req.params;
    const subject = req.user.subject;

    const examCheck = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [examId, subject],
    );
    if (examCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    const column =
      type === 'model_answer' ? 'model_answer_pdf' : 'question_paper_pdf';
    const result = await pool.query(
      `SELECT ${column} FROM mark_schemes WHERE exam_id = $1`,
      [examId],
    );

    if (result.rows.length > 0 && result.rows[0][column]) {
      const filePath = path.join(
        'uploads',
        'pdfs',
        path.basename(result.rows[0][column]),
      );
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await pool.query(
      `UPDATE mark_schemes SET ${column} = NULL WHERE exam_id = $1`,
      [examId],
    );

    return res.status(200).json({ success: true, message: 'PDF deleted' });
  } catch (error) {
    console.error('deletePDF error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete PDF',
      error: error.message,
    });
  }
};

// ─── PROGRESS ───────────────────────────────────────────────

export const getCheckingProgress = async (req, res) => {
  try {
    const { examId } = req.params;
    // ✅ REMOVE subject filter - only check examId
    // const subject = req.user.subject;

    console.log('📋 getCheckingProgress - examId:', examId);

    // ✅ FIX: Remove subject filter
    const examResult = await pool.query(
      `SELECT id, name, "totalQuestions" as total_questions, "maxMarks" as max_marks 
       FROM exams 
       WHERE id = $1`,
      [examId],
    );

    console.log('📋 Exam result:', examResult.rows);

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const exam = examResult.rows[0];

    const sheetsResult = await pool.query(
      `SELECT s.*, a.checker_id, u.name as checker_name
       FROM sheets s
       LEFT JOIN assignments a ON s.id = a.sheet_id
       LEFT JOIN users u ON a.checker_id = u.id
       WHERE s.exam_id = $1 ORDER BY s.roll_no`,
      [examId],
    );

    const sheets = await Promise.all(
      sheetsResult.rows.map(async (sheet) => {
        const dispute = await pool.query(
          `SELECT id, status FROM recheck_requests WHERE sheet_id = $1 AND status = 'pending' LIMIT 1`,
          [sheet.id],
        );
        return { ...sheet, isDisputed: dispute.rows.length > 0 };
      }),
    );

    const total = sheets.length;
    const checking = sheets.filter((s) => s.status === 'checking').length;
    const checked = sheets.filter(
      (s) => s.status === 'checked' || s.status === 'rechecked',
    ).length;
    const recheck = sheets.filter((s) => s.status === 'recheck').length;
    const done = checked + recheck;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        exam,
        sheets,
        stats: { total, checking, checked, recheck, done, progress },
      },
    });
  } catch (error) {
    console.error('getCheckingProgress error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get progress',
      error: error.message,
    });
  }
};

// ─── RESULTS ─────────────────────────────────────────────────

// src/teacherController/teacherController.js

export const getResults = async (req, res) => {
  try {
    const { examId } = req.params;

    console.log('📋 getResults - examId:', examId);

    // ✅ FIX: Remove status filter - check only examId
    const examResult = await pool.query(
      `SELECT id, name, "totalQuestions" as total_questions, "maxMarks" as max_marks 
       FROM exams 
       WHERE id = $1`, // ✅ Removed "AND status = 'completed'"
      [examId],
    );

    console.log('📋 Exam result:', examResult.rows);

    if (examResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const exam = examResult.rows[0];

    const sheetsResult = await pool.query(
      `SELECT s.* FROM sheets s
       WHERE s.exam_id = $1 AND s.status IN ('checked', 'rechecked') AND s.marks IS NOT NULL
       ORDER BY s.roll_no`,
      [examId],
    );

    const sheets = sheetsResult.rows;
    const totalStudents = sheets.length;
    let sum = 0,
      highest = 0,
      lowest = Infinity,
      passCount = 0,
      failCount = 0;

    sheets.forEach((sheet) => {
      const marks = parseFloat(sheet.marks) || 0;
      sum += marks;
      if (marks > highest) highest = marks;
      if (marks < lowest) lowest = marks;
      const percentage = (marks / exam.max_marks) * 100;
      if (percentage >= 40) passCount++;
      else failCount++;
    });

    const avg = totalStudents > 0 ? sum / totalStudents : 0;
    const avgPct =
      exam.max_marks > 0 ? ((avg / exam.max_marks) * 100).toFixed(1) : '0.0';
    if (totalStudents === 0) lowest = 0;

    return res.status(200).json({
      success: true,
      data: {
        exam,
        sheets,
        stats: {
          totalStudents,
          average: avgPct,
          highest,
          lowest,
          passCount,
          failCount,
        },
      },
    });
  } catch (error) {
    console.error('getResults error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get results',
      error: error.message,
    });
  }
};

// ─── DISPUTES / RECHECK ─────────────────────────────────────

export const requestRecheck = async (req, res) => {
  try {
    const { sheetId, examId, reason } = req.body;
    const userId = req.user.id;
    const subject = req.user.subject;

    if (!sheetId || !examId || !reason || reason.length < 10) {
      return res.status(400).json({
        success: false,
        message: 'sheetId, examId, and reason (min 10 chars) required',
      });
    }

    const examCheck = await pool.query(
      `SELECT id FROM exams WHERE id = $1 AND subject = $2`,
      [examId, subject],
    );
    if (examCheck.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    const existing = await pool.query(
      `SELECT id FROM recheck_requests WHERE sheet_id = $1 AND status = 'pending'`,
      [sheetId],
    );
    if (existing.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Dispute already exists' });
    }

    const admin = await pool.query(
      `SELECT id FROM users WHERE role = 'admin' LIMIT 1`,
    );
    const adminId = admin.rows[0]?.id || null;

    const result = await pool.query(
      `INSERT INTO recheck_requests (sheet_id, exam_id, reason, requested_by, assign_to, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [sheetId, examId, reason, userId, adminId],
    );

    return res.status(201).json({
      success: true,
      message: 'Recheck requested',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('requestRecheck error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to request recheck',
      error: error.message,
    });
  }
};

export const getRecheckRequests = async (req, res) => {
  try {
    const subject = req.user.subject;
    const { status } = req.query;

    let query = `
      SELECT rr.*, s.student_name, s.roll_no, e.name as exam_name,
             u.name as requested_by_name, u2.name as resolved_by_name
      FROM recheck_requests rr
      JOIN sheets s ON rr.sheet_id = s.id
      JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      WHERE e.subject = $1
    `;
    const params = [subject];
    let paramCount = 2;

    if (status) {
      query += ` AND rr.status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }
    query += ` ORDER BY rr.created_at DESC`;

    const result = await pool.query(query, params);
    return res.status(200).json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getRecheckRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck requests',
      error: error.message,
    });
  }
};

export const updateRecheckStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user.id;
    const subject = req.user.subject;

    const validStatuses = ['pending', 'assigned', 'completed', 'rejected'];
    if (!status || !validStatuses.includes(status)) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid status' });
    }

    const check = await pool.query(
      `SELECT rr.id FROM recheck_requests rr JOIN exams e ON rr.exam_id = e.id WHERE rr.id = $1 AND e.subject = $2`,
      [id, subject],
    );
    if (check.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Request not found' });
    }

    const result = await pool.query(
      `UPDATE recheck_requests SET status = $1, remarks = COALESCE($2, remarks),
       resolved_by = $3, resolved_at = NOW() WHERE id = $4 RETURNING *`,
      [status, remarks, userId, id],
    );

    return res.status(200).json({
      success: true,
      message: `Recheck ${status}`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('updateRecheckStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update status',
      error: error.message,
    });
  }
};

// ─── STATISTICS ─────────────────────────────────────────────

export const getTeacherStats = async (req, res) => {
  try {
    const subject = req.user.subject;

    const examStats = await pool.query(
      `SELECT COUNT(*) as total_exams, COUNT(*) FILTER (WHERE status = 'upcoming') as upcoming,
       COUNT(*) FILTER (WHERE status = 'active') as active,
       COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM exams WHERE subject = $1`,
      [subject],
    );

    const sheetStats = await pool.query(
      `SELECT COUNT(*) as total_sheets, COUNT(*) FILTER (WHERE status = 'checking') as checking,
       COUNT(*) FILTER (WHERE status = 'checked') as checked,
       COUNT(*) FILTER (WHERE status = 'recheck') as recheck,
       COUNT(*) FILTER (WHERE status = 'rechecked') as rechecked
       FROM sheets s JOIN exams e ON s.exam_id = e.id WHERE e.subject = $1`,
      [subject],
    );

    const disputeStats = await pool.query(
      `SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE status = 'pending') as pending,
       COUNT(*) FILTER (WHERE status = 'completed') as completed
       FROM recheck_requests rr JOIN exams e ON rr.exam_id = e.id WHERE e.subject = $1`,
      [subject],
    );

    return res.status(200).json({
      success: true,
      data: {
        exams: examStats.rows[0] || {
          total_exams: 0,
          upcoming: 0,
          active: 0,
          completed: 0,
        },
        sheets: sheetStats.rows[0] || {
          total_sheets: 0,
          checking: 0,
          checked: 0,
          recheck: 0,
          rechecked: 0,
        },
        disputes: disputeStats.rows[0] || {
          total: 0,
          pending: 0,
          completed: 0,
        },
      },
    });
  } catch (error) {
    console.error('getTeacherStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get stats',
      error: error.message,
    });
  }
};
