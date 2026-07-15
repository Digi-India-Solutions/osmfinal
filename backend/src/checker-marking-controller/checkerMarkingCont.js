// src/checker/checkerMarkingCont.js

import pool from '../pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── HELPER: Normalize a stored file_url into a real relative path ──
// Handles: windows backslashes, full URLs, leading slashes, and a
// leading "uploads/" segment (since uploadsDir already points at .../uploads)
const normalizeStoredPath = (storedPath) => {
  if (!storedPath) return null;
  let p = storedPath.replace(/\\/g, '/'); // windows backslash -> forward slash
  p = p.replace(/^https?:\/\/[^/]+/, ''); // strip domain if a full URL was stored
  p = p.replace(/^\/+/, ''); // strip leading slashes
  if (p.startsWith('uploads/')) {
    p = p.slice('uploads/'.length); // avoid uploads/uploads/... double join
  }
  return p;
};

// ─── HELPER: Make a safe folder/file-name segment ──────────────
const sanitizeForFolderName = (value) => {
  if (!value) return null;
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '_'); // strip anything unsafe for a path segment
};

// ─── HELPER: Move file to checked folder ──────────────────────

const moveFileToCheckedFolder = (oldPath, newPath) => {
  try {
    // Create directory if not exists
    const dir = path.dirname(newPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`📁 Created directory: ${dir}`);
    }

    // Check if source file exists
    if (!fs.existsSync(oldPath)) {
      console.warn(`⚠️ Source file not found: ${oldPath}`);
      return false;
    }

    // Move file
    fs.renameSync(oldPath, newPath);
    console.log(`✅ File moved to: ${newPath}`);
    return true;
  } catch (error) {
    console.error(`❌ Error moving file: ${error.message}`);
    return false;
  }
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

    // Check if sheet is assigned to this checker
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

    // Check if already submitted
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
      // Update existing - always save as draft
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
      // Insert new
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

    // Update sheet status to 'checking' if it's not already
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

    // Check if sheet is assigned to this checker
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

    // Check if marking record exists
    const existing = await pool.query(
      `SELECT id FROM checker_markings 
       WHERE sheet_id = $1 AND checker_id = $2`,
      [sheetId, userId],
    );

    let result;

    const finalTimeSpent = timeSpent || 0;

    if (existing.rows.length > 0) {
      // Update existing record
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
      // Insert new record
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

    // ✅ Create checked folder path — use barcode (matches file_name pattern
    // like "BAR025.pdf") instead of the raw sheetId, falling back to sheetId
    // if barcode is missing for some reason
    const folderKey = sanitizeForFolderName(sheetData.barcode) || sheetId;
    const checkedFolder = `checked-sheets/${examId}/${folderKey}`;

    // ✅ Get current file path from sheet
    const currentFilePath = sheetData.file_url;
    let newFilePath = null;
    let fileMoved = false;

    if (currentFilePath) {
      // ✅ Generate new file path in checked folder
      const fileName = sheetData.file_name || `sheet-${sheetId}.pdf`;
      newFilePath = `/${checkedFolder}/${fileName}`;

      // ✅ Get full paths for file moving
      const uploadsDir = path.join(__dirname, '..', 'uploads');

      // ✅ Normalize the DB-stored path before joining, so we never end up
      // with a double "uploads/uploads/..." path (main cause of silent
      // "Source file not found" failures)
      const relativeOldPath = normalizeStoredPath(currentFilePath);
      const oldFullPath = path.join(uploadsDir, relativeOldPath);
      const newFullPath = path.join(uploadsDir, checkedFolder, fileName);

      console.log(
        `📁 Moving sheet ${sheetId} to checked folder: ${checkedFolder}`,
      );
      console.log(`📄 Raw file_url from DB: ${currentFilePath}`);
      console.log(`📄 Normalized relative path: ${relativeOldPath}`);
      console.log(`📄 Old full path: ${oldFullPath}`);
      console.log(`📄 New full path: ${newFullPath}`);

      // ✅ Move the file physically
      fileMoved = moveFileToCheckedFolder(oldFullPath, newFullPath);

      if (fileMoved) {
        console.log(`✅ File moved successfully for sheet ${sheetId}`);
      } else {
        console.warn(
          `⚠️ File not moved for sheet ${sheetId}, keeping original path`,
        );
      }
    }

    // ✅ Update sheet marks, status AND time spent + checked folder info
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
      [
        totalMarks || 0,
        finalTimeSpent,
        checkedFolder,
        fileMoved ? newFilePath : currentFilePath,
        sheetId,
      ],
    );

    // ✅ Update assignment status to completed
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
        new_file_path: fileMoved ? newFilePath : null,
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
    const userId = req.user.id;

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

    console.log('🔍 Escalate request:', {
      sheetId,
      userId,
      reason,
      escalateType,
      remarks,
      timeSpent,
    });

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

    // ✅ Update sheet status to 'escalated' with time spent
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

    // ✅ Also update checker_markings with time_spent
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
      // Insert if not exists
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
    const userId = req.user.id;

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

    // ✅ DISTINCT ON (s.id) avoids duplicate rows when a sheet has more
    // than one assignment row (e.g. it was reassigned before being checked)
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

    // DISTINCT ON requires the ORDER BY to start with the same expression
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
