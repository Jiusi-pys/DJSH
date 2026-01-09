/**
 * Cash transaction routes
 */

const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');

// GET /cash/transactions - List transactions
router.get('/transactions', cashController.list);

// POST /cash/transactions - Create transaction
router.post('/transactions', cashController.create);

module.exports = router;
