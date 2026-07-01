import axiosInstance from './axios';

export interface SheetRow {
  id: string;
  examId: string;
  rollNo: string;
  studentName: string;
  barcode: string;
  status: 'uploaded' | 'assigned' | 'evaluated' | 'rechecking' | 'done';
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CheckerRow {
  id: string;
  name: string;
  role: 'checker' | 'teacher_checker';
  subject: string | null;
  email: string;
}

export interface AssignmentLogRow {
  id: string;
  examId: string;
  checkerId: string;
  checkerName: string;
  sheetCount: number;
  mode: 'manual' | 'random';
  createdAt: string;
}

export const checkerAssignmentApi = {
  getUnassignedSheets: async (examId: string): Promise<SheetRow[]> => {
    const response = await axiosInstance.get('/checker-assignment/sheets', {
      params: { examId },
    });
    return response.data.data;
  },

  getAvailableCheckers: async (): Promise<CheckerRow[]> => {
    const response = await axiosInstance.get('/checker-assignment/checkers');
    return response.data.data;
  },

  assignSheets: async (payload: {
    examId: string;
    checkerId: string;
    checkerName: string;
    sheetIds: string[];
  }): Promise<AssignmentLogRow> => {
    const response = await axiosInstance.post('/checker-assignment/assign', payload);
    return response.data.log;
  },

  assignRandomly: async (examId: string): Promise<{
    logs: AssignmentLogRow[];
    totalAssigned: number;
    checkerCount: number;
  }> => {
    const response = await axiosInstance.post('/checker-assignment/assign-random', { examId });
    return response.data;
  },

  getLogs: async (examId: string): Promise<AssignmentLogRow[]> => {
    const response = await axiosInstance.get('/checker-assignment/logs', {
      params: { examId },
    });
    return response.data.data;
  },
};