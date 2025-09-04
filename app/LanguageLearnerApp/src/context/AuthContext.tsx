import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, ReactNode } from 'react';
import { apiClient } from '../services/apiClient';
import { storage } from '../utils';

interface User {
  id: number;
  email: string;
  name?: string;
  preferences?: any;
  role?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  srsIds: Set<number>;
  refreshSrsIds: () => Promise<void>;
  refreshUser: () => Promise<void>;
  handleTokenExpiration: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [srsIds, setSrsIds] = useState<Set<number>>(new Set());

  const refreshUser = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await apiClient.auth.me();
      if (response && typeof response === 'object' && 'data' in response) {
        setUser((response as any).data);
      } else {
        setUser(response as User);
      }
    } catch (error: any) {
      setUser(null);
      // Only log errors that are not network connectivity issues or 401s
      if (error?.status !== 401 && error?.name !== 'AbortError' && !error?.message?.includes('Network request failed')) {
        console.error('Failed to fetch user:', error);
      }
    }
  }, []);

  const refreshSrsIds = useCallback(async (signal?: AbortSignal) => {
    if (!user) {
      setSrsIds(new Set());
      return;
    }
    try {
      const response = await apiClient.srs.cards.getAll?.() || 
                       await apiClient.request('/srs/all-cards', { signal });
      const data = (response as any)?.data || response;
      setSrsIds(new Set((data || []).map((card: any) => card.vocabId)));
    } catch (error: any) {
      // Only log errors that are not network connectivity issues
      if (error?.name !== 'AbortError' && !error?.message?.includes('Network request failed')) {
        console.error('Failed to refresh SRS IDs:', error);
      }
    }
  }, [user]);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      setLoading(true);
      await refreshUser(controller.signal);
      setLoading(false);
    })();
    return () => controller.abort();
  }, [refreshUser]);

  useEffect(() => {
    const controller = new AbortController();
    if (user) {
      refreshSrsIds(controller.signal);
    }
    return () => controller.abort();
  }, [user, refreshSrsIds]);

  const login = async (email: string, password: string) => {
    const response = await apiClient.auth.login({ email, password });
    
    // Store tokens if returned (for mobile app compatibility)
    if ((response as any)?.accessToken) {
      await storage.setItem('accessToken', (response as any).accessToken);
    }
    if ((response as any)?.refreshToken) {
      await storage.setItem('refreshToken', (response as any).refreshToken);
    }
    
    await refreshUser();
    await refreshSrsIds();
  };

  const register = async (email: string, password: string) => {
    const response = await apiClient.auth.register({ email, password });
    
    // Store tokens if returned
    if ((response as any)?.accessToken) {
      await storage.setItem('accessToken', (response as any).accessToken);
    }
    if ((response as any)?.refreshToken) {
      await storage.setItem('refreshToken', (response as any).refreshToken);
    }
    
    // Auto-login after registration
    await login(email, password);
  };

  const logout = async () => {
    try {
      await apiClient.auth.logout();
    } finally {
      // Clear local storage
      await storage.removeItem('accessToken');
      await storage.removeItem('refreshToken');
      setUser(null);
      setSrsIds(new Set());
    }
  };

  const handleTokenExpiration = useCallback(() => {
    setUser(null);
    setSrsIds(new Set());
    storage.removeItem('accessToken');
    storage.removeItem('refreshToken');
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      logout,
      register,
      srsIds,
      refreshSrsIds,
      refreshUser,
      handleTokenExpiration,
    }),
    [user, loading, srsIds, refreshSrsIds, refreshUser, handleTokenExpiration]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// For compatibility with web frontend's global auth context
let globalAuthContext: AuthContextType | null = null;

export function setGlobalAuthContext(context: AuthContextType) {
  globalAuthContext = context;
}

export function getGlobalAuthContext() {
  return globalAuthContext;
}