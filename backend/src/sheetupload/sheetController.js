import pool from '../pool.js';
import {
  uploadImageToCloudinary,
  deleteFromCloudinary,
} from '../../utils/cloudinary.util.js';
import fs from 'fs';
import path from 'path';

// ─── UPLOAD SHEETS ──────────────────────────────────────────────

export const uploadSheets = async (req, res) => {
  try {
    const { examId } = req.params;
    const userId = req.user.id;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files uploaded',
      });
    }

    const uploadedSheets = [];
    let linkedCount = 0;
    let unlinkedCount = 0;
    const duplicateSheets = [];
    const invalidFiles = [];

    for (const file of req.files) {
      const fileName = path.parse(file.originalname).name;
      const barcode = fileName.trim().toUpperCase();

      // ✅ Validate barcode
      if (!/^[A-Z]{0,3}\d{3}$/i.test(barcode)) {
        invalidFiles.push({
          filename: file.originalname,
          barcode: barcode,
          message: 'Invalid barcode format',
        });
        continue;
      }

      // ✅ Check duplicate
      const existingSheet = await pool.query(
        `SELECT id FROM sheets WHERE exam_id = $1 AND barcode = $2`,
        [examId, barcode],
      );

      if (existingSheet.rows.length > 0) {
        duplicateSheets.push({
          barcode,
          filename: file.originalname,
          message: 'Sheet already uploaded',
        });
        continue;
      }

      // ✅ LOCAL URL (not Cloudinary)
      const fileUrl = `/uploads/sheets/${file.filename}`;

      // ✅ Find student
      const studentResult = await pool.query(
        `SELECT id, roll_no, student_name, subject FROM student_records WHERE barcode = $1`,
        [barcode],
      );

      const student = studentResult.rows[0];

      // ✅ Insert sheet
      const sheetResult = await pool.query(
        `INSERT INTO sheets (
          exam_id, student_id, roll_no, student_name, barcode,
          file_name, file_url, file_size, mime_type, status, uploaded_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *`,
        [
          examId,
          student?.id || null,
          student?.roll_no || null,
          student?.student_name || null,
          barcode,
          file.originalname,
          fileUrl,
          file.size,
          file.mimetype,
          student ? 'linked' : 'unlinked',
          userId,
        ],
      );

      const sheet = sheetResult.rows[0];

      if (student) linkedCount++;
      else unlinkedCount++;

      uploadedSheets.push({
        ...sheet,
        matched: !!student,
        student: student || null,
      });
    }

    let message = `${uploadedSheets.length} sheets uploaded successfully`;
    if (invalidFiles.length > 0) {
      message += `, ${invalidFiles.length} files skipped (invalid barcode)`;
    }
    if (duplicateSheets.length > 0) {
      message += `, ${duplicateSheets.length} files skipped (duplicates)`;
    }

    return res.status(200).json({
      success: true,
      message: message,
      data: {
        sheets: uploadedSheets,
        total: uploadedSheets.length,
        linked: linkedCount,
        unlinked: unlinkedCount,
        invalidFiles,
        invalidCount: invalidFiles.length,
        duplicates: duplicateSheets,
        duplicateCount: duplicateSheets.length,
      },
    });
  } catch (error) {
    console.error('uploadSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload sheets',
      error: error.message,
    });
  }
};

// ─── AUTO-LINK SHEETS BY BARCODE ──────────────────────────────

export const autoLinkSheets = async (req, res) => {
  try {
    const { examId } = req.params;
    const { sheetIds } = req.body;

    if (!sheetIds || !Array.isArray(sheetIds) || sheetIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide sheet IDs to link',
      });
    }

    const client = await pool.connect();
    const results = [];

    try {
      await client.query('BEGIN');

      for (const sheetId of sheetIds) {
        const sheetResult = await client.query(
          `SELECT id, barcode FROM sheets WHERE id = $1 AND exam_id = $2`,
          [sheetId, examId],
        );

        if (sheetResult.rows.length === 0) continue;

        const sheet = sheetResult.rows[0];

        const studentResult = await client.query(
          `SELECT id, roll_no, student_name, subject 
           FROM student_records 
           WHERE barcode = $1`,
          [sheet.barcode],
        );

        if (studentResult.rows.length === 0) {
          results.push({
            sheetId,
            barcode: sheet.barcode,
            matched: false,
            message: 'No student found with this barcode',
          });
          continue;
        }

        const student = studentResult.rows[0];

        await client.query(
          `UPDATE sheets 
           SET student_id = $1, 
               roll_no = $2, 
               student_name = $3,
               status = 'linked',
               updated_at = CURRENT_TIMESTAMP
           WHERE id = $4`,
          [student.id, student.roll_no, student.student_name, sheetId],
        );

        await client.query(
          `UPDATE student_records 
           SET sheet_status = 'uploaded' 
           WHERE barcode = $1`,
          [sheet.barcode],
        );

        results.push({
          sheetId,
          barcode: sheet.barcode,
          matched: true,
          student: student,
          message: 'Linked successfully',
        });
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: `${results.filter((r) => r.matched).length} sheets linked successfully`,
        data: {
          results,
          total: results.length,
          linked: results.filter((r) => r.matched).length,
          unlinked: results.filter((r) => !r.matched).length,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('autoLinkSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to auto-link sheets',
      error: error.message,
    });
  }
};

// ─── GET SHEETS BY EXAM ─────────────────────────────────────────
// ✅ UPDATED: Added escalation columns

export const getSheetsByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { status } = req.query;

    let query = `
      SELECT 
        s.id, s.exam_id, s.student_id, s.roll_no, s.student_name,
        s.barcode, s.file_name, s.file_url, s.file_size, s.mime_type,
        s.status, s.marks, s.created_at, s.updated_at,
        s.escalate_reason, s.escalate_type, s.escalate_remarks,
        s.escalated_by, s.escalated_at,
        sr.subject
      FROM sheets s
      LEFT JOIN student_records sr ON s.student_id = sr.id
      WHERE s.exam_id = $1
    `;
    const params = [examId];

    if (status) {
      query += ` AND s.status = $2`;
      params.push(status);
    }

    query += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);

    // ✅ Updated stats with escalated
    const statsResult = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'uploaded') AS uploaded,
        COUNT(*) FILTER (WHERE status = 'linked') AS linked,
        COUNT(*) FILTER (WHERE status = 'checking') AS checking,
        COUNT(*) FILTER (WHERE status = 'checked') AS checked,
        COUNT(*) FILTER (WHERE status = 'recheck') AS recheck,
        COUNT(*) FILTER (WHERE status = 'rechecked') AS rechecked,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated
      FROM sheets WHERE exam_id = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Sheets retrieved successfully',
      data: {
        sheets: result.rows,
        stats: statsResult.rows[0],
        total: result.rows.length,
      },
    });
  } catch (error) {
    console.error('getSheetsByExam error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheets',
      error: error.message,
    });
  }
};

// ─── GET SHEET BY ID ────────────────────────────────────────────
// ✅ UPDATED: Added escalation columns

export const getSheetById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        s.*,
        sr.subject,
        u.name AS escalated_by_name
      FROM sheets s
      LEFT JOIN student_records sr ON s.student_id = sr.id
      LEFT JOIN users u ON s.escalated_by = u.id
      WHERE s.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getSheetById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheet',
      error: error.message,
    });
  }
};

// ─── UPDATE SHEET MARKS ─────────────────────────────────────────
// ✅ UPDATED: Added escalation fields

export const updateSheetMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks, status, escalate_reason, escalate_type, escalate_remarks } =
      req.body;

    const fields = [];
    const values = [];
    let paramCount = 1;

    if (marks !== undefined && marks !== null) {
      fields.push(`marks = $${paramCount}`);
      values.push(marks);
      paramCount++;
    }

    if (status) {
      fields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (escalate_reason !== undefined) {
      fields.push(`escalate_reason = $${paramCount}`);
      values.push(escalate_reason);
      paramCount++;
    }

    if (escalate_type !== undefined) {
      fields.push(`escalate_type = $${paramCount}`);
      values.push(escalate_type);
      paramCount++;
    }

    if (escalate_remarks !== undefined) {
      fields.push(`escalate_remarks = $${paramCount}`);
      values.push(escalate_remarks);
      paramCount++;
    }

    if (fields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update',
      });
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await pool.query(
      `UPDATE sheets 
       SET ${fields.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('updateSheetMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update sheet',
      error: error.message,
    });
  }
};

// ─── DELETE SHEET ───────────────────────────────────────────────

export const deleteSheet = async (req, res) => {
  try {
    const { id } = req.params;

    const sheetResult = await pool.query(
      `SELECT file_url FROM sheets WHERE id = $1`,
      [id],
    );

    if (sheetResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    if (sheetResult.rows[0].file_url) {
      try {
        const publicId = sheetResult.rows[0].file_url
          .split('/')
          .pop()
          .split('.')[0];
        await deleteFromCloudinary(publicId);
      } catch (err) {
        console.error('Error deleting from Cloudinary:', err);
      }
    }

    await pool.query(`DELETE FROM sheets WHERE id = $1`, [id]);

    return res.status(200).json({
      success: true,
      message: 'Sheet deleted successfully',
    });
  } catch (error) {
    console.error('deleteSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete sheet',
      error: error.message,
    });
  }
};

// ─── GET SHEET STATS ────────────────────────────────────────────
// ✅ UPDATED: Added escalated in stats

export const getSheetStats = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'uploaded') AS uploaded,
        COUNT(*) FILTER (WHERE status = 'linked') AS linked,
        COUNT(*) FILTER (WHERE status = 'checking') AS checking,
        COUNT(*) FILTER (WHERE status = 'checked') AS checked,
        COUNT(*) FILTER (WHERE status = 'recheck') AS recheck,
        COUNT(*) FILTER (WHERE status = 'rechecked') AS rechecked,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated,
        SUM(marks) AS total_marks,
        AVG(marks) AS average_marks
      FROM sheets 
      WHERE exam_id = $1`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Sheet statistics retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getSheetStats error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get sheet statistics',
      error: error.message,
    });
  }
};

// ─── GET UNLINKED SHEETS ───────────────────────────────────────

export const getUnlinkedSheets = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        s.id, s.file_name, s.barcode, s.file_url,
        s.created_at
      FROM sheets s
      WHERE s.exam_id = $1 
        AND (s.status = 'uploaded' OR s.status = 'unlinked')
        AND s.student_id IS NULL
      ORDER BY s.created_at ASC`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Unlinked sheets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getUnlinkedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unlinked sheets',
      error: error.message,
    });
  }
};

// ─── GET UNLINKED STUDENTS ──────────────────────────────────────

export const getUnlinkedStudents = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        sr.id, sr.roll_no, sr.student_name, sr.barcode, sr.subject
      FROM student_records sr
      LEFT JOIN sheets s ON sr.barcode = s.barcode AND s.exam_id = $1
      WHERE sr.sheet_status != 'uploaded' 
        AND sr.sheet_status != 'linked'
        AND s.id IS NULL
      ORDER BY sr.roll_no ASC`,
      [examId],
    );

    return res.status(200).json({
      success: true,
      message: 'Unlinked students retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getUnlinkedStudents error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get unlinked students',
      error: error.message,
    });
  }
};

// ─── MANUAL LINK SHEET TO STUDENT ──────────────────────────────

export const manualLinkStudent = async (req, res) => {
  try {
    const { examId } = req.params;
    const { studentId, sheetId } = req.body;

    if (!studentId || !sheetId) {
      return res.status(400).json({
        success: false,
        message: 'studentId and sheetId are required',
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const studentResult = await client.query(
        `SELECT roll_no, student_name, barcode FROM student_records WHERE id = $1`,
        [studentId],
      );

      if (studentResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Student not found',
        });
      }

      const student = studentResult.rows[0];

      const sheetResult = await client.query(
        `SELECT id, barcode FROM sheets WHERE id = $1 AND exam_id = $2 AND student_id IS NULL`,
        [sheetId, examId],
      );

      if (sheetResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sheet not found or already linked',
        });
      }

      const sheet = sheetResult.rows[0];

      await client.query(
        `UPDATE sheets 
         SET student_id = $1, 
             roll_no = $2, 
             student_name = $3,
             barcode = $4,
             status = 'linked',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $5`,
        [
          studentId,
          student.roll_no,
          student.student_name,
          student.barcode,
          sheetId,
        ],
      );

      await client.query(
        `UPDATE student_records 
         SET sheet_status = 'uploaded',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [studentId],
      );

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Student linked successfully',
        data: {
          studentId,
          sheetId,
          roll_no: student.roll_no,
          student_name: student.student_name,
          barcode: student.barcode,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('manualLinkStudent error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to link student',
      error: error.message,
    });
  }
};

// ─── GET STUDENT LINKING STATUS ────────────────────────────────

export const getStudentLinkingStatus = async (req, res) => {
  try {
    const { examId } = req.params;

    const result = await pool.query(
      `SELECT 
        sr.id,
        sr.roll_no,
        sr.student_name,
        sr.barcode,
        sr.subject,
        sr.sheet_status,
        s.id AS sheet_id,
        s.file_name,
        s.status AS sheet_status,
        CASE 
          WHEN s.id IS NOT NULL AND sr.sheet_status = 'uploaded' THEN true
          ELSE false
        END AS is_linked
      FROM student_records sr
      LEFT JOIN sheets s ON sr.barcode = s.barcode AND s.exam_id = $1
      ORDER BY sr.roll_no ASC`,
      [examId],
    );

    const stats = {
      total: result.rows.length,
      uploaded: result.rows.filter((r) => r.sheet_status === 'uploaded').length,
      linked: result.rows.filter((r) => r.is_linked).length,
      pending: result.rows.filter(
        (r) => r.sheet_status !== 'uploaded' && !r.is_linked,
      ).length,
    };

    return res.status(200).json({
      success: true,
      message: 'Student linking status retrieved successfully',
      data: {
        students: result.rows,
        stats,
      },
    });
  } catch (error) {
    console.error('getStudentLinkingStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get student linking status',
      error: error.message,
    });
  }
};

// ─── GET ESCALATED SHEETS ──────────────────────────────────────
// ✅ NEW: Get all escalated sheets

export const getEscalatedSheets = async (req, res) => {
  try {
    const { examId } = req.params;

    let query = `
      SELECT 
        s.id, s.student_name, s.roll_no, s.barcode,
        s.status, s.marks,
        s.escalate_reason, s.escalate_type, s.escalate_remarks,
        s.escalated_by, s.escalated_at,
        e.name AS exam_name,
        u.name AS escalated_by_name
      FROM sheets s
      JOIN exams e ON s.exam_id = e.id
      LEFT JOIN users u ON s.escalated_by = u.id
      WHERE s.status = 'escalated'
    `;
    const params = [];

    if (examId) {
      query += ` AND s.exam_id = $1`;
      params.push(examId);
    }

    query += ` ORDER BY s.escalated_at DESC`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Escalated sheets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getEscalatedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get escalated sheets',
      error: error.message,
    });
  }
};
