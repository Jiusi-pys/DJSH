-- Migration: Extend scan_jobs table for OCR batch processing
-- Created: 2026-01-11
-- Purpose: Add retry tracking, error logging, and image deduplication

USE djsh_finance_db;

-- Add new columns to existing scan_jobs table
ALTER TABLE scan_jobs
ADD COLUMN IF NOT EXISTS scan_type ENUM('sales', 'purchase') NOT NULL DEFAULT 'sales' COMMENT '扫描类型: 销售/采购',
ADD COLUMN IF NOT EXISTS retry_count INT NOT NULL DEFAULT 0 COMMENT '重试次数',
ADD COLUMN IF NOT EXISTS last_error TEXT COMMENT '最后一次错误信息',
ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP NULL COMMENT '处理开始时间',
ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP NULL COMMENT '处理完成时间',
ADD COLUMN IF NOT EXISTS image_hash VARCHAR(64) COMMENT 'SHA256哈希值用于去重',
ADD COLUMN IF NOT EXISTS ocr_confidence DECIMAL(3,2) COMMENT 'OCR识别置信度(0.00-1.00)',
ADD COLUMN IF NOT EXISTS matched_products_count INT DEFAULT 0 COMMENT '成功匹配的产品数量',
ADD COLUMN IF NOT EXISTS unmatched_products_count INT DEFAULT 0 COMMENT '未匹配的产品数量';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_jobs_hash ON scan_jobs(image_hash);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_status_date ON scan_jobs(status, processing_started_at);
CREATE INDEX IF NOT EXISTS idx_scan_jobs_retry ON scan_jobs(retry_count);

-- Create dead letter queue table for failed jobs
CREATE TABLE IF NOT EXISTS scan_jobs_dead_letter (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  original_job_id BIGINT NOT NULL COMMENT '原始任务ID',
  order_id BIGINT COMMENT '关联订单ID',
  image_path VARCHAR(500) NOT NULL COMMENT '图片路径',
  ocr_result JSON COMMENT 'OCR识别结果',
  error_message TEXT COMMENT '错误信息',
  error_type VARCHAR(50) COMMENT '错误类型',
  retry_count INT NOT NULL DEFAULT 0 COMMENT '重试次数',
  moved_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '移入时间',
  resolution_status ENUM('pending', 'resolved', 'ignored') NOT NULL DEFAULT 'pending' COMMENT '解决状态',
  resolution_notes TEXT COMMENT '解决说明',
  resolved_at TIMESTAMP NULL COMMENT '解决时间',

  INDEX idx_dlq_status (resolution_status),
  INDEX idx_dlq_moved_at (moved_at),
  INDEX idx_dlq_job_id (original_job_id),
  CONSTRAINT fk_dlq_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='扫描任务失败队列 - 需人工干预的失败任务';

-- Update existing scan_jobs status enum to include 'dead_letter' if needed
-- Note: This is safe as it only adds a new value, doesn't modify existing data
ALTER TABLE scan_jobs MODIFY COLUMN status
  ENUM('pending', 'processing', 'completed', 'failed', 'dead_letter') NOT NULL DEFAULT 'pending';
