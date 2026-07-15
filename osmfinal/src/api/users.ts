// api/users.ts
import axiosInstance from './axios';

export interface CreateUserData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'teacher' | 'checker' | 'teacher_checker' | 'rechecking';
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
  // Create user - matches route: POST /api/v1/auth/users
  createUser: async (data: CreateUserData): Promise<UserResponse> => {
    const response = await axiosInstance.post('/api/v1/auth/users', data);
    return response.data.data;
  },

  // Get all users - matches route: GET /api/v1/auth/users
  getAllUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    role?: string;
  }) => {
    const response = await axiosInstance.get('/api/v1/auth/users', { params });
    return response.data.data;
  },

  // Get user by id - matches route: GET /api/v1/auth/user (current user)
  getCurrentUser: async (): Promise<UserResponse> => {
    const response = await axiosInstance.get('/api/v1/auth/user');
    return response.data.user;
  },

  // Update user - matches route: PATCH /api/v1/auth/users/:id
  updateUser: async (id: string, data: Partial<CreateUserData>) => {
    const response = await axiosInstance.patch(
      `/api/v1/auth/users/${id}`,
      data,
    );
    return response.data.data;
  },

  // Delete/Deactivate user - matches route: DELETE /api/v1/auth/users/:id
  deleteUser: async (id: string) => {
    const response = await axiosInstance.delete(`/api/v1/auth/users/${id}`);
    return response.data;
  },
  // api/users.ts mein add karo
  sendOtp: async (email: string) => {
    const response = await axiosInstance.post('/api/v1/auth/send-otp', { email });
    return response.data;
  },

  verifyOtp: async (email: string, otp: string) => {
    const response = await axiosInstance.post('/api/v1/auth/verify-otp', { email, otp });
    return response.data;
  },
};
