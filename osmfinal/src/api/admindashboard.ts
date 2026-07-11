// src/api/dashboard.ts

import api from './axios';

export interface DashboardStats {
  totalSheets: number;
  totalExams: number;
  totalUsers: number;
  totalStudents: number;
  uploaded: number;
  checking: number;
  checked: number;
  recheck: number;
  rechecked: number;
  escalated: number;
  pendingRechecks: number;
  teacherDisputes: number;
  completedByCheckers: number;
}

export interface StatusChartData {
  status: string;
  count: number;
  fill: string;
}

export interface RecentSheet {
  id: number;
  student_name: string;
  exam_name: string;
  status: string;
  assigned_to_name: string | null;
  created_at: string;
}

class DashboardService {
  // Get dashboard stats
  async getStats(): Promise<DashboardStats> {
    try {
      const response = await api.get('/api/v1/adminDashboard/stats');
      return response.data.data;
    } catch (error: any) {
      console.error('Get dashboard stats error:', error);
      return {
        totalSheets: 0,
        totalExams: 0,
        totalUsers: 0,
        totalStudents: 0,
        uploaded: 0,
        checking: 0,
        checked: 0,
        recheck: 0,
        rechecked: 0,
        escalated: 0,
        pendingRechecks: 0,
        teacherDisputes: 0,
        completedByCheckers: 0,
      };
    }
  }

  // Get status chart data
  async getStatusChart(): Promise<StatusChartData[]> {
    try {
      const response = await api.get('/api/v1/adminDashboard/status-chart');
      return response.data.data;
    } catch (error: any) {
      console.error('Get status chart error:', error);
      return [];
    }
  }

  // Get recent sheets
  async getRecentSheets(limit: number = 8): Promise<RecentSheet[]> {
    try {
      const response = await api.get('/api/v1/adminDashboard/recent-sheets', {
        params: { limit },
      });
      return response.data.data;
    } catch (error: any) {
      console.error('Get recent sheets error:', error);
      return [];
    }
  }

  // Get checker stats
  async getCheckerStats(): Promise<any> {
    try {
      const response = await api.get('/api/v1/adminDashboard/checker-stats');
      return response.data.data;
    } catch (error: any) {
      console.error('Get checker stats error:', error);
      return { completed: 0, total: 0 };
    }
  }

  // Get recheck stats
  async getRecheckStats(): Promise<any> {
    try {
      const response = await api.get('/api/v1/adminDashboard/recheck-stats');
      return response.data.data;
    } catch (error: any) {
      console.error('Get recheck stats error:', error);
      return { pending: 0, teacherDisputes: 0 };
    }
  }
}

export default new DashboardService();
