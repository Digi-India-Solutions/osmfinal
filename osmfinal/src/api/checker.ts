// src/api/checker.ts

import api from './axios';

export interface ICheckerMarkingData {
  marksData: Record<string, number>; // { "Qn1_i": 3, "Qn1_ii": 2, ... }
  annotationsData: any[];
  stampsData: any[];
  totalMarks: number;
  remarks?: string;
  timeSpent?: number; // ✅ Add timeSpent (in seconds)
}

export interface ICheckerDraftResponse {
  success: boolean;
  message: string;
  data: {
    id: number;
    sheet_id: number;
    checker_id: string;
    exam_id: string;
    marks_data: Record<string, number>;
    annotations_data: any[];
    stamps_data: any[];
    total_marks: number;
    remarks: string | null;
    time_spent: number; // ✅ Add time_spent in response
    is_draft: boolean;
    is_submitted: boolean;
    submitted_at: string | null;
    created_at: string;
    updated_at: string;
  };
}

export const checkerApi = {
  // Save draft
  saveDraft: async (
    sheetId: number,
    data: ICheckerMarkingData,
  ): Promise<any> => {
    try {
      const response = await api.post(
        `/api/v1/checker/sheet/${sheetId}/draft`,
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
  },

  // Submit marks
  submitMarks: async (
    sheetId: number,
    data: ICheckerMarkingData,
  ): Promise<any> => {
    try {
      const response = await api.post(
        `/api/v1/checker/sheet/${sheetId}/submit`,
        data,
      );
      return response.data;
    } catch (error: any) {
      console.error('Submit marks error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to submit marks',
      };
    }
  },

  // Get submitted marks
  getSubmittedMarks: async (sheetId: number): Promise<any> => {
    try {
      const response = await api.get(
        `/api/v1/checker/sheet/${sheetId}/submitted`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Get submitted marks error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get submitted marks',
        data: null as any,
      };
    }
  },

  // Get draft
  getDraft: async (sheetId: number): Promise<ICheckerDraftResponse> => {
    try {
      const response = await api.get(`/api/v1/checker/sheet/${sheetId}/draft`);
      return response.data;
    } catch (error: any) {
      console.error('Get draft error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get draft',
        data: null as any,
      };
    }
  },

  // Escalate sheet
  escalateSheet: async (
    sheetId: number,
    data: { reason: string; remarks?: string; timeSpent?: number }, // ✅ Add timeSpent
  ): Promise<any> => {
    try {
      const response = await api.post(
        `/api/v1/checker/sheet/${sheetId}/escalate`,
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
  },
};
