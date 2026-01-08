-- 为 contacts 表添加扩展字段
-- 执行时间: 2024-XX-XX

USE djsh_finance_db;

-- 添加扩展字段
ALTER TABLE contacts
ADD COLUMN contact_person VARCHAR(50) NULL COMMENT '联系人' AFTER name;

ALTER TABLE contacts
ADD COLUMN wechat VARCHAR(50) NULL COMMENT '微信' AFTER contact_person;

ALTER TABLE contacts
ADD COLUMN qq VARCHAR(20) NULL COMMENT 'QQ' AFTER wechat;

SELECT '已添加 contact_person, wechat, qq 字段' AS status;
