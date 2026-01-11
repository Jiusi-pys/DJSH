/**
 * Scan Job Repository - Database operations for OCR scan jobs
 */

const BaseRepository = require('./baseRepository');
const { getPool } = require('../config/database');

class ScanJobRepository extends BaseRepository {
  constructor() {
    super('scan_jobs');
  }

  /**
   * Find pending jobs for processing
   * @param {number} limit - Maximum number of jobs to return
   */
  async findPendingJobs(limit = 50, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT id, image_path, scan_type, retry_count, created_at
       FROM scan_jobs
       WHERE status = 'pending' AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT ?`,
      [limit]
    );
    return rows;
  }

  /**
   * Mark job as processing (atomic operation to prevent duplicate processing)
   * @param {number} jobId
   * @returns {boolean} - True if successfully marked, false if already taken
   */
  async markAsProcessing(jobId, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE scan_jobs
       SET status = 'processing',
           processing_started_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND status = 'pending' AND deleted_at IS NULL`,
      [jobId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Mark job as completed
   */
  async markAsCompleted(jobId, data = {}, connection = null) {
    const db = this.getDb(connection);
    const {
      orderId,
      ocrResult,
      ocrConfidence,
      matchedCount,
      unmatchedCount,
      imageHash
    } = data;

    const [result] = await db.query(
      `UPDATE scan_jobs
       SET status = 'completed',
           order_id = ?,
           ocr_result = ?,
           ocr_confidence = ?,
           matched_products_count = ?,
           unmatched_products_count = ?,
           image_hash = ?,
           processing_completed_at = NOW(),
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [
        orderId || null,
        ocrResult ? JSON.stringify(ocrResult) : null,
        ocrConfidence || null,
        matchedCount || 0,
        unmatchedCount || 0,
        imageHash || null,
        jobId
      ]
    );
    return result.affectedRows > 0;
  }

  /**
   * Mark job as failed and increment retry count
   * Status is set to 'pending' to allow retry in next run
   */
  async markAsFailed(jobId, errorMessage, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE scan_jobs
       SET status = 'pending',
           retry_count = retry_count + 1,
           last_error = ?,
           processing_started_at = NULL,
           updated_at = NOW()
       WHERE id = ? AND deleted_at IS NULL`,
      [errorMessage, jobId]
    );
    return result.affectedRows > 0;
  }

  /**
   * Move job to dead letter queue
   */
  async moveToDeadLetter(jobId, errorMessage, errorType = null, connection = null) {
    const db = this.getDb(connection);

    // First, get the job details
    const [jobs] = await db.query(
      'SELECT * FROM scan_jobs WHERE id = ? AND deleted_at IS NULL',
      [jobId]
    );

    if (jobs.length === 0) {
      throw new Error(`Job ${jobId} not found`);
    }

    const job = jobs[0];

    // Insert into dead letter queue
    await db.query(
      `INSERT INTO scan_jobs_dead_letter
       (original_job_id, order_id, image_path, ocr_result, error_message, error_type, retry_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        job.id,
        job.order_id || null,
        job.image_path,
        job.ocr_result || null,
        errorMessage,
        errorType || 'UNKNOWN',
        job.retry_count
      ]
    );

    // Update original job status
    await db.query(
      `UPDATE scan_jobs
       SET status = 'dead_letter',
           last_error = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [errorMessage, jobId]
    );

    return true;
  }

  /**
   * Check if image already processed (deduplication)
   */
  async findByImageHash(imageHash, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT id, status, order_id
       FROM scan_jobs
       WHERE image_hash = ? AND deleted_at IS NULL
       LIMIT 1`,
      [imageHash]
    );
    return rows[0] || null;
  }

  /**
   * Get retry count for a specific job
   * @param {number} jobId
   * @returns {number} - Current retry count
   */
  async getRetryCount(jobId, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      'SELECT retry_count FROM scan_jobs WHERE id = ? AND deleted_at IS NULL',
      [jobId]
    );
    return rows[0]?.retry_count || 0;
  }

  /**
   * Get job statistics
   */
  async getJobStats(connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT
         status,
         COUNT(*) as count
       FROM scan_jobs
       WHERE deleted_at IS NULL
       GROUP BY status`
    );

    const stats = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      dead_letter: 0,
      total: 0
    };

    rows.forEach(row => {
      stats[row.status] = row.count;
      stats.total += row.count;
    });

    return stats;
  }

  /**
   * Get jobs that have been stuck in processing for too long
   */
  async findStuckJobs(timeoutMinutes = 30, connection = null) {
    const db = this.getDb(connection);
    const [rows] = await db.query(
      `SELECT id, image_path, processing_started_at
       FROM scan_jobs
       WHERE status = 'processing'
         AND processing_started_at < NOW() - INTERVAL ? MINUTE
         AND deleted_at IS NULL`,
      [timeoutMinutes]
    );
    return rows;
  }

  /**
   * Reset stuck jobs back to pending
   */
  async resetStuckJobs(timeoutMinutes = 30, connection = null) {
    const db = this.getDb(connection);
    const [result] = await db.query(
      `UPDATE scan_jobs
       SET status = 'pending',
           processing_started_at = NULL,
           updated_at = NOW()
       WHERE status = 'processing'
         AND processing_started_at < NOW() - INTERVAL ? MINUTE
         AND deleted_at IS NULL`,
      [timeoutMinutes]
    );
    return result.affectedRows;
  }
}

module.exports = new ScanJobRepository();
