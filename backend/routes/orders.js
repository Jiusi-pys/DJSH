/**
 * Order routes
 */

const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');

// GET /orders/:type - List orders
router.get('/:type', orderController.list);

// GET /orders/:type/:order_id - Get order details
router.get('/:type/:order_id', orderController.getById);

// POST /orders/:type - Create order
router.post('/:type', orderController.create);

// PUT /orders/:type/:order_id - Update order
router.put('/:type/:order_id', orderController.update);

// POST /orders/:type/:order_id/verify - Verify order
router.post('/:type/:order_id/verify', orderController.verify);

// POST /orders/:type/:order_id/cancel - Cancel order
router.post('/:type/:order_id/cancel', orderController.cancel);

// POST /orders/:type/:order_id/restore - Restore order
router.post('/:type/:order_id/restore', orderController.restore);

// POST /orders/:type/:order_id/images - Upload image
router.post('/:type/:order_id/images', orderController.uploadImage);

// GET /orders/:type/:order_id/images - Get images
router.get('/:type/:order_id/images', orderController.getImages);

// DELETE /orders/:type/:order_id/images/:image_id - Delete image
router.delete('/:type/:order_id/images/:image_id', orderController.deleteImage);

module.exports = router;
