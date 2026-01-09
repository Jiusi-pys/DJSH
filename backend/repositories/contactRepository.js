/**
 * Contact repository - Database operations for contacts
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class ContactRepository extends BaseRepository {
  constructor() {
    super('contacts');
  }

  /**
   * Find all contacts for lookup
   */
  async findAllForLookup(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT id as contact_id, name, contact_person, phone, wechat, qq, is_disabled FROM contacts WHERE deleted_at IS NULL'
    );
    return rows;
  }

  /**
   * Create a new contact
   */
  async create(data, connection = null) {
    const db = this.getDb(connection);
    const {
      name, contact_person, phone, wechat, qq,
      address, contact_type, balance, remark
    } = data;

    const [result] = await db.query(
      `INSERT INTO contacts (name, contact_person, phone, wechat, qq, address, contact_type, balance, remark)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        contact_person || null,
        phone || null,
        wechat || null,
        qq || null,
        address || null,
        contact_type || 'customer',
        balance || 0,
        remark || null
      ]
    );

    return result.insertId;
  }

  /**
   * Update a contact
   */
  async update(id, data, connection = null) {
    const db = this.getDb(connection);
    const { name, contact_person, phone, wechat, qq } = data;

    const [result] = await db.query(
      `UPDATE contacts SET name = ?, contact_person = ?, phone = ?, wechat = ?, qq = ? WHERE id = ?`,
      [name, contact_person || null, phone || null, wechat || null, qq || null, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Update contact full data (for undo/redo)
   */
  async updateFull(id, data, connection = null) {
    const db = this.getDb(connection);
    const { name, contact_person, phone, wechat, qq, address, remark } = data;

    const [result] = await db.query(
      `UPDATE contacts SET name = ?, contact_person = ?, phone = ?, wechat = ?, qq = ?, address = ?, remark = ? WHERE id = ?`,
      [name, contact_person, phone, wechat, qq, address, remark, id]
    );

    return result.affectedRows > 0;
  }

  /**
   * Disable a contact
   */
  async disable(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'UPDATE contacts SET is_disabled = 1 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }

  /**
   * Enable a contact
   */
  async enable(id, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      'UPDATE contacts SET is_disabled = 0 WHERE id = ?',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = new ContactRepository();
