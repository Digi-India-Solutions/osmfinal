// src/checker/checkerMarkingCont.js

import pool from '../pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ✅ Uploads directory - project root ke andar
const PROJECT_ROOT = path.join(__dirname, '..', '..'); // backend folder
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

console.log('📁 Uploads directory:', UPLOADS_DIR);

// ─── HELPER: Make a safe folder/file-name segment ──────────────
const sanitizeForFolderName = (value) => {
  if (!value) return null;
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '_');
};

// ─── SAVE DRAFT MARKS ──────────────────────────────────────────
export const saveDraft = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const {
      marksData,
      annotationsData,
      stampsData,
      totalMarks,
      remarks,
      timeSpent,
    } = req.body;

    const assignmentCheck = await pool.query(
      `SELECT a.sheet_id, s.exam_id 
       FROM assignments a
       JOIN sheets s ON a.sheet_id = s.id
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const examId = assignmentCheck.rows[0].exam_id;

    const existing = await pool.query(
      `SELECT id, is_submitted FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    if (existing.rows.length > 0 && existing.rows[0].is_submitted === true) {
      return res.status(400).json({
        success: false,
        message: 'Cannot save draft for already submitted sheet',
      });
    }

    let result;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE checker_markings 
         SET marks_data = $1,
             annotations_data = $2,
             stamps_data = $3,
             total_marks = $4,
             remarks = $5,
             time_spent = $6,
             is_draft = true,
             updated_at = CURRENT_TIMESTAMP
         WHERE sheet_id = $7 AND checker_id = $8
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          timeSpent || 0,
          sheetId,
          userId,
        ],
      );
    } else {
      result = await pool.query(
        `INSERT INTO checker_markings (
          sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data,
          total_marks, remarks, time_spent, is_draft
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
        RETURNING *`,
        [
          sheetId,
          userId,
          examId,
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          timeSpent || 0,
        ],
      );
    }

    await pool.query(
      `UPDATE sheets 
       SET marks = $1, 
           status = 'checking', 
           checking_time_spent = $2,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [totalMarks || 0, timeSpent || 0, sheetId],
    );

    return res.status(200).json({
      success: true,
      message: 'Draft saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('saveDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
    });
  }
};

// ─── SUBMIT MARKS ──────────────────────────────────────────────
export const submitMarks = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const {
      marksData,
      annotationsData,
      stampsData,
      totalMarks,
      remarks,
      timeSpent,
    } = req.body;

    // ✅ Check if sheet is assigned to this checker
    const assignmentCheck = await pool.query(
      `SELECT a.sheet_id, s.exam_id, s.file_url, s.file_name, s.student_name, s.roll_no, s.barcode
       FROM assignments a
       JOIN sheets s ON a.sheet_id = s.id
       WHERE a.sheet_id = $1 AND a.checker_id = $2 AND a.status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const examId = assignmentCheck.rows[0].exam_id;
    const sheetData = assignmentCheck.rows[0];

    // ✅ Check if marking record exists
    const existing = await pool.query(
      `SELECT id FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    let result;
    const finalTimeSpent = timeSpent || 0;

    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE checker_markings 
         SET marks_data = $1,
             annotations_data = $2,
             stamps_data = $3,
             total_marks = $4,
             remarks = $5,
             time_spent = $6,
             is_draft = false,
             is_submitted = true,
             submitted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE sheet_id = $7 AND checker_id = $8
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          finalTimeSpent,
          sheetId,
          userId,
        ],
      );
    } else {
      result = await pool.query(
        `INSERT INTO checker_markings (
          sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data,
          total_marks, remarks, time_spent,
          is_draft, is_submitted, submitted_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, true, CURRENT_TIMESTAMP)
        RETURNING *`,
        [
          sheetId,
          userId,
          examId,
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          totalMarks || 0,
          remarks || null,
          finalTimeSpent,
        ],
      );
    }

    // ✅ ========================================================
    // ✅ CHECKED SHEETS FOLDER MEIN FILE SAVE KARO
    // ✅ ========================================================

    let fileMoved = false;
    let newFilePath = null;
    let checkedFolder = null;

    try {
      // ✅ Folder name: barcode use karo, agar nahi hai toh sheetId
      const folderKey =
        sanitizeForFolderName(sheetData.barcode) || `sheet-${sheetId}`;

      // ✅ Folder path: checked-sheets/{examId}/{barcode}/
      checkedFolder = `checked-sheets/${examId}/${folderKey}`;

      // ✅ File name
      let fileName = sheetData.file_name;
      if (!fileName && sheetData.file_url) {
        fileName = path.basename(sheetData.file_url);
      }
      if (!fileName) {
        fileName = `${folderKey}.pdf`;
      }

      // ✅ Source file path (where file currently is)
      let sourcePath = null;

      // ✅ Check multiple possible locations for the file
      const possiblePaths = [
        path.join(UPLOADS_DIR, 'sheets', fileName), // uploads/sheets/BAR055.pdf
        path.join(UPLOADS_DIR, fileName), // uploads/BAR055.pdf
        path.join(UPLOADS_DIR, 'uploads', 'sheets', fileName), // uploads/uploads/sheets/BAR055.pdf
      ];

      console.log(`🔍 Looking for file: ${fileName}`);
      console.log(`📁 Uploads directory: ${UPLOADS_DIR}`);

      for (const p of possiblePaths) {
        console.log(`   Checking: ${p}`);
        if (fs.existsSync(p)) {
          sourcePath = p;
          console.log(`✅ Found file at: ${p}`);
          break;
        }
      }

      if (sourcePath) {
        // ✅ Destination path: uploads/checked-sheets/{examId}/{barcode}/{fileName}
        const destPath = path.join(UPLOADS_DIR, checkedFolder, fileName);
        console.log(`📄 Destination: ${destPath}`);

        // ✅ Create directory if not exists
        const dir = path.dirname(destPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`📁 Created directory: ${dir}`);
        }

        // ✅ Copy file to checked-sheets folder
        fs.copyFileSync(sourcePath, destPath);
        console.log(`✅ File copied to: ${destPath}`);

        fileMoved = true;
        newFilePath = `/${checkedFolder}/${fileName}`;
      } else {
        console.error(`❌ File not found in any location!`);
        console.error(`   Tried:`, possiblePaths);

        // ✅ Dump what's in sheets folder for debugging
        const sheetsDir = path.join(UPLOADS_DIR, 'sheets');
        if (fs.existsSync(sheetsDir)) {
          const files = fs.readdirSync(sheetsDir);
          console.log(`📂 Files in sheets folder (${files.length}):`, files);
        }
      }
    } catch (err) {
      console.error(`❌ File copy error:`, err.message);
    }

    // ✅ Update sheet in database
    const finalFileUrl = fileMoved ? newFilePath : sheetData.file_url;

    await pool.query(
      `UPDATE sheets 
       SET marks = $1, 
           status = 'checked', 
           checking_time_spent = $2,
           is_checked = true,
           checked_at = CURRENT_TIMESTAMP,
           archived_folder = $3,
           file_url = $4,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = $5`,
      [totalMarks || 0, finalTimeSpent, checkedFolder, finalFileUrl, sheetId],
    );

    // ✅ Update assignment status
    await pool.query(
      `UPDATE assignments 
       SET status = 'completed',
           updated_at = CURRENT_TIMESTAMP
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    return res.status(200).json({
      success: true,
      message: 'Marks submitted successfully',
      data: {
        ...result.rows[0],
        time_spent: finalTimeSpent,
        archived_folder: checkedFolder,
        new_file_path: newFilePath,
        file_moved: fileMoved,
      },
    });
  } catch (error) {
    console.error('submitMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to submit marks',
      error: error.message,
    });
  }
};

// ─── GET SAVED DRAFT ───────────────────────────────────────────
export const getDraft = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        cm.*,
        s.status AS sheet_status,
        s.student_name,
        s.roll_no,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time
       FROM checker_markings cm
       JOIN sheets s ON cm.sheet_id = s.id
       JOIN exams e ON cm.exam_id = e.id
       WHERE cm.sheet_id = $1 AND cm.checker_id = $2`,
      [sheetId, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No draft found for this sheet',
        data: null,
      });
    }

    const row = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Draft retrieved successfully',
      data: {
        id: row.id,
        sheet_id: row.sheet_id,
        checker_id: row.checker_id,
        exam_id: row.exam_id,
        marks_data: row.marks_data || {},
        annotations_data: row.annotations_data || [],
        stamps_data: row.stamps_data || [],
        total_marks: row.total_marks,
        remarks: row.remarks,
        time_spent: row.time_spent || 0,
        is_draft: row.is_draft,
        is_submitted: row.is_submitted,
        submitted_at: row.submitted_at,
        created_at: row.created_at,
        updated_at: row.updated_at,
        sheet_status: row.sheet_status,
        student_name: row.student_name,
        roll_no: row.roll_no,
        exam_name: row.exam_name,
        exam_subject: row.exam_subject,
        exam_spent_time: row.exam_spent_time || 0,
      },
    });
  } catch (error) {
    console.error('getDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get draft',
      error: error.message,
    });
  }
};

// ─── GET SUBMITTED MARKS ───────────────────────────────────────
export const getSubmittedMarks = async (req, res) => {
  try {
    const { sheetId } = req.params;

    const result = await pool.query(
      `SELECT 
        cm.*,
        s.status AS sheet_status,
        s.student_name,
        s.roll_no,
        s.checking_time_spent,
        s.archived_folder,
        s.is_checked,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS checker_name
       FROM checker_markings cm
       JOIN sheets s ON cm.sheet_id = s.id
       JOIN exams e ON cm.exam_id = e.id
       JOIN users u ON cm.checker_id = u.id
       WHERE cm.sheet_id = $1 AND cm.is_submitted = true`,
      [sheetId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No submitted marks found for this sheet',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Submitted marks retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getSubmittedMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get submitted marks',
      error: error.message,
    });
  }
};

// ─── ESCALATE SHEET ─────────────────────────────────────────────
export const escalateSheet = async (req, res) => {
  try {
    const { sheetId } = req.params;
    const userId = req.user.id;
    const { reason, escalateType, remarks, timeSpent } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for escalation',
      });
    }

    const assignmentCheck = await pool.query(
      `SELECT sheet_id, exam_id FROM assignments 
       WHERE sheet_id = $1 AND checker_id = $2 AND status = 'assigned'`,
      [sheetId, userId],
    );

    if (assignmentCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found or not assigned to you',
      });
    }

    const examId = assignmentCheck.rows[0].exam_id;

    const result = await pool.query(
      `UPDATE sheets 
       SET status = 'escalated',
           escalate_reason = $1,
           escalate_type = $2,
           escalate_remarks = $3,
           escalated_by = $4,
           escalated_at = CURRENT_TIMESTAMP,
           checking_time_spent = $5,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING *`,
      [
        reason,
        escalateType || 'other',
        remarks || null,
        userId,
        timeSpent || 0,
        sheetId,
      ],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Sheet not found',
      });
    }

    const markingExists = await pool.query(
      `SELECT id FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    if (markingExists.rows.length > 0) {
      await pool.query(
        `UPDATE checker_markings 
         SET time_spent = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE sheet_id = $2 AND checker_id = $3`,
        [timeSpent || 0, sheetId, userId],
      );
    } else {
      await pool.query(
        `INSERT INTO checker_markings (
          sheet_id, checker_id, exam_id,
          time_spent, is_draft, is_submitted
        ) VALUES ($1, $2, $3, $4, true, false)`,
        [sheetId, userId, examId, timeSpent || 0],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Sheet escalated successfully',
      data: {
        ...result.rows[0],
        time_spent: timeSpent || 0,
      },
    });
  } catch (error) {
    console.error('escalateSheet error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to escalate sheet',
      error: error.message,
    });
  }
};

// ─── GET ESCALATED SHEETS ──────────────────────────────────────
export const getEscalatedSheets = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.status,
        s.escalate_reason,
        s.escalate_type,
        s.escalate_remarks,
        s.escalated_by,
        s.escalated_at,
        s.checking_time_spent,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS escalated_by_name
       FROM sheets s
       JOIN exams e ON s.exam_id = e.id
       LEFT JOIN users u ON s.escalated_by = u.id
       WHERE s.status = 'escalated'
       ORDER BY s.escalated_at DESC`,
      [],
    );

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

// ─── GET CHECKED SHEETS ────────────────────────────────────────
export const getCheckedSheets = async (req, res) => {
  try {
    const { examId } = req.params;

    let query = `
      SELECT DISTINCT ON (s.id)
        s.id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.marks,
        s.checking_time_spent,
        s.archived_folder,
        s.file_url,
        s.checked_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS checker_name
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'completed'
      LEFT JOIN users u ON a.checker_id = u.id
      WHERE s.is_checked = true AND s.status = 'checked'
    `;

    const params = [];

    if (examId) {
      query += ` AND s.exam_id = $1`;
      params.push(examId);
    }

    query += ` ORDER BY s.id, s.checked_at DESC`;

    const result = await pool.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Checked sheets retrieved successfully',
      data: result.rows,
    });
  } catch (error) {
    console.error('getCheckedSheets error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checked sheets',
      error: error.message,
    });
  }
};

// ─── GET CHECKED SHEET BY ID ──────────────────────────────────
export const getCheckedSheetById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        s.id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.marks,
        s.checking_time_spent,
        s.archived_folder,
        s.file_url,
        s.checked_at,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."maxMarks" AS total_marks,
        u.name AS checker_name,
        cm.marks_data,
        cm.annotations_data,
        cm.remarks,
        cm.submitted_at
      FROM sheets s
      LEFT JOIN exams e ON s.exam_id = e.id
      LEFT JOIN assignments a ON s.id = a.sheet_id AND a.status = 'completed'
      LEFT JOIN users u ON a.checker_id = u.id
      LEFT JOIN checker_markings cm ON s.id = cm.sheet_id AND cm.is_submitted = true
      WHERE s.id = $1 AND s.is_checked = true
      ORDER BY a.updated_at DESC
      LIMIT 1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Checked sheet not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Checked sheet retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('getCheckedSheetById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get checked sheet',
      error: error.message,
    });
  }
};
