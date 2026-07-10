import pool from '../pool.js'; // adjust to your actual pg pool/client export

// Create Exam
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
    console.log('AA==>', req.body);

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
      spentTime || 0, // ✅ New field
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

// Get all exams (paginated + optional search)
export const getAllExams = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || '';
    const excludeArchived =
      req.query.excludeArchived === 'true' ||
      req.query.excludeArchived === true;
    const offset = (page - 1) * limit;
    const searchTerm = `%${search}%`;

    console.log('🔍 excludeArchived raw:', req.query.excludeArchived);
    console.log('🔍 excludeArchived parsed:', excludeArchived);

    let dataQuery = `
      SELECT * FROM exams
      WHERE name ILIKE $1 OR subject ILIKE $1
    `;
    let countQuery = `
      SELECT COUNT(*) FROM exams
      WHERE name ILIKE $1 OR subject ILIKE $1
    `;

    const queryParams = [searchTerm];

    // ✅ Agar excludeArchived true hai to archived filter karo
    if (excludeArchived) {
      dataQuery += ` AND LOWER(TRIM(status)) != 'archived'`;
      countQuery += ` AND LOWER(TRIM(status)) != 'archived'`;
    }

    dataQuery += ` ORDER BY created_at DESC LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
    queryParams.push(limit, offset);

    console.log('🔍 Query:', dataQuery);
    console.log('🔍 Params:', queryParams);

    const { rows } = await pool.query(dataQuery, queryParams);
    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count, 10);

    console.log('🔍 Total exams found:', rows.length);
    console.log(
      '🔍 Exams:',
      rows.map((r) => ({ name: r.name, status: r.status })),
    );

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

// Get single exam
export const getSingleExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('SELECT * FROM exams WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('getSingleExam error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch exam' });
  }
};

// Update exam (only updates fields actually provided)
// Update exam (only updates fields actually provided)
export const updateExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subject, date, totalQuestions, maxMarks, spentTime, status, createdBy } = req.body;

    const fieldMap = { 
      name, 
      subject, 
      date, 
      totalQuestions, 
      maxMarks, 
      spentTime,  // ✅ Add this
      status, 
      createdBy 
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
      return res.status(400).json({ success: false, message: 'No fields provided to update' });
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
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    return res.status(200).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('updateExam error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update exam' });
  }
};

// Delete exam
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query('DELETE FROM exams WHERE id = $1 RETURNING id', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }

    return res.status(200).json({ success: true, message: 'Exam deleted successfully' });
  } catch (error) {
    console.error('deleteExam error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete exam' });
  }
};