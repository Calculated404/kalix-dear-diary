import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  displayName: string | null;
  timezone: string;
}

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithCode: (code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => 
    localStorage.getItem('accessToken')
  );
  const [isLoading, setIsLoading] = useState(true);

  // Check auth status on mount
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }

      try {
        const userData = await api.get<User>('/auth/me', token);
        setUser(userData);
        setAccessToken(token);
      } catch {
        // Token invalid, try refresh
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          try {
            const response = await api.post<{ accessToken: string }>('/auth/refresh', {
              refreshToken,
            });
            localStorage.setItem('accessToken', response.accessToken);
            setAccessToken(response.accessToken);
            
            const userData = await api.get<User>('/auth/me', response.accessToken);
            setUser(userData);
          } catch {
            // Refresh failed, clear tokens
            localStorage.removeItem('accessToken');
            localStorage.removeItem('refreshToken');
            setAccessToken(null);
          }
        } else {
          localStorage.removeItem('accessToken');
          setAccessToken(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { email, password });

    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const loginWithCode = useCallback(async (code: string) => {
    const response = await api.post<{
      accessToken: string;
      refreshToken: string;
      user: User;
    }>('/auth/login', { loginCode: code });

    localStorage.setItem('accessToken', response.accessToken);
    localStorage.setItem('refreshToken', response.refreshToken);
    setAccessToken(response.accessToken);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      try {
        await api.post('/auth/logout', {}, token);
      } catch {
        // Ignore logout errors
      }
    }

    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setAccessToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isAuthenticated: !!user,
        isLoading,
        login,
        loginWithCode,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
