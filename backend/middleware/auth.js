/**
 * 认证中间件模块
 * 处理 JWT 验证和权限检查
 */

const { verifyAccessToken } = require('../utils/jwt');
const { hasPermission, getRequiredPermission, isAdmin } = require('../utils/permissions');
const authConfig = require('../config/auth');

/**
 * 从请求中提取访问令牌
 * 优先从 Authorization 头获取，其次从 Cookie 获取
 * @param {Request} req - Express 请求对象
 * @returns {string|null} - 访问令牌或 null
 */
function extractAccessToken(req) {
  // 1. 从 Authorization 头获取 (Bearer token)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // 2. 从 Cookie 获取
  const cookieToken = req.cookies?.[authConfig.cookie.accessTokenName];
  if (cookieToken) {
    return cookieToken;
  }

  return null;
}

/**
 * 认证中间件 - 验证用户身份
 * 不通过认证会返回 401 错误
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function authenticate(req, res, next) {
  const token = extractAccessToken(req);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '未登录或登录已过期，请重新登录',
    });
  }

  const { valid, payload, error } = verifyAccessToken(token);

  if (!valid) {
    // 令牌过期
    if (error === 'TOKEN_EXPIRED') {
      return res.status(401).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: '登录已过期，请重新登录',
      });
    }

    // 无效令牌
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: '无效的登录凭证',
    });
  }

  // 将用户信息附加到请求对象
  req.user = {
    id: payload.userId,
    username: payload.username,
    role: payload.role,
    displayName: payload.displayName,
  };

  next();
}

/**
 * 可选认证中间件 - 尝试认证但不强制
 * 如果有有效令牌则设置 req.user，否则继续执行
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function optionalAuth(req, res, next) {
  const token = extractAccessToken(req);

  if (token) {
    const { valid, payload } = verifyAccessToken(token);
    if (valid) {
      req.user = {
        id: payload.userId,
        username: payload.username,
        role: payload.role,
        displayName: payload.displayName,
      };
    }
  }

  next();
}

/**
 * 权限检查中间件工厂
 * @param {string|string[]} requiredPermissions - 所需权限
 * @param {Object} options - 选项
 * @param {boolean} options.requireAll - 是否需要所有权限 (默认 false)
 * @returns {Function} - Express 中间件
 */
function requirePermission(requiredPermissions, options = {}) {
  const permissions = Array.isArray(requiredPermissions) ? requiredPermissions : [requiredPermissions];
  const { requireAll = false } = options;

  return (req, res, next) => {
    // 确保已认证
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '请先登录',
      });
    }

    const { role } = req.user;

    // 管理员拥有所有权限
    if (isAdmin(role)) {
      return next();
    }

    // 检查权限
    const hasRequiredPermission = requireAll
      ? permissions.every(p => hasPermission(role, p))
      : permissions.some(p => hasPermission(role, p));

    if (!hasRequiredPermission) {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '您没有执行此操作的权限',
      });
    }

    next();
  };
}

/**
 * 仅管理员中间件
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  if (!isAdmin(req.user.role)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: '此操作仅限管理员',
    });
  }

  next();
}

/**
 * 自动权限检查中间件
 * 根据请求路径和方法自动确定所需权限
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function autoCheckPermission(req, res, next) {
  // 确保已认证
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  const { role } = req.user;

  // 管理员拥有所有权限
  if (isAdmin(role)) {
    return next();
  }

  // 根据路径和方法获取所需权限
  const requiredPermission = getRequiredPermission(req.path, req.method);

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: '您没有执行此操作的权限',
    });
  }

  next();
}

module.exports = {
  extractAccessToken,
  authenticate,
  optionalAuth,
  requirePermission,
  adminOnly,
  autoCheckPermission,
};
