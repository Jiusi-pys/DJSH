/**
 * Logger utility using Winston
 * Supports console and file logging with daily rotation
 */

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Determine if we're in backend directory
const isBackendDir = __dirname.includes('backend');
const logDir = isBackendDir
  ? path.join(__dirname, '../logs')
  : path.join(__dirname, 'logs');

// Create logger configuration
const loggerConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'djsh-finance' },
  transports: []
};

// Console transport
if (process.env.NODE_ENV !== 'production') {
  loggerConfig.transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, ...meta }) => {
          let msg = `${timestamp} [${level}]: ${message}`;
          if (Object.keys(meta).length > 0 && meta.service) {
            delete meta.service; // Remove default service meta
            if (Object.keys(meta).length > 0) {
              msg += ` ${JSON.stringify(meta)}`;
            }
          }
          return msg;
        })
      )
    })
  );
} else {
  // Production: JSON format for log aggregation
  loggerConfig.transports.push(
    new winston.transports.Console({
      format: winston.format.json()
    })
  );
}

// File transport with daily rotation
loggerConfig.transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'application-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    format: winston.format.json()
  })
);

// Error log file
loggerConfig.transports.push(
  new DailyRotateFile({
    filename: path.join(logDir, 'error-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: winston.format.json()
  })
);

const logger = winston.createLogger(loggerConfig);

module.exports = logger;
