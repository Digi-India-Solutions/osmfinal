// backend/src/controllers/exam-admin-controller.js

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
import nodemailer from 'nodemailer';

// ─── CONSTANTS ──────────────────────────────────────────────────────────────

const normalizeRoleKey = (value) =>
  String(value || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');

const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  TEACHER: 'teacher',
  CHECKER: 'checker',
  TEACHER_CHECKER: 'teacher_checker',
  RECHECKING: 'rechecking',
};

const ROLE_PERMISSIONS = {
  super_admin: {
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
  admin: {
    dashboard: { view: true },
    exams: { view: true, create: true, edit: true, delete: true },
    'mark-scheme': { view: true, create: true, edit: true },
    'student-data': { view: true, upload: true, manage: true },
    sheets: { view: true, upload: true, assign: true },
    queue: { view: true, manage: true },
    users: { view: true, create: true, edit: true, delete: true },
    reports: { view: true, export: true },
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

// ─── OTP STORE ──────────────────────────────────────────────────────────────

const OTP_EXPIRY_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const otpStore = new Map();

// ─── EMAIL TRANSPORTER ─────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

transporter.verify((error) => {
  if (error) {
    console.error('❌ Email transport error:', error.message);
  } else {
    console.log('✅ Email transport ready');
  }
});

const generateOtp = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

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
            subject: user.subject || null,
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

// ─── ACTIVATE USER ─────────────────────────────────────────────────────────

export const activateUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const userCheck = await connectDB.query(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      [userId],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentUser = userCheck.rows[0];

    if (currentUser.is_active === true) {
      return res.status(400).json({
        success: false,
        message: 'User is already active',
      });
    }

    if (currentUser.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot modify Super Admin status',
      });
    }

    await connectDB.query(
      `UPDATE users 
       SET is_active = true, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [userId],
    );

    const updatedResult = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = updatedResult.rows[0];

    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2>Account Activated</h2>
          <p>Your account has been <strong>activated</strong> by an administrator.</p>
          <p>You can now login to the Exam Management System.</p>
          <a href="${process.env.FRONTEND_URL}/login">Login Now</a>
        </div>
      `;
      await sendEmail(user.email, 'Account Activated', html);
    } catch (mailErr) {
      console.error('Activation email failed:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'User activated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        isActive: user.is_active,
        permissions:
          user.user_permissions || resolvePermissionsByRole(user.role),
      },
    });
  } catch (error) {
    console.error('Activate User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ─── DEACTIVATE USER ───────────────────────────────────────────────────────

export const deactivateUser = async (req, res) => {
  const userId = req.params.id;

  try {
    const userCheck = await connectDB.query(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      [userId],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentUser = userCheck.rows[0];

    if (currentUser.id === req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    if (currentUser.role === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate Super Admin user',
      });
    }

    if (currentUser.role === ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate Admin user',
      });
    }

    if (currentUser.is_active === false) {
      return res.status(400).json({
        success: false,
        message: 'User is already inactive',
      });
    }

    await connectDB.query(
      `UPDATE users 
       SET is_active = false, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1`,
      [userId],
    );

    const updatedResult = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = updatedResult.rows[0];

    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2>Account Deactivated</h2>
          <p>Your account has been <strong>deactivated</strong> by an administrator.</p>
          <p>If you think this was a mistake, please contact support.</p>
        </div>
      `;
      await sendEmail(user.email, 'Account Deactivated', html);
    } catch (mailErr) {
      console.error('Deactivation email failed:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'User deactivated successfully',
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        isActive: user.is_active,
        permissions:
          user.user_permissions || resolvePermissionsByRole(user.role),
      },
    });
  } catch (error) {
    console.error('Deactivate User Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ─── TOGGLE USER STATUS ───────────────────────────────────────────────────

export const toggleUserStatus = async (req, res) => {
  const userId = req.params.id;
  const { isActive } = req.body;

  try {
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value (true/false)',
      });
    }

    const userCheck = await connectDB.query(
      `SELECT id, role, is_active FROM users WHERE id = $1`,
      [userId],
    );

    if (userCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    const currentUser = userCheck.rows[0];

    if (currentUser.id === req.user.id && isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'You cannot deactivate your own account',
      });
    }

    if (currentUser.role === ROLES.SUPER_ADMIN && isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate Super Admin user',
      });
    }

    if (currentUser.role === ROLES.ADMIN && isActive === false) {
      return res.status(403).json({
        success: false,
        message: 'Cannot deactivate Admin user',
      });
    }

    if (currentUser.is_active === isActive) {
      return res.status(400).json({
        success: false,
        message: `User is already ${isActive ? 'active' : 'inactive'}`,
      });
    }

    await connectDB.query(
      `UPDATE users 
       SET is_active = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [isActive, userId],
    );

    const updatedResult = await connectDB.query(
      `SELECT u.id, u.name, u.email, u.role, u.is_active, u.subject,
              up.permissions as user_permissions
       FROM users u
       LEFT JOIN user_permissions up ON u.id = up.user_id
       WHERE u.id = $1`,
      [userId],
    );
    const user = updatedResult.rows[0];

    try {
      const statusText = isActive ? 'activated' : 'deactivated';
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto;">
          <h2>Account ${isActive ? 'Activated' : 'Deactivated'}</h2>
          <p>Your account has been <strong>${statusText}</strong> by an administrator.</p>
          ${
            isActive
              ? '<p>You can now login to the Exam Management System.</p><a href="${process.env.FRONTEND_URL}/login">Login Now</a>'
              : '<p>If you think this was a mistake, please contact support.</p>'
          }
        </div>
      `;
      await sendEmail(
        user.email,
        `Account ${isActive ? 'Activated' : 'Deactivated'}`,
        html,
      );
    } catch (mailErr) {
      console.error('Status change email failed:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        subject: user.subject || null,
        isActive: user.is_active,
        permissions:
          user.user_permissions || resolvePermissionsByRole(user.role),
      },
    });
  } catch (error) {
    console.error('Toggle User Status Error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
};

// ─── REGISTER SUPER ADMIN ──────────────────────────────────────────────────

export const registerSuperAdmin = async (req, res) => {
  try {
    const { name, email, password, secretKey } = req.body;

    const SUPER_ADMIN_SECRET = process.env.SUPER_ADMIN_SECRET;

    if (!SUPER_ADMIN_SECRET) {
      console.error('❌ SUPER_ADMIN_SECRET not set in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
    }

    if (secretKey !== SUPER_ADMIN_SECRET) {
      return res.status(403).json({
        success: false,
        message: 'Invalid secret key',
      });
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Name, email and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
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

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await connectDB.query(
      `INSERT INTO users (id, name, email, password_hash, role, is_active, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, 'super_admin', true, NOW())
       RETURNING id, name, email, role, is_active`,
      [name, email, hashedPassword],
    );

    const superAdminPermissions = {
      dashboard: { view: true },
      exams: { view: true, create: true, edit: true, delete: true },
      'mark-scheme': { view: true, create: true, edit: true },
      'student-data': { view: true, upload: true, manage: true },
      sheets: { view: true, upload: true, assign: true },
      queue: { view: true, manage: true },
      users: { view: true, create: true, edit: true, delete: true },
      reports: { view: true, export: true },
      settings: { view: true, edit: true },
    };

    await upsertUserPermissionsJsonb(result.rows[0].id, superAdminPermissions);

    return res.status(201).json({
      success: true,
      message: 'Super Admin created successfully',
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        email: result.rows[0].email,
        role: result.rows[0].role,
        isActive: result.rows[0].is_active,
      },
    });
  } catch (error) {
    console.error('Register Super Admin Error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Failed to create Super Admin',
      error: error.message,
    });
  }
};

// ─── CHANGE PASSWORD ───────────────────────────────────────────────────────

export const changePassword = async (req, res) => {
  const userId = req.user.id;
  const { currentPassword, newPassword } = req.body;

  try {
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

    const isMatch = await comparePassword(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await connectDB.query(
      `UPDATE users 
       SET password_hash = $1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $2`,
      [hashedPassword, userId],
    );

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

// ─── GET ALL USERS ─────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── GET ALL USERS ─────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── GET ALL USERS ─────────────────────────────────────────────────────────

export const getAllUsers = async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 50);
    const search = (req.query.search || '').toString().trim();
    const role = (req.query.role || '').toString().trim();
    const offset = (page - 1) * limit;

    // ✅ Sirf Admin role wale user ko Super Admin hide karo
    const currentUserRole = req.user?.role;

    let conditions = [];
    let values = [];
    let index = 1;

    // ✅ Agar current user Admin hai toh Super Admin hide karo
    // ✅ Agar current user Super Admin hai toh sab dikhao
    if (currentUserRole === 'admin') {
      conditions.push(`u.role != 'super_admin'`);
    }

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

// ─── UPDATE USER ───────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── UPDATE USER ───────────────────────────────────────────────────────────

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

    const currentUserRole = req.user?.role;
    const targetUserRole = userCheck.rows[0].role;

    // ✅ Prevent non-Super Admin from updating Super Admin
    if (targetUserRole === ROLES.SUPER_ADMIN && currentUserRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify Super Admin user',
      });
    }

    // ✅ Prevent updating role to Super Admin if not Super Admin
    if (role === ROLES.SUPER_ADMIN && currentUserRole !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to assign Super Admin role',
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

    if (role !== undefined) {
      addField('role', role);

      if (role === 'teacher' || role === 'teacher_checker') {
        addField('subject', subject || null);
      } else {
        addField('subject', null);
      }
    } else {
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
// ─── DELETE USER ───────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── DELETE USER ───────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── DELETE USER ───────────────────────────────────────────────────────────

// backend/src/controllers/exam-admin-controller.js

// ─── DELETE USER ───────────────────────────────────────────────────────────

export const deleteUserByAdmin = async (req, res) => {
  const userId = req.params.id;

  try {
    // 1. Check if user exists
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

    const userRole = userCheck.rows[0].role;

    // 2. Prevent deleting Super Admin
    if (userRole === ROLES.SUPER_ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete Super Admin user',
      });
    }

    // 3. Prevent deleting Admin
    if (userRole === ROLES.ADMIN) {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete Admin user',
      });
    }

    // 4. ✅ Delete from all tables that reference users table
    // Order matters: child tables first, then parent
    
    const deleteQueries = [
      // 1. Recheck markings
      {
        table: 'recheck_markings',
        column: 'checker_id',
      },
      // 2. Checker markings
      {
        table: 'checker_markings',
        column: 'checker_id',
      },
      // 3. Recheck requests (multiple columns)
      {
        table: 'recheck_requests',
        column: 'assign_to',
      },
      {
        table: 'recheck_requests',
        column: 'requested_by',
      },
      {
        table: 'recheck_requests',
        column: 'resolved_by',
      },
      {
        table: 'recheck_requests',
        column: 'escalated_by',
      },
      {
        table: 'recheck_requests',
        column: 'reassigned_by',
      },
      // 4. Sheet activity logs
      {
        table: 'sheet_activity_logs',
        column: 'performed_by',
      },
      // 5. Assignments
      {
        table: 'assignments',
        column: 'checker_id',
      },
      {
        table: 'assignments',
        column: 'assigned_by',
      },
      // 6. Sheets
      {
        table: 'sheets',
        column: 'uploaded_by',
      },
      {
        table: 'sheets',
        column: 'escalated_by',
      },
      {
        table: 'sheets',
        column: 'assigned_to',
      },
      // 7. User permissions
      {
        table: 'user_permissions',
        column: 'user_id',
      },
    ];

    // Execute all delete queries
    let deletedCount = 0;
    for (const q of deleteQueries) {
      try {
        const result = await connectDB.query(
          `DELETE FROM ${q.table} WHERE ${q.column} = $1`,
          [userId]
        );
        if (result.rowCount > 0) {
          deletedCount += result.rowCount;
          console.log(`✅ Deleted ${result.rowCount} records from ${q.table} (${q.column})`);
        }
      } catch (err) {
        // Table or column might not exist, continue
        console.log(`ℹ️ Skipped ${q.table}.${q.column}: ${err.message}`);
      }
    }

    // 5. ✅ Also delete from any other possible tables
    const additionalTables = [
      'user_sessions',
      'refresh_tokens',
      'audit_logs',
      'notification_tokens',
      'login_attempts',
      'password_reset_tokens',
      'email_verification_tokens',
      'user_activity_logs',
      'student_data', // If this has user_id
      'exam_assignments', // If this has user_id
      'checking_queue', // If this has user_id
      'mark_scheme_assignments', // If this has user_id
    ];

    for (const table of additionalTables) {
      try {
        // Check if table exists and has user_id column
        const tableCheck = await connectDB.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'user_id'
          )
        `, [table]);
        
        if (tableCheck.rows[0].exists) {
          const result = await connectDB.query(
            `DELETE FROM ${table} WHERE user_id = $1`,
            [userId]
          );
          if (result.rowCount > 0) {
            deletedCount += result.rowCount;
            console.log(`✅ Deleted ${result.rowCount} records from ${table}`);
          }
        }
      } catch (err) {
        // Table might not exist
        console.log(`ℹ️ Table ${table} not found`);
      }
    }

    // 6. ✅ Finally delete the user
    const deleteResult = await connectDB.query(
      `DELETE FROM users WHERE id = $1 RETURNING id, name, email`,
      [userId]
    );

    if (deleteResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found or already deleted',
      });
    }

    console.log(`✅ User ${deleteResult.rows[0].name} (${deleteResult.rows[0].email}) deleted successfully`);
    console.log(`✅ Total records deleted: ${deletedCount}`);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
      data: {
        deletedRecords: deletedCount,
        user: deleteResult.rows[0]
      }
    });
    
  } catch (error) {
    console.error('❌ Delete User Error:', error.message);
    console.error('Stack:', error.stack);
    
    // Handle specific errors
    if (error.code === '23503') {
      const tableMatch = error.message.match(/table "([^"]+)"/);
      const constraintMatch = error.message.match(/constraint "([^"]+)"/);
      
      return res.status(400).json({
        success: false,
        message: `Cannot delete user. Associated records exist in table: ${tableMatch ? tableMatch[1] : 'unknown'}`,
        table: tableMatch ? tableMatch[1] : undefined,
        constraint: constraintMatch ? constraintMatch[1] : undefined,
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
// ─── GET SINGLE USER ──────────────────────────────────────────────────────

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

// ─── UPDATE PROFILE ────────────────────────────────────────────────────────

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

// ─── OTP ENDPOINTS ─────────────────────────────────────────────────────────

export const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: 'Valid email is required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otp = generateOtp();
    const expiresAt = Date.now() + OTP_EXPIRY_MS;

    otpStore.set(normalizedEmail, { otp, expiresAt, attempts: 0 });

    await transporter.sendMail({
      from: `"OSM System" <${process.env.EMAIL_USER}>`,
      to: email.trim(),
      subject: 'Email Verification OTP — OSM',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;
                    padding:28px;border:1px solid #e5e7eb;border-radius:12px;">
          <h2 style="color:#111;font-size:18px;margin:0 0 6px">
            Email Verification
          </h2>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px">
            Use the OTP below to verify your email address for OSM.
            It expires in <strong>10 minutes</strong>.
          </p>
          <div style="text-align:center;margin:24px 0">
            <span style="display:inline-block;font-size:38px;font-weight:700;
                         letter-spacing:14px;color:#111;background:#f3f4f6;
                         padding:16px 28px;border-radius:10px;font-family:monospace">
              ${otp}
            </span>
          </div>
          <p style="color:#9ca3af;font-size:12px;text-align:center;margin:0">
            If you did not request this, please ignore this email.
          </p>
        </div>
      `,
    });

    return res.status(200).json({
      success: true,
      message: `OTP sent to ${email.trim()}`,
    });
  } catch (error) {
    console.error('sendOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
    });
  }
};

export const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: 'Email and OTP are required',
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const record = otpStore.get(normalizedEmail);

    if (!record) {
      return res.status(400).json({
        success: false,
        message: 'OTP not found. Please request a new one.',
      });
    }

    if (Date.now() > record.expiresAt) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Please request a new one.',
      });
    }

    if (record.attempts >= MAX_ATTEMPTS) {
      otpStore.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: 'Too many failed attempts. Please request a new OTP.',
      });
    }

    if (record.otp !== otp.trim()) {
      record.attempts += 1;
      const remaining = MAX_ATTEMPTS - record.attempts;
      return res.status(400).json({
        success: false,
        message: `Invalid OTP. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`,
      });
    }

    otpStore.delete(normalizedEmail);

    return res.status(200).json({
      success: true,
      message: 'Email verified successfully',
    });
  } catch (error) {
    console.error('verifyOtp error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to verify OTP. Please try again.',
    });
  }
};
