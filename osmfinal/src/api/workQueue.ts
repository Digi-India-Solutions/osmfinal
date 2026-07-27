// src/api/workQueue.ts

import api from './axios';

export interface Sheet {
  id: number;
  exam_id: string;
  student_id: number;
  roll_no: string;
  student_name: string;
  barcode: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  status:
    | 'uploaded'
    | 'assigned'
    | 'checking'
    | 'checked'
    | 'recheck'
    | 'rechecked'
    | 'escalated'
    | 'linked'
    | 'rechecking';
  marks: string;
  total_marks?: number;
  uploaded_by: string;
  created_at: string;
  updated_at: string;
  exam_name: string;
  exam_subject: string;
  uploaded_by_name: string;
  pending_recheck_count: number;
  assigned_to_name?: string;
  assigned_to?: string;
  escalate_reason?: string;
  escalate_type?: string;
  escalate_remarks?: string;
  escalated_by?: string;
  escalated_at?: string;
  escalated_by_name?: string;
  time_spent?: number;
  checking_time_spent?: number;
  recheck_status?: string;
  is_checked?: boolean;
  checked_at?: string;
  archived_folder?: string;
}

export interface RecheckUser {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  role?: string;
  pending_count?: number;
}

export interface RecheckRequest {
  id: number;
  sheet_id: number;
  exam_id: number;
  scope: 'single' | 'entire';
  reason: string;
  assign_to: string;
  status: 'pending' | 'assigned' | 'completed' | 'rejected' | 'escalated';
  requested_by: string;
  resolved_by: string | null;
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
  time_spent?: number;
}

export interface CheckedSheet {
  id: number;
  student_name: string;
  roll_no: string;
  barcode: string;
  marks: string;
  checking_time_spent: number;
  archived_folder: string;
  file_url: string;
  checked_at: string;
  exam_name: string;
  exam_subject: string;
  total_marks: number;
  checker_name: string;
  marks_data?: Record<string, number>;
  annotations_data?: Array<{
    id: number;
    tool: string;
    x: number;
    y: number;
    page: number;
    width?: number;
    height?: number;
  }>;
  stamps_data?: Array<{
    markId: string;
    placed: boolean;
    x: number;
    y: number;
    page: number;
    value: number | null;
  }>;
  notes_data?: Array<{
    id: number;
    page: number;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    width: number;
    height: number;
  }>;
  remarks?: string;
  submitted_at?: string;
}

export interface SheetStats {
  all: number;
  pending: number;
  checking: number;
  rechecking: number;
  completed: number;
  escalated: number;
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

export interface CheckedSheetsResponse {
  success: boolean;
  message: string;
  data: {
    items: CheckedSheet[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

class WorkQueueService {
  // ─── SHEET ROUTES ──────────────────────────────────────────────

  // Get all sheets with filters
  async getSheets(params?: {
    examId?: string | number;
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
            escalated: 0,
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
    data: { status: string; marks?: number; assigned_to?: string },
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

  // Assign sheet to checker
  async assignSheet(
    sheetId: number,
    data: { assigned_to: string },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/work-queue/sheets/${sheetId}/assign`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Assign sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to assign sheet',
      };
    }
  }

  // ─── CHECKED SHEETS ROUTES ────────────────────────────────────

  // ✅ Get checked sheet by ID for viewing (with full details including notes)
  async getCheckedSheetById(sheetId: number): Promise<{
    success: boolean;
    message: string;
    data?: CheckedSheet;
  }> {
    try {
      const response = await api.get(
        `/api/v1/work-queue/checked-sheets/${sheetId}`,
      );

      // ✅ Ensure the response data includes notes_data
      const data = response.data;
      if (data.success && data.data) {
        // Make sure notes_data is always an array
        if (!data.data.notes_data) {
          data.data.notes_data = [];
        }
        // Make sure annotations_data is always an array
        if (!data.data.annotations_data) {
          data.data.annotations_data = [];
        }
        // Make sure stamps_data is always an array
        if (!data.data.stamps_data) {
          data.data.stamps_data = [];
        }
        // Make sure marks_data is always an object
        if (!data.data.marks_data) {
          data.data.marks_data = {};
        }
      }

      return data;
    } catch (error: any) {
      console.error('Get checked sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get checked sheet',
      };
    }
  }

  // ✅ Get all checked sheets
  async getCheckedSheets(params?: {
    examId?: string;
    page?: number;
    limit?: number;
  }): Promise<CheckedSheetsResponse> {
    try {
      const response = await api.get('/api/v1/work-queue/checked-sheets', {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Get checked sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get checked sheets',
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
        },
      };
    }
  }

  // ─── ESCALATED SHEETS ROUTES ──────────────────────────────────

  // ✅ Get escalated sheets
  async getEscalatedSheets(params?: {
    examId?: string;
    page?: number;
    limit?: number;
  }): Promise<any> {
    try {
      const response = await api.get('/api/v1/work-queue/escalated-sheets', {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Get escalated sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get escalated sheets',
        data: { items: [], total: 0 },
      };
    }
  }

  // ─── RECHECK ROUTES ───────────────────────────────────────────

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

  // Get recheck request by ID
  async getRecheckRequestById(id: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/work-queue/recheck-requests/${id}`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get recheck request error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get recheck request',
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

  // ─── REASSIGN ROUTES ──────────────────────────────────────────

  // Reassign single recheck sheet
  async reassignRecheck(
    sheetId: number,
    data: { assignTo: string },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/work-queue/recheck/${sheetId}/reassign`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Reassign recheck error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reassign',
      };
    }
  }

  // Reassign multiple sheets (bulk)
  async reassignBulkRecheck(data: {
    assignTo: string;
    sheetIds: number[];
  }): Promise<any> {
    try {
      const response = await api.post(
        '/api/v1/work-queue/recheck/bulk/reassign',
        {
          assignTo: data.assignTo,
          sheetIds: data.sheetIds,
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Bulk reassign error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to reassign',
      };
    }
  }

  // Get available recheckers
  async getAvailableRecheckers(excludeId?: string): Promise<{
    success: boolean;
    data: RecheckUser[];
    message: string;
  }> {
    try {
      const url = excludeId
        ? `/api/v1/work-queue/recheckers/available?excludeId=${excludeId}`
        : '/api/v1/work-queue/recheckers/available';
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('Get available recheckers error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get available recheckers',
        data: [],
      };
    }
  }

  // Get completed sheets count (checked + rechecked)
  async getCompletedSheetsCount(examId?: string): Promise<{
    success: boolean;
    total: number;
  }> {
    try {
      const params = new URLSearchParams();
      if (examId) params.append('examId', examId);
      const response = await api.get(`/api/v1/work-queue/completed-sheets/count?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('getCompletedSheetsCount error:', error);
      return { success: false, total: 0 };
    }
  }

  // Download batch of completed sheets as zip blob
  async downloadCompletedBatch(
    offset: number,
    limit: number = 100,
    batchNum: number = 1,
    examId?: string
  ): Promise<Blob> {
    const params = new URLSearchParams({
      offset: String(offset),
      limit: String(limit),
      batch: String(batchNum),
    });
    if (examId) params.append('examId', examId);

    const response = await api.get(
      `/api/v1/work-queue/completed-sheets/download-batch?${params.toString()}`,
      { responseType: 'blob' }
    );
    return response.data;
  }
}

export default new WorkQueueService();
