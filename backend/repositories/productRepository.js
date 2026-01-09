/**
 * Product repository - Database operations for products
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class ProductRepository extends BaseRepository {
  constructor() {
    super('products');
  }

  /**
   * Find all products for lookup
   */
  async findAllForLookup(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT id as product_id, name, spec, unit, is_disabled FROM products WHERE deleted_at IS NULL'
    );
    return rows;
  }

  /**
   * Create a new product
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const { name, spec, unit, unit_price, category, remark } = data;

    const [result] = await db.query(
      `INSERT INTO products (name, spec, unit, unit_price, category, remark)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, spec || null, unit || '个', unit_price || 0, category || null, remark || null]
    );

    return result.insertId;
  }

  /**
   * Update a product
   */
  async update(id, data, connection = null) {
    const db = this.getDb(connection);
    const { name, spec, unit, unit_price, category } = data;

    const [result] = await db.query(
      `UPDATE products SET name = ?, spec = ?, unit = ?, unit_price = ?, category = ? WHERE id = ?`,
      [name, spec || null, unit, unit_price || 0, category || null, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Update product full data (for undo/redo)
   */
  async updateFull(id, data, connection = null) {
    const db = this.getDb(connection);
    const { name, spec, unit, remark } = data;

    const [result] = await db.query(
      `UPDATE products SET name = ?, spec = ?, unit = ?, remark = ? WHERE id = ?`,
      [name, spec, unit, remark, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Disable a product
   */
  async disable(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'UPDATE products SET is_disabled = 1 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Enable a product
   */
  async enable(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'UPDATE products SET is_disabled = 0 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new ProductRepository();
