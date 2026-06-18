import axiosInstance from './axios';

export interface MarkSchemeRow {
  id: string;
  examId: string;
  questionName: string;
  maxMarks: number;
  guidelines: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveMarkSchemeItem {
  questionName: string;
  maxMarks: number;
  guidelines: string;
}

export const markSchemeApi = {
  getByExam: async (examId: string): Promise<MarkSchemeRow[]> => {
    const response = await axiosInstance.get(`/api/v1/mark-scheme/exams/${examId}/mark-scheme`);
    return response.data.data;
  },

  save: async (examId: string, schemes: SaveMarkSchemeItem[]): Promise<MarkSchemeRow[]> => {
    const response = await axiosInstance.put(`/api/v1/mark-scheme/exams/${examId}/mark-scheme`, { schemes });
    return response.data.data;
  },
};