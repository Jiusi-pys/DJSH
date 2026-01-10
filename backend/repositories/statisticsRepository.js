/**
 * Statistics repository - Database queries for statistics and analytics
 */

const { getPool } = require('../config/database');

class StatisticsRepository {
  /**
   * Get customer outstanding balances (receivables)
   * Only includes verified and non-cancelled transactions
   */
  async getCustomerOutstanding() {
    const [rows] = await getPool().query(`
      SELECT
        c.id as contact_id,
        c.name as contact_name,
        c.contact_type,
        c.phone,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(received.total_received, 0) as total_received,
        COALESCE(sales.total_sales, 0) - COALESCE(received.total_received, 0) as outstanding
      FROM contacts c
      LEFT JOIN (
        SELECT contact_id, SUM(total_amount) as total_sales
        FROM orders
        WHERE order_type = 'sales' AND manual_verified = 1 AND cancelled = 0 AND deleted_at IS NULL
        GROUP BY contact_id
      ) sales ON c.id = sales.contact_id
      LEFT JOIN (
        SELECT contact_id, SUM(amount) as total_received
        FROM cash_transactions
        WHERE trans_type = 'income' AND verified = 1 AND cancelled = 0 AND deleted_at IS NULL
        GROUP BY contact_id
      ) received ON c.id = received.contact_id
      WHERE c.deleted_at IS NULL AND c.is_disabled = 0 AND c.contact_type IN ('customer', 'both')
        AND (sales.total_sales > 0 OR received.total_received > 0)
      ORDER BY outstanding DESC
    `);
    return rows;
  }

  /**
   * Get product sales statistics
   * Only includes verified and non-cancelled sales orders
   */
  async getProductSales() {
    const [rows] = await getPool().query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.spec,
        p.unit,
        p.unit_price as current_price,
        p.category,
        COALESCE(sales.total_sold, 0) as total_sold,
        COALESCE(sales.total_revenue, 0) as total_revenue,
        COALESCE(sales.avg_price, 0) as avg_price
      FROM products p
      LEFT JOIN (
        SELECT
          oi.product_id,
          SUM(oi.quantity) as total_sold,
          SUM(oi.line_total) as total_revenue,
          AVG(oi.unit_price) as avg_price
        FROM order_items oi
        JOIN orders o ON oi.order_id = o.id
        WHERE o.order_type = 'sales'
          AND o.manual_verified = 1
          AND o.cancelled = 0
          AND o.deleted_at IS NULL
        GROUP BY oi.product_id
      ) sales ON p.id = sales.product_id
      WHERE p.deleted_at IS NULL AND p.is_disabled = 0
      ORDER BY total_sold DESC
    `);
    return rows;
  }

  /**
   * Get inventory statistics (purchase in - sales out)
   * Only includes verified and non-cancelled orders
   */
  async getInventoryStats() {
    const [rows] = await getPool().query(`
      SELECT
        p.id as product_id,
        p.name as product_name,
        p.spec,
        p.unit,
        p.unit_price,
        p.category,
        -- Purchased quantity (verified purchase orders)
        COALESCE(SUM(CASE
          WHEN o.order_type = 'purchase' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.quantity ELSE 0 END), 0) as purchased,
        -- Sold quantity (verified sales orders)
        COALESCE(SUM(CASE
          WHEN o.order_type = 'sales' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.quantity ELSE 0 END), 0) as sold,
        -- Current stock = Purchased - Sold
        COALESCE(SUM(CASE
          WHEN o.order_type = 'purchase' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.quantity ELSE 0 END), 0) -
        COALESCE(SUM(CASE
          WHEN o.order_type = 'sales' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.quantity ELSE 0 END), 0) as stock,
        -- Purchase cost
        COALESCE(SUM(CASE
          WHEN o.order_type = 'purchase' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.line_total ELSE 0 END), 0) as purchase_cost,
        -- Sales revenue
        COALESCE(SUM(CASE
          WHEN o.order_type = 'sales' AND o.manual_verified = 1 AND o.cancelled = 0
          THEN oi.line_total ELSE 0 END), 0) as sales_revenue
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id AND o.deleted_at IS NULL
      WHERE p.deleted_at IS NULL AND p.is_disabled = 0
      GROUP BY p.id, p.name, p.spec, p.unit, p.unit_price, p.category
      ORDER BY stock DESC
    `);
    return rows;
  }
}

module.exports = new StatisticsRepository();
