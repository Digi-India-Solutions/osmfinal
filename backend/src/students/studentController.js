// src/students/studentController.js
import { connectDB } from '../pool.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── HELPERS ────────────────────────────────────────────────────

// Normalize column names (convert to lowercase and remove spaces)
const normalizeColumnName = (name) => {
  if (!name) return '';
  return name
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
};

// Map Excel columns to database fields (with exam_id support)
const mapRowToRecord = (row) => {
  const normalizedRow = {};
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeColumnName(key);
    normalizedRow[normalizedKey] = value;
  }

  const rollNo =
    normalizedRow['roll_no'] ||
    normalizedRow['roll'] ||
    normalizedRow['rollnumber'] ||
    normalizedRow['rollnumber'];
  const studentName =
    normalizedRow['student_name'] ||
    normalizedRow['studentname'] ||
    normalizedRow['name'] ||
    normalizedRow['student'];
  const course =
    normalizedRow['course'] ||
    normalizedRow['program'] ||
    normalizedRow['programme'];
  const branch =
    normalizedRow['branch'] ||
    normalizedRow['department'] ||
    normalizedRow['dept'];
  const semester =
    normalizedRow['sem'] ||
    normalizedRow['semester'] ||
    normalizedRow['semester_no'] ||
    normalizedRow['semno'];
  const subject =
    normalizedRow['subject'] ||
    normalizedRow['sub'] ||
    normalizedRow['subject_name'] ||
    normalizedRow['subjectname'];
  const barcode =
    normalizedRow['barcode'] ||
    normalizedRow['bar_code'] ||
    normalizedRow['barcode_no'] ||
    normalizedRow['barcodeno'];

  // ✅ Exam ID support (UUID)
  const examId =
    normalizedRow['exam_id'] ||
    normalizedRow['examid'] ||
    normalizedRow['exam'] ||
    normalizedRow['exam_no'] ||
    normalizedRow['examnumber'] ||
    null;

  return {
    roll_no: rollNo,
    student_name: studentName,
    course: course,
    branch: branch,
    semester: semester,
    subject: subject,
    barcode: barcode,
    exam_id: examId, // ✅ Keep as string (UUID)
  };
};

const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  return data;
};

const validateStudentRecord = (row) => {
  const required = [
    'roll_no',
    'student_name',
    'course',
    'branch',
    'semester',
    'subject',
    'barcode',
  ];
  for (const field of required) {
    const value = row[field];
    if (
      value === undefined ||
      value === null ||
      value.toString().trim() === ''
    ) {
      return { valid: false, error: `Missing field: ${field}` };
    }
  }
  return { valid: true };
};

// ✅ Validate UUID format
const isValidUUID = (uuid) => {
  if (!uuid) return true; // null is valid
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

// ─── UPLOAD AND PREVIEW ────────────────────────────────────────

export const uploadAndPreview = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
      });
    }

    const filePath = req.file.path;
    const rawData = parseExcelFile(filePath);

    if (!rawData || rawData.length === 0) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        success: false,
        message: 'File is empty or invalid format',
      });
    }

    const mappedData = rawData.map((row) => mapRowToRecord(row));

    const errors = [];
    const validRecords = [];
    const barcodes = new Set();

    for (let i = 0; i < mappedData.length; i++) {
      const row = mappedData[i];
      const validation = validateStudentRecord(row);

      if (!validation.valid) {
        errors.push({ row: i + 2, error: validation.error, data: row });
        continue;
      }

      if (barcodes.has(row.barcode.toString())) {
        errors.push({ row: i + 2, error: `Duplicate barcode: ${row.barcode}` });
        continue;
      }
      barcodes.add(row.barcode.toString());

      // ✅ Parse exam_id if exists (UUID format)
      let examId = null;
      if (row.exam_id) {
        const examIdStr = row.exam_id.toString().trim();
        if (isValidUUID(examIdStr)) {
          examId = examIdStr;
        } else {
          errors.push({
            row: i + 2,
            error: `Invalid exam_id format: ${examIdStr}. Must be a valid UUID.`,
          });
          continue;
        }
      }

      validRecords.push({
        roll_no: row.roll_no.toString(),
        student_name: row.student_name.toString(),
        course: row.course.toString(),
        branch: row.branch.toString(),
        semester: parseInt(row.semester),
        subject: row.subject.toString(),
        barcode: row.barcode.toString(),
        exam_id: examId, // ✅ UUID as string
        sheet_status: 'pending',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'File uploaded successfully',
      data: {
        fileName: req.file.originalname,
        totalRecords: rawData.length,
        validRecords: validRecords.length,
        errors: errors,
        preview: validRecords.slice(0, 20),
      },
      filePath: req.file.path,
    });
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({
      success: false,
      message: 'Failed to process file',
      error: error.message,
    });
  }
};

// ─── IMPORT STUDENTS ────────────────────────────────────────────

export const importStudents = async (req, res) => {
  const { filePath } = req.body;

  try {
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(400).json({
        success: false,
        message: 'File not found',
      });
    }

    const rawData = parseExcelFile(filePath);

    if (!rawData || rawData.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No data to import',
      });
    }

    const mappedData = rawData.map((row) => mapRowToRecord(row));

    const client = await connectDB.connect();
    let importedCount = 0;
    let skippedCount = 0;
    const errors = [];

    try {
      await client.query('BEGIN');

      for (const row of mappedData) {
        try {
          const validation = validateStudentRecord(row);
          if (!validation.valid) {
            skippedCount++;
            errors.push({ row: row, error: validation.error });
            continue;
          }

          const existing = await client.query(
            `SELECT id FROM student_records WHERE barcode = $1`,
            [row.barcode.toString()],
          );

          if (existing.rows.length > 0) {
            skippedCount++;
            continue;
          }

          // ✅ Parse exam_id if exists (UUID format)
          let examId = null;
          if (row.exam_id) {
            const examIdStr = row.exam_id.toString().trim();
            if (isValidUUID(examIdStr)) {
              examId = examIdStr;
            } else {
              errors.push({
                row: row,
                error: `Invalid exam_id format: ${examIdStr}. Must be a valid UUID.`,
              });
              skippedCount++;
              continue;
            }
          }

          await client.query(
            `INSERT INTO student_records (
              roll_no, student_name, course, branch, semester, 
              subject, barcode, exam_id, sheet_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              row.roll_no.toString(),
              row.student_name.toString(),
              row.course.toString(),
              row.branch.toString(),
              parseInt(row.semester),
              row.subject.toString(),
              row.barcode.toString(),
              examId, // ✅ UUID as string
              'pending',
            ],
          );
          importedCount++;
        } catch (err) {
          errors.push({ row: row, error: err.message });
        }
      }

      await client.query('COMMIT');

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      return res.status(200).json({
        success: true,
        message: `Imported ${importedCount} students successfully`,
        data: {
          imported: importedCount,
          skipped: skippedCount,
          errors: errors,
        },
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Import error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import students',
      error: error.message,
    });
  }
};

// ─── GET ALL STUDENTS (WITH EXAM NAME - SUBJECT MATCH) ────────


export const getStudents = async (req, res) => {
  try {
    const {
      search = '',
      subject = '',
      semester = '',
      branch = '',
      page = 1,
      limit = 50,
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (search) {
      conditions.push(
        `(s.roll_no ILIKE $${paramCount} OR s.student_name ILIKE $${paramCount})`,
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    if (subject) {
      conditions.push(`s.subject = $${paramCount}`);
      params.push(subject);
      paramCount++;
    }

    if (semester) {
      conditions.push(`s.semester = $${paramCount}`);
      params.push(parseInt(semester));
      paramCount++;
    }

    if (branch) {
      conditions.push(`s.branch = $${paramCount}`);
      params.push(branch);
      paramCount++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countResult = await connectDB.query(
      `SELECT COUNT(*)::int AS total FROM student_records s ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    // ✅ Get data with exam name - JOIN only if exam subject matches student subject
    const result = await connectDB.query(
      `SELECT 
        s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester, 
        s.subject, s.barcode, s.exam_id, s.sheet_status,
        s.created_at, s.updated_at,
        e.name AS exam_name
      FROM student_records s
      LEFT JOIN exams e ON s.exam_id = e.id AND e.subject = s.subject
      ${whereClause}
      ORDER BY s.id ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), offset],
    );

    // Get stats
    const statsResult = await connectDB.query(
      `SELECT 
        COUNT(*) AS total,
        COUNT(DISTINCT subject) AS subjects,
        COUNT(DISTINCT semester) AS semesters,
        COUNT(DISTINCT branch) AS branches,
        COUNT(*) FILTER (WHERE sheet_status = 'uploaded') AS uploaded,
        COUNT(*) FILTER (WHERE sheet_status = 'pending') AS pending,
        COUNT(*) FILTER (WHERE sheet_status = 'checking') AS checking,
        COUNT(*) FILTER (WHERE sheet_status = 'checked') AS checked,
        COUNT(*) FILTER (WHERE sheet_status = 'recheck') AS recheck,
        COUNT(*) FILTER (WHERE exam_id IS NOT NULL) AS linked_to_exam
      FROM student_records`,
    );
    const stats = statsResult.rows[0];

    // Subject wise count
    const subjectResult = await connectDB.query(
      `SELECT subject, COUNT(*) AS count 
       FROM student_records 
       GROUP BY subject 
       ORDER BY count DESC`,
    );

    return res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        items: result.rows,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
        stats: {
          total: parseInt(stats.total || 0),
          subjects: parseInt(stats.subjects || 0),
          semesters: parseInt(stats.semesters || 0),
          branches: parseInt(stats.branches || 0),
          uploaded: parseInt(stats.uploaded || 0),
          pending: parseInt(stats.pending || 0),
          checking: parseInt(stats.checking || 0),
          checked: parseInt(stats.checked || 0),
          recheck: parseInt(stats.recheck || 0),
          linkedToExam: parseInt(stats.linked_to_exam || 0),
        },
        subjectWise: subjectResult.rows,
      },
    });
  } catch (error) {
    console.error('Get students error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get students',
      error: error.message,
    });
  }
};

// ─── GET STUDENT BY ID ─────────────────────────────────────────

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `SELECT 
        s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester, 
        s.subject, s.barcode, s.exam_id, s.sheet_status,
        s.created_at, s.updated_at,
        e.name AS exam_name
      FROM student_records s
      LEFT JOIN exams e ON s.exam_id = e.id AND e.subject = s.subject
      WHERE s.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Student retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get student',
      error: error.message,
    });
  }
};

// ─── UPDATE STUDENT ─────────────────────────────────────────────

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      roll_no,
      student_name,
      course,
      branch,
      semester,
      subject,
      barcode,
      exam_id,
      sheet_status,
    } = req.body;

    const existing = await connectDB.query(
      `SELECT id FROM student_records WHERE id = $1`,
      [id],
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    const result = await connectDB.query(
      `UPDATE student_records 
       SET 
         roll_no = COALESCE($1, roll_no),
         student_name = COALESCE($2, student_name),
         course = COALESCE($3, course),
         branch = COALESCE($4, branch),
         semester = COALESCE($5, semester),
         subject = COALESCE($6, subject),
         barcode = COALESCE($7, barcode),
         exam_id = COALESCE($8, exam_id),
         sheet_status = COALESCE($9, sheet_status),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [
        roll_no,
        student_name,
        course,
        branch,
        semester,
        subject,
        barcode,
        exam_id,
        sheet_status,
        id,
      ],
    );

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message,
    });
  }
};

// ─── DELETE STUDENT ─────────────────────────────────────────────

export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `DELETE FROM student_records WHERE id = $1 RETURNING id`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Student deleted successfully',
    });
  } catch (error) {
    console.error('Delete student error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message,
    });
  }
};

// ─── BULK DELETE STUDENTS ──────────────────────────────────────

export const bulkDeleteStudents = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of student IDs to delete',
      });
    }

    const result = await connectDB.query(
      `DELETE FROM student_records WHERE id = ANY($1::int[]) RETURNING id`,
      [ids],
    );

    return res.status(200).json({
      success: true,
      message: `${result.rows.length} students deleted successfully`,
      data: {
        deletedCount: result.rows.length,
        deletedIds: result.rows.map((row) => row.id),
      },
    });
  } catch (error) {
    console.error('Bulk delete error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete students',
      error: error.message,
    });
  }
};
