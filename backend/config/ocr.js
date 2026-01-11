/**
 * OCR System Configuration
 * Hybrid approach - balancing simplicity with production readiness
 */

module.exports = {
  // Receipts directory structure
  receipts: {
    baseDir: process.env.RECEIPTS_DIR || '/Users/jiusi/receipts',
    // Folder pattern: /receipts/{sales|purchase}/YYYY-MM-DD/
    salesDir: 'sales',
    purchaseDir: 'purchase',
    supportedFormats: ['jpg', 'jpeg', 'png', 'pdf']
  },

  // OCR API configuration
  ocr: {
    provider: process.env.OCR_PROVIDER || 'tesseract', // tesseract | google | azure
    tesseract: {
      language: 'chi_sim+eng', // Chinese Simplified + English
      psm: 6, // Assume uniform block of text
      oem: 3  // Default OCR Engine Mode
    },
    timeout: parseInt(process.env.OCR_TIMEOUT_MS) || 30000, // 30 seconds
    retry: {
      maxAttempts: 3,
      initialDelay: 1000, // 1 second
      maxDelay: 8000,     // 8 seconds
      backoffMultiplier: 2 // Exponential backoff
    }
  },

  // LLM for intelligent parsing
  llm: {
    provider: process.env.LLM_PROVIDER || 'openai', // openai | anthropic | local
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini', // Fast and cheap
      temperature: 0.1,
      maxTokens: 2000
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY,
      model: 'claude-3-haiku-20240307',
      temperature: 0.1,
      maxTokens: 2000
    },
    timeout: parseInt(process.env.LLM_TIMEOUT_MS) || 30000
  },

  // Fuzzy matching configuration
  matching: {
    productThreshold: 0.7,  // 70% similarity minimum
    contactThreshold: 1.0,  // Exact match only for contacts
    algorithm: 'levenshtein', // levenshtein | jaro-winkler | combined
    cacheSize: 1000,
    cacheTtl: 3600000 // 1 hour in milliseconds
  },

  // Unit inference rules
  unitInference: {
    enabled: true,
    rules: [
      { pattern: /箱/,  unit: '箱' },
      { pattern: /盒/,  unit: '盒' },
      { pattern: /包/,  unit: '包' },
      { pattern: /袋/,  unit: '袋' },
      { pattern: /斤/,  unit: '斤' },
      { pattern: /两/,  unit: '两' },
      { pattern: /件/,  unit: '件' }
    ],
    defaultUnit: '个'
  },

  // Batch processing configuration
  batch: {
    size: parseInt(process.env.BATCH_SIZE) || 50,
    workerPoolSize: parseInt(process.env.WORKER_POOL_SIZE) || 5,
    continueOnError: true, // Don't stop batch if one job fails
    reportFormat: 'json' // json | summary
  },

  // Retry and error handling
  retry: {
    maxRetries: parseInt(process.env.MAX_RETRIES) || 3,
    retryDelay: 5000, // 5 seconds between retries
    moveToDeadLetterAfter: 3 // Move to DLQ after 3 failures
  },

  // Order API configuration
  orderAPI: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080',
    timeout: 30000,
    // Create fake admin user for service calls
    adminUser: {
      id: 1,
      username: 'ocr-bot',
      role: 'admin',
      displayName: 'OCR Scanner Bot'
    }
  },

  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info', // debug | info | warn | error
    console: {
      enabled: true,
      colorize: process.env.NODE_ENV !== 'production'
    },
    file: {
      enabled: true,
      directory: process.env.LOG_DIR || './logs',
      filename: 'ocr-scanner-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxSize: '20m',
      maxFiles: '14d'
    }
  },

  // Report configuration
  reporting: {
    outputDir: process.env.REPORT_OUTPUT_DIR || './reports/ocr',
    includeConfidenceScores: true,
    includeUnmatchedItems: true,
    includeErrorDetails: true
  }
};
