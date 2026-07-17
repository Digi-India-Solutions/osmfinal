// backend/src/routes/exam-admin-routes.js

import { Router } from 'express';
import {
  login,
  logout,
  refreshToken,
  GetSingleUser,
  ForgotPassword,
  ResetPassword,
  verifyLoggedIn,
  createUserByAdmin,
  getAllUsers,
  updateUserByAdmin,
  deleteUserByAdmin,
  changePassword,
  updateProfile,
  registerSuperAdmin,
  sendOtp,
  verifyOtp,
  toggleUserStatus,
  activateUser,
  deactivateUser,
} from './admin-controller.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// ─── AUTH ROUTES (Public) ──────────────────────────────────────────────────

router.post('/register-super-admin', registerSuperAdmin);
router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', verifyToken, verifyLoggedIn);

// ─── PASSWORD ROUTES ──────────────────────────────────────────────────────

router.post('/forgot-password', ForgotPassword);
router.post('/reset-password/:token', ResetPassword);
router.post('/change-password', verifyToken, changePassword);

// ─── PROFILE ROUTES ──────────────────────────────────────────────────────

router.put('/profile', verifyToken, updateProfile);

// ─── USER MANAGEMENT ROUTES ──────────────────────────────────────────────

router.get('/users/me', verifyToken, GetSingleUser);
router.get('/users', verifyToken, getAllUsers);
router.post('/users', verifyToken, createUserByAdmin);
router.patch('/users/:id', verifyToken, updateUserByAdmin);
router.delete('/users/:id', verifyToken, deleteUserByAdmin);

// ─── USER STATUS ROUTES ──────────────────────────────────────────────────

router.patch('/users/:id/activate', verifyToken, activateUser);
router.patch('/users/:id/deactivate', verifyToken, deactivateUser);
router.patch('/users/:id/status', verifyToken, toggleUserStatus);

// ─── OTP ROUTES (Public) ──────────────────────────────────────────────────

router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

export default router;
