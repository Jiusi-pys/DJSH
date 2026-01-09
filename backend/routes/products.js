/**
 * Product routes
 */

const express = require('express');
const router = express.Router();
const productController = require('../controllers/productController');

// POST /products - Create product
router.post('/', productController.create);

// PUT /products/:id - Update product
router.put('/:id', productController.update);

// DELETE /products/:id - Delete product
router.delete('/:id', productController.delete);

// POST /products/:id/disable - Disable product
router.post('/:id/disable', productController.disable);

// POST /products/:id/enable - Enable product
router.post('/:id/enable', productController.enable);

module.exports = router;
