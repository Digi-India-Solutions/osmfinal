// exam-admin-routes.js
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
} from './admin-controller.js';
import { verifyToken } from '../../middlewares/verifyToken.middleware.js';

const router = Router();

// Auth routes
router.post('/auth/register-super-admin', registerSuperAdmin);
router.post('/login', login);
router.post('/logout', verifyToken, logout);
router.post('/refresh-token', refreshToken);
router.get('/me', verifyToken, verifyLoggedIn);

// Password routes
router.post('/forgot-password', ForgotPassword);
router.post('/reset-password/:token', ResetPassword);

// Change password (protected - only admin)
router.post('/change-password', verifyToken, changePassword);

// Update profile name (protected - only admin)
router.put('/users/profile', verifyToken, updateProfile);

// User management
router.get('/user', verifyToken, GetSingleUser);
router.post('/users', verifyToken, createUserByAdmin);
router.get('/users', verifyToken, getAllUsers);
router.patch('/users/:id', verifyToken, updateUserByAdmin);
router.delete('/users/:id', verifyToken, deleteUserByAdmin);
router.post('/send-otp', sendOtp);
router.post('/verify-otp', verifyOtp);

export default router;
