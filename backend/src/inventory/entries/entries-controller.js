import pool from "../../pool.js";
export const createDSE = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id: userId, company_id } = req.user;

    // ✅ Map camelCase → snake_case
    const {
      warehouseId,
      entryDate,
      reason,
      customReason,
      referenceNo,
      notes,
      items
    } = req.body;

    const warehouse_id = warehouseId;
    const entry_date = entryDate;
    const custom_reason = customReason;
    const reference_no = referenceNo;

    // ───────── VALIDATION ─────────
    if (!warehouse_id) {
      return res.status(400).json({ message: "warehouseId is required" });
    }

    if (!reason) {
      return res.status(400).json({ message: "reason is required" });
    }

    if (reason === "OTHER" && !custom_reason) {
      return res.status(400).json({
        message: "customReason is required when reason is OTHER"
      });
    }

    if (!items || items.length === 0) {
      return res.status(400).json({ message: "items are required" });
    }

    // Validate items (camelCase)
    for (const item of items) {
      if (!item.itemId || !item.quantity) {
        return res.status(400).json({
          message: "itemId and quantity required for each item"
        });
      }

      if (Number(item.quantity) <= 0) {
        return res.status(400).json({
          message: "quantity must be greater than 0"
        });
      }
    }

    await client.query("BEGIN");

    // 🔢 Generate number from existing rows (safe against out-of-sync sequence table)
    await client.query(
      `SELECT pg_advisory_xact_lock(hashtext($1::text))`,
      [company_id]
    );

    const dseNumberRes = await client.query(
      `SELECT COALESCE(MAX(((regexp_match(dse_number, '(\\d+)$'))[1])::INT), 0) + 1 AS next_seq
       FROM direct_stock_entries
       WHERE company_id = $1
         AND dse_number LIKE 'DSE-%'`,
      [company_id]
    );

    const nextSeq = Number(dseNumberRes.rows[0]?.next_seq || 1);
    const currentYear = new Date().getFullYear();
    const dse_number = `DSE-${currentYear}-${String(nextSeq).padStart(4, '0')}`;

    // 🧾 Insert header (with safe date)
    const dseRes = await client.query(
      `INSERT INTO direct_stock_entries
       (company_id, warehouse_id, dse_number, entry_date,
        reason, custom_reason, reference_no, notes, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        company_id,
        warehouse_id,
        dse_number,
        entry_date || new Date(), // ✅ FIXED
        reason,
        custom_reason || null,
        reference_no || null,
        notes || null,
        userId
      ]
    );

    const dse_id = dseRes.rows[0].id;

    let total_qty = 0;
    let total_value = 0;

    // ───────── ITEMS LOOP ─────────
    for (const item of items) {
      const quantity = Number(item.quantity);
      const rate = Number(item.rate || 0);

      await client.query(
        `INSERT INTO direct_stock_entry_items
         (dse_id, item_id, quantity, rate, unit_name)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          dse_id,
          item.itemId,        // ✅ camelCase fix
          quantity,
          rate,
          item.unitName || null
        ]
      );

      total_qty += quantity;
      total_value += quantity * rate;

      // ✅ FIXED stock movement (correct order + UUID casting)
      await client.query(
        `SELECT record_stock_movement(
          $1::UUID,
          $2::UUID,
          $3::UUID,
          $4::TEXT,
          $5::NUMERIC,
          $6::UUID,
          $7::TEXT,
          $8::UUID,
          $9::TEXT
        )`,
        [
          item.itemId,
          warehouse_id,
          company_id,
          reason === "OPENING" ? "OPENING" : "ADJUSTMENT_IN",
          quantity,
          dse_id,
          "DSE",
          userId,
          notes || null
        ]
      );
    }

    await client.query(
      `UPDATE direct_stock_entries
       SET total_qty = $1,
           total_value = $2
       WHERE id = $3`,
      [total_qty, total_value, dse_id]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message: "DSE created successfully",
      data: {
        id: dse_id,
        dse_number,
        total_qty,
        total_value
      }
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("DSE ERROR:", error);

    return res.status(500).json({
      message: "Failed to create Direct Stock Entry",
      error: error.message
    });

  } finally {
    client.release();
  }
};


export const getDSEList = async (req, res) => {
  try {
    const { company_id } = req.user;

    const {
      warehouse_id,
      reason,
      from_date,
      to_date,
      page = 1,
      limit = 20
    } = req.query;

    const offset = (page - 1) * limit;

    let query = `
      SELECT
        dse.*,
        w.name AS warehouse_name,
        u.name AS created_by_name,
        COALESCE(ic.total_items, 0) AS total_items
      FROM direct_stock_entries dse
      LEFT JOIN warehouses w ON w.id = dse.warehouse_id
      LEFT JOIN users u ON u.id = dse.created_by
      LEFT JOIN (
        SELECT dse_id, COUNT(*)::INT AS total_items
        FROM direct_stock_entry_items
        GROUP BY dse_id
      ) ic ON ic.dse_id = dse.id
      WHERE dse.company_id = $1
    `;

    let countQuery = `
      SELECT COUNT(*) 
      FROM direct_stock_entries dse
      WHERE dse.company_id = $1
    `;

    const values = [company_id];
    let idx = 2;

    // ───────── FILTERS ─────────
    if (warehouse_id) {
      query += ` AND dse.warehouse_id = $${idx}`;
      countQuery += ` AND dse.warehouse_id = $${idx}`;
      values.push(warehouse_id);
      idx++;
    }

    if (reason) {
      query += ` AND dse.reason = $${idx}`;
      countQuery += ` AND dse.reason = $${idx}`;
      values.push(reason);
      idx++;
    }

    if (from_date) {
      query += ` AND dse.entry_date >= $${idx}`;
      countQuery += ` AND dse.entry_date >= $${idx}`;
      values.push(from_date);
      idx++;
    }

    if (to_date) {
      query += ` AND dse.entry_date <= $${idx}`;
      countQuery += ` AND dse.entry_date <= $${idx}`;
      values.push(to_date);
      idx++;
    }

    // ───────── PAGINATION ─────────
    query += ` ORDER BY dse.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    values.push(limit, offset);

    // Execute
    const [dataRes, countRes] = await Promise.all([
      pool.query(query, values),
      pool.query(countQuery, values.slice(0, idx - 1))
    ]);

    return res.json({
      data: dataRes.rows,
      total: Number(countRes.rows[0].count),
      page: Number(page),
      limit: Number(limit)
    });

  } catch (error) {
    console.error("GET DSE LIST ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch DSE list" });
  }
};


export const getSingleDSE = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_id } = req.user;

    // 🧾 Get header
    const dseRes = await pool.query(
      `SELECT
         dse.*,
         w.name AS warehouse_name,
         u.name AS created_by_name
       FROM direct_stock_entries dse
       LEFT JOIN warehouses w ON w.id = dse.warehouse_id
       LEFT JOIN users u ON u.id = dse.created_by
       WHERE dse.id = $1 AND dse.company_id = $2`,
      [id, company_id]
    );

    if (dseRes.rows.length === 0) {
      return res.status(404).json({ message: "DSE not found" });
    }

    const dse = dseRes.rows[0];

    // 📦 Get items
    const itemsRes = await pool.query(
      `SELECT 
         i.*,
         it.name AS item_name,
         it.code AS item_code,
         COALESCE(i.unit_name, it.unit_name) AS display_unit_name
       FROM direct_stock_entry_items i
       JOIN items it ON it.id = i.item_id
       WHERE i.dse_id = $1`,
      [id]
    );

    return res.json({
      ...dse,
      items: itemsRes.rows
    });

  } catch (error) {
    console.error("GET SINGLE DSE ERROR:", error);
    return res.status(500).json({ message: "Failed to fetch DSE" });
  }
};

export const updateDSE = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id: userId, company_id } = req.user;
    const { id } = req.params;

    const {
      warehouseId,
      entryDate,
      reason,
      customReason,
      referenceNo,
      notes,
      items
    } = req.body;

    if (!id) throw new Error("DSE id required");

    await client.query("BEGIN");

    // 🔹 Get existing DSE
    const { rows } = await client.query(
      `SELECT * FROM direct_stock_entries WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("DSE not found");

    const dse = rows[0];

    // 🔹 Get old items
    const { rows: oldItems } = await client.query(
      `SELECT * FROM direct_stock_entry_items WHERE dse_id = $1`,
      [id]
    );

    // 🔥 Reverse OLD stock movement
    for (const item of oldItems) {
      await client.query(
        `SELECT record_stock_movement(
          $1::UUID,$2::UUID,$3::UUID,$4::TEXT,$5::NUMERIC,$6::UUID,$7::TEXT,$8::UUID,$9::TEXT
        )`,
        [
          item.item_id,
          dse.warehouse_id,
          company_id,
          "ADJUSTMENT_OUT", // reverse
          item.quantity,
          id,
          "DSE_REVERSAL",
          userId,
          "Reversal"
        ]
      );
    }

    // 🔥 Delete old items
    await client.query(
      `DELETE FROM direct_stock_entry_items WHERE dse_id = $1`,
      [id]
    );

    let total_qty = 0;
    let total_value = 0;

    // 🔹 Insert new items
    for (const item of items) {
      const qty = Number(item.quantity);
      const rate = Number(item.rate || 0);

      await client.query(
        `INSERT INTO direct_stock_entry_items
         (dse_id, item_id, quantity, rate, unit_name)
         VALUES ($1,$2,$3,$4,$5)`,
        [id, item.itemId, qty, rate, item.unitName || null]
      );

      total_qty += qty;
      total_value += qty * rate;

      // 🔥 Apply new movement
      await client.query(
        `SELECT record_stock_movement(
          $1::UUID,$2::UUID,$3::UUID,$4::TEXT,$5::NUMERIC,$6::UUID,$7::TEXT,$8::UUID,$9::TEXT
        )`,
        [
          item.itemId,
          warehouseId,
          company_id,
          reason === "OPENING" ? "OPENING" : "ADJUSTMENT_IN",
          qty,
          id,
          "DSE",
          userId,
          notes || null
        ]
      );
    }

    // 🔹 Update header
    await client.query(
      `UPDATE direct_stock_entries
       SET warehouse_id = $1,
           entry_date = $2,
           reason = $3,
           custom_reason = $4,
           reference_no = $5,
           notes = $6,
           total_qty = $7,
           total_value = $8,
           updated_at = NOW()
       WHERE id = $9`,
      [
        warehouseId,
        entryDate || new Date(),
        reason,
        customReason || null,
        referenceNo || null,
        notes || null,
        total_qty,
        total_value,
        id
      ]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "DSE updated successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("updateDSE error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
};

export const deleteDSE = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id: userId, company_id } = req.user;
    const { id } = req.params;

    if (!id) throw new Error("DSE id required");

    await client.query("BEGIN");

    // 🔹 Get DSE
    const { rows } = await client.query(
      `SELECT * FROM direct_stock_entries WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (!rows.length) throw new Error("DSE not found");

    const dse = rows[0];

    // 🔹 Get items
    const { rows: items } = await client.query(
      `SELECT * FROM direct_stock_entry_items WHERE dse_id = $1`,
      [id]
    );

    // 🔥 Reverse movements
    for (const item of items) {
      await client.query(
        `SELECT record_stock_movement(
          $1::UUID,$2::UUID,$3::UUID,$4::TEXT,$5::NUMERIC,$6::UUID,$7::TEXT,$8::UUID,$9::TEXT
        )`,
        [
          item.item_id,
          dse.warehouse_id,
          company_id,
          "ADJUSTMENT_OUT",
          item.quantity,
          id,
          "DSE_DELETE",
          userId,
          "Deleted DSE"
        ]
      );
    }

    // 🔥 Delete DSE
    await client.query(
      `DELETE FROM direct_stock_entries WHERE id = $1`,
      [id]
    );

    await client.query("COMMIT");

    return res.json({
      success: true,
      message: "DSE deleted successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("deleteDSE error:", err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  } finally {
    client.release();
  }
};