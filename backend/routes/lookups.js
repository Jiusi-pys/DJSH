/**
 * Lookup routes
 */

const express = require('express');
const router = express.Router();
const lookupController = require('../controllers/lookupController');

// GET /lookups/version
router.get('/version', lookupController.getVersion);

// GET /lookups/products
router.get('/products', lookupController.getProducts);

// GET /lookups/contacts
router.get('/contacts', lookupController.getContacts);

module.exports = router;
