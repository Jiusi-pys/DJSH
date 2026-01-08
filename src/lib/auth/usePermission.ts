'use client';

import { useMemo } from 'react';
import { useAuth } from './AuthContext';
import { hasPermission, isAdmin, type Permission, type UserRole, ROLE_PERMISSIONS } from '@/types/auth';

/**
 * 权限检查 Hook
 * 提供便捷的权限检查方法
 */
export function usePermission() {
  const { user, isAuthenticated } = useAuth();

  const role = user?.role as UserRole | undefined;

  /**
   * 检查是否有指定权限
   */
  const can = useMemo(() => {
    return (permission: Permission): boolean => {
      if (!isAuthenticated || !role) return false;
      return hasPermission(role, permission);
    };
  }, [isAuthenticated, role]);

  /**
   * 检查是否有任意一个权限
   */
  const canAny = useMemo(() => {
    return (permissions: Permission[]): boolean => {
      if (!isAuthenticated || !role) return false;
      return permissions.some(p => hasPermission(role, p));
    };
  }, [isAuthenticated, role]);

  /**
   * 检查是否有所有权限
   */
  const canAll = useMemo(() => {
    return (permissions: Permission[]): boolean => {
      if (!isAuthenticated || !role) return false;
      return permissions.every(p => hasPermission(role, p));
    };
  }, [isAuthenticated, role]);

  /**
   * 是否是管理员
   */
  const isUserAdmin = useMemo(() => {
    return isAuthenticated && role ? isAdmin(role) : false;
  }, [isAuthenticated, role]);

  /**
   * 获取用户所有权限
   */
  const permissions = useMemo(() => {
    if (!isAuthenticated || !role) return [];
    return ROLE_PERMISSIONS[role] || [];
  }, [isAuthenticated, role]);

  return {
    can,
    canAny,
    canAll,
    isAdmin: isUserAdmin,
    permissions,
    role,
  };
}

export { hasPermission, isAdmin };
export type { Permission };
