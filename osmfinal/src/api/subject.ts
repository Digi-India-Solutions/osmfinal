// src/api/subject.ts
import api from './axios';

export interface ISubject {
  id: number;
  name: string;
  code: string;
  department: string;
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

export interface ISubjectResponse {
  success: boolean;
  message: string;
  data?: ISubject | ISubject[];
  count?: number;
}

class SubjectService {
  // Get all subjects
  async getSubjects(params?: {
    search?: string;
    department?: string;
    status?: string;
  }): Promise<ISubjectResponse> {
    try {
      const response = await api.get('/api/v1/auth/subjects', { params });
      return response.data;
    } catch (error: any) {
      console.error('Get subjects error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get subjects',
      };
    }
  }

  // Get subject by ID
  async getSubjectById(id: number): Promise<ISubjectResponse> {
    try {
      const response = await api.get(`/api/v1/auth/subjects/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Get subject error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get subject',
      };
    }
  }

  // Create subject
  async createSubject(data: Partial<ISubject>): Promise<ISubjectResponse> {
    try {
      const response = await api.post('/api/v1/auth/subjects', data);
      return response.data;
    } catch (error: any) {
      console.error('Create subject error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create subject',
      };
    }
  }

  // Update subject
  async updateSubject(
    id: number,
    data: Partial<ISubject>,
  ): Promise<ISubjectResponse> {
    try {
      const response = await api.put(`/api/v1/auth/subjects/${id}`, data);
      return response.data;
    } catch (error: any) {
      console.error('Update subject error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update subject',
      };
    }
  }

  // Toggle status
  async toggleStatus(id: number): Promise<ISubjectResponse> {
    try {
      const response = await api.patch(
        `/api/v1/auth/subjects/${id}/toggle-status`,
      );
      return response.data;
    } catch (error: any) {
      console.error('Toggle status error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to toggle status',
      };
    }
  }

  // Delete subject
  async deleteSubject(id: number): Promise<ISubjectResponse> {
    try {
      const response = await api.delete(`/api/v1/auth/subjects/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete subject error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete subject',
      };
    }
  }

  // Bulk delete
  async bulkDeleteSubjects(ids: number[]): Promise<ISubjectResponse> {
    try {
      const response = await api.post('/api/v1/auth/subjects/bulk-delete', {
        ids,
      });
      return response.data;
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete subjects',
      };
    }
  }

  // Get stats
  async getStats(): Promise<any> {
    try {
      const response = await api.get('/api/v1/auth/subjects/stats');
      return response.data;
    } catch (error: any) {
      console.error('Get stats error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to get stats',
      };
    }
  }

  // Search subjects
  async searchSubjects(q: string): Promise<ISubjectResponse> {
    try {
      const response = await api.get('/api/v1/auth/subjects/search', {
        params: { q },
      });
      return response.data;
    } catch (error: any) {
      console.error('Search subjects error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to search subjects',
      };
    }
  }
}

export default new SubjectService();
