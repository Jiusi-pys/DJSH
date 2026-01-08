-- 添加订单废弃状态字段
-- 执行时间: 2024-XX-XX

USE djsh_finance_db;

-- 添加废弃状态字段
ALTER TABLE orders
ADD COLUMN cancelled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '废弃状态: 0-正常, 1-已废弃' AFTER settled;

ALTER TABLE orders
ADD COLUMN cancelled_reason TEXT COMMENT '废弃原因' AFTER cancelled;

ALTER TABLE orders
ADD COLUMN cancelled_at TIMESTAMP NULL COMMENT '废弃时间' AFTER cancelled_reason;

-- 添加索引
CREATE INDEX idx_cancelled ON orders(cancelled);

SELECT '已添加订单废弃状态字段' AS status;
