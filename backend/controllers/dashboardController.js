/**
 * Dashboard controller - Request handlers for dashboard
 */

const dashboardService = require('../services/dashboardService');
const { asyncHandler } = require('../middleware/errorHandler');

class DashboardController {
  /**
   * GET /dashboard/stats
   */
  getStats = asyncHandler(async (req, res) => {
    const stats = await dashboardService.getStats();
    res.json(stats);
  });
}

module.exports = new DashboardController();
