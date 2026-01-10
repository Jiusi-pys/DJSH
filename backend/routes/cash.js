/**
 * Cash transaction routes
 */

const express = require('express');
const router = express.Router();
const cashController = require('../controllers/cashController');

// GET /cash/balance - Get current balance
router.get('/balance', cashController.getBalance);

// GET /cash/transactions - List transactions
router.get('/transactions', cashController.list);

// POST /cash/transactions - Create transaction
router.post('/transactions', cashController.create);

// POST /cash/transactions/:transaction_id/images - Upload image
router.post('/transactions/:transaction_id/images', cashController.uploadImage);

// GET /cash/transactions/:transaction_id/images - Get images
router.get('/transactions/:transaction_id/images', cashController.getImages);

// DELETE /cash/transactions/:transaction_id/images/:image_id - Delete image
router.delete('/transactions/:transaction_id/images/:image_id', cashController.deleteImage);

// PUT /cash/transactions/:transaction_id/cancel - Cancel transaction
router.put('/transactions/:transaction_id/cancel', cashController.cancel);

// PUT /cash/transactions/:transaction_id/restore - Restore cancelled transaction
router.put('/transactions/:transaction_id/restore', cashController.restore);

// PUT /cash/transactions/:transaction_id/verify - Verify transaction
router.put('/transactions/:transaction_id/verify', cashController.verify);

// PUT /cash/transactions/:transaction_id/unverify - Unverify transaction
router.put('/transactions/:transaction_id/unverify', cashController.unverify);

module.exports = router;
