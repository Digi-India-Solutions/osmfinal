// src/api/users.ts

import axiosInstance from './axios';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role:
    | 'admin'
    | 'super_admin'
    | 'teacher'
    | 'checker'
    | 'teacher_checker'
    | 'rechecking';
  isActive?: boolean;
  subject?: string | null;
}

export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  subject?: string | null;
  isActive: boolean;
  permissions: Record<string, any>;
  createdAt: string;
}

export const userApi = {
  // ─── AUTH ──────────────────────────────────────────────────

  // Login
  login: async (email: string, password: string) => {
    const response = await axiosInstance.post('/api/v1/auth/login', {
      email,
      password,
    });
    return response.data;
  },

  // Logout
  logout: async () => {
    const response = await axiosInstance.post('/api/v1/auth/logout');
    return response.data;
  },

  // Refresh token
  refreshToken: async () => {
    const response = await axiosInstance.post('/api/v1/auth/refresh-token');
    return response.data;
  },

  // Get current user (me)
  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await axiosInstance.get('/api/v1/auth/me');
    return response.data.data; // ✅ response.data.data
  },

  // ─── USER MANAGEMENT ──────────────────────────────────────

  // Create user
  createUser: async (data: CreateUserData): Promise<UserResponse> => {
    const response = await axiosInstance.post('/api/v1/auth/users', data);
    return response.data.data;
  },

  // Get all users
  getAllUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) => {
    const response = await axiosInstance.get('/api/v1/auth/users', { params });
    return response.data.data;
  },

  // Get single user
  getUser: async (id: string): Promise<UserResponse> => {
    const response = await axiosInstance.get(`/api/v1/auth/users/${id}`);
    return response.data.data;
  },

  // Update user
  updateUser: async (id: string, data: Partial<CreateUserData>) => {
    const response = await axiosInstance.patch(
      `/api/v1/auth/users/${id}`,
      data,
    );
    return response.data.data;
  },

  // Delete user
  deleteUser: async (id: string) => {
    const response = await axiosInstance.delete(`/api/v1/auth/users/${id}`);
    return response.data;
  },

  // Activate user
  activateUser: async (id: string) => {
    const response = await axiosInstance.patch(
      `/api/v1/auth/users/${id}/activate`,
      {},
    );
    return response.data.data;
  },

  // Deactivate user
  deactivateUser: async (id: string) => {
    const response = await axiosInstance.patch(
      `/api/v1/auth/users/${id}/deactivate`,
      {},
    );
    return response.data.data;
  },

  // Toggle user active status
  toggleUserStatus: async (id: string, isActive: boolean) => {
    const response = await axiosInstance.patch(
      `/api/v1/auth/users/${id}/status`,
      { isActive },
    );
    return response.data.data;
  },

  // Update profile
  updateProfile: async (name: string) => {
    const response = await axiosInstance.put('/api/v1/auth/profile', { name });
    return response.data.data;
  },

  // ─── PASSWORD ──────────────────────────────────────────────

  // Forgot password
  forgotPassword: async (email: string) => {
    const response = await axiosInstance.post('/api/v1/auth/forgot-password', {
      email,
    });
    return response.data;
  },

  // Reset password
  resetPassword: async (token: string, password: string) => {
    const response = await axiosInstance.post(
      `/api/v1/auth/reset-password/${token}`,
      { password },
    );
    return response.data;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string) => {
    const response = await axiosInstance.post('/api/v1/auth/change-password', {
      currentPassword,
      newPassword,
    });
    return response.data;
  },

  // ─── OTP ────────────────────────────────────────────────────

  // Send OTP
  sendOtp: async (email: string) => {
    const response = await axiosInstance.post('/api/v1/auth/send-otp', {
      email,
    });
    return response.data;
  },

  // Verify OTP
  verifyOtp: async (email: string, otp: string) => {
    const response = await axiosInstance.post('/api/v1/auth/verify-otp', {
      email,
      otp,
    });
    return response.data;
  },

  // ─── SUPER ADMIN ────────────────────────────────────────────

  // Register Super Admin
  registerSuperAdmin: async (
    name: string,
    email: string,
    password: string,
    secretKey: string,
  ) => {
    const response = await axiosInstance.post(
      '/api/v1/auth/register-super-admin',
      {
        name,
        email,
        password,
        secretKey,
      },
    );
    return response.data;
  },
};
