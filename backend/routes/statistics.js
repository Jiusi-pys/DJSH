/**
 * Statistics routes
 */

const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statisticsController');

// GET /statistics/customer-outstanding - Customer receivables
router.get('/customer-outstanding', statisticsController.getCustomerOutstanding);

// GET /statistics/product-sales - Product sales statistics
router.get('/product-sales', statisticsController.getProductSales);

// GET /statistics/inventory - Inventory statistics
router.get('/inventory', statisticsController.getInventory);

module.exports = router;
