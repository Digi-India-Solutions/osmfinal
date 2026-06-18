import { connectDB } from "../../pool.js";
import { DOCUMENT_DEFAULTS } from "../../../utils/documentDefaults.js";

const seedDocumentSequences = async (client, company_id) => {
  for (const [doc_type, config] of Object.entries(DOCUMENT_DEFAULTS)) {
    await client.query(
      `INSERT INTO document_sequences
       (company_id, doc_type, prefix, start_no, current_value)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (company_id, doc_type) DO NOTHING`,
      [
        company_id,
        doc_type,
        config.prefix,
        config.start_no,
        config.start_no - 1,
      ]
    );
  }
};
export const getDocumentSettings = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `SELECT 
        doc_type AS type,
        prefix,
        start_no,
        current_value,
        (prefix || '-' || (current_value + 1)) AS next_no
       FROM document_sequences
       WHERE company_id = $1
       ORDER BY doc_type`,
      [company_id]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (err) {
    console.error("Get Document Settings Error:", err);
    res.status(500).json({ message: err.message });
  }
};
// export const getDocumentSettings = async (req, res) => {
//   const client = await connectDB.connect();

//   try {
//     const company_id = req.user.company_id;

//     await client.query("BEGIN");

//     // 1. CHECK IF DATA EXISTS
//     const check = await client.query(
//       `SELECT 1 FROM document_sequences WHERE company_id = $1 LIMIT 1`,
//       [company_id]
//     );

//     // 2. IF NOT EXISTS → SEED DEFAULTS
//     if (check.rowCount === 0) {
//       await seedDocumentSequences(client, company_id);
//     }

//     await client.query("COMMIT");

//     // 3. NOW FETCH DATA (GUARANTEED EXISTS)
//     const result = await client.query(
//       `SELECT 
//         doc_type AS type,
//         prefix,
//         start_no,
//         current_value,
//         (prefix || (current_value + 1)) AS next_no
//        FROM document_sequences
//        WHERE company_id = $1
//        ORDER BY doc_type`,
//       [company_id]
//     );

//     res.json({
//       success: true,
//       data: result.rows
//     });

//   } catch (err) {
//     await client.query("ROLLBACK");
//     console.error("Get Document Settings Error:", err);
//     res.status(500).json({ message: err.message });

//   } finally {
//     client.release();
//   }
// };


export const updateDocumentSettings = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { docTypes } = req.body;

    if (!docTypes || !Array.isArray(docTypes)) {
      return res.status(400).json({ message: "Invalid payload" });
    }

    const client = await connectDB.connect();

    try {
      await client.query("BEGIN");

      for (const doc of docTypes) {
        const { type, prefix, startNo } = doc;

        if (!type) continue;

        const start = Number(startNo) || 1001;

        await client.query(
          `INSERT INTO document_sequences
            (company_id, doc_type, prefix, start_no, current_value)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (company_id, doc_type)
          DO UPDATE SET
            prefix = EXCLUDED.prefix,
            start_no = EXCLUDED.start_no,
            current_value = CASE
              WHEN document_sequences.start_no IS DISTINCT FROM EXCLUDED.start_no
              THEN EXCLUDED.start_no - 1
              ELSE document_sequences.current_value
            END`,
          [company_id, type, prefix || "", start, start - 1]
        );
    }

      await client.query("COMMIT");

      res.json({
        success: true,
        message: "Document settings updated successfully"
      });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("Update Document Settings Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const getBarcodeSettings = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    // ensure default exists
    await connectDB.query(
      `INSERT INTO barcode_settings (company_id)
       VALUES ($1)
       ON CONFLICT (company_id) DO NOTHING`,
      [company_id]
    );

    const result = await connectDB.query(
      `SELECT * FROM barcode_settings
       WHERE company_id = $1`,
      [company_id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Get Barcode Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const updateBarcodeSettings = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const {
      format,
      length,
      prefix,
      startingNumber,
      lastUsedNumber
    } = req.body;

    const result = await connectDB.query(
        `UPDATE barcode_settings
        SET format = COALESCE($1, format),
            length = COALESCE($2, length),
            prefix = COALESCE($3, prefix),
            starting_number = COALESCE($4, starting_number),
            last_used_number = COALESCE($5, last_used_number),
            updated_at = NOW()
        WHERE company_id = $6
        RETURNING *`,
        [
            format,
            length,
            prefix,
            startingNumber,
            lastUsedNumber,
            company_id
        ]
        );


    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Update Barcode Error:", err);
    res.status(500).json({ message: err.message });
  }
};

export const resetBarcodeCounter = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `UPDATE barcode_settings
       SET last_used_number = 0,
           updated_at = NOW()
       WHERE company_id = $1
       RETURNING *`,
      [company_id]
    );

    res.json({
      success: true,
      message: "Barcode counter reset successfully",
      data: result.rows[0]
    });

  } catch (err) {
    console.error("Reset Barcode Error:", err);
    res.status(500).json({ message: err.message });
  }
};


export const createDefaultSequences = async (company_id) => {
  const defaults = [
    { type: "SALES_INVOICE", prefix: "INV" },
    { type: "PURCHASE_INVOICE", prefix: "PINV" },
    { type: "DELIVERY_CHALLAN", prefix: "DC" },
    { type: "SALE_RETURN", prefix: "SRTN" },
    { type: "PURCHASE_RETURN", prefix: "PRTN" },
    { type: "QUOTATION", prefix: "QT" }
  ];

  for (const d of defaults) {
    await connectDB.query(
      `INSERT INTO document_sequences
       (company_id, doc_type, prefix, start_no, current_value)
       VALUES ($1,$2,$3,1001,1000)
       ON CONFLICT (company_id, doc_type) DO NOTHING`,
      [company_id, d.type, d.prefix]
    );
  }
};




