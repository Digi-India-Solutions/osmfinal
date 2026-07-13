// src/api/recheckReport.ts

import api from './axios';

export interface RecheckEntry {
  id: number;
  sheetId: number;
  rollNo: string;
  studentName: string;
  originalTotal: number;
  recheckedTotal: number;
  diff: number;
  finalMarksRule: 'higher' | 'recheck_marks' | 'average';
  reason: string;
  remarks: string | null;
  recheckerName: string;
  createdAt: string;
  resolvedAt: string | null;
  originalMarksData?: Record<string, number>;
  recheckMarksData?: Record<string, number>;
}

export interface RecheckStats {
  total: number;
  increased: number;
  decreased: number;
  noChange: number;
}

export interface RecheckReportResponse {
  exam: {
    id: string;
    name: string;
    subject: string;
  };
  rechecks: RecheckEntry[];
  stats: RecheckStats;
}

class RecheckReportService {
  // Get recheck report for an exam
  async getRecheckReport(examId: string): Promise<RecheckReportResponse> {
    try {
      console.log('📤 Fetching recheck report for exam:', examId);
      const response = await api.get(
        `/api/v1/recheck-report/exams/${examId}/recheck-report`,
      );
      console.log('📥 Recheck report response:', response.data);
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get recheck report error:', error);
      console.error('❌ Error response:', error.response?.data);
      return {
        exam: { id: '', name: '', subject: '' },
        rechecks: [],
        stats: { total: 0, increased: 0, decreased: 0, noChange: 0 },
      };
    }
  }

  // Get recheck summary
  async getRecheckSummary(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-report/exams/${examId}/recheck-summary`,
      );
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get recheck summary error:', error);
      console.error('❌ Error response:', error.response?.data);
      return {
        total_requests: 0,
        pending: 0,
        completed: 0,
        rejected: 0,
        escalated: 0,
        higher_rule: 0,
        recheck_marks_rule: 0,
        average_rule: 0,
      };
    }
  }

  // Get recheck detail
  async getRecheckDetail(requestId: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-report/recheck-requests/${requestId}/detail`,
      );
      return response.data.data;
    } catch (error: any) {
      console.error('❌ Get recheck detail error:', error);
      console.error('❌ Error response:', error.response?.data);
      return null;
    }
  }
}

export default new RecheckReportService();
