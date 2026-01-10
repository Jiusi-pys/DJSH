'use client';

import { useState, useCallback, useEffect, useRef, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthContext } from './AuthContext';
import type { User, LoginResult, AuthState } from '@/types/auth';
import { userSchema, loginResponseSchema, authCheckResponseSchema } from '@/types/auth.schemas';

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
    isLoading: false, // 初始设为 false，避免 SSR 时卡住
    error: null,
  });

  /**
   * 检查当前认证状态
   */
  const checkAuth = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(`${API_BASE}/auth/me`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const rawResult = await response.json();
        // Validate response with Zod schema
        const parseResult = authCheckResponseSchema.safeParse(rawResult);

        if (parseResult.success && parseResult.data.success && parseResult.data.data) {
          setState({
            user: parseResult.data.data,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return;
        }

        if (!parseResult.success) {
          console.error('Invalid auth response format:', parseResult.error);
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
      if (process.env.NODE_ENV === 'development') {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Auth check failed:', errorMsg);
      }
      // 确保在任何错误情况下都设置 isLoading 为 false
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10秒超时

      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          // 重新获取用户信息
          const meController = new AbortController();
          const meTimeoutId = setTimeout(() => meController.abort(), 10000);

          const meResponse = await fetch(`${API_BASE}/auth/me`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            signal: meController.signal,
          });

          clearTimeout(meTimeoutId);

          if (meResponse.ok) {
            const rawMeResult = await meResponse.json();
            // Validate with Zod schema
            const parseResult = authCheckResponseSchema.safeParse(rawMeResult);

            if (parseResult.success && parseResult.data.success && parseResult.data.data) {
              setState({
                user: parseResult.data.data,
                isAuthenticated: true,
                isLoading: false,
                error: null,
              });
              return true;
            }

            if (!parseResult.success && process.env.NODE_ENV === 'development') {
              console.error('Invalid user data after refresh:', parseResult.error);
            }
          }
        }
      }
      return false;
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Token refresh failed:', error);
      }
      return false;
    }
  };

  /**
   * 登录
   */
  const login = useCallback(async (username: string, password: string): Promise<LoginResult> => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15秒超时

      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const rawResult = await response.json();
      // Validate login response with Zod schema
      const parseResult = loginResponseSchema.safeParse(rawResult);

      if (!parseResult.success) {
        if (process.env.NODE_ENV === 'development') {
          console.error('Invalid login response format:', parseResult.error);
        }
        setState(prev => ({ ...prev, isLoading: false }));
        return {
          success: false,
          message: '登录响应格式错误',
        };
      }

      const result = parseResult.data;

      if (result.success && result.data) {
        setState({
          user: result.data.user,
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
      let message = '网络错误，请检查网络连接';
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          message = '请求超时，请检查网络连接';
        } else {
          message = error.message;
        }
      }

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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5秒超时

      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('Logout error:', error);
      }
    } finally {
      // 无论如何都清除本地状态
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

  // 初始化时检查认证状态（仅执行一次）
  const hasCheckedAuth = useRef(false);
  useEffect(() => {
    if (!hasCheckedAuth.current) {
      hasCheckedAuth.current = true;
      // 设置加载状态并检查认证
      setState(prev => ({ ...prev, isLoading: true }));
      checkAuth();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 只在组件挂载时执行一次

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isAuthenticated, state.isLoading, pathname]); // 移除 router 避免重定向循环

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
