// exam-adminRole-controller.js (MODIFIED FOR EXAM MANAGEMENT)

import { connectDB } from '../../pool.js';
import {
  upsertUserPermissionsJsonb,
  mergePermissions,
} from '../../admin/admin-controller.js';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

// Exam Management System ke roles (hardcoded)
const SYSTEM_ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  CHECKER: 'checker',
  TEACHER_CHECKER: 'teacher_checker',
  RECHECKING: 'rechecking',
};

// Role-based default permissions
const DEFAULT_ROLE_PERMISSIONS = {
  admin: {
    dashboard: { view: true },
    exams: { view: true, create: true, edit: true, delete: true },
    'mark-scheme': { view: true, create: true, edit: true },
    'student-data': { view: true, upload: true, manage: true },
    sheets: { view: true, upload: true, assign: true },
    queue: { view: true, manage: true },
    users: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
    settings: { view: true, edit: true },
  },
  teacher: {
    'teacher-dashboard': { view: true },
    'teacher-mark-scheme': { view: true, create: true, edit: true },
    'checking-progress': { view: true },
    'results-view': { view: true },
  },
  checker: {
    'checker-dashboard': { view: true },
    'checker-queue': { view: true, check: true },
    'checker-completed': { view: true },
    marking: { view: true, check: true, verify: true },
  },
  teacher_checker: {
    'teacher-dashboard': { view: true },
    'teacher-mark-scheme': { view: true, create: true, edit: true },
    'checking-progress': { view: true },
    'results-view': { view: true },
    'checker-dashboard': { view: true },
    'checker-queue': { view: true, check: true },
    'checker-completed': { view: true },
    marking: { view: true, check: true, verify: true },
  },
  rechecking: {
    'recheck-dashboard': { view: true },
    'recheck-queue': { view: true, process: true },
    'recheck-history': { view: true },
    'recheck-marking': { view: true, process: true },
  },
};

// ─── HELPERS ────────────────────────────────────────────────────────────────

const normalizeRoleKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const mergeControls = (roleControls = {}, overrides = {}) => {
  const merged = { ...roleControls };
  for (const [key, val] of Object.entries(overrides)) {
    merged[key] = Boolean(val);
  }
  return merged;
};

// ─── CREATE ROLE (Exam Management) ────────────────────────────────────────

export const createRole = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, description, isActive, permissions, additionalControls } =
      req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required',
      });
    }

    // ✅ Check: System roles ko create nahi kar sakte
    const systemRoleNames = Object.values(SYSTEM_ROLES);
    if (systemRoleNames.includes(name.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: `"${name}" is a system role and cannot be created manually`,
      });
    }

    // ✅ Check duplicate (no company_id now)
    const existingRole = await connectDB.query(
      `SELECT * FROM roles WHERE name = $1`,
      [name],
    );
    if (existingRole.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role already exists',
      });
    }

    // ✅ Insert (no company_id)
    const result = await connectDB.query(
      `INSERT INTO roles (name, description, is_active, permissions, additional_controls, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        name,
        description,
        isActive ?? true,
        permissions || {},
        additionalControls || {},
        userId,
      ],
    );

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (err) {
    console.error('Create Role Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── GET ALL ROLES ─────────────────────────────────────────────────────────

export const getRoles = async (req, res) => {
  try {
    const { search = '' } = req.query;

    // ✅ No company_id filter
    const result = await connectDB.query(
      `SELECT
         r.*,
         COALESCE(creator.name, 'Unknown User') AS created_by_name,
         COUNT(u.id) AS users_assigned
       FROM roles r
       LEFT JOIN users creator ON creator.id = r.created_by
       LEFT JOIN users u ON u.role = r.name
       WHERE ($1 = '' OR r.name ILIKE '%' || $1 || '%' OR r.description ILIKE '%' || $1 || '%')
       GROUP BY r.id, creator.name
       ORDER BY 
         CASE 
           WHEN r.name ILIKE 'admin' THEN 1
           WHEN r.name ILIKE 'teacher_checker' THEN 2
           WHEN r.name ILIKE 'teacher' THEN 3
           WHEN r.name ILIKE 'checker' THEN 4
           WHEN r.name ILIKE 'rechecking' THEN 5
           ELSE 6
         END,
         r.created_at DESC`,
      [search],
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (err) {
    console.error('Get Roles Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── UPDATE ROLE ────────────────────────────────────────────────────────────

// ✅ Same sync logic but no company_id
function syncPermissions(userPerms = {}, newRolePerms = {}, oldRolePerms = {}) {
  const synced = JSON.parse(JSON.stringify(userPerms));
  const allModuleKeys = new Set([
    ...Object.keys(newRolePerms),
    ...Object.keys(oldRolePerms),
  ]);

  for (const moduleKey of allModuleKeys) {
    const newModule = newRolePerms[moduleKey] ?? {};
    const oldModule = oldRolePerms[moduleKey] ?? {};
    const allActionKeys = new Set([
      ...Object.keys(newModule),
      ...Object.keys(oldModule),
    ]);

    for (const action of allActionKeys) {
      const newVal = newModule[action];
      if (newVal === true) {
        if (!synced[moduleKey]) synced[moduleKey] = {};
        if (synced[moduleKey][action] !== true) {
          synced[moduleKey][action] = true;
        }
      } else if (newVal === false || newVal === undefined) {
        if (synced[moduleKey]) {
          synced[moduleKey][action] = false;
        }
      }
    }

    if (synced[moduleKey] && Object.keys(synced[moduleKey]).length === 0) {
      delete synced[moduleKey];
    }
  }
  return synced;
}

function syncControls(
  userControls = {},
  newRoleControls = {},
  oldRoleControls = {},
) {
  const synced = { ...userControls };
  const allKeys = new Set([
    ...Object.keys(newRoleControls),
    ...Object.keys(oldRoleControls),
  ]);

  for (const key of allKeys) {
    const newVal = newRoleControls[key];
    if (newVal === true) {
      if (synced[key] !== true) synced[key] = true;
    } else {
      synced[key] = false;
    }
  }
  return synced;
}

export const updateRoles = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, permissions, additionalControls } =
    req.body;

  try {
    // 1. Verify role exists
    const roleCheck = await connectDB.query(
      `SELECT * FROM roles WHERE id = $1`,
      [id],
    );
    if (roleCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    const oldRole = roleCheck.rows[0];

    // ✅ System role check - cannot modify system roles
    const systemRoleNames = Object.values(SYSTEM_ROLES);
    if (systemRoleNames.includes(oldRole.name.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: `"${oldRole.name}" is a system role and cannot be modified`,
      });
    }

    // 2. Check duplicate name
    const duplicate = await connectDB.query(
      `SELECT id FROM roles WHERE LOWER(name) = LOWER($1) AND id != $2`,
      [name, id],
    );
    if (duplicate.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Role name already exists',
      });
    }

    // 3. Update role
    const updatedRole = await connectDB.query(
      `UPDATE roles
       SET name = $1, description = $2, is_active = $3,
           permissions = $4, additional_controls = $5, updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        name,
        description,
        isActive,
        permissions || {},
        additionalControls || {},
        id,
      ],
    );

    const newRolePerms = updatedRole.rows[0].permissions;
    const newRoleControls = updatedRole.rows[0].additional_controls;
    const roleName = updatedRole.rows[0].name;

    // 4. Sync permissions for all users with this role
    const usersResult = await connectDB.query(
      `SELECT u.id::text AS id
       FROM users u
       WHERE u.role = $1`,
      [roleName],
    );
    const userIds = usersResult.rows.map((r) => r.id);

    if (userIds.length > 0) {
      const existingPermsResult = await connectDB.query(
        `SELECT user_id::text AS user_id, permissions, additional_controls
         FROM user_permissions
         WHERE user_id::text = ANY($1::text[])`,
        [userIds],
      );

      const existingPermsMap = new Map();
      for (const row of existingPermsResult.rows) {
        existingPermsMap.set(row.user_id, {
          permissions: row.permissions,
          additional_controls: row.additional_controls,
        });
      }

      for (const userId of userIds) {
        const existing = existingPermsMap.get(userId) ?? {
          permissions: {},
          additional_controls: {},
        };

        const syncedPerms = syncPermissions(
          existing.permissions,
          newRolePerms,
          oldRole.permissions,
        );
        const syncedControls = syncControls(
          existing.additional_controls,
          newRoleControls,
          oldRole.additional_controls,
        );

        await upsertUserPermissionsJsonb(userId, syncedPerms, syncedControls);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Role updated successfully',
      data: updatedRole.rows[0],
    });
  } catch (error) {
    console.error('Update Role Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ─── DELETE ROLE ────────────────────────────────────────────────────────────

export const deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await connectDB.query(`SELECT * FROM roles WHERE id = $1`, [
      id,
    ]);
    if (role.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    // ✅ System role check - cannot delete system roles
    const systemRoleNames = Object.values(SYSTEM_ROLES);
    if (systemRoleNames.includes(role.rows[0].name.toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: `"${role.rows[0].name}" is a system role and cannot be deleted`,
      });
    }

    // Check if users are assigned
    const usersWithRole = await connectDB.query(
      `SELECT COUNT(*)::int AS count FROM users WHERE role = $1`,
      [role.rows[0].name],
    );

    if (usersWithRole.rows[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role. ${usersWithRole.rows[0].count} users are assigned to this role.`,
      });
    }

    await connectDB.query('DELETE FROM roles WHERE id = $1', [id]);
    res.status(200).json({
      success: true,
      message: 'Role deleted successfully',
    });
  } catch (error) {
    console.error('Delete Role Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ─── GET ROLE BY ID ────────────────────────────────────────────────────────

export const getRoleById = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await connectDB.query(`SELECT * FROM roles WHERE id = $1`, [
      id,
    ]);
    if (role.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }
    res.status(200).json({
      success: true,
      role: role.rows[0],
    });
  } catch (error) {
    console.error('Get Role By ID Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ─── GET ROLE STATS ────────────────────────────────────────────────────────

export const getRoleStats = async (req, res) => {
  try {
    const result = await connectDB.query(
      `SELECT
         COUNT(*) AS total_roles,
         COUNT(*) FILTER (WHERE is_active = true) AS active_roles,
         (SELECT COUNT(*) FROM users) AS users_assigned
       FROM roles`,
    );
    const stats = result.rows[0];
    res.json({
      success: true,
      data: {
        totalRoles: Number(stats.total_roles),
        activeRoles: Number(stats.active_roles),
        usersAssigned: Number(stats.users_assigned),
      },
    });
  } catch (err) {
    console.error('Role Stats Error:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};

// ─── GET ROLE BY NAME ──────────────────────────────────────────────────────

export const getRoleByName = async (req, res) => {
  const { name } = req.body;
  try {
    const role = await connectDB.query(`SELECT * FROM roles WHERE name = $1`, [
      name,
    ]);
    if (role.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }
    res.status(200).json({
      success: true,
      role: role.rows[0],
    });
  } catch (error) {
    console.error('Get Role By Name Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};

// ─── CLONE ROLE ────────────────────────────────────────────────────────────

export const cloneRole = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await connectDB.query(`SELECT * FROM roles WHERE id = $1`, [
      id,
    ]);
    if (role.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found',
      });
    }

    const r = role.rows[0];
    const newRole = await connectDB.query(
      `INSERT INTO roles (name, description, is_active, permissions, additional_controls, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        `${r.name} (Copy)`,
        r.description,
        r.is_active,
        r.permissions,
        r.additional_controls,
        req.user.id,
      ],
    );

    res.json({
      success: true,
      data: newRole.rows[0],
    });
  } catch (err) {
    console.error('Clone Role Error:', err);
    res.status(500).json({
      success: false,
      message: 'Server error',
    });
  }
};
