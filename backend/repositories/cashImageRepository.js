/**
 * Cash transaction image repository - Database operations for cash transaction images
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class CashImageRepository extends BaseRepository {
  constructor() {
    super('cash_transaction_images');
  }

  /**
   * Find images by transaction ID
   */
  async findByTransactionId(transactionId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT id as image_id, transaction_id, mime_type, image_data, image_path, uploaded_at
       FROM cash_transaction_images
       WHERE transaction_id = ?
       ORDER BY uploaded_at DESC`,
      [transactionId]
    );
    return rows;
  }

  /**
   * Create a new image record
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const { transaction_id, mime_type, image_data, image_path } = data;

    const [result] = await db.query(
      `INSERT INTO cash_transaction_images (transaction_id, mime_type, image_data, image_path)
       VALUES (?, ?, ?, ?)`,
      [transaction_id, mime_type, image_data, image_path]
    );

    return result.insertId;
  }

  /**
   * Find image with data by image ID
   */
  async findWithData(imageId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT id, transaction_id, mime_type, image_data, image_path
       FROM cash_transaction_images
       WHERE id = ?`,
      [imageId]
    );
    return rows[0];
  }

  /**
   * Delete an image
   */
  async delete(imageId, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'DELETE FROM cash_transaction_images WHERE id = ?',
      [imageId]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new CashImageRepository();
