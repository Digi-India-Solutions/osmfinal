// // src/students/studentController.js

// import pool from '../pool.js';
// import XLSX from 'xlsx';
// import fs from 'fs';
// import path from 'path';
// import { fileURLToPath } from 'url';

// const __filename = fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // ─── HELPERS ────────────────────────────────────────────────────

// // Normalize column names (convert to lowercase and remove spaces)
// const normalizeColumnName = (name) => {
//   if (!name) return '';
//   return name
//     .toString()
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, '_')
//     .replace(/[^a-z0-9_]/g, '');
// };

// // Map Excel columns to database fields
// const mapRowToRecord = (row) => {
//   const normalizedRow = {};
//   for (const [key, value] of Object.entries(row)) {
//     const normalizedKey = normalizeColumnName(key);
//     normalizedRow[normalizedKey] = value;
//   }

//   const rollNo =
//     normalizedRow['roll_no'] ||
//     normalizedRow['roll'] ||
//     normalizedRow['rollnumber'];
//   const studentName =
//     normalizedRow['student_name'] ||
//     normalizedRow['studentname'] ||
//     normalizedRow['name'] ||
//     normalizedRow['student'];
//   const course =
//     normalizedRow['course'] ||
//     normalizedRow['program'] ||
//     normalizedRow['programme'];
//   const branch =
//     normalizedRow['branch'] ||
//     normalizedRow['department'] ||
//     normalizedRow['dept'];
//   const semester =
//     normalizedRow['sem'] ||
//     normalizedRow['semester'] ||
//     normalizedRow['semester_no'] ||
//     normalizedRow['semno'];
//   const subject =
//     normalizedRow['subject'] ||
//     normalizedRow['sub'] ||
//     normalizedRow['subject_name'] ||
//     normalizedRow['subjectname'];
//   const barcode =
//     normalizedRow['barcode'] ||
//     normalizedRow['bar_code'] ||
//     normalizedRow['barcode_no'] ||
//     normalizedRow['barcodeno'];

//   const examName =
//     normalizedRow['exam'] ||
//     normalizedRow['exam_name'] ||
//     normalizedRow['examname'] ||
//     normalizedRow['exam_id'] ||
//     null;

//   return {
//     roll_no: rollNo,
//     student_name: studentName,
//     course: course,
//     branch: branch,
//     semester: semester,
//     subject: subject,
//     barcode: barcode,
//     exam_name: examName,
//   };
// };

// const getExamIdByNameAndSubject = async (examName, subject) => {
//   if (!examName) return null;

//   try {
//     const result = await pool.query(
//       `SELECT id FROM exams WHERE name = $1 AND subject = $2`,
//       [examName, subject],
//     );
//     return result.rows[0]?.id || null;
//   } catch (error) {
//     console.error('Error finding exam:', error);
//     return null;
//   }
// };

// const parseExcelFile = (filePath) => {
//   const workbook = XLSX.readFile(filePath);
//   const sheetName = workbook.SheetNames[0];
//   const worksheet = workbook.Sheets[sheetName];
//   const data = XLSX.utils.sheet_to_json(worksheet);
//   return data;
// };

// const validateStudentRecord = (row) => {
//   const required = [
//     'roll_no',
//     'student_name',
//     'course',
//     'branch',
//     'semester',
//     'subject',
//     'barcode',
//   ];
//   for (const field of required) {
//     const value = row[field];
//     if (
//       value === undefined ||
//       value === null ||
//       value.toString().trim() === ''
//     ) {
//       return { valid: false, error: `Missing field: ${field}` };
//     }
//   }
//   return { valid: true };
// };

// // ─── UPLOAD AND PREVIEW ────────────────────────────────────────

// export const uploadAndPreview = async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({
//         success: false,
//         message: 'No file uploaded',
//       });
//     }

//     const filePath = req.file.path;
//     const rawData = parseExcelFile(filePath);

//     if (!rawData || rawData.length === 0) {
//       fs.unlinkSync(filePath);
//       return res.status(400).json({
//         success: false,
//         message: 'File is empty or invalid format',
//       });
//     }

//     const mappedData = rawData.map((row) => mapRowToRecord(row));

//     const errors = [];
//     const validRecords = [];
//     const barcodes = new Set();

//     const examsResult = await pool.query(`SELECT id, name, subject FROM exams`);
//     const examMap = {};
//     examsResult.rows.forEach((exam) => {
//       const key = `${exam.name}|${exam.subject}`;
//       examMap[key] = exam.id;
//     });

//     for (let i = 0; i < mappedData.length; i++) {
//       const row = mappedData[i];
//       const validation = validateStudentRecord(row);

//       if (!validation.valid) {
//         errors.push({ row: i + 2, error: validation.error, data: row });
//         continue;
//       }

//       if (barcodes.has(row.barcode.toString())) {
//         errors.push({ row: i + 2, error: `Duplicate barcode: ${row.barcode}` });
//         continue;
//       }
//       barcodes.add(row.barcode.toString());

//       let examId = null;
//       let examName = row.exam_name;

//       if (examName) {
//         const key = `${examName}|${row.subject}`;
//         examId = examMap[key] || null;

//         if (!examId) {
//           errors.push({
//             row: i + 2,
//             error: `Exam "${examName}" not found for subject "${row.subject}"`,
//           });
//           continue;
//         }
//       }

//       validRecords.push({
//         roll_no: row.roll_no.toString(),
//         student_name: row.student_name.toString(),
//         course: row.course.toString(),
//         branch: row.branch.toString(),
//         semester: parseInt(row.semester),
//         subject: row.subject.toString(),
//         barcode: row.barcode.toString(),
//         exam_id: examId,
//         exam_name: examName,
//         sheet_status: 'pending',
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'File uploaded successfully',
//       data: {
//         fileName: req.file.originalname,
//         totalRecords: rawData.length,
//         validRecords: validRecords.length,
//         errors: errors,
//         preview: validRecords.slice(0, 20),
//       },
//       filePath: req.file.path,
//     });

//   } catch (error) {
//     console.error('Upload error:', error);
//     if (req.file && fs.existsSync(req.file.path)) {
//       fs.unlinkSync(req.file.path);
//     }
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to process file',
//       error: error.message,
//     });
//   }
// };

// // ─── IMPORT STUDENTS ────────────────────────────────────────────

// export const importStudents = async (req, res) => {
//   const { filePath } = req.body;

//   try {
//     if (!filePath || !fs.existsSync(filePath)) {
//       return res.status(400).json({
//         success: false,
//         message: 'File not found',
//       });
//     }

//     const rawData = parseExcelFile(filePath);

//     if (!rawData || rawData.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'No data to import',
//       });
//     }

//     const mappedData = rawData.map((row) => mapRowToRecord(row));

//     const client = await pool.connect();
//     let importedCount = 0;
//     let skippedCount = 0;
//     const errors = [];

//     const examsResult = await client.query(
//       `SELECT id, name, subject FROM exams`,
//     );
//     const examMap = {};
//     examsResult.rows.forEach((exam) => {
//       const key = `${exam.name}|${exam.subject}`;
//       examMap[key] = exam.id;
//     });

//     try {
//       await client.query('BEGIN');

//       for (const row of mappedData) {
//         try {
//           const validation = validateStudentRecord(row);
//           if (!validation.valid) {
//             skippedCount++;
//             errors.push({ row: row, error: validation.error });
//             continue;
//           }

//           const existing = await client.query(
//             `SELECT id FROM student_records WHERE barcode = $1`,
//             [row.barcode.toString()],
//           );

//           if (existing.rows.length > 0) {
//             skippedCount++;
//             continue;
//           }

//           let examId = null;
//           let examName = row.exam_name;

//           if (examName) {
//             const key = `${examName}|${row.subject}`;
//             examId = examMap[key] || null;

//             if (!examId) {
//               errors.push({
//                 row: row,
//                 error: `Exam "${examName}" not found for subject "${row.subject}"`,
//               });
//               skippedCount++;
//               continue;
//             }
//           }

//           await client.query(
//             `INSERT INTO student_records (
//               roll_no, student_name, course, branch, semester, 
//               subject, barcode, exam_id, sheet_status
//             ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
//             [
//               row.roll_no.toString(),
//               row.student_name.toString(),
//               row.course.toString(),
//               row.branch.toString(),
//               parseInt(row.semester),
//               row.subject.toString(),
//               row.barcode.toString(),
//               examId,
//               'pending',
//             ],
//           );
//           importedCount++;
//         } catch (err) {
//           errors.push({ row: row, error: err.message });
//         }
//       }

//       await client.query('COMMIT');

//       if (fs.existsSync(filePath)) {
//         fs.unlinkSync(filePath);
//       }

//       return res.status(200).json({
//         success: true,
//         message: `Imported ${importedCount} students successfully`,
//         data: {
//           imported: importedCount,
//           skipped: skippedCount,
//           errors: errors,
//         },
//       });
//     } catch (error) {
//       await client.query('ROLLBACK');
//       throw error;
//     } finally {
//       client.release();
//     }
//   } catch (error) {
//     console.error('Import error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to import students',
//       error: error.message,
//     });
//   }
// };

// // ─── GET ALL STUDENTS ──────────────────────────────────────────

// export const getStudents = async (req, res) => {
//   try {
//     const {
//       search = '',
//       subject = '',
//       semester = '',
//       branch = '',
//       page = 1,
//       limit = 50,
//     } = req.query;

//     const offset = (parseInt(page) - 1) * parseInt(limit);
//     const conditions = [];
//     const params = [];
//     let paramCount = 1;

//     if (search) {
//       conditions.push(
//         `(s.roll_no ILIKE $${paramCount} OR s.student_name ILIKE $${paramCount})`,
//       );
//       params.push(`%${search}%`);
//       paramCount++;
//     }

//     if (subject) {
//       conditions.push(`s.subject = $${paramCount}`);
//       params.push(subject);
//       paramCount++;
//     }

//     if (semester) {
//       conditions.push(`s.semester = $${paramCount}`);
//       params.push(parseInt(semester));
//       paramCount++;
//     }

//     if (branch) {
//       conditions.push(`s.branch = $${paramCount}`);
//       params.push(branch);
//       paramCount++;
//     }

//     const whereClause =
//       conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

//     const countResult = await pool.query(
//       `SELECT COUNT(*)::int AS total FROM student_records s ${whereClause}`,
//       params,
//     );
//     const total = countResult.rows[0]?.total || 0;

//     const result = await pool.query(
//       `SELECT 
//         s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester, 
//         s.subject, s.barcode, s.exam_id, s.sheet_status,
//         s.created_at, s.updated_at,
//         e.name AS exam_name,
//         (SELECT COUNT(*) FROM sheets WHERE student_id = s.id) AS sheet_count
//       FROM student_records s
//       LEFT JOIN exams e ON s.exam_id = e.id
//       ${whereClause}
//       ORDER BY s.id ASC
//       LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
//       [...params, parseInt(limit), offset],
//     );

//     const statsResult = await pool.query(
//       `SELECT 
//         COUNT(*) AS total,
//         COUNT(DISTINCT subject) AS subjects,
//         COUNT(DISTINCT semester) AS semesters,
//         COUNT(DISTINCT branch) AS branches,
//         COUNT(*) FILTER (WHERE sheet_status = 'uploaded') AS uploaded,
//         COUNT(*) FILTER (WHERE sheet_status = 'pending') AS pending,
//         COUNT(*) FILTER (WHERE sheet_status = 'checking') AS checking,
//         COUNT(*) FILTER (WHERE sheet_status = 'checked') AS checked,
//         COUNT(*) FILTER (WHERE sheet_status = 'recheck') AS recheck,
//         COUNT(*) FILTER (WHERE exam_id IS NOT NULL) AS linked_to_exam
//       FROM student_records`,
//     );
//     const stats = statsResult.rows[0];

//     const subjectResult = await pool.query(
//       `SELECT subject, COUNT(*) AS count 
//        FROM student_records 
//        GROUP BY subject 
//        ORDER BY count DESC`,
//     );

//     return res.status(200).json({
//       success: true,
//       message: 'Students retrieved successfully',
//       data: {
//         items: result.rows,
//         total: total,
//         page: parseInt(page),
//         limit: parseInt(limit),
//         totalPages: Math.ceil(total / parseInt(limit)),
//         stats: {
//           total: parseInt(stats.total || 0),
//           subjects: parseInt(stats.subjects || 0),
//           semesters: parseInt(stats.semesters || 0),
//           branches: parseInt(stats.branches || 0),
//           uploaded: parseInt(stats.uploaded || 0),
//           pending: parseInt(stats.pending || 0),
//           checking: parseInt(stats.checking || 0),
//           checked: parseInt(stats.checked || 0),
//           recheck: parseInt(stats.recheck || 0),
//           linkedToExam: parseInt(stats.linked_to_exam || 0),
//         },
//         subjectWise: subjectResult.rows,
//       },
//     });
//   } catch (error) {
//     console.error('Get students error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get students',
//       error: error.message,
//     });
//   }
// };

// // ─── GET STUDENT BY ID ─────────────────────────────────────────

// export const getStudentById = async (req, res) => {
//   try {
//     const { id } = req.params;

//     const result = await pool.query(
//       `SELECT 
//         s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester, 
//         s.subject, s.barcode, s.exam_id, s.sheet_status,
//         s.created_at, s.updated_at,
//         e.name AS exam_name,
//         (SELECT COUNT(*) FROM sheets WHERE student_id = s.id) AS sheet_count
//       FROM student_records s
//       LEFT JOIN exams e ON s.exam_id = e.id
//       WHERE s.id = $1`,
//       [id],
//     );

//     if (result.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Student not found',
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       message: 'Student retrieved successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Get student error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get student',
//       error: error.message,
//     });
//   }
// };

// // ─── UPDATE STUDENT ─────────────────────────────────────────────

// export const updateStudent = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const {
//       roll_no,
//       student_name,
//       course,
//       branch,
//       semester,
//       subject,
//       barcode,
//       exam_id,
//       sheet_status,
//     } = req.body;

//     const existing = await pool.query(
//       `SELECT id FROM student_records WHERE id = $1`,
//       [id],
//     );

//     if (existing.rows.length === 0) {
//       return res.status(404).json({
//         success: false,
//         message: 'Student not found',
//       });
//     }

//     const result = await pool.query(
//       `UPDATE student_records 
//        SET 
//          roll_no = COALESCE($1, roll_no),
//          student_name = COALESCE($2, student_name),
//          course = COALESCE($3, course),
//          branch = COALESCE($4, branch),
//          semester = COALESCE($5, semester),
//          subject = COALESCE($6, subject),
//          barcode = COALESCE($7, barcode),
//          exam_id = COALESCE($8, exam_id),
//          sheet_status = COALESCE($9, sheet_status),
//          updated_at = CURRENT_TIMESTAMP
//        WHERE id = $10
//        RETURNING *`,
//       [
//         roll_no,
//         student_name,
//         course,
//         branch,
//         semester,
//         subject,
//         barcode,
//         exam_id,
//         sheet_status,
//         id,
//       ],
//     );

//     return res.status(200).json({
//       success: true,
//       message: 'Student updated successfully',
//       data: result.rows[0],
//     });
//   } catch (error) {
//     console.error('Update student error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to update student',
//       error: error.message,
//     });
//   }
// };

// // ─── AUTO-LINK STUDENTS TO EXAMS ──────────────────────────────

// export const autoLinkStudentsToExams = async (req, res) => {
//   try {
//     const client = await pool.connect();
//     let linkedCount = 0;

//     try {
//       await client.query('BEGIN');

//       const examsResult = await client.query(
//         `SELECT id, subject FROM exams WHERE status = 'active'`,
//       );
//       const exams = examsResult.rows;

//       for (const exam of exams) {
//         const result = await client.query(
//           `UPDATE student_records 
//            SET exam_id = $1, updated_at = CURRENT_TIMESTAMP
//            WHERE subject = $2 AND exam_id IS NULL
//            RETURNING id`,
//           [exam.id, exam.subject],
//         );
//         linkedCount += result.rows.length;
//         console.log(
//           `✅ Linked ${result.rows.length} students to ${exam.subject} exam`,
//         );
//       }

//       await client.query('COMMIT');

//       return res.status(200).json({
//         success: true,
//         message: `${linkedCount} students linked to exams successfully`,
//         data: { linkedCount },
//       });
//     } catch (error) {
//       await client.query('ROLLBACK');
//       throw error;
//     } finally {
//       client.release();
//     }
//   } catch (error) {
//     console.error('Auto-link students error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to link students to exams',
//       error: error.message,
//     });
//   }
// };

// // ════════════════════════════════════════════════════════════════
// // ✅ UPDATED DELETE FUNCTIONS WITH CASCADE
// // ════════════════════════════════════════════════════════════════

// // ─── DELETE STUDENT (WITH CASCADE) ─────────────────────────────

// export const deleteStudent = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { id } = req.params;

//     // Start transaction
//     await client.query('BEGIN');

//     // 1️⃣ First, check if student exists
//     const studentResult = await client.query(
//       `SELECT id, barcode FROM student_records WHERE id = $1`,
//       [id],
//     );

//     if (studentResult.rows.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({
//         success: false,
//         message: 'Student not found',
//       });
//     }

//     const student = studentResult.rows[0];

//     // 2️⃣ Get all sheets associated with this student
//     const sheetsResult = await client.query(
//       `SELECT id, file_url FROM sheets WHERE student_id = $1`,
//       [id],
//     );

//     const sheetIds = sheetsResult.rows.map((s) => s.id);
//     const sheetCount = sheetIds.length;

//     // 3️⃣ Delete sheets (this will cascade to marks, etc.)
//     if (sheetCount > 0) {
//       await client.query(`DELETE FROM sheets WHERE student_id = $1`, [id]);
//     }

//     // 4️⃣ Delete the student record
//     await client.query(`DELETE FROM student_records WHERE id = $1`, [id]);

//     // Commit transaction
//     await client.query('COMMIT');

//     return res.status(200).json({
//       success: true,
//       message: `Student deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
//       data: {
//         studentId: id,
//         deletedSheets: sheetCount,
//         sheetIds: sheetIds,
//       },
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Delete student error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to delete student',
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

// // ─── BULK DELETE STUDENTS (WITH CASCADE) ──────────────────────

// export const bulkDeleteStudents = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { ids } = req.body;

//     if (!ids || !Array.isArray(ids) || ids.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide an array of student IDs to delete',
//       });
//     }

//     // Start transaction
//     await client.query('BEGIN');

//     // 1️⃣ Get all students that exist
//     const studentsResult = await client.query(
//       `SELECT id, barcode FROM student_records WHERE id = ANY($1::int[])`,
//       [ids],
//     );

//     const existingStudentIds = studentsResult.rows.map((s) => s.id);
//     const notFoundIds = ids.filter((id) => !existingStudentIds.includes(id));

//     if (existingStudentIds.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({
//         success: false,
//         message: 'No students found with the provided IDs',
//       });
//     }

//     // 2️⃣ Get all sheets for these students
//     const sheetsResult = await client.query(
//       `SELECT id, student_id, file_url FROM sheets WHERE student_id = ANY($1::int[])`,
//       [existingStudentIds],
//     );

//     const sheetIds = sheetsResult.rows.map((s) => s.id);
//     const sheetCount = sheetIds.length;

//     // 3️⃣ Delete all sheets for these students
//     if (sheetCount > 0) {
//       await client.query(
//         `DELETE FROM sheets WHERE student_id = ANY($1::int[])`,
//         [existingStudentIds],
//       );
//     }

//     // 4️⃣ Delete all students
//     await client.query(
//       `DELETE FROM student_records WHERE id = ANY($1::int[])`,
//       [existingStudentIds],
//     );

//     // Commit transaction
//     await client.query('COMMIT');

//     return res.status(200).json({
//       success: true,
//       message: `${existingStudentIds.length} student(s) deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
//       data: {
//         deletedCount: existingStudentIds.length,
//         deletedIds: existingStudentIds,
//         deletedSheets: sheetCount,
//         notFoundIds: notFoundIds,
//       },
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Bulk delete error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to delete students',
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

// // ─── DELETE ALL STUDENTS BY FILTER ─────────────────────────────
// // ✅ NEW: Delete students with filters (e.g., all students in a subject)

// export const deleteStudentsByFilter = async (req, res) => {
//   const client = await pool.connect();

//   try {
//     const { subject, semester, branch, exam_id } = req.query;

//     if (!subject && !semester && !branch && !exam_id) {
//       return res.status(400).json({
//         success: false,
//         message:
//           'Please provide at least one filter (subject, semester, branch, or exam_id)',
//       });
//     }

//     // Build WHERE clause
//     const conditions = [];
//     const params = [];
//     let paramCount = 1;

//     if (subject) {
//       conditions.push(`subject = $${paramCount}`);
//       params.push(subject);
//       paramCount++;
//     }

//     if (semester) {
//       conditions.push(`semester = $${paramCount}`);
//       params.push(parseInt(semester));
//       paramCount++;
//     }

//     if (branch) {
//       conditions.push(`branch = $${paramCount}`);
//       params.push(branch);
//       paramCount++;
//     }

//     if (exam_id) {
//       conditions.push(`exam_id = $${paramCount}`);
//       params.push(parseInt(exam_id));
//       paramCount++;
//     }

//     const whereClause = `WHERE ${conditions.join(' AND ')}`;

//     // Start transaction
//     await client.query('BEGIN');

//     // 1️⃣ Get students to delete
//     const studentsResult = await client.query(
//       `SELECT id FROM student_records ${whereClause}`,
//       params,
//     );

//     const studentIds = studentsResult.rows.map((s) => s.id);

//     if (studentIds.length === 0) {
//       await client.query('ROLLBACK');
//       return res.status(404).json({
//         success: false,
//         message: 'No students found with the given filters',
//       });
//     }

//     // 2️⃣ Get associated sheets
//     const sheetsResult = await client.query(
//       `SELECT id FROM sheets WHERE student_id = ANY($1::int[])`,
//       [studentIds],
//     );

//     const sheetIds = sheetsResult.rows.map((s) => s.id);
//     const sheetCount = sheetIds.length;

//     // 3️⃣ Delete sheets
//     if (sheetCount > 0) {
//       await client.query(
//         `DELETE FROM sheets WHERE student_id = ANY($1::int[])`,
//         [studentIds],
//       );
//     }

//     // 4️⃣ Delete students
//     await client.query(
//       `DELETE FROM student_records WHERE id = ANY($1::int[])`,
//       [studentIds],
//     );

//     // Commit transaction
//     await client.query('COMMIT');

//     return res.status(200).json({
//       success: true,
//       message: `${studentIds.length} student(s) deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
//       data: {
//         deletedCount: studentIds.length,
//         deletedIds: studentIds,
//         deletedSheets: sheetCount,
//         filters: { subject, semester, branch, exam_id },
//       },
//     });
//   } catch (error) {
//     await client.query('ROLLBACK');
//     console.error('Delete students by filter error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to delete students',
//       error: error.message,
//     });
//   } finally {
//     client.release();
//   }
// };

// // ─── GET STUDENT DELETION PREVIEW ──────────────────────────────
// // ✅ NEW: Preview what will be deleted before confirming

// export const getDeletionPreview = async (req, res) => {
//   try {
//     const { ids } = req.query;

//     if (!ids) {
//       return res.status(400).json({
//         success: false,
//         message: 'Please provide student IDs',
//       });
//     }

//     const idArray = ids.split(',').map((id) => parseInt(id.trim()));

//     if (idArray.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid student IDs provided',
//       });
//     }

//     // Get students
//     const studentsResult = await pool.query(
//       `SELECT id, roll_no, student_name, subject, semester, branch 
//        FROM student_records 
//        WHERE id = ANY($1::int[])`,
//       [idArray],
//     );

//     // Get sheet count for each student
//     const sheetsResult = await pool.query(
//       `SELECT student_id, COUNT(*) AS sheet_count 
//        FROM sheets 
//        WHERE student_id = ANY($1::int[])
//        GROUP BY student_id`,
//       [idArray],
//     );

//     const sheetCountMap = {};
//     sheetsResult.rows.forEach((row) => {
//       sheetCountMap[row.student_id] = parseInt(row.sheet_count);
//     });

//     const studentsWithSheets = studentsResult.rows.map((student) => ({
//       ...student,
//       sheet_count: sheetCountMap[student.id] || 0,
//     }));

//     const totalSheets = studentsWithSheets.reduce(
//       (sum, s) => sum + s.sheet_count,
//       0,
//     );

//     return res.status(200).json({
//       success: true,
//       message: 'Deletion preview retrieved successfully',
//       data: {
//         students: studentsWithSheets,
//         totalStudents: studentsWithSheets.length,
//         totalSheets: totalSheets,
//         willDelete: {
//           students: studentsWithSheets.length,
//           sheets: totalSheets,
//         },
//       },
//     });
//   } catch (error) {
//     console.error('Deletion preview error:', error);
//     return res.status(500).json({
//       success: false,
//       message: 'Failed to get deletion preview',
//       error: error.message,
//     });
//   }
// };



// src/students/studentController.js

import pool from '../pool.js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── HELPERS ────────────────────────────────────────────────────

const normalizeColumnName = (name) => {
  if (!name) return '';
  return name.toString().trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
};

const mapRowToRecord = (row) => {
  const n = {};
  for (const [key, value] of Object.entries(row)) {
    n[normalizeColumnName(key)] = value;
  }

  return {
    roll_no: n['roll_no'] || n['roll'] || n['rollnumber'] || null,
    student_name: n['student_name'] || n['studentname'] || n['name'] || n['student'] || null,
    course: n['course'] || n['program'] || n['programme'] || null,
    branch: n['branch'] || n['department'] || n['dept'] || null,
    semester: n['sem'] || n['semester'] || n['semester_no'] || n['semno'] || null,
    subject: n['subject'] || n['sub'] || n['subject_name'] || n['subjectname'] || null,
    barcode: n['barcode'] || n['bar_code'] || n['barcode_no'] || n['barcodeno'] || null,
    exam_name: n['exam'] || n['exam_name'] || n['examname'] || null,
  };
};

const parseExcelFile = (filePath) => {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(worksheet);
};

// ─── Required fields with human-readable labels ─────────────────
const REQUIRED_FIELDS = [
  { key: 'roll_no', label: 'Roll No' },
  { key: 'student_name', label: 'Student Name' },
  { key: 'course', label: 'Course' },
  { key: 'branch', label: 'Branch' },
  { key: 'semester', label: 'Semester' },
  { key: 'subject', label: 'Subject' },
  { key: 'barcode', label: 'Barcode' },
];

// ✅ Field-level validation — returns exactly which fields are missing/invalid
const validateRowFields = (row) => {
  const missingFields = [];
  const invalidFields = [];

  for (const { key, label } of REQUIRED_FIELDS) {
    const val = row[key];
    if (val === null || val === undefined || val.toString().trim() === '') {
      missingFields.push(label);
    }
  }

  // Semester must be numeric 1–12
  if (row.semester !== null && row.semester !== undefined && row.semester !== '') {
    const sem = parseInt(row.semester);
    if (isNaN(sem) || sem < 1 || sem > 12) {
      invalidFields.push(`Semester "${row.semester}" is not valid — expected a number between 1 and 12`);
    }
  }

  // Barcode — alphanumeric only
  if (row.barcode && !/^[a-zA-Z0-9]+$/.test(row.barcode.toString().trim())) {
    invalidFields.push(`Barcode "${row.barcode}" contains invalid characters — only letters and numbers allowed`);
  }

  return { missingFields, invalidFields };
};

// Legacy wrapper used by importStudents
const validateStudentRecord = (row) => {
  const { missingFields, invalidFields } = validateRowFields(row);
  if (missingFields.length > 0) {
    return { valid: false, error: `Missing fields: ${missingFields.join(', ')}` };
  }
  if (invalidFields.length > 0) {
    return { valid: false, error: invalidFields.join(' | ') };
  }
  return { valid: true };
};

// ─── UPLOAD AND PREVIEW ─────────────────────────────────────────

export const uploadAndPreview = async (req, res) => {
  const filePath = req.file?.path;

  // ✅ Single cleanup — called on success AND error
  const cleanupFile = () => {
    if (filePath && fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch { }
    }
  };

  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const rawData = parseExcelFile(filePath);

    if (!rawData || rawData.length === 0) {
      cleanupFile();
      return res.status(400).json({
        success: false,
        message: 'File is empty or has no readable rows. Check the format.',
      });
    }

    // ✅ Check that required columns exist in the file before processing all rows
    const firstRow = mapRowToRecord(rawData[0]);
    const missingColumns = REQUIRED_FIELDS
      .filter(({ key }) => firstRow[key] === null || firstRow[key] === undefined)
      .map(({ label }) => label);

    if (missingColumns.length > 0) {
      cleanupFile();
      return res.status(400).json({
        success: false,
        message: `Missing required columns in Excel file: ${missingColumns.join(', ')}`,
        missingColumns,
      });
    }

    // ✅ Load exams with lowercase keys for case-insensitive match
    const examsResult = await pool.query(`SELECT id, name, subject FROM exams`);
    const examMap = {};
    examsResult.rows.forEach((exam) => {
      const key = `${exam.name.trim().toLowerCase()}|${exam.subject.trim().toLowerCase()}`;
      examMap[key] = { id: exam.id, name: exam.name };
    });

    // ✅ Load all barcodes already in DB — catch cross-upload duplicates
    const existingBarcodesResult = await pool.query(`SELECT barcode FROM student_records`);
    const existingBarcodes = new Set(
      existingBarcodesResult.rows.map((r) => r.barcode.toString().trim())
    );

    const errors = [];
    const validRecords = [];
    const seenBarcodes = new Set(); // duplicates within this upload

    for (let i = 0; i < rawData.length; i++) {
      const rowNum = i + 2; // row 1 = header in Excel
      const row = mapRowToRecord(rawData[i]);

      // ── Field-level validation ─────────────────────────────────
      const { missingFields, invalidFields } = validateRowFields(row);

      if (missingFields.length > 0) {
        errors.push({
          row: rowNum,
          type: 'missing_fields',
          error: `Missing required fields: ${missingFields.join(', ')}`,
          fields: missingFields,
          data: row,
        });
        continue;
      }

      if (invalidFields.length > 0) {
        errors.push({
          row: rowNum,
          type: 'invalid_fields',
          error: invalidFields.join(' | '),
          fields: invalidFields,
          data: row,
        });
        continue;
      }

      const barcode = row.barcode.toString().trim();

      // ── Duplicate within this upload ───────────────────────────
      if (seenBarcodes.has(barcode)) {
        errors.push({
          row: rowNum,
          type: 'duplicate_in_file',
          error: `Duplicate barcode in this file: "${barcode}"`,
          field: 'Barcode',
          data: row,
        });
        continue;
      }
      seenBarcodes.add(barcode);

      // ── Duplicate already in DB ────────────────────────────────
      if (existingBarcodes.has(barcode)) {
        errors.push({
          row: rowNum,
          type: 'barcode_exists_in_db',
          error: `Barcode "${barcode}" already exists in the database`,
          field: 'Barcode',
          data: row,
        });
        continue;
      }

      // ── Exam match — case-insensitive ──────────────────────────
      let examId = null;
      const examName = row.exam_name?.toString().trim() || null;

      if (examName) {
        const examKey = `${examName.toLowerCase()}|${row.subject.toString().trim().toLowerCase()}`;
        const matchedExam = examMap[examKey];

        if (!matchedExam) {
          // ✅ Show which exams ARE available for that subject
          const available = Object.entries(examMap)
            .filter(([k]) => k.endsWith(`|${row.subject.toString().trim().toLowerCase()}`))
            .map(([, v]) => `"${v.name}"`);

          const hint = available.length > 0
            ? ` Available exams for subject "${row.subject}": ${available.join(', ')}.`
            : ` No exams registered for subject "${row.subject}". Please create one first.`;

          errors.push({
            row: rowNum,
            type: 'exam_not_found',
            error: `Exam "${examName}" not found for subject "${row.subject}".${hint}`,
            fields: ['Exam Name', 'Subject'],
            data: row,
          });
          continue;
        }

        examId = matchedExam.id;
      }

      validRecords.push({
        roll_no: row.roll_no.toString().trim(),
        student_name: row.student_name.toString().trim(),
        course: row.course.toString().trim(),
        branch: row.branch.toString().trim(),
        semester: parseInt(row.semester),
        subject: row.subject.toString().trim(),
        barcode,
        exam_id: examId,
        exam_name: examName,
        sheet_status: 'pending',
      });
    }

    // ✅ File no longer needed after parsing — delete it
    cleanupFile();

    // ✅ Error type summary for frontend grouped display
    const errorSummary = errors.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      message: validRecords.length === 0
        ? 'No valid records found — check the errors below'
        : `${validRecords.length} of ${rawData.length} record(s) are valid and ready to import`,
      data: {
        fileName: req.file.originalname,
        totalRecords: rawData.length,
        validCount: validRecords.length,
        errorCount: errors.length,
        errorSummary, // { missing_fields: 2, duplicate_in_file: 1, exam_not_found: 3 }
        errors,       // full list with row number, type, field names, human message
        preview: validRecords.slice(0, 20),
        hasMore: validRecords.length > 20,
        // ✅ filePath NOT returned — server path must never be exposed to client
      },
    });

  } catch (error) {
    console.error('uploadAndPreview error:', error);
    cleanupFile();
    return res.status(500).json({
      success: false,
      message: 'Failed to process file',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// ─── IMPORT STUDENTS ─────────────────────────────────────────────

export const importStudents = async (req, res) => {
  // ✅ importStudents no longer relies on filePath from client (security fix)
  // Instead, accept pre-validated records directly from the preview step
  const { filePath } = req.body;
console.log("AASSSSAAAA=>" ,req.body)
  if (!filePath || !Array.isArray(filePath) || filePath.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'No records provided to import. Please upload and preview first.',
    });
  }

  const client = await pool.connect();
  let importedCount = 0;
  let skippedCount = 0;
  const errors = [];

  try {
    // ✅ Load exams with case-insensitive key
    const examsResult = await client.query(`SELECT id, name, subject FROM exams`);
    const examMap = {};
    examsResult.rows.forEach((exam) => {
      const key = `${exam.name.trim().toLowerCase()}|${exam.subject.trim().toLowerCase()}`;
      examMap[key] = exam.id;
    });

    await client.query('BEGIN');

    for (const row of filePath) {
      try {
        const validation = validateStudentRecord(row);
        if (!validation.valid) {
          skippedCount++;
          errors.push({ row, error: validation.error });
          continue;
        }

        // ✅ Check existing barcode in DB
        const existing = await client.query(
          `SELECT id FROM student_records WHERE barcode = $1`,
          [row.barcode.toString().trim()],
        );

        if (existing.rows.length > 0) {
          skippedCount++;
          errors.push({ row, error: `Barcode "${row.barcode}" already exists — skipped` });
          continue;
        }

        // ✅ Case-insensitive exam match
        let examId = row.exam_id || null;
        if (!examId && row.exam_name) {
          const key = `${row.exam_name.trim().toLowerCase()}|${row.subject.trim().toLowerCase()}`;
          examId = examMap[key] || null;
          if (!examId) {
            skippedCount++;
            errors.push({ row, error: `Exam "${row.exam_name}" not found for subject "${row.subject}"` });
            continue;
          }
        }

        await client.query(
          `INSERT INTO student_records (
            roll_no, student_name, course, branch, semester,
            subject, barcode, exam_id, sheet_status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            row.roll_no.toString().trim(),
            row.student_name.toString().trim(),
            row.course.toString().trim(),
            row.branch.toString().trim(),
            parseInt(row.semester),
            row.subject.toString().trim(),
            row.barcode.toString().trim(),
            examId,
            'pending',
          ],
        );
        importedCount++;
      } catch (err) {
        skippedCount++;
        errors.push({ row, error: err.message });
      }
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${importedCount} student(s) imported successfully. ${skippedCount} skipped.`,
      data: { imported: importedCount, skipped: skippedCount, errors },
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Import error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to import students',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  } finally {
    client.release();
  }
};

// ─── GET ALL STUDENTS ─────────────────────────────────────────────

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
      conditions.push(`(s.roll_no ILIKE $${paramCount} OR s.student_name ILIKE $${paramCount})`);
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

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total FROM student_records s ${whereClause}`,
      params,
    );
    const total = countResult.rows[0]?.total || 0;

    const result = await pool.query(
      `SELECT 
        s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester,
        s.subject, s.barcode, s.exam_id, s.sheet_status,
        s.created_at, s.updated_at,
        e.name AS exam_name,
        (SELECT COUNT(*) FROM sheets WHERE student_id = s.id) AS sheet_count
      FROM student_records s
      LEFT JOIN exams e ON s.exam_id = e.id
      ${whereClause}
      ORDER BY s.id ASC
      LIMIT $${paramCount} OFFSET $${paramCount + 1}`,
      [...params, parseInt(limit), offset],
    );

    const statsResult = await pool.query(
      `SELECT
        COUNT(*) AS total,
        COUNT(DISTINCT subject) AS subjects,
        COUNT(DISTINCT semester) AS semesters,
        COUNT(DISTINCT branch) AS branches,
        COUNT(*) FILTER (WHERE sheet_status = 'uploaded')  AS uploaded,
        COUNT(*) FILTER (WHERE sheet_status = 'pending')   AS pending,
        COUNT(*) FILTER (WHERE sheet_status = 'checking')  AS checking,
        COUNT(*) FILTER (WHERE sheet_status = 'checked')   AS checked,
        COUNT(*) FILTER (WHERE sheet_status = 'recheck')   AS recheck,
        COUNT(*) FILTER (WHERE exam_id IS NOT NULL) AS linked_to_exam
      FROM student_records`,
    );
    const stats = statsResult.rows[0];

    const subjectResult = await pool.query(
      `SELECT subject, COUNT(*) AS count FROM student_records GROUP BY subject ORDER BY count DESC`,
    );

    return res.status(200).json({
      success: true,
      message: 'Students retrieved successfully',
      data: {
        items: result.rows,
        total,
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
    return res.status(500).json({ success: false, message: 'Failed to get students', error: error.message });
  }
};

// ─── GET STUDENT BY ID ────────────────────────────────────────────

export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT 
        s.id, s.roll_no, s.student_name, s.course, s.branch, s.semester,
        s.subject, s.barcode, s.exam_id, s.sheet_status,
        s.created_at, s.updated_at,
        e.name AS exam_name,
        (SELECT COUNT(*) FROM sheets WHERE student_id = s.id) AS sheet_count
      FROM student_records s
      LEFT JOIN exams e ON s.exam_id = e.id
      WHERE s.id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    return res.status(200).json({ success: true, message: 'Student retrieved successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Get student error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get student', error: error.message });
  }
};

// ─── UPDATE STUDENT ───────────────────────────────────────────────

export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const { roll_no, student_name, course, branch, semester, subject, barcode, exam_id, sheet_status } = req.body;

    const existing = await pool.query(`SELECT id FROM student_records WHERE id = $1`, [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const result = await pool.query(
      `UPDATE student_records
       SET
         roll_no      = COALESCE($1,  roll_no),
         student_name = COALESCE($2,  student_name),
         course       = COALESCE($3,  course),
         branch       = COALESCE($4,  branch),
         semester     = COALESCE($5,  semester),
         subject      = COALESCE($6,  subject),
         barcode      = COALESCE($7,  barcode),
         exam_id      = COALESCE($8,  exam_id),
         sheet_status = COALESCE($9,  sheet_status),
         updated_at   = CURRENT_TIMESTAMP
       WHERE id = $10
       RETURNING *`,
      [roll_no, student_name, course, branch, semester, subject, barcode, exam_id, sheet_status, id],
    );

    return res.status(200).json({ success: true, message: 'Student updated successfully', data: result.rows[0] });
  } catch (error) {
    console.error('Update student error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update student', error: error.message });
  }
};

// ─── AUTO-LINK STUDENTS TO EXAMS ─────────────────────────────────

export const autoLinkStudentsToExams = async (req, res) => {
  const client = await pool.connect();
  let linkedCount = 0;

  try {
    await client.query('BEGIN');

    const examsResult = await client.query(`SELECT id, subject FROM exams WHERE status = 'active'`);

    for (const exam of examsResult.rows) {
      const result = await client.query(
        `UPDATE student_records
         SET exam_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE subject = $2 AND exam_id IS NULL
         RETURNING id`,
        [exam.id, exam.subject],
      );
      linkedCount += result.rows.length;
    }

    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${linkedCount} students linked to exams successfully`,
      data: { linkedCount },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Auto-link students error:', error);
    return res.status(500).json({ success: false, message: 'Failed to link students to exams', error: error.message });
  } finally {
    client.release();
  }
};

// ─── DELETE STUDENT (WITH CASCADE) ───────────────────────────────

export const deleteStudent = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    const studentResult = await client.query(
      `SELECT id, barcode FROM student_records WHERE id = $1`, [id]
    );

    if (studentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Student not found' });
    }

    const sheetsResult = await client.query(`SELECT id FROM sheets WHERE student_id = $1`, [id]);
    const sheetIds = sheetsResult.rows.map((s) => s.id);
    const sheetCount = sheetIds.length;

    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE student_id = $1`, [id]);
    }

    await client.query(`DELETE FROM student_records WHERE id = $1`, [id]);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `Student deleted successfully. ${sheetCount} associated sheet(s) also deleted.`,
      data: { studentId: id, deletedSheets: sheetCount, sheetIds },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete student error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete student', error: error.message });
  } finally {
    client.release();
  }
};

// ─── BULK DELETE STUDENTS (WITH CASCADE) ─────────────────────────

export const bulkDeleteStudents = async (req, res) => {
  const client = await pool.connect();

  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, message: 'Please provide an array of student IDs to delete' });
    }

    await client.query('BEGIN');

    const studentsResult = await client.query(
      `SELECT id FROM student_records WHERE id = ANY($1::int[])`, [ids]
    );

    const existingIds = studentsResult.rows.map((s) => s.id);
    const notFoundIds = ids.filter((id) => !existingIds.includes(id));

    if (existingIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No students found with the provided IDs' });
    }

    const sheetsResult = await client.query(
      `SELECT id FROM sheets WHERE student_id = ANY($1::int[])`, [existingIds]
    );
    const sheetCount = sheetsResult.rows.length;

    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE student_id = ANY($1::int[])`, [existingIds]);
    }

    await client.query(`DELETE FROM student_records WHERE id = ANY($1::int[])`, [existingIds]);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${existingIds.length} student(s) deleted. ${sheetCount} associated sheet(s) also deleted.`,
      data: { deletedCount: existingIds.length, deletedIds: existingIds, deletedSheets: sheetCount, notFoundIds },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Bulk delete error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete students', error: error.message });
  } finally {
    client.release();
  }
};

// ─── DELETE STUDENTS BY FILTER ────────────────────────────────────

export const deleteStudentsByFilter = async (req, res) => {
  const client = await pool.connect();

  try {
    const { subject, semester, branch, exam_id } = req.query;

    if (!subject && !semester && !branch && !exam_id) {
      return res.status(400).json({
        success: false,
        message: 'Please provide at least one filter (subject, semester, branch, or exam_id)',
      });
    }

    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (subject) { conditions.push(`subject = $${paramCount++}`); params.push(subject); }
    if (semester) { conditions.push(`semester = $${paramCount++}`); params.push(parseInt(semester)); }
    if (branch) { conditions.push(`branch = $${paramCount++}`); params.push(branch); }
    if (exam_id) { conditions.push(`exam_id = $${paramCount++}`); params.push(parseInt(exam_id)); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    await client.query('BEGIN');

    const studentsResult = await client.query(
      `SELECT id FROM student_records ${whereClause}`, params
    );
    const studentIds = studentsResult.rows.map((s) => s.id);

    if (studentIds.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'No students found with the given filters' });
    }

    const sheetsResult = await client.query(
      `SELECT id FROM sheets WHERE student_id = ANY($1::int[])`, [studentIds]
    );
    const sheetCount = sheetsResult.rows.length;

    if (sheetCount > 0) {
      await client.query(`DELETE FROM sheets WHERE student_id = ANY($1::int[])`, [studentIds]);
    }

    await client.query(`DELETE FROM student_records WHERE id = ANY($1::int[])`, [studentIds]);
    await client.query('COMMIT');

    return res.status(200).json({
      success: true,
      message: `${studentIds.length} student(s) deleted. ${sheetCount} associated sheet(s) also deleted.`,
      data: { deletedCount: studentIds.length, deletedIds: studentIds, deletedSheets: sheetCount, filters: { subject, semester, branch, exam_id } },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete students by filter error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete students', error: error.message });
  } finally {
    client.release();
  }
};

// ─── GET DELETION PREVIEW ─────────────────────────────────────────

export const getDeletionPreview = async (req, res) => {
  try {
    const { ids } = req.query;

    if (!ids) {
      return res.status(400).json({ success: false, message: 'Please provide student IDs' });
    }

    const idArray = ids.split(',').map((id) => parseInt(id.trim())).filter((id) => !isNaN(id));

    if (idArray.length === 0) {
      return res.status(400).json({ success: false, message: 'Invalid student IDs provided' });
    }

    const studentsResult = await pool.query(
      `SELECT id, roll_no, student_name, subject, semester, branch
       FROM student_records WHERE id = ANY($1::int[])`,
      [idArray],
    );

    const sheetsResult = await pool.query(
      `SELECT student_id, COUNT(*) AS sheet_count
       FROM sheets WHERE student_id = ANY($1::int[])
       GROUP BY student_id`,
      [idArray],
    );

    const sheetCountMap = {};
    sheetsResult.rows.forEach((row) => {
      sheetCountMap[row.student_id] = parseInt(row.sheet_count);
    });

    const studentsWithSheets = studentsResult.rows.map((student) => ({
      ...student,
      sheet_count: sheetCountMap[student.id] || 0,
    }));

    const totalSheets = studentsWithSheets.reduce((sum, s) => sum + s.sheet_count, 0);

    return res.status(200).json({
      success: true,
      message: 'Deletion preview retrieved successfully',
      data: {
        students: studentsWithSheets,
        totalStudents: studentsWithSheets.length,
        totalSheets,
        willDelete: { students: studentsWithSheets.length, sheets: totalSheets },
      },
    });
  } catch (error) {
    console.error('Deletion preview error:', error);
    return res.status(500).json({ success: false, message: 'Failed to get deletion preview', error: error.message });
  }
};