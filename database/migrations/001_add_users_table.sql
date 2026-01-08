-- 用户认证模块数据库迁移
-- 迁移编号: 001
-- 创建日期: 2025-01-09
-- 描述: 添加用户表和相关字段

USE djsh_finance_db;

-- ============================================
-- 1. 创建用户表 (users)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL COMMENT '用户名',
    password_hash VARCHAR(255) NOT NULL COMMENT '密码哈希(bcrypt)',
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user' COMMENT '角色: 管理员/普通用户',
    status ENUM('active', 'locked', 'disabled') NOT NULL DEFAULT 'active' COMMENT '状态: 活跃/锁定/禁用',
    display_name VARCHAR(100) COMMENT '显示名称',
    failed_login_attempts INT NOT NULL DEFAULT 0 COMMENT '连续登录失败次数',
    locked_until TIMESTAMP NULL COMMENT '锁定截止时间',
    last_login_at TIMESTAMP NULL COMMENT '最后登录时间',
    last_login_ip VARCHAR(45) COMMENT '最后登录IP',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    INDEX idx_status (status),
    INDEX idx_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='用户表';

-- ============================================
-- 2. 添加 user_id 字段到 operation_logs 表
-- ============================================
ALTER TABLE operation_logs
ADD COLUMN user_id BIGINT NULL COMMENT '操作用户ID' AFTER id,
ADD INDEX idx_user_id (user_id);

-- ============================================
-- 3. 创建刷新令牌表 (refresh_tokens)
-- ============================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NOT NULL COMMENT '用户ID',
    token_hash VARCHAR(255) NOT NULL COMMENT '令牌哈希',
    expires_at TIMESTAMP NOT NULL COMMENT '过期时间',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP NULL COMMENT '撤销时间',
    INDEX idx_user_id (user_id),
    INDEX idx_token_hash (token_hash),
    INDEX idx_expires_at (expires_at),
    CONSTRAINT fk_refresh_token_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='刷新令牌表';

-- ============================================
-- 4. 创建登录尝试记录表 (login_attempts)
-- ============================================
CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL COMMENT '尝试的用户名',
    ip_address VARCHAR(45) NOT NULL COMMENT 'IP地址',
    success TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否成功',
    user_agent TEXT COMMENT '浏览器信息',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_ip_address (ip_address),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='登录尝试记录表';

-- ============================================
-- 5. 插入默认管理员账户
-- 密码: admin123 (bcrypt哈希)
-- 生产环境请立即修改此密码!
-- ============================================
INSERT INTO users (username, password_hash, role, status, display_name)
VALUES ('admin', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', 'admin', 'active', '系统管理员')
ON DUPLICATE KEY UPDATE username = username;

-- 输出完成信息
SELECT '迁移 001 完成: 用户认证表已创建' AS status;
SELECT '默认管理员账户: admin / admin123 (请立即修改密码!)' AS warning;
