// src/mark-scheme/mark-scheme-controller.js
import pool from '../pool.js';
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.util.js';
import fs from 'fs';

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

// ─── SAVE MARK SCHEME (WITH PDF UPLOAD) ────────────────────────

export const saveMarkScheme = async (req, res) => {
  const { examId } = req.params;
  const { schemes } = req.body;

  // ✅ Handle file uploads
  let modelAnswerPdf = null;
  let questionPaperPdf = null;

  try {
    // Upload model answer PDF to Cloudinary
    if (req.files && req.files.model_answer_pdf) {
      const file = req.files.model_answer_pdf[0];
      const result = await uploadImageToCloudinary(file.path);
      modelAnswerPdf = result.url;
      // Delete local file after upload
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    // Upload question paper PDF to Cloudinary
    if (req.files && req.files.question_paper_pdf) {
      const file = req.files.question_paper_pdf[0];
      const result = await uploadImageToCloudinary(file.path);
      questionPaperPdf = result.url;
      // Delete local file after upload
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }
  } catch (error) {
    console.error('Cloudinary upload error:', error);
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

    // ✅ Get existing PDF URLs before delete (to clean up)
    const existing = await client.query(
      `SELECT model_answer_pdf, question_paper_pdf FROM mark_schemes WHERE "examId" = $1 LIMIT 1`,
      [examId],
    );

    // Delete old PDFs from Cloudinary if new ones are uploaded
    if (modelAnswerPdf && existing.rows[0]?.model_answer_pdf) {
      try {
        const publicId = existing.rows[0].model_answer_pdf
          .split('/')
          .pop()
          .split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting old model answer:', err);
      }
    }

    if (questionPaperPdf && existing.rows[0]?.question_paper_pdf) {
      try {
        const publicId = existing.rows[0].question_paper_pdf
          .split('/')
          .pop()
          .split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting old question paper:', err);
      }
    }

    // Delete existing mark schemes
    await client.query('DELETE FROM mark_schemes WHERE "examId" = $1', [
      examId,
    ]);

    // Insert new mark schemes with PDF URLs
    for (const item of schemes) {
      const { questionName, maxMarks, guidelines } = item;
      if (!questionName) continue;

      await client.query(
        `INSERT INTO mark_schemes (
          "examId", "questionName", "maxMarks", guidelines,
          model_answer_pdf, question_paper_pdf
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          examId,
          questionName,
          maxMarks || 0,
          guidelines || '',
          modelAnswerPdf,
          questionPaperPdf,
        ],
      );
    }

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

// ─── UPLOAD ONLY MODEL ANSWER PDF ──────────────────────────────

export const uploadModelAnswer = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(req.file.path);
    const pdfUrl = result.url;

    // Update all mark schemes for this exam
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

// ─── UPLOAD ONLY QUESTION PAPER PDF ─────────────────────────────

export const uploadQuestionPaper = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    // Upload to Cloudinary
    const result = await uploadImageToCloudinary(req.file.path);
    const pdfUrl = result.url;

    // Update all mark schemes for this exam
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

    // type: 'model_answer' or 'question_paper'
    const column =
      type === 'model_answer' ? 'model_answer_pdf' : 'question_paper_pdf';

    // Get current PDF URL
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
      // Delete from Cloudinary
      try {
        const publicId = pdfUrl.split('/').pop().split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
      }
    }

    // Update database
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
