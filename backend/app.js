/**
 * Express application configuration
 * Separates app setup from server startup
 */

const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
require('dotenv').config();

const { corsOptions } = require('./config/cors');
const { loggerMiddleware } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { getPool } = require('./config/database');
const { logOperation } = require('./middleware/logger');
const initAuthRoutes = require('./routes/auth');

// Import route modules
const lookupRoutes = require('./routes/lookups');
const contactRoutes = require('./routes/contacts');
const productRoutes = require('./routes/products');
const orderRoutes = require('./routes/orders');
const cashRoutes = require('./routes/cash');
const dashboardRoutes = require('./routes/dashboard');
const logRoutes = require('./routes/logs');

const app = express();

// Core middleware
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' })); // Large limit for base64 images
app.use(loggerMiddleware);

// Authentication routes (no auth required)
app.use('/auth', initAuthRoutes(getPool(), logOperation));

// API routes
app.use('/lookups', lookupRoutes);
app.use('/contacts', contactRoutes);
app.use('/products', productRoutes);
app.use('/orders', orderRoutes);
app.use('/cash', cashRoutes);
app.use('/dashboard', dashboardRoutes);
app.use('/logs', logRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
