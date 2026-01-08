'use client';

import { createContext, useContext } from 'react';
import type { AuthContextValue } from '@/types/auth';

/**
 * 认证上下文
 * 提供用户认证状态和操作方法
 */
export const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * 使用认证上下文的 Hook
 * @throws 如果在 AuthProvider 外部使用会抛出错误
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
