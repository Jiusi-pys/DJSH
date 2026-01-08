/**
 * 认证路由模块
 * 处理登录、登出、令牌刷新等操作
 */

const express = require('express');
const router = express.Router();

const { hashPassword, verifyPassword, validatePasswordStrength } = require('../utils/password');
const { generateAccessToken, generateRefreshToken, hashRefreshToken } = require('../utils/jwt');
const { authenticate, adminOnly } = require('../middleware/auth');
const { loginRateLimiter, recordFailedAttempt, recordSuccessfulLogin, getClientIP } = require('../middleware/rateLimiter');
const authConfig = require('../config/auth');

/**
 * 初始化路由
 * @param {Object} pool - MySQL 连接池
 * @param {Function} logOperation - 日志记录函数
 * @returns {Router} - Express 路由
 */
function initAuthRoutes(pool, logOperation) {
  /**
   * POST /auth/login
   * 用户登录
   */
  router.post('/login', loginRateLimiter, async (req, res) => {
    const { username, password } = req.body;
    const ip = req.clientIP || getClientIP(req);

    try {
      // 参数验证
      if (!username || !password) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: '请输入用户名和密码',
        });
      }

      // 查询用户
      const [users] = await pool.query(
        'SELECT id, username, password_hash, role, status, display_name, failed_login_attempts, locked_until FROM users WHERE username = ?',
        [username]
      );

      if (users.length === 0) {
        // 记录失败尝试
        const attemptResult = recordFailedAttempt(ip, username);

        // 记录日志
        await logOperation({
          module: 'auth',
          action: 'login_failed',
          targetType: 'user',
          targetName: username,
          status: 'failed',
          errorMessage: '用户不存在',
          ip,
          userAgent: req.headers['user-agent'],
        });

        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
          attemptsRemaining: attemptResult.attemptsRemaining,
        });
      }

      const user = users[0];

      // 检查用户状态
      if (user.status === 'disabled') {
        await logOperation({
          module: 'auth',
          action: 'login_failed',
          targetType: 'user',
          targetId: user.id,
          targetName: user.username,
          status: 'failed',
          errorMessage: '账户已禁用',
          ip,
          userAgent: req.headers['user-agent'],
        });

        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_DISABLED',
          message: '账户已被禁用，请联系管理员',
        });
      }

      // 检查数据库级锁定
      if (user.status === 'locked' && user.locked_until && new Date(user.locked_until) > new Date()) {
        const remainingTime = Math.ceil((new Date(user.locked_until) - new Date()) / 1000 / 60);

        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_LOCKED',
          message: `账户已被锁定，请在 ${remainingTime} 分钟后重试`,
          remainingTime,
        });
      }

      // 验证密码
      const passwordValid = await verifyPassword(password, user.password_hash);

      if (!passwordValid) {
        // 记录失败尝试
        const attemptResult = recordFailedAttempt(ip, username);

        // 更新数据库中的失败次数
        const newFailedAttempts = user.failed_login_attempts + 1;
        let updateQuery = 'UPDATE users SET failed_login_attempts = ? WHERE id = ?';
        let updateParams = [newFailedAttempts, user.id];

        // 如果达到最大尝试次数，锁定账户
        if (newFailedAttempts >= authConfig.loginLimit.maxAttempts) {
          const lockedUntil = new Date(Date.now() + authConfig.loginLimit.lockDuration);
          updateQuery = 'UPDATE users SET failed_login_attempts = ?, status = ?, locked_until = ? WHERE id = ?';
          updateParams = [newFailedAttempts, 'locked', lockedUntil, user.id];
        }

        await pool.query(updateQuery, updateParams);

        await logOperation({
          module: 'auth',
          action: 'login_failed',
          targetType: 'user',
          targetId: user.id,
          targetName: user.username,
          status: 'failed',
          errorMessage: '密码错误',
          ip,
          userAgent: req.headers['user-agent'],
        });

        return res.status(401).json({
          success: false,
          error: 'INVALID_CREDENTIALS',
          message: '用户名或密码错误',
          attemptsRemaining: attemptResult.attemptsRemaining,
          locked: attemptResult.locked,
          lockDuration: attemptResult.lockDuration,
        });
      }

      // 登录成功 - 清除失败记录
      recordSuccessfulLogin(ip, username);

      // 重置数据库中的失败记录
      await pool.query(
        'UPDATE users SET failed_login_attempts = 0, status = ?, locked_until = NULL, last_login_at = NOW(), last_login_ip = ? WHERE id = ?',
        ['active', ip, user.id]
      );

      // 生成令牌
      const accessToken = generateAccessToken(user);
      const refreshTokenData = generateRefreshToken(user.id);

      // 存储刷新令牌
      await pool.query(
        'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)',
        [user.id, refreshTokenData.hash, refreshTokenData.expiresAt]
      );

      // 记录登录成功日志
      await logOperation({
        module: 'auth',
        action: 'login',
        targetType: 'user',
        targetId: user.id,
        targetName: user.display_name || user.username,
        status: 'success',
        ip,
        userAgent: req.headers['user-agent'],
        userId: user.id,
      });

      // 设置 Cookie
      res.cookie(authConfig.cookie.accessTokenName, accessToken, {
        ...authConfig.cookie.options,
        maxAge: authConfig.cookie.accessMaxAge,
      });

      res.cookie(authConfig.cookie.refreshTokenName, refreshTokenData.token, {
        ...authConfig.cookie.options,
        maxAge: authConfig.cookie.refreshMaxAge,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            username: user.username,
            role: user.role,
            displayName: user.display_name || user.username,
          },
          accessToken,
          refreshToken: refreshTokenData.token,
          expiresIn: authConfig.cookie.accessMaxAge / 1000,
        },
      });
    } catch (error) {
      console.error('Login error:', error);

      await logOperation({
        module: 'auth',
        action: 'login_failed',
        targetType: 'user',
        targetName: username,
        status: 'failed',
        errorMessage: error.message,
        ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器错误，请稍后重试',
      });
    }
  });

  /**
   * POST /auth/logout
   * 用户登出
   */
  router.post('/logout', authenticate, async (req, res) => {
    try {
      const refreshToken = req.cookies?.[authConfig.cookie.refreshTokenName];

      // 撤销刷新令牌
      if (refreshToken) {
        const tokenHash = hashRefreshToken(refreshToken);
        await pool.query(
          'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = ? AND user_id = ?',
          [tokenHash, req.user.id]
        );
      }

      // 记录登出日志
      await logOperation({
        module: 'auth',
        action: 'logout',
        targetType: 'user',
        targetId: req.user.id,
        targetName: req.user.displayName,
        status: 'success',
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'],
        userId: req.user.id,
      });

      // 清除 Cookie
      res.clearCookie(authConfig.cookie.accessTokenName, authConfig.cookie.options);
      res.clearCookie(authConfig.cookie.refreshTokenName, authConfig.cookie.options);

      res.json({
        success: true,
        message: '已成功登出',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器错误',
      });
    }
  });

  /**
   * POST /auth/refresh
   * 刷新访问令牌
   */
  router.post('/refresh', async (req, res) => {
    try {
      const refreshToken = req.body.refreshToken || req.cookies?.[authConfig.cookie.refreshTokenName];

      if (!refreshToken) {
        return res.status(401).json({
          success: false,
          error: 'NO_REFRESH_TOKEN',
          message: '请重新登录',
        });
      }

      const tokenHash = hashRefreshToken(refreshToken);

      // 查找有效的刷新令牌
      const [tokens] = await pool.query(
        `SELECT rt.*, u.id as user_id, u.username, u.role, u.display_name, u.status
         FROM refresh_tokens rt
         JOIN users u ON rt.user_id = u.id
         WHERE rt.token_hash = ? AND rt.revoked_at IS NULL AND rt.expires_at > NOW()`,
        [tokenHash]
      );

      if (tokens.length === 0) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_REFRESH_TOKEN',
          message: '刷新令牌无效或已过期，请重新登录',
        });
      }

      const tokenRecord = tokens[0];

      // 检查用户状态
      if (tokenRecord.status !== 'active') {
        return res.status(403).json({
          success: false,
          error: 'ACCOUNT_INACTIVE',
          message: '账户状态异常，请联系管理员',
        });
      }

      // 生成新的访问令牌
      const user = {
        id: tokenRecord.user_id,
        username: tokenRecord.username,
        role: tokenRecord.role,
        display_name: tokenRecord.display_name,
      };

      const newAccessToken = generateAccessToken(user);

      // 设置新的 Cookie
      res.cookie(authConfig.cookie.accessTokenName, newAccessToken, {
        ...authConfig.cookie.options,
        maxAge: authConfig.cookie.accessMaxAge,
      });

      res.json({
        success: true,
        data: {
          accessToken: newAccessToken,
          expiresIn: authConfig.cookie.accessMaxAge / 1000,
        },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器错误',
      });
    }
  });

  /**
   * GET /auth/me
   * 获取当前用户信息
   */
  router.get('/me', authenticate, async (req, res) => {
    try {
      const [users] = await pool.query(
        'SELECT id, username, role, status, display_name, last_login_at, last_login_ip, created_at FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在',
        });
      }

      const user = users[0];

      res.json({
        success: true,
        data: {
          id: user.id,
          username: user.username,
          role: user.role,
          displayName: user.display_name || user.username,
          status: user.status,
          lastLoginAt: user.last_login_at,
          lastLoginIP: user.last_login_ip,
          createdAt: user.created_at,
        },
      });
    } catch (error) {
      console.error('Get user info error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器错误',
      });
    }
  });

  /**
   * PUT /auth/password
   * 修改密码
   */
  router.put('/password', authenticate, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          success: false,
          error: 'INVALID_INPUT',
          message: '请输入当前密码和新密码',
        });
      }

      // 验证新密码强度
      const strengthResult = validatePasswordStrength(newPassword);
      if (!strengthResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'WEAK_PASSWORD',
          message: strengthResult.message,
        });
      }

      // 获取当前密码哈希
      const [users] = await pool.query(
        'SELECT password_hash FROM users WHERE id = ?',
        [req.user.id]
      );

      if (users.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'USER_NOT_FOUND',
          message: '用户不存在',
        });
      }

      // 验证当前密码
      const passwordValid = await verifyPassword(currentPassword, users[0].password_hash);
      if (!passwordValid) {
        return res.status(401).json({
          success: false,
          error: 'INVALID_PASSWORD',
          message: '当前密码错误',
        });
      }

      // 生成新密码哈希并更新
      const newPasswordHash = await hashPassword(newPassword);
      await pool.query(
        'UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?',
        [newPasswordHash, req.user.id]
      );

      // 撤销所有刷新令牌 (强制重新登录)
      await pool.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
        [req.user.id]
      );

      await logOperation({
        module: 'auth',
        action: 'change_password',
        targetType: 'user',
        targetId: req.user.id,
        targetName: req.user.displayName,
        status: 'success',
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'],
        userId: req.user.id,
      });

      // 清除 Cookie
      res.clearCookie(authConfig.cookie.accessTokenName, authConfig.cookie.options);
      res.clearCookie(authConfig.cookie.refreshTokenName, authConfig.cookie.options);

      res.json({
        success: true,
        message: '密码已修改，请重新登录',
      });
    } catch (error) {
      console.error('Change password error:', error);
      res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: '服务器错误',
      });
    }
  });

  return router;
}

module.exports = initAuthRoutes;
