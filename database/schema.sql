-- 财务管理系统 MySQL 数据库 Schema
-- 创建日期: 2024-01-04

-- 禁用 safe-updates 模式（避免更新/删除时需要 LIMIT）
SET SQL_SAFE_UPDATES = 0;

-- 禁用外键约束检查（方便重建表）
SET FOREIGN_KEY_CHECKS = 0;

-- 创建数据库
CREATE DATABASE IF NOT EXISTS djsh_finance_db
    DEFAULT CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE djsh_finance_db;

-- ============================================
-- 1. 客户/供应商表 (contacts)
-- ============================================
DROP TABLE IF EXISTS contacts;
CREATE TABLE contacts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '联系人名称',
    phone VARCHAR(20) COMMENT '联系电话',
    email VARCHAR(100) COMMENT '邮箱',
    address TEXT COMMENT '地址',
    contact_type ENUM('customer', 'supplier', 'both') NOT NULL DEFAULT 'customer' COMMENT '类型: 客户/供应商/两者',
    balance DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '账户余额',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_name (name),
    INDEX idx_phone (phone),
    INDEX idx_type (contact_type),
    INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='客户/供应商表';

-- ============================================
-- 2. 产品表 (products)
-- ============================================
DROP TABLE IF EXISTS products;
CREATE TABLE products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL COMMENT '产品名称',
    spec VARCHAR(100) COMMENT '规格型号',
    unit VARCHAR(20) NOT NULL DEFAULT '个' COMMENT '默认单位',
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '标准单价',
    category VARCHAR(50) COMMENT '分类',
    remark TEXT COMMENT '备注',
    stock_quantity DECIMAL(15,2) NOT NULL DEFAULT 0 COMMENT '库存数量',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_name (name),
    INDEX idx_spec (spec),
    INDEX idx_category (category),
    INDEX idx_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='产品表';

-- ============================================
-- 3. 订单主表 (orders)
-- ============================================
DROP TABLE IF EXISTS orders;
CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(50) NOT NULL COMMENT '订单编号',
    order_type ENUM('sales', 'purchase') NOT NULL COMMENT '订单类型: 销售/采购',
    contact_id BIGINT COMMENT '客户/供应商ID',
    order_date DATE NOT NULL COMMENT '订单日期',
    total_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '订单总金额',
    remark TEXT COMMENT '备注',
    auto_verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '自动验证: 0-失败, 1-通过',
    manual_verified TINYINT(1) NOT NULL DEFAULT 0 COMMENT '人工验证: 0-未验证, 1-已验证',
    settled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '结算状态: 0-未结算, 1-已结算',
    cancelled TINYINT(1) NOT NULL DEFAULT 0 COMMENT '废弃状态: 0-正常, 1-已废弃',
    cancelled_reason TEXT COMMENT '废弃原因',
    cancelled_at TIMESTAMP NULL COMMENT '废弃时间',
    version INT NOT NULL DEFAULT 1 COMMENT '乐观锁版本号',
    issues JSON COMMENT '问题标签JSON数组',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    UNIQUE KEY uk_order_no (order_no),
    INDEX idx_type (order_type),
    INDEX idx_contact (contact_id),
    INDEX idx_date (order_date),
    INDEX idx_auto_verified (auto_verified),
    INDEX idx_manual_verified (manual_verified),
    INDEX idx_settled (settled),
    INDEX idx_cancelled (cancelled),
    INDEX idx_deleted (deleted_at),
    CONSTRAINT fk_order_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='订单主表';

-- ============================================
-- 4. 订单明细表 (order_items)
-- ============================================
DROP TABLE IF EXISTS order_items;
CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    product_id BIGINT COMMENT '产品ID',
    product_name_raw VARCHAR(200) COMMENT '产品原始名称(未匹配时使用)',
    unit VARCHAR(20) NOT NULL DEFAULT '个' COMMENT '单位',
    unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '单价',
    quantity DECIMAL(15,3) NOT NULL DEFAULT 0 COMMENT '数量',
    line_total DECIMAL(15,2) NOT NULL DEFAULT 0.00 COMMENT '行合计',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_order (order_id),
    INDEX idx_product (product_id),
    CONSTRAINT fk_item_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    CONSTRAINT fk_item_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='订单明细表';

-- ============================================
-- 5. 订单图片表 (order_images)
-- ============================================
DROP TABLE IF EXISTS order_images;
CREATE TABLE order_images (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL COMMENT '订单ID',
    mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg' COMMENT 'MIME类型',
    image_data MEDIUMTEXT COMMENT '图片base64数据',
    uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_order (order_id),
    CONSTRAINT fk_image_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='订单图片表';

-- ============================================
-- 6. 现金交易表 (cash_transactions)
-- ============================================
DROP TABLE IF EXISTS cash_transactions;
CREATE TABLE cash_transactions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    trans_type ENUM('income', 'expense') NOT NULL COMMENT '类型: 收入/支出',
    amount DECIMAL(15,2) NOT NULL COMMENT '金额',
    category VARCHAR(50) COMMENT '分类',
    trans_date DATE NOT NULL COMMENT '交易日期',
    contact_id BIGINT COMMENT '关联客户/供应商ID',
    order_id BIGINT COMMENT '关联订单ID',
    remark TEXT COMMENT '备注',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP NULL,
    INDEX idx_type (trans_type),
    INDEX idx_date (trans_date),
    INDEX idx_contact (contact_id),
    INDEX idx_order (order_id),
    INDEX idx_deleted (deleted_at),
    CONSTRAINT fk_cash_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
    CONSTRAINT fk_cash_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='现金交易表';

-- ============================================
-- 7. 扫描任务表 (scan_jobs)
-- ============================================
DROP TABLE IF EXISTS scan_jobs;
CREATE TABLE scan_jobs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT COMMENT '关联订单ID',
    status ENUM('pending', 'processing', 'completed', 'failed') NOT NULL DEFAULT 'pending' COMMENT '状态',
    image_path VARCHAR(500) COMMENT '原始图片路径',
    ocr_result JSON COMMENT 'OCR识别结果',
    error_message TEXT COMMENT '错误信息',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_order (order_id),
    CONSTRAINT fk_scan_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='扫描任务表';

-- ============================================
-- 8. 操作日志表 (operation_logs)
-- ============================================
DROP TABLE IF EXISTS operation_logs;
CREATE TABLE operation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    module VARCHAR(50) NOT NULL COMMENT '模块: contacts, products, orders, cash, dashboard',
    action VARCHAR(50) NOT NULL COMMENT '操作类型: create, update, delete, view, verify, login',
    target_type VARCHAR(50) COMMENT '目标类型: contact, product, order, transaction',
    target_id BIGINT COMMENT '目标ID',
    target_name VARCHAR(200) COMMENT '目标名称/摘要',
    user_info VARCHAR(200) COMMENT '用户信息',
    request_method VARCHAR(10) COMMENT 'HTTP方法',
    request_path VARCHAR(500) COMMENT '请求路径',
    ip_address VARCHAR(45) COMMENT 'IP地址',
    user_agent TEXT COMMENT '浏览器信息',
    old_data JSON COMMENT '变更前数据',
    new_data JSON COMMENT '变更后数据',
    status ENUM('success', 'failed') NOT NULL DEFAULT 'success' COMMENT '状态',
    error_message TEXT COMMENT '错误信息',
    duration_ms INT COMMENT '耗时(毫秒)',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_module (module),
    INDEX idx_action (action),
    INDEX idx_target (target_type, target_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='操作日志表';

-- ============================================
-- VIEWS 视图
-- ============================================

-- 视图1: 待验证订单列表
DROP VIEW IF EXISTS v_pending_verification;
CREATE VIEW v_pending_verification AS
SELECT
    o.id AS order_id,
    o.order_no,
    o.order_type,
    o.order_date,
    o.total_amount,
    o.auto_verified,
    o.manual_verified,
    o.settled,
    c.name AS contact_name,
    o.issues,
    (SELECT COUNT(*) FROM order_images WHERE order_id = o.id) AS image_count,
    o.created_at
FROM orders o
LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
WHERE o.deleted_at IS NULL
    AND o.manual_verified = 0
ORDER BY o.order_date DESC, o.created_at DESC;

-- 视图2: 销售订单汇总
DROP VIEW IF EXISTS v_sales_summary;
CREATE VIEW v_sales_summary AS
SELECT
    DATE(o.order_date) AS date,
    c.name AS contact_name,
    COUNT(*) AS order_count,
    SUM(o.total_amount) AS total_revenue
FROM orders o
LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
WHERE o.deleted_at IS NULL
    AND o.order_type = 'sales'
    AND o.manual_verified = 1
GROUP BY DATE(o.order_date), c.id, c.name
ORDER BY date DESC;

-- 视图3: 采购订单汇总
DROP VIEW IF EXISTS v_purchase_summary;
CREATE VIEW v_purchase_summary AS
SELECT
    DATE(o.order_date) AS date,
    c.name AS supplier_name,
    COUNT(*) AS order_count,
    SUM(o.total_amount) AS total_cost
FROM orders o
LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
WHERE o.deleted_at IS NULL
    AND o.order_type = 'purchase'
    AND o.manual_verified = 1
GROUP BY DATE(o.order_date), c.id, c.name
ORDER BY date DESC;

-- 视图4: 客户应收账款
DROP VIEW IF EXISTS v_customer_receivables;
CREATE VIEW v_customer_receivables AS
SELECT
    c.id AS contact_id,
    c.name AS contact_name,
    c.phone,
    c.balance,
    COALESCE(SUM(CASE WHEN o.order_type = 'sales' THEN o.total_amount ELSE 0 END), 0) AS total_sales,
    COALESCE(SUM(CASE WHEN o.order_type = 'sales' AND o.settled = 1 THEN o.total_amount ELSE 0 END), 0) AS settled_amount,
    COALESCE(SUM(CASE WHEN o.order_type = 'sales' AND o.settled = 0 THEN o.total_amount ELSE 0 END), 0) AS outstanding_amount
FROM contacts c
LEFT JOIN orders o ON c.id = o.contact_id AND o.deleted_at IS NULL
WHERE c.deleted_at IS NULL
    AND c.contact_type IN ('customer', 'both')
GROUP BY c.id, c.name, c.phone, c.balance;

-- 视图5: 供应商应付账款
DROP VIEW IF EXISTS v_supplier_payables;
CREATE VIEW v_supplier_payables AS
SELECT
    c.id AS contact_id,
    c.name AS contact_name,
    c.phone,
    c.balance,
    COALESCE(SUM(CASE WHEN o.order_type = 'purchase' THEN o.total_amount ELSE 0 END), 0) AS total_purchases,
    COALESCE(SUM(CASE WHEN o.order_type = 'purchase' AND o.settled = 1 THEN o.total_amount ELSE 0 END), 0) AS settled_amount,
    COALESCE(SUM(CASE WHEN o.order_type = 'purchase' AND o.settled = 0 THEN o.total_amount ELSE 0 END), 0) AS outstanding_amount
FROM contacts c
LEFT JOIN orders o ON c.id = o.contact_id AND o.deleted_at IS NULL
WHERE c.deleted_at IS NULL
    AND c.contact_type IN ('supplier', 'both')
GROUP BY c.id, c.name, c.phone, c.balance;

-- 视图6: 产品销售排行
DROP VIEW IF EXISTS v_product_sales_ranking;
CREATE VIEW v_product_sales_ranking AS
SELECT
    p.id AS product_id,
    p.name AS product_name,
    p.spec,
    p.unit,
    SUM(oi.quantity) AS total_quantity,
    SUM(oi.line_total) AS total_revenue
FROM products p
LEFT JOIN order_items oi ON p.id = oi.product_id
LEFT JOIN orders o ON oi.order_id = o.id AND o.deleted_at IS NULL AND o.order_type = 'sales'
WHERE p.deleted_at IS NULL
GROUP BY p.id, p.name, p.spec, p.unit
ORDER BY total_revenue DESC
LIMIT 50;

-- 视图7: 每日现金流
DROP VIEW IF EXISTS v_daily_cash_flow;
CREATE VIEW v_daily_cash_flow AS
SELECT
    trans_date AS date,
    SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END) AS total_income,
    SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END) AS total_expense,
    SUM(CASE WHEN trans_type = 'income' THEN amount ELSE -amount END) AS net_flow
FROM cash_transactions
WHERE deleted_at IS NULL
GROUP BY trans_date
ORDER BY date DESC;

-- 视图8: 订单明细（含产品信息）
DROP VIEW IF EXISTS v_order_details;
CREATE VIEW v_order_details AS
SELECT
    o.id AS order_id,
    o.order_no,
    o.order_type,
    o.order_date,
    o.total_amount,
    o.manual_verified,
    o.settled,
    c.name AS contact_name,
    oi.id AS item_id,
    p.name AS product_name,
    p.spec AS product_spec,
    oi.unit,
    oi.unit_price,
    oi.quantity,
    oi.line_total
FROM orders o
LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
LEFT JOIN order_items oi ON o.id = oi.order_id
LEFT JOIN products p ON oi.product_id = p.id AND p.deleted_at IS NULL
WHERE o.deleted_at IS NULL;

-- 视图9: 最近操作日志
DROP VIEW IF EXISTS v_recent_logs;
CREATE VIEW v_recent_logs AS
SELECT
    id,
    module,
    action,
    target_type,
    target_id,
    target_name,
    status,
    created_at
FROM operation_logs
ORDER BY created_at DESC
LIMIT 100;

-- ============================================
-- 存储过程：生成订单编号
-- ============================================
DROP PROCEDURE IF EXISTS generate_order_no;
DELIMITER //
CREATE PROCEDURE generate_order_no(
    IN p_order_type VARCHAR(20),
    OUT p_order_no VARCHAR(50)
)
BEGIN
    DECLARE v_date VARCHAR(8);
    DECLARE v_count INT;
    DECLARE v_max_no VARCHAR(50);

    SET v_date = DATE_FORMAT(CURDATE(), '%Y%m%d');

    -- 获取当天该类型订单数量
    SELECT COUNT(*) + 1 INTO v_count
    FROM orders
    WHERE order_no LIKE CONCAT(p_order_type, '-', v_date, '-%')
    AND deleted_at IS NULL;

    -- 生成订单编号: SO-20240104-001 或 PO-20240104-001
    SET p_order_no = CONCAT(
        IF(p_order_type = 'sales', 'SO', 'PO'),
        '-',
        v_date,
        '-',
        LPAD(v_count, 3, '0')
    );
END //
DELIMITER ;

-- 输出完成信息
SELECT '数据库创建完成！' AS status;
SELECT '表: contacts, products, orders, order_items, order_images, cash_transactions, scan_jobs, operation_logs' AS tables_created;
SELECT '视图: v_pending_verification, v_sales_summary, v_purchase_summary, v_customer_receivables, v_supplier_payables, v_product_sales_ranking, v_daily_cash_flow, v_order_details, v_recent_logs' AS views_created;

-- 重新启用外键约束检查
SET FOREIGN_KEY_CHECKS = 1;
