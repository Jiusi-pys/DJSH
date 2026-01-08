'use client';

import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext } from './AuthContext';
import type { User, LoginResult, AuthState } from '@/types/auth';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

// 不需要认证的页面路径
const PUBLIC_PATHS = ['/login'];

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * 认证提供者组件
 * 管理用户认证状态和提供认证方法
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  /**
   * 检查当前认证状态
   */
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setState({
            user: result.data as User,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }
      }

      // 尝试刷新令牌
      const refreshed = await refreshTokenInternal();
      if (!refreshed) {
        setState({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
    }
  }, []);

  /**
   * 内部刷新令牌方法
   */
  const refreshTokenInternal = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 重新获取用户信息
          const meResponse = await fetch(`${API_BASE}/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
          });

          if (meResponse.ok) {
            const meResult = await meResponse.json();
            if (meResult.success && meResult.data) {
              setState({
                user: meResult.data as User,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return true;
            }
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  };

  /**
   * 登录
   */
  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setState({
          user: result.data.user as User,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // 登录成功后跳转到首页
        router.push('/dashboard');

        return { success: true };
      }

      // 登录失败
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: result.message || '登录失败',
      }));

      return {
        success: false,
        error: result.error,
        message: result.message,
        attemptsRemaining: result.attemptsRemaining,
        locked: result.locked,
        lockDuration: result.lockDuration,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '网络错误，请检查网络连接';
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));

      return {
        success: false,
        message,
      };
    }
  }, [router]);

  /**
   * 登出
   */
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      });
      router.push('/login');
    }
  }, [router]);

  /**
   * 刷新令牌
   */
  const refreshToken = useCallback(async (): Promise<boolean> => {
    return refreshTokenInternal();
  }, []);

  /**
   * 清除错误
   */
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // 初始化时检查认证状态
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // 路由保护
  useEffect(() => {
    if (state.isLoading) return;

    const isPublicPath = PUBLIC_PATHS.some(path => pathname?.startsWith(path));

    if (!state.isAuthenticated && !isPublicPath) {
      // 未认证且不在公开页面，跳转到登录
      router.push('/login');
    } else if (state.isAuthenticated && pathname === '/login') {
      // 已认证但在登录页，跳转到首页
      router.push('/dashboard');
    }
  }, [state.isAuthenticated, state.isLoading, pathname, router]);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        logout,
        refreshToken,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
