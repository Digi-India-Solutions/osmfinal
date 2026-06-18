import { connectDB } from "../../pool.js";

export const createUnit = async (req, res) => {
  try {
    const { name, shortName, isActive } = req.body;
    const company_id = req.user.company_id; // from auth middleware
    const created_by = req.user.id;

    // ✅ Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name is required",
      });
    }

    // ✅ Check duplicate category (same company)
    const duplicateCheck = await connectDB.query(
      `SELECT 1 FROM units 
       WHERE company_id = $1 AND LOWER(name) = LOWER($2)`,
      [company_id, name]
    );

    if (duplicateCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    // ✅ Insert unit
    const result = await connectDB.query(
      `INSERT INTO units 
        (id, company_id, name, short_name, is_active, created_by)
       VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING *`,
      [
        company_id,
        name.trim(),
        shortName || null,
        isActive || true,
        created_by,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Unit created successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Create Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, shortName,  isActive} = req.body;

    const company_id = req.user.company_id;

    // ✅ Check category exists
    const existing = await connectDB.query(
      `SELECT * FROM units 
       WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    // ✅ Validate name (if updating)
    if (name && name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Unir name cannot be empty",
      });
    }

    // ✅ Check duplicate name (excluding current category)
    if (name) {
      const duplicateCheck = await connectDB.query(
        `SELECT 1 FROM units
         WHERE company_id = $1 
         AND LOWER(name) = LOWER($2)
         AND id != $3`,
        [company_id, name, id]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Unit with same name already exists",
        });
      }
    }

    // ⚠️ OPTIONAL (Advanced): Prevent circular hierarchy
    // (Skip for now unless needed)

    // ✅ Update query
    const result = await connectDB.query(
      `UPDATE units
       SET 
         name = COALESCE($1, name),
         short_name = COALESCE($2, short_name),
         is_active = COALESCE($3, is_active)
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [
        name ? name.trim() : null,
        shortName ? shortName.trim() : null,
        isActive || null,
        id,
        company_id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Unit updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Update Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    const existing = await connectDB.query(
      `SELECT id FROM units WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    // ✅ Check usage
    const itemCheck = await connectDB.query(
      `SELECT 1 FROM items WHERE primary_unit_id = $1 LIMIT 1`,
      [id]
    );

    if (itemCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete unit. Items are using this unit",
      });
    }

    await connectDB.query(
      `DELETE FROM units WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    return res.status(200).json({
      success: true,
      message: "Unit deleted successfully",
    });

  } catch (error) {
    console.error("Delete Unit Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const getAllUnits = async (req, res) => {
  try {
    const company_id = req.user.company_id;

    const result = await connectDB.query(
      `
      SELECT 
        u.id,
        u.name,
        u.short_name,
        u.is_active,
        u.created_at,
        u.created_by,

        COUNT(i.id) AS item_count

      FROM units u

      LEFT JOIN items i 
        ON i.primary_unit_id = u.id
        AND i.company_id = u.company_id
        AND i.is_active = true

      WHERE u.company_id = $1

      GROUP BY 
        u.id,
        u.name,
        u.short_name,
        u.is_active,
        u.created_at,
        u.created_by

      ORDER BY u.created_at DESC
      `,
      [company_id]
    );

    const formatted = result.rows.map((u) => ({
      id: u.id,
      name: u.name,
      shortName: u.short_name,
      itemCount: Number(u.item_count),
      created_at: u.created_at,
      created_by: u.created_by,
      isActive: u.is_active,
    }));

    return res.status(200).json({
      success: true,
      message: "Units fetched successfully",
      data: formatted,
    });

  } catch (error) {
    console.error("Get Units Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const toggleUnitStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // ✅ Check unit exists
    const existing = await connectDB.query(
      `SELECT id, is_active FROM units 
       WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found",
      });
    }

    const currentStatus = existing.rows[0].is_active;

    // ✅ Toggle status
    const result = await connectDB.query(
      `UPDATE units
       SET is_active = $1
       WHERE id = $2 AND company_id = $3
       RETURNING *`,
      [!currentStatus, id, company_id]
    );

    return res.status(200).json({
      success: true,
      message: `Unit ${!currentStatus ? "activated" : "deactivated"} successfully`,
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Toggle Unit Status Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getUnitById = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Unit ID is required"
      });
    }

    const result = await connectDB.query(
      `
      SELECT 
        u.id,
        u.name,
        u.short_name,
        u.is_active,
        u.created_at,
        u.created_by,

        COUNT(i.id) AS item_count

      FROM units u

      LEFT JOIN items i 
        ON i.primary_unit_id = u.id
        AND i.company_id = u.company_id
        AND i.is_active = true

      WHERE u.id = $1
      AND u.company_id = $2

      GROUP BY 
        u.id,
        u.name,
        u.short_name,
        u.is_active,
        u.created_at,
        u.created_by
      `,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Unit not found"
      });
    }

    const u = result.rows[0];

    const formatted = {
      id: u.id,
      name: u.name,
      shortName: u.short_name,
      itemCount: Number(u.item_count),
      created_at: u.created_at,
      created_by: u.created_by,
      isActive: u.is_active,
    };

    return res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.error("Get Unit By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
