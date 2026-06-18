// src/services/settings.service.ts
import api from './axios'; // Assuming you have axios instance

export interface ISettings {
  id?: number;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  logo: string | null;
  logo_public_id?: string | null;
  version: string;
  build: string;
  last_updated?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ISettingsResponse {
  success: boolean;
  exists: boolean;
  message: string;
  data: ISettings | null;
}

export interface IApiResponse {
  success: boolean;
  message: string;
  data?: any;
}

class SettingsService {
  // Get settings
  async getSettings(): Promise<ISettingsResponse> {
    try {
      const response = await api.get('/api/v1/setting/settings');
      return response.data;
    } catch (error: any) {
      console.error('Get settings error:', error);
      return {
        success: false,
        exists: false,
        message: error.response?.data?.message || 'Failed to get settings',
        data: null,
      };
    }
  }

  // Create settings
  async createSettings(formData: FormData): Promise<IApiResponse> {
    try {
      const response = await api.post('/api/v1/setting/settings', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Create settings error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create settings',
      };
    }
  }

  // Update settings (with logo)
  async updateSettings(formData: FormData): Promise<IApiResponse> {
    try {
      const response = await api.put('/api/v1/setting/settings', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error('Update settings error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update settings',
      };
    }
  }

  // Partial update (without logo)
  async patchSettings(data: Partial<ISettings>): Promise<IApiResponse> {
    try {
      const response = await api.patch('/api/v1/setting/settings', data);
      return response.data;
    } catch (error: any) {
      console.error('Patch settings error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update settings',
      };
    }
  }

  // Delete settings
  async deleteSettings(): Promise<IApiResponse> {
    try {
      const response = await api.delete('/api/v1/setting/settings');
      return response.data;
    } catch (error: any) {
      console.error('Delete settings error:', error);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to delete settings',
      };
    }
  }

  // Check if settings exist
  async checkSettingsExist(): Promise<any> {
    try {
      const response = await api.get('/api/v1/setting/settings/exists');
      return response.data;
    } catch (error: any) {
      console.error('Check settings error:', error);
      return {
        success: false,
        exists: false,
        message: error.response?.data?.message || 'Failed to check settings',
      };
    }
  }
}

export default new SettingsService();
