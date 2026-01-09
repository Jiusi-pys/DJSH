/**
 * Log controller - Request handlers for operation logs
 */

const logService = require('../services/logService');
const { mapLogEntry, mapPaginatedResponse } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class LogController {
  /**
   * GET /logs
   */
  list = asyncHandler(async (req, res) => {
    const filters = {
      module: req.query.module,
      action: req.query.action,
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.limit) || 50,
    };

    const result = await logService.getLogs(filters, pagination);

    res.json({
      items: result.items.map(mapLogEntry),
      total: result.total,
      page: result.page,
      limit: result.page_size
    });
  });

  /**
   * GET /logs/modules
   */
  getModules = asyncHandler(async (req, res) => {
    const modules = await logService.getModules();
    res.json(modules);
  });

  /**
   * GET /logs/actions
   */
  getActions = asyncHandler(async (req, res) => {
    const actions = await logService.getActions();
    res.json(actions);
  });

  /**
   * POST /logs/:log_id/undo
   */
  undo = asyncHandler(async (req, res) => {
    const { log_id } = req.params;
    const result = await logService.undo(log_id, req);

    if (result.success) {
      res.json({ success: true, message: result.message, data: result.data });
    } else {
      res.status(400).json({ error: result.message });
    }
  });

  /**
   * POST /logs/:log_id/redo
   */
  redo = asyncHandler(async (req, res) => {
    const { log_id } = req.params;
    const result = await logService.redo(log_id, req);

    if (result.success) {
      res.json({ success: true, message: result.message, data: result.data });
    } else {
      res.status(400).json({ error: result.message });
    }
  });
}

module.exports = new LogController();
