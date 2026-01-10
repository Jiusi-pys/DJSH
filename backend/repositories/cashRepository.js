/**
 * Cash transaction repository - Database operations for cash transactions
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class CashRepository extends BaseRepository {
  constructor() {
    super('cash_transactions');
  }

  /**
   * Find transactions with filters and pagination
   */
  async findAllWithFilters(filters, pagination) {
    const { query, params } = this._buildFilterQuery(filters);

    // Get total count
    const total = await this.executeCountQuery(query, params);

    // Get paginated results
    const { query: paginatedQuery, params: finalParams } = this.buildPaginatedQuery(
      `${query} ORDER BY ct.trans_date DESC, ct.created_at DESC`,
      params,
      pagination
    );
    const [rows] = await getPool().query(paginatedQuery, finalParams);

    return { items: rows, total, ...pagination };
  }

  /**
   * Build filter query for transactions
   */
  _buildFilterQuery(filters) {
    let query = `
      SELECT ct.*, c.name as contact_name
      FROM cash_transactions ct
      LEFT JOIN contacts c ON ct.contact_id = c.id AND c.deleted_at IS NULL
      WHERE ct.deleted_at IS NULL
    `;
    const params = [];

    if (filters.type) {
      query += ' AND ct.trans_type = ?';
      params.push(filters.type);
    }
    if (filters.date_from) {
      query += ' AND ct.trans_date >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      query += ' AND ct.trans_date <= ?';
      params.push(filters.date_to);
    }

    return { query, params };
  }

  /**
   * Find a transaction by ID with contact info
   */
  async findById(id, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT ct.*, c.name as contact_name
       FROM cash_transactions ct
       LEFT JOIN contacts c ON ct.contact_id = c.id AND c.deleted_at IS NULL
       WHERE ct.id = ? AND ct.deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Create a new transaction
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const { trans_type, amount, category, trans_date, contact_id, order_id, remark, verified } = data;

    const [result] = await db.query(
      `INSERT INTO cash_transactions (trans_type, amount, category, trans_date, contact_id, order_id, remark, verified, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trans_type,
        amount || 0,
        category || null,
        trans_date || new Date().toISOString().split('T')[0],
        contact_id || null,
        order_id || null,
        remark || null,
        verified !== undefined ? verified : 1, // Default to verified (1) for manual creation
        verified !== undefined && verified === 1 ? new Date() : null // Set verified_at if verified
      ]
    );

    return result.insertId;
  }

  /**
   * Get monthly cash flow (excluding cancelled transactions)
   */
  async getMonthCashFlow(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM cash_transactions
      WHERE YEAR(trans_date) = YEAR(CURDATE()) AND MONTH(trans_date) = MONTH(CURDATE())
        AND deleted_at IS NULL AND cancelled = 0
    `);
    return rows[0];
  }

  /**
   * Get current balance (excluding cancelled, deleted, and unverified transactions)
   */
  async getCurrentBalance(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END), 0) -
        COALESCE(SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END), 0) as balance
      FROM cash_transactions
      WHERE deleted_at IS NULL AND cancelled = 0 AND verified = 1
    `);
    return rows[0].balance;
  }

  /**
   * Cancel a transaction
   */
  async cancel(id, version, reason, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE cash_transactions SET cancelled = 1, cancelled_reason = ?, cancelled_at = NOW(), version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 0`,
      [reason || '交易废弃', id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Restore a cancelled transaction
   */
  async restore(id, version, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE cash_transactions SET cancelled = 0, cancelled_reason = NULL, cancelled_at = NULL, version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 1`,
      [id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Verify a transaction
   */
  async verify(id, version, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE cash_transactions SET verified = 1, verified_at = NOW(), version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND verified = 0`,
      [id, version]
    );
    return result.affectedRows > 0;
  }

  /**
   * Unverify a transaction
   */
  async unverify(id, version, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE cash_transactions SET verified = 0, verified_at = NULL, version = version + 1
       WHERE id = ? AND version = ? AND deleted_at IS NULL AND verified = 1`,
      [id, version]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new CashRepository();
