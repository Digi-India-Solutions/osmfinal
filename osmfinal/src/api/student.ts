// src/api/student.ts
import api from './axios';

export interface IStudentRecord {
  id: number;
  roll_no: string;
  student_name: string;
  course: string;
  branch: string;
  semester: number;
  subject: string;
  barcode: string;
  exam_id?: number | null;
  sheet_status: 'pending' | 'uploaded' | 'checking' | 'checked' | 'recheck';
  created_at?: string;
  updated_at?: string;
}

export interface IStudentStats {
  total: number;
  subjects: number;
  semesters: number;
  branches: number;
  uploaded: number;
  pending: number;
  checking: number;
  checked: number;
  recheck: number;
  linkedToExam: number;
}

export interface IStudentResponse {
  success: boolean;
  message: string;
  data?: {
    items: IStudentRecord[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: IStudentStats;
    subjectWise?: Array<{ subject: string; count: number }>;
  };
}

class StudentService {
  // Upload and preview Excel
  async uploadAndPreview(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await api.post(
        '/api/v1/Students/students/upload',
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Upload error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to upload file',
      };
    }
  }

  // Import students
  async importStudents(filePath: string): Promise<any> {
    try {
      const response = await api.post('/api/v1/Students/students/import', {
        filePath,
      });
      return response.data;
    } catch (error: any) {
      console.error('Import error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to import students',
      };
    }
  }

  // Get all students
  async getStudents(params?: {
    search?: string;
    subject?: string;
    semester?: string;
    branch?: string;
    page?: number;
    limit?: number;
  }): Promise<IStudentResponse> {
    try {
      const response = await api.get('/api/v1/Students/students', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get students error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get students',
        data: {
          items: [],
          total: 0,
          page: 1,
          limit: 50,
          totalPages: 0,
          stats: {
            total: 0,
            subjects: 0,
            semesters: 0,
            branches: 0,
            uploaded: 0,
            pending: 0,
            checking: 0,
            checked: 0,
            recheck: 0,
            linkedToExam: 0,
          },
        },
      };
    }
  }

  // Get student by ID
  async getStudentById(id: number): Promise<any> {
    try {
      const response = await api.get(`/api/v1/Students/students/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get student error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get student',
      };
    }
  }

  // Update student
  async updateStudent(id: number, data: Partial<IStudentRecord>): Promise<any> {
    try {
      const response = await api.put(`/api/v1/Students/students/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Update student error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update student',
      };
    }
  }

  // ✅ Delete single student (cascades to sheets)
  async deleteStudent(id: number): Promise<any> {
    try {
      const response = await api.delete(`/api/v1/Students/students/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete student error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete student',
      };
    }
  }

  // ✅ Auto-link students to exams
  async autoLinkStudents(): Promise<any> {
    try {
      const response = await api.post('/api/v1/Students/students/auto-link');
      return response.data;
    } catch (error: any) {
      console.error('Auto-link students error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to link students to exams',
      };
    }
  }

  // ✅ Bulk delete students (cascades to sheets)
  async bulkDeleteStudents(ids: number[]): Promise<any> {
    try {
      const response = await api.post('/api/v1/Students/students/bulk-delete', {
        ids,
      });
      return response.data;
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete students',
      };
    }
  }

  // ✅ Get deletion preview
  async getDeletionPreview(ids: string): Promise<any> {
    try {
      const response = await api.get(
        '/api/v1/Students/students/deletion-preview',
        {
          params: { ids },
        },
      );
      return response.data;
    } catch (error: any) {
      console.error('Deletion preview error:', error);
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to get deletion preview',
      };
    }
  }
}

export default new StudentService();
