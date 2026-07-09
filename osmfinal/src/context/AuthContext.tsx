// context/AuthContext.tsx
import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
  useEffect,
} from 'react';
import axios from 'axios';

// ─── TYPES ──────────────────────────────────────────────────────────────

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  subject?: string | null; // ✅ ADDED
  permissions: Record<string, any>;
  isActive: boolean;
}

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  hasPermission: (module: string, action: string) => boolean;
  hasAnyPermission: (module: string, actions: string[]) => boolean;
}

// ─── API CONFIG ────────────────────────────────────────────────────────

const API_URL =
  import.meta.env.VITE_API_URL || 'https://osmapi.digiindiasolutions.com';

// Axios instance with credentials
const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── AUTH CONTEXT ─────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem('osm_user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // ─── Check if user is already logged in ──────────────────────────

  // context/AuthContext.tsx

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await api.get('/api/v1/auth/me');
        console.log('🔍 Auth Response:', response.data);

        if (response.data.success) {
          const userData = response.data.data;
          console.log('🔍 User Data from API:', userData);
          console.log('🔍 Subject from API:', userData.subject);

          // ✅ Ensure subject is set
          const userWithSubject = {
            ...userData,
            subject: userData.subject || null,
          };

          console.log('🔍 Setting user with subject:', userWithSubject);

          setCurrentUser(userWithSubject);
          localStorage.setItem('osm_user', JSON.stringify(userWithSubject));
        } else {
          localStorage.removeItem('osm_user');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        localStorage.removeItem('osm_user');
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // ─── Save to localStorage when user changes ──────────────────────

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('osm_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('osm_user');
    }
  }, [currentUser]);

  // ─── LOGIN ─────────────────────────────────────────────────────────

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      try {
        const response = await api.post('/api/v1/auth/login', {
          email,
          password,
        });

        if (response.data.success) {
          const userData = response.data.data.user;
          setCurrentUser(userData);
          localStorage.setItem('osm_user', JSON.stringify(userData));
          return true;
        }
        return false;
      } catch (error: any) {
        console.error(
          'Login error:',
          error.response?.data?.message || error.message,
        );
        return false;
      }
    },
    [],
  );

  // ─── LOGOUT ────────────────────────────────────────────────────────

  const logout = useCallback(async (): Promise<void> => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setCurrentUser(null);
      localStorage.removeItem('osm_user');
    }
  }, []);

  // ─── PERMISSION HELPERS ───────────────────────────────────────────

  const hasPermission = useCallback(
    (module: string, action: string): boolean => {
      if (!currentUser || !currentUser.permissions) return false;

      const modulePermissions = currentUser.permissions[module];
      if (!modulePermissions) return false;

      return modulePermissions[action] === true;
    },
    [currentUser],
  );

  const hasAnyPermission = useCallback(
    (module: string, actions: string[]): boolean => {
      return actions.some((action) => hasPermission(module, action));
    },
    [hasPermission],
  );

  // ─── CONTEXT VALUE ────────────────────────────────────────────────

  const value: AuthContextType = {
    currentUser,
    login,
    logout,
    isAuthenticated: currentUser !== null,
    isLoading,
    hasPermission,
    hasAnyPermission,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── HOOK ──────────────────────────────────────────────────────────────

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
