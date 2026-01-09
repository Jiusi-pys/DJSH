/**
 * Log service - Business logic for operation logs
 */

const logRepository = require('../repositories/logRepository');
const undoRedoService = require('./undoRedoService');
const { NotFoundError } = require('../utils/errors/AppError');

class LogService {
  /**
   * Get logs with filters and pagination
   */
  async getLogs(filters, pagination) {
    return await logRepository.findAllWithFilters(filters, pagination);
  }

  /**
   * Get list of modules
   */
  async getModules() {
    return await logRepository.getModules();
  }

  /**
   * Get list of actions
   */
  async getActions() {
    return await logRepository.getActions();
  }

  /**
   * Undo a log entry
   */
  async undo(logId, req) {
    const log = await logRepository.findByIdIncludeDeleted(logId);
    if (!log) {
      throw new NotFoundError('日志记录');
    }
    return await undoRedoService.undo(log, req);
  }

  /**
   * Redo a log entry
   */
  async redo(logId, req) {
    const log = await logRepository.findByIdIncludeDeleted(logId);
    if (!log) {
      throw new NotFoundError('日志记录');
    }
    return await undoRedoService.redo(log, req);
  }
}

module.exports = new LogService();
