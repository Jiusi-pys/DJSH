/**
 * Statistics service - Business logic for statistics and analytics
 */

const statisticsRepository = require('../repositories/statisticsRepository');

class StatisticsService {
  /**
   * Get customer outstanding balances (receivables)
   */
  async getCustomerOutstanding() {
    return await statisticsRepository.getCustomerOutstanding();
  }

  /**
   * Get product sales statistics
   */
  async getProductSales() {
    return await statisticsRepository.getProductSales();
  }

  /**
   * Get inventory statistics
   */
  async getInventoryStats() {
    return await statisticsRepository.getInventoryStats();
  }
}

module.exports = new StatisticsService();
