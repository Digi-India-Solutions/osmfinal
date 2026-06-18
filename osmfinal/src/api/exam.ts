// api/exams.ts
import axiosInstance from './axios';

export interface CreateExamData {
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  status?: 'active' | 'inactive' | 'archived';
  createdBy: number;
}

export interface ExamResponse {
  id: number;
  name: string;
  subject: string;
  date: string;
  totalQuestions: number;
  maxMarks: number;
  status: 'active' | 'inactive' | 'archived';
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedExamsResponse {
  data: ExamResponse[];
  total: number;
  totalPages: number;
  currentPage: number;
}

// NOTE: adjust the '/exams' prefix below to match wherever this router
// actually gets mounted (e.g. app.use('/api/exam-admin', examRoutes) means
// the real path is '/api/exam-admin/exams', not just '/exams').
export const examApi = {
  createExam: async (data: CreateExamData): Promise<ExamResponse> => {
    const response = await axiosInstance.post('/api/v1/exam/exams', data);
    return response.data.data;
  },

  getAllExams: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<PaginatedExamsResponse> => {
    const response = await axiosInstance.get('/api/v1/exam/exams', { params });
    return response.data;
  },

  getExamById: async (id: number): Promise<ExamResponse> => {
    const response = await axiosInstance.get(`/api/v1/exam/exams/${id}`);
    return response.data.data;
  },

  updateExam: async (id: number, data: Partial<CreateExamData>): Promise<ExamResponse> => {
    const response = await axiosInstance.patch(`/api/v1/exam/exams/${id}`, data);
    return response.data.data;
  },

  deleteExam: async (id: number) => {
    const response = await axiosInstance.delete(`/api/v1/exam/exams/${id}`);
    return response.data;
  },
};