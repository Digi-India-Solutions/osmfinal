// src/api/recheckQueue.ts

import api from './axios';

export interface RecheckRequest {
  id: number;
  sheet_id: number | null;
  exam_id: number;
  reason: string;
  assign_to: string;
  status: 'pending' | 'assigned' | 'completed' | 'rejected';
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
}

export interface RecheckMarkingData {
  request: {
    id: number;
    sheet_id: number | null;
    exam_id: number;
    reason: string;
    status: string;
    created_at: string;
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
  };
  markScheme: Record<string, { maxMarks: number; guidelines: string }>;
  pdfs: {
    model_answer: string | null;
    question_paper: string | null;
  };
}

class RecheckQueueService {
  // Get my recheck requests
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
        data: { items: [], stats: { pending: 0, completed: 0 } },
      };
    }
  }

  // Get recheck request by ID
  async getRequestById(id: number): Promise<any> {
    try {
      const response = await api.get(`/api/v1/recheck-queue/requests/${id}`);
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

  // Start recheck marking (get all data)
  async startMarking(id: number): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/recheck-queue/requests/${id}/marking`,
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

  // Save recheck marks (draft)
  async saveMarks(
    id: number,
    data: { marks: number; remarks?: string },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/recheck-queue/requests/${id}/marks`,
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

  // Complete recheck
  async completeRecheck(
    id: number,
    data: { marks?: number; remarks?: string },
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/recheck-queue/requests/${id}/complete`,
        data,
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

  // Update recheck request status
  async updateStatus(
    id: number,
    status: string,
    remarks?: string,
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/recheck-queue/requests/${id}/status`,
        {
          status,
          remarks,
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
}

export default new RecheckQueueService();
