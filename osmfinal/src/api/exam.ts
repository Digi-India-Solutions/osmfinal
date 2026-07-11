// src/api/exam.ts

import axiosInstance from './axios';

export interface ExamResponse {
  id: number;
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  spentTime: number;
  status: 'active' | 'inactive' | 'archived';
  createdBy: number;
  created_at?: string;
  updated_at?: string;
  sheet_count?: number;
  checked_count?: number;
  checking_count?: number;
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

export interface DeletionPreviewResponse {
  exams: Array<{
    id: number;
    name: string;
    subject: string;
    date: string;
    status: string;
    sheet_count: number;
    checked_count: number;
    checking_count: number;
    pending_count: number;
  }>;
  totalExams: number;
  totalSheets: number;
  willDelete: {
    exams: number;
    sheets: number;
  };
}

export const examApi = {
  createExam: async (data: CreateExamData): Promise<ExamResponse> => {
    const response = await axiosInstance.post('/api/v1/exam/exams', data);
    return response.data.data;
  },

  getAllExams: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    excludeArchived?: boolean;
  }): Promise<PaginatedExamsResponse> => {
    console.log('🔍 getAllExams called with params:', params);

    const queryParams: any = { ...params };
    if (params?.excludeArchived !== undefined) {
      queryParams.excludeArchived = params.excludeArchived ? 'true' : 'false';
    }

    console.log('🔍 Final queryParams:', queryParams);

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

  // ✅ DELETE SINGLE EXAM (CASCADES TO SHEETS)
  deleteExam: async (id: number) => {
    const response = await axiosInstance.delete(`/api/v1/exam/exams/${id}`);
    return response.data;
  },

  // ✅ BULK DELETE EXAMS (CASCADES TO SHEETS)
  bulkDeleteExams: async (ids: number[]) => {
    const response = await axiosInstance.post(
      '/api/v1/exam/exams/bulk-delete',
      {
        ids,
      },
    );
    return response.data;
  },

  // ✅ GET DELETION PREVIEW
  getDeletionPreview: async (ids: string): Promise<DeletionPreviewResponse> => {
    const response = await axiosInstance.get(
      '/api/v1/exam/exams/deletion-preview',
      {
        params: { ids },
      },
    );
    return response.data.data;
  },
};
