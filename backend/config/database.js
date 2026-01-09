/**
 * Database Configuration
 * Uses centralized config from config.json
 */

const mysql = require('mysql2/promise');
// Use explicit path to avoid conflict with mounted config.json
const config = require('./index.js');

let pool;

function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: config.database.host,
            port: config.database.port,
            user: config.database.user,
            password: config.database.password,
            database: config.database.name,
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }
    return pool;
}

module.exports = { getPool };
