'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '@/src/api/auth';
import { onAuthEvent } from '@/src/services/apiClient';
import { showToast } from '@/components/ui/Toast';

interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: 'passenger' | 'driver' | 'admin';
  kycStatus: 'not_verified' | 'pending' | 'verified' | 'rejected';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Guard: prevent duplicate /auth/me calls (React 18 Strict Mode double-invoke,
  // HMR re-mounts, multiple components calling refreshUser simultaneously)
  const isFetchingRef = useRef(false);
  const hasFetchedRef = useRef(false);

  // Core logout logic (shared by manual logout and 401 auto-logout)
  const performLogout = useCallback((showMessage = true) => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    // Reset guards so a fresh login + page load works correctly
    hasFetchedRef.current = false;
    isFetchingRef.current = false;
    if (showMessage) {
      showToast.info('You have been logged out.');
    }
  }, []);

  // Listen for 401 logout events from the centralized API client
  useEffect(() => {
    const unsubscribe = onAuthEvent('logout', () => {
      performLogout(false); // Don't show toast — redirect handles UX
    });
    return unsubscribe;
  }, [performLogout]);

  const refreshUser = useCallback(async () => {
    // Prevent concurrent or duplicate calls to /auth/me
    if (isFetchingRef.current) {
      console.log('[AuthContext] refreshUser skipped — already in flight');
      return;
    }
    isFetchingRef.current = true;
    try {
      const response = await authAPI.getCurrentUser();
      setUser(response.data.user);
      console.log('[AuthContext] refreshUser success');
    } catch (error) {
      console.error('[AuthContext] Failed to fetch user:', error);
    } finally {
      isFetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    // Guard: only run once per mount, even in React 18 Strict Mode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (!storedToken) {
        // No token — skip the /auth/me network call entirely
        setIsLoading(false);
        return;
      }
      setToken(storedToken);
      try {
        await refreshUser();
      } catch {
        localStorage.removeItem('token');
        setToken(null);
      }
      setIsLoading(false);
    };
    initAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally empty — initAuth must run exactly once on mount

  const login = async (email: string, password: string) => {
    try {
      const response = await authAPI.login(email, password);
      const { token: newToken, user: userData } = response.data;
      localStorage.setItem('token', newToken);
      setToken(newToken);
      setUser(userData);
      showToast.success('Welcome back!');
    } catch (error: unknown) {
      // Error is already handled by the centralized error handler
      throw error;
    }
  };

  const logout = () => {
    performLogout(true);
    showToast.success('Logged out successfully');
  };

  const updateUser = (data: Partial<User>) => {
    setUser((prev) => prev ? { ...prev, ...data } : null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      isAuthenticated: !!token && !!user,
      login,
      logout,
      updateUser,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};
