/**
 * 认证配置模块
 * 包含 JWT、密码策略、登录限制等配置
 * 使用集中式配置 (config.json)
 */

// Use explicit path to avoid conflict with mounted config.json
const centralConfig = require('./index.js');

const config = {
  // JWT 配置
  jwt: {
    // 访问令牌密钥 (从 config.json 或环境变量读取)
    accessSecret: centralConfig.jwt.accessSecret || 'djsh-access-secret-key-change-in-production',
    // 刷新令牌密钥
    refreshSecret: centralConfig.jwt.refreshSecret || 'djsh-refresh-secret-key-change-in-production',
    // 访问令牌过期时间
    accessExpiresIn: centralConfig.jwt.accessExpiresIn || '8h',
    // 刷新令牌过期时间
    refreshExpiresIn: centralConfig.jwt.refreshExpiresIn || '30d',
    // 刷新令牌过期毫秒数 (用于数据库存储)
    refreshExpiresMs: 30 * 24 * 60 * 60 * 1000,
    // 令牌签发者
    issuer: 'djsh-finance',
    // 令牌接收者
    audience: 'djsh-client',
  },

  // 密码策略
  password: {
    // bcrypt 盐轮数
    saltRounds: 10,
    // 最小密码长度
    minLength: 6,
    // 最大密码长度
    maxLength: 100,
  },

  // 登录限制配置
  loginLimit: {
    // 最大失败尝试次数
    maxAttempts: 5,
    // 锁定时间 (毫秒) - 30分钟
    lockDuration: 30 * 60 * 1000,
    // 清理旧登录记录的时间窗口 (毫秒) - 24小时
    cleanupWindow: 24 * 60 * 60 * 1000,
  },

  // Cookie 配置
  cookie: {
    // Cookie 名称
    accessTokenName: 'djsh_access_token',
    refreshTokenName: 'djsh_refresh_token',
    // Cookie 选项
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    },
    // 访问令牌 Cookie 最大年龄 (毫秒)
    accessMaxAge: 8 * 60 * 60 * 1000,
    // 刷新令牌 Cookie 最大年龄 (毫秒)
    refreshMaxAge: 30 * 24 * 60 * 60 * 1000,
  },

  // 会话配置
  session: {
    // 是否允许多设备同时登录
    allowMultipleSessions: true,
    // 最大同时会话数
    maxSessions: 5,
  },
};

module.exports = config;
