// src/recheck-queue/recheckController.js

import pool from '../pool.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ROOT = path.join(__dirname, '..', '..');
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads');

// ─── HELPER ──────────────────────────────────────────────────────
const sanitizeForFolderName = (value) => {
  if (!value) return null;
  return String(value)
    .trim()
    .replace(/[^a-zA-Z0-9-_]/g, '_');
};

// ─── GET MY RECHECK REQUESTS ──────────────────────────────────

export const getMyRecheckRequests = async (req, res) => {
  try {
    const userId = req.user.id;
    const { status } = req.query;

    let conditions = ['rr.assign_to = $1'];
    const params = [userId];
    let paramCount = 2;

    if (status) {
      conditions.push(`rr.status = $${paramCount}`);
      params.push(status);
      paramCount++;
    }

    const whereClause = conditions.join(' AND ');

    const { rows } = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.resolved_at AS completed_at,
        rr.escalate_reason,
        rr.escalate_type,
        rr.escalate_remarks,
        rr.escalated_by,
        rr.escalated_at,
        rr.time_spent,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name,
        rm.marks_data,
        'higher' AS "finalMarksRule",
        (
          SELECT COUNT(*) 
          FROM recheck_requests rr2 
          WHERE rr2.sheet_id = rr.sheet_id 
            AND rr2.status IN ('pending', 'assigned')
        ) AS pending_recheck_count
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id
      WHERE ${whereClause}
      ORDER BY rr.created_at DESC
      `,
      params,
    );

    const countResult = await pool.query(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status IN ('completed', 'rejected')) AS completed_count,
        COUNT(*) FILTER (WHERE status = 'escalated') AS escalated_count
      FROM recheck_requests
      WHERE assign_to = $1`,
      [userId],
    );

    const counts = countResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Recheck requests retrieved successfully',
      data: {
        items: rows,
        stats: {
          pending: parseInt(counts.pending_count || 0),
          completed: parseInt(counts.completed_count || 0),
          escalated: parseInt(counts.escalated_count || 0),
        },
      },
    });
  } catch (error) {
    console.error('getMyRecheckRequests error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck requests',
      error: error.message,
    });
  }
};

// ─── GET RECHECK REQUEST BY ID ─────────────────────────────────

export const getRecheckRequestById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const { rows } = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.time_spent,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name,
        rm.marks_data,
        COALESCE(rr.final_marks_rule, 'higher') AS finalMarksRule
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id
      WHERE rr.id = $1 AND rr.assign_to = $2`,
      [id, userId],
    );

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request retrieved successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('getRecheckRequestById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck request',
      error: error.message,
    });
  }
};

// ─── UPDATE RECHECK REQUEST STATUS ─────────────────────────────

export const updateRecheckRequestStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, remarks } = req.body;
    const userId = req.user.id;

    const validStatuses = [
      'pending',
      'assigned',
      'completed',
      'rejected',
      'escalated',
    ];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Allowed: ${validStatuses.join(', ')}`,
      });
    }

    const checkResult = await pool.query(
      `SELECT id, sheet_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 
       AND status IN ('pending', 'assigned')`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

    let query = `UPDATE recheck_requests SET status = $1, updated_at = NOW()`;
    const values = [status];
    let paramCount = 2;

    if (status === 'completed' || status === 'rejected') {
      query += `, resolved_by = $${paramCount}, resolved_at = NOW()`;
      values.push(userId);
      paramCount++;
    }

    if (status === 'escalated') {
      query += `, escalated_by = $${paramCount}, escalated_at = NOW()`;
      values.push(userId);
      paramCount++;
    }

    if (remarks) {
      query += `, remarks = $${paramCount}`;
      values.push(remarks);
      paramCount++;
    }

    query += ` WHERE id = $${paramCount} RETURNING *`;
    values.push(id);

    const { rows } = await pool.query(query, values);

    if (status === 'escalated' && rows.length > 0 && sheetId) {
      await pool.query(
        `UPDATE sheets SET status = 'escalated', updated_at = NOW() WHERE id = $1`,
        [sheetId],
      );
    }

    if (status === 'completed' && rows.length > 0 && sheetId) {
      await pool.query(
        `UPDATE sheets SET status = 'rechecked', updated_at = NOW() WHERE id = $1`,
        [sheetId],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request updated successfully',
      data: rows[0],
    });
  } catch (error) {
    console.error('updateRecheckRequestStatus error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update recheck request',
      error: error.message,
    });
  }
};

// ─── START RECHECK MARKING ──────────────────────────────────────

export const startRecheckMarking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized - User not found',
      });
    }

    // Check if request exists
    const checkExists = await pool.query(
      `SELECT id, status, assign_to, sheet_id FROM recheck_requests WHERE id = $1`,
      [id],
    );

    if (checkExists.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found',
      });
    }

    const reqData = checkExists.rows[0];

    // If assign_to is null, assign to current user
    if (!reqData.assign_to) {
      await pool.query(
        `UPDATE recheck_requests SET assign_to = $1, updated_at = NOW() WHERE id = $2`,
        [userId, id],
      );
    }

    // If status is 'pending', change to 'assigned'
    if (reqData.status === 'pending') {
      await pool.query(
        `UPDATE recheck_requests SET status = 'assigned', updated_at = NOW() WHERE id = $1`,
        [id],
      );
    }

    // Check if request is completed or rejected (readonly)
    const isReadOnly =
      reqData.status === 'completed' || reqData.status === 'rejected';

    // Get full data with mark scheme
    const query = `
      SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.final_marks_rule,
        rr.time_spent,
        s.id AS sheet_id,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        s.status AS sheet_status,
        e.name AS exam_name,
        e.subject AS exam_subject,
        e."spentTime" AS exam_spent_time,
        ms."questionName",
        ms."maxMarks",
        ms.guidelines,
        ms.model_answer_pdf,
        ms.question_paper_pdf
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN mark_schemes ms ON ms."examId" = e.id
      WHERE rr.id = $1 AND rr.assign_to = $2
    `;

    const { rows } = await pool.query(query, [id, userId]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    // Group mark scheme
    const markScheme = {};
    rows.forEach((row) => {
      if (row.questionName) {
        markScheme[row.questionName] = {
          maxMarks: row.maxMarks,
          guidelines: row.guidelines,
        };
      }
    });

    const request = rows[0];

    // ✅ Get ORIGINAL checker markings (including notes)
    let originalMarks = {};
    let originalAnnotations = [];
    let originalStamps = [];
    let originalNotes = [];

    if (request.sheet_id) {
      const originalMarksResult = await pool.query(
        `SELECT marks_data, annotations_data, stamps_data, notes_data, total_marks 
         FROM checker_markings 
         WHERE sheet_id = $1 AND is_submitted = true
         ORDER BY submitted_at DESC LIMIT 1`,
        [request.sheet_id],
      );

      if (originalMarksResult.rows.length > 0) {
        originalMarks = originalMarksResult.rows[0].marks_data || {};
        originalAnnotations =
          originalMarksResult.rows[0].annotations_data || [];
        originalStamps = originalMarksResult.rows[0].stamps_data || [];
        originalNotes = originalMarksResult.rows[0].notes_data || [];
      }
    }

    // Get recheck marks if already saved
    let recheckMarks = {};
    let recheckAnnotations = [];
    let recheckStamps = [];
    let recheckNotes = [];

    const recheckResult = await pool.query(
      `SELECT marks_data, annotations_data, stamps_data, notes_data, total_marks 
       FROM recheck_markings 
       WHERE recheck_request_id = $1
       ORDER BY created_at DESC LIMIT 1`,
      [id],
    );

    if (recheckResult.rows.length > 0) {
      recheckMarks = recheckResult.rows[0].marks_data || {};
      recheckAnnotations = recheckResult.rows[0].annotations_data || [];
      recheckStamps = recheckResult.rows[0].stamps_data || [];
      recheckNotes = recheckResult.rows[0].notes_data || [];
    }

    // Build full file URL
    const baseUrl = process.env.API_URL || 'https://osmapi.digiindiasolutions.com';
    const buildFullUrl = (path) => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://'))
        return path;
      if (path.startsWith('/uploads')) return `${baseUrl}${path}`;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const finalMarksRule = request.final_marks_rule || 'higher';

    return res.status(200).json({
      success: true,
      message: 'Recheck marking data retrieved successfully',
      data: {
        request: {
          id: request.id,
          sheet_id: request.sheet_id,
          exam_id: request.exam_id,
          reason: request.reason,
          status: request.status,
          finalMarksRule: finalMarksRule,
          created_at: request.created_at,
          isReadOnly: isReadOnly,
          time_spent: request.time_spent || 0,
        },
        sheet: {
          id: request.sheet_id,
          student_name: request.student_name,
          roll_no: request.roll_no,
          barcode: request.barcode,
          file_name: request.file_name,
          file_url: buildFullUrl(request.file_url),
          current_marks: request.current_marks,
          status: request.sheet_status,
        },
        exam: {
          id: request.exam_id,
          name: request.exam_name,
          subject: request.exam_subject,
          spentTime: request.exam_spent_time || 0,
        },
        markScheme: markScheme,
        originalMarks: originalMarks,
        originalAnnotations: originalAnnotations,
        originalStamps: originalStamps,
        originalNotes: originalNotes,
        previousMarks: originalMarks,
        recheckMarks: recheckMarks,
        recheckAnnotations: recheckAnnotations,
        recheckStamps: recheckStamps,
        recheckNotes: recheckNotes,
        pdfs: {
          model_answer: buildFullUrl(request.model_answer_pdf),
          question_paper: buildFullUrl(request.question_paper_pdf),
        },
      },
    });
  } catch (error) {
    console.error('startRecheckMarking error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck marking data',
      error: error.message,
    });
  }
};

// ─── SAVE RECHECK MARKS ─────────────────────────────────────────

export const saveRecheckMarks = async (req, res) => {
  try {
    const { id } = req.params;
    const { marks, remarks } = req.body;
    const userId = req.user.id;

    if (marks === undefined || marks === null) {
      return res.status(400).json({
        success: false,
        message: 'Marks are required',
      });
    }

    const checkResult = await pool.query(
      `SELECT sheet_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 
       AND status IN ('assigned')`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

    await pool.query(
      `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
      [marks, sheetId],
    );

    if (remarks) {
      await pool.query(
        `UPDATE recheck_requests SET remarks = $1, updated_at = NOW() WHERE id = $2`,
        [remarks, id],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Marks saved successfully',
    });
  } catch (error) {
    console.error('saveRecheckMarks error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save marks',
      error: error.message,
    });
  }
};

// ─── COMPLETE RECHECK ───────────────────────────────────────────

export const completeRecheck = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      marks,
      remarks,
      marksData,
      annotationsData,
      stampsData,
      notesData,
      finalMarksRule,
      timeSpent,
    } = req.body;
    const userId = req.user.id;

    // ✅ FIX: Sirf 'assigned' status allow karo (pending nahi)
    const checkResult = await pool.query(
      `SELECT sheet_id, exam_id, status FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 
       AND status = 'assigned'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    // ✅ Agar already completed hai toh prevent karo
    if (checkResult.rows[0].status === 'completed') {
      return res.status(400).json({
        success: false,
        message: 'This recheck has already been completed',
      });
    }

    const { sheet_id: sheetId, exam_id: examId } = checkResult.rows[0];

    // Get sheet data for file moving
    const sheetDataResult = await pool.query(
      `SELECT s.file_url, s.file_name, s.student_name, s.roll_no, s.barcode
       FROM sheets s
       WHERE s.id = $1`,
      [sheetId],
    );

    const sheetData = sheetDataResult.rows[0] || {};

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update marks in sheets
      if (marks !== undefined && marks !== null) {
        await client.query(
          `UPDATE sheets SET marks = $1, updated_at = NOW() WHERE id = $2`,
          [marks, sheetId],
        );
      }

      // Update sheets status with rechecker's time
      await client.query(
        `UPDATE sheets 
         SET status = 'rechecked', 
             checking_time_spent = COALESCE($1, checking_time_spent, 0),
             updated_at = NOW() 
         WHERE id = $2`,
        [timeSpent || 0, sheetId],
      );

      // ✅ Update recheck request status to 'completed'
      let updateQuery = `
        UPDATE recheck_requests 
        SET status = 'completed', 
            resolved_by = $1, 
            resolved_at = NOW(),
            remarks = COALESCE($2, remarks),
            time_spent = COALESCE($3, time_spent, 0),
            updated_at = NOW()
      `;
      let queryParams = [userId, remarks, timeSpent || 0];
      let paramCount = 4;

      if (finalMarksRule) {
        updateQuery += `, final_marks_rule = $${paramCount}`;
        queryParams.push(finalMarksRule);
        paramCount++;
      }

      updateQuery += ` WHERE id = $${paramCount} RETURNING *`;
      queryParams.push(id);

      const recheckResult = await client.query(updateQuery, queryParams);

      // ✅ Save recheck markings with notes
      const existing = await client.query(
        `SELECT id FROM recheck_markings WHERE recheck_request_id = $1 AND checker_id = $2`,
        [id, userId],
      );

      let markingResult;
      if (existing.rows.length > 0) {
        markingResult = await client.query(
          `UPDATE recheck_markings 
           SET marks_data = $1, annotations_data = $2, stamps_data = $3,
               notes_data = $4, total_marks = $5,
               is_draft = false, is_submitted = true,
               submitted_at = NOW(), updated_at = NOW()
           WHERE recheck_request_id = $6 AND checker_id = $7
           RETURNING *`,
          [
            JSON.stringify(marksData || {}),
            JSON.stringify(annotationsData || []),
            JSON.stringify(stampsData || []),
            JSON.stringify(notesData || []),
            marks || 0,
            id,
            userId,
          ],
        );
      } else {
        markingResult = await client.query(
          `INSERT INTO recheck_markings (
            recheck_request_id, sheet_id, checker_id, exam_id,
            marks_data, annotations_data, stamps_data, notes_data, total_marks,
            is_draft, is_submitted, submitted_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, false, true, NOW())
          RETURNING *`,
          [
            id,
            sheetId,
            userId,
            examId,
            JSON.stringify(marksData || {}),
            JSON.stringify(annotationsData || []),
            JSON.stringify(stampsData || []),
            JSON.stringify(notesData || []),
            marks || 0,
          ],
        );
      }

      // CHECKED SHEETS FOLDER MEIN FILE SAVE KARO
      let fileMoved = false;
      let newFilePath = null;
      let checkedFolder = null;

      try {
        const fileNameBase =
          sanitizeForFolderName(sheetData.barcode) || `sheet-${sheetId}`;
        const fileExtension = sheetData.file_name
          ? path.extname(sheetData.file_name)
          : '.pdf';
        const fileName = `${fileNameBase}${fileExtension}`;

        checkedFolder = `checked-sheets`;

        let sourcePath = null;
        const possiblePaths = [
          path.join(UPLOADS_DIR, 'sheets', sheetData.file_name || fileName),
          path.join(UPLOADS_DIR, sheetData.file_name || fileName),
          path.join(
            UPLOADS_DIR,
            'uploads',
            'sheets',
            sheetData.file_name || fileName,
          ),
          path.join(UPLOADS_DIR, 'checked-sheets', fileName),
        ];

        for (const p of possiblePaths) {
          if (fs.existsSync(p)) {
            sourcePath = p;
            break;
          }
        }

        if (sourcePath) {
          const destPath = path.join(UPLOADS_DIR, checkedFolder, fileName);
          const dir = path.dirname(destPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          fs.copyFileSync(sourcePath, destPath);
          fileMoved = true;
          newFilePath = `/${checkedFolder}/${fileName}`;
        }
      } catch (err) {
        console.error(`❌ File copy error:`, err.message);
      }

      // Update sheet file_url if moved
      const finalFileUrl = fileMoved ? newFilePath : sheetData.file_url;

      await client.query(
        `UPDATE sheets 
         SET file_url = COALESCE($1, file_url),
             archived_folder = COALESCE($2, archived_folder)
         WHERE id = $3`,
        [finalFileUrl, checkedFolder, sheetId],
      );

      // Get sheet data for response
      const sheetInfo = await client.query(
        `SELECT 
          s.id,
          s.student_name,
          s.roll_no,
          s.barcode,
          s.marks,
          s.status,
          s.checking_time_spent,
          s.file_url,
          s.archived_folder,
          e.name AS exam_name,
          e.subject AS exam_subject,
          e."maxMarks" AS total_marks
         FROM sheets s
         LEFT JOIN exams e ON s.exam_id = e.id
         WHERE s.id = $1`,
        [sheetId],
      );

      // Get checker info
      const checkerInfo = await client.query(
        `SELECT u.name, u.email FROM users u WHERE u.id = $1`,
        [userId],
      );

      // Get original checker markings
      const originalMarkings = await client.query(
        `SELECT marks_data, total_marks 
         FROM checker_markings 
         WHERE sheet_id = $1 AND is_submitted = true
         ORDER BY submitted_at DESC LIMIT 1`,
        [sheetId],
      );

      let originalTotal = 0;
      if (originalMarkings.rows.length > 0) {
        const origData = originalMarkings.rows[0].marks_data || {};
        originalTotal = Object.values(origData).reduce((a, b) => a + b, 0);
      }

      await client.query('COMMIT');

      return res.status(200).json({
        success: true,
        message: 'Recheck completed successfully',
        data: {
          recheck: {
            id: recheckResult.rows[0].id,
            sheet_id: recheckResult.rows[0].sheet_id,
            exam_id: recheckResult.rows[0].exam_id,
            status: recheckResult.rows[0].status,
            remarks: recheckResult.rows[0].remarks,
            time_spent: recheckResult.rows[0].time_spent,
            resolved_by: recheckResult.rows[0].resolved_by,
            resolved_at: recheckResult.rows[0].resolved_at,
            final_marks_rule: recheckResult.rows[0].final_marks_rule,
          },
          sheet: sheetInfo.rows[0] || null,
          completed_by: checkerInfo.rows[0] || null,
          marks_comparison: {
            original_total: originalTotal,
            recheck_total: marks || 0,
            final_marks: marks || 0,
            final_marks_rule: finalMarksRule || 'higher',
          },
          recheck_markings: {
            id: markingResult.rows[0].id,
            marks_data: markingResult.rows[0].marks_data || {},
            annotations_data: markingResult.rows[0].annotations_data || [],
            stamps_data: markingResult.rows[0].stamps_data || [],
            notes_data: markingResult.rows[0].notes_data || [],
            total_marks: markingResult.rows[0].total_marks,
            submitted_at: markingResult.rows[0].submitted_at,
          },
          file: {
            file_url: finalFileUrl,
            archived_folder: checkedFolder,
            file_moved: fileMoved,
            new_file_path: newFilePath,
          },
          summary: {
            student: sheetInfo.rows[0]?.student_name || 'Unknown',
            roll_no: sheetInfo.rows[0]?.roll_no || '—',
            exam: sheetInfo.rows[0]?.exam_name || 'Unknown',
            subject: sheetInfo.rows[0]?.exam_subject || '—',
            status: 'rechecked',
            total_marks: sheetInfo.rows[0]?.total_marks || 0,
          },
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('completeRecheck error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to complete recheck',
      error: error.message,
    });
  }
};

// ─── SAVE RECHECK DRAFT ─────────────────────────────────────────

export const saveRecheckDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      marksData,
      annotationsData,
      stampsData,
      notesData,
      totalMarks,
      remarks,
      timeSpent,
    } = req.body;

    // ✅ FIX: Sirf 'assigned' status allow karo
    const checkResult = await pool.query(
      `SELECT sheet_id, exam_id FROM recheck_requests 
       WHERE id = $1 AND assign_to = $2 
       AND status = 'assigned'`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message:
          'Recheck request not found, not assigned to you, or already processed',
      });
    }

    const { sheet_id: sheetId, exam_id: examId } = checkResult.rows[0];

    const existing = await pool.query(
      `SELECT id FROM recheck_markings WHERE recheck_request_id = $1 AND checker_id = $2`,
      [id, userId],
    );

    let result;
    if (existing.rows.length > 0) {
      result = await pool.query(
        `UPDATE recheck_markings 
         SET marks_data = $1, annotations_data = $2, stamps_data = $3,
             notes_data = $4, total_marks = $5, remarks = $6,
             is_draft = true, updated_at = CURRENT_TIMESTAMP
         WHERE recheck_request_id = $7 AND checker_id = $8
         RETURNING *`,
        [
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          JSON.stringify(notesData || []),
          totalMarks || 0,
          remarks || null,
          id,
          userId,
        ],
      );

      if (timeSpent !== undefined) {
        await pool.query(
          `UPDATE recheck_requests 
           SET time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, id],
        );
      }

      if (timeSpent !== undefined && sheetId) {
        await pool.query(
          `UPDATE sheets 
           SET checking_time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, sheetId],
        );
      }
    } else {
      result = await pool.query(
        `INSERT INTO recheck_markings (
          recheck_request_id, sheet_id, checker_id, exam_id,
          marks_data, annotations_data, stamps_data, notes_data,
          total_marks, remarks, is_draft
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
        RETURNING *`,
        [
          id,
          sheetId,
          userId,
          examId,
          JSON.stringify(marksData || {}),
          JSON.stringify(annotationsData || []),
          JSON.stringify(stampsData || []),
          JSON.stringify(notesData || []),
          totalMarks || 0,
          remarks || null,
        ],
      );

      if (timeSpent !== undefined) {
        await pool.query(
          `UPDATE recheck_requests 
           SET time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, id],
        );
      }

      if (timeSpent !== undefined && sheetId) {
        await pool.query(
          `UPDATE sheets 
           SET checking_time_spent = $1, updated_at = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [timeSpent, sheetId],
        );
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck draft saved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('saveRecheckDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to save recheck draft',
      error: error.message,
    });
  }
};

// ─── GET RECHECK DRAFT ───────────────────────────────────────────

export const getRecheckDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT 
        rm.*,
        rr.time_spent
       FROM recheck_markings rm
       JOIN recheck_requests rr ON rm.recheck_request_id = rr.id
       WHERE rm.recheck_request_id = $1 AND rm.checker_id = $2`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No draft found for this recheck request',
        data: null,
      });
    }

    const row = result.rows[0];
    return res.status(200).json({
      success: true,
      message: 'Recheck draft retrieved successfully',
      data: {
        id: row.id,
        marks_data: row.marks_data || {},
        annotations_data: row.annotations_data || [],
        stamps_data: row.stamps_data || [],
        notes_data: row.notes_data || [],
        total_marks: row.total_marks,
        remarks: row.remarks,
        is_draft: row.is_draft,
        is_submitted: row.is_submitted,
        time_spent: row.time_spent || 0,
      },
    });
  } catch (error) {
    console.error('getRecheckDraft error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get recheck draft',
      error: error.message,
    });
  }
};

// ─── ESCALATE RECHECK REQUEST ──────────────────────────────────────

export const escalateRecheckRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason, escalateType, remarks, timeSpent } = req.body;

    if (!reason) {
      return res.status(400).json({
        success: false,
        message: 'Reason is required for escalation',
      });
    }

    const checkResult = await pool.query(
      `SELECT rr.id, rr.sheet_id, rr.status
       FROM recheck_requests rr
       WHERE rr.id = $1 AND rr.assign_to = $2 
       AND rr.status IN ('assigned')`,
      [id, userId],
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found or not assigned to you',
      });
    }

    const sheetId = checkResult.rows[0].sheet_id;

    await pool.query(
      `UPDATE recheck_requests 
       SET status = 'escalated',
           escalate_reason = $1,
           escalate_type = $2,
           escalate_remarks = $3,
           escalated_by = $4,
           escalated_at = CURRENT_TIMESTAMP,
           time_spent = COALESCE($5, time_spent, 0),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [
        reason,
        escalateType || 'other',
        remarks || null,
        userId,
        timeSpent || 0,
        id,
      ],
    );

    if (sheetId) {
      await pool.query(
        `UPDATE sheets 
         SET status = 'escalated',
             escalate_reason = $1,
             escalate_type = $2,
             escalate_remarks = $3,
             escalated_by = $4,
             escalated_at = CURRENT_TIMESTAMP,
             checking_time_spent = COALESCE($5, checking_time_spent, 0),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $6`,
        [
          reason,
          escalateType || 'other',
          remarks || null,
          userId,
          timeSpent || 0,
          sheetId,
        ],
      );
    }

    return res.status(200).json({
      success: true,
      message: 'Recheck request escalated successfully',
      data: {
        time_spent: timeSpent || 0,
      },
    });
  } catch (error) {
    console.error('escalateRecheckRequest error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to escalate recheck request',
      error: error.message,
    });
  }
};

// ─── GET RECHECKED SHEET BY ID ──────────────────────────────────

export const getRecheckedSheetById = async (req, res) => {
  try {
    const { id } = req.params;

    let result = await pool.query(
      `SELECT 
        rr.id,
        rr.sheet_id,
        rr.exam_id,
        rr.reason,
        rr.assign_to,
        rr.status,
        rr.requested_by,
        rr.resolved_by,
        rr.resolved_at,
        rr.remarks,
        rr.created_at,
        rr.updated_at,
        rr.time_spent,
        rr.final_marks_rule,
        rr.escalate_reason,
        rr.escalate_type,
        rr.escalate_remarks,
        rr.escalated_by,
        rr.escalated_at,
        s.student_name,
        s.roll_no,
        s.barcode,
        s.file_name,
        s.file_url,
        s.marks AS current_marks,
        s.status AS sheet_status,
        e.name AS exam_name,
        e.subject AS exam_subject,
        u.name AS requested_by_name,
        u2.name AS resolved_by_name,
        rm.marks_data AS recheck_marks_data,
        rm.annotations_data AS recheck_annotations,
        rm.stamps_data AS recheck_stamps,
        rm.notes_data AS recheck_notes_data,
        rm.total_marks AS recheck_total_marks,
        rm.submitted_at AS recheck_submitted_at
      FROM recheck_requests rr
      LEFT JOIN sheets s ON rr.sheet_id = s.id
      LEFT JOIN exams e ON rr.exam_id = e.id
      LEFT JOIN users u ON rr.requested_by = u.id
      LEFT JOIN users u2 ON rr.resolved_by = u2.id
      LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id AND rm.is_submitted = true
      WHERE rr.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      result = await pool.query(
        `SELECT 
          rr.id,
          rr.sheet_id,
          rr.exam_id,
          rr.reason,
          rr.assign_to,
          rr.status,
          rr.requested_by,
          rr.resolved_by,
          rr.resolved_at,
          rr.remarks,
          rr.created_at,
          rr.updated_at,
          rr.time_spent,
          rr.final_marks_rule,
          rr.escalate_reason,
          rr.escalate_type,
          rr.escalate_remarks,
          rr.escalated_by,
          rr.escalated_at,
          s.student_name,
          s.roll_no,
          s.barcode,
          s.file_name,
          s.file_url,
          s.marks AS current_marks,
          s.status AS sheet_status,
          e.name AS exam_name,
          e.subject AS exam_subject,
          u.name AS requested_by_name,
          u2.name AS resolved_by_name,
          rm.marks_data AS recheck_marks_data,
          rm.annotations_data AS recheck_annotations,
          rm.stamps_data AS recheck_stamps,
          rm.notes_data AS recheck_notes_data,
          rm.total_marks AS recheck_total_marks,
          rm.submitted_at AS recheck_submitted_at
        FROM recheck_requests rr
        LEFT JOIN sheets s ON rr.sheet_id = s.id
        LEFT JOIN exams e ON rr.exam_id = e.id
        LEFT JOIN users u ON rr.requested_by = u.id
        LEFT JOIN users u2 ON rr.resolved_by = u2.id
        LEFT JOIN recheck_markings rm ON rm.recheck_request_id = rr.id AND rm.is_submitted = true
        WHERE rr.sheet_id = $1 AND rr.status = 'completed'
        ORDER BY rr.resolved_at DESC
        LIMIT 1`,
        [id],
      );
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Recheck request not found',
      });
    }

    const request = result.rows[0];

    let originalMarks = {};
    let originalAnnotations = [];
    let originalStamps = [];

    if (request.sheet_id) {
      const originalMarksResult = await pool.query(
        `SELECT marks_data, annotations_data, stamps_data, total_marks 
         FROM checker_markings 
         WHERE sheet_id = $1 AND is_submitted = true
         ORDER BY submitted_at DESC LIMIT 1`,
        [request.sheet_id],
      );

      if (originalMarksResult.rows.length > 0) {
        originalMarks = originalMarksResult.rows[0].marks_data || {};
        originalAnnotations =
          originalMarksResult.rows[0].annotations_data || [];
        originalStamps = originalMarksResult.rows[0].stamps_data || [];
      }
    }

    const baseUrl = process.env.API_URL || 'https://osmapi.digiindiasolutions.com';
    const buildFullUrl = (path) => {
      if (!path) return null;
      if (path.startsWith('http://') || path.startsWith('https://'))
        return path;
      if (path.startsWith('/uploads')) return `${baseUrl}${path}`;
      return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    };

    const markSchemeResult = await pool.query(
      `SELECT "questionName", "maxMarks", guidelines 
       FROM mark_schemes 
       WHERE "examId" = $1`,
      [request.exam_id],
    );

    const markScheme = {};
    markSchemeResult.rows.forEach((row) => {
      markScheme[row.questionName] = {
        maxMarks: row.maxMarks,
        guidelines: row.guidelines,
      };
    });

    const pdfsResult = await pool.query(
      `SELECT model_answer_pdf, question_paper_pdf 
       FROM mark_schemes 
       WHERE "examId" = $1 
       LIMIT 1`,
      [request.exam_id],
    );

    const pdfs = pdfsResult.rows[0] || {};

    return res.status(200).json({
      success: true,
      message: 'Rechecked sheet retrieved successfully',
      data: {
        request: {
          id: request.id,
          sheet_id: request.sheet_id,
          exam_id: request.exam_id,
          reason: request.reason,
          status: request.status,
          finalMarksRule: request.final_marks_rule || 'higher',
          created_at: request.created_at,
          resolved_at: request.resolved_at,
          time_spent: request.time_spent || 0,
          resolved_by_name: request.resolved_by_name,
          requested_by_name: request.requested_by_name,
          remarks: request.remarks,
          assign_to: request.assign_to,
        },
        sheet: {
          id: request.sheet_id,
          student_name: request.student_name,
          roll_no: request.roll_no,
          barcode: request.barcode,
          file_name: request.file_name,
          file_url: buildFullUrl(request.file_url),
          current_marks: request.current_marks,
          status: request.sheet_status,
        },
        exam: {
          id: request.exam_id,
          name: request.exam_name,
          subject: request.exam_subject,
        },
        markScheme: markScheme,
        originalMarks: originalMarks,
        originalAnnotations: originalAnnotations,
        originalStamps: originalStamps,
        recheckMarks: request.recheck_marks_data || {},
        recheckAnnotations: request.recheck_annotations || [],
        recheckStamps: request.recheck_stamps || [],
        recheckNotes: request.recheck_notes_data || [],
        recheckTotalMarks: request.recheck_total_marks || 0,
        recheckSubmittedAt: request.recheck_submitted_at,
        pdfs: {
          model_answer: buildFullUrl(pdfs.model_answer_pdf),
          question_paper: buildFullUrl(pdfs.question_paper_pdf),
        },
        summary: {
          student: request.student_name,
          roll_no: request.roll_no,
          exam: request.exam_name,
          subject: request.exam_subject,
          status: request.status,
          original_total: Object.values(originalMarks).reduce(
            (a, b) => a + b,
            0,
          ),
          recheck_total: request.recheck_total_marks || 0,
          final_marks: request.current_marks,
        },
      },
    });
  } catch (error) {
    console.error('getRecheckedSheetById error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get rechecked sheet',
      error: error.message,
    });
  }
};
