// src/api/exam.ts

import axiosInstance from './axios';

export interface ExamResponse {
  id: number;
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  spentTime: number; // ✅ New field
  status: 'active' | 'inactive' | 'archived';
  createdBy: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreateExamData {
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  spentTime?: number;
  status?: 'active' | 'inactive' | 'archived';
  createdBy: number;
}

export interface PaginatedExamsResponse {
  data: ExamResponse[];
  total: number;
  totalPages: number;
  currentPage: number;
}

export const examApi = {
  createExam: async (data: CreateExamData): Promise<ExamResponse> => {
    const response = await axiosInstance.post('/api/v1/exam/exams', data);
    return response.data.data;
  },

  // ✅ Fixed - Sirf ek baar define kiya
  getAllExams: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    excludeArchived?: boolean;
  }): Promise<PaginatedExamsResponse> => {
    // ✅ Debug
    console.log('🔍 getAllExams called with params:', params);

    const queryParams: any = { ...params };
    if (params?.excludeArchived !== undefined) {
      queryParams.excludeArchived = params.excludeArchived ? 'true' : 'false';
    }

    console.log('🔍 Final queryParams:', queryParams); // ✅ Debug

    const response = await axiosInstance.get('/api/v1/exam/exams', {
      params: queryParams,
    });
    return response.data;
  },

  getExamById: async (id: number): Promise<ExamResponse> => {
    const response = await axiosInstance.get(`/api/v1/exam/exams/${id}`);
    return response.data.data;
  },

  updateExam: async (
    id: number,
    data: Partial<CreateExamData>,
  ): Promise<ExamResponse> => {
    const response = await axiosInstance.patch(
      `/api/v1/exam/exams/${id}`,
      data,
    );
    return response.data.data;
  },

  deleteExam: async (id: number) => {
    const response = await axiosInstance.delete(`/api/v1/exam/exams/${id}`);
    return response.data;
  },
};
