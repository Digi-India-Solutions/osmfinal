// src/controllers/exam-management-controller.js

import pool from '../pool.js';

// ─── CREATE EXAM ──────────────────────────────────────────────

export const createExam = async (req, res) => {
  try {
    const {
      name,
      subject,
      date,
      totalQuestions,
      maxMarks,
      spentTime,
      status,
      createdBy,
    } = req.body;
console.log('DATA===>',req.body)
    if (!name || !subject || !date || !createdBy) {
      return res.status(400).json({
        success: false,
        message: 'name, subject, date and createdBy are required',
      });
    }

    const query = `
      INSERT INTO exams (name, subject, date, "totalQuestions", "maxMarks", "spentTime", status, "createdBy")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *;
    `;
    const values = [
      name,
      subject,
      date,
      totalQuestions || 0,
      maxMarks || 0,
      spentTime || 0,
      status || 'active',
      createdBy,
    ];

    const { rows } = await pool.query(query, values);

    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('createExam error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to create exam' });
  }
};

// ─── GET ALL EXAMS ─────────────────────────────────────────────

export const getAllExams = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const excludeArchived = req.query.excludeArchived === 'true';
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    let dataQuery = `
      SELECT 
        e.*,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id), 0) AS sheet_count,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id AND status = 'checked'), 0) AS checked_count,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id AND status = 'checking'), 0) AS checking_count
      FROM exams e
      WHERE e.name ILIKE $1 OR e.subject ILIKE $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM exams e
      WHERE e.name ILIKE $1 OR e.subject ILIKE $1
    `;

    const queryParams = [searchTerm];

    if (excludeArchived) {
      dataQuery += ` AND LOWER(TRIM(e.status)) != 'archived'`;
      countQuery += ` AND LOWER(TRIM(e.status)) != 'archived'`;
    }

    dataQuery += ` ORDER BY e.created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    const { rows } = await pool.query(dataQuery, queryParams);
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    return res.status(200).json({
      success: true,
      data: rows,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    });
  } catch (error) {
    console.error('getAllExams error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch exams' });
  }
};

// ─── GET SINGLE EXAM ──────────────────────────────────────────

export const getSingleExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT 
        e.*,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id), 0) AS sheet_count,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id AND status = 'checked'), 0) AS checked_count,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id AND status = 'checking'), 0) AS checking_count,
        COALESCE((SELECT COUNT(*) FROM sheets WHERE exam_id = e.id AND status = 'pending'), 0) AS pending_count
      FROM exams e
      WHERE e.id = $1`,
      [id],
    );

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getSingleExam error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to fetch exam' });
  }
};

// ─── UPDATE EXAM ──────────────────────────────────────────────

export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      subject,
      date,
      totalQuestions,
      maxMarks,
      spentTime,
      status,
      createdBy,
    } = req.body;
console.log('DATA===>',req.body)
    const fieldMap = {
      name,
      subject,
      date,
      totalQuestions,
      maxMarks,
      spentTime,
      status,
      createdBy,
    };
    
    const fields = [];
    const values = [];
    let i = 1;

    for (const [column, value] of Object.entries(fieldMap)) {
      if (value !== undefined) {
        fields.push(`"${column}" = $${i}`);
        values.push(value);
        i++;
      }
    }

    if (fields.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: 'No fields provided to update' });
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE exams
      SET ${fields.join(', ')}
      WHERE id = $${i}
      RETURNING *;
    `;

    const { rows } = await pool.query(query, values);

    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: 'Exam not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('updateExam error:', error);
    return res
      .status(500)
      .json({ success: false, message: 'Failed to update exam' });
  }
};

// ════════════════════════════════════════════════════════════════
// ✅ DELETE FUNCTIONS WITH UUID SUPPORT
// ════════════════════════════════════════════════════════════════

// ─── DELETE SINGLE EXAM (WITH CASCADE) ──────────────────────

export const deleteExam = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 1️⃣ Check if exam exists
    const examResult = await client.query(
      `SELECT id, name, subject FROM exams WHERE id = $1`,
      [id],
    );

    if (examResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Exam not found',
      });
    }

    const exam = examResult.rows[0];

    // 2️⃣ Get all sheets associated with this exam
    const sheetsResult = await client.query(
      `SELECT id, file_name, barcode FROM sheets WHERE exam_id = $1`,
      [id],
    );

    const sheetIds = sheetsResult.rows.map((s) => s.id);
    const sheetCount = sheetIds.length;

    // 3️⃣ Delete all sheets for this exam
    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE exam_id = $1`, [id]);
    }

    // 4️⃣ Delete the exam
    await client.query(`DELETE FROM exams WHERE id = $1`, [id]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Exam "${exam.name}" deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
      data: {
        examId: id,
        examName: exam.name,
        deletedSheets: sheetCount,
        sheetIds: sheetIds,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete exam',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ─── BULK DELETE EXAMS (WITH CASCADE) ────────────────────────

export const bulkDeleteExams = async (req, res) => {
  const client = await pool.connect();

  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of exam IDs to delete',
      });
    }

    await client.query('BEGIN');

    // ✅ UUID array ke liye $1::uuid[] use karo
    const examsResult = await client.query(
      `SELECT id, name, subject FROM exams WHERE id = ANY($1::uuid[])`,
      [ids],
    );

    const existingExamIds = examsResult.rows.map((e) => e.id);
    const notFoundIds = ids.filter((id) => !existingExamIds.includes(id));

    if (existingExamIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'No exams found with the provided IDs',
      });
    }

    // 2️⃣ Get all sheets for these exams
    const sheetsResult = await client.query(
      `SELECT id, exam_id, file_name, barcode FROM sheets WHERE exam_id = ANY($1::uuid[])`,
      [existingExamIds],
    );

    const sheetIds = sheetsResult.rows.map((s) => s.id);
    const sheetCount = sheetIds.length;

    // 3️⃣ Delete all sheets
    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE exam_id = ANY($1::uuid[])`, [
        existingExamIds,
      ]);
    }

    // 4️⃣ Delete all exams
    await client.query(`DELETE FROM exams WHERE id = ANY($1::uuid[])`, [
      existingExamIds,
    ]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${existingExamIds.length} exam(s) deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
      data: {
        deletedCount: existingExamIds.length,
        deletedIds: existingExamIds,
        deletedNames: examsResult.rows.map((e) => e.name),
        deletedSheets: sheetCount,
        sheetIds: sheetIds,
        notFoundIds: notFoundIds,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('bulkDeleteExams error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete exams',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ─── DELETE EXAMS BY FILTER ──────────────────────────────────

export const deleteExamsByFilter = async (req, res) => {
  const client = await pool.connect();

  try {
    const { subject, status, date } = req.query;

    if (!subject && !status && !date) {
      return res.status(400).json({
        success: false,
        message:
          'Please provide at least one filter (subject, status, or date)',
      });
    }

    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (subject) {
      conditions.push(`subject ILIKE $${paramCount}`);
      params.push(`%${subject}%`);
      paramCount++;
    }

    if (status) {
      conditions.push(`LOWER(TRIM(status)) = $${paramCount}`);
      params.push(status.toLowerCase());
      paramCount++;
    }

    if (date) {
      conditions.push(`DATE(date) = $${paramCount}`);
      params.push(date);
      paramCount++;
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    await client.query('BEGIN');

    const examsResult = await client.query(
      `SELECT id, name FROM exams ${whereClause}`,
      params,
    );

    const examIds = examsResult.rows.map((e) => e.id);

    if (examIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'No exams found with the given filters',
      });
    }

    // Delete sheets
    const sheetsResult = await client.query(
      `SELECT id FROM sheets WHERE exam_id = ANY($1::uuid[])`,
      [examIds],
    );

    const sheetCount = sheetsResult.rows.length;

    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE exam_id = ANY($1::uuid[])`, [
        examIds,
      ]);
    }

    // Delete exams
    await client.query(`DELETE FROM exams WHERE id = ANY($1::uuid[])`, [
      examIds,
    ]);

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${examIds.length} exam(s) deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
      data: {
        deletedCount: examIds.length,
        deletedIds: examIds,
        deletedSheets: sheetCount,
        filters: { subject, status, date },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('deleteExamsByFilter error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete exams',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// ─── GET DELETION PREVIEW ─────────────────────────────────────

export const getExamDeletionPreview = async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({
        success: false,
        message: 'Please provide exam IDs',
      });
    }

    // ✅ UUID array banayein (string split se)
    const idArray = ids.split(',').map((id) => id.trim());

    if (idArray.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid exam IDs provided',
      });
    }

    // Get exams
    const examsResult = await pool.query(
      `SELECT id, name, subject, date, status 
       FROM exams 
       WHERE id = ANY($1::uuid[])`,
      [idArray],
    );

    // Get sheet count for each exam
    const sheetsResult = await pool.query(
      `SELECT exam_id, COUNT(*) AS sheet_count,
        COUNT(*) FILTER (WHERE status = 'checked') AS checked_count,
        COUNT(*) FILTER (WHERE status = 'checking') AS checking_count,
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
       FROM sheets 
       WHERE exam_id = ANY($1::uuid[])
       GROUP BY exam_id`,
      [idArray],
    );

    const sheetCountMap = {};
    sheetsResult.rows.forEach((row) => {
      sheetCountMap[row.exam_id] = {
        total: parseInt(row.sheet_count),
        checked: parseInt(row.checked_count || 0),
        checking: parseInt(row.checking_count || 0),
        pending: parseInt(row.pending_count || 0),
      };
    });

    const examsWithSheets = examsResult.rows.map((exam) => ({
      ...exam,
      sheet_count: sheetCountMap[exam.id]?.total || 0,
      checked_count: sheetCountMap[exam.id]?.checked || 0,
      checking_count: sheetCountMap[exam.id]?.checking || 0,
      pending_count: sheetCountMap[exam.id]?.pending || 0,
    }));

    const totalSheets = examsWithSheets.reduce(
      (sum, e) => sum + e.sheet_count,
      0,
    );

    return res.status(200).json({
      success: true,
      message: 'Deletion preview retrieved successfully',
      data: {
        exams: examsWithSheets,
        totalExams: examsWithSheets.length,
        totalSheets: totalSheets,
        willDelete: {
          exams: examsWithSheets.length,
          sheets: totalSheets,
        },
      },
    });
  } catch (error) {
    console.error('getExamDeletionPreview error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get deletion preview',
      error: error.message,
    });
  }
};
