const { getPool } = require('../config/database');

/**
 * 操作日志记录器
 * 用于记录所有增删改操作，支持记录变更前后的数据
 */

/**
 * 记录操作日志
 * @param {Object} options - 日志选项
 * @param {string} options.module - 模块名 (contacts, products, orders, images, cash, auth)
 * @param {string} options.action - 操作类型 (create, update, delete, verify, cancel, restore, login, logout)
 * @param {string} options.targetType - 目标类型 (contact, product, order, image, transaction, user)
 * @param {number} options.targetId - 目标ID
 * @param {string} options.targetName - 目标名称（用于显示）
 * @param {Object} options.oldData - 变更前的数据
 * @param {Object} options.newData - 变更后的数据
 * @param {string} options.status - 状态 ('success' | 'failed')
 * @param {string} options.errorMessage - 错误信息
 * @param {Object} options.req - Express 请求对象（用于获取IP等信息）
 * @param {number} options.userId - 操作用户ID (可选，优先使用此值)
 * @param {string} options.ip - IP地址 (可选，直接传入)
 * @param {string} options.userAgent - 用户代理 (可选，直接传入)
 */
async function logOperation({
  module,
  action,
  targetType = null,
  targetId = null,
  targetName = null,
  oldData = null,
  newData = null,
  status = 'success',
  errorMessage = null,
  req = null,
  userId = null,
  ip = null,
  userAgent = null
}) {
  try {
    const pool = getPool();

    // 从请求对象获取信息（如果没有直接传入）
    const ipAddress = ip || req?.ip || req?.headers?.['x-forwarded-for']?.split(',')[0]?.trim() || req?.connection?.remoteAddress || null;
    const ua = userAgent || req?.headers?.['user-agent'] || null;
    const requestMethod = req?.method || null;
    const requestPath = req?.originalUrl || null;

    // 优先使用传入的 userId，其次从 req.user 获取
    const logUserId = userId || req?.user?.id || null;
    // user_info 显示用户名或 IP
    const userInfo = req?.user?.displayName || req?.user?.username || ipAddress;

    await pool.query(
      `INSERT INTO operation_logs
       (user_id, module, action, target_type, target_id, target_name, user_info,
        request_method, request_path, ip_address, user_agent,
        old_data, new_data, status, error_message, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        logUserId,
        module,
        action,
        targetType,
        targetId,
        targetName,
        userInfo,
        requestMethod,
        requestPath,
        ipAddress,
        ua,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        status,
        errorMessage,
        null // duration_ms - 由调用方自行计算或留空
      ]
    );
  } catch (error) {
    console.error('日志记录失败:', error.message);
    // 日志记录失败不应影响业务逻辑
  }
}

/**
 * 记录错误日志
 * @param {Object} options - 日志选项
 */
async function logError({
  module,
  action,
  targetType = null,
  targetId = null,
  targetName = null,
  errorMessage,
  req = null
}) {
  await logOperation({
    module,
    action,
    targetType,
    targetId,
    targetName,
    oldData: null,
    newData: null,
    status: 'failed',
    errorMessage: String(errorMessage),
    req
  });
}

/**
 * 日志中间件 - 不记录 GET 请求（查看操作）
 * 只有增删改操作由业务代码手动调用 logOperation()
 */
function loggerMiddleware(req, res, next) {
  // 不记录任何 GET 请求，直接通过
  next();
}

module.exports = {
  logOperation,
  logError,
  loggerMiddleware
};
