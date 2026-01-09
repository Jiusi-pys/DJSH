#!/usr/bin/env node
/**
 * Docker Setup Script
 * Reads config.json and generates .env file for Docker Compose
 *
 * Usage:
 *   node scripts/docker-setup.js          # Generate .env from config.json
 *   node scripts/docker-setup.js --init   # Generate config.json from template
 *   node scripts/docker-setup.js --check  # Validate config.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT_DIR, 'config.json');
const CONFIG_EXAMPLE_PATH = path.join(ROOT_DIR, 'config.example.json');
const ENV_PATH = path.join(ROOT_DIR, '.env');

// Default configuration template
const DEFAULT_CONFIG = {
  app: {
    name: "DJSH Finance App",
    timezone: "Asia/Shanghai"
  },
  network: {
    externalHost: "0.0.0.0",
    internal: {
      mysql: "djsh-mysql",
      backend: "djsh-backend",
      frontend: "djsh-frontend"
    }
  },
  frontend: {
    port: 3000,
    apiUrl: {
      internal: "http://djsh-backend:8080",
      external: "http://localhost:8080"
    }
  },
  backend: {
    port: 8080,
    cors: {
      origins: ["http://localhost:3000"]
    },
    https: {
      enabled: false,
      certPath: "./certs/server.crt",
      keyPath: "./certs/server.key"
    }
  },
  database: {
    port: 3306,
    name: "djsh_finance_db",
    user: "djsh_user",
    password: "",
    rootPassword: "",
    charset: "utf8mb4",
    collation: "utf8mb4_unicode_ci"
  },
  jwt: {
    accessSecret: "",
    refreshSecret: "",
    accessExpiresIn: "8h",
    refreshExpiresIn: "30d"
  },
  docker: {
    networkName: "djsh-network",
    volumes: {
      mysql: "djsh-mysql-data"
    },
    externalPorts: {
      mysql: 3306,
      backend: 8080,
      frontend: 3000
    }
  }
};

/**
 * Generate a random hex string for secrets
 */
function generateSecret(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Initialize config.json with default values and generated secrets
 */
function initConfig(force = false) {
  if (fs.existsSync(CONFIG_PATH) && !force) {
    console.log('config.json already exists. Use --force to overwrite.');
    return false;
  }

  const config = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  // Generate random secrets
  config.jwt.accessSecret = generateSecret();
  config.jwt.refreshSecret = generateSecret();
  config.database.password = generateSecret(16);
  config.database.rootPassword = generateSecret(16);

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  console.log('Created config.json with generated secrets.');
  console.log('Please review and modify the configuration as needed.');
  return true;
}

/**
 * Load and validate configuration
 */
function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error('Error: config.json not found.');
    console.error('Run "node scripts/docker-setup.js --init" to create one.');
    process.exit(1);
  }

  try {
    const content = fs.readFileSync(CONFIG_PATH, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing config.json:', error.message);
    process.exit(1);
  }
}

/**
 * Validate configuration values
 */
function validateConfig(config) {
  const errors = [];
  const warnings = [];

  // Check required fields
  if (!config.database?.password) {
    errors.push('database.password is required');
  }
  if (!config.database?.rootPassword) {
    errors.push('database.rootPassword is required');
  }
  if (!config.jwt?.accessSecret) {
    errors.push('jwt.accessSecret is required');
  }
  if (!config.jwt?.refreshSecret) {
    errors.push('jwt.refreshSecret is required');
  }

  // Check for default/weak passwords
  if (config.database?.password?.includes('change_this')) {
    warnings.push('database.password appears to be a default value - please change it');
  }
  if (config.jwt?.accessSecret?.includes('change_this')) {
    warnings.push('jwt.accessSecret appears to be a default value - please change it');
  }

  // Check port conflicts
  const ports = [
    config.docker?.externalPorts?.mysql,
    config.docker?.externalPorts?.backend,
    config.docker?.externalPorts?.frontend
  ].filter(Boolean);

  if (new Set(ports).size !== ports.length) {
    errors.push('Docker external ports must be unique');
  }

  return { errors, warnings };
}

/**
 * Generate .env file from config
 */
function generateEnv(config) {
  const externalHost = config.network?.externalHost || '0.0.0.0';
  const internalMysql = config.network?.internal?.mysql || 'djsh-mysql';
  const internalBackend = config.network?.internal?.backend || 'djsh-backend';
  const internalFrontend = config.network?.internal?.frontend || 'djsh-frontend';

  const lines = [
    '# ===========================================',
    '# Auto-generated from config.json',
    '# Do not edit directly - modify config.json and run docker-setup.js',
    `# Generated at: ${new Date().toISOString()}`,
    '# ===========================================',
    '',
    '# ===== Application =====',
    `TZ=${config.app?.timezone || 'Asia/Shanghai'}`,
    '',
    '# ===== Network =====',
    `EXTERNAL_HOST=${externalHost}`,
    `INTERNAL_MYSQL=${internalMysql}`,
    `INTERNAL_BACKEND=${internalBackend}`,
    `INTERNAL_FRONTEND=${internalFrontend}`,
    '',
    '# ===== Database =====',
    `DB_HOST=${internalMysql}`,
    `DB_PORT=${config.database?.port || 3306}`,
    `DB_NAME=${config.database?.name || 'djsh_finance_db'}`,
    `DB_USER=${config.database?.user || 'djsh_user'}`,
    `DB_PASSWORD=${config.database?.password || ''}`,
    `MYSQL_ROOT_PASSWORD=${config.database?.rootPassword || ''}`,
    `MYSQL_DATABASE=${config.database?.name || 'djsh_finance_db'}`,
    `MYSQL_USER=${config.database?.user || 'djsh_user'}`,
    `MYSQL_PASSWORD=${config.database?.password || ''}`,
    '',
    '# ===== Backend =====',
    `BACKEND_HOST=${externalHost}`,
    `BACKEND_PORT=${config.backend?.port || 8080}`,
    `ENABLE_HTTPS=${config.backend?.https?.enabled || false}`,
    `TLS_CERT_PATH=${config.backend?.https?.certPath || './certs/server.crt'}`,
    `TLS_KEY_PATH=${config.backend?.https?.keyPath || './certs/server.key'}`,
    `CORS_ORIGINS=${(config.backend?.cors?.origins || ['http://localhost:3000']).join(',')}`,
    '',
    '# ===== Frontend =====',
    `FRONTEND_HOST=${externalHost}`,
    `FRONTEND_PORT=${config.frontend?.port || 3000}`,
    '# Internal URL for server-side rendering (container-to-container)',
    `INTERNAL_API_URL=${config.frontend?.apiUrl?.internal || `http://${internalBackend}:${config.backend?.port || 8080}`}`,
    '# External URL for browser requests',
    `NEXT_PUBLIC_API_BASE_URL=${config.frontend?.apiUrl?.external || `http://localhost:${config.docker?.externalPorts?.backend || 8080}`}`,
    '',
    '# ===== JWT =====',
    `JWT_ACCESS_SECRET=${config.jwt?.accessSecret || ''}`,
    `JWT_REFRESH_SECRET=${config.jwt?.refreshSecret || ''}`,
    '',
    '# ===== Docker =====',
    `DOCKER_NETWORK=${config.docker?.networkName || 'djsh-network'}`,
    `MYSQL_VOLUME=${config.docker?.volumes?.mysql || 'djsh-mysql-data'}`,
    `MYSQL_CONTAINER=${internalMysql}`,
    `BACKEND_CONTAINER=${internalBackend}`,
    `FRONTEND_CONTAINER=${internalFrontend}`,
    `MYSQL_PORT_EXTERNAL=${config.docker?.externalPorts?.mysql || 3306}`,
    `BACKEND_PORT_EXTERNAL=${config.docker?.externalPorts?.backend || 8080}`,
    `FRONTEND_PORT_EXTERNAL=${config.docker?.externalPorts?.frontend || 3000}`,
    ''
  ];

  return lines.join('\n');
}

/**
 * Create config.example.json
 */
function createExampleConfig() {
  const example = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  example.jwt.accessSecret = '<auto-generated-on-init>';
  example.jwt.refreshSecret = '<auto-generated-on-init>';
  example.database.password = '<auto-generated-on-init>';
  example.database.rootPassword = '<auto-generated-on-init>';

  fs.writeFileSync(CONFIG_EXAMPLE_PATH, JSON.stringify(example, null, 2));
  console.log('Created config.example.json');
}

/**
 * Main function
 */
function main() {
  const args = process.argv.slice(2);

  // Handle --init flag
  if (args.includes('--init')) {
    const force = args.includes('--force');
    initConfig(force);
    createExampleConfig();
    return;
  }

  // Load configuration
  const config = loadConfig();

  // Handle --check flag
  if (args.includes('--check')) {
    const { errors, warnings } = validateConfig(config);

    if (warnings.length > 0) {
      console.log('\nWarnings:');
      warnings.forEach(w => console.log(`  - ${w}`));
    }

    if (errors.length > 0) {
      console.log('\nErrors:');
      errors.forEach(e => console.log(`  - ${e}`));
      process.exit(1);
    }

    console.log('\nConfiguration is valid.');
    return;
  }

  // Validate configuration
  const { errors, warnings } = validateConfig(config);

  if (warnings.length > 0) {
    console.log('Warnings:');
    warnings.forEach(w => console.log(`  - ${w}`));
  }

  if (errors.length > 0) {
    console.log('Errors:');
    errors.forEach(e => console.log(`  - ${e}`));
    console.log('\nFix the errors in config.json before generating .env');
    process.exit(1);
  }

  // Generate .env file
  const envContent = generateEnv(config);
  fs.writeFileSync(ENV_PATH, envContent);
  console.log('Generated .env from config.json');

  // Also create example config if it doesn't exist
  if (!fs.existsSync(CONFIG_EXAMPLE_PATH)) {
    createExampleConfig();
  }

  console.log('\nNetwork configuration:');
  console.log(`  External host binding: ${config.network?.externalHost || '0.0.0.0'}`);
  console.log(`  Internal MySQL: ${config.network?.internal?.mysql}`);
  console.log(`  Internal Backend: ${config.network?.internal?.backend}`);
  console.log(`  API (browser): ${config.frontend?.apiUrl?.external}`);
  console.log(`  API (container): ${config.frontend?.apiUrl?.internal}`);

  console.log('\nNext steps:');
  console.log('  docker compose up -d --build');
}

main();
