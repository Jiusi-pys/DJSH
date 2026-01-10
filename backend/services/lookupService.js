/**
 * Lookup service - Business logic for lookup endpoints
 */

const { getPool } = require('../config/database');
const contactRepository = require('../repositories/contactRepository');
const productRepository = require('../repositories/productRepository');

class LookupService {
  /**
   * Get server version (timestamp)
   */
  async getVersion() {
    const [rows] = await getPool().query('SELECT NOW() as version');
    return { version: new Date(rows[0].version).toISOString() };
  }

  /**
   * Get all products for lookup
   */
  async getProducts() {
    return await productRepository.findAllForLookup();
  }

  /**
   * Get all contacts for lookup
   * @param {string} contactType - Filter by contact type: 'customer', 'supplier', or null for all
   */
  async getContacts(contactType = null) {
    return await contactRepository.findAllForLookup(contactType);
  }
}

module.exports = new LookupService();
