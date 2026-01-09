/**
 * Contact routes
 */

const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

// POST /contacts - Create contact
router.post('/', contactController.create);

// PUT /contacts/:id - Update contact
router.put('/:id', contactController.update);

// DELETE /contacts/:id - Delete contact
router.delete('/:id', contactController.delete);

// POST /contacts/:id/disable - Disable contact
router.post('/:id/disable', contactController.disable);

// POST /contacts/:id/enable - Enable contact
router.post('/:id/enable', contactController.enable);

module.exports = router;
