/**
 * Global error handler middleware
 * Centralizes error handling for consistent API responses
 */

const { AppError } = require('../utils/errors/AppError');

/**
 * Main error handler middleware
 */
function errorHandler(err, req, res, next) {
  // Log error for debugging (only in development)
  if (process.env.NODE_ENV !== 'production') {
    console.error('Error:', err);
  }

  // Handle known operational errors
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.code,
      message: err.message,
      ...(err.details && { details: err.details }),
    });
  }

  // Handle validation errors (from Joi or similar libraries)
  if (err.name === 'ValidationError' && err.details) {
    return res.status(400).json({
      success: false,
      error: 'VALIDATION_ERROR',
      message: err.message,
      details: err.details,
    });
  }

  // Handle MySQL duplicate entry errors
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      error: 'DUPLICATE_ENTRY',
      message: '记录已存在',
    });
  }

  // Handle MySQL foreign key constraint errors
  if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      success: false,
      error: 'FOREIGN_KEY_CONSTRAINT',
      message: '无法执行操作，存在关联数据',
    });
  }

  // Handle JSON parse errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_JSON',
      message: '请求体JSON格式错误',
    });
  }

  // Hide internal errors from clients in production
  const message = process.env.NODE_ENV === 'production'
    ? '服务器内部错误，请稍后重试'
    : err.message;

  res.status(500).json({
    success: false,
    error: 'INTERNAL_ERROR',
    message,
  });
}

/**
 * Async handler wrapper to catch async errors
 * Usage: router.get('/path', asyncHandler(async (req, res) => { ... }))
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Not found handler for undefined routes
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `路径不存在: ${req.method} ${req.path}`,
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
};
