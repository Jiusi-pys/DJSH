/**
 * Base repository class with common database operations
 */

const { getPool } = require('../config/database');

class BaseRepository {
  constructor(tableName) {
    this.tableName = tableName;
  }

  /**
   * Get database connection (either provided or from pool)
   */
  getDb(connection = null) {
    return connection || getPool();
  }

  /**
   * Find a record by ID
   */
  async findById(id, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT * FROM ${this.tableName} WHERE id = ? AND deleted_at IS NULL`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find a record by ID (including soft-deleted)
   */
  async findByIdIncludeDeleted(id, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Find multiple records by IDs
   */
  async findByIds(ids, connection = null) {
    if (!ids || ids.length === 0) return [];
    const db = this.getDb(connection);
    const placeholders = ids.map(() => '?').join(',');
    const [rows] = await db.query(
      `SELECT * FROM ${this.tableName} WHERE id IN (${placeholders}) AND deleted_at IS NULL`,
      ids
    );
    return rows;
  }

  /**
   * Find all records (with optional limit)
   */
  async findAll(options = {}, connection = null) {
    const db = this.getDb(connection);
    const { limit, offset, orderBy = 'id', orderDir = 'ASC' } = options;

    let sql = `SELECT * FROM ${this.tableName} WHERE deleted_at IS NULL ORDER BY ${orderBy} ${orderDir}`;
    const params = [];

    if (limit) {
      sql += ' LIMIT ?';
      params.push(limit);
      if (offset) {
        sql += ' OFFSET ?';
        params.push(offset);
      }
    }

    const [rows] = await db.query(sql, params);
    return rows;
  }

  /**
   * Count all records
   */
  async count(connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `SELECT COUNT(*) as total FROM ${this.tableName} WHERE deleted_at IS NULL`
    );
    return result[0]?.total || 0;
  }

  /**
   * Soft delete a record
   */
  async softDelete(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE ${this.tableName} SET deleted_at = NOW() WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Hard delete a record
   */
  async hardDelete(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `DELETE FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Restore a soft-deleted record
   */
  async restore(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE ${this.tableName} SET deleted_at = NULL WHERE id = ?`,
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Build paginated query helper
   */
  buildPaginatedQuery(baseQuery, params, pagination) {
    const { page, page_size } = pagination;
    const offset = (page - 1) * page_size;
    return {
      query: `${baseQuery} LIMIT ? OFFSET ?`,
      params: [...params, parseInt(page_size), offset],
    };
  }

  /**
   * Execute a count query from a select query
   */
  async executeCountQuery(selectQuery, params, connection = null) {
    const db = this.getDb(connection);
    // Remove ORDER BY clause and convert to COUNT
    const countQuery = `SELECT COUNT(*) as total FROM (${selectQuery.replace(/ORDER BY.*$/i, '')}) as sub`;
    const [result] = await db.query(countQuery, params);
    return result[0]?.total || 0;
  }
}

module.exports = BaseRepository;
