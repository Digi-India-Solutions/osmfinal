// src/api/recheckQueue.ts

import api from './axios';

export interface RecheckRequest {
  id: number;
  sheet_id: number | null;
  exam_id: number;
  reason: string;
  assign_to: string;
  status: 'pending' | 'assigned' | 'completed' | 'rejected' | 'escalated';
  requested_by: string;
  resolved_by: string | null;
  resolved_at: string | null;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  student_name?: string;
  roll_no?: string;
  barcode?: string;
  file_name?: string;
  file_url?: string;
  current_marks?: number;
  exam_name?: string;
  exam_subject?: string;
  requested_by_name?: string;
  resolved_by_name?: string;
  marks_data?: Record<string, number>;
  finalMarksRule?: string;
  completed_at?: string;
  time_spent?: number;
  escalate_reason?: string;
  escalate_type?: string;
  escalate_remarks?: string;
  escalated_by?: string;
  escalated_at?: string;
}

export interface RecheckMarkingData {
  request: {
    id: number;
    sheet_id: number | null;
    exam_id: number;
    reason: string;
    status: string;
    finalMarksRule: 'higher' | 'recheck_marks' | 'average';
    isReadOnly?: boolean;
    created_at: string;
    time_spent?: number;
  };
  sheet: {
    id: number;
    student_name: string;
    roll_no: string;
    barcode: string;
    file_name: string;
    file_url: string;
    current_marks: number;
    status: string;
  };
  exam: {
    id: number;
    name: string;
    subject: string;
    spentTime?: number;
  };
  markScheme: Record<string, { maxMarks: number; guidelines: string }>;
  previousMarks: Record<string, number>;
  originalMarks?: Record<string, number>;
  originalAnnotations?: any[];
  originalStamps?: any[];
  originalNotes?: any[]; // ✅ Added
  recheckMarks?: Record<string, number>;
  recheckAnnotations?: any[];
  recheckStamps?: any[];
  recheckNotes?: any[]; // ✅ Added
  pdfs: {
    model_answer: string | null;
    question_paper: string | null;
  };
}

export interface SaveDraftData {
  marksData: Record<string, number>;
  annotationsData: any[];
  stampsData: any[];
  notesData?: any[]; // ✅ Added (optional for backward compatibility)
  totalMarks: number;
  remarks?: string;
  timeSpent?: number;
}

export interface CompleteRecheckData {
  marks?: number;
  remarks?: string;
  marksData?: Record<string, number>;
  annotationsData?: any[];
  stampsData?: any[];
  notesData?: any[]; // ✅ Added
  finalMarksRule?: string;
  timeSpent?: number;
}

export interface EscalateRecheckData {
  reason: string;
  escalateType: string;
  remarks?: string;
  timeSpent?: number;
}

class RecheckQueueService {
  // ─── GET MY RECHECK REQUESTS ──────────────────────────────────

  async getMyRequests(status?: string): Promise<any> {
    try {
      const response = await api.get('/api/v1/recheck-queue/my-requests', {
        params: { status },
      });
      return response.data;
    } catch (error: any) {
      console.error('Get my recheck requests error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get recheck requests',
        data: { items: [], stats: { pending: 0, completed: 0, escalated: 0 } },
      };
    }
  }

  // ─── GET RECHECKED SHEET FOR ADMIN ───────────────────────────

  async getRecheckedSheetForAdmin(requestId: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-queue/admin/rechecked/${requestId}`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get rechecked sheet error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get rechecked sheet',
      };
    }
  }

  // ─── GET RECHECK REQUEST BY ID ──────────────────────────────

  async getRequestById(id: number): Promise<any> {
    try {
      const response = await api.get(`/api/v1/recheck-queue/my-requests/${id}`);
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

  // ─── START RECHECK MARKING ───────────────────────────────────

  async startMarking(id: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-queue/my-requests/${id}/mark`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Start recheck marking error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to start recheck marking',
      };
    }
  }

  // ─── SAVE RECHECK MARKS (DRAFT) ─────────────────────────────

  async saveMarks(
    id: number,
    data: { marks: number; remarks?: string; timeSpent?: number },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/recheck-queue/my-requests/${id}/marks`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Save recheck marks error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save marks',
      };
    }
  }

  // ─── SAVE RECHECK DRAFT ──────────────────────────────────────

  async saveDraft(id: number, data: SaveDraftData): Promise<any> {
    try {
      const payload: any = {
        marksData: data.marksData || {},
        annotationsData: data.annotationsData || [],
        stampsData: data.stampsData || [],
        totalMarks: data.totalMarks || 0,
        remarks: data.remarks || '',
        timeSpent: data.timeSpent || 0,
      };

      // ✅ Add notesData if provided
      if (data.notesData) {
        payload.notesData = data.notesData;
      }

      const response = await api.post(
        `/api/v1/recheck-queue/my-requests/${id}/save-draft`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      console.error('Save recheck draft error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save draft',
      };
    }
  }

  // ─── GET RECHECK DRAFT ───────────────────────────────────────

  async getDraft(id: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-queue/my-requests/${id}/draft`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get recheck draft error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get draft',
        data: null,
      };
    }
  }

  // ─── COMPLETE RECHECK ────────────────────────────────────────

  async completeRecheck(id: number, data: CompleteRecheckData): Promise<any> {
    try {
      const payload: any = {
        marks: data.marks || 0,
        remarks: data.remarks || 'Recheck completed',
        marksData: data.marksData || {},
        annotationsData: data.annotationsData || [],
        stampsData: data.stampsData || [],
        timeSpent: data.timeSpent || 0,
      };

      // ✅ Add notesData if provided
      if (data.notesData) {
        payload.notesData = data.notesData;
      }

      if (data.finalMarksRule) {
        payload.finalMarksRule = data.finalMarksRule;
      }

      const response = await api.post(
        `/api/v1/recheck-queue/my-requests/${id}/complete`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      console.error('Complete recheck error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to complete recheck',
      };
    }
  }

  // ─── UPDATE RECHECK REQUEST STATUS ──────────────────────────

  async updateStatus(
    id: number,
    status: string,
    remarks?: string,
    timeSpent?: number,
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/recheck-queue/my-requests/${id}/status`,
        {
          status,
          remarks,
          timeSpent,
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Update recheck request status error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to update recheck request',
      };
    }
  }

  // ─── ESCALATE RECHECK REQUEST ───────────────────────────────

  async escalateRecheckRequest(
    id: number,
    data: EscalateRecheckData,
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/recheck-queue/my-requests/${id}/escalate`,
        {
          reason: data.reason,
          escalateType: data.escalateType || 'other',
          remarks: data.remarks || '',
          timeSpent: data.timeSpent || 0,
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Escalate recheck request error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to escalate recheck request',
      };
    }
  }
}

export default new RecheckQueueService();
