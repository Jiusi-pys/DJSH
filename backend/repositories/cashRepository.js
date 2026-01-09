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
   * Create a new transaction
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const { trans_type, amount, category, trans_date, contact_id, remark } = data;

    const [result] = await db.query(
      `INSERT INTO cash_transactions (trans_type, amount, category, trans_date, contact_id, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [trans_type, amount || 0, category || null, trans_date || new Date().toISOString().split('T')[0], contact_id || null, remark || null]
    );

    return result.insertId;
  }

  /**
   * Get monthly cash flow
   */
  async getMonthCashFlow(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(`
      SELECT
        COALESCE(SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END), 0) as expense
      FROM cash_transactions
      WHERE YEAR(trans_date) = YEAR(CURDATE()) AND MONTH(trans_date) = MONTH(CURDATE())
    `);
    return rows[0];
  }
}

module.exports = new CashRepository();
