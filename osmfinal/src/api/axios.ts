// api/axios.ts
import axios from 'axios';

export const API_URL =
  import.meta.env.VITE_API_URL || 'https://osmapi.digiindiasolutions.com';

const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Track refresh token requests
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Request interceptor
axiosInstance.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor - FIXED
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // ✅ Skip refresh token for specific endpoints
    const skipRefreshEndpoints = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh-token',
      '/api/v1/auth/change-password', // ✅ Skip for change password
      '/api/v1/auth/forgot-password',
      '/api/v1/auth/reset-password',
    ];

    // ✅ Check if this endpoint should skip refresh
    const shouldSkipRefresh = skipRefreshEndpoints.some((endpoint) =>
      originalRequest.url?.includes(endpoint),
    );

    // If it's a 401 and we should skip refresh, reject directly
    if (error.response?.status === 401 && shouldSkipRefresh) {
      // For change password, show error without refresh
      if (originalRequest.url?.includes('/change-password')) {
        return Promise.reject(error);
      }

      // For login, redirect to login
      if (originalRequest.url?.includes('/login')) {
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    // Regular token refresh logic for other endpoints
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !shouldSkipRefresh
    ) {
      if (isRefreshing) {
        // Queue the request while token is being refreshed
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await axios.post(
          `${API_URL}/api/v1/auth/refresh-token`,
          {},
          { withCredentials: true },
        );

        const newToken = response.data?.data?.accessToken;
        if (newToken) {
          processQueue(null, newToken);
          originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        } else {
          throw new Error('No token received');
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);

export default axiosInstance;
