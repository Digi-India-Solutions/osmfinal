// src/api/markScheme.ts
import axiosInstance from './axios';

export interface MarkSchemeRow {
  id: string;
  examId: string;
  questionName: string;
  maxMarks: number;
  guidelines: string;
  model_answer_pdf?: string | null;
  question_paper_pdf?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaveMarkSchemeItem {
  questionName: string;
  maxMarks: number;
  guidelines: string;
}

export interface MarkSchemeResponse {
  success: boolean;
  message: string;
  data: MarkSchemeRow[];
  files?: {
    modelAnswerPdf: string | null;
    questionPaperPdf: string | null;
  };
}

export const markSchemeApi = {
  // ✅ Get mark scheme by exam
  getByExam: async (examId: string): Promise<MarkSchemeRow[]> => {
    try {
      const response = await axiosInstance.get(
        `/api/v1/mark-scheme/exams/${examId}/mark-scheme`,
      );
      return response.data.data || [];
    } catch (error) {
      console.error('Get mark scheme error:', error);
      return [];
    }
  },

  // ✅ Save mark scheme with PDFs (multipart/form-data)
  save: async (
    examId: string,
    schemes: SaveMarkSchemeItem[],
    files?: { model_answer?: File; question_paper?: File },
  ): Promise<MarkSchemeResponse> => {
    try {
      const formData = new FormData();
      formData.append('schemes', JSON.stringify(schemes));

      if (files?.model_answer) {
        formData.append('model_answer_pdf', files.model_answer);
      }
      if (files?.question_paper) {
        formData.append('question_paper_pdf', files.question_paper);
      }

      const response = await axiosInstance.post(
        `/api/v1/mark-scheme/exams/${examId}/mark-scheme`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Save mark scheme error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to save mark scheme',
        data: [],
      };
    }
  },

  // ✅ Upload only model answer PDF
  uploadModelAnswer: async (examId: string, file: File): Promise<any> => {
    try {
      const formData = new FormData();
      formData.append('model_answer_pdf', file);

      const response = await axiosInstance.post(
        `/api/v1/mark-scheme/exams/${examId}/model-answer`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload model answer error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to upload model answer',
      };
    }
  },

  // ✅ Upload only question paper PDF
  uploadQuestionPaper: async (examId: string, file: File): Promise<any> => {
    try {
      const formData = new FormData();
      formData.append('question_paper_pdf', file);

      const response = await axiosInstance.post(
        `/api/v1/mark-scheme/exams/${examId}/question-paper`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload question paper error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to upload question paper',
      };
    }
  },

  // ✅ Delete PDF
  deletePDF: async (
    examId: string,
    type: 'model_answer' | 'question_paper',
  ): Promise<any> => {
    try {
      const response = await axiosInstance.delete(
        `/api/v1/mark-scheme/exams/${examId}/pdf/${type}`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Delete PDF error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete PDF',
      };
    }
  },

  // ✅ Get PDF URLs for an exam
  getPDFs: async (
    examId: string,
  ): Promise<{ modelAnswer: string | null; questionPaper: string | null }> => {
    try {
      const rows = await markSchemeApi.getByExam(examId);
      if (rows.length === 0) {
        return { modelAnswer: null, questionPaper: null };
      }
      return {
        modelAnswer: rows[0]?.model_answer_pdf || null,
        questionPaper: rows[0]?.question_paper_pdf || null,
      };
    } catch (error) {
      return { modelAnswer: null, questionPaper: null };
    }
  },
};
