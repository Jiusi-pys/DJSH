#!/usr/bin/env node

/**
 * Receipt OCR Scanner CLI
 * Hybrid approach: Batch processing with database tracking and retry logic
 *
 * Usage:
 *   node cli/receipt-scanner.js [options]
 *
 * Options:
 *   --batch-size <n>    Number of jobs to process (default: 50)
 *   --dry-run           Preview jobs without processing
 *   --debug             Enable debug logging
 *   --reset-stuck       Reset jobs stuck in 'processing' state
 */

const fs = require('fs').promises;
const path = require('path');
const ocrService = require('../services/ocrService');
const productMatcher = require('../services/productMatcher');
const ocrOrderCreationService = require('../services/ocrOrderCreationService');
const scanJobRepository = require('../repositories/scanJobRepository');
const ocrConfig = require('../config/ocr');
const logger = require('../utils/logger');

class ReceiptScannerCLI {
  constructor(options = {}) {
    this.options = {
      batchSize: options.batchSize || ocrConfig.batch.size,
      dryRun: options.dryRun || false,
      debug: options.debug || false,
      resetStuck: options.resetStuck || false
    };

    this.stats = {
      totalJobs: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      errors: [],
      startTime: Date.now()
    };

    // Configure logging
    if (this.options.debug) {
      logger.level = 'debug';
    }
  }

  /**
   * Main entry point
   */
  async run() {
    try {
      logger.info('Receipt Scanner starting', {
        batchSize: this.options.batchSize,
        dryRun: this.options.dryRun,
        debug: this.options.debug
      });

      // Reset stuck jobs if requested
      if (this.options.resetStuck) {
        await this.resetStuckJobs();
      }

      // Discover pending jobs
      const pendingJobs = await this.discoverPendingJobs();

      if (pendingJobs.length === 0) {
        logger.info('No pending jobs found');
        this.printSummary();
        return 0; // Exit code 0 (success)
      }

      this.stats.totalJobs = pendingJobs.length;
      logger.info(`Found ${pendingJobs.length} pending jobs`);

      if (this.options.dryRun) {
        logger.info('Dry run mode - not processing jobs');
        this.printJobList(pendingJobs);
        return 0;
      }

      // Process jobs in parallel with worker pool
      await this.processBatch(pendingJobs);

      // Generate report
      await this.generateReport();

      // Print summary
      this.printSummary();

      // Determine exit code
      const exitCode = this.stats.failed > 0 ? 1 : 0;
      return exitCode;

    } catch (error) {
      logger.error('Fatal error in scanner', {
        error: error.message,
        stack: error.stack
      });
      return 2; // Exit code 2 (system error)
    }
  }

  /**
   * Reset jobs stuck in processing state
   */
  async resetStuckJobs() {
    logger.info('Checking for stuck jobs...');
    const stuckJobs = await scanJobRepository.findStuckJobs(30); // 30 minutes timeout

    if (stuckJobs.length === 0) {
      logger.info('No stuck jobs found');
      return;
    }

    logger.warn(`Found ${stuckJobs.length} stuck jobs, resetting to pending`);
    const resetCount = await scanJobRepository.resetStuckJobs(30);
    logger.info(`Reset ${resetCount} stuck jobs`);
  }

  /**
   * Discover pending jobs from database
   */
  async discoverPendingJobs() {
    const jobs = await scanJobRepository.findPendingJobs(this.options.batchSize);
    return jobs;
  }

  /**
   * Process batch of jobs with worker pool
   */
  async processBatch(jobs) {
    const workerPoolSize = ocrConfig.batch.workerPoolSize;
    logger.info(`Processing ${jobs.length} jobs with ${workerPoolSize} workers`);

    // Create worker pool
    const workers = [];
    const jobQueue = [...jobs];

    for (let i = 0; i < workerPoolSize; i++) {
      workers.push(this.worker(jobQueue, i + 1));
    }

    await Promise.all(workers);
  }

  /**
   * Worker function for parallel processing
   */
  async worker(jobQueue, workerId) {
    while (jobQueue.length > 0) {
      const job = jobQueue.shift();
      if (!job) break;

      logger.info(`Worker ${workerId} processing job`, {
        jobId: job.id,
        imagePath: job.image_path
      });

      try {
        await this.processJob(job);
        this.stats.processed++;
        this.stats.succeeded++;

      } catch (error) {
        this.stats.processed++;
        this.stats.failed++;
        this.stats.errors.push({
          jobId: job.id,
          imagePath: job.image_path,
          error: error.message
        });

        logger.error(`Worker ${workerId} job failed`, {
          jobId: job.id,
          error: error.message
        });

        // Continue processing other jobs (don't fail entire batch)
      }

      // Log progress
      const progress = ((this.stats.processed / this.stats.totalJobs) * 100).toFixed(1);
      logger.info(`Progress: ${this.stats.processed}/${this.stats.totalJobs} (${progress}%)`);
    }
  }

  /**
   * Process a single scan job
   */
  async processJob(job) {
    const jobId = job.id;
    const imagePath = job.image_path;
    const scanType = job.scan_type; // 'sales' or 'purchase'

    try {
      // Step 1: Check if image file exists
      await this.validateImageFile(imagePath);

      // Step 2: Calculate image hash BEFORE marking as processing (prevents race condition)
      const imageHash = await ocrService.calculateImageHash(imagePath);

      // Step 3: Check for duplicate (BEFORE processing to avoid race condition)
      const duplicate = await scanJobRepository.findByImageHash(imageHash);
      if (duplicate && duplicate.id !== jobId) {
        logger.warn('Duplicate image detected, skipping processing', {
          jobId,
          duplicateJobId: duplicate.id
        });

        // Mark as completed but reference the duplicate (not atomic, but safe)
        await scanJobRepository.markAsCompleted(jobId, {
          orderId: duplicate.order_id,
          ocrResult: { note: `Duplicate of job ${duplicate.id}` },
          ocrConfidence: 0,
          matchedCount: 0,
          unmatchedCount: 0,
          imageHash: imageHash
        });

        this.stats.skipped++;
        return;
      }

      // Step 4: Mark as processing (atomic operation)
      const marked = await scanJobRepository.markAsProcessing(jobId);
      if (!marked) {
        // Another worker already took this job
        logger.warn('Job already being processed by another worker', { jobId });
        this.stats.skipped++;
        return;
      }

      // Step 5: OCR processing
      const ocrResult = await ocrService.processReceipt(imagePath, scanType);

      // Step 6: Create order from OCR data
      const orderResult = await ocrOrderCreationService.createOrderFromReceipt(
        ocrResult.parsedData,
        scanType,
        imagePath
      );

      // Step 7: Mark job as completed (use pre-calculated imageHash)
      await scanJobRepository.markAsCompleted(jobId, {
        orderId: orderResult.orderId,
        ocrResult: ocrResult.parsedData,
        ocrConfidence: ocrResult.parsedData.confidence,
        matchedCount: orderResult.matchedCount,
        unmatchedCount: orderResult.unmatchedCount,
        imageHash: imageHash
      });

      logger.info('Job completed successfully', {
        jobId,
        orderId: orderResult.orderId,
        orderNo: orderResult.orderNo,
        matchedProducts: orderResult.matchedCount,
        unmatchedProducts: orderResult.unmatchedCount
      });

      // Handle unmatched items
      if (orderResult.unmatchedCount > 0) {
        logger.warn('Job has unmatched items', {
          jobId,
          orderId: orderResult.orderId,
          unmatchedItems: orderResult.unmatchedItems
        });
      }

    } catch (error) {
      // Handle job failure
      await this.handleJobFailure(jobId, error);
      throw error; // Re-throw to worker
    }
  }

  /**
   * Validate image file exists and is readable
   */
  async validateImageFile(imagePath) {
    try {
      const stats = await fs.stat(imagePath);
      if (!stats.isFile()) {
        throw new Error('Path is not a file');
      }
    } catch (error) {
      throw new Error(`Image file not found or not readable: ${imagePath}`);
    }
  }

  /**
   * Handle job failure with retry logic
   */
  async handleJobFailure(jobId, error) {
    // Get current retry count
    const retryCount = await scanJobRepository.getRetryCount(jobId);
    const maxRetries = ocrConfig.retry.maxRetries;

    if (retryCount < maxRetries) {
      // Mark as failed, will retry in next run
      await scanJobRepository.markAsFailed(jobId, error.message);
      logger.warn('Job failed, will retry', {
        jobId,
        retryCount: retryCount + 1,
        maxRetries,
        error: error.message
      });

    } else {
      // Max retries exceeded, move to dead letter queue
      await scanJobRepository.moveToDeadLetter(
        jobId,
        error.message,
        error.constructor.name
      );

      logger.error('Job moved to dead letter queue', {
        jobId,
        retryCount: retryCount + 1,
        error: error.message
      });
    }
  }

  /**
   * Generate JSON report
   */
  async generateReport() {
    const reportDir = ocrConfig.reporting.outputDir;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `ocr-report-${timestamp}.json`);

    const report = {
      summary: {
        totalJobs: this.stats.totalJobs,
        processed: this.stats.processed,
        succeeded: this.stats.succeeded,
        failed: this.stats.failed,
        skipped: this.stats.skipped,
        successRate: this.stats.totalJobs > 0
          ? ((this.stats.succeeded / this.stats.totalJobs) * 100).toFixed(1) + '%'
          : '0%',
        duration: Date.now() - this.stats.startTime,
        timestamp: new Date().toISOString()
      },
      errors: this.stats.errors,
      config: {
        batchSize: this.options.batchSize,
        workerPoolSize: ocrConfig.batch.workerPoolSize,
        productMatchThreshold: ocrConfig.matching.productThreshold
      }
    };

    try {
      // Ensure directory exists
      await fs.mkdir(reportDir, { recursive: true });

      // Write report
      await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');

      logger.info('Report generated', { reportPath });
      console.log(`\n📄 Report saved to: ${reportPath}`);

    } catch (error) {
      logger.error('Failed to generate report', {
        error: error.message,
        reportPath
      });
    }
  }

  /**
   * Print job list (dry run mode)
   */
  printJobList(jobs) {
    console.log('\n📋 Pending Jobs:');
    console.log('─'.repeat(80));
    jobs.forEach((job, index) => {
      console.log(`${index + 1}. [Job ${job.id}] ${job.scan_type} - ${job.image_path}`);
      console.log(`   Retries: ${job.retry_count}, Created: ${job.created_at}`);
    });
    console.log('─'.repeat(80));
  }

  /**
   * Print summary statistics
   */
  printSummary() {
    const duration = ((Date.now() - this.stats.startTime) / 1000).toFixed(1);

    console.log('\n' + '='.repeat(80));
    console.log('📊 RECEIPT SCANNER SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total Jobs:     ${this.stats.totalJobs}`);
    console.log(`Processed:      ${this.stats.processed}`);
    console.log(`✅ Succeeded:    ${this.stats.succeeded}`);
    console.log(`❌ Failed:       ${this.stats.failed}`);
    console.log(`⏭️  Skipped:      ${this.stats.skipped}`);
    console.log(`Duration:       ${duration}s`);

    if (this.stats.totalJobs > 0) {
      const successRate = ((this.stats.succeeded / this.stats.totalJobs) * 100).toFixed(1);
      console.log(`Success Rate:   ${successRate}%`);
    }

    console.log('='.repeat(80));

    if (this.stats.errors.length > 0) {
      console.log('\n❌ ERRORS:');
      this.stats.errors.forEach((err, index) => {
        console.log(`${index + 1}. Job ${err.jobId} (${err.imagePath}): ${err.error}`);
      });
    }

    console.log('');
  }
}

// Parse command-line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    batchSize: 50,
    dryRun: false,
    debug: false,
    resetStuck: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
      i++;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--debug') {
      options.debug = true;
    } else if (arg === '--reset-stuck') {
      options.resetStuck = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Receipt OCR Scanner CLI
=======================

Usage: node cli/receipt-scanner.js [options]

Options:
  --batch-size <n>    Number of jobs to process (default: 50)
  --dry-run           Preview jobs without processing
  --debug             Enable debug logging
  --reset-stuck       Reset jobs stuck in 'processing' state
  --help, -h          Show this help message

Examples:
  # Process up to 50 pending jobs
  node cli/receipt-scanner.js

  # Process 10 jobs with debug logging
  node cli/receipt-scanner.js --batch-size 10 --debug

  # Preview jobs without processing
  node cli/receipt-scanner.js --dry-run

  # Reset stuck jobs before processing
  node cli/receipt-scanner.js --reset-stuck
`);
}

// Main execution
if (require.main === module) {
  const options = parseArgs();
  const cli = new ReceiptScannerCLI(options);

  cli.run()
    .then(exitCode => {
      process.exit(exitCode);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(2);
    });
}

module.exports = ReceiptScannerCLI;
