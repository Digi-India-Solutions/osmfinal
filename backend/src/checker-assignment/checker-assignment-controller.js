import pool from '../pool.js';

// GET /checker-assignment/sheets?examId=X
export const getUnassignedSheets = async (req, res) => {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ success: false, message: 'examId is required' });

    const { rows } = await pool.query(
      `SELECT * FROM sheets
       WHERE "examId" = $1 AND "assignedTo" IS NULL AND status = 'uploaded'
       ORDER BY "rollNo" ASC`,
      [examId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getUnassignedSheets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch sheets' });
  }
};

// GET /checker-assignment/checkers
export const getAvailableCheckers = async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, role, subject, email FROM users
       WHERE role IN ('checker', 'teacher_checker') AND "isActive" = true
       ORDER BY name ASC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getAvailableCheckers error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch checkers' });
  }
};

// POST /checker-assignment/assign
// body: { examId, checkerId, checkerName, sheetIds: [...] }
export const assignSheets = async (req, res) => {
  const { examId, checkerId, checkerName, sheetIds } = req.body;

  if (!examId || !checkerId || !checkerName || !Array.isArray(sheetIds) || sheetIds.length === 0) {
    return res.status(400).json({ success: false, message: 'examId, checkerId, checkerName and sheetIds are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const sheetId of sheetIds) {
      await client.query(
        `UPDATE sheets SET "assignedTo" = $1, status = 'assigned', "updatedAt" = NOW()
         WHERE id = $2 AND "examId" = $3 AND "assignedTo" IS NULL`,
        [checkerId, sheetId, examId]
      );
    }

    const { rows: logRows } = await client.query(
      `INSERT INTO assignment_logs ("examId", "checkerId", "checkerName", "sheetCount", mode)
       VALUES ($1, $2, $3, $4, 'manual')
       RETURNING *`,
      [examId, checkerId, checkerName, sheetIds.length]
    );

    await client.query('COMMIT');
    return res.status(200).json({ success: true, log: logRows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('assignSheets error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign sheets' });
  } finally {
    client.release();
  }
};

// POST /checker-assignment/assign-random
// body: { examId }
export const assignSheetsRandomly = async (req, res) => {
  const { examId } = req.body;
  if (!examId) return res.status(400).json({ success: false, message: 'examId is required' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Get exam subject to check conflicts
    const { rows: examRows } = await client.query(
      'SELECT subject FROM exams WHERE id = $1', [examId]
    );
    if (examRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Exam not found' });
    }
    const examSubject = examRows[0].subject;

    // Get eligible checkers (no conflict)
    const { rows: checkers } = await client.query(
      `SELECT id, name, subject, role FROM users
       WHERE role IN ('checker', 'teacher_checker') AND "isActive" = true
       AND NOT (role = 'teacher_checker' AND subject = $1)
       ORDER BY name ASC`,
      [examSubject]
    );

    if (checkers.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No eligible checkers available' });
    }

    // Get unassigned sheets
    const { rows: unassigned } = await client.query(
      `SELECT id FROM sheets
       WHERE "examId" = $1 AND "assignedTo" IS NULL AND status = 'uploaded'`,
      [examId]
    );

    if (unassigned.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'No unassigned sheets found' });
    }

    const perChecker = Math.ceil(unassigned.length / checkers.length);
    const logEntries = [];

    for (let i = 0; i < checkers.length; i++) {
      const checker = checkers[i];
      const batch = unassigned.slice(i * perChecker, (i + 1) * perChecker);
      if (batch.length === 0) break;

      for (const sheet of batch) {
        await client.query(
          `UPDATE sheets SET "assignedTo" = $1, status = 'assigned', "updatedAt" = NOW()
           WHERE id = $2`,
          [checker.id, sheet.id]
        );
      }

      const { rows: logRows } = await client.query(
        `INSERT INTO assignment_logs ("examId", "checkerId", "checkerName", "sheetCount", mode)
         VALUES ($1, $2, $3, $4, 'random')
         RETURNING *`,
        [examId, checker.id, checker.name, batch.length]
      );
      logEntries.push(logRows[0]);
    }

    await client.query('COMMIT');
    return res.status(200).json({
      success: true,
      logs: logEntries,
      totalAssigned: unassigned.length,
      checkerCount: checkers.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('assignSheetsRandomly error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign randomly' });
  } finally {
    client.release();
  }
};

// GET /checker-assignment/logs?examId=X
export const getAssignmentLogs = async (req, res) => {
  try {
    const { examId } = req.query;
    if (!examId) return res.status(400).json({ success: false, message: 'examId is required' });

    const { rows } = await pool.query(
      `SELECT * FROM assignment_logs
       WHERE "examId" = $1
       ORDER BY "createdAt" DESC
       LIMIT 50`,
      [examId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getAssignmentLogs error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch logs' });
  }
};