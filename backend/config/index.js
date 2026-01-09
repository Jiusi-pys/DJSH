/**
 * Centralized Configuration Loader
 * Reads from config.json with fallback to environment variables
 */

const fs = require('fs');
const path = require('path');

let configCache = null;

/**
 * Load configuration from config.json
 */
function loadConfigFile() {
  if (configCache) {
    return configCache;
  }

  // Try to load config.json from multiple locations
  const configPaths = [
    path.resolve(__dirname, '../../config.json'),  // Project root
    path.resolve(__dirname, '../config.json'),     // Backend directory
    '/app/config.json'                              // Docker mount path
  ];

  for (const configPath of configPaths) {
    try {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf8');
        configCache = JSON.parse(content);
        console.log(`Loaded configuration from: ${configPath}`);
        return configCache;
      }
    } catch (error) {
      console.warn(`Failed to load config from ${configPath}:`, error.message);
    }
  }

  console.log('No config.json found, using environment variables only');
  return null;
}

/**
 * Get a value from config.json or environment variable
 * @param {string} envKey - Environment variable name
 * @param {string} configPath - Dot-notation path in config.json (e.g., 'database.host')
 * @param {*} defaultValue - Default value if not found
 */
function get(envKey, configPath, defaultValue = undefined) {
  // Environment variables take precedence
  if (process.env[envKey] !== undefined) {
    return process.env[envKey];
  }

  // Try to get from config.json
  const config = loadConfigFile();
  if (config && configPath) {
    const value = configPath.split('.').reduce((obj, key) => obj?.[key], config);
    if (value !== undefined) {
      return value;
    }
  }

  return defaultValue;
}

/**
 * Get a boolean value
 */
function getBoolean(envKey, configPath, defaultValue = false) {
  const value = get(envKey, configPath, defaultValue);
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'true' || value === '1';
  }
  return defaultValue;
}

/**
 * Get a number value
 */
function getNumber(envKey, configPath, defaultValue = 0) {
  const value = get(envKey, configPath, defaultValue);
  const num = Number(value);
  return isNaN(num) ? defaultValue : num;
}

/**
 * Get entire configuration object
 */
function getAll() {
  return loadConfigFile() || {};
}

module.exports = {
  get,
  getBoolean,
  getNumber,
  getAll,

  // Pre-loaded configuration values for convenience
  app: {
    get name() { return get('APP_NAME', 'app.name', 'DJSH Finance App'); },
    get timezone() { return get('TZ', 'app.timezone', 'Asia/Shanghai'); }
  },

  network: {
    get externalHost() { return get('EXTERNAL_HOST', 'network.externalHost', '0.0.0.0'); },
    get mysqlHost() { return get('DB_HOST', 'network.internal.mysql', 'djsh-mysql'); },
    get backendHost() { return get('INTERNAL_BACKEND', 'network.internal.backend', 'djsh-backend'); },
    get frontendHost() { return get('INTERNAL_FRONTEND', 'network.internal.frontend', 'djsh-frontend'); }
  },

  server: {
    get host() { return get('HOST', 'network.externalHost', '0.0.0.0'); },
    get port() { return getNumber('PORT', 'backend.port', 8080); }
  },

  database: {
    // Database host uses internal container name from network config
    get host() { return get('DB_HOST', 'network.internal.mysql', 'djsh-mysql'); },
    get port() { return getNumber('DB_PORT', 'database.port', 3306); },
    get name() { return get('DB_NAME', 'database.name', 'djsh_finance_db'); },
    get user() { return get('DB_USER', 'database.user', 'root'); },
    get password() { return get('DB_PASSWORD', 'database.password', ''); }
  },

  jwt: {
    get accessSecret() { return get('JWT_ACCESS_SECRET', 'jwt.accessSecret', ''); },
    get refreshSecret() { return get('JWT_REFRESH_SECRET', 'jwt.refreshSecret', ''); },
    get accessExpiresIn() { return get('JWT_ACCESS_EXPIRES', 'jwt.accessExpiresIn', '8h'); },
    get refreshExpiresIn() { return get('JWT_REFRESH_EXPIRES', 'jwt.refreshExpiresIn', '30d'); }
  },

  https: {
    get enabled() { return getBoolean('ENABLE_HTTPS', 'backend.https.enabled', false); },
    get certPath() { return get('TLS_CERT_PATH', 'backend.https.certPath', './certs/server.crt'); },
    get keyPath() { return get('TLS_KEY_PATH', 'backend.https.keyPath', './certs/server.key'); }
  },

  cors: {
    get origins() {
      // First check environment variable
      const envOrigins = process.env.CORS_ORIGINS;
      if (envOrigins) {
        return envOrigins.split(',').map(o => o.trim());
      }
      // Then check config file
      const config = loadConfigFile();
      return config?.backend?.cors?.origins || ['http://localhost:3000'];
    }
  }
};
