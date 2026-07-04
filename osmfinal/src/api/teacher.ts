// src/api/teacher.ts

import api from './axios';
import { examApi, type ExamResponse } from './exam';

// ─── TYPES ──────────────────────────────────────────────────────

export interface TeacherExam {
  id: string;
  name: string;
  subject: string;
  total_questions: number;
  max_marks: number;
  date: string;
  status: 'upcoming' | 'active' | 'completed';
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeacherSheet {
  id: string;
  exam_id: string;
  roll_no: string;
  student_name: string;
  barcode: string;
  file_name: string | null;
  file_url: string | null;
  marks: number | null;
  status:
    | 'uploaded'
    | 'checking'
    | 'checked'
    | 'recheck'
    | 'rechecked'
    | 'escalated';
  assigned_to: string | null;
  checker_name?: string;
  created_at: string;
  updated_at: string;
  exam_name?: string;
  isDisputed?: boolean;
}

export interface TeacherMarkSchemeItem {
  id: string;
  exam_id: string;
  question_name: string;
  max_marks: number;
  guidelines: string;
  model_answer_pdf: string | null;
  question_paper_pdf: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeacherRecheckRequest {
  id: string;
  sheet_id: string;
  exam_id: string;
  reason: string;
  assign_to: string | null;
  status: 'pending' | 'assigned' | 'completed' | 'rejected' | 'escalated';
  requested_by: string;
  resolved_by: string | null;
  final_marks_rule: 'higher' | 'recheck_marks' | 'average';
  resolved_at: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  roll_no?: string;
  exam_name?: string;
  requested_by_name?: string;
  resolved_by_name?: string;
}

export interface TeacherDashboardStats {
  exams: TeacherExam[];
  stats: {
    totalExams: number;
    totalSheets: number;
    checking: number;
    completed: number;
    recheck: number;
    pendingDisputes: number;
  };
}

export interface TeacherProgressData {
  exam: TeacherExam;
  sheets: TeacherSheet[];
  stats: {
    total: number;
    checking: number;
    checked: number;
    recheck: number;
    done: number;
    progress: number;
  };
}

export interface TeacherResultsData {
  exam: TeacherExam;
  sheets: TeacherSheet[];
  stats: {
    totalStudents: number;
    average: string;
    highest: number;
    lowest: number;
    passCount: number;
    failCount: number;
  };
}

export interface TeacherStats {
  exams: {
    total_exams: number;
    upcoming: number;
    active: number;
    completed: number;
  };
  sheets: {
    total_sheets: number;
    checking: number;
    checked: number;
    recheck: number;
    rechecked: number;
  };
  disputes: {
    total: number;
    pending: number;
    completed: number;
  };
}

export interface SaveMarkSchemePayload {
  questionName: string;
  maxMarks: number;
  guidelines?: string;
}

// ─── TEACHER API SERVICE ──────────────────────────────────────

class TeacherApiService {
  // ─── DASHBOARD ──────────────────────────────────────────────

  async getDashboard(): Promise<{
    success: boolean;
    data: TeacherDashboardStats;
  }> {
    try {
      const response = await api.get('/api/v1/teacher/dashboard');
      return response.data;
    } catch (error: any) {
      console.error('Get dashboard error:', error);
      return {
        success: false,
        data: {
          exams: [],
          stats: {
            totalExams: 0,
            totalSheets: 0,
            checking: 0,
            completed: 0,
            recheck: 0,
            pendingDisputes: 0,
          },
        },
      };
    }
  }

  // ─── EXAMS - ✅ USE EXAM API ─────────────────────────────────

  async getExams(
    status?: string,
  ): Promise<{ success: boolean; data: TeacherExam[] }> {
    try {
      // ✅ Use examApi.getAllExams() instead of direct call
      const response = await examApi.getAllExams({ limit: 1000 });

      if (response.success) {
        // Convert to TeacherExam format
        const exams = response.data.map((exam: any) => ({
          id: exam.id,
          name: exam.name,
          subject: exam.subject,
          total_questions: exam.totalQuestions || exam.total_questions || 0,
          max_marks: exam.maxMarks || exam.max_marks || 100,
          date: exam.date,
          status: exam.status || 'upcoming',
          created_by: exam.created_by || exam.createdBy || '',
          created_at: exam.created_at || exam.createdAt || '',
          updated_at: exam.updated_at || exam.updatedAt || '',
        }));

        // Filter by status if provided
        const filtered = status
          ? exams.filter((e: any) => e.status === status)
          : exams;

        return { success: true, data: filtered };
      }

      return { success: false, data: [] };
    } catch (error: any) {
      console.error('Get exams error:', error);
      return { success: false, data: [] };
    }
  }

  async createExam(data: {
    name: string;
    total_questions?: number;
    max_marks?: number;
    date: string;
    status?: string;
  }): Promise<{ success: boolean; data: TeacherExam }> {
    try {
      // ✅ Use examApi
      const response = await examApi.createExam({
        name: data.name,
        subject: data.subject || '',
        totalQuestions: data.total_questions || 0,
        maxMarks: data.max_marks || 100,
        date: data.date,
        status: data.status || 'upcoming',
        createdBy: 0,
      });

      return {
        success: true,
        data: {
          id: response.id,
          name: response.name,
          subject: response.subject,
          total_questions: response.totalQuestions || 0,
          max_marks: response.maxMarks || 100,
          date: response.date,
          status: response.status || 'upcoming',
          created_by: '',
          created_at: '',
          updated_at: '',
        },
      };
    } catch (error: any) {
      console.error('Create exam error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  async updateExam(
    id: string,
    data: {
      name?: string;
      total_questions?: number;
      max_marks?: number;
      date?: string;
      status?: string;
    },
  ): Promise<{ success: boolean; data: TeacherExam }> {
    try {
      // ✅ Use examApi
      const response = await examApi.updateExam(Number(id), {
        name: data.name,
        totalQuestions: data.total_questions,
        maxMarks: data.max_marks,
        date: data.date,
        status: data.status,
      });

      return {
        success: true,
        data: {
          id: response.id,
          name: response.name,
          subject: response.subject,
          total_questions: response.totalQuestions || 0,
          max_marks: response.maxMarks || 100,
          date: response.date,
          status: response.status || 'upcoming',
          created_by: '',
          created_at: '',
          updated_at: '',
        },
      };
    } catch (error: any) {
      console.error('Update exam error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  async deleteExam(id: string): Promise<{ success: boolean; message: string }> {
    try {
      // ✅ Use examApi
      const response = await examApi.deleteExam(Number(id));
      return { success: true, message: 'Exam deleted' };
    } catch (error: any) {
      console.error('Delete exam error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete exam',
      };
    }
  }

  // ─── SHEETS ──────────────────────────────────────────────────

  async getSheets(params?: {
    examId?: string;
    status?: string;
  }): Promise<{ success: boolean; data: TeacherSheet[] }> {
    try {
      const response = await api.get('/api/v1/teacher/sheets', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get sheets error:', error);
      return { success: false, data: [] };
    }
  }

  async getSheetDetails(
    id: string,
  ): Promise<{ success: boolean; data: TeacherSheet }> {
    try {
      const response = await api.get(`/api/v1/teacher/sheets/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get sheet details error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  async uploadSheet(
    formData: FormData,
  ): Promise<{ success: boolean; data: TeacherSheet }> {
    try {
      const response = await api.post(
        '/api/v1/teacher/sheets/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload sheet error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  async deleteSheet(
    id: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.delete(`/api/v1/teacher/sheets/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete sheet',
      };
    }
  }

  // ─── MARK SCHEME ────────────────────────────────────────────

  async getMarkScheme(
    examId: string,
  ): Promise<{ success: boolean; data: TeacherMarkSchemeItem[] }> {
    try {
      const response = await api.get(`/api/v1/teacher/mark-scheme/${examId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get mark scheme error:', error);
      return { success: false, data: [] };
    }
  }

  async saveMarkScheme(
    examId: string,
    scheme: SaveMarkSchemePayload[],
  ): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post(`/api/v1/teacher/mark-scheme/${examId}`, {
        scheme,
      });
      return response.data;
    } catch (error: any) {
      console.error('Save mark scheme error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save mark scheme',
      };
    }
  }

  // ─── PROGRESS ───────────────────────────────────────────────

  async getProgress(
    examId: string,
  ): Promise<{ success: boolean; data: TeacherProgressData }> {
    try {
      const response = await api.get(`/api/v1/teacher/progress/${examId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get progress error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  // ─── RESULTS ─────────────────────────────────────────────────

  async getResults(
    examId: string,
  ): Promise<{ success: boolean; data: TeacherResultsData }> {
    try {
      const response = await api.get(`/api/v1/teacher/results/${examId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get results error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  // ─── DISPUTES / RECHECK ─────────────────────────────────────

  async requestRecheck(data: {
    sheetId: string;
    examId: string;
    reason: string;
  }): Promise<{ success: boolean; data: TeacherRecheckRequest }> {
    try {
      const response = await api.post('/api/v1/teacher/recheck/request', data);
      return response.data;
    } catch (error: any) {
      console.error('Request recheck error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  async getRecheckRequests(
    status?: string,
  ): Promise<{ success: boolean; data: TeacherRecheckRequest[] }> {
    try {
      const response = await api.get('/api/v1/teacher/recheck/requests', {
        params: { status },
      });
      return response.data;
    } catch (error: any) {
      console.error('Get recheck requests error:', error);
      return { success: false, data: [] };
    }
  }

  async updateRecheckStatus(
    id: string,
    data: { status: string; remarks?: string },
  ): Promise<{ success: boolean; data: TeacherRecheckRequest }> {
    try {
      const response = await api.patch(
        `/api/v1/teacher/recheck/${id}/status`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Update recheck status error:', error);
      return {
        success: false,
        data: null as any,
      };
    }
  }

  // ─── STATISTICS ──────────────────────────────────────────────

  async getStats(): Promise<{ success: boolean; data: TeacherStats }> {
    try {
      const response = await api.get('/api/v1/teacher/stats');
      return response.data;
    } catch (error: any) {
      console.error('Get stats error:', error);
      return {
        success: false,
        data: {
          exams: { total_exams: 0, upcoming: 0, active: 0, completed: 0 },
          sheets: {
            total_sheets: 0,
            checking: 0,
            checked: 0,
            recheck: 0,
            rechecked: 0,
          },
          disputes: { total: 0, pending: 0, completed: 0 },
        },
      };
    }
  }
}

export const teacherApi = new TeacherApiService();
