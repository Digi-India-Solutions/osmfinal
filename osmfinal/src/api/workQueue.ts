// src/api/workQueue.ts

import api from './axios';

// src/pages/admin/WorkQueue.tsx

// ✅ Interface update - removed assigned_to related fields
export interface Sheet {
  id: number;
  exam_id: number;
  student_id: number | null;
  roll_no: string | null;
  student_name: string | null;
  barcode: string | null;
  file_name: string;
  file_url: string;
  status: 'uploaded' | 'assigned' | 'checking' | 'checked' | 'recheck' | 'rechecked';
  marks: number;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  exam_name: string;
  exam_subject: string;
  uploaded_by_name: string | null;
  pending_recheck_count: number;
}

export interface RecheckUser {
  id: number;
  name: string;
  email: string;
  subject: string | null;
}

export interface RecheckRequest {
  id: number;
  sheet_id: number;
  exam_id: number;
  scope: 'single' | 'entire';
  reason: string;
  assign_to: number;
  status: 'pending' | 'assigned' | 'completed' | 'rejected';
  requested_by: number;
  resolved_by: number | null;
  resolved_at: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  student_name: string;
  roll_no: string;
  exam_name: string;
  assign_to_name: string;
  requested_by_name: string;
  resolved_by_name: string | null;
}

export interface SheetStats {
  all: number;
  pending: number;
  checking: number;
  rechecking: number;
  completed: number;
}

export interface SheetsResponse {
  success: boolean;
  message: string;
  data: {
    items: Sheet[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: SheetStats;
  };
}

class WorkQueueService {
  // Get all sheets with filters
  async getSheets(params?: {
    examId?: number;
    status?: string;
    search?: string;
    assignedTo?: number;
    page?: number;
    limit?: number;
  }): Promise<SheetsResponse> {
    try {
      const response = await api.get('/api/v1/work-queue/sheets', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get sheets error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get sheets',
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          stats: {
            all: 0,
            pending: 0,
            checking: 0,
            rechecking: 0,
            completed: 0,
          },
        },
      };
    }
  }

  // Get single sheet
  async getSheetById(id: number): Promise<any> {
    try {
      const response = await api.get(`/api/v1/work-queue/sheets/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get sheet',
      };
    }
  }

  // Update sheet status
  async updateSheetStatus(
    id: number,
    data: { status: string; marks?: number },
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/work-queue/sheets/${id}/status`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Update sheet status error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to update sheet status',
      };
    }
  }

  // Flag for recheck
  async flagForRecheck(
    id: number,
    data: {
      scope: 'single' | 'entire';
      assignTo: string;
      reason: string;
    },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/work-queue/sheets/${id}/flag-for-recheck`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Flag for recheck error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to flag for recheck',
      };
    }
  }

  // Get recheck users
  async getRecheckUsers(): Promise<{
    success: boolean;
    data: RecheckUser[];
    message: string;
  }> {
    try {
      const response = await api.get('/api/v1/work-queue/users/recheckers');
      return response.data;
    } catch (error: any) {
      console.error('Get recheck users error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get recheck users',
        data: [],
      };
    }
  }

  // Get recheck requests
  async getRecheckRequests(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await api.get('/api/v1/work-queue/recheck-requests', {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Get recheck requests error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get recheck requests',
        data: { items: [], total: 0 },
      };
    }
  }

  // Update recheck request status
  async updateRecheckRequestStatus(
    id: number,
    data: { status: string; remarks?: string },
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/work-queue/recheck-requests/${id}`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Update recheck request error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to update recheck request',
      };
    }
  }
}

export default new WorkQueueService();
