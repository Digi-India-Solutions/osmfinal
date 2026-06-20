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

class AssignmentService {
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
}

export default new AssignmentService();
