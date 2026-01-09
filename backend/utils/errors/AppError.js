/**
 * Custom error classes for standardized error handling
 */

class AppError extends Error {
  constructor(code, message, statusCode = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super('NOT_FOUND', `${resource}不存在`, 404);
    this.resource = resource;
  }
}

class VersionMismatchError extends AppError {
  constructor() {
    super('VERSION_MISMATCH', '数据已被其他用户修改，请刷新后重试', 409);
  }
}

class ValidationError extends AppError {
  constructor(message, details = null) {
    super('VALIDATION_ERROR', message, 400);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = '未授权访问') {
    super('UNAUTHORIZED', message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = '权限不足') {
    super('FORBIDDEN', message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = '资源冲突') {
    super('CONFLICT', message, 409);
  }
}

class DisabledResourceError extends AppError {
  constructor(resourceType, resourceName) {
    super('RESOURCE_DISABLED', `${resourceType} "${resourceName}" 已被废除，无法使用`, 400);
    this.resourceType = resourceType;
    this.resourceName = resourceName;
  }
}

module.exports = {
  AppError,
  NotFoundError,
  VersionMismatchError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DisabledResourceError,
};
