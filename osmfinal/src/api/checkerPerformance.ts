// src/api/checkerPerformance.ts

import api from './axios';

export interface CheckerPerformance {
  checkerId: string;
  checkerName: string;
  role: string;
  sheetsCompleted: number;
  avgTimeMinutes: number;
  checkedCount: number;
  recheckCount: number;
  escalatedCount: number;
}

export interface CheckerStats {
  totalCheckers: number;
  totalSheetsCompleted: number;
  averageTime: number;
  mostEfficient: {
    name: string;
    sheetsCompleted: number;
    avgTimeMinutes: number;
  } | null;
}

export interface CheckerPerformanceResponse {
  exam: {
    id: string | null;
    name: string;
  };
  checkers: CheckerPerformance[];
  stats: CheckerStats;
}

export interface CheckerDetailSheet {
  sheetId: number;
  rollNo: string;
  studentName: string;
  marks: number;
  status: string;
  examName: string;
  examSubject: string;
  assignedAt: string;
  completedAt: string;
  timeTakenMinutes: number;
}

export interface CheckerDetailResponse {
  checker: {
    id: string;
    name: string;
    email: string;
    role: string;
    subject: string | null;
  };
  sheets: CheckerDetailSheet[];
  stats: {
    totalSheets: number;
    averageTime: number;
    totalMarksGiven: number;
  };
}

class CheckerPerformanceService {
  // Get checker performance
  async getCheckerPerformance(
    examId?: string,
  ): Promise<CheckerPerformanceResponse> {
    try {
      console.log('📤 Fetching checker performance for exam:', examId || 'All');
      const url = examId
        ? `/api/v1/checker-performance/exams/${examId}/performance`
        : '/api/v1/checker-performance/performance';
      const response = await api.get(url);
      console.log('📥 Checker performance response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get checker performance error:', error);
      return {
        exam: { id: null, name: 'All Exams' },
        checkers: [],
        stats: {
          totalCheckers: 0,
          totalSheetsCompleted: 0,
          averageTime: 0,
          mostEfficient: null,
        },
      };
    }
  }

  // Get checker detail
  async getCheckerDetail(
    checkerId: string,
    examId?: string,
  ): Promise<CheckerDetailResponse> {
    try {
      const url = `/api/v1/checker-performance/checkers/${checkerId}/detail`;
      const params = examId ? { examId } : {};
      const response = await api.get(url, { params });
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get checker detail error:', error);
      return {
        checker: { id: '', name: '', email: '', role: '', subject: null },
        sheets: [],
        stats: { totalSheets: 0, averageTime: 0, totalMarksGiven: 0 },
      };
    }
  }

  // Get rechecker performance
  // async getRecheckerPerformance(examId?: string): Promise<any> {
  //   try {
  //     const params = examId ? { examId } : {};
  //     const response = await api.get(
  //       `/api/v1/checker-performance/recheckers/performance${params}`
  //     );
  //     return response.data.data;
  //   } catch (error: any) {
  //     console.error('❌ Get rechecker performance error:', error);
  //     return [];
  //   }
  // }

  async getRecheckerPerformance(examId?: string) {
    const response = await api.get(
      '/api/v1/checker-performance/recheckers/performance',
      { params: examId ? { examId } : {} },  // ← axios handle karta hai
    );
    return response.data.data || { recheckers: [], stats: {} };
  }
}


export default new CheckerPerformanceService();
