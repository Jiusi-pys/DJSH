/**
 * Order image repository - Database operations for order images
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class OrderImageRepository extends BaseRepository {
  constructor() {
    super('order_images');
  }

  /**
   * Find images by order ID
   */
  async findByOrderId(orderId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT id as image_id, mime_type, image_data FROM order_images WHERE order_id = ?',
      [orderId]
    );
    return rows;
  }

  /**
   * Find image with full data
   */
  async findWithData(id, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT id, order_id, mime_type, image_data, image_path FROM order_images WHERE id = ?',
      [id]
    );
    return rows[0] || null;
  }

  /**
   * Create a new image
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const { order_id, mime_type, image_data, image_path } = data;

    const [result] = await db.query(
      `INSERT INTO order_images (order_id, mime_type, image_data, image_path)
       VALUES (?, ?, ?, ?)`,
      [order_id, mime_type || 'image/jpeg', image_data, image_path]
    );

    return result.insertId;
  }

  /**
   * Delete an image by ID
   */
  async delete(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'DELETE FROM order_images WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new OrderImageRepository();
