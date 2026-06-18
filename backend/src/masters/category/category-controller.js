import { connectDB } from "../../pool.js";

export const createCategory = async (req, res) => {
  try {
    const { name, parentId, requires_narration } = req.body;
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
      `SELECT 1 FROM categories 
       WHERE company_id = $1 AND LOWER(name) = LOWER($2)`,
      [company_id, name]
    );

    if (duplicateCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Category already exists",
      });
    }

    // ✅ Check parent exists (if provided)
    if (parentId) {
      const parentCheck = await connectDB.query(
        `SELECT id FROM categories WHERE id = $1 AND company_id = $2`,
        [parentId, company_id]
      );

      if (parentCheck.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category",
        });
      }
    }

     

    // ✅ Insert category
    const result = await connectDB.query(
      `INSERT INTO categories 
        (id, company_id, name, parent_id, requires_narration, created_by)
       VALUES 
        (gen_random_uuid(), $1, $2, $3, $4, $5)
       RETURNING *`,
      [
        company_id,
        name.trim(),
        parentId || null,
        requires_narration || false,
        created_by,
      ]
    );

    return res.status(201).json({
      success: true,
      message: "Category created successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Create Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, parentId, requires_narration } = req.body;

    const company_id = req.user.company_id;

    // ✅ Check category exists
    const existing = await connectDB.query(
      `SELECT * FROM categories 
       WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ✅ Validate name (if updating)
    if (name && name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Category name cannot be empty",
      });
    }

    // ✅ Check duplicate name (excluding current category)
    if (name) {
      const duplicateCheck = await connectDB.query(
        `SELECT 1 FROM categories 
         WHERE company_id = $1 
         AND LOWER(name) = LOWER($2)
         AND id != $3`,
        [company_id, name, id]
      );

      if (duplicateCheck.rowCount > 0) {
        return res.status(400).json({
          success: false,
          message: "Category with same name already exists",
        });
      }
    }

    // ✅ Prevent self-parenting
    if (parentId && parentId === id) {
      return res.status(400).json({
        success: false,
        message: "Category cannot be its own parent",
      });
    }

    // ✅ Validate parent exists
    if (parentId) {
      const parentCheck = await connectDB.query(
        `SELECT id FROM categories 
         WHERE id = $1 AND company_id = $2`,
        [parentId, company_id]
      );

      if (parentCheck.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid parent category",
        });
      }
    }

    // ⚠️ OPTIONAL (Advanced): Prevent circular hierarchy
    // (Skip for now unless needed)

    // ✅ Update query
    const result = await connectDB.query(
      `UPDATE categories
       SET 
         name = COALESCE($1, name),
         parent_id = COALESCE($2, parent_id),
         requires_narration = COALESCE($3, requires_narration)
       WHERE id = $4 AND company_id = $5
       RETURNING *`,
      [
        name ? name.trim() : null,
        parentId !== undefined ? parentId : null,
        requires_narration !== undefined ? requires_narration : null,
        id,
        company_id,
      ]
    );

    return res.status(200).json({
      success: true,
      message: "Category updated successfully",
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Update Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const company_id = req.user.company_id;

    // ✅ Check category exists
    const existing = await connectDB.query(
      `SELECT id, name FROM categories
       WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    if (existing.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }

    // ✅ Check if category has items (IMPORTANT)
    const itemCheck = await connectDB.query(
      `SELECT 1 FROM items WHERE category_id = $1 LIMIT 1`,
      [id]
    );

    if (itemCheck.rowCount > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete category. Items are using this category",
      });
    }

    // ✅ Delete category
    await connectDB.query(
      `DELETE FROM categories
       WHERE id = $1 AND company_id = $2`,
      [id, company_id]
    );

    return res.status(200).json({
      success: true,
      message: "Category deleted successfully",
    });

  } catch (error) {
    console.error("Delete Category Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllCategories = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { search = "" } = req.query;

    const result = await connectDB.query(
      `
      SELECT 
        c.id,
        c.name,
        c.parent_id,
        p.name AS parent_name,
        c.requires_narration,
        c.created_at,
        c.created_by,

        COUNT(i.id) AS item_count

      FROM categories c
      LEFT JOIN categories p ON c.parent_id = p.id
      LEFT JOIN items i ON i.category_id = c.id

      WHERE c.company_id = $1
      AND ($2 = '' OR c.name ILIKE '%' || $2 || '%')

      GROUP BY c.id, p.name
      ORDER BY c.created_at DESC
      `,
      [company_id, search]
    );

    // ✅ Format response for frontend
    const formatted = result.rows.map((c) => ({
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
      parentName: c.parent_name,
      requires_narration: c.requires_narration,
      itemCount: Number(c.item_count),
      created_at: c.created_at,
      created_by: c.created_by,
      isActive: true, // since you don't have column yet
    }));

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully",
      data: formatted,
    });

  } catch (error) {
    console.error("Get Categories Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getCategoryById = async (req, res) => {
  try {
    const company_id = req.user.company_id;
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Category ID is required"
      });
    }

    const result = await connectDB.query(
      `
      SELECT 
        c.id,
        c.name,
        c.parent_id,
        p.name AS parent_name,
        c.requires_narration,
        c.created_at,
        c.created_by,

        COUNT(i.id) AS item_count

      FROM categories c

      LEFT JOIN categories p 
        ON c.parent_id = p.id
        AND p.company_id = c.company_id

      LEFT JOIN items i 
        ON i.category_id = c.id
        AND i.company_id = c.company_id
        AND i.is_active = true

      WHERE c.id = $1
      AND c.company_id = $2

      GROUP BY 
        c.id,
        c.name,
        c.parent_id,
        p.name,
        c.requires_narration,
        c.created_at,
        c.created_by
      `,
      [id, company_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Category not found"
      });
    }

    const c = result.rows[0];

    const formatted = {
      id: c.id,
      name: c.name,
      parentId: c.parent_id,
      parentName: c.parent_name,
      requires_narration: c.requires_narration,
      itemCount: Number(c.item_count),
      created_at: c.created_at,
      created_by: c.created_by,
      isActive: true // until you add column
    };

    return res.status(200).json({
      success: true,
      data: formatted
    });

  } catch (error) {
    console.error("Get Category By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};
