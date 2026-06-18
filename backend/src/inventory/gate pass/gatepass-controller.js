import pool from "../../pool.js";
import { resolveLinkedDocLabels } from "./LinkedDocs-controller.js";


const VALID_TYPES = ["INWARD", "OUTWARD"];
const VALID_PURPOSES = [
  "SALE", "TRANSFER", "RETURN", "SAMPLE", "OTHER",
  "PURCHASE", "SALE_RETURN", "TRANSFER_IN",
];
const VALID_VER_STATUSES = ["PENDING", "VERIFIED", "REJECTED"];

const STATUS_MAP = {
  INWARD: {
    default: "RECEIVED",
    linked: "LINKED",
  },
  OUTWARD: {
    default: "OPEN",
    closed: "CLOSED",
    returned: "RETURNED",
    overdue: "OVERDUE",
  },
};

// Valid status transitions — prevents illegal state mutations
const ALLOWED_TRANSITIONS = {
  // INWARD
  RECEIVED: ["LINKED"],
  LINKED: [],                         // terminal for inward
  // OUTWARD
  OPEN: ["CLOSED", "RETURNED"],
  CLOSED: [],                         // terminal
  RETURNED: [],                         // terminal
  OVERDUE: ["RETURNED"],               // overdue can still be returned
};

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;


const validateGPBody = (body, isUpdate = false) => {
  const errors = [];
  const {
    partyName, vehicleNumber, securityGuard,
    authorisedBy, items, type, purpose,
    isReturnable, expectedReturnDate,
  } = body;

  if (!isUpdate) {
    if (!type || !VALID_TYPES.includes(type))
      errors.push("type must be INWARD or OUTWARD");
    if (!purpose || !VALID_PURPOSES.includes(purpose))
      errors.push(`purpose must be one of: ${VALID_PURPOSES.join(", ")}`);
  }

  if (!isUpdate || partyName !== undefined) {
    if (!partyName?.trim()) errors.push("partyName is required");
  }
  if (!isUpdate || vehicleNumber !== undefined) {
    if (!vehicleNumber?.trim()) errors.push("vehicleNumber is required");
  }
  if (!isUpdate || securityGuard !== undefined) {
    if (!securityGuard?.trim()) errors.push("securityGuard is required");
  }
  if (!isUpdate || authorisedBy !== undefined) {
    if (!authorisedBy?.trim()) errors.push("authorisedBy is required");
  }

  // Items: only validate on create, or when items are explicitly provided
  if (!isUpdate) {
    const validItems = getValidItems(items);
    if (!validItems.length)
      errors.push("At least one valid item (with itemName and qty > 0) is required");
  } else if (items !== undefined) {
    const validItems = getValidItems(items);
    if (!validItems.length)
      errors.push("If items are provided, at least one must have itemName and qty > 0");
  }

  // Returnable validation
  if (isReturnable && !isUpdate && !expectedReturnDate)
    errors.push("expectedReturnDate is required when isReturnable is true");

  return errors;
};


const generateGPNumber = async (client, company_id, type) => {
  const doc_type = type === "INWARD" ? "GP_IN" : "GP_OUT";

  const { rows } = await client.query(
    `INSERT INTO document_sequences (company_id, doc_type, current_value)
     VALUES ($1, $2, 1)
     ON CONFLICT (company_id, doc_type)
     DO UPDATE SET current_value = document_sequences.current_value + 1
     RETURNING current_value`,
    [company_id, doc_type]
  );

  const year = new Date().getFullYear();
  const prefix = type === "INWARD" ? "GP-IN" : "GP-OUT";
  return `${prefix}-${year}-${String(rows[0].current_value).padStart(4, "0")}`;
};

const getValidItems = (items = []) =>
  (Array.isArray(items) ? items : []).filter(
    (i) => i?.itemName?.trim() && Number(i.qty) > 0
  );

/**
 * Inserts gate pass items in a single multi-row INSERT.
 */
const insertGPItems = async (client, gpId, items) => {
  if (!items.length) return;

  const values = [];
  const placeholders = [];

  items.forEach((item, i) => {
    const base = i * 5;
    values.push(
      gpId,
      item.itemName.trim(),
      Number(item.qty),
      item.unit || "Pcs",
      item.description || null
    );
    placeholders.push(
      `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
    );
  });

  await client.query(
    `INSERT INTO gate_pass_items (gp_id, item_name, qty, unit, description)
     VALUES ${placeholders.join(",")}`,
    values
  );
};

/**
 * Applies OVERDUE override: if returnable + past expected return + still OPEN → OVERDUE.
 */
const applyOverdueLogic = (gp) => {
  if (
    gp.is_returnable &&
    gp.status === "OPEN" &&
    gp.expected_return_date &&
    new Date(gp.expected_return_date) < new Date(new Date().toDateString())
  ) {
    return { ...gp, status: "OVERDUE" };
  }
  return gp;
};

/**
 * Formats a DB row into a clean API response object.
 */
const formatGP = (gp) => ({
  id: gp.id,
  companyId: gp.company_id,
  gpNumber: gp.gp_number,
  type: gp.type,
  status: gp.status,
  verificationStatus: gp.verification_status || "PENDING",
  rejectionReason: gp.rejection_reason || null,
  purpose: gp.purpose,
  customPurpose: gp.custom_purpose || null,
  partyName: gp.party_name,
  vehicleNumber: gp.vehicle_number,
  driverName: gp.driver_name || null,
  driverPhone: gp.driver_phone || null,
  securityGuard: gp.security_guard,
  authorisedBy: gp.authorised_by,
  receivedBy: gp.received_by || null,
  isReturnable: gp.is_returnable,
  expectedReturnDate: gp.expected_return_date || null,
  returnedDate: gp.returned_date || null,
  linkedDocType: gp.linked_doc_type || null,
  linkedDocNumber: gp.linked_doc_number || null,
  isRecreated: gp.is_recreated,
  originalGPId: gp.original_gp_id || null,
  isDeleted: gp.is_deleted || false,
  notes: gp.notes || null,
  date: gp.date,
  time: gp.time,
  createdBy: gp.created_by,
  createdAt: gp.created_at,
  updatedAt: gp.updated_at || null,
  linkedDocLabel: gp.linked_doc_label || null,
});

const formatGPItem = (i) => ({
  id: i.id,
  gpId: i.gp_id,
  itemName: i.item_name,
  qty: Number(i.qty),
  unit: i.unit,
  description: i.description || null,
});

/**
 * Parses & clamps pagination params from query string.
 */
const parsePagination = (query) => {
  const page = Math.max(1, parseInt(query.page) || DEFAULT_PAGE);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit) || DEFAULT_LIMIT));
  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

// ─────────────────────────────────────────────────────────────────────────────
// CREATE GATE PASS
// ─────────────────────────────────────────────────────────────────────────────

export const createGatePass = async (req, res) => {
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    // ── Validate ─────────────────────────────────────────────────────────────
    const errors = validateGPBody(req.body);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    await client.query("BEGIN");

    const {
      warehouseId, type, purpose, customPurpose,
      partyName, vehicleNumber,
      driverName, driverPhone,
      securityGuard, authorisedBy, receivedBy,
      isReturnable, expectedReturnDate,
      linkedDocType, linkedDocNumber,
      notes, items,
      date, time,
    } = req.body;

    const validItems = getValidItems(items);
    const gp_number = await generateGPNumber(client, company_id, type);

    // ── Derive status from type + linkedDocNumber ─────────────────────────────
    // INWARD:  has linked doc → LINKED, else → RECEIVED
    // OUTWARD: always → OPEN
    const status =
      type === "INWARD"
        ? linkedDocNumber ? "LINKED" : "RECEIVED"
        : "OPEN";

    // ── Insert gate pass ──────────────────────────────────────────────────────
    const { rows } = await client.query(
      `INSERT INTO public.gate_passes (
         warehouse_id,
         company_id,
         gp_number,
         type,
         status,
         verification_status,
         purpose,
         custom_purpose,
         party_name,
         vehicle_number,
         driver_name,
         driver_phone,
         security_guard,
         authorised_by,
         received_by,
         is_returnable,
         expected_return_date,
         linked_doc_type,
         linked_doc_number,
         notes,
         date,
         time,
         created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         'PENDING',
          $6, $7, $8, $9, $10,
         $11, $12, $13, $14, $15,
         $16, $17, $18,$19,
         COALESCE($20::date, CURRENT_DATE),
         COALESCE($21::time, CURRENT_TIME),
         $22
       ) RETURNING *`,
      [
        warehouseId,
        company_id,                           // $1
        gp_number,                            // $2
        type,                                 // $3
        status,                               // $4
        purpose,                              // $5
        customPurpose || null,         // $6
        partyName.trim(),                     // $7
        vehicleNumber.trim().toUpperCase(),   // $8
        driverName || null,         // $9
        driverPhone || null,         // $10
        securityGuard.trim(),                 // $11
        authorisedBy.trim(),                  // $12
        receivedBy || null,         // $13
        isReturnable ?? false,        // $14
        expectedReturnDate || null,         // $15
        linkedDocType || null,         // $16
        linkedDocNumber || null,         // $17  ← UUID stored here
        notes || null,         // $18
        date || null,         // $19
        time || null,         // $20
        req.user.id,                          // $21
      ]
    );

    const gp = rows[0];

    // ── Insert items ──────────────────────────────────────────────────────────
    // gate_pass_items has: gp_id, item_name, qty, unit, description
    // NO item_id column in the table — item_id from frontend is intentionally dropped
    if (validItems.length > 0) {
      const itemValues = validItems.map((_, idx) => {
        const base = idx * 5;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
      }).join(', ');

      const itemParams = validItems.flatMap((item) => [
        gp.id,
        item.itemName?.trim() || item.item_name?.trim(),
        Number(item.qty) || 1,
        item.unit || 'Pcs',
        item.description || null,
      ]);

      await client.query(
        `INSERT INTO public.gate_pass_items (gp_id, item_name, qty, unit, description)
         VALUES ${itemValues}`,
        itemParams
      );
    }

    await client.query("COMMIT");

    // ── Fetch inserted items and return ───────────────────────────────────────
    const { rows: itemsRows } = await pool.query(
      `SELECT * FROM public.gate_pass_items WHERE gp_id = $1 ORDER BY id`,
      [gp.id]
    );

    return res.status(201).json({
      success: true,
      data: {
        ...formatGP(gp),
        items: itemsRows.map(formatGPItem),
      },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};



export const updateGatePass = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    // ── Validate ────────────────────────────────────────────────────────────
    const errors = validateGPBody(req.body, true);
    if (errors.length) {
      return res.status(400).json({ success: false, errors });
    }

    await client.query("BEGIN");

    const { rows: existing } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false",
      [id, company_id]
    );

    if (!existing.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    const gp = existing[0];

    // Block updates on terminal statuses
    const terminalStatuses = ["RETURNED", "CLOSED"];
    if (terminalStatuses.includes(gp.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Gate pass is ${gp.status} and cannot be modified`,
      });
    }

    const {
      purpose, customPurpose,
      partyName, vehicleNumber,
      driverName, driverPhone,
      securityGuard, authorisedBy, receivedBy,
      isReturnable, expectedReturnDate,
      linkedDocType, linkedDocNumber,
      notes, items,
      date, time,
    } = req.body;

    // Recalculate inward status if linked doc changes
    let status = gp.status;
    if (gp.type === "INWARD" && linkedDocNumber !== undefined) {
      status = linkedDocNumber
        ? STATUS_MAP.INWARD.linked
        : STATUS_MAP.INWARD.default;
    }

    const { rows: updated } = await client.query(
      `UPDATE gate_passes SET
         purpose              = COALESCE($1,  purpose),
         custom_purpose       = COALESCE($2,  custom_purpose),
         party_name           = COALESCE($3,  party_name),
         vehicle_number       = COALESCE($4,  vehicle_number),
         driver_name          = COALESCE($5,  driver_name),
         driver_phone         = COALESCE($6,  driver_phone),
         security_guard       = COALESCE($7,  security_guard),
         authorised_by        = COALESCE($8,  authorised_by),
         received_by          = COALESCE($9,  received_by),
         is_returnable        = COALESCE($10, is_returnable),
         expected_return_date = COALESCE($11, expected_return_date),
         linked_doc_type      = COALESCE($12, linked_doc_type),
         linked_doc_number    = COALESCE($13, linked_doc_number),
         status               = $14,
         notes                = COALESCE($15, notes),
         date                 = COALESCE($16::date, date),
         time                 = COALESCE($17::time, time),
         updated_at           = NOW()
       WHERE id=$18 AND company_id=$19
       RETURNING *`,
      [
        purpose || null,
        customPurpose || null,
        partyName ? partyName.trim() : null,
        vehicleNumber ? vehicleNumber.trim().toUpperCase() : null,
        driverName || null,
        driverPhone || null,
        securityGuard ? securityGuard.trim() : null,
        authorisedBy ? authorisedBy.trim() : null,
        receivedBy || null,
        isReturnable ?? null,
        expectedReturnDate || null,
        linkedDocType || null,
        linkedDocNumber || null,
        status,
        notes || null,
        date || null,
        time || null,
        id,
        company_id,
      ]
    );

    if (items?.length) {
      const validItems = getValidItems(items);
      if (validItems.length) {
        await client.query("DELETE FROM gate_pass_items WHERE gp_id=$1", [id]);
        await insertGPItems(client, id, validItems);
      }
    }

    await client.query("COMMIT");

    const { rows: itemRows } = await pool.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1 ORDER BY id",
      [id]
    );

    return res.json({
      success: true,
      data: { ...formatGP(updated[0]), items: itemRows.map(formatGPItem) },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Update Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: error.message });
  } finally {
    client.release();
  }
};



export const getAllGatePasses = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const userId = req.user.id;
       const { page, limit, offset } = parsePagination(req.query);
    const roleRes = await pool.query(
        `SELECT role FROM users WHERE id = $1`,
        [userId]
      );

    const  userRole = roleRes.rows[0]?.role;

    const conditions = ["gp.company_id = $1", "gp.is_deleted = false"];
    const values = [company_id];
    let idx = 2;

    // SECURITY_GUARD can only see gatepasses of assigned warehouses
if (userRole === "SECURITY_GUARD") {

  // fetch assigned warehouses
  const { rows: warehouseRows } = await pool.query(
    `
    SELECT warehouse_id
    FROM user_warehouses
    WHERE user_id = $1
    `,
    [req.user.id]
  );

  const warehouseIds = warehouseRows.map(w => w.warehouse_id);

  // no warehouse assigned
  if (!warehouseIds.length) {
    return res.status(200).json({
      success: true,
      pagination: {
        total: 0,
        page,
        limit,
        totalPages: 0,
      },
      data: [],
    });
  }

  conditions.push(`gp.warehouse_id = ANY($${idx}::uuid[])`);
  values.push(warehouseIds);
  idx++;
}

 
    const {
      type = "",
      status = "",
      search = "",
      from_date = "",
      to_date = "",
      ver_status = "",
    } = req.query;


    if (type && type !== "ALL") {
      conditions.push(`gp.type = $${idx}`);
      values.push(type.toUpperCase());
      idx++;
    }

    if (status && status !== "ALL") {
      if (status.toUpperCase() === "OVERDUE") {
        conditions.push(`(
          gp.status = 'OPEN'
          AND gp.is_returnable = true
          AND gp.expected_return_date < CURRENT_DATE
        )`);
      } else if (status.toUpperCase() === "OPEN") {
        conditions.push(`(
          gp.status = 'OPEN'
          AND NOT (
            gp.is_returnable = true
            AND gp.expected_return_date IS NOT NULL
            AND gp.expected_return_date < CURRENT_DATE
          )
        )`);
      } else {
        conditions.push(`gp.status = $${idx}`);
        values.push(status.toUpperCase());
        idx++;
      }
    }

    if (ver_status && ver_status !== "ALL") {
      conditions.push(`gp.verification_status = $${idx}`);
      values.push(ver_status.toUpperCase());
      idx++;
    }

    if (search) {
      conditions.push(`(
        gp.gp_number      ILIKE $${idx} OR
        gp.party_name     ILIKE $${idx} OR
        gp.vehicle_number ILIKE $${idx}
      )`);
      values.push(`%${search.trim()}%`);
      idx++;
    }

    if (from_date) {
      conditions.push(`gp.date >= $${idx}::date`);
      values.push(from_date);
      idx++;
    }

    if (to_date) {
      conditions.push(`gp.date <= $${idx}::date`);
      values.push(to_date);
      idx++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // ── Count ──────────────────────────────────────────────────────────────────
    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*) AS total FROM gate_passes gp ${whereClause}`,
      values
    );
    const total = Number(countRows[0].total);
    const totalPages = Math.ceil(total / limit);

    // ── Gate passes ────────────────────────────────────────────────────────────
    const { rows } = await pool.query(
      `SELECT gp.*
       FROM gate_passes gp
       ${whereClause}
       ORDER BY gp.created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      [...values, limit, offset]
    );

    if (!rows.length) {
      return res.status(200).json({
        success: true,
        pagination: { total, page, limit, totalPages },
        data: [],
      });
    }

    // ── Fetch ALL items for returned GPs in ONE query ──────────────────────────
    // Uses ANY($1::uuid[]) — single round-trip instead of N queries
    const gpIds = rows.map((r) => r.id);

    const { rows: allItems } = await pool.query(
      `SELECT id, gp_id, item_name, qty, unit, description
   FROM public.gate_pass_items
   WHERE gp_id = ANY($1::uuid[])
   ORDER BY gp_id, id`,
      [gpIds]
    );

    // ── Group items by gp_id for O(1) lookup ──────────────────────────────────
    const itemsByGpId = allItems.reduce((acc, item) => {
      if (!acc[item.gp_id]) acc[item.gp_id] = [];
      acc[item.gp_id].push(formatGPItem(item));
      return acc;
    }, {});

    // ── Format final response ──────────────────────────────────────────────────
     const formatted = rows
    .map(applyOverdueLogic)
    .map((gp) => ({
      ...formatGP(gp),
      itemCount: itemsByGpId[gp.id]?.length ?? 0,
      items: itemsByGpId[gp.id] ?? [],
    }));

  const withLabels = await resolveLinkedDocLabels(formatted);

  return res.status(200).json({
    success: true,
    pagination: { total, page, limit, totalPages },
    data: withLabels,
  });


  } catch (error) {
    console.error("Get All Gate Passes Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};




export const getGatePassById = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const { rows: gpRows } = await pool.query(
      `SELECT *
       FROM gate_passes
       WHERE id = $1
       AND company_id = $2
       AND is_deleted = false`,
      [id, company_id]
    );

    if (!gpRows.length) {
      return res.status(404).json({
        success: false,
        message: "Gate pass not found",
      });
    }

    const gp = applyOverdueLogic(gpRows[0]);

    const { rows: itemRows } = await pool.query(
      `SELECT *
       FROM gate_pass_items
       WHERE gp_id = $1
       ORDER BY id`,
      [id]
    );

    const formattedItems = itemRows.map(formatGPItem);

    const formattedGP = {
      ...formatGP(gp),
      items: formattedItems,
    };

    const [withLabel] = await resolveLinkedDocLabels([formattedGP]);

    return res.status(200).json({
      success: true,
      data: withLabel,
    });

  } catch (error) {
    console.error("Get Gate Pass By ID Error:", error);

    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// SOFT DELETE GATE PASS
// ─────────────────────────────────────────────────────────────────────────────

export const deleteGatePass = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false",
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    await client.query(
      "UPDATE gate_passes SET is_deleted=true, updated_at=NOW() WHERE id=$1",
      [id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      success: true,
      message: `${rows[0].gp_number} deleted successfully`,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Delete Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// MARK AS RETURNED  (NEW)
// ─────────────────────────────────────────────────────────────────────────────

export const markAsReturned = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false FOR UPDATE",
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    const gp = rows[0];

    if (gp.type !== "OUTWARD") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only outward gate passes can be marked as returned",
      });
    }

    if (!gp.is_returnable) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This gate pass is not returnable",
      });
    }

    if (["RETURNED", "CLOSED"].includes(gp.status)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: `Gate pass is already ${gp.status}`,
      });
    }

    const { rows: updated } = await client.query(
      `UPDATE gate_passes
         SET status='RETURNED', returned_date=CURRENT_DATE, updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id]
    );

    await client.query("COMMIT");

    const { rows: itemRows } = await pool.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1 ORDER BY id",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `${gp.gp_number} marked as returned`,
      data: { ...formatGP(updated[0]), items: itemRows.map(formatGPItem) },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Mark As Returned Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// VERIFY GATE PASS  (NEW)
// ─────────────────────────────────────────────────────────────────────────────

export const verifyGatePass = async (req, res) => {
  console.log(" VERIFY API HIT:", req.params.id);
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false FOR UPDATE",
      [id, company_id]
    );

    console.log(" FOUND GP:", rows[0]);

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    const gp = rows[0];

    if (gp.verification_status === "VERIFIED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Gate pass is already verified",
      });
    }

    const { rows: updated } = await client.query(
      `UPDATE gate_passes
         SET verification_status='VERIFIED',
          verified_at = NOW(),
         verified_by = $2,
             rejection_reason=NULL,
             updated_at=NOW()
       WHERE id=$1
       RETURNING *`,
      [id, req.user.id]
    );

    console.log("✅ UPDATED ROW:", updated[0]);

    await client.query("COMMIT");

    const { rows: itemRows } = await pool.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1 ORDER BY id",
      [id]
    );

    console.log("📦 ITEMS:", itemRows);

    return res.status(200).json({
      success: true,
      message: `${gp.gp_number} verified successfully`,
      data: { ...formatGP(updated[0]), items: itemRows.map(formatGPItem) },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Verify Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// REJECT GATE PASS  (NEW)
// ─────────────────────────────────────────────────────────────────────────────

export const rejectGatePass = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    const { rejectionReason } = req.body;

    if (!rejectionReason?.trim()) {
      return res.status(400).json({
        success: false,
        message: "rejectionReason is required when rejecting a gate pass",
      });
    }

    await client.query("BEGIN");

    const { rows } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false FOR UPDATE",
      [id, company_id]
    );

    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    const gp = rows[0];

    if (gp.verification_status === "VERIFIED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cannot reject a gate pass that is already verified",
      });
    }

    const { rows: updated } = await client.query(
      `UPDATE gate_passes
         SET verification_status='REJECTED',
             rejection_reason=$1,
             updated_at=NOW()
       WHERE id=$2
       RETURNING *`,
      [rejectionReason.trim(), id]
    );

    await client.query("COMMIT");

    const { rows: itemRows } = await pool.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1 ORDER BY id",
      [id]
    );

    return res.status(200).json({
      success: true,
      message: `${gp.gp_number} rejected`,
      data: { ...formatGP(updated[0]), items: itemRows.map(formatGPItem) },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Reject Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// RECREATE GATE PASS  (OUTWARD ONLY)
// ─────────────────────────────────────────────────────────────────────────────

export const recreateGatePass = async (req, res) => {
  const { id } = req.params;
  const company_id = req.user.company_id;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows: originalRows } = await client.query(
      "SELECT * FROM gate_passes WHERE id=$1 AND company_id=$2 AND is_deleted=false",
      [id, company_id]
    );

    if (!originalRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Gate pass not found" });
    }

    const original = originalRows[0];

    if (original.type !== "OUTWARD") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only outward gate passes can be recreated",
      });
    }

    if (original.verification_status !== "REJECTED") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only rejected gate passes can be recreated",
      });
    }

    const { rows: originalItems } = await client.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1",
      [id]
    );

    const gp_number = await generateGPNumber(client, company_id, "OUTWARD");

    const { rows: newGPRows } = await client.query(
      `INSERT INTO gate_passes (
         company_id, gp_number, type, status,
         verification_status,
         purpose, custom_purpose,
         party_name, vehicle_number,
         driver_name, driver_phone,
         security_guard, authorised_by,
         is_returnable, expected_return_date,
         linked_doc_type, linked_doc_number,
         is_recreated, original_gp_id,
         notes,
         date, time, created_by
       ) VALUES (
         $1,$2,'OUTWARD','OPEN',
         'PENDING',
         $3,$4,$5,$6,$7,$8,
         $9,$10,$11,$12,$13,$14,
         true, $15,
         $16,
         CURRENT_DATE, CURRENT_TIME, $17
       ) RETURNING *`,
      [
        company_id,
        gp_number,
        original.purpose,
        original.custom_purpose || null,
        original.party_name,
        original.vehicle_number,
        original.driver_name || null,
        original.driver_phone || null,
        original.security_guard,
        original.authorised_by,
        original.is_returnable,
        original.expected_return_date || null,
        original.linked_doc_type || null,
        original.linked_doc_number || null,
        original.id,                          // original_gp_id
        original.notes || null,
        req.user.id,
      ]
    );

    const newGP = newGPRows[0];

    if (originalItems.length) {
      await insertGPItems(
        client,
        newGP.id,
        originalItems.map((i) => ({
          itemName: i.item_name,
          qty: i.qty,
          unit: i.unit,
          description: i.description,
        }))
      );
    }

    // Mark original as recreated (soft-hide it)
    await client.query(
      "UPDATE gate_passes SET is_recreated=true, updated_at=NOW() WHERE id=$1",
      [id]
    );

    await client.query("COMMIT");

    const { rows: newItems } = await pool.query(
      "SELECT * FROM gate_pass_items WHERE gp_id=$1 ORDER BY id",
      [newGP.id]
    );

    return res.status(201).json({
      success: true,
      message: `${gp_number} recreated from ${original.gp_number}`,
      data: { ...formatGP(newGP), items: newItems.map(formatGPItem) },
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Recreate Gate Pass Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GATE PASS STATS  (with OVERDUE logic)
// ─────────────────────────────────────────────────────────────────────────────

export const getGatePassStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const { rows } = await pool.query(
      `SELECT
         COUNT(*) AS total,

         COUNT(*) FILTER (WHERE type = 'INWARD')  AS total_inward,
         COUNT(*) FILTER (WHERE type = 'OUTWARD') AS total_outward,

         -- INWARD
         COUNT(*) FILTER (WHERE type='INWARD' AND status='RECEIVED') AS inward_received,
         COUNT(*) FILTER (WHERE type='INWARD' AND status='LINKED')   AS inward_linked,
         COUNT(*) FILTER (WHERE type='INWARD' AND verification_status='PENDING')  AS inward_pending,

         -- OUTWARD real statuses
         COUNT(*) FILTER (
           WHERE type='OUTWARD' AND status='OPEN'
           AND NOT (
             is_returnable = true
             AND expected_return_date IS NOT NULL
             AND expected_return_date < CURRENT_DATE
           )
         ) AS outward_open,
         COUNT(*) FILTER (WHERE type='OUTWARD' AND status='CLOSED')   AS outward_closed,
         COUNT(*) FILTER (WHERE type='OUTWARD' AND status='RETURNED') AS outward_returned,

         -- OVERDUE = OPEN + returnable + past expected date
         COUNT(*) FILTER (
           WHERE type='OUTWARD'
           AND status='OPEN'
           AND is_returnable = true
           AND expected_return_date IS NOT NULL
           AND expected_return_date < CURRENT_DATE
         ) AS outward_overdue,

         -- Verification
         COUNT(*) FILTER (WHERE verification_status='PENDING')  AS ver_pending,
         COUNT(*) FILTER (WHERE verification_status='VERIFIED') AS ver_verified,
         COUNT(*) FILTER (WHERE verification_status='REJECTED') AS ver_rejected,

         -- This month
         COUNT(*) FILTER (
           WHERE date >= date_trunc('month', CURRENT_DATE)
         ) AS this_month,

         -- Today
         COUNT(*) FILTER (WHERE date = CURRENT_DATE) AS today

       FROM gate_passes
       WHERE company_id=$1 AND is_deleted=false`,
      [company_id]
    );

    const s = rows[0];
    const n = (v) => Number(v || 0);

    return res.status(200).json({
      success: true,
      data: {
        total: n(s.total),
        totalInward: n(s.total_inward),
        totalOutward: n(s.total_outward),
        inward: {
          pending: n(s.inward_pending),
          received: n(s.inward_received),
          linked: n(s.inward_linked),
        },
        outward: {
          open: n(s.outward_open),
          closed: n(s.outward_closed),
          returned: n(s.outward_returned),
          overdue: n(s.outward_overdue),
        },
        verification: {
          pending: n(s.ver_pending),
          verified: n(s.ver_verified),
          rejected: n(s.ver_rejected),
        },
        thisMonth: n(s.this_month),
        today: n(s.today),
      },
    });

  } catch (error) {
    console.error("Gate Pass Stats Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

