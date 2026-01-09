/**
 * Log routes
 */

const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// GET /logs - List logs
router.get('/', logController.list);

// GET /logs/modules - Get available modules
router.get('/modules', logController.getModules);

// GET /logs/actions - Get available actions
router.get('/actions', logController.getActions);

// POST /logs/:log_id/undo - Undo operation
router.post('/:log_id/undo', logController.undo);

// POST /logs/:log_id/redo - Redo operation
router.post('/:log_id/redo', logController.redo);

module.exports = router;
