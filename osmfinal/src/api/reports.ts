// src/api/reports.ts

import api from './axios';

export interface ResultEntry {
  sheetId: number;
  rollNo: string;
  studentName: string;
  totalMarks: number;
  maxMarks: number;
  questionTotals: Record<string, number>;
  status: string;
  submittedAt: string | null;
}

export interface ExamResultStats {
  total: number;
  average: number;
  highest: number;
  lowest: number;
  passCount: number;
  failCount: number;
  passPercentage: number;
}

export interface ExamResultResponse {
  exam: {
    id: number;
    name: string;
    subject: string;
    maxMarks: number;
    status: string;
    is_published?: boolean;
  };
  results: ResultEntry[];
  stats: ExamResultStats;
}

export interface PublishedExam {
  id: number;
  name: string;
  subject: string;
  maxMarks: number;
  published_at?: string;
}

class ResultService {
  // ✅ Get exam results
  async getExamResults(examId: number): Promise<ExamResultResponse> {
    try {
      console.log('📤 Calling getExamResults for exam:', examId);
      const response = await api.get(`/api/v1/results/exams/${examId}/results`);
      console.log('📥 Response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get exam results error:', error);
      console.error('❌ Error response:', error.response?.data);
      return {
        exam: { id: 0, name: '', subject: '', maxMarks: 100, status: '' },
        results: [],
        stats: {
          total: 0,
          average: 0,
          highest: 0,
          lowest: 0,
          passCount: 0,
          failCount: 0,
          passPercentage: 0,
        },
      };
    }
  }

  // ✅ Get published exams
  async getPublishedExams(): Promise<PublishedExam[]> {
    try {
      console.log('📤 Calling getPublishedExams');
      const response = await api.get('/api/v1/results/published');
      console.log('📥 Response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get published exams error:', error);
      console.error('❌ Error response:', error.response?.data);
      return [];
    }
  }

  // ✅ Publish exam results
  async publishExamResults(examId: number): Promise<any> {
    try {
      console.log('📤 Calling publishExamResults for exam:', examId);
      const response = await api.post(
        `/api/v1/results/exams/${examId}/publish`,
      );
      console.log('📥 Response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('❌ Publish exam results error:', error);
      console.error('❌ Error response:', error.response?.data);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to publish results',
      };
    }
  }
}

export default new ResultService();
