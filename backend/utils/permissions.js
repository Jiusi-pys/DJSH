/**
 * 权限管理模块
 * 定义角色权限映射和检查函数
 */

/**
 * 权限定义
 * 格式: module:action
 */
const PERMISSIONS = {
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
};

/**
 * 角色权限映射
 */
const ROLE_PERMISSIONS = {
  // 管理员 - 拥有所有权限
  admin: Object.values(PERMISSIONS),

  // 普通用户 - 只能创建和编辑订单
  user: [
    // 查看权限
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.CONTACTS_VIEW,
    PERMISSIONS.PRODUCTS_VIEW,
    PERMISSIONS.ORDERS_VIEW,
    PERMISSIONS.IMAGES_VIEW,
    PERMISSIONS.CASH_VIEW,

    // 订单操作权限 (根据用户需求: 订单操作可写)
    PERMISSIONS.ORDERS_CREATE,
    PERMISSIONS.ORDERS_UPDATE,
    PERMISSIONS.IMAGES_UPLOAD,
  ],
};

/**
 * 检查用户是否拥有指定权限
 * @param {string} role - 用户角色
 * @param {string} permission - 权限标识
 * @returns {boolean} - 是否有权限
 */
function hasPermission(role, permission) {
  const rolePermissions = ROLE_PERMISSIONS[role];
  if (!rolePermissions) {
    return false;
  }
  return rolePermissions.includes(permission);
}

/**
 * 检查用户是否拥有任意一个权限
 * @param {string} role - 用户角色
 * @param {string[]} permissions - 权限标识数组
 * @returns {boolean} - 是否有任意权限
 */
function hasAnyPermission(role, permissions) {
  return permissions.some(permission => hasPermission(role, permission));
}

/**
 * 检查用户是否拥有所有权限
 * @param {string} role - 用户角色
 * @param {string[]} permissions - 权限标识数组
 * @returns {boolean} - 是否有全部权限
 */
function hasAllPermissions(role, permissions) {
  return permissions.every(permission => hasPermission(role, permission));
}

/**
 * 获取角色的所有权限
 * @param {string} role - 用户角色
 * @returns {string[]} - 权限数组
 */
function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * 判断用户是否是管理员
 * @param {string} role - 用户角色
 * @returns {boolean}
 */
function isAdmin(role) {
  return role === 'admin';
}

/**
 * HTTP 方法到操作的映射
 */
const METHOD_ACTION_MAP = {
  GET: 'view',
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/**
 * 根据路由路径和方法获取所需权限
 * @param {string} path - 请求路径
 * @param {string} method - HTTP 方法
 * @returns {string|null} - 权限标识或 null
 */
function getRequiredPermission(path, method) {
  const action = METHOD_ACTION_MAP[method.toUpperCase()];
  if (!action) return null;

  // 解析路径获取模块
  const pathParts = path.split('/').filter(Boolean);
  if (pathParts.length === 0) return null;

  const module = pathParts[0];

  // 特殊路由处理
  if (module === 'orders') {
    // 订单相关特殊操作
    if (path.includes('/verify')) return PERMISSIONS.ORDERS_VERIFY;
    if (path.includes('/cancel')) return PERMISSIONS.ORDERS_CANCEL;
    if (path.includes('/restore')) return PERMISSIONS.ORDERS_RESTORE;
    if (path.includes('/settle')) return PERMISSIONS.ORDERS_SETTLE;
    if (path.includes('/images')) {
      if (method === 'POST') return PERMISSIONS.IMAGES_UPLOAD;
      if (method === 'DELETE') return PERMISSIONS.IMAGES_DELETE;
      return PERMISSIONS.IMAGES_VIEW;
    }
  }

  // 标准 CRUD 映射
  const modulePermissionMap = {
    dashboard: 'dashboard',
    contacts: 'contacts',
    products: 'products',
    orders: 'orders',
    cash: 'cash',
    logs: 'logs',
    users: 'users',
  };

  const permissionModule = modulePermissionMap[module];
  if (!permissionModule) return null;

  const permissionKey = `${permissionModule.toUpperCase()}_${action.toUpperCase()}`;
  return PERMISSIONS[permissionKey] || null;
}

module.exports = {
  PERMISSIONS,
  ROLE_PERMISSIONS,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
  isAdmin,
  getRequiredPermission,
};
