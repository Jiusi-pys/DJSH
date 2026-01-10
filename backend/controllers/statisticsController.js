/**
 * Statistics controller - Request handlers for statistics endpoints
 */

const statisticsService = require('../services/statisticsService');
const { asyncHandler } = require('../middleware/errorHandler');

class StatisticsController {
  /**
   * GET /statistics/customer-outstanding
   */
  getCustomerOutstanding = asyncHandler(async (req, res) => {
    const data = await statisticsService.getCustomerOutstanding();

    res.json({
      items: data.map(row => ({
        key: { contact_id: row.contact_id },
        display: {
          contact_name: row.contact_name,
          contact_type: row.contact_type,
          phone: row.phone || '',
          total_sales: parseFloat(row.total_sales) || 0,
          total_received: parseFloat(row.total_received) || 0,
          outstanding: parseFloat(row.outstanding) || 0,
        }
      }))
    });
  });

  /**
   * GET /statistics/product-sales
   */
  getProductSales = asyncHandler(async (req, res) => {
    const data = await statisticsService.getProductSales();

    res.json({
      items: data.map(row => ({
        key: { product_id: row.product_id },
        display: {
          product_name: row.product_name,
          spec: row.spec || '',
          unit: row.unit,
          current_price: parseFloat(row.current_price) || 0,
          category: row.category || '',
          total_sold: parseFloat(row.total_sold) || 0,
          total_revenue: parseFloat(row.total_revenue) || 0,
          avg_price: parseFloat(row.avg_price) || 0,
        }
      }))
    });
  });

  /**
   * GET /statistics/inventory
   */
  getInventory = asyncHandler(async (req, res) => {
    const data = await statisticsService.getInventoryStats();

    res.json({
      items: data.map(row => ({
        key: { product_id: row.product_id },
        display: {
          product_name: row.product_name,
          spec: row.spec || '',
          unit: row.unit,
          unit_price: parseFloat(row.unit_price) || 0,
          category: row.category || '',
          purchased: parseFloat(row.purchased) || 0,
          sold: parseFloat(row.sold) || 0,
          stock: parseFloat(row.stock) || 0,
          purchase_cost: parseFloat(row.purchase_cost) || 0,
          sales_revenue: parseFloat(row.sales_revenue) || 0,
        }
      }))
    });
  });
}

module.exports = new StatisticsController();
