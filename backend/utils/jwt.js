/**
 * JWT 工具模块
 * 处理令牌的生成和验证
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const authConfig = require('../config/auth');

/**
 * 生成访问令牌
 * @param {Object} user - 用户对象
 * @param {number} user.id - 用户ID
 * @param {string} user.username - 用户名
 * @param {string} user.role - 用户角色
 * @param {string} user.display_name - 显示名称
 * @returns {string} - JWT 访问令牌
 */
function generateAccessToken(user) {
  const payload = {
    userId: user.id,
    username: user.username,
    role: user.role,
    displayName: user.display_name || user.username,
  };

  return jwt.sign(payload, authConfig.jwt.accessSecret, {
    expiresIn: authConfig.jwt.accessExpiresIn,
    issuer: authConfig.jwt.issuer,
    audience: authConfig.jwt.audience,
  });
}

/**
 * 生成刷新令牌
 * @param {number} userId - 用户ID
 * @returns {{ token: string, hash: string, expiresAt: Date }} - 刷新令牌信息
 */
function generateRefreshToken(userId) {
  // 生成随机令牌
  const token = crypto.randomBytes(64).toString('hex');
  // 对令牌进行哈希存储
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  // 计算过期时间
  const expiresAt = new Date(Date.now() + authConfig.jwt.refreshExpiresMs);

  return { token, hash, expiresAt };
}

/**
 * 验证访问令牌
 * @param {string} token - JWT 访问令牌
 * @returns {{ valid: boolean, payload?: Object, error?: string }} - 验证结果
 */
function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, authConfig.jwt.accessSecret, {
      issuer: authConfig.jwt.issuer,
      audience: authConfig.jwt.audience,
    });
    return { valid: true, payload };
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return { valid: false, error: 'TOKEN_EXPIRED' };
    }
    if (error.name === 'JsonWebTokenError') {
      return { valid: false, error: 'INVALID_TOKEN' };
    }
    return { valid: false, error: 'TOKEN_VERIFICATION_FAILED' };
  }
}

/**
 * 哈希刷新令牌 (用于验证)
 * @param {string} token - 原始刷新令牌
 * @returns {string} - 哈希值
 */
function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * 解码令牌 (不验证签名，用于调试)
 * @param {string} token - JWT 令牌
 * @returns {Object|null} - 解码后的负载
 */
function decodeToken(token) {
  try {
    return jwt.decode(token);
  } catch {
    return null;
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  hashRefreshToken,
  decodeToken,
};
