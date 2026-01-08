-- 清空数据库所有表数据
SET FOREIGN_KEY_CHECKS = 0;

TRUNCATE TABLE order_items;
TRUNCATE TABLE order_images;
TRUNCATE TABLE cash_transactions;
TRUNCATE TABLE scan_jobs;
TRUNCATE TABLE orders;
TRUNCATE TABLE products;
TRUNCATE TABLE contacts;

SET FOREIGN_KEY_CHECKS = 1;

SELECT '数据库已清空！' AS status;
