// src/mark-scheme/mark-scheme-controller.js

import pool from '../pool.js';
import fs from 'fs';
import path from 'path';

// ─── GET MARK SCHEME BY EXAM ───────────────────────────────────

export const getMarkSchemeByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { rows } = await pool.query(
      `SELECT 
        id, "examId", "questionName", "maxMarks", guidelines,
        model_answer_pdf, question_paper_pdf,
        created_at, updated_at
       FROM mark_schemes 
       WHERE "examId" = $1 
       ORDER BY "questionName" ASC`,
      [examId],
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getMarkSchemeByExam error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch mark scheme' });
  }
};

// ─── SAVE MARK SCHEME (WITH LOCAL PDF UPLOAD) ──────────────────

export const saveMarkScheme = async (req, res) => {
  const { examId } = req.params;

  // ✅ Parse schemes from body
  let schemes = req.body.schemes;
  if (typeof schemes === 'string') {
    try {
      schemes = JSON.parse(schemes);
    } catch (e) {
      return res.status(400).json({
        success: false,
        message: 'Invalid schemes format',
      });
    }
  }

  // ✅ Handle local file uploads
  let modelAnswerPdf = null;
  let questionPaperPdf = null;

  try {
    // Get model answer PDF path
    if (req.files && req.files.model_answer_pdf) {
      const file = req.files.model_answer_pdf[0];
      modelAnswerPdf = `/uploads/mark-scheme/model-answers/${file.filename}`;
    }

    // Get question paper PDF path
    if (req.files && req.files.question_paper_pdf) {
      const file = req.files.question_paper_pdf[0];
      questionPaperPdf = `/uploads/mark-scheme/question-papers/${file.filename}`;
    }
  } catch (error) {
    console.error('Local file upload error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload PDF files',
      error: error.message,
    });
  }

  if (!Array.isArray(schemes)) {
    return res
      .status(400)
      .json({ success: false, message: '"schemes" must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing PDFs to retain if new ones are not provided
    const { rows: existingRows } = await client.query(
      'SELECT model_answer_pdf, question_paper_pdf FROM mark_schemes WHERE "examId" = $1 LIMIT 1',
      [examId]
    );
    const existingModelAnswer = existingRows.length > 0 ? existingRows[0].model_answer_pdf : null;
    const existingQuestionPaper = existingRows.length > 0 ? existingRows[0].question_paper_pdf : null;

    modelAnswerPdf = modelAnswerPdf || existingModelAnswer;
    questionPaperPdf = questionPaperPdf || existingQuestionPaper;

    // Delete existing mark schemes
    await client.query('DELETE FROM mark_schemes WHERE "examId" = $1', [
      examId,
    ]);

    // ✅ Calculate total marks
    let totalMarks = 0;

    // Insert new mark schemes with local PDF URLs
    for (const item of schemes) {
      const { questionName, maxMarks, guidelines } = item;
      if (!questionName) continue;

      const marks = parseInt(maxMarks) || 0;
      totalMarks += marks;

      await client.query(
        `INSERT INTO mark_schemes (
          "examId", "questionName", "maxMarks", guidelines,
          model_answer_pdf, question_paper_pdf
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          examId,
          questionName,
          marks,
          guidelines || '',
          modelAnswerPdf,
          questionPaperPdf,
        ],
      );
    }

    // ✅ Update exams table with total marks
    await client.query(`UPDATE exams SET "maxMarks" = $1 WHERE id = $2`, [
      totalMarks,
      examId,
    ]);

    await client.query('COMMIT');

    const { rows } = await client.query(
      `SELECT 
        id, "examId", "questionName", "maxMarks", guidelines,
        model_answer_pdf, question_paper_pdf,
        created_at, updated_at
       FROM mark_schemes 
       WHERE "examId" = $1 
       ORDER BY "questionName" ASC`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Mark scheme saved successfully',
      data: rows,
      totalMarks: totalMarks, // ✅ Send total marks in response
      files: {
        modelAnswerPdf,
        questionPaperPdf,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveMarkScheme error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to save mark scheme' });
  } finally {
    client.release();
  }
};

// ─── UPLOAD ONLY MODEL ANSWER PDF (LOCAL) ──────────────────────

export const uploadModelAnswer = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const pdfUrl = `/uploads/mark-scheme/model-answers/${req.file.filename}`;

    await pool.query(
      `UPDATE mark_schemes SET model_answer_pdf = $1 WHERE "examId" = $2`,
      [pdfUrl, examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Model answer uploaded successfully',
      data: { url: pdfUrl },
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

// ─── UPLOAD ONLY QUESTION PAPER PDF (LOCAL) ─────────────────────

export const uploadQuestionPaper = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const pdfUrl = `/uploads/mark-scheme/question-papers/${req.file.filename}`;

    await pool.query(
      `UPDATE mark_schemes SET question_paper_pdf = $1 WHERE "examId" = $2`,
      [pdfUrl, examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Question paper uploaded successfully',
      data: { url: pdfUrl },
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

// ─── DELETE PDF ──────────────────────────────────────────────────

export const deletePDF = async (req, res) => {
  try {
    const { examId, type } = req.params;

    const column =
      type === 'model_answer' ? 'model_answer_pdf' : 'question_paper_pdf';

    const result = await pool.query(
      `SELECT ${column} FROM mark_schemes WHERE "examId" = $1 LIMIT 1`,
      [examId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Mark scheme not found',
      });
    }

    const pdfUrl = result.rows[0][column];

    if (pdfUrl) {
      try {
        const filePath = path.join(process.cwd(), pdfUrl);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Deleted local file: ${filePath}`);
        }
      } catch (err) {
        console.error('Error deleting local file:', err);
      }
    }

    await pool.query(
      `UPDATE mark_schemes SET ${column} = NULL WHERE "examId" = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'PDF deleted successfully',
    });
  } catch (error) {
    console.error('deletePDF error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete PDF',
      error: error.message,
    });
  }
};

// ─── GET TOTAL MARKS FOR EXAM ──────────────────────────────────

export const getTotalMarks = async (req, res) => {
  try {
    const { examId } = req.params;

    const { rows } = await pool.query(
      `SELECT "maxMarks" FROM exams WHERE id = $1`,
      [examId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        totalMarks: rows[0].maxMarks || 0,
      },
    });
  } catch (error) {
    console.error('getTotalMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get total marks',
      error: error.message,
    });
  }
};
