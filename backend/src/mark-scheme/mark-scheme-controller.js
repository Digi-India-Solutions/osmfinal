// src/mark-scheme/mark-scheme-controller.js

import pool from '../pool.js';
import fs from 'fs';
import path from 'path';

// ─── HELPER: Get Base URL ──────────────────────────────────────

const getBaseUrl = () => {
  return process.env.API_URL || 'http://localhost:7000';
};

// ─── HELPER: Convert relative path to full URL ────────────────

const toFullUrl = (relativePath) => {
  if (!relativePath) return null;
  // If already a full URL, return as is
  if (
    relativePath.startsWith('http://') ||
    relativePath.startsWith('https://')
  ) {
    return relativePath;
  }
  return `${getBaseUrl()}${relativePath}`;
};

// ─── HELPER: Convert array of rows to full URLs ───────────────

const convertRowsToFullUrls = (rows) => {
  return rows.map((row) => ({
    ...row,
    model_answer_pdf: toFullUrl(row.model_answer_pdf),
    question_paper_pdf: toFullUrl(row.question_paper_pdf),
  }));
};

// ════════════════════════════════════════════════════════════════
// GET MARK SCHEME BY EXAM
// ════════════════════════════════════════════════════════════════

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

    // ✅ Convert relative paths to full URLs
    const data = convertRowsToFullUrls(rows);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('getMarkSchemeByExam error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch mark scheme' });
  }
};

// ════════════════════════════════════════════════════════════════
// SAVE MARK SCHEME (WITH LOCAL PDF UPLOAD)
// ════════════════════════════════════════════════════════════════

// src/mark-scheme/mark-scheme-controller.js

export const saveMarkScheme = async (req, res) => {
  const { examId } = req.params;

  // Parse schemes from body
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

  if (!Array.isArray(schemes)) {
    return res
      .status(400)
      .json({ success: false, message: '"schemes" must be an array' });
  }

  // Handle local file uploads
  let modelAnswerPdf = null;
  let questionPaperPdf = null;

  try {
    if (req.files && req.files.model_answer_pdf) {
      const file = req.files.model_answer_pdf[0];
      modelAnswerPdf = `/uploads/mark-scheme/model-answers/${file.filename}`;
    }

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

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing PDFs to retain if new ones are not provided
    const { rows: existingRows } = await client.query(
      'SELECT model_answer_pdf, question_paper_pdf FROM mark_schemes WHERE "examId" = $1 LIMIT 1',
      [examId],
    );

    const existingModelAnswer =
      existingRows.length > 0 ? existingRows[0].model_answer_pdf : null;
    const existingQuestionPaper =
      existingRows.length > 0 ? existingRows[0].question_paper_pdf : null;

    modelAnswerPdf = modelAnswerPdf || existingModelAnswer;
    questionPaperPdf = questionPaperPdf || existingQuestionPaper;

    // Delete existing mark schemes
    await client.query('DELETE FROM mark_schemes WHERE "examId" = $1', [
      examId,
    ]);

    // Calculate total marks and count unique questions
    let totalMarks = 0;
    const uniqueQuestions = new Set();

    // Insert new mark schemes with local PDF URLs
    for (const item of schemes) {
      const { questionName, maxMarks, guidelines } = item;
      if (!questionName) continue;

      const marks = parseInt(maxMarks) || 0;
      totalMarks += marks;

      // Extract question number from Qn1_i -> Qn1
      const questionNumber = questionName.split('_')[0];
      uniqueQuestions.add(questionNumber);

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

    // ✅ Update exams table with total marks AND total questions
    const totalQuestionsCount = uniqueQuestions.size;

    await client.query(
      `UPDATE exams 
       SET "maxMarks" = $1, "totalQuestions" = $2
       WHERE id = $3`,
      [totalMarks, totalQuestionsCount, examId],
    );

    await client.query('COMMIT');

    // Fetch the saved data
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

    // ✅ Convert to full URLs
    const data = convertRowsToFullUrls(rows);

    return res.status(200).json({
      success: true,
      message: 'Mark scheme saved successfully',
      data: data,
      totalMarks: totalMarks,
      totalQuestions: totalQuestionsCount, // ✅ Send back
      files: {
        modelAnswerPdf: toFullUrl(modelAnswerPdf),
        questionPaperPdf: toFullUrl(questionPaperPdf),
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

// ════════════════════════════════════════════════════════════════
// UPLOAD ONLY MODEL ANSWER PDF
// ════════════════════════════════════════════════════════════════

export const uploadModelAnswer = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const pdfPath = `/uploads/mark-scheme/model-answers/${req.file.filename}`;

    await pool.query(
      `UPDATE mark_schemes SET model_answer_pdf = $1 WHERE "examId" = $2`,
      [pdfPath, examId],
    );

    // ✅ Return full URL
    return res.status(200).json({
      success: true,
      message: 'Model answer uploaded successfully',
      data: {
        url: toFullUrl(pdfPath),
        path: pdfPath,
      },
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

// ════════════════════════════════════════════════════════════════
// UPLOAD ONLY QUESTION PAPER PDF
// ════════════════════════════════════════════════════════════════

export const uploadQuestionPaper = async (req, res) => {
  try {
    const { examId } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const pdfPath = `/uploads/mark-scheme/question-papers/${req.file.filename}`;

    await pool.query(
      `UPDATE mark_schemes SET question_paper_pdf = $1 WHERE "examId" = $2`,
      [pdfPath, examId],
    );

    // ✅ Return full URL
    return res.status(200).json({
      success: true,
      message: 'Question paper uploaded successfully',
      data: {
        url: toFullUrl(pdfPath),
        path: pdfPath,
      },
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

// ════════════════════════════════════════════════════════════════
// DELETE PDF
// ════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════
// GET TOTAL MARKS FOR EXAM
// ════════════════════════════════════════════════════════════════

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

// ════════════════════════════════════════════════════════════════
// DELETE ENTIRE MARK SCHEME
// ════════════════════════════════════════════════════════════════

export const deleteMarkScheme = async (req, res) => {
  const { examId } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get PDF paths before deleting
    const { rows: pdfRows } = await client.query(
      `SELECT model_answer_pdf, question_paper_pdf FROM mark_schemes WHERE "examId" = $1 LIMIT 1`,
      [examId],
    );

    // 2. Delete all mark scheme entries
    const deleteResult = await client.query(
      `DELETE FROM mark_schemes WHERE "examId" = $1 RETURNING id`,
      [examId],
    );

    if (deleteResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Mark scheme not found for this exam',
      });
    }

    // 3. Update exam total marks to 0
    await client.query(`UPDATE exams SET "maxMarks" = 0 WHERE id = $1`, [
      examId,
    ]);

    await client.query('COMMIT');

    // 4. Delete PDF files from disk (after commit)
    if (pdfRows.length > 0) {
      const pdfs = pdfRows[0];
      const filesToDelete = [
        pdfs.model_answer_pdf,
        pdfs.question_paper_pdf,
      ].filter(Boolean);

      for (const pdfUrl of filesToDelete) {
        try {
          const filePath = path.join(process.cwd(), pdfUrl);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`Deleted file: ${filePath}`);
          }
        } catch (err) {
          console.error('Error deleting file:', err);
        }
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Mark scheme deleted successfully',
      data: {
        deletedCount: deleteResult.rowCount,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteMarkScheme error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete mark scheme',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ════════════════════════════════════════════════════════════════
// DELETE SPECIFIC QUESTION
// ════════════════════════════════════════════════════════════════

export const deleteQuestion = async (req, res) => {
  const { examId, questionNum } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const questionName = `Qn${questionNum}`;

    // Check if question exists
    const checkResult = await client.query(
      `SELECT id, questionName FROM mark_schemes 
       WHERE "examId" = $1 AND "questionName" LIKE $2`,
      [examId, `${questionName}%`],
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Question ${questionNum} not found`,
      });
    }

    // Delete all entries for this question (including sub-parts)
    await client.query(
      `DELETE FROM mark_schemes 
       WHERE "examId" = $1 AND "questionName" LIKE $2`,
      [examId, `${questionName}%`],
    );

    // Update total marks and total questions
    const statsResult = await client.query(
      `SELECT 
        SUM("maxMarks") as total_marks,
        COUNT(DISTINCT SUBSTRING("questionName" FROM '^Qn[0-9]+')) as total_questions
       FROM mark_schemes 
       WHERE "examId" = $1`,
      [examId],
    );

    const totalMarks = parseInt(statsResult.rows[0]?.total_marks) || 0;
    const totalQuestions = parseInt(statsResult.rows[0]?.total_questions) || 0;

    await client.query(
      `UPDATE exams SET "maxMarks" = $1, "totalQuestions" = $2 WHERE id = $3`,
      [totalMarks, totalQuestions, examId],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Question ${questionNum} deleted successfully`,
      data: {
        totalMarks,
        totalQuestions,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteQuestion error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete question',
      error: error.message,
    });
  } finally {
    client.release();
  }
};


// ════════════════════════════════════════════════════════════════
// DELETE SPECIFIC SUB-PART
// ════════════════════════════════════════════════════════════════

export const deleteSubPart = async (req, res) => {
  const { examId, questionNum, subLabel } = req.params;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const questionName = `Qn${questionNum}_${subLabel}`;

    // Check if sub-part exists
    const checkResult = await client.query(
      `SELECT id FROM mark_schemes 
       WHERE "examId" = $1 AND "questionName" = $2`,
      [examId, questionName],
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: `Sub-part ${subLabel} of Question ${questionNum} not found`,
      });
    }

    // Delete the sub-part
    await client.query(
      `DELETE FROM mark_schemes 
       WHERE "examId" = $1 AND "questionName" = $2`,
      [examId, questionName],
    );

    // Update total marks and total questions
    const statsResult = await client.query(
      `SELECT 
        SUM("maxMarks") as total_marks,
        COUNT(DISTINCT SUBSTRING("questionName" FROM '^Qn[0-9]+')) as total_questions
       FROM mark_schemes 
       WHERE "examId" = $1`,
      [examId],
    );

    const totalMarks = parseInt(statsResult.rows[0]?.total_marks) || 0;
    const totalQuestions = parseInt(statsResult.rows[0]?.total_questions) || 0;

    await client.query(
      `UPDATE exams SET "maxMarks" = $1, "totalQuestions" = $2 WHERE id = $3`,
      [totalMarks, totalQuestions, examId],
    );

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Sub-part ${subLabel} of Question ${questionNum} deleted successfully`,
      data: {
        totalMarks,
        totalQuestions,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteSubPart error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete sub-part',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ════════════════════════════════════════════════════════════════
// EXPORT ALL FUNCTIONS
// ════════════════════════════════════════════════════════════════

export default {
  getMarkSchemeByExam,
  saveMarkScheme,
  uploadModelAnswer,
  uploadQuestionPaper,
  deletePDF,
  getTotalMarks,
  deleteMarkScheme,
  deleteQuestion,
  deleteSubPart,
};
