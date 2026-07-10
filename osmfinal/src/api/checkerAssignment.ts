// src/api/assignment.ts

import api from './axios';

export interface IUnassignedSheet {
  id: number;
  roll_no: string;
  student_name: string;
  barcode: string;
  file_name: string;
  sheet_status: string;
}

export interface IAvailableChecker {
  id: string;
  name: string;
  email: string;
  role: string;
  subject: string | null;
  assigned_count: string;
  hasConflict: boolean;
  conflictReason: string | null;
  canAssign: boolean;
}

export interface IAssignmentResponse {
  success: boolean;
  message: string;
  data: {
    assigned: number;
    errors: Array<{ sheetId: number; error: string }>;
    checker: { id: string; name: string };
  };
}

export interface IAssignment {
  id: number;
  sheet_id: number;
  checker_id: string;
  assigned_by: string;
  assigned_at: string;
  roll_no: string;
  student_name: string;
  barcode: string;
  checker_name: string;
  checker_email: string;
  assigned_by_name: string;
}

// ✅ New interfaces for Checker Work Queue
export interface IAssignedSheet {
  id: number;
  exam_id: number;
  student_id: number | null;
  roll_no: string | null;
  student_name: string | null;
  barcode: string | null;
  file_name: string;
  file_url: string;
  status: 'assigned' | 'checking' | 'checked' | 'recheck';
  marks: number;
  assigned_to: number | null;
  checked_by: number | null;
  created_at: string;
  updated_at: string;
  exam_name: string;
  exam_subject: string;
  assigned_to_name: string | null;
  pending_recheck_count: number;
}

export interface ICheckerStats {
  pending: number;
  checking: number;
  completed: number;
  recheck: number;
}

export interface ICheckerSheetsResponse {
  success: boolean;
  message: string;
  data: {
    items: IAssignedSheet[];
    stats: ICheckerStats;
  };
}

class AssignmentService {
  // ─── ADMIN ASSIGNMENT METHODS ───────────────────────────────

  // Get unassigned sheets
  async getUnassignedSheets(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/assignments/exams/${examId}/sheets/unassigned`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get unassigned sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get unassigned sheets',
        data: [],
      };
    }
  }

  // Get available checkers
  async getAvailableCheckers(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/assignments/exams/${examId}/checkers/available`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get available checkers error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get available checkers',
        data: [],
      };
    }
  }

  // Assign sheets to checker
  async assignSheets(
    examId: string,
    checkerId: string,
    sheetIds: number[],
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/assignments/exams/${examId}/assign`,
        { checkerId, sheetIds },
      );
      return response.data;
    } catch (error: any) {
      console.error('Assign sheets error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to assign sheets',
      };
    }
  }

  // Random assignment
  async randomAssignment(examId: string): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/assignments/exams/${examId}/assign/random`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Random assignment error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to assign randomly',
      };
    }
  }

  // Get assignments by exam
  async getAssignmentsByExam(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/assignments/exams/${examId}/assignments`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get assignments error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get assignments',
        data: [],
      };
    }
  }

  // Unassign sheet
  async unassignSheet(assignmentId: number): Promise<any> {
    try {
      const response = await api.delete(
        `/api/v1/assignments/assignments/${assignmentId}`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Unassign sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to unassign sheet',
      };
    }
  }

  // ─── ✅ CHECKER WORK QUEUE METHODS ───────────────────────────

  // Get my assigned sheets (for current checker)
  async getMyAssignedSheets(status?: string): Promise<ICheckerSheetsResponse> {
    try {
      const response = await api.get('/api/v1/assignments/my-sheets', {
        params: { status },
      });
      return response.data;
    } catch (error: any) {
      console.error('Get my assigned sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get assigned sheets',
        data: {
          items: [],
          stats: {
            pending: 0,
            checking: 0,
            completed: 0,
            recheck: 0,
          },
        },
      };
    }
  }

  // Get sheet for marking with mark scheme
  async getSheetForMarking(sheetId: number): Promise<any> {
    try {
      const response = await api.get(`/api/v1/assignments/sheet/${sheetId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get sheet for marking error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get sheet for marking',
      };
    }
  }

  // Update sheet status (start marking, complete)
  async updateCheckerSheetStatus(
    sheetId: number,
    data: { status: string; marks?: number },
  ): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/assignments/sheet/${sheetId}/status`,
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

  // Save draft marks
  async saveDraftMarks(sheetId: number, data: { marks: number }): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/assignments/sheet/${sheetId}/draft`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Save draft error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save draft',
      };
    }
  }
}

export default new AssignmentService();
