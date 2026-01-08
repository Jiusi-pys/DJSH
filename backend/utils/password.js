/**
 * 密码工具模块
 * 使用 bcrypt 进行密码哈希和验证
 */

const bcrypt = require('bcrypt');
const authConfig = require('../config/auth');

/**
 * 对密码进行哈希处理
 * @param {string} password - 明文密码
 * @returns {Promise<string>} - 哈希后的密码
 */
async function hashPassword(password) {
  return bcrypt.hash(password, authConfig.password.saltRounds);
}

/**
 * 验证密码是否匹配
 * @param {string} password - 明文密码
 * @param {string} hash - 存储的哈希值
 * @returns {Promise<boolean>} - 是否匹配
 */
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * 验证密码强度
 * @param {string} password - 明文密码
 * @returns {{ valid: boolean, message?: string }} - 验证结果
 */
function validatePasswordStrength(password) {
  if (!password) {
    return { valid: false, message: '密码不能为空' };
  }

  if (password.length < authConfig.password.minLength) {
    return { valid: false, message: `密码长度不能少于 ${authConfig.password.minLength} 个字符` };
  }

  if (password.length > authConfig.password.maxLength) {
    return { valid: false, message: `密码长度不能超过 ${authConfig.password.maxLength} 个字符` };
  }

  return { valid: true };
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
};
