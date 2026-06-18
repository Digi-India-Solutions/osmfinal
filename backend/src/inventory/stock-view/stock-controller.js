// import pool from "../../pool.js";

// // ─────────────────────────────────────────────
// // HELPERS
// // ─────────────────────────────────────────────

// const getStockStatus = (totalStock, minStockLevel) => {
//   if (totalStock === 0) return "OUT_OF_STOCK";
//   if (totalStock < minStockLevel) return "LOW_STOCK";
//   if (totalStock === minStockLevel) return "AT_MINIMUM";
//   return "NORMAL";
// };

// const formatStockItem = (row) => {
//   const totalStock = Number(row.total_stock || 0);
//   const minStockLevel = Number(row.min_stock_level || 0);

//   return {
//     id: row.item_id,
//     name: row.item_name,
//     code: row.item_code || null,
//     unit: row.unit_name || null,
//     categoryName: row.category || null,
//     brand: row.brand || null,
//     minStockLevel,
//     totalStock,
//     status: getStockStatus(totalStock, minStockLevel),
//     // warehouseStocks: row.warehouse_stocks || [],
//     warehouseStocks: (row.warehouse_stocks ?? []).map((w) => ({
//       warehouseId: w.warehouse_id,
//       warehouseName: w.warehouse_name,
//       qty: Number(w.qty ?? 0),
//     })),
//   };
// };

// // ─────────────────────────────────────────────
// // GET STOCK (ALL ITEMS + WAREHOUSE BREAKDOWN)
// // ─────────────────────────────────────────────
// // export const getStock = async (req, res) => {
// //   try {
// //     const company_id = req.user.company_id;

// //     const {
// //       search = "",
// //       warehouse_id = "",
// //       status = "",
// //       category_id = "",
// //     } = req.query;

// //     // ─────────────────────────────
// //     // 1. ITEMS + TOTAL STOCK
// //     // ─────────────────────────────
// //     let query = `
// //       SELECT
// //         i.id AS item_id,
// //         i.name AS item_name,
// //         i.code AS item_code,
// //         i.unit_name,
// //         i.category,
// //         i.brand,
// //         i.min_stock_level,
// //         COALESCE(SUM(ws.quantity), 0) AS total_stock
// //       FROM items i
// //       LEFT JOIN warehouse_stock ws
// //         ON ws.item_id = i.id
// //        AND ws.company_id = i.company_id
// //       WHERE i.company_id = $1
// //         AND i.is_active = true
// //     `;

// //     const values = [company_id];
// //     let index = 2;

// //     if (search) {
// //       query += ` AND (i.name ILIKE $${index} OR i.code ILIKE $${index})`;
// //       values.push(`%${search}%`);
// //       index++;
// //     }

// //     if (category_id) {
// //       query += ` AND i.category_id = $${index}`;
// //       values.push(category_id);
// //       index++;
// //     }

// //     query += ` GROUP BY i.id ORDER BY i.name ASC`;

// //     const { rows: items } = await pool.query(query, values);

// //     if (!items.length) {
// //       return res.status(200).json({
// //         success: true,
// //         count: 0,
// //         data: [],
// //       });
// //     }

// //     // ─────────────────────────────
// //     // 2. WAREHOUSE BREAKDOWN
// //     // ─────────────────────────────
// //     const itemIds = items.map((i) => i.item_id);

// //     let whQuery = `
// //       SELECT
// //         ws.item_id,
// //         ws.warehouse_id,
// //         w.name AS warehouse_name,
// //         COALESCE(SUM(ws.quantity), 0) AS quantity
// //       FROM warehouse_stock ws
// //       JOIN warehouses w ON w.id = ws.warehouse_id
// //       WHERE ws.company_id = $1
// //         AND ws.item_id = ANY($2)
// //     `;

// //     const whValues = [company_id, itemIds];

// //     if (warehouse_id) {
// //       whQuery += ` AND ws.warehouse_id = $3`;
// //       whValues.push(warehouse_id);
// //     }

// //     whQuery += ` GROUP BY ws.item_id, ws.warehouse_id, w.name`;

// //     const { rows: whRows } = await pool.query(whQuery, whValues);

// //     // group by item
// //     const grouped = {};

// //     for (const row of whRows) {
// //       if (!grouped[row.item_id]) grouped[row.item_id] = [];

// //       grouped[row.item_id].push({
// //         warehouseId: row.warehouse_id,
// //         warehouseName: row.warehouse_name,
// //         qty: Number(row.quantity || 0),
// //       });
// //     }

// //     // ─────────────────────────────
// //     // 3. FORMAT RESPONSE
// //     // ─────────────────────────────
// //     let result = items.map((item) =>
// //       formatStockItem({
// //         ...item,
// //         warehouse_stocks: grouped[item.item_id] || [],
// //       })
// //     );

// //     // ─────────────────────────────
// //     // 4. STATUS FILTER (JS)
// //     // ─────────────────────────────
// //     if (status && status !== "ALL") {
// //       const normalized = status.toUpperCase();
// //       result = result.filter((i) => i.status === normalized);
// //     }

// //     return res.status(200).json({
// //       success: true,
// //       count: result.length,
// //       data: result,
// //     });
// //   } catch (error) {
// //     console.error("Get Stock Error:", error);
// //     return res.status(500).json({
// //       success: false,
// //       message: "Internal server error",
// //     });
// //   }
// // };



// const UUID_RE =
//   /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// function stockStatus(qty, minLevel) {
//   const q = Number(qty ?? 0);
//   const m = Number(minLevel ?? 0);
//   if (q === 0) return "OUT_OF_STOCK";
//   if (q < m) return "LOW_STOCK";
//   return "IN_STOCK";
// }

// // function formatStockItem(row) {
// //   const qty    = Number(row.total_stock ?? 0);
// //   const status = stockStatus(qty, row.min_stock_level);

// //   return {
// //     itemId:        row.item_id,
// //     name:          row.item_name,
// //     code:          row.item_code,
// //     unitName:      row.unit_name,
// //     category:      row.category,
// //     brand:         row.brand,
// //     minStockLevel: Number(row.min_stock_level ?? 0),
// //     totalStock:    qty,
// //     status,
// //     // Per-warehouse breakdown — parsed from JSON aggregation
// //     warehouseStocks: (row.warehouse_stocks ?? []).map((w) => ({
// //       warehouseId:   w.warehouse_id,
// //       warehouseName: w.warehouse_name,
// //       qty:           Number(w.qty ?? 0),
// //     })),
// //   };
// // }

// // ─── Controller ───────────────────────────────────────────────────────────────

// export const getStock = async (req, res) => {
//   try {
//     const company_id = req.user?.company_id;
//     if (!company_id) {
//       return res.status(401).json({ success: false, message: "Unauthorized" });
//     }

//     const {
//       search = "",
//       warehouse_id = "",
//       status = "",
//       category_id = "",
//     } = req.query;

//     // ── Validate optional UUID params ──────────────────────────────────────
//     // FIX: raw strings were passed into SQL without any validation.
//     const scopedWarehouse =
//       warehouse_id && isUuid(warehouse_id) ? warehouse_id : null;

//     const scopedCategory =
//       category_id && isUuid(category_id) ? category_id : null;

//     // ── Params ────────────────────────────────────────────────────────────
//     // $1 = company_id  (always)
//     // $2 = warehouse_id (pushed immediately when scoped so subquery $2 is safe)
//     // $3+ = remaining filters in declaration order
//     const values = [company_id];
//     let idx = 2;

//     if (scopedWarehouse) {
//       values.push(scopedWarehouse); // $2
//       idx = 3;
//     }



//     let query = `
//       SELECT
//         i.id            AS item_id,
//         i.name          AS item_name,
//         i.code          AS item_code,
//         i.unit_name,
//         i.category,
//         i.brand,
//         i.min_stock_level,

       
//         COALESCE(SUM(
//           CASE
//             WHEN ${scopedWarehouse ? `ws.warehouse_id = $2` : `TRUE`}
//             THEN ws.quantity
//             ELSE 0
//           END
//         ), 0) AS total_stock,

//         -- Full per-warehouse breakdown for every item (always all warehouses).
//         -- Aggregated as JSON so we avoid a second query + JS grouping.
//         COALESCE(
//           json_agg(
//             json_build_object(
//               'warehouse_id',   ws.warehouse_id,
//               'warehouse_name', w.name,
//               'qty',            ws.quantity
//             )
//           ) FILTER (WHERE ws.warehouse_id IS NOT NULL),
//           '[]'
//         ) AS warehouse_stocks

//       FROM items i

//       LEFT JOIN warehouse_stock ws
//         ON  ws.item_id    = i.id
//         AND ws.company_id = i.company_id

//       LEFT JOIN warehouses w
//         ON  w.id          = ws.warehouse_id

//       WHERE i.company_id = $1
//         AND i.is_active   = TRUE
//     `;

//     // ── Search ────────────────────────────────────────────────────────────
//     if (search && search.trim()) {
//       query += ` AND (i.name ILIKE $${idx} OR i.code ILIKE $${idx})`;
//       values.push(`%${search.trim()}%`);
//       idx++;
//     }

//     // ── Category filter ───────────────────────────────────────────────────
//     if (scopedCategory) {
//       query += ` AND i.category_id = $${idx}`;
//       values.push(scopedCategory);
//       idx++;
//     }


//     if (scopedWarehouse) {
//       query += ` AND EXISTS (
//         SELECT 1
//         FROM warehouse_stock wsx
//         WHERE wsx.item_id      = i.id
//           AND wsx.company_id   = i.company_id
//           AND wsx.warehouse_id = $2
//           AND wsx.quantity     > 0
//       )`;
//     }

//     query += `
//       GROUP BY
//         i.id, i.name, i.code, i.unit_name,
//         i.category, i.brand, i.min_stock_level
//       ORDER BY i.name ASC
//     `;

//     const { rows } = await pool.query(query, values);

//     // ── Format ────────────────────────────────────────────────────────────
//     let result = rows.map(formatStockItem);


//     if (status && status.toUpperCase() !== "ALL") {
//       const normalized = status.toUpperCase();
//       if (["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"].includes(normalized)) {
//         result = result.filter((i) => i.status === normalized);
//       }
//       // unknown status value → safely ignored, full list returned
//     }

//     return res.status(200).json({
//       success: true,
//       count: result.length,
//       data: result,
//     });

//   } catch (error) {
//     console.error("getStock error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };
// // ─────────────────────────────────────────────
// // GET LOW STOCK ITEMS
// // ─────────────────────────────────────────────
// export const getLowStock = async (req, res) => {
//   try {
//     const company_id = req.user.company_id;

//     const { rows } = await pool.query(
//       `
//       SELECT
//         i.id AS item_id,
//         i.name AS item_name,
//         i.code AS item_code,
//         i.unit_name,
//         i.category,
//         i.brand,
//         i.min_stock_level,
//         COALESCE(SUM(ws.quantity), 0) AS total_stock
//       FROM items i
//       LEFT JOIN warehouse_stock ws
//         ON ws.item_id = i.id
//        AND ws.company_id = i.company_id
//       WHERE i.company_id = $1
//         AND i.is_active = true
//       GROUP BY i.id
//       HAVING COALESCE(SUM(ws.quantity), 0) <= i.min_stock_level
//       ORDER BY total_stock ASC, i.name ASC
//       `,
//       [company_id]
//     );

//     const data = rows.map((r) =>
//       formatStockItem({
//         ...r,
//         warehouse_stocks: [],
//       })
//     );

//     return res.status(200).json({
//       success: true,
//       count: data.length,
//       data,
//     });
//   } catch (error) {
//     console.error("Get Low Stock Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

// // ─────────────────────────────────────────────
// // GET STOCK STATS
// // ─────────────────────────────────────────────
// export const getStockStats = async (req, res) => {
//   try {
//     const company_id = req.user.company_id;

//     const { rows } = await pool.query(
//       `
//       SELECT
//         COUNT(DISTINCT i.id) AS total_items,

//         COUNT(DISTINCT i.id) FILTER (
//           WHERE COALESCE(ws.total_stock, 0) = 0
//         ) AS out_of_stock,

//         COUNT(DISTINCT i.id) FILTER (
//           WHERE COALESCE(ws.total_stock, 0) > 0
//             AND COALESCE(ws.total_stock, 0) < i.min_stock_level
//         ) AS low_stock,

//         COUNT(DISTINCT i.id) FILTER (
//           WHERE COALESCE(ws.total_stock, 0) >= i.min_stock_level
//             AND i.min_stock_level > 0
//         ) AS normal,

//         COALESCE(SUM(ws.total_stock), 0) AS total_stock_qty

//       FROM items i
//       LEFT JOIN (
//         SELECT item_id, SUM(quantity) AS total_stock
//         FROM warehouse_stock
//         WHERE company_id = $1
//         GROUP BY item_id
//       ) ws ON ws.item_id = i.id

//       WHERE i.company_id = $1
//         AND i.is_active = true
//       `,
//       [company_id]
//     );

//     const s = rows[0];

//     return res.status(200).json({
//       success: true,
//       data: {
//         totalItems: Number(s.total_items),
//         outOfStock: Number(s.out_of_stock),
//         lowStock: Number(s.low_stock),
//         normal: Number(s.normal),
//         totalStockQty: Number(s.total_stock_qty),
//       },
//     });
//   } catch (error) {
//     console.error("Stock Stats Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Internal server error",
//     });
//   }
// };

import pool from "../../pool.js";

// ─── Schema (from IMS_BACKUP.sql) ────────────────────────────────────────────
//
// warehouse_stock: id, company_id, warehouse_id, item_id, quantity, updated_at, created_at
//                 UNIQUE(company_id, warehouse_id, item_id)
//
// warehouses:     id, company_id, name, type, address, incharge_name,
//                 incharge_phone, incharge_user_id, color, is_active,
//                 created_by, created_at
//
// items:          id, company_id, name, code, barcode, category_id, category,
//                 brand, hsn_code, gst_rate, primary_unit_id, purchase_rate,
//                 sale_rate, mrp, min_stock_level, article_no, size_color,
//                 image_url, is_active, created_at, created_by, unit_name,
//                 warehouseid   ← no underscore
//
// stock_adjustments: id, company_id, warehouse_id, item_id, adjustment_number,
//                    adjustment_date, type (INCREASE|DECREASE), quantity,
//                    reason, created_by, approved_by, created_at
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const isUuid = (v) => typeof v === "string" && UUID_RE.test(v);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getStockStatus = (qty, min) => {
  const q = Number(qty ?? 0);
  const m = Number(min ?? 0);
  if (q === 0)  return "OUT_OF_STOCK";
  if (q < m)    return "LOW_STOCK";
  if (q === m)  return "AT_MINIMUM";
  return "NORMAL";
};

const formatStockItem = (row) => {
  const totalStock   = Number(row.total_stock   ?? 0);
  const minStockLevel = Number(row.min_stock_level ?? 0);

  return {
    id:           row.item_id,
    name:         row.item_name,
    code:         row.item_code   ?? null,
    unit:         row.unit_name   ?? null,
    categoryName: row.category    ?? null,
    brand:        row.brand       ?? null,
    minStockLevel,
    totalStock,
    status:       getStockStatus(totalStock, minStockLevel),
    // warehouse_stocks is json_agg output — parse and re-shape to camelCase
    warehouseStocks: (row.warehouse_stocks ?? []).map((w) => ({
      warehouseId:   w.warehouse_id,
      warehouseName: w.warehouse_name,
      qty:           Number(w.qty ?? 0),
    })),
  };
};

// ─── GET /  — getStock ────────────────────────────────────────────────────────

export const getStock = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const {
      search       = "",
      warehouse_id = "",
      status       = "",
      category_id  = "",
    } = req.query;

    // Validate UUIDs before they touch SQL
    const scopedWarehouse = isUuid(warehouse_id) ? warehouse_id : null;
    const scopedCategory  = isUuid(category_id)  ? category_id  : null;

    // ── Param array ───────────────────────────────────────────────────────
    // $1 = company_id  (always)
    // $2 = warehouse_id (pushed immediately when scoped — JOIN subquery uses $2)
    // $3+ = remaining filters in order
    const values = [company_id];
    let idx = 2;

    if (scopedWarehouse) {
      values.push(scopedWarehouse); // $2
      idx = 3;
    }

    // ── Single combined query ─────────────────────────────────────────────
    // When warehouse_id is provided:
    //   • total_stock  = SUM only for that warehouse  (not company-wide)
    //   • EXISTS check = only items present in that warehouse are returned
    //   • warehouse breakdown in json_agg = still shows ALL warehouses per item
    //     so the expand row always shows the full picture

    let query = `
      SELECT
        i.id            AS item_id,
        i.name          AS item_name,
        i.code          AS item_code,
        i.unit_name,
        i.category,
        i.brand,
        i.min_stock_level,

        -- Scoped total: sum only for selected warehouse, or all if no filter
        COALESCE(SUM(
          CASE
            WHEN ${scopedWarehouse ? "ws.warehouse_id = $2" : "TRUE"}
            THEN ws.quantity
            ELSE 0
          END
        ), 0) AS total_stock,

        -- Full per-warehouse breakdown (always all warehouses) via json_agg
        COALESCE(
          json_agg(
            json_build_object(
              'warehouse_id',   ws.warehouse_id,
              'warehouse_name', w.name,
              'qty',            ws.quantity
            )
          ) FILTER (WHERE ws.warehouse_id IS NOT NULL),
          '[]'::json
        ) AS warehouse_stocks

      FROM items i

      LEFT JOIN warehouse_stock ws
        ON  ws.item_id    = i.id
        AND ws.company_id = i.company_id

      LEFT JOIN warehouses w
        ON  w.id = ws.warehouse_id

      WHERE i.company_id = $1
        AND i.is_active   = TRUE
    `;

    // Search by name or code
    if (search && search.trim()) {
      query += ` AND (i.name ILIKE $${idx} OR i.code ILIKE $${idx})`;
      values.push(`%${search.trim()}%`);
      idx++;
    }

    // Category filter
    if (scopedCategory) {
      query += ` AND i.category_id = $${idx}`;
      values.push(scopedCategory);
      idx++;
    }

    // Warehouse filter — only items that have stock (quantity > 0) in the
    // selected warehouse. Removes items never stocked there from the list.
    if (scopedWarehouse) {
      query += ` AND EXISTS (
        SELECT 1
        FROM   warehouse_stock wsx
        WHERE  wsx.item_id      = i.id
          AND  wsx.company_id   = i.company_id
          AND  wsx.warehouse_id = $2
          AND  wsx.quantity     > 0
      )`;
    }

    query += `
      GROUP BY
        i.id, i.name, i.code, i.unit_name,
        i.category, i.brand, i.min_stock_level
      ORDER BY i.name ASC
    `;

    const { rows } = await pool.query(query, values);

    // Format all rows
    let result = rows.map(formatStockItem);

    // Status filter — JS-side because status is derived after aggregation
    if (status && status.toUpperCase() !== "ALL") {
      const norm = status.toUpperCase();
      const valid = ["IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK", "AT_MINIMUM", "NORMAL"];
      if (valid.includes(norm)) {
        result = result.filter((i) => i.status === norm);
      }
    }

    return res.status(200).json({
      success: true,
      count:   result.length,
      data:    result,
    });

  } catch (error) {
    console.error("getStock error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /low-stock  — getLowStock ───────────────────────────────────────────

export const getLowStock = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { warehouse_id = "" } = req.query;
    const scopedWarehouse = isUuid(warehouse_id) ? warehouse_id : null;

    const values = [company_id];
    let idx = 2;

    if (scopedWarehouse) {
      values.push(scopedWarehouse);
      idx = 3;
    }

    let query = `
      SELECT
        i.id            AS item_id,
        i.name          AS item_name,
        i.code          AS item_code,
        i.unit_name,
        i.category,
        i.brand,
        i.min_stock_level,
        COALESCE(SUM(
          CASE
            WHEN ${scopedWarehouse ? "ws.warehouse_id = $2" : "TRUE"}
            THEN ws.quantity
            ELSE 0
          END
        ), 0) AS total_stock,
        COALESCE(
          json_agg(
            json_build_object(
              'warehouse_id',   ws.warehouse_id,
              'warehouse_name', w.name,
              'qty',            ws.quantity
            )
          ) FILTER (WHERE ws.warehouse_id IS NOT NULL),
          '[]'::json
        ) AS warehouse_stocks
      FROM items i
      LEFT JOIN warehouse_stock ws
        ON  ws.item_id    = i.id
        AND ws.company_id = i.company_id
      LEFT JOIN warehouses w ON w.id = ws.warehouse_id
      WHERE i.company_id = $1
        AND i.is_active   = TRUE
    `;

    if (scopedWarehouse) {
      query += ` AND EXISTS (
        SELECT 1 FROM warehouse_stock wsx
        WHERE wsx.item_id = i.id AND wsx.company_id = i.company_id
          AND wsx.warehouse_id = $2
      )`;
    }

    query += `
      GROUP BY i.id, i.name, i.code, i.unit_name, i.category, i.brand, i.min_stock_level
      HAVING COALESCE(SUM(
        CASE WHEN ${scopedWarehouse ? "ws.warehouse_id = $2" : "TRUE"}
        THEN ws.quantity ELSE 0 END
      ), 0) <= i.min_stock_level
      ORDER BY total_stock ASC, i.name ASC
    `;

    const { rows } = await pool.query(query, values);

    return res.status(200).json({
      success: true,
      count:   rows.length,
      data:    rows.map(formatStockItem),
    });

  } catch (error) {
    console.error("getLowStock error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ─── GET /stats  — getStockStats ─────────────────────────────────────────────

export const getStockStats = async (req, res) => {
  try {
    const company_id = req.user?.company_id;
    if (!company_id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { warehouse_id = "" } = req.query;
    const scopedWarehouse = isUuid(warehouse_id) ? warehouse_id : null;

    const values = [company_id];
    if (scopedWarehouse) values.push(scopedWarehouse);

    // Warehouse-aware stats subquery
    const stockSubquery = scopedWarehouse
      ? `(
          SELECT item_id, SUM(quantity) AS total_stock
          FROM   warehouse_stock
          WHERE  company_id   = $1
            AND  warehouse_id = $2
          GROUP  BY item_id
        )`
      : `(
          SELECT item_id, SUM(quantity) AS total_stock
          FROM   warehouse_stock
          WHERE  company_id = $1
          GROUP  BY item_id
        )`;

    const { rows } = await pool.query(
      `
      SELECT
        COUNT(DISTINCT i.id)::int                                               AS total_items,
        COUNT(DISTINCT i.id) FILTER (
          WHERE COALESCE(ws.total_stock, 0) = 0
        )::int                                                                  AS out_of_stock,
        COUNT(DISTINCT i.id) FILTER (
          WHERE COALESCE(ws.total_stock, 0) > 0
            AND COALESCE(ws.total_stock, 0) < i.min_stock_level
        )::int                                                                  AS low_stock,
        COUNT(DISTINCT i.id) FILTER (
          WHERE COALESCE(ws.total_stock, 0) >= i.min_stock_level
            AND i.min_stock_level > 0
        )::int                                                                  AS normal,
        COALESCE(SUM(ws.total_stock), 0)::numeric                              AS total_stock_qty
      FROM items i
      LEFT JOIN ${stockSubquery} ws ON ws.item_id = i.id
      WHERE i.company_id = $1
        AND i.is_active   = TRUE
      `,
      values,
    );

    const s = rows[0];

    return res.status(200).json({
      success: true,
      data: {
        totalItems:    Number(s.total_items),
        outOfStock:    Number(s.out_of_stock),
        lowStock:      Number(s.low_stock),
        normal:        Number(s.normal),
        totalStockQty: Number(s.total_stock_qty),
      },
    });

  } catch (error) {
    console.error("getStockStats error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};