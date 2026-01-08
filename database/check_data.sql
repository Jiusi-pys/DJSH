-- 检查数据库数据
USE djsh_finance_db;

SELECT '=== 数据库表统计 ===' as info;

SELECT 'Contacts (客户/供应商)' as table_name, COUNT(*) as count FROM contacts WHERE deleted_at IS NULL
UNION ALL
SELECT 'Products (产品)' as table_name, COUNT(*) as count FROM products WHERE deleted_at IS NULL
UNION ALL
SELECT 'Orders (订单)' as table_name, COUNT(*) as count FROM orders WHERE deleted_at IS NULL
UNION ALL
SELECT 'Order Items (订单明细)' as table_name, COUNT(*) as count FROM order_items;

SELECT '=== 订单详情 ===' as info;
SELECT id, order_no, order_type, contact_id, total_amount, manual_verified FROM orders LIMIT 10;
