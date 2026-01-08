/**
 * 认证相关类型定义
 */

/** 用户角色 */
export type UserRole = 'admin' | 'user';

/** 用户状态 */
export type UserStatus = 'active' | 'locked' | 'disabled';

/** 用户信息 */
export interface User {
  id: number;
  username: string;
  role: UserRole;
  displayName: string;
  status?: UserStatus;
  lastLoginAt?: string;
  lastLoginIP?: string;
  createdAt?: string;
}

/** 登录请求 */
export interface LoginRequest {
  username: string;
  password: string;
}

/** 登录响应 */
export interface LoginResponse {
  success: boolean;
  data?: {
    user: User;
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  error?: string;
  message?: string;
  attemptsRemaining?: number;
  locked?: boolean;
  lockDuration?: number;
  remainingTime?: number;
}

/** 刷新令牌响应 */
export interface RefreshResponse {
  success: boolean;
  data?: {
    accessToken: string;
    expiresIn: number;
  };
  error?: string;
  message?: string;
}

/** 认证上下文状态 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/** 认证上下文值 */
export interface AuthContextValue extends AuthState {
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  clearError: () => void;
}

/** 登录结果 */
export interface LoginResult {
  success: boolean;
  error?: string;
  message?: string;
  attemptsRemaining?: number;
  locked?: boolean;
  lockDuration?: number;
}

/** 权限定义 */
export const PERMISSIONS = {
  // 仪表盘
  DASHBOARD_VIEW: 'dashboard:view',

  // 联系人管理
  CONTACTS_VIEW: 'contacts:view',
  CONTACTS_CREATE: 'contacts:create',
  CONTACTS_UPDATE: 'contacts:update',
  CONTACTS_DELETE: 'contacts:delete',

  // 产品管理
  PRODUCTS_VIEW: 'products:view',
  PRODUCTS_CREATE: 'products:create',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_DELETE: 'products:delete',

  // 订单管理
  ORDERS_VIEW: 'orders:view',
  ORDERS_CREATE: 'orders:create',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_DELETE: 'orders:delete',
  ORDERS_VERIFY: 'orders:verify',
  ORDERS_CANCEL: 'orders:cancel',
  ORDERS_RESTORE: 'orders:restore',
  ORDERS_SETTLE: 'orders:settle',

  // 订单图片
  IMAGES_VIEW: 'images:view',
  IMAGES_UPLOAD: 'images:upload',
  IMAGES_DELETE: 'images:delete',

  // 现金交易
  CASH_VIEW: 'cash:view',
  CASH_CREATE: 'cash:create',
  CASH_UPDATE: 'cash:update',
  CASH_DELETE: 'cash:delete',

  // 系统日志
  LOGS_VIEW: 'logs:view',

  // 用户管理
  USERS_VIEW: 'users:view',
  USERS_CREATE: 'users:create',
  USERS_UPDATE: 'users:update',
  USERS_DELETE: 'users:delete',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/** 角色权限映射 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: Object.values(PERMISSIONS),
  user: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.IMAGES_VIEW,
    PERMISSIONS.IMAGES_UPLOAD,
    PERMISSIONS.CASH_VIEW,
  ],
};

/** 检查用户是否有权限 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

/** 检查用户是否是管理员 */
export function isAdmin(role: UserRole): boolean {
  return role === 'admin';
}
