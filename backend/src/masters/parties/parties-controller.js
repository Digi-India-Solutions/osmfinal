import { connectDB } from '../../pool.js';

// ✅ CREATE PARTY
export const createParty = async (req, res) => {
  try {
    const {
      name,
      type,
      isRegistered,
      gstin,
      pan,
      billingAddress,
      shippingAddress,
      stateCode,
      city,
      stateName,

      warehouseId,
      warehouseName,

      creditLimit,
      creditDays,
      openingBalance,
      mobile,
      email,
      isActive,
    } = req.body;

    console.log("REQ BODY", req.body);

    const company_id = req.user.company_id;

    // ✅ Validation
    if (!name || !type) {
      return res.status(400).json({
        success: false,
        message: 'Name and type are required',
      });
    }

    const cleanName = name.trim();

    // 🔍 Duplicate check (case-insensitive)
    const existing = await connectDB.query(
      `SELECT 1 FROM parties 
       WHERE LOWER(name) = LOWER($1) AND company_id = $2`,
      [cleanName, company_id],
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Party with this name already exists',
      });
    }

    // ✅ Defaults
    const finalIsRegistered = isRegistered ?? false;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO parties
      (
  company_id,
  name,
  type,
  is_registered,
  gstin,
  pan,
  billing_address,
  shipping_address,
  state_code,
  city,
  state_name,

  warehouse_id,
  warehouse_name,

  credit_limit,
  credit_days,
  opening_balance,
  phone,
  email,
  is_active
)

VALUES (
  $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
  $12,$13,
  $14,$15,$16,$17,$18,$19
)
      RETURNING *`,
      [
        company_id,
        cleanName,
        type,
        finalIsRegistered,
        gstin || null,
        pan || null,
        billingAddress || null,
        shippingAddress || null,
        stateCode,
        city || null,
        stateName || null,

        warehouseId || null,
        warehouseName || null,

        creditLimit ?? 0,
        creditDays ?? 0,
        openingBalance ?? 0,
        mobile || null,
        email || null,
        isActive ?? true,
      ],
    );

    res.status(201).json({
      success: true,
      message: 'Party created successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const updateParty = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      type,
      isRegistered,
      gstin,
      pan,
      billingAddress,
      shippingAddress,
      stateCode,
      city,
      warehouseId,
      warehouseName,
      stateName,
      creditLimit,
      creditDays,
      openingBalance,
      mobile,
      email,
      isActive,
    } = req.body;

    const company_id = req.user.company_id;

    // 🔍 Get existing party
    const existingRes = await connectDB.query(
      'SELECT * FROM parties WHERE id = $1 AND company_id = $2',
      [id, company_id],
    );

    if (existingRes.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Party not found',
      });
    }

    const existing = existingRes.rows[0];

    // ✅ Use old values if not provided
    const finalName = name?.trim() || existing.name;
    const finalType = type || existing.type;
    const finalIsRegistered = isRegistered ?? existing.is_registered;
    const finalIsActive = isActive ?? existing.is_active;

    const finalGstin = finalIsRegistered ? (gstin ?? existing.gstin) : null;

    // 🔍 Duplicate check (exclude self)
    const duplicate = await connectDB.query(
      `SELECT 1 FROM parties 
       WHERE LOWER(name) = LOWER($1)
       AND company_id = $2
       AND id != $3`,
      [finalName, company_id, id],
    );

    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Another party with this name already exists',
      });
    }

    // ✅ Update
    const result = await connectDB.query(
      `UPDATE parties SET
     name = $1,
     type = $2,
     is_registered = $3,
     gstin = $4,
     pan = $5,
     billing_address = $6,
     shipping_address = $7,
     state_code = $8,
     city = $9,
     state_name = $10,
     warehouse_id = $11,
     warehouse_name = $12,
     credit_limit = $13,
     credit_days = $14,
     opening_balance = $15,
     phone = $16,
     email = $17,
     is_active = $18
   WHERE id = $19 AND company_id = $20
   RETURNING *`,
      [
        finalName, // $1
        finalType, // $2
        finalIsRegistered, // $3
        finalGstin, // $4
        pan ?? existing.pan, // $5
        billingAddress ?? existing.billing_address, // $6
        shippingAddress ?? existing.shipping_address, // $7
        stateCode ?? existing.state_code, // $8
        city ?? existing.city, // $9
        stateName ?? existing.state_name, // $10
        warehouseId ?? existing.warehouse_id, // $11
        warehouseName ?? existing.warehouse_name, // $12
        creditLimit ?? existing.credit_limit, // $13
        creditDays ?? existing.credit_days, // $14
        openingBalance ?? existing.opening_balance, // $15
        mobile ?? existing.phone, // $16
        email ?? existing.email, // $17
        finalIsActive, // $18
        id, // $19
        company_id, // $20
      ],
    );

    res.json({
      success: true,
      message: 'Party updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getPartyById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `SELECT * FROM parties WHERE id = $1 AND company_id = $2`,
      [id, company_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Party not found',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const deleteParty = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `DELETE FROM parties 
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, company_id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Party not found',
      });
    }

    res.json({
      success: true,
      message: 'Party permanently deleted',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getAllParties = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `SELECT * FROM parties
       WHERE company_id = $1`,
      [company_id],
    );

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// export const filterParties = async (req, res) => {
//   try {
//     const company_id = req.user.company_id;

//     // Query parameters
//     const { type, isActive, search, warehouse_id } = req.query;
//     console.log('REQ QUERY:', req.query);
//     console.log('TYPE:', type);

//     // Base query
//     let query = `SELECT * FROM parties WHERE company_id = $1`;
//     const values = [company_id];
//     let index = 2;

//     const typeMap = {
//       customer: 'Customer',
//       supplier: 'Supplier',
//       both: 'Both',
//     };

//     if (type && type.toLowerCase() !== 'all') {
//       const mappedType = typeMap[type.toLowerCase()];

//       if (!mappedType) {
//         return res.status(400).json({
//           success: false,
//           message: 'Invalid type',
//         });
//       }

//       query += ` AND type = $${index}`;
//       values.push(mappedType);
//       index++;
//     }

//     // 🔹 Filter by active status
//     if (isActive !== undefined) {
//       query += ` AND is_active = $${index}`;
//       values.push(isActive === 'true'); // Convert string to boolean
//       index++;
//     }

//     // 🔹 Search by name, phone, or gstin
//     if (search) {
//       const searchTerm = search.trim();
//       query += ` AND (
//         LOWER(name) LIKE LOWER($${index}) OR
//         phone ILIKE $${index} OR
//         gstin ILIKE $${index}
//       )`;
//       values.push(`%${searchTerm}%`);
//       index++;
//     }

//     // 🔹 Sort by creation date
//     query += ` ORDER BY created_at DESC`;

//     const result = await connectDB.query(query, values);

//     res.json({
//       success: true,
//       count: result.rows.length,
//       data: result.rows,
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: 'Server error' });
//   }
// };



// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// Frontend sends lowercase ('customer','supplier','both')
// DB stores Title Case ('Customer','Supplier','Both')
const TYPE_MAP = {
  customer: "Customer",
  supplier: "Supplier",
  both: "Both",
};

// ─── Controller ───────────────────────────────────────────────────────────────

export const filterParties = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    // FIX: frontend sends warehouseId (camelCase) — support both spellings
    const {
      type,
      isActive,
      search,
      warehouseId,
      warehouse_id,
    } = req.query;

    // Normalise — accept either casing from callers
    const resolvedWarehouseId = warehouseId || warehouse_id || null;

    // ── Warehouse validation ───────────────────────────────────────────────
    // Validate BEFORE building SQL so param positions are stable.
    const scopedWarehouse =
      resolvedWarehouseId &&
        resolvedWarehouseId.toUpperCase() !== "ALL" &&
        isUuid(resolvedWarehouseId)
        ? resolvedWarehouseId
        : null;

    // ── Param array ───────────────────────────────────────────────────────
    // $1 = company_id (always)
    // $2 = warehouseId (pushed immediately when scoped, so any $2 ref is safe)
    // $3+ = remaining filters in order
    const values = [company_id];
    let idx = 2;

    if (scopedWarehouse) {
      values.push(scopedWarehouse); // $2
      idx = 3;
    }

    // ── Base query ────────────────────────────────────────────────────────
    // FIX: explicit column list instead of SELECT * so added columns
    // (e.g. warehouse_name) don't silently break mapApiToParty on the frontend.
    let query = `
      SELECT * FROM parties WHERE company_id = $1`;

    // ── Warehouse filter ──────────────────────────────────────────────────
    // warehouse_id is a direct column on parties (same pattern as items).
    if (scopedWarehouse) {
      query += ` AND warehouse_id = $2`;
    }

    // ── Type filter ───────────────────────────────────────────────────────
    // FIX: original returned 400 for unknown types — silently ignore instead
    // so a stale frontend value never breaks the whole page load.
    if (type && type.toLowerCase() !== "all") {
      const mappedType = TYPE_MAP[type.toLowerCase()];
      if (mappedType) {
        query += ` AND type = $${idx}`;
        values.push(mappedType);
        idx++;
      }
      // unknown type value → safely ignored (no crash, no 400)
    }

    // ── Active flag ───────────────────────────────────────────────────────
    if (typeof isActive === "string" && isActive.toLowerCase() !== "all") {
      query += ` AND is_active = $${idx}`;
      values.push(isActive.toLowerCase() === "true");
      idx++;
    }

    // ── Search ────────────────────────────────────────────────────────────
    if (search && search.trim()) {
      query += ` AND (
        name  ILIKE $${idx} OR
        phone ILIKE $${idx} OR
        gstin ILIKE $${idx}
      )`;
      values.push(`%${search.trim()}%`);
      idx++;
    }

    // ── Order ─────────────────────────────────────────────────────────────
    query += ` ORDER BY created_at DESC`;

    // ── Execute ───────────────────────────────────────────────────────────
    const result = await connectDB.query(query, values);

    return res.json({ success: true, count: result.rows.length, data: result.rows, });

  } catch (error) {
    console.error("filterParties error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getSuppliers = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { isActive, search, warehouse_id, warehouseId } = req.query;

    let query = `
      SELECT * FROM parties
      WHERE company_id = $1
      AND type = ANY($2)
    `;

    const values = [company_id, ['Supplier', 'Both']];
    let index = 3;

    const resolvedWarehouseId = warehouse_id || warehouseId;
    if (resolvedWarehouseId && resolvedWarehouseId !== 'ALL') {
      query += ` AND warehouse_id = $${index}`;
      values.push(resolvedWarehouseId);
      index++;
    }

    // 🔹 Active filter
    if (isActive !== undefined) {
      query += ` AND is_active = $${index}`;
      values.push(isActive === 'true');
      index++;
    }

    // 🔹 Search
    if (search) {
      query += ` AND (
        LOWER(name) LIKE LOWER($${index}) OR
        phone ILIKE $${index} OR
        gstin ILIKE $${index}
      )`;
      values.push(`%${search}%`);
      index++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await connectDB.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Suppliers Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { isActive, search } = req.query;

    let query = `
      SELECT * FROM parties
      WHERE company_id = $1
      AND type = ANY($2)
    `;

    const values = [company_id, ['Customer', 'Both']];
    let index = 3;

    // 🔹 Active filter
    if (isActive !== undefined) {
      query += ` AND is_active = $${index}`;
      values.push(isActive === 'true');
      index++;
    }

    // 🔹 Search
    if (search) {
      query += ` AND (
        LOWER(name) LIKE LOWER($${index}) OR
        phone ILIKE $${index} OR
        gstin ILIKE $${index}
      )`;
      values.push(`%${search}%`);
      index++;
    }

    query += ` ORDER BY created_at DESC`;

    const result = await connectDB.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows,
    });
  } catch (error) {
    console.error('Get Suppliers Error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
