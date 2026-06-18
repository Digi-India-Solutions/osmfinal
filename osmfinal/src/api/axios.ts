// api/axios.ts
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:7000';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    // Token automatically sent via cookies (withCredentials: true)
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Try to refresh token
      try {
        await axios.post(
          `${API_URL}/api/v1/auth/refresh-token`,
          {},
          { withCredentials: true },
        );
        return axiosInstance(error.config);
      } catch {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default axiosInstance;
