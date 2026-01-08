/**
 * 登录限流中间件模块
 * 防止暴力破解攻击
 */

const authConfig = require('../config/auth');

// 内存存储登录尝试记录 (生产环境可替换为 Redis)
const loginAttempts = new Map();

/**
 * 获取客户端 IP 地址
 * @param {Request} req - Express 请求对象
 * @returns {string} - IP 地址
 */
function getClientIP(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    req.ip ||
    'unknown'
  );
}

/**
 * 生成限流键
 * @param {string} ip - IP 地址
 * @param {string} username - 用户名
 * @returns {string} - 限流键
 */
function getRateLimitKey(ip, username) {
  return `${ip}:${username}`;
}

/**
 * 获取登录尝试记录
 * @param {string} key - 限流键
 * @returns {{ count: number, firstAttempt: number, lockedUntil: number|null }}
 */
function getAttemptRecord(key) {
  const record = loginAttempts.get(key);
  if (!record) {
    return { count: 0, firstAttempt: Date.now(), lockedUntil: null };
  }
  return record;
}

/**
 * 检查是否被锁定
 * @param {string} ip - IP 地址
 * @param {string} username - 用户名
 * @returns {{ locked: boolean, remainingTime?: number }}
 */
function isLocked(ip, username) {
  const key = getRateLimitKey(ip, username);
  const record = getAttemptRecord(key);

  if (record.lockedUntil && record.lockedUntil > Date.now()) {
    const remainingTime = Math.ceil((record.lockedUntil - Date.now()) / 1000 / 60);
    return { locked: true, remainingTime };
  }

  // 锁定已过期，清除记录
  if (record.lockedUntil && record.lockedUntil <= Date.now()) {
    loginAttempts.delete(key);
  }

  return { locked: false };
}

/**
 * 记录登录失败
 * @param {string} ip - IP 地址
 * @param {string} username - 用户名
 * @returns {{ locked: boolean, attemptsRemaining: number, lockDuration?: number }}
 */
function recordFailedAttempt(ip, username) {
  const key = getRateLimitKey(ip, username);
  const record = getAttemptRecord(key);

  record.count += 1;

  // 检查是否需要锁定
  if (record.count >= authConfig.loginLimit.maxAttempts) {
    record.lockedUntil = Date.now() + authConfig.loginLimit.lockDuration;
    loginAttempts.set(key, record);

    return {
      locked: true,
      attemptsRemaining: 0,
      lockDuration: authConfig.loginLimit.lockDuration / 1000 / 60, // 分钟
    };
  }

  loginAttempts.set(key, record);

  return {
    locked: false,
    attemptsRemaining: authConfig.loginLimit.maxAttempts - record.count,
  };
}

/**
 * 记录登录成功 (清除失败记录)
 * @param {string} ip - IP 地址
 * @param {string} username - 用户名
 */
function recordSuccessfulLogin(ip, username) {
  const key = getRateLimitKey(ip, username);
  loginAttempts.delete(key);
}

/**
 * 登录限流中间件
 * @param {Request} req
 * @param {Response} res
 * @param {Function} next
 */
function loginRateLimiter(req, res, next) {
  const { username } = req.body;
  const ip = getClientIP(req);

  if (!username) {
    return next();
  }

  const { locked, remainingTime } = isLocked(ip, username);

  if (locked) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMITED',
      message: `登录尝试次数过多，请在 ${remainingTime} 分钟后重试`,
      remainingTime,
    });
  }

  // 将 IP 附加到请求对象供后续使用
  req.clientIP = ip;
  next();
}

/**
 * 清理过期的登录尝试记录
 * 应定期调用此函数
 */
function cleanupExpiredRecords() {
  const now = Date.now();
  const cleanupThreshold = now - authConfig.loginLimit.cleanupWindow;

  for (const [key, record] of loginAttempts.entries()) {
    // 删除过期的锁定记录
    if (record.lockedUntil && record.lockedUntil < now) {
      loginAttempts.delete(key);
      continue;
    }
    // 删除太旧的记录
    if (record.firstAttempt < cleanupThreshold) {
      loginAttempts.delete(key);
    }
  }
}

// 每小时清理一次过期记录
setInterval(cleanupExpiredRecords, 60 * 60 * 1000);

module.exports = {
  getClientIP,
  isLocked,
  recordFailedAttempt,
  recordSuccessfulLogin,
  loginRateLimiter,
  cleanupExpiredRecords,
};
