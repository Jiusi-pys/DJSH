-- 添加客户更多联系方式字段
USE djsh_finance_db;

ALTER TABLE contacts
    ADD COLUMN wechat VARCHAR(50) COMMENT '微信号' AFTER phone,
    ADD COLUMN qq VARCHAR(20) COMMENT 'QQ号' AFTER wechat,
    ADD COLUMN contact_person VARCHAR(50) COMMENT '联系人' AFTER name,
    ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1 COMMENT '是否启用: 0-停用, 1-启用' AFTER contact_type,
    DROP COLUMN email;

SELECT '已添加新字段: wechat, qq, contact_person, is_active，已移除 email' AS status;
