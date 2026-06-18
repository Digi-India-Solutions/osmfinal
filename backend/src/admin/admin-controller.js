// exam-admin-controller.js (FINAL FIXED VERSION)
import { connectDB } from '../pool.js';
import {
  hashPassword,
  comparePassword,
  generateAccessToken,
  generateRefreshToken,
} from '../../utils/auth.js';
import sendEmail from '../../utils/sendEmail.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const normalizeRoleKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const ROLES = {
  ADMIN: 'admin',
  TEACHER: 'teacher',
  CHECKER: 'checker',
  TEACHER_CHECKER: 'teacher_checker',
  RECHECKING: 'rechecking',
};

const ROLE_PERMISSIONS = {
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

// ─── PERMISSION HELPERS ─────────────────────────────────────────────────────

export const resolvePermissionsByRole = (role) => {
  const normalizedRole = normalizeRoleKey(role);
  if (normalizedRole === 'ADMIN') {
    return ROLE_PERMISSIONS.admin;
  }
  return ROLE_PERMISSIONS[normalizedRole.toLowerCase()] || {};
};

export const mergePermissions = (rolePermissions = {}, overrides = {}) => {
  const merged = JSON.parse(JSON.stringify(rolePermissions));
  for (const [mod, actions] of Object.entries(overrides)) {
    if (!merged[mod]) merged[mod] = {};
    for (const [action, val] of Object.entries(actions)) {
      merged[mod][action] = Boolean(val);
    }
  }
  return merged;
};

export const upsertUserPermissionsJsonb = async (userId, permissions = {}) => {
  await connectDB.query(
    `INSERT INTO user_permissions (user_id, permissions, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (user_id)
     DO UPDATE SET
       permissions = EXCLUDED.permissions,
       updated_at = now()`,
    [userId, JSON.stringify(permissions)],
  );
};

// ─── AUTH ENDPOINTS ─────────────────────────────────────────────────────────

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    const result = await connectDB.query(
      `SELECT u.*, 
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.email = $1 AND u.is_active = true`,
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isMatch = await comparePassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    await connectDB.query(
      `UPDATE users SET last_login_at = now() WHERE id = $1`,
      [user.id],
    );

    let permissions =
      user.user_permissions || resolvePermissionsByRole(user.role);

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    res
      .status(200)
      .cookie('token', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sevenDaysInMs,
      })
      .cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sevenDaysInMs,
      })
      .json({
        success: true,
        message: 'Login successful',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions: permissions,
            isActive: user.is_active,
          },
        },
      });
  } catch (error) {
    console.error('Login Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const logout = async (req, res) => {
  try {
    res
      .clearCookie('token', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
      .clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      })
      .json({
        success: true,
        message: 'Logged out successfully',
      });
  } catch (error) {
    console.error('Logout Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'No refresh token provided',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);

    const result = await connectDB.query(
      `SELECT u.*, up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [decoded.id],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = generateRefreshToken(user);

    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

    res
      .cookie('token', newAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sevenDaysInMs,
      })
      .cookie('refreshToken', newRefreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: sevenDaysInMs,
      })
      .json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            permissions:
              user.user_permissions || resolvePermissionsByRole(user.role),
          },
        },
      });
  } catch (error) {
    console.error('Refresh Token Error:', error.message);
    res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token',
    });
  }
};

export const verifyLoggedIn = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1 AND u.is_active = true`,
      [userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive',
      });
    }

    const permissions =
      user.user_permissions || resolvePermissionsByRole(user.role);

    res.status(200).json({
      success: true,
      message: 'User is authenticated',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        permissions: permissions,
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Verify User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const ForgotPassword = async (req, res) => {
  const { email } = req.body;

  try {
    const result = await connectDB.query(
      'SELECT * FROM users WHERE email = $1',
      [email],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 10 * 60 * 1000);

    await connectDB.query(
      `UPDATE users SET reset_token = $1, reset_token_expiry = $2 WHERE id = $3`,
      [resetToken, expiry, user.id],
    );

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <h2>Password Reset Request</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link expires in 10 minutes.</p>
    `;

    await sendEmail(user.email, 'Reset Password', html);

    res.json({
      success: true,
      message: 'Reset link sent to email',
    });
  } catch (error) {
    console.error('Forgot Password Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const ResetPassword = async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const result = await connectDB.query(
      `SELECT * FROM users 
       WHERE reset_token = $1 AND reset_token_expiry > NOW()`,
      [token],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token',
      });
    }

    const hashedPassword = await hashPassword(password);
    await connectDB.query(
      `UPDATE users 
       SET password_hash = $1, reset_token = NULL, reset_token_expiry = NULL 
       WHERE id = $2`,
      [hashedPassword, user.id],
    );

    res.json({
      success: true,
      message: 'Password reset successful',
    });
  } catch (error) {
    console.error('Reset Password Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ─── USER MANAGEMENT ──────────────────────────────────────────────────────

export const createUserByAdmin = async (req, res) => {
  const {
    name,
    email,
    role,
    password,
    permissions = {},
    isActive = true,
    subject,
  } = req.body;

  try {
    const adminId = req.user.id;

    if (!name || !email || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and role are required',
      });
    }

    const validRoles = Object.values(ROLES);
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${validRoles.join(', ')}`,
      });
    }

    const existingUser = await connectDB.query(
      `SELECT id FROM users WHERE email = $1`,
      [email],
    );
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    const defaultPassword = password || 'User@123';
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // ✅ Subject logic for create
    let finalSubject = null;
    if (role === 'teacher' || role === 'teacher_checker') {
      finalSubject = subject || null;
    }

    const insertResult = await connectDB.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, created_by, subject)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [name, email, hashedPassword, role, isActive, adminId, finalSubject],
    );
    const newUserId = insertResult.rows[0].id;

    const roleDefaults = resolvePermissionsByRole(role);
    const finalPermissions = mergePermissions(roleDefaults, permissions);
    await upsertUserPermissionsJsonb(newUserId, finalPermissions);

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
        <h2>Welcome to Exam Management System!</h2>
        <p>Your account has been created. Here are your credentials:</p>
        <div style="background: #f8fafc; padding: 16px; border-radius: 8px;">
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Password:</strong> ${defaultPassword}</p>
          <p><strong>Role:</strong> ${role}</p>
          ${finalSubject ? `<p><strong>Subject:</strong> ${finalSubject}</p>` : ''}
        </div>
        <p>Please change your password after first login.</p>
        <a href="${process.env.FRONTEND_URL}/login">Login Now</a>
      </div>
    `;

    try {
      await sendEmail(email, 'Welcome to Exam Management System', html);
    } catch (mailErr) {
      console.error('Welcome email failed:', mailErr.message);
    }

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUserId,
        name,
        email,
        role,
        subject: finalSubject,
        permissions: finalPermissions,
        isActive,
      },
    });
  } catch (error) {
    console.error('Create User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
    // 1. Validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 6 characters',
      });
    }

    // 2. Get user from database
    const result = await connectDB.query(
      `SELECT id, email, password_hash, role FROM users WHERE id = $1 AND is_active = true`,
      [userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // 3. Verify current password
    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    // 4. Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 5. Update password
    await connectDB.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [hashedPassword, userId],
    );

    // 6. Send success response
    res.status(200).json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change Password Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const search = (req.query.search || '').toString().trim();
    const role = (req.query.role || '').toString().trim();
    const offset = (page - 1) * limit;

    let conditions = [];
    let values = [];
    let index = 1;

    if (search) {
      conditions.push(`(u.name ILIKE $${index} OR u.email ILIKE $${index})`);
      values.push(`%${search}%`);
      index++;
    }
    if (role) {
      conditions.push(`u.role = $${index}`);
      values.push(role);
      index++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const totalResult = await connectDB.query(
      `SELECT COUNT(*)::int AS total FROM users u ${whereClause}`,
      values,
    );
    const total = totalResult.rows[0]?.total || 0;

    const result = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${index} OFFSET $${index + 1}`,
      [...values, limit, offset],
    );

    const items = result.rows.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      subject: user.subject || null,
      permissions: user.user_permissions || resolvePermissionsByRole(user.role),
      isActive: user.is_active,
      createdAt: user.created_at,
    }));

    res.status(200).json({
      success: true,
      message: 'Users fetched successfully',
      data: { items, total, page, limit },
    });
  } catch (error) {
    console.error('Get All Users Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateUserByAdmin = async (req, res) => {
  const userId = req.params.id;
  const { name, email, role, permissions, isActive, password, subject } =
    req.body;

  try {
    const userCheck = await connectDB.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [userId],
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const fields = [];
    const values = [];
    let index = 1;

    const addField = (key, value) => {
      if (value !== undefined) {
        fields.push(`${key} = $${index}`);
        values.push(value);
        index++;
      }
    };

    addField('name', name);
    addField('email', email);
    addField('is_active', isActive);

    // ✅ Role update with subject logic
    if (role !== undefined) {
      addField('role', role);

      // Subject handling based on role
      if (role === 'teacher' || role === 'teacher_checker') {
        addField('subject', subject || null);
      } else {
        addField('subject', null);
      }
    } else {
      // If role not changing, check current role for subject
      const currentRole = userCheck.rows[0].role;
      if (currentRole === 'teacher' || currentRole === 'teacher_checker') {
        if (subject !== undefined) {
          addField('subject', subject || null);
        }
      } else {
        addField('subject', null);
      }
    }

    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      addField('password_hash', hashedPassword);
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    if (fields.length > 1) {
      await connectDB.query(
        `UPDATE users SET ${fields.join(', ')} WHERE id = $${index}`,
        [...values, userId],
      );
    }

    if (permissions) {
      const roleDefaults = resolvePermissionsByRole(
        role || userCheck.rows[0].role,
      );
      const finalPermissions = mergePermissions(roleDefaults, permissions);
      await upsertUserPermissionsJsonb(userId, finalPermissions);
    }

    const updatedResult = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = updatedResult.rows[0];

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        permissions:
          user.user_permissions || resolvePermissionsByRole(user.role),
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Update User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const deleteUserByAdmin = async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. Check user exists
    const userCheck = await connectDB.query(
      `SELECT id, role FROM users WHERE id = $1`,
      [userId],
    );
    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // 2. Prevent deleting admin
    if (userCheck.rows[0].role === ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete admin user',
      });
    }

    // 3. ✅ HARD DELETE - Permanently delete user
    // Pehle user_permissions delete karo
    await connectDB.query(`DELETE FROM user_permissions WHERE user_id = $1`, [
      userId,
    ]);

    // Phir user delete karo
    await connectDB.query(`DELETE FROM users WHERE id = $1`, [userId]);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully', // ✅ Changed message
    });
  } catch (error) {
    console.error('Delete User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const GetSingleUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.json({
      success: true,
      message: 'User fetched successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        permissions:
          user.user_permissions || resolvePermissionsByRole(user.role),
        isActive: user.is_active,
      },
    });
  } catch (error) {
    console.error('Get User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

export const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name } = req.body;

  try {
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Name is required',
      });
    }

    const result = await connectDB.query(
      `UPDATE users 
       SET name = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2 AND is_active = true
       RETURNING id, name, email, role`,
      [name.trim(), userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Update Profile Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};