// src/controllers/subject.controller.js
import { connectDB } from '../pool.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────

const subjectExists = async (code, excludeId = null) => {
  try {
    let query = `SELECT id FROM subjects WHERE code = $1`;
    const params = [code.toUpperCase()];

    if (excludeId) {
      query += ` AND id != $2`;
      params.push(excludeId);
    }

    const result = await connectDB.query(query, params);
    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking subject:', error);
    return false;
  }
};

// ─── GET ALL SUBJECTS ────────────────────────────────────────────────────

export const getSubjects = async (req, res) => {
  try {
    const { search = '', department = '', status = '' } = req.query;

    let query = `
      SELECT 
        id,
        name,
        code,
        department,
        status,
        created_at,
        updated_at
      FROM subjects 
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    // Search filter
    if (search) {
      query += ` AND (name ILIKE $${paramCount} OR code ILIKE $${paramCount})`;
      params.push(`%${search}%`);
      paramCount++;
    }

    // Department filter
    if (department) {
      query += ` AND department = $${paramCount}`;
      params.push(department);
      paramCount++;
    }

    // Status filter
    if (status) {
      query += ` AND status = $${paramCount}`;
      params.push(status);
      paramCount++;
    }

    // Order by
    query += ` ORDER BY id ASC`;

    const result = await connectDB.query(query, params);

    return res.status(200).json({
      success: true,
      message: 'Subjects retrieved successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Get Subjects Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get subjects',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── GET SUBJECT BY ID ──────────────────────────────────────────────────

export const getSubjectById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await connectDB.query(
      `SELECT 
        id,
        name,
        code,
        department,
        status,
        created_at,
        updated_at
      FROM subjects 
      WHERE id = $1`,
      [id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Subject retrieved successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Get Subject By ID Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get subject',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── CREATE SUBJECT ──────────────────────────────────────────────────────

export const createSubject = async (req, res) => {
  try {
    const { name, code, department, status = 'active' } = req.body;

    // Validation
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject name is required',
      });
    }

    if (!code || !code.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Subject code is required',
      });
    }

    const trimmedCode = code.trim().toUpperCase();
    if (trimmedCode.length > 10) {
      return res.status(400).json({
        success: false,
        message: 'Subject code must be 10 characters max',
      });
    }

    if (!department || !department.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department is required',
      });
    }

    // Check if subject code already exists
    const exists = await subjectExists(trimmedCode);
    if (exists) {
      return res.status(400).json({
        success: false,
        message: `Subject with code "${trimmedCode}" already exists`,
      });
    }

    // Insert subject
    const result = await connectDB.query(
      `INSERT INTO subjects (name, code, department, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING 
         id,
         name,
         code,
         department,
         status,
         created_at,
         updated_at`,
      [name.trim(), trimmedCode, department.trim(), status],
    );

    return res.status(201).json({
      success: true,
      message: 'Subject created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Create Subject Error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create subject',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── UPDATE SUBJECT ──────────────────────────────────────────────────────

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, department, status } = req.body;

    // Check if subject exists
    const existingSubject = await connectDB.query(
      `SELECT * FROM subjects WHERE id = $1`,
      [id],
    );

    if (existingSubject.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      });
    }

    // Build dynamic update query
    const updateFields = [];
    const values = [];
    let paramCount = 1;

    if (name !== undefined && name.trim()) {
      updateFields.push(`name = $${paramCount}`);
      values.push(name.trim());
      paramCount++;
    }

    if (code !== undefined && code.trim()) {
      const trimmedCode = code.trim().toUpperCase();
      if (trimmedCode.length > 10) {
        return res.status(400).json({
          success: false,
          message: 'Subject code must be 10 characters max',
        });
      }

      // Check if code already exists (excluding current subject)
      const codeExists = await subjectExists(trimmedCode, id);
      if (codeExists) {
        return res.status(400).json({
          success: false,
          message: `Subject with code "${trimmedCode}" already exists`,
        });
      }

      updateFields.push(`code = $${paramCount}`);
      values.push(trimmedCode);
      paramCount++;
    }

    if (department !== undefined && department.trim()) {
      updateFields.push(`department = $${paramCount}`);
      values.push(department.trim());
      paramCount++;
    }

    if (status !== undefined) {
      const validStatuses = ['active', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status. Must be active or inactive',
        });
      }
      updateFields.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update',
      });
    }

    // Always update updated_at
    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    // Add id to values
    values.push(id);

    const query = `
      UPDATE subjects 
      SET ${updateFields.join(', ')} 
      WHERE id = $${paramCount}
      RETURNING 
        id,
        name,
        code,
        department,
        status,
        created_at,
        updated_at
    `;

    const result = await connectDB.query(query, values);

    return res.status(200).json({
      success: true,
      message: 'Subject updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Subject Error:', error);

    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'Subject code already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update subject',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── DELETE SUBJECT ──────────────────────────────────────────────────────

export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if subject exists
    const existingSubject = await connectDB.query(
      `SELECT * FROM subjects WHERE id = $1`,
      [id],
    );

    if (existingSubject.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      });
    }

    // Delete subject
    await connectDB.query(`DELETE FROM subjects WHERE id = $1`, [id]);

    return res.status(200).json({
      success: true,
      message: 'Subject deleted successfully',
      data: existingSubject.rows[0],
    });
  } catch (error) {
    console.error('Delete Subject Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete subject',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── TOGGLE SUBJECT STATUS ──────────────────────────────────────────────

export const toggleSubjectStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Get current status
    const currentSubject = await connectDB.query(
      `SELECT id, status FROM subjects WHERE id = $1`,
      [id],
    );

    if (currentSubject.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Subject not found',
      });
    }

    const currentStatus = currentSubject.rows[0].status;
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

    // Update status
    const result = await connectDB.query(
      `UPDATE subjects 
       SET status = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2
       RETURNING 
         id,
         name,
         code,
         department,
         status,
         created_at,
         updated_at`,
      [newStatus, id],
    );

    return res.status(200).json({
      success: true,
      message: `Subject ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Toggle Subject Status Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to toggle subject status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── BULK DELETE SUBJECTS ───────────────────────────────────────────────

export const bulkDeleteSubjects = async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of subject IDs to delete',
      });
    }

    // Delete subjects
    const result = await connectDB.query(
      `DELETE FROM subjects WHERE id = ANY($1::int[]) RETURNING id`,
      [ids],
    );

    return res.status(200).json({
      success: true,
      message: `${result.rows.length} subjects deleted successfully`,
      data: {
        deletedCount: result.rows.length,
        deletedIds: result.rows.map((row) => row.id),
      },
    });
  } catch (error) {
    console.error('Bulk Delete Subjects Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete subjects',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── GET SUBJECT STATS ──────────────────────────────────────────────────

export const getSubjectStats = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT 
         COUNT(*) AS total_subjects,
         COUNT(*) FILTER (WHERE status = 'active') AS active_subjects,
         COUNT(*) FILTER (WHERE status = 'inactive') AS inactive_subjects,
         COUNT(DISTINCT department) AS total_departments,
         json_agg(DISTINCT department) AS departments
       FROM subjects`,
    );

    const stats = result.rows[0];

    return res.status(200).json({
      success: true,
      message: 'Subject statistics retrieved successfully',
      data: {
        totalSubjects: parseInt(stats.total_subjects),
        activeSubjects: parseInt(stats.active_subjects),
        inactiveSubjects: parseInt(stats.inactive_subjects),
        totalDepartments: parseInt(stats.total_departments),
        departments: stats.departments || [],
      },
    });
  } catch (error) {
    console.error('Get Subject Stats Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get subject statistics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── SEARCH SUBJECTS ────────────────────────────────────────────────────

export const searchSubjects = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || !q.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required',
      });
    }

    const searchTerm = `%${q.trim()}%`;
    const result = await connectDB.query(
      `SELECT 
         id,
         name,
         code,
         department,
         status
       FROM subjects 
       WHERE name ILIKE $1 
          OR code ILIKE $1 
          OR department ILIKE $1
       ORDER BY name ASC
       LIMIT 20`,
      [searchTerm],
    );

    return res.status(200).json({
      success: true,
      message: 'Subjects searched successfully',
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    console.error('Search Subjects Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search subjects',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// ─── GET SUBJECTS BY DEPARTMENT ─────────────────────────────────────────

export const getSubjectsByDepartment = async (req, res) => {
  try {
    const { department } = req.params;

    if (!department || !department.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Department is required',
      });
    }

    const result = await connectDB.query(
      `SELECT 
         id,
         name,
         code,
         department,
         status
       FROM subjects 
       WHERE department = $1 
         AND status = 'active'
       ORDER BY name ASC`,
      [department.trim()],
    );

    return res.status(200).json({
      success: true,
      message: 'Subjects by department retrieved successfully',
      data: result.rows,
      count: result.rows.length,
      department: department.trim(),
    });
  } catch (error) {
    console.error('Get Subjects By Department Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get subjects by department',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
