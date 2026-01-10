/**
 * Order repository - Database operations for orders
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class OrderRepository extends BaseRepository {
  constructor() {
    super('orders');
  }

  /**
   * Find order with contact info
   */
  async findWithContact(id, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT o.*, c.name as contact_name, c.phone as contact_phone
       FROM orders o
       LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
       WHERE o.id = ? AND o.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find orders with filters and pagination
   */
  async findAllWithFilters(type, filters, pagination) {
    const { query, params } = this._buildFilterQuery(type, filters);

    // Get total count
    const total = await this.executeCountQuery(query, params);

    // Get paginated results
    const { query: paginatedQuery, params: finalParams } = this.buildPaginatedQuery(
      `${query} ORDER BY o.order_date DESC, o.created_at DESC`,
      params,
      pagination
    );
    const [rows] = await getPool().query(paginatedQuery, finalParams);

    return { items: rows, total, ...pagination };
  }

  /**
   * Build filter query for orders
   */
  _buildFilterQuery(type, filters) {
    let query = `
      SELECT o.*, c.name as contact_name,
             (SELECT COUNT(*) FROM order_images WHERE order_id = o.id) as image_count
      FROM orders o
      LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
      WHERE o.deleted_at IS NULL AND o.order_type = ?
    `;
    const params = [type];

    if (filters.manual_verified !== undefined) {
      query += ' AND o.manual_verified = ?';
      params.push(filters.manual_verified === 'true' ? 1 : 0);
    }
    if (filters.auto_verified !== undefined) {
      query += ' AND o.auto_verified = ?';
      params.push(filters.auto_verified === 'true' ? 1 : 0);
    }
    if (filters.settled !== undefined) {
      query += ' AND o.settled = ?';
      params.push(filters.settled === 'true' ? 1 : 0);
    }
    if (filters.q) {
      query += ' AND (o.order_no LIKE ? OR c.name LIKE ?)';
      params.push(`%${filters.q}%`, `%${filters.q}%`);
    }
    if (filters.date_from) {
      query += ' AND o.order_date >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ' AND o.order_date <= ?';
      params.push(filters.date_to);
    }

    return { query, params };
  }

  /**
   * Create a new order
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `INSERT INTO orders (order_no, order_type, contact_id, order_date, total_amount, remark, auto_verified, manual_verified)
       VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
      [data.order_no, data.order_type, data.contact_id || null, data.order_date, data.total_amount, data.remark || null]
    );
    return result.insertId;
  }

  /**
   * Update order basic info
   */
  async update(id, data, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE orders SET
          order_no = ?,
          contact_id = ?,
          order_date = ?,
          remark = ?,
          version = version + 1,
          updated_at = NOW()
       WHERE id = ?`,
      [data.order_no || null, data.contact_id || null, data.order_date, data.remark || '', id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Update order total amount
   */
  async updateTotalAmount(id, amount, connection = null) {
    const db = this.getDb(connection);
    await db.query('UPDATE orders SET total_amount = ? WHERE id = ?', [amount, id]);
  }

  /**
   * Verify an order
   */
  async verify(id, version, settledImmediately = false, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE orders SET manual_verified = 1, settled_immediately = ?, version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL`,
      [settledImmediately ? 1 : 0, id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Cancel an order
   */
  async cancel(id, version, reason, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE orders SET cancelled = 1, cancelled_reason = ?, cancelled_at = NOW(), version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 0`,
      [reason || '订单废弃', id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Restore a cancelled order
   */
  async restoreOrder(id, version, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE orders SET cancelled = 0, cancelled_reason = NULL, cancelled_at = NULL, version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 1`,
      [id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Count orders by order number prefix
   */
  async countByOrderNoPrefix(prefix, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'SELECT COUNT(*) as cnt FROM orders WHERE order_no LIKE ?',
      [`${prefix}%`]
    );
    return result[0]?.cnt || 0;
  }

  /**
   * Get order items
   */
  async getItems(orderId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT oi.*, p.name as product_name, p.spec as product_spec
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id AND p.deleted_at IS NULL
       WHERE oi.order_id = ?`,
      [orderId]
    );
    return rows;
  }

  /**
   * Get order items (raw, without product join)
   */
  async getItemsRaw(orderId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT * FROM order_items WHERE order_id = ?',
      [orderId]
    );
    return rows;
  }

  /**
   * Create order items
   */
  async createItems(orderId, items, connection = null) {
    const db = this.getDb(connection);
    for (const item of items) {
      await db.query(
        `INSERT INTO order_items (order_id, product_id, product_name_raw, unit, unit_price, quantity, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [orderId, item.product_id || null, item.product_name_raw || null, item.unit, item.unit_price, item.quantity, item.unit_price * item.quantity]
      );
    }
  }

  /**
   * Update an order item
   */
  async updateItem(itemId, data, connection = null) {
    const db = this.getDb(connection);
    await db.query(
      `UPDATE order_items SET
          product_id = ?,
          product_name_raw = ?,
          unit = ?,
          unit_price = ?,
          quantity = ?,
          line_total = ?
       WHERE id = ?`,
      [
        data.product_id || null,
        data.product_name_raw || null,
        data.unit,
        data.unit_price,
        data.quantity,
        data.unit_price * data.quantity,
        itemId
      ]
    );
  }

  /**
   * Delete all order items
   */
  async deleteItems(orderId, connection = null) {
    const db = this.getDb(connection);
    await db.query('DELETE FROM order_items WHERE order_id = ?', [orderId]);
  }

  /**
   * Update order full data (for undo/redo)
   */
  async updateFull(id, data, connection = null) {
    const db = this.getDb(connection);
    await db.query(
      `UPDATE orders SET order_no = ?, contact_id = ?, contact_name_raw = ?, order_date = ?,
       total_amount = ?, remark = ?, auto_verified = ?, manual_verified = ? WHERE id = ?`,
      [data.order_no, data.contact_id, data.contact_name_raw, data.order_date,
       data.total_amount, data.remark, data.auto_verified ? 1 : 0, data.manual_verified ? 1 : 0, id]
    );
  }

  /**
   * Set manual verified status
   */
  async setManualVerified(id, verified, connection = null) {
    const db = this.getDb(connection);
    await db.query('UPDATE orders SET manual_verified = ? WHERE id = ?', [verified ? 1 : 0, id]);
  }

  // Dashboard helper methods
  async getTodaySales(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
      FROM orders
      WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
      AND DATE(order_date) = CURDATE()
    `);
    return rows[0];
  }

  async getYesterdaySales(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount
      FROM orders
      WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
      AND DATE(order_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    `);
    return rows[0];
  }

  async getMonthSales(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
      FROM orders
      WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
      AND YEAR(order_date) = YEAR(CURDATE()) AND MONTH(order_date) = MONTH(CURDATE())
    `);
    return rows[0];
  }

  async getLastMonthSales(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount
      FROM orders
      WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
      AND YEAR(order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
      AND MONTH(order_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
    `);
    return rows[0];
  }

  async getMonthPurchase(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
      FROM orders
      WHERE order_type = 'purchase' AND deleted_at IS NULL AND cancelled = 0
      AND YEAR(order_date) = YEAR(CURDATE()) AND MONTH(order_date) = MONTH(CURDATE())
    `);
    return rows[0];
  }

  async getOrderStatusCounts(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT
        SUM(CASE WHEN manual_verified = 0 AND cancelled = 0 THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN manual_verified = 1 AND cancelled = 0 THEN 1 ELSE 0 END) as verified,
        SUM(CASE WHEN cancelled = 1 THEN 1 ELSE 0 END) as cancelled
      FROM orders
      WHERE deleted_at IS NULL
    `);
    return rows[0];
  }

  async getSalesTrend(days = 7, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT DATE(order_date) as date, COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
      FROM orders
      WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
      AND order_date >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      GROUP BY DATE(order_date)
      ORDER BY date ASC
    `, [days - 1]);
    return rows;
  }

  async getTopProducts(limit = 5, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT p.name, SUM(oi.quantity) as total_quantity, SUM(oi.line_total) as total_amount
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN products p ON oi.product_id = p.id
      WHERE o.order_type = 'sales' AND o.deleted_at IS NULL AND o.cancelled = 0
      AND YEAR(o.order_date) = YEAR(CURDATE()) AND MONTH(o.order_date) = MONTH(CURDATE())
      GROUP BY p.id, p.name
      ORDER BY total_amount DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }

  async getTopCustomers(limit = 5, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT c.name, COUNT(o.id) as order_count, SUM(o.total_amount) as total_amount
      FROM orders o
      JOIN contacts c ON o.contact_id = c.id
      WHERE o.order_type = 'sales' AND o.deleted_at IS NULL AND o.cancelled = 0
      AND YEAR(o.order_date) = YEAR(CURDATE()) AND MONTH(o.order_date) = MONTH(CURDATE())
      GROUP BY c.id, c.name
      ORDER BY total_amount DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }

  async getRecentOrders(limit = 5, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT o.*, c.name as contact_name
      FROM orders o
      LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
      WHERE o.deleted_at IS NULL
      ORDER BY o.created_at DESC
      LIMIT ?
    `, [limit]);
    return rows;
  }
}

module.exports = new OrderRepository();
