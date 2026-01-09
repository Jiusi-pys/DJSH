/**
 * Dashboard service - Business logic for dashboard statistics
 * Uses Promise.all for parallel query execution (performance optimization)
 */

const orderRepository = require('../repositories/orderRepository');
const cashRepository = require('../repositories/cashRepository');
const contactRepository = require('../repositories/contactRepository');
const productRepository = require('../repositories/productRepository');
const { getPool } = require('../config/database');

class DashboardService {
  /**
   * Get all dashboard statistics
   * Executes multiple queries in parallel for better performance
   */
  async getStats() {
    // Execute all queries in parallel
    const [
      todaySales,
      yesterdaySales,
      monthSales,
      lastMonthSales,
      monthPurchase,
      orderStats,
      cashFlow,
      customerCount,
      productCount,
      salesTrend,
      topProducts,
      topCustomers,
      recentOrders,
    ] = await Promise.all([
      orderRepository.getTodaySales(),
      orderRepository.getYesterdaySales(),
      orderRepository.getMonthSales(),
      orderRepository.getLastMonthSales(),
      orderRepository.getMonthPurchase(),
      orderRepository.getOrderStatusCounts(),
      cashRepository.getMonthCashFlow(),
      this._getCustomerCount(),
      this._getProductCount(),
      orderRepository.getSalesTrend(7),
      orderRepository.getTopProducts(5),
      orderRepository.getTopCustomers(5),
      orderRepository.getRecentOrders(5),
    ]);

    // Fill in missing days for sales trend
    const last7Days = this._fillSalesTrend(salesTrend);

    return {
      // Today's data
      todaySales: {
        amount: parseFloat(todaySales?.amount) || 0,
        count: todaySales?.count || 0
      },
      yesterdaySales: parseFloat(yesterdaySales?.amount) || 0,

      // Monthly data
      monthSales: {
        amount: parseFloat(monthSales?.amount) || 0,
        count: monthSales?.count || 0
      },
      lastMonthSales: parseFloat(lastMonthSales?.amount) || 0,
      monthPurchase: {
        amount: parseFloat(monthPurchase?.amount) || 0,
        count: monthPurchase?.count || 0
      },

      // Order status
      orderStats: {
        pending: orderStats?.pending || 0,
        verified: orderStats?.verified || 0,
        cancelled: orderStats?.cancelled || 0
      },

      // Cash flow
      cashFlow: {
        income: parseFloat(cashFlow?.income) || 0,
        expense: parseFloat(cashFlow?.expense) || 0,
        net: (parseFloat(cashFlow?.income) || 0) - (parseFloat(cashFlow?.expense) || 0)
      },

      // Basic stats
      totalCustomers: customerCount || 0,
      totalProducts: productCount || 0,

      // Trends and rankings
      salesTrend: last7Days,
      topProducts: topProducts.map(p => ({
        name: p.name,
        quantity: parseFloat(p.total_quantity) || 0,
        amount: parseFloat(p.total_amount) || 0
      })),
      topCustomers: topCustomers.map(c => ({
        name: c.name,
        orderCount: c.order_count || 0,
        amount: parseFloat(c.total_amount) || 0
      })),

      // Recent orders
      recentOrders: recentOrders.map(o => ({
        key: { order_id: o.id, order_type: o.order_type },
        display: {
          order_no: o.order_no,
          contact_name: o.contact_name || '',
          total_amount: parseFloat(o.total_amount) || 0,
          manual_verified: o.manual_verified === 1,
          auto_verified: o.auto_verified === 1,
          cancelled: o.cancelled === 1,
          order_date: o.order_date ? o.order_date.toISOString().split('T')[0] : '',
        }
      }))
    };
  }

  /**
   * Get customer count
   */
  async _getCustomerCount() {
    const [result] = await getPool().query(`
      SELECT COUNT(*) as count
      FROM contacts
      WHERE deleted_at IS NULL AND contact_type IN ('customer', 'both')
    `);
    return result[0]?.count || 0;
  }

  /**
   * Get product count
   */
  async _getProductCount() {
    const [result] = await getPool().query(`
      SELECT COUNT(*) as count
      FROM products
      WHERE deleted_at IS NULL
    `);
    return result[0]?.count || 0;
  }

  /**
   * Fill in missing days for the sales trend
   */
  _fillSalesTrend(salesTrend) {
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const found = salesTrend.find(s => {
        const sDate = new Date(s.date).toISOString().split('T')[0];
        return sDate === dateStr;
      });
      last7Days.push({
        date: dateStr,
        amount: found ? parseFloat(found.amount) : 0,
        count: found ? found.count : 0
      });
    }
    return last7Days;
  }
}

module.exports = new DashboardService();
