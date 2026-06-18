import pool from "../../pool.js";

const DOC_TYPE_CONFIG = {
  SALES_INVOICE: {
    table:      "sales_invoices",
    idCol:      "id",
    numberCol:  "invoice_number",
  },
  CHALLAN: {
    table:      "challans",
    idCol:      "id",
    numberCol:  "challan_number",
  },
  PURCHASE_RETURN: {
    table:      "purchase_returns",
    idCol:      "id",
    numberCol:  "return_number",
  },
  PURCHASE_INVOICE: {
    table:      "purchase_invoices",
    idCol:      "id",
    numberCol:  "invoice_number",
  },
  GRN: {
    table:      "grns",
    idCol:      "id",
    numberCol:  "grn_number",
  },
  SALES_RETURN: {
    table:      "sale_returns",
    idCol:      "id",
    numberCol:  "return_number",
  },
  PURCHASE_ORDER: {
    table:      "purchase_orders",
    idCol:      "id",
    numberCol:  "po_number",
  },
  STOCK_TRANSFER: {
    table:      "stock_transfers",
    idCol:      "id",
    numberCol:  "transfer_number",
  },
};
 

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const resolveLinkedDocLabels = async (gatePasses) => {
  const byType = {};

  for (const gp of gatePasses) {
    if (!gp.linkedDocType || !gp.linkedDocNumber) continue;
    if (!DOC_TYPE_CONFIG[gp.linkedDocType]) continue;
    if (!UUID_RE.test(gp.linkedDocNumber)) continue; // ← skip non-UUID values
    if (!byType[gp.linkedDocType]) byType[gp.linkedDocType] = new Set();
    byType[gp.linkedDocType].add(gp.linkedDocNumber);
  }

  const labelMap = {};

  await Promise.all(
    Object.entries(byType).map(async ([docType, idSet]) => {
      const cfg = DOC_TYPE_CONFIG[docType];
      const ids = Array.from(idSet);

      try {
        const { rows } = await pool.query(
          `SELECT ${cfg.idCol} AS id, ${cfg.numberCol} AS number
           FROM ${cfg.table}
           WHERE ${cfg.idCol} = ANY($1::uuid[])`,
          [ids]
        );

        labelMap[docType] = {};
        for (const row of rows) {
          labelMap[docType][row.id] = row.number;
        }
      } catch (err) {
        console.warn(`resolveLinkedDocLabels: failed for ${docType}:`, err.message);
        labelMap[docType] = {};
      }
    })
  );

  return gatePasses.map((gp) => {
    if (!gp.linkedDocType || !gp.linkedDocNumber) {
      return { ...gp, linkedDocLabel: null };
    }
    const typeMap = labelMap[gp.linkedDocType] || {};
    return {
      ...gp,
      linkedDocLabel: typeMap[gp.linkedDocNumber] || null,
    };
  });
};

const resolveCompanyId = async (user) => {
  if (user?.company_id) return user.company_id;
  if (user?.companyId)  return user.companyId;
  if (!user?.id)        return null;
  const { rows } = await pool.query(
    `SELECT company_id FROM users WHERE id = $1 LIMIT 1`,
    [user.id]
  );
  return rows[0]?.company_id || null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const buildPartyCondition = (partyId, partyName, values, idx) => {
  if (partyId) {
    values.push(partyId);
    return { clause: `AND p.id = $${idx}`, nextIdx: idx + 1 };
  }
  if (partyName) {
    values.push(partyName.trim());
    return { clause: `AND LOWER(p.name) = LOWER($${idx})`, nextIdx: idx + 1 };
  }
  return { clause: '', nextIdx: idx };
};

const groupBy = (arr, key) =>
  arr.reduce((acc, row) => {
    const k = row[key];
    if (!acc[k]) acc[k] = [];
    acc[k].push(row);
    return acc;
  }, {});

const normaliseItem = (row) => ({
  item_id:  row.item_id   || null,
  itemName: row.item_name || "",
  qty:      Number(row.qty || 0),
  unit:     row.unit      || "Pcs",
});

/**
 * For each doc in `docs`, look up how much qty has already been gate-passed
 * (across any INWARD or OUTWARD GP, ignoring DELETED/REJECTED ones).
 *
 * Returns a filtered + qty-reduced array:
 *  - Items with 0 remaining qty are removed from the doc.items array.
 *  - Docs with no remaining items are removed entirely.
 *  - Docs with some remaining items show those items with reduced qty
 *    and carry a `partiallyConsumed: true` flag so the UI can show a hint.
 *
 * Match is on item_name (case-insensitive) because gate_pass_items stores
 * the name as text, not a FK.  Where item_id is available we prefer that.
 *
 * @param {string} company_id
 * @param {string} linkedDocType  - the value stored in gate_passes.linked_doc_type
 * @param {Array}  docs           - already-normalised LinkedDocOption[]
 */
const applyGPConsumption = async (company_id, linkedDocType, docs) => {
  if (!docs.length) return docs;

  const docIds = docs.map((d) => d.id);

  // Pull all non-deleted, non-rejected GPs that reference these docs.
  // We match on linked_doc_number = doc.id (UUID stored as text in the column).
  const { rows: gpRows } = await pool.query(
    `SELECT gp.id          AS gp_id,
            gp.linked_doc_number,
            gpi.item_name,
            gpi.qty
     FROM gate_passes gp
     JOIN gate_pass_items gpi ON gpi.gp_id = gp.id
     WHERE gp.company_id       = $1
       AND gp.linked_doc_type  = $2
       AND gp.linked_doc_number = ANY($3::text[])
       AND COALESCE(gp.is_deleted, false) = false
       AND gp.verification_status <> 'REJECTED'`,
    [company_id, linkedDocType, docIds]
  );

  // Build a map:  docId → { itemNameLower → totalIssuedQty }
  const issuedMap = {};
  for (const row of gpRows) {
    const docId = row.linked_doc_number;
    if (!issuedMap[docId]) issuedMap[docId] = {};
    const key = (row.item_name || "").toLowerCase();
    issuedMap[docId][key] = (issuedMap[docId][key] || 0) + Number(row.qty);
  }

  const result = [];

  for (const doc of docs) {
    const issued = issuedMap[doc.id] || {};

    const remainingItems = doc.items
      .map((item) => {
        const key  = (item.itemName || "").toLowerCase();
        const used = issued[key] || 0;
        const remaining = Math.max(0, item.qty - used);
        if (remaining <= 0) return null;           // fully consumed → drop
        return { ...item, qty: remaining };
      })
      .filter(Boolean);

    // If every item is fully consumed, skip the doc entirely.
    if (!remainingItems.length) continue;

    // Flag so the frontend can show "X of Y remaining" if desired.
    const partiallyConsumed =
      remainingItems.length < doc.items.length ||
      remainingItems.some((ri) => {
        const orig = doc.items.find(
          (i) => i.itemName.toLowerCase() === ri.itemName.toLowerCase()
        );
        return orig && ri.qty < orig.qty;
      });

    result.push({ ...doc, items: remainingItems, partiallyConsumed });
  }

  return result;
};

// ─── Handler ──────────────────────────────────────────────────────────────────

export const getLinkedDocs = async (req, res) => {
  const { docType, partyId, partyName } = req.query;

  if (!docType) {
    return res.status(400).json({ success: false, message: "docType is required" });
  }

  const company_id = await resolveCompanyId(req.user);
  if (!company_id) {
    return res.status(401).json({ success: false, message: "Company context missing" });
  }

  try {
    let docs = [];

    // ── SALES INVOICE ─────────────────────────────────────────────────────────
    if (docType === "SALES_INVOICE") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT si.id, si.invoice_number AS number, p.id AS party_id, p.name AS party_name
         FROM sales_invoices si
         LEFT JOIN parties p ON p.id = si.customer_id
         WHERE si.company_id = $1
           AND COALESCE(si.is_active, true) = true
           ${clause}
         ORDER BY si.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT sii.sales_invoice_id AS doc_id,
                  sii.item_id,
                  i.name  AS item_name,
                  sii.quantity AS qty,
                  sii.unit
           FROM sales_invoice_items sii
           LEFT JOIN items i ON i.id = sii.item_id
           WHERE sii.sales_invoice_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── DELIVERY CHALLAN ──────────────────────────────────────────────────────
    else if (docType === "CHALLAN") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT dc.id, dc.challan_number AS number, p.id AS party_id, p.name AS party_name
         FROM challans dc
         LEFT JOIN parties p ON p.id = dc.customer_id
         WHERE dc.company_id = $1
           AND COALESCE(dc.is_active, true) = true
           ${clause}
         ORDER BY dc.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT dci.challan_id AS doc_id,
                  dci.item_id,
                  i.name AS item_name,
                  dci.quantity AS qty,
                  dci.unit
           FROM challan_items dci
           LEFT JOIN items i ON i.id = dci.item_id
           WHERE dci.challan_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── PURCHASE RETURN ───────────────────────────────────────────────────────
    else if (docType === "PURCHASE_RETURN") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT pr.id, pr.return_number AS number, p.id AS party_id, p.name AS party_name
         FROM purchase_returns pr
         LEFT JOIN parties p ON p.id = pr.supplier_id
         WHERE pr.company_id = $1
           ${clause}
         ORDER BY pr.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT pri.return_id AS doc_id,
                  pri.item_id,
                  pri.item_name,
                  pri.return_qty AS qty,
                  pri.unit_name AS unit
           FROM purchase_return_items pri
           WHERE pri.return_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── GRN ───────────────────────────────────────────────────────────────────
    else if (docType === "GRN") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT g.id, g.grn_number AS number, p.id AS party_id, p.name AS party_name
         FROM grns g
         LEFT JOIN parties p ON p.id = g.supplier_id
         WHERE g.company_id = $1
           ${clause}
         ORDER BY g.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT gi.grn_id AS doc_id,
                  gi.item_id,
                  i.name AS item_name,
                  gi.quantity AS qty,
                  gi.unit_name AS unit
           FROM grn_items gi
           LEFT JOIN items i ON i.id = gi.item_id
           WHERE gi.grn_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── SALES RETURN ──────────────────────────────────────────────────────────
    else if (docType === "SALES_RETURN") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT sr.id, sr.return_number AS number, p.id AS party_id, p.name AS party_name
         FROM sale_returns sr
         LEFT JOIN parties p ON p.id = sr.customer_id
         WHERE sr.company_id = $1
           AND sr.is_active = true
           ${clause}
         ORDER BY sr.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT sri.sale_return_id AS doc_id,
                  sri.item_id,
                  i.name AS item_name,
                  sri.return_qty AS qty,
                  i.unit_name AS unit
           FROM sale_return_items sri
           LEFT JOIN items i ON i.id = sri.item_id
           WHERE sri.sale_return_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── PURCHASE ORDER ────────────────────────────────────────────────────────
    else if (docType === "PURCHASE_ORDER") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT po.id, po.po_number AS number, p.id AS party_id, p.name AS party_name
         FROM purchase_orders po
         LEFT JOIN parties p ON p.id = po.supplier_id
         WHERE po.company_id = $1
           ${clause}
         ORDER BY po.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT poi.po_id AS doc_id,
                  poi.item_id,
                  poi.item_name,
                  poi.ordered_qty AS qty,
                  poi.unit_name AS unit
           FROM purchase_order_items poi
           WHERE poi.po_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── STOCK TRANSFER ────────────────────────────────────────────────────────
    else if (docType === "STOCK_TRANSFER") {
      const { rows: headers } = await pool.query(
        `SELECT st.id,
                st.transfer_number AS number,
                NULL::uuid AS party_id,
                '' AS party_name
         FROM stock_transfers st
         WHERE st.company_id = $1
         ORDER BY st.created_at DESC
         LIMIT 200`,
        [company_id]
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT sti.transfer_id AS doc_id,
                  sti.item_id,
                  i.name AS item_name,
                  sti.quantity AS qty,
                  'Pcs' AS unit
           FROM stock_transfer_items sti
           LEFT JOIN items i ON i.id = sti.item_id
           WHERE sti.transfer_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   null,
          partyName: "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    // ── PURCHASE INVOICE ──────────────────────────────────────────────────────
    else if (docType === "PURCHASE_INVOICE") {
      const values = [company_id];
      let idx = 2;
      const { clause, nextIdx } = buildPartyCondition(partyId, partyName, values, idx);
      idx = nextIdx;

      const { rows: headers } = await pool.query(
        `SELECT pi.id,
                pi.invoice_number AS number,
                p.id AS party_id,
                p.name AS party_name
         FROM purchase_invoices pi
         LEFT JOIN parties p ON p.id = pi.supplier_id
         WHERE pi.company_id = $1
           ${clause}
         ORDER BY pi.created_at DESC
         LIMIT 200`,
        values
      );

      if (headers.length) {
        const ids = headers.map((h) => h.id);
        const { rows: items } = await pool.query(
          `SELECT pii.invoice_id AS doc_id,
                  pii.item_id,
                  pii.item_name,
                  pii.qty,
                  pii.unit_name AS unit
           FROM purchase_invoice_items pii
           WHERE pii.invoice_id = ANY($1::uuid[])`,
          [ids]
        );
        const itemMap = groupBy(items, "doc_id");
        docs = headers.map((h) => ({
          id:        h.id,
          number:    h.number,
          partyId:   h.party_id,
          partyName: h.party_name || "",
          items:     (itemMap[h.id] || []).map(normaliseItem),
        }));
      }
    }

    else {
      return res.status(400).json({
        success: false,
        message: `Unknown docType: ${docType}`,
      });
    }

    // ── Apply GP consumption filter ───────────────────────────────────────────
    // This removes fully-consumed docs and reduces qty on partially-consumed items.
    const filtered = await applyGPConsumption(company_id, docType, docs);

    return res.status(200).json({ success: true, data: filtered });

  } catch (err) {
    console.error("getLinkedDocs error:", err);
    return res.status(500).json({ success: false, message: err.message || "Internal server error" });
  }
};

