// src/api/sheet.ts
import api from './axios';

export interface ISheet {
  id: number;
  exam_id: string;
  student_id?: number;
  roll_no?: string;
  student_name?: string;
  barcode?: string;
  file_name: string;
  file_url: string;
  file_size: number;
  mime_type: string;
  status:
    | 'uploaded'
    | 'linked'
    | 'checking'
    | 'checked'
    | 'recheck'
    | 'rechecked'
    | 'escalated';
  marks: number;
  created_at: string;
  updated_at: string;
  // ✅ Escalation fields
  escalate_reason?: string;
  escalate_type?: string;
  escalate_remarks?: string;
  escalated_by?: string;
  escalated_at?: string;
  escalated_by_name?: string;
}

export interface ISheetStats {
  total: number;
  uploaded: number;
  linked: number;
  checking: number;
  checked: number;
  recheck: number;
  rechecked: number;
  escalated: number;
  total_marks: number;
  average_marks: number;
}

export interface IUploadedFile {
  name: string;
  barcode: string | null;
  file?: File;
}

export interface ILinkingResult {
  fileName: string;
  barcode: string | null;
  studentName: string | null;
  studentRoll: string | null;
  linked: boolean;
  sheetId?: number;
}

export interface IStudentLinkingStatus {
  id: number;
  roll_no: string;
  student_name: string;
  barcode: string;
  subject: string;
  sheet_status: string;
  sheet_id: number | null;
  file_name: string | null;
  sheet_status_display: string | null;
  is_linked: boolean;
  // ✅ Escalation fields for student
  escalate_reason?: string;
  escalate_type?: string;
  escalate_remarks?: string;
  escalated_at?: string;
}

export interface ILinkStats {
  total: number;
  uploaded: number;
  linked: number;
  pending: number;
}

// ✅ New interface for escalation
export interface IEscalationData {
  reason: string;
  escalateType: string;
  remarks?: string;
}

class SheetService {
  // ─── UPLOAD SHEETS ──────────────────────────────────────────

  async uploadSheets(examId: string, files: File[]): Promise<any> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('sheets', file);
      });

      const response = await api.post(
        `/api/v1/sheets/exams/${examId}/sheets/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload sheets error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload sheets',
        data: { sheets: [], total: 0, linked: 0, unlinked: 0 },
      };
    }
  }

  // ─── AUTO-LINK SHEETS BY BARCODE ────────────────────────────

  async autoLinkSheets(examId: string, sheetIds: number[]): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/sheets/exams/${examId}/sheets/auto-link`,
        { sheetIds },
      );
      return response.data;
    } catch (error: any) {
      console.error('Auto-link sheets error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to auto-link sheets',
        data: { results: [], total: 0, linked: 0, unlinked: 0 },
      };
    }
  }

  // ─── GET SHEETS BY EXAM ──────────────────────────────────────

  async getSheetsByExam(examId: string, status?: string): Promise<any> {
    try {
      const params = status ? { status } : {};
      const response = await api.get(`/api/v1/sheets/exams/${examId}/sheets`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Get sheets error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get sheets',
        data: {
          sheets: [],
          stats: {
            total: 0,
            uploaded: 0,
            linked: 0,
            checking: 0,
            checked: 0,
            recheck: 0,
            rechecked: 0,
            escalated: 0,
          },
        },
      };
    }
  }

  // ─── GET SHEET STATS ─────────────────────────────────────────

  async getSheetStats(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/sheets/exams/${examId}/sheets/stats`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get sheet stats error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get sheet stats',
        data: null,
      };
    }
  }

  // ─── GET UNLINKED SHEETS ─────────────────────────────────────

  async getUnlinkedSheets(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/sheets/exams/${examId}/sheets/unlinked`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get unlinked sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get unlinked sheets',
        data: [],
      };
    }
  }

  // ─── GET UNLINKED STUDENTS ───────────────────────────────────

  async getUnlinkedStudents(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/sheets/exams/${examId}/students/unlinked`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get unlinked students error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get unlinked students',
        data: [],
      };
    }
  }

  // ─── GET STUDENT LINKING STATUS ──────────────────────────────

  async getStudentLinkingStatus(examId: string): Promise<any> {
    try {
      const response = await api.get(
        `/api/v1/sheets/exams/${examId}/students/linking-status`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get student linking status error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get linking status',
        data: {
          students: [],
          stats: { total: 0, uploaded: 0, linked: 0, pending: 0 },
        },
      };
    }
  }

  // ─── MANUAL LINK STUDENT TO SHEET ────────────────────────────

  async manualLinkStudent(
    examId: string,
    studentId: number,
    sheetId: number,
  ): Promise<any> {
    try {
      const response = await api.post(
        `/api/v1/sheets/exams/${examId}/students/manual-link`,
        { studentId, sheetId },
      );
      return response.data;
    } catch (error: any) {
      console.error('Manual link student error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to link student',
      };
    }
  }

  // ─── UPDATE SHEET MARKS ──────────────────────────────────────

  async updateSheet(
    id: number,
    data: {
      marks?: number;
      status?: string;
      escalate_reason?: string;
      escalate_type?: string;
      escalate_remarks?: string;
    },
  ): Promise<any> {
    try {
      const response = await api.put(`/api/v1/sheets/sheets/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Update sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update sheet',
      };
    }
  }

  // ─── DELETE SHEET ─────────────────────────────────────────────

  async deleteSheet(id: number): Promise<any> {
    try {
      const response = await api.delete(`/api/v1/sheets/sheets/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete sheet',
      };
    }
  }

  // ─── ESCALATE SHEET ──────────────────────────────────────────
  // ✅ NEW: Escalate a sheet

  async escalateSheet(sheetId: number, data: IEscalationData): Promise<any> {
    try {
      const response = await api.patch(
        `/api/v1/sheets/sheets/${sheetId}/escalate`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Escalate sheet error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to escalate sheet',
      };
    }
  }

  // ─── GET ESCALATED SHEETS ─────────────────────────────────────
  // ✅ NEW: Get all escalated sheets

  async getEscalatedSheets(examId?: string): Promise<any> {
    try {
      const params = examId ? { examId } : {};
      const response = await api.get(`/api/v1/sheets/sheets/escalated`, {
        params,
      });
      return response.data;
    } catch (error: any) {
      console.error('Get escalated sheets error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get escalated sheets',
        data: [],
      };
    }
  }
}

export default new SheetService();
