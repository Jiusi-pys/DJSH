/**
 * Lookup controller - Request handlers for lookup endpoints
 */

const lookupService = require('../services/lookupService');
const { mapProductLookup, mapContactLookup, mapLookupResponse } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class LookupController {
  /**
   * GET /lookups/version
   */
  getVersion = asyncHandler(async (req, res) => {
    const result = await lookupService.getVersion();
    res.json(result);
  });

  /**
   * GET /lookups/products
   */
  getProducts = asyncHandler(async (req, res) => {
    const products = await lookupService.getProducts();
    res.json(mapLookupResponse(products, mapProductLookup));
  });

  /**
   * GET /lookups/contacts?type=customer|supplier
   */
  getContacts = asyncHandler(async (req, res) => {
    const contactType = req.query.type; // 'customer', 'supplier', or undefined for all
    const contacts = await lookupService.getContacts(contactType);
    res.json(mapLookupResponse(contacts, mapContactLookup));
  });
}

module.exports = new LookupController();
