import { connectDB } from "../../pool.js";

// ✅ CREATE WAREHOUSE
export const createWarehouse = async (req, res) => {
  try {
    const {
      name,
      type,
      address,
      inchargeName,
      inchargePhone,
      inchargeUserId,
      color,
      isActive,
      storageType,
      floorZone,
      maxCapacity,
      currentUtilization,
      workCenterId
    } = req.body;

    const created_by = req.user.id;
    const company_id = req.user.company_id;

    // ✅ Validation
    if (!name || !type || !address) {
      return res.status(400).json({
        success: false,
        message: "Name, type, and address are required",
      });
    }

    // ✅ Duplicate check (case-insensitive)
    const existing = await connectDB.query(
      `SELECT 1 FROM warehouses 
       WHERE LOWER(name) = LOWER($1) AND company_id = $2`,
      [name, company_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Warehouse with this name already exists",
      });
    }

    // ✅ Safe defaults
    const finalIsActive = isActive ?? true;

    // ✅ Insert
    const result = await connectDB.query(
      `INSERT INTO warehouses
      (company_id, name, type, address, incharge_name, incharge_phone, incharge_user_id, color, is_active, created_by, storage_type, floor_zone, max_capacity, current_utilization, work_center_id)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        company_id,
        name,
        type,
        address,
        inchargeName,
        inchargePhone,
        inchargeUserId || null,
        color,
        finalIsActive,
        created_by,
        storageType || 'GENERAL',
        floorZone || null,
        maxCapacity ? parseInt(maxCapacity, 10) : null,
        currentUtilization ? parseInt(currentUtilization, 10) : 0,
        workCenterId || null
      ]
    );

    res.status(201).json({
      success: true,
      message: "Warehouse created successfully",
      data: result.rows[0] // (optional: map later if needed)
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateWarehouse = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      name,
      type,
      address,
      inchargeName,
      inchargePhone,
      inchargeUserId,
      color,
      isActive,
      storageType,
      floorZone,
      maxCapacity,
      currentUtilization,
      workCenterId
    } = req.body;

    const company_id = req.user.company_id;

    // 🔍 Check if warehouse exists
    const existing = await connectDB.query(
      "SELECT * FROM warehouses WHERE id = $1 AND company_id = $2",
      [id, company_id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Warehouse not found",
      });
    }

    // 🔁 Update
    const result = await connectDB.query(
      `UPDATE warehouses SET
        name = COALESCE($1, name),
        type = COALESCE($2, type),
        address = COALESCE($3, address),
        incharge_name = COALESCE($4, incharge_name),
        incharge_phone = COALESCE($5, incharge_phone),
        incharge_user_id = COALESCE($6, incharge_user_id),
        color = COALESCE($7, color),
        is_active = COALESCE($8, is_active),
        storage_type = COALESCE($9, storage_type),
        floor_zone = COALESCE($10, floor_zone),
        max_capacity = COALESCE($11, max_capacity),
        current_utilization = COALESCE($12, current_utilization),
        work_center_id = COALESCE($13, work_center_id)
      WHERE id = $14 AND company_id = $15
      RETURNING *`,
      [
        name,
        type,
        address,
        inchargeName,
        inchargePhone,
        inchargeUserId || null,
        color,
        isActive,
        storageType || null,
        floorZone || null,
        maxCapacity ? parseInt(maxCapacity, 10) : null,
        currentUtilization !== undefined ? parseInt(currentUtilization, 10) : null,
        workCenterId || null,
        id,
        company_id
      ]
    );

    res.json({
      success: true,
      message: "Warehouse updated successfully",
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteWarehouse = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `DELETE FROM warehouses  
       WHERE id = $1 AND company_id = $2
       RETURNING *`,
      [id, company_id]
    );



    res.json({
      success: true,
      message: "Warehouse deleted successfully",
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

// export const getAllWarehouses = async (req, res) => {
//   try {
//     const company_id = req.user.company_id;
//     const { type } = req.query;

//     const result = await connectDB.query(
//   `
//   SELECT 
//     w.*,

//     COUNT(DISTINCT ws.item_id) AS item_count,

//     COALESCE(
//       SUM(ws.total_qty * COALESCE(i.sale_rate, i.purchase_rate, 0)),
//       0
//     ) AS total_value

//   FROM warehouses w

//   LEFT JOIN (
//     SELECT 
//       warehouse_id,
//       item_id,
//       SUM(quantity) AS total_qty
//     FROM warehouse_stock
//     GROUP BY warehouse_id, item_id
//   ) ws ON ws.warehouse_id = w.id

//   LEFT JOIN items i 
//     ON i.id = ws.item_id

//   WHERE w.company_id = $1
//   AND w.is_active = true

//   GROUP BY w.id
//   ORDER BY w.created_at DESC
//   `,
//   [company_id]
// );

//     const values = [company_id];
//     let index = 2;

//     // ✅ Filter by type
//     if (type && type.toUpperCase() !== "ALL") {
//       query += ` AND w.type = $${index}`;
//       values.push(type);
//       index++;
//     }

//     // ✅ Grouping + sorting
//     query += `
//       GROUP BY w.id
//       ORDER BY w.created_at DESC
//     `;

//     const result = await connectDB.query(query, values);

//     res.json({
//       success: true,
//       count: result.rows.length,
//       data: result.rows
//     });

//   } catch (error) {
//     console.error(error);
//     res.status(500).json({ message: "Server error" });
//   }
// };
export const getAllWarehouses = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { type } = req.query;

    let query = `
      SELECT 
        w.*,

        COUNT(DISTINCT ws.item_id) AS item_count,

        COALESCE(
          SUM(ws.total_qty * COALESCE(i.sale_rate, i.purchase_rate, 0)),
          0
        ) AS total_value

      FROM warehouses w

      LEFT JOIN (
        SELECT 
          warehouse_id,
          item_id,
          SUM(quantity) AS total_qty
        FROM warehouse_stock
        GROUP BY warehouse_id, item_id
      ) ws ON ws.warehouse_id = w.id

      LEFT JOIN items i 
        ON i.id = ws.item_id

      WHERE w.company_id = $1
      
    `;
    // AND w.is_active = true
    const values = [company_id];
    let index = 2;

    // ✅ Type filter (merged properly)
    if (type && type.toUpperCase() !== "ALL") {
      query += ` AND w.type = $${index}`;
      values.push(type);
      index++;
    }

    // ✅ Grouping + sorting (ONLY once)
    query += `
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `;

    const result = await connectDB.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getAllWarehousesUsingMarterTab = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { type } = req.query;

    let query = `
      SELECT 
        w.*,

        COUNT(DISTINCT ws.item_id) AS item_count,

        COALESCE(
          SUM(ws.total_qty * COALESCE(i.sale_rate, i.purchase_rate, 0)),
          0
        ) AS total_value

      FROM warehouses w

      LEFT JOIN (
        SELECT 
          warehouse_id,
          item_id,
          SUM(quantity) AS total_qty
        FROM warehouse_stock
        GROUP BY warehouse_id, item_id
      ) ws ON ws.warehouse_id = w.id

      LEFT JOIN items i 
        ON i.id = ws.item_id

      WHERE w.company_id = $1
     
    `;
    //  AND w.is_active = true
    const values = [company_id];
    let index = 2;

    // ✅ Type filter (merged properly)
    if (type && type.toUpperCase() !== "ALL") {
      query += ` AND w.type = $${index}`;
      values.push(type);
      index++;
    }

    // ✅ Grouping + sorting (ONLY once)
    query += `
      GROUP BY w.id
      ORDER BY w.created_at DESC
    `;

    const result = await connectDB.query(query, values);

    res.json({
      success: true,
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const searchWarehouses = async (req, res) => {
  try {
    const { name } = req.query; // ← also switch to GET query param
    const company_id = req.user.company_id;
    const userId = req.user.id;

    if (!name) {
      return res.status(400).json({ success: false, message: "Search term is required" });
    }

    // Check if super admin
    const userResult = await connectDB.query(
      `SELECT role FROM users WHERE id = $1 AND company_id = $2`,
      [userId, company_id]
    );
    const isSuperAdmin = userResult.rows[0]?.role?.toUpperCase().replace(/\s+/g, '_') === 'SUPER_ADMIN';

    let query;
    let values;

    if (isSuperAdmin) {
      query = `
        SELECT * FROM warehouses
        WHERE company_id = $1
        AND LOWER(name) LIKE LOWER($2)
        LIMIT 10
      `;
      values = [company_id, `%${name}%`];
    } else {
      query = `
        SELECT w.* FROM warehouses w
        INNER JOIN user_warehouses uw ON uw.warehouse_id = w.id
        WHERE w.company_id = $1
        AND uw.user_id = $2
        AND LOWER(w.name) LIKE LOWER($3)
        LIMIT 10
      `;
      values = [company_id, userId, `%${name}%`];
    }

    const result = await connectDB.query(query, values);
    res.json({ success: true, data: result.rows });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getWarehouseStats = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE is_active = true) AS active
      FROM warehouses
      WHERE company_id = $1
      `,
      [company_id]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getWarehousesForUser = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const userId = req.user.id;

    // First, check if the target user is a Super Admin
    const userResult = await connectDB.query(
      `SELECT role FROM users WHERE id = $1 AND company_id = $2`,
      [userId, company_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const isSuperAdmin = userResult.rows[0].role.toUpperCase().replace(/\s+/g, '_') === 'SUPER_ADMIN';

    // Build the warehouse query differently based on role
    let query;
    let values;

    if (isSuperAdmin) {
      // Super Admin gets ALL active warehouses for the company
      query = `
        SELECT 
          w.*,
          true AS is_primary,       -- treat all as accessible, no concept of primary
          null AS assigned_at,

          COUNT(DISTINCT ws.item_id) AS item_count,

          COALESCE(
            SUM(ws.total_qty * COALESCE(i.sale_rate, i.purchase_rate, 0)),
            0
          ) AS total_value

        FROM warehouses w

        LEFT JOIN (
          SELECT 
            warehouse_id,
            item_id,
            SUM(quantity) AS total_qty
          FROM warehouse_stock
          GROUP BY warehouse_id, item_id
        ) ws ON ws.warehouse_id = w.id

        LEFT JOIN items i 
          ON i.id = ws.item_id

        WHERE w.company_id = $1
          AND w.is_active = true

        GROUP BY w.id
        ORDER BY w.created_at DESC
      `;
      values = [company_id];

    } else {
      // Regular user — only their assigned warehouses
      query = `
        SELECT 
          w.*,
          uw.is_primary,
          uw.created_at AS assigned_at,

          COUNT(DISTINCT ws.item_id) AS item_count,

          COALESCE(
            SUM(ws.total_qty * COALESCE(i.sale_rate, i.purchase_rate, 0)),
            0
          ) AS total_value

        FROM user_warehouses uw

        INNER JOIN warehouses w 
          ON w.id = uw.warehouse_id

        LEFT JOIN (
          SELECT 
            warehouse_id,
            item_id,
            SUM(quantity) AS total_qty
          FROM warehouse_stock
          GROUP BY warehouse_id, item_id
        ) ws ON ws.warehouse_id = w.id

        LEFT JOIN items i 
          ON i.id = ws.item_id

        WHERE uw.user_id = $1
          AND w.company_id = $2
          AND w.is_active = true

        GROUP BY w.id, uw.is_primary, uw.created_at
        ORDER BY uw.is_primary DESC, uw.created_at ASC
      `;
      values = [userId, company_id];
    }

    const result = await connectDB.query(query, values);

    res.json({
      success: true,
      isSuperAdmin,           // handy for the frontend to know
      count: result.rows.length,
      data: result.rows
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
};