import pool from '../pool.js'; // adjust to your actual pg pool/client export

// Get full mark scheme for an exam
export const getMarkSchemeByExam = async (req, res) => {
  try {
    const { examId } = req.params;
    const { rows } = await pool.query(
      'SELECT * FROM mark_schemes WHERE "examId" = $1 ORDER BY "questionName" ASC',
      [examId]
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    console.error('getMarkSchemeByExam error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch mark scheme' });
  }
};

// Replace the entire mark scheme for an exam
export const saveMarkScheme = async (req, res) => {
  const { examId } = req.params;
  const { schemes } = req.body;

  if (!Array.isArray(schemes)) {
    return res.status(400).json({ success: false, message: '"schemes" must be an array' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM mark_schemes WHERE "examId" = $1', [examId]);

    for (const item of schemes) {
      const { questionName, maxMarks, guidelines } = item;
      if (!questionName) continue;

      await client.query(
        `INSERT INTO mark_schemes ("examId", "questionName", "maxMarks", guidelines)
         VALUES ($1, $2, $3, $4)`,
        [examId, questionName, maxMarks || 0, guidelines || '']
      );
    }

    await client.query('COMMIT');

    const { rows } = await client.query(
      'SELECT * FROM mark_schemes WHERE "examId" = $1 ORDER BY "questionName" ASC',
      [examId]
    );

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('saveMarkScheme error:', error);
    return res.status(500).json({ success: false, message: 'Failed to save mark scheme' });
  } finally {
    client.release();
  }
};