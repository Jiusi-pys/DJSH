/**
 * Log repository - Database operations for operation logs
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class LogRepository extends BaseRepository {
  constructor() {
    super('operation_logs');
  }

  /**
   * Find logs with filters and pagination
   */
  async findAllWithFilters(filters, pagination) {
    let whereConditions = ['1=1'];
    const params = [];

    if (filters.module) {
      whereConditions.push('module = ?');
      params.push(filters.module);
    }
    if (filters.action) {
      whereConditions.push('action = ?');
      params.push(filters.action);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const [countResult] = await getPool().query(
      `SELECT COUNT(*) as total FROM operation_logs WHERE ${whereClause}`,
      params
    );
    const total = countResult[0]?.total || 0;

    // Get logs (use id DESC for better performance)
    const { page, page_size } = pagination;
    const offset = (page - 1) * page_size;

    const [logs] = await getPool().query(
      `SELECT id, module, action, target_type, target_id, target_name, user_info,
              request_method, request_path, ip_address, status, error_message,
              duration_ms, created_at, old_data, new_data, is_undone
       FROM operation_logs
       WHERE ${whereClause}
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(page_size), offset]
    );

    return { items: logs, total, page, page_size };
  }

  /**
   * Get distinct modules
   */
  async getModules() {
    const [rows] = await getPool().query(
      'SELECT DISTINCT module as value, module as label FROM operation_logs ORDER BY module'
    );
    return rows;
  }

  /**
   * Get distinct actions
   */
  async getActions() {
    const [rows] = await getPool().query(
      'SELECT DISTINCT action as value, action as label FROM operation_logs ORDER BY action'
    );
    return rows;
  }

  /**
   * Mark log as undone
   */
  async markUndone(id, connection = null) {
    const db = this.getDb(connection);
    await db.query('UPDATE operation_logs SET is_undone = 1 WHERE id = ?', [id]);
  }

  /**
   * Mark log as redone (not undone)
   */
  async markRedone(id, connection = null) {
    const db = this.getDb(connection);
    await db.query('UPDATE operation_logs SET is_undone = 0 WHERE id = ?', [id]);
  }
}

module.exports = new LogRepository();
