import { createContext, useContext, useState, useCallback, type ReactNode, useEffect } from "react";
import { users, type User } from "@/mock/mockData";

interface AuthContextType {
  currentUser: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("osm_user");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem("osm_user", JSON.stringify(currentUser));
    } else {
      localStorage.removeItem("osm_user");
    }
  }, [currentUser]);

  const login = useCallback((email: string, password: string): boolean => {
    const found = users.find(
      (u) => u.email === email && u.password === password
    );
    if (found) {
      setCurrentUser(found);
      localStorage.setItem("osm_user", JSON.stringify(found));
      return true;
    }
    return false;
  }, []);

  const logout = useCallback(() => {
    setCurrentUser(null);
  }, []);

  const value: AuthContextType = {
    currentUser,
    login,
    logout,
    isAuthenticated: currentUser !== null,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}