// 财务管理系统后端 API 服务
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const https = require('https');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const { loggerMiddleware, logOperation, logError } = require('./middleware/logger');
const { getPool } = require('./config/database');
const { authenticate, requirePermission, optionalAuth } = require('./middleware/auth');
const { PERMISSIONS } = require('./utils/permissions');
const initAuthRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 8080;

// CORS 配置 (支持带凭证的请求)
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://192.168.8.105:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如移动端应用或 curl）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('CORS blocked origin:', origin);
      callback(null, true); // 开发环境暂时允许所有来源
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

// 中间件
app.use(cors(corsOptions));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' })); // 增加JSON大小限制以支持base64图片
app.use(loggerMiddleware); // 自动记录所有请求

// 认证路由 (不需要认证)
app.use('/auth', initAuthRoutes(getPool(), logOperation));

// 辅助函数：处理查询结果中的 deleted_at
function filterDeleted(rows) {
    return rows.filter(row => !row.deleted_at);
}

// ============================================
// Lookups API
// ============================================

// GET /lookups/version
app.get('/lookups/version', async (req, res) => {
    try {
        const [rows] = await getPool().query('SELECT NOW() as version');
        res.json({ version: new Date(rows[0].version).toISOString() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /lookups/products
app.get('/lookups/products', async (req, res) => {
    try {
        const [rows] = await getPool().query(
            'SELECT id as product_id, name, spec, unit, is_disabled FROM products WHERE deleted_at IS NULL'
        );
        const items = rows.map(row => ({
            key: { product_id: row.product_id },
            display: { name: row.name, spec: row.spec, default_unit: row.unit, is_disabled: row.is_disabled === 1 }
        }));
        res.json({ version: new Date().toISOString(), items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /lookups/contacts
app.get('/lookups/contacts', async (req, res) => {
    try {
        const [rows] = await getPool().query(
            'SELECT id as contact_id, name, contact_person, phone, wechat, qq, is_disabled FROM contacts WHERE deleted_at IS NULL'
        );
        const items = rows.map(row => ({
            key: { contact_id: row.contact_id },
            display: {
                name: row.name,
                contact_person: row.contact_person,
                phone: row.phone,
                wechat: row.wechat,
                qq: row.qq,
                is_disabled: row.is_disabled === 1
            }
        }));
        res.json({ version: new Date().toISOString(), items });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Orders API
// ============================================

// GET /orders/:type
app.get('/orders/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { manual_verified, auto_verified, settled, q, date_from, date_to, page = 1, page_size = 20 } = req.query;

        if (!['sales', 'purchase'].includes(type)) {
            return res.status(400).json({ error: 'Invalid order type' });
        }

        let sql = `
            SELECT o.*, c.name as contact_name,
                   (SELECT COUNT(*) FROM order_images WHERE order_id = o.id) as image_count
            FROM orders o
            LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
            WHERE o.deleted_at IS NULL AND o.order_type = ?
        `;
        const params = [type];

        if (manual_verified !== undefined) {
            sql += ' AND o.manual_verified = ?';
            params.push(manual_verified === 'true' ? 1 : 0);
        }
        if (auto_verified !== undefined) {
            sql += ' AND o.auto_verified = ?';
            params.push(auto_verified === 'true' ? 1 : 0);
        }
        if (settled !== undefined) {
            sql += ' AND o.settled = ?';
            params.push(settled === 'true' ? 1 : 0);
        }
        if (q) {
            sql += ' AND (o.order_no LIKE ? OR c.name LIKE ?)';
            params.push(`%${q}%`, `%${q}%`);
        }
        if (date_from) {
            sql += ' AND o.order_date >= ?';
            params.push(date_from);
        }
        if (date_to) {
            sql += ' AND o.order_date <= ?';
            params.push(date_to);
        }

        // 获取总数
        const countSql = `SELECT COUNT(*) as total FROM (${sql.replace(/ORDER BY.*$/i, '')}) as sub`;
        const [countResult] = await getPool().query(countSql, params);
        const total = countResult[0]?.total || 0;

        // 添加排序和分页
        sql += ' ORDER BY o.order_date DESC, o.created_at DESC LIMIT ? OFFSET ?';
        const offset = (page - 1) * page_size;
        params.push(parseInt(page_size), parseInt(offset));

        const [rows] = await getPool().query(sql, params);

        const items = rows.map(row => ({
            key: { order_id: row.id, order_type: row.order_type },
            display: {
                order_no: row.order_no,
                contact_name: row.contact_name || '',
                order_date: row.order_date ? row.order_date.toISOString().split('T')[0] : '',
                total_amount: parseFloat(row.total_amount) || 0,
                manual_verified: row.manual_verified === 1,
                auto_verified: row.auto_verified === 1,
                settled: row.settled === 1,
                issue_tags: row.issues ? JSON.parse(row.issues).map(i => i.code) : [],
                image_count: row.image_count || 0
            }
        }));

        res.json({
            page: parseInt(page),
            page_size: parseInt(page_size),
            total,
            items
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /orders/:type/:order_id
app.get('/orders/:type/:order_id', async (req, res) => {
    try {
        const { type, order_id } = req.params;

        // 获取订单
        const [orders] = await getPool().query(
            `SELECT o.*, c.name as contact_name, c.phone as contact_phone
             FROM orders o
             LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
             WHERE o.id = ? AND o.deleted_at IS NULL`,
            [order_id]
        );

        if (orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        // 获取订单明细
        const [items] = await getPool().query(
            `SELECT oi.*, p.name as product_name, p.spec as product_spec
             FROM order_items oi
             LEFT JOIN products p ON oi.product_id = p.id AND p.deleted_at IS NULL
             WHERE oi.order_id = ?`,
            [order_id]
        );

        // 获取图片
        const [images] = await getPool().query(
            'SELECT id as image_id, mime_type, image_data FROM order_images WHERE order_id = ?',
            [order_id]
        );

        const orderItems = items.map(item => ({
            key: { item_id: item.id, product_id: item.product_id || null },
            display: {
                product_name: item.product_name || null,
                product_name_raw: item.product_name_raw || null,
                unit: item.unit,
                unit_price: parseFloat(item.unit_price) || 0,
                quantity: parseFloat(item.quantity) || 0,
                line_total: parseFloat(item.line_total) || 0
            }
        }));

        const orderImages = images.map(img => ({
            key: { image_id: img.image_id },
            display: { mime_type: img.mime_type, base64: img.image_data || '' }
        }));

        const contactLookup = order.contact_id ? {
            key: { contact_id: order.contact_id },
            display: { name: order.contact_name, phone: order.contact_phone }
        } : null;

        res.json({
            key: { order_id: order.id, order_type: order.order_type, version: order.version },
            display: {
                order_no: order.order_no,
                contact: contactLookup,
                order_date: order.order_date ? order.order_date.toISOString().split('T')[0] : '',
                manual_verified: order.manual_verified === 1,
                auto_verified: order.auto_verified === 1,
                settled: order.settled === 1,
                total_amount: parseFloat(order.total_amount) || 0,
                remark: order.remark || '',
                issues: order.issues ? JSON.parse(order.issues) : [],
                images: orderImages,
                items: orderItems
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /orders/:type/:order_id
app.put('/orders/:type/:order_id', async (req, res) => {
    const connection = await getPool().getConnection();
    try {
        const { type, order_id } = req.params;
        const { version, order_no, contact_id, contact_name_raw, order_date, remark, items } = req.body;

        await connection.beginTransaction();

        // 查询原始数据用于日志
        const [oldOrders] = await connection.query('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [order_id]);
        const [oldItems] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [order_id]);
        const oldData = { order: oldOrders[0], items: oldItems };

        // 检查版本
        if (oldOrders.length === 0 || oldOrders[0].version !== version) {
            await connection.rollback();
            return res.status(409).json({ error: 'Version mismatch' });
        }

        // 更新订单
        await connection.query(
            `UPDATE orders SET
                order_no = ?,
                contact_id = ?,
                order_date = ?,
                remark = ?,
                version = version + 1,
                updated_at = NOW()
             WHERE id = ?`,
            [order_no || null, contact_id || null, order_date, remark || '', order_id]
        );

        // 更新订单总金额
        const totalAmount = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
        await connection.query('UPDATE orders SET total_amount = ? WHERE id = ?', [totalAmount, order_id]);

        // 更新订单明细
        for (const item of items) {
            if (item.item_id) {
                await connection.query(
                    `UPDATE order_items SET
                        product_id = ?,
                        product_name_raw = ?,
                        unit = ?,
                        unit_price = ?,
                        quantity = ?,
                        line_total = ?
                     WHERE id = ?`,
                    [
                        item.product_id || null,
                        item.product_name_raw || null,
                        item.unit,
                        item.unit_price,
                        item.quantity,
                        item.unit_price * item.quantity,
                        item.item_id
                    ]
                );
            }
        }

        await connection.commit();

        // 返回更新后的订单
        // 重新查询返回结果
        const [updatedOrders] = await connection.query(
            `SELECT o.*, c.name as contact_name, c.phone as contact_phone
             FROM orders o
             LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
             WHERE o.id = ?`,
            [order_id]
        );
        const [updatedItems] = await connection.query(
            'SELECT * FROM order_items WHERE order_id = ?',
            [order_id]
        );
        const [updatedImages] = await connection.query(
            'SELECT id as image_id, mime_type, image_data FROM order_images WHERE order_id = ?',
            [order_id]
        );

        // 记录更新日志
        await logOperation({
            module: 'orders',
            action: 'update',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: order_no || oldOrders[0].order_no,
            oldData: oldData,
            newData: { order: updatedOrders[0], items: updatedItems },
            req
        });

        const orderItems = updatedItems.map(item => ({
            key: { item_id: item.id, product_id: item.product_id || null },
            display: {
                product_name: null,
                product_name_raw: item.product_name_raw || null,
                unit: item.unit,
                unit_price: parseFloat(item.unit_price) || 0,
                quantity: parseFloat(item.quantity) || 0,
                line_total: parseFloat(item.line_total) || 0
            }
        }));

        const orderImages = updatedImages.map(img => ({
            key: { image_id: img.image_id },
            display: { mime_type: img.mime_type, base64: img.image_data || '' }
        }));

        const contactLookup = updatedOrders[0].contact_id ? {
            key: { contact_id: updatedOrders[0].contact_id },
            display: { name: updatedOrders[0].contact_name, phone: updatedOrders[0].contact_phone }
        } : null;

        res.json({
            key: { order_id: updatedOrders[0].id, order_type: updatedOrders[0].order_type, version: updatedOrders[0].version + 1 },
            display: {
                order_no: updatedOrders[0].order_no,
                contact: contactLookup,
                order_date: updatedOrders[0].order_date ? updatedOrders[0].order_date.toISOString().split('T')[0] : '',
                manual_verified: updatedOrders[0].manual_verified === 1,
                auto_verified: updatedOrders[0].auto_verified === 1,
                settled: updatedOrders[0].settled === 1,
                total_amount: parseFloat(updatedOrders[0].total_amount) || 0,
                remark: updatedOrders[0].remark || '',
                issues: [],
                images: orderImages,
                items: orderItems
            }
        });
    } catch (error) {
        await connection.rollback();
        await logError({
            module: 'orders',
            action: 'update',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    } finally {
        connection.release();
    }
});

// POST /orders/:type/:order_id/verify
app.post('/orders/:type/:order_id/verify', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { version } = req.body;

        // 查询原始数据
        const [oldData] = await getPool().query('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [order_id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const [result] = await getPool().query(
            `UPDATE orders SET manual_verified = 1, version = version + 1
             WHERE id = ? AND version = ? AND deleted_at IS NULL`,
            [order_id, version]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({ error: 'Version mismatch or order not found' });
        }

        // 查询更新后的数据
        const [newData] = await getPool().query('SELECT * FROM orders WHERE id = ?', [order_id]);

        // 记录验证日志
        await logOperation({
            module: 'orders',
            action: 'verify',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: oldData[0].order_no,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'orders',
            action: 'verify',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /orders/:type/:order_id/cancel - 废弃订单
app.post('/orders/:type/:order_id/cancel', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { version, reason } = req.body;

        // 查询原始数据
        const [oldData] = await getPool().query('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [order_id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const [result] = await getPool().query(
            `UPDATE orders SET cancelled = 1, cancelled_reason = ?, cancelled_at = NOW(), version = version + 1
             WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 0`,
            [reason || '订单废弃', order_id, version]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({ error: 'Version mismatch, order not found, or already cancelled' });
        }

        // 查询更新后的数据
        const [newData] = await getPool().query('SELECT * FROM orders WHERE id = ?', [order_id]);

        // 记录废弃日志
        await logOperation({
            module: 'orders',
            action: 'cancel',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: oldData[0].order_no,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'orders',
            action: 'cancel',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /orders/:type/:order_id/restore - 恢复订单
app.post('/orders/:type/:order_id/restore', async (req, res) => {
    try {
        const { order_id } = req.params;
        const { version } = req.body;

        // 查询原始数据
        const [oldData] = await getPool().query('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [order_id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const [result] = await getPool().query(
            `UPDATE orders SET cancelled = 0, cancelled_reason = NULL, cancelled_at = NULL, version = version + 1
             WHERE id = ? AND version = ? AND deleted_at IS NULL AND cancelled = 1`,
            [order_id, version]
        );

        if (result.affectedRows === 0) {
            return res.status(409).json({ error: 'Version mismatch, order not found, or not cancelled' });
        }

        // 查询更新后的数据
        const [newData] = await getPool().query('SELECT * FROM orders WHERE id = ?', [order_id]);

        // 记录恢复日志
        await logOperation({
            module: 'orders',
            action: 'restore',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: oldData[0].order_no,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'orders',
            action: 'restore',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /orders/:type/:order_id/images - 上传订单图片（base64存储）
app.post('/orders/:type/:order_id/images', async (req, res) => {
    try {
        const { type, order_id } = req.params;
        const { image_data, mime_type } = req.body;

        if (!image_data) {
            return res.status(400).json({ error: 'No image data' });
        }

        // 获取订单信息用于日志
        const [orderInfo] = await getPool().query('SELECT order_no FROM orders WHERE id = ?', [order_id]);
        const orderNo = orderInfo[0]?.order_no || `order_${order_id}`;

        // 提取base64数据部分（去掉data:image/xxx;base64,前缀）
        const base64Data = image_data.includes(',') ? image_data.split(',')[1] : image_data;

        // 生成一个占位的 image_path（因为我们使用 base64 存储，不需要实际路径）
        const imagePath = `base64_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const [result] = await getPool().query(
            `INSERT INTO order_images (order_id, mime_type, image_data, image_path)
             VALUES (?, ?, ?, ?)`,
            [order_id, mime_type || 'image/jpeg', base64Data, imagePath]
        );

        // 记录图片上传日志（不记录base64数据，太大）
        await logOperation({
            module: 'orders',
            action: 'upload_image',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: orderNo,
            newData: {
                image_id: result.insertId,
                order_id: parseInt(order_id),
                mime_type: mime_type || 'image/jpeg'
            },
            req
        });

        res.status(201).json({
            key: { image_id: result.insertId },
            display: {
                mime_type: mime_type || 'image/jpeg',
                base64: base64Data
            }
        });
    } catch (error) {
        console.error('Image upload error:', error);
        await logError({
            module: 'orders',
            action: 'upload_image',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// GET /orders/:type/:order_id/images - 获取订单图片列表
app.get('/orders/:type/:order_id/images', async (req, res) => {
    try {
        const { order_id } = req.params;

        const [images] = await getPool().query(
            'SELECT id as image_id, mime_type, image_data FROM order_images WHERE order_id = ?',
            [order_id]
        );

        res.json({
            items: images.map(img => ({
                key: { image_id: img.image_id },
                display: {
                    mime_type: img.mime_type,
                    base64: img.image_data || ''
                }
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /orders/:type/:order_id/images/:image_id - 删除订单图片
app.delete('/orders/:type/:order_id/images/:image_id', async (req, res) => {
    try {
        const { order_id, image_id } = req.params;

        // 查询要删除的图片完整信息（包含base64数据，以便日志恢复）
        const [oldData] = await getPool().query(
            'SELECT id, order_id, mime_type, image_data, image_path FROM order_images WHERE id = ?',
            [image_id]
        );
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Image not found' });
        }

        // 获取订单信息用于日志
        const [orderInfo] = await getPool().query('SELECT order_no FROM orders WHERE id = ?', [order_id]);
        const orderNo = orderInfo[0]?.order_no || `order_${order_id}`;

        const [result] = await getPool().query('DELETE FROM order_images WHERE id = ?', [image_id]);

        // 记录图片删除日志（包含完整数据以便恢复）
        await logOperation({
            module: 'orders',
            action: 'delete_image',
            targetType: 'order',
            targetId: parseInt(order_id),
            targetName: orderNo,
            oldData: {
                image_id: parseInt(image_id),
                order_id: oldData[0].order_id,
                mime_type: oldData[0].mime_type,
                image_data: oldData[0].image_data,  // 保存base64数据以便恢复
                image_path: oldData[0].image_path
            },
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'orders',
            action: 'delete_image',
            targetId: parseInt(req.params.order_id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Cash Transactions API
// ============================================

// GET /cash/transactions
app.get('/cash/transactions', async (req, res) => {
    try {
        const { type, date_from, date_to, page = 1, page_size = 20 } = req.query;

        let sql = `
            SELECT ct.*, c.name as contact_name
            FROM cash_transactions ct
            LEFT JOIN contacts c ON ct.contact_id = c.id AND c.deleted_at IS NULL
            WHERE ct.deleted_at IS NULL
        `;
        const params = [];

        if (type) {
            sql += ' AND ct.trans_type = ?';
            params.push(type);
        }
        if (date_from) {
            sql += ' AND ct.trans_date >= ?';
            params.push(date_from);
        }
        if (date_to) {
            sql += ' AND ct.trans_date <= ?';
            params.push(date_to);
        }

        // 获取总数
        const countSql = sql.replace('SELECT ct.*, c.name as contact_name', 'SELECT COUNT(*) as total');
        const [countResult] = await getPool().query(countSql, params);
        const total = countResult[0].total;

        // 添加排序和分页
        sql += ' ORDER BY ct.trans_date DESC, ct.created_at DESC LIMIT ? OFFSET ?';
        const offset = (page - 1) * page_size;
        params.push(parseInt(page_size), parseInt(offset));

        const [rows] = await getPool().query(sql, params);

        const items = rows.map(row => ({
            key: { transaction_id: row.id },
            display: {
                trans_date: row.trans_date ? row.trans_date.toISOString().split('T')[0] : '',
                trans_type: row.trans_type,
                amount: parseFloat(row.amount) || 0,
                category: row.category || '',
                contact_name: row.contact_name || '',
                remark: row.remark || '',
            }
        }));

        res.json({
            page: parseInt(page),
            page_size: parseInt(page_size),
            total,
            items
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /cash/transactions
app.post('/cash/transactions', async (req, res) => {
    try {
        const { trans_type, amount, category, trans_date, contact_id, remark } = req.body;

        const [result] = await getPool().query(
            `INSERT INTO cash_transactions (trans_type, amount, category, trans_date, contact_id, remark)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [trans_type, amount || 0, category || null, trans_date || new Date().toISOString().split('T')[0], contact_id || null, remark || null]
        );

        const [newTx] = await getPool().query(
            'SELECT * FROM cash_transactions WHERE id = ?',
            [result.insertId]
        );

        // 记录创建日志
        const transName = `${trans_type === 'income' ? '收入' : '支出'} ¥${amount || 0}`;
        await logOperation({
            module: 'cash',
            action: 'create',
            targetType: 'transaction',
            targetId: result.insertId,
            targetName: transName,
            newData: newTx[0],
            req
        });

        res.status(201).json({
            key: { transaction_id: newTx[0].id },
            display: {
                trans_date: newTx[0].trans_date ? newTx[0].trans_date.toISOString().split('T')[0] : '',
                trans_type: newTx[0].trans_type,
                amount: parseFloat(newTx[0].amount) || 0,
                category: newTx[0].category || '',
                contact_name: '',
                remark: newTx[0].remark || '',
            }
        });
    } catch (error) {
        await logError({
            module: 'cash',
            action: 'create',
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// GET /dashboard/stats
app.get('/dashboard/stats', async (req, res) => {
    try {
        // 今日销售
        const [todaySales] = await getPool().query(`
            SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
            FROM orders
            WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
            AND DATE(order_date) = CURDATE()
        `);

        // 昨日销售
        const [yesterdaySales] = await getPool().query(`
            SELECT COALESCE(SUM(total_amount), 0) as amount
            FROM orders
            WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
            AND DATE(order_date) = DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        `);

        // 本月销售统计
        const [monthSales] = await getPool().query(`
            SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
            FROM orders
            WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
            AND YEAR(order_date) = YEAR(CURDATE()) AND MONTH(order_date) = MONTH(CURDATE())
        `);

        // 上月销售
        const [lastMonthSales] = await getPool().query(`
            SELECT COALESCE(SUM(total_amount), 0) as amount
            FROM orders
            WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
            AND YEAR(order_date) = YEAR(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
            AND MONTH(order_date) = MONTH(DATE_SUB(CURDATE(), INTERVAL 1 MONTH))
        `);

        // 本月采购统计
        const [monthPurchase] = await getPool().query(`
            SELECT COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
            FROM orders
            WHERE order_type = 'purchase' AND deleted_at IS NULL AND cancelled = 0
            AND YEAR(order_date) = YEAR(CURDATE()) AND MONTH(order_date) = MONTH(CURDATE())
        `);

        // 订单状态统计
        const [orderStats] = await getPool().query(`
            SELECT
                SUM(CASE WHEN manual_verified = 0 AND cancelled = 0 THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN manual_verified = 1 AND cancelled = 0 THEN 1 ELSE 0 END) as verified,
                SUM(CASE WHEN cancelled = 1 THEN 1 ELSE 0 END) as cancelled
            FROM orders
            WHERE deleted_at IS NULL
        `);

        // 现金流统计（本月）
        const [cashFlow] = await getPool().query(`
            SELECT
                COALESCE(SUM(CASE WHEN trans_type = 'income' THEN amount ELSE 0 END), 0) as income,
                COALESCE(SUM(CASE WHEN trans_type = 'expense' THEN amount ELSE 0 END), 0) as expense
            FROM cash_transactions
            WHERE YEAR(trans_date) = YEAR(CURDATE()) AND MONTH(trans_date) = MONTH(CURDATE())
        `);

        // 客户数
        const [customerCount] = await getPool().query(`
            SELECT COUNT(*) as count
            FROM contacts
            WHERE deleted_at IS NULL AND contact_type IN ('customer', 'both')
        `);

        // 商品数
        const [productCount] = await getPool().query(`
            SELECT COUNT(*) as count
            FROM products
            WHERE deleted_at IS NULL
        `);

        // 近7天销售趋势
        const [salesTrend] = await getPool().query(`
            SELECT DATE(order_date) as date, COALESCE(SUM(total_amount), 0) as amount, COUNT(*) as count
            FROM orders
            WHERE order_type = 'sales' AND deleted_at IS NULL AND cancelled = 0
            AND order_date >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
            GROUP BY DATE(order_date)
            ORDER BY date ASC
        `);

        // 热销产品Top5（本月）
        const [topProducts] = await getPool().query(`
            SELECT p.name, SUM(oi.quantity) as total_quantity, SUM(oi.line_total) as total_amount
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            JOIN products p ON oi.product_id = p.id
            WHERE o.order_type = 'sales' AND o.deleted_at IS NULL AND o.cancelled = 0
            AND YEAR(o.order_date) = YEAR(CURDATE()) AND MONTH(o.order_date) = MONTH(CURDATE())
            GROUP BY p.id, p.name
            ORDER BY total_amount DESC
            LIMIT 5
        `);

        // 客户贡献排行Top5（本月）
        const [topCustomers] = await getPool().query(`
            SELECT c.name, COUNT(o.id) as order_count, SUM(o.total_amount) as total_amount
            FROM orders o
            JOIN contacts c ON o.contact_id = c.id
            WHERE o.order_type = 'sales' AND o.deleted_at IS NULL AND o.cancelled = 0
            AND YEAR(o.order_date) = YEAR(CURDATE()) AND MONTH(o.order_date) = MONTH(CURDATE())
            GROUP BY c.id, c.name
            ORDER BY total_amount DESC
            LIMIT 5
        `);

        // 最近订单
        const [recentOrders] = await getPool().query(`
            SELECT o.*, c.name as contact_name
            FROM orders o
            LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
            WHERE o.deleted_at IS NULL
            ORDER BY o.created_at DESC
            LIMIT 5
        `);

        // 生成完整的7天数据（补齐没有数据的日期）
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().split('T')[0];
            const found = salesTrend.find(s => {
                const sDate = new Date(s.date).toISOString().split('T')[0];
                return sDate === dateStr;
            });
            last7Days.push({
                date: dateStr,
                amount: found ? parseFloat(found.amount) : 0,
                count: found ? found.count : 0
            });
        }

        res.json({
            // 今日数据
            todaySales: {
                amount: parseFloat(todaySales[0]?.amount) || 0,
                count: todaySales[0]?.count || 0
            },
            yesterdaySales: parseFloat(yesterdaySales[0]?.amount) || 0,

            // 本月数据
            monthSales: {
                amount: parseFloat(monthSales[0]?.amount) || 0,
                count: monthSales[0]?.count || 0
            },
            lastMonthSales: parseFloat(lastMonthSales[0]?.amount) || 0,
            monthPurchase: {
                amount: parseFloat(monthPurchase[0]?.amount) || 0,
                count: monthPurchase[0]?.count || 0
            },

            // 订单状态
            orderStats: {
                pending: orderStats[0]?.pending || 0,
                verified: orderStats[0]?.verified || 0,
                cancelled: orderStats[0]?.cancelled || 0
            },

            // 现金流
            cashFlow: {
                income: parseFloat(cashFlow[0]?.income) || 0,
                expense: parseFloat(cashFlow[0]?.expense) || 0,
                net: (parseFloat(cashFlow[0]?.income) || 0) - (parseFloat(cashFlow[0]?.expense) || 0)
            },

            // 基础统计
            totalCustomers: customerCount[0]?.count || 0,
            totalProducts: productCount[0]?.count || 0,

            // 趋势和排行
            salesTrend: last7Days,
            topProducts: topProducts.map(p => ({
                name: p.name,
                quantity: parseFloat(p.total_quantity) || 0,
                amount: parseFloat(p.total_amount) || 0
            })),
            topCustomers: topCustomers.map(c => ({
                name: c.name,
                orderCount: c.order_count || 0,
                amount: parseFloat(c.total_amount) || 0
            })),

            // 最近订单
            recentOrders: recentOrders.map(o => ({
                key: { order_id: o.id, order_type: o.order_type },
                display: {
                    order_no: o.order_no,
                    contact_name: o.contact_name || '',
                    total_amount: parseFloat(o.total_amount) || 0,
                    manual_verified: o.manual_verified === 1,
                    auto_verified: o.auto_verified === 1,
                    cancelled: o.cancelled === 1,
                    order_date: o.order_date ? o.order_date.toISOString().split('T')[0] : '',
                }
            }))
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Contacts API
// ============================================

// POST /contacts
app.post('/contacts', async (req, res) => {
    try {
        const {
            name, contact_person, phone, wechat, qq,
            address, contact_type, balance, remark
        } = req.body;

        const [result] = await getPool().query(
            `INSERT INTO contacts (name, contact_person, phone, wechat, qq, address, contact_type, balance, remark)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                name, contact_person || null, phone || null, wechat || null, qq || null,
                address || null, contact_type || 'customer', balance || 0, remark || null
            ]
        );

        const [newContact] = await getPool().query(
            'SELECT * FROM contacts WHERE id = ?',
            [result.insertId]
        );

        // 记录创建日志
        await logOperation({
            module: 'contacts',
            action: 'create',
            targetType: 'contact',
            targetId: result.insertId,
            targetName: name,
            newData: newContact[0],
            req
        });

        res.status(201).json({
            key: { contact_id: newContact[0].id },
            display: {
                name: newContact[0].name,
                contact_person: newContact[0].contact_person,
                phone: newContact[0].phone,
                wechat: newContact[0].wechat,
                qq: newContact[0].qq
            }
        });
    } catch (error) {
        await logError({
            module: 'contacts',
            action: 'create',
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// PUT /contacts/:id
app.put('/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, contact_person, phone, wechat, qq } = req.body;

        // 先查询原始数据
        const [oldData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        const [result] = await getPool().query(
            `UPDATE contacts SET name = ?, contact_person = ?, phone = ?, wechat = ?, qq = ? WHERE id = ?`,
            [name, contact_person || null, phone || null, wechat || null, qq || null, id]
        );

        const [updatedContact] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);

        // 记录更新日志
        await logOperation({
            module: 'contacts',
            action: 'update',
            targetType: 'contact',
            targetId: parseInt(id),
            targetName: name,
            oldData: oldData[0],
            newData: updatedContact[0],
            req
        });

        res.json({
            key: { contact_id: updatedContact[0].id },
            display: {
                name: updatedContact[0].name,
                contact_person: updatedContact[0].contact_person,
                phone: updatedContact[0].phone,
                wechat: updatedContact[0].wechat,
                qq: updatedContact[0].qq
            }
        });
    } catch (error) {
        await logError({
            module: 'contacts',
            action: 'update',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// PUT /products/:id
app.put('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { name, spec, unit, unit_price, category } = req.body;

        // 先查询原始数据
        const [oldData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const [result] = await getPool().query(
            `UPDATE products SET name = ?, spec = ?, unit = ?, unit_price = ?, category = ? WHERE id = ?`,
            [name, spec || null, unit, unit_price || 0, category || null, id]
        );

        const [updatedProduct] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);

        // 记录更新日志
        await logOperation({
            module: 'products',
            action: 'update',
            targetType: 'product',
            targetId: parseInt(id),
            targetName: name,
            oldData: oldData[0],
            newData: updatedProduct[0],
            req
        });

        res.json({
            key: { product_id: updatedProduct[0].id },
            display: {
                name: updatedProduct[0].name,
                spec: updatedProduct[0].spec,
                default_unit: updatedProduct[0].unit,
                unit_price: parseFloat(updatedProduct[0].unit_price) || 0,
                category: updatedProduct[0].category
            }
        });
    } catch (error) {
        await logError({
            module: 'products',
            action: 'update',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// DELETE /products/:id (真删除)
app.delete('/products/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 先查询要删除的数据
        const [oldData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const [result] = await getPool().query('DELETE FROM products WHERE id = ?', [id]);

        // 记录删除日志
        await logOperation({
            module: 'products',
            action: 'delete',
            targetType: 'product',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'products',
            action: 'delete',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /products/:id/disable - 废除产品
app.post('/products/:id/disable', async (req, res) => {
    try {
        const { id } = req.params;

        const [oldData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (oldData[0].is_disabled) {
            return res.status(400).json({ error: '该产品已被废除' });
        }

        await getPool().query('UPDATE products SET is_disabled = 1 WHERE id = ?', [id]);

        const [newData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);

        await logOperation({
            module: 'products',
            action: 'cancel',
            targetType: 'product',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true, message: '产品已废除' });
    } catch (error) {
        await logError({
            module: 'products',
            action: 'cancel',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /products/:id/enable - 恢复产品
app.post('/products/:id/enable', async (req, res) => {
    try {
        const { id } = req.params;

        const [oldData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Product not found' });
        }

        if (!oldData[0].is_disabled) {
            return res.status(400).json({ error: '该产品未被废除' });
        }

        await getPool().query('UPDATE products SET is_disabled = 0 WHERE id = ?', [id]);

        const [newData] = await getPool().query('SELECT * FROM products WHERE id = ?', [id]);

        await logOperation({
            module: 'products',
            action: 'restore',
            targetType: 'product',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true, message: '产品已恢复' });
    } catch (error) {
        await logError({
            module: 'products',
            action: 'restore',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// DELETE /contacts/:id (真删除)
app.delete('/contacts/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // 先查询要删除的数据
        const [oldData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        const [result] = await getPool().query('DELETE FROM contacts WHERE id = ?', [id]);

        // 记录删除日志
        await logOperation({
            module: 'contacts',
            action: 'delete',
            targetType: 'contact',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            req
        });

        res.json({ success: true });
    } catch (error) {
        await logError({
            module: 'contacts',
            action: 'delete',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /contacts/:id/disable - 废除客户
app.post('/contacts/:id/disable', async (req, res) => {
    try {
        const { id } = req.params;

        const [oldData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        if (oldData[0].is_disabled) {
            return res.status(400).json({ error: '该客户已被废除' });
        }

        await getPool().query('UPDATE contacts SET is_disabled = 1 WHERE id = ?', [id]);

        const [newData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);

        await logOperation({
            module: 'contacts',
            action: 'cancel',
            targetType: 'contact',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true, message: '客户已废除' });
    } catch (error) {
        await logError({
            module: 'contacts',
            action: 'cancel',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// POST /contacts/:id/enable - 恢复客户
app.post('/contacts/:id/enable', async (req, res) => {
    try {
        const { id } = req.params;

        const [oldData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);
        if (oldData.length === 0) {
            return res.status(404).json({ error: 'Contact not found' });
        }

        if (!oldData[0].is_disabled) {
            return res.status(400).json({ error: '该客户未被废除' });
        }

        await getPool().query('UPDATE contacts SET is_disabled = 0 WHERE id = ?', [id]);

        const [newData] = await getPool().query('SELECT * FROM contacts WHERE id = ?', [id]);

        await logOperation({
            module: 'contacts',
            action: 'restore',
            targetType: 'contact',
            targetId: parseInt(id),
            targetName: oldData[0].name,
            oldData: oldData[0],
            newData: newData[0],
            req
        });

        res.json({ success: true, message: '客户已恢复' });
    } catch (error) {
        await logError({
            module: 'contacts',
            action: 'restore',
            targetId: parseInt(req.params.id),
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Products API
// ============================================

// POST /products
app.post('/products', async (req, res) => {
    try {
        const { name, spec, unit, unit_price, category, remark } = req.body;

        const [result] = await getPool().query(
            `INSERT INTO products (name, spec, unit, unit_price, category, remark)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, spec || null, unit || '个', unit_price || 0, category || null, remark || null]
        );

        const [newProduct] = await getPool().query(
            'SELECT * FROM products WHERE id = ?',
            [result.insertId]
        );

        // 记录创建日志
        await logOperation({
            module: 'products',
            action: 'create',
            targetType: 'product',
            targetId: result.insertId,
            targetName: name,
            newData: newProduct[0],
            req
        });

        res.status(201).json({
            key: { product_id: newProduct[0].id },
            display: { name: newProduct[0].name, spec: newProduct[0].spec, default_unit: newProduct[0].unit }
        });
    } catch (error) {
        await logError({
            module: 'products',
            action: 'create',
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Orders API - Create
// ============================================

// POST /orders/:type
app.post('/orders/:type', async (req, res) => {
    try {
        const { type } = req.params;
        const { order_no, contact_id, order_date, remark, items } = req.body;

        if (!['sales', 'purchase'].includes(type)) {
            return res.status(400).json({ error: 'Invalid order type' });
        }

        // 检查客户是否已废除
        if (contact_id) {
            const [contact] = await getPool().query('SELECT id, name, is_disabled FROM contacts WHERE id = ?', [contact_id]);
            if (contact.length === 0) {
                return res.status(400).json({ error: '客户不存在' });
            }
            if (contact[0].is_disabled) {
                return res.status(400).json({ error: `客户 "${contact[0].name}" 已被废除，无法使用` });
            }
        }

        // 检查产品是否已废除
        if (items && items.length > 0) {
            const productIds = items.filter(i => i.product_id).map(i => i.product_id);
            if (productIds.length > 0) {
                const [products] = await getPool().query(
                    `SELECT id, name, is_disabled FROM products WHERE id IN (${productIds.map(() => '?').join(',')})`,
                    productIds
                );
                const disabledProducts = products.filter(p => p.is_disabled);
                if (disabledProducts.length > 0) {
                    const names = disabledProducts.map(p => p.name).join(', ');
                    return res.status(400).json({ error: `产品 "${names}" 已被废除，无法使用` });
                }
            }
        }

        // 订单号：优先使用用户输入的，否则自动生成
        let orderNo = order_no;
        if (!orderNo) {
            const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
            const [countResult] = await getPool().query(
                "SELECT COUNT(*) as cnt FROM orders WHERE order_no LIKE ?",
                [`${type === 'sales' ? 'SO' : 'PO'}-${dateStr}-%`]
            );
            const count = (countResult[0]?.cnt || 0) + 1;
            orderNo = `${type === 'sales' ? 'SO' : 'PO'}-${dateStr}-${String(count).padStart(3, '0')}`;
        }

        // 计算总金额
        const totalAmount = items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;

        // 插入订单
        const [orderResult] = await getPool().query(
            `INSERT INTO orders (order_no, order_type, contact_id, order_date, total_amount, remark, auto_verified, manual_verified)
             VALUES (?, ?, ?, ?, ?, ?, 0, 0)`,
            [orderNo, type, contact_id || null, order_date, totalAmount, remark || null]
        );

        const orderId = orderResult.insertId;

        // 插入订单明细
        if (items && items.length > 0) {
            for (const item of items) {
                await getPool().query(
                    `INSERT INTO order_items (order_id, product_id, product_name_raw, unit, unit_price, quantity, line_total)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [orderId, item.product_id || null, item.product_name_raw || null, item.unit, item.unit_price, item.quantity, item.unit_price * item.quantity]
                );
            }
        }

        // 查询完整的新订单数据用于日志
        const [newOrder] = await getPool().query('SELECT * FROM orders WHERE id = ?', [orderId]);
        const [newItems] = await getPool().query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

        // 记录创建日志
        await logOperation({
            module: 'orders',
            action: 'create',
            targetType: 'order',
            targetId: orderId,
            targetName: orderNo,
            newData: { order: newOrder[0], items: newItems },
            req
        });

        // 返回新订单
        res.status(201).json({
            key: { order_id: orderId, order_type: type, version: 1 },
            display: {
                order_no: orderNo,
                contact: null,
                order_date: order_date,
                manual_verified: false,
                auto_verified: false,
                settled: false,
                total_amount: totalAmount,
                remark: remark || '',
                issues: [],
                images: [],
                items: items?.map((item, index) => ({
                    key: { item_id: index + 1, product_id: item.product_id || null },
                    display: {
                        product_name: null,
                        product_name_raw: item.product_name_raw || null,
                        unit: item.unit,
                        unit_price: item.unit_price,
                        quantity: item.quantity,
                        line_total: item.unit_price * item.quantity
                    }
                })) || []
            }
        });
    } catch (error) {
        await logError({
            module: 'orders',
            action: 'create',
            errorMessage: error.message,
            req
        });
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// 日志 API
// ============================================

// GET /logs - 获取日志列表
app.get('/logs', async (req, res) => {
    try {
        const { module, action, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);

        let whereConditions = ['1=1'];
        const params = [];

        if (module) {
            whereConditions.push('module = ?');
            params.push(module);
        }
        if (action) {
            whereConditions.push('action = ?');
            params.push(action);
        }

        const whereClause = whereConditions.join(' AND ');
        params.push(parseInt(limit), offset);

        // 获取总数
        const [countResult] = await getPool().query(
            `SELECT COUNT(*) as total FROM operation_logs WHERE ${whereClause}`,
            params.slice(0, -2)
        );

        // 获取日志列表 (使用 id DESC 替代 created_at DESC 以避免排序内存问题)
        const [logs] = await getPool().query(
            `SELECT id, module, action, target_type, target_id, target_name, user_info,
                    request_method, request_path, ip_address, status, error_message,
                    duration_ms, created_at, old_data, new_data, is_undone
             FROM operation_logs
             WHERE ${whereClause}
             ORDER BY id DESC
             LIMIT ? OFFSET ?`,
            params
        );

        res.json({
            items: logs.map(log => ({
                key: { log_id: log.id },
                display: {
                    module: log.module,
                    action: log.action,
                    target_type: log.target_type,
                    target_id: log.target_id,
                    target_name: log.target_name,
                    user_info: log.user_info,
                    request_method: log.request_method,
                    request_path: log.request_path,
                    ip_address: log.ip_address,
                    status: log.status,
                    error_message: log.error_message,
                    duration_ms: log.duration_ms,
                    created_at: log.created_at,
                    old_data: log.old_data ? (typeof log.old_data === 'string' ? JSON.parse(log.old_data) : log.old_data) : null,
                    new_data: log.new_data ? (typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data) : null,
                    is_undone: !!log.is_undone
                }
            })),
            total: countResult[0].total,
            page: parseInt(page),
            limit: parseInt(limit)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /logs/modules - 获取模块列表
app.get('/logs/modules', async (req, res) => {
    try {
        const [modules] = await getPool().query(
            'SELECT DISTINCT module as value, module as label FROM operation_logs ORDER BY module'
        );
        res.json(modules);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /logs/actions - 获取操作类型列表
app.get('/logs/actions', async (req, res) => {
    try {
        const [actions] = await getPool().query(
            'SELECT DISTINCT action as value, action as label FROM operation_logs ORDER BY action'
        );
        res.json(actions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /logs/:log_id/undo - 撤销操作
app.post('/logs/:log_id/undo', async (req, res) => {
    const { log_id } = req.params;

    try {
        // 获取日志记录
        const [logs] = await getPool().query(
            'SELECT * FROM operation_logs WHERE id = ?',
            [log_id]
        );

        if (logs.length === 0) {
            return res.status(404).json({ error: '日志记录不存在' });
        }

        const log = logs[0];
        const oldData = log.old_data ? (typeof log.old_data === 'string' ? JSON.parse(log.old_data) : log.old_data) : null;
        const newData = log.new_data ? (typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data) : null;

        let result = { success: false, message: '' };

        switch (log.module) {
            case 'contacts':
                result = await undoContactOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'products':
                result = await undoProductOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'orders':
                result = await undoOrderOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'cash':
                result = await undoCashOperation(log.action, log.target_id, oldData, newData);
                break;
            default:
                return res.status(400).json({ error: `不支持撤销 ${log.module} 模块的操作` });
        }

        if (result.success) {
            // 标记该日志为已撤销
            await getPool().query('UPDATE operation_logs SET is_undone = 1 WHERE id = ?', [log_id]);

            // 记录撤销操作日志
            await logOperation({
                module: 'logs',
                action: 'undo',
                targetType: log.module,
                targetId: log.target_id,
                targetName: log.target_name,
                oldData: { original_log_id: parseInt(log_id), original_action: log.action },
                newData: result.data || null,
                req
            });
            res.json({ success: true, message: result.message, data: result.data });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST /logs/:log_id/redo - 重做操作
app.post('/logs/:log_id/redo', async (req, res) => {
    const { log_id } = req.params;

    try {
        // 获取日志记录
        const [logs] = await getPool().query(
            'SELECT * FROM operation_logs WHERE id = ?',
            [log_id]
        );

        if (logs.length === 0) {
            return res.status(404).json({ error: '日志记录不存在' });
        }

        const log = logs[0];
        const oldData = log.old_data ? (typeof log.old_data === 'string' ? JSON.parse(log.old_data) : log.old_data) : null;
        const newData = log.new_data ? (typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data) : null;

        let result = { success: false, message: '' };

        switch (log.module) {
            case 'contacts':
                result = await redoContactOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'products':
                result = await redoProductOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'orders':
                result = await redoOrderOperation(log.action, log.target_id, oldData, newData);
                break;
            case 'cash':
                result = await redoCashOperation(log.action, log.target_id, oldData, newData);
                break;
            default:
                return res.status(400).json({ error: `不支持重做 ${log.module} 模块的操作` });
        }

        if (result.success) {
            // 标记该日志为未撤销（已重做）
            await getPool().query('UPDATE operation_logs SET is_undone = 0 WHERE id = ?', [log_id]);

            // 记录重做操作日志
            await logOperation({
                module: 'logs',
                action: 'redo',
                targetType: log.module,
                targetId: log.target_id,
                targetName: log.target_name,
                oldData: { original_log_id: parseInt(log_id), original_action: log.action },
                newData: result.data || null,
                req
            });
            res.json({ success: true, message: result.message, data: result.data });
        } else {
            res.status(400).json({ error: result.message });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// Undo/Redo 辅助函数
// ============================================

// 撤销客户操作
async function undoContactOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销，必须留痕迹
            return { success: false, message: '新增操作不可撤销，请使用删除功能' };

        case 'update':
            // 撤销更新 = 恢复旧数据
            if (!oldData) return { success: false, message: '缺少原始数据，无法撤销' };
            await getPool().query(
                'UPDATE contacts SET name = ?, contact_person = ?, phone = ?, wechat = ?, qq = ?, address = ?, remark = ? WHERE id = ?',
                [oldData.name, oldData.contact_person, oldData.phone, oldData.wechat, oldData.qq, oldData.address, oldData.remark, targetId]
            );
            return { success: true, message: '已撤销更新客户', data: oldData };

        case 'delete':
            // 撤销删除 = 恢复记录
            await getPool().query('UPDATE contacts SET deleted_at = NULL WHERE id = ?', [targetId]);
            return { success: true, message: '已恢复删除的客户' };

        default:
            return { success: false, message: `不支持撤销 ${action} 操作` };
    }
}

// 重做客户操作
async function redoContactOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销/重做
            return { success: false, message: '新增操作不可撤销/重做' };

        case 'update':
            // 重做更新 = 应用新数据
            if (!newData) return { success: false, message: '缺少新数据，无法重做' };
            await getPool().query(
                'UPDATE contacts SET name = ?, contact_person = ?, phone = ?, wechat = ?, qq = ?, address = ?, remark = ? WHERE id = ?',
                [newData.name, newData.contact_person, newData.phone, newData.wechat, newData.qq, newData.address, newData.remark, targetId]
            );
            return { success: true, message: '已重做更新客户', data: newData };

        case 'delete':
            // 重做删除 = 软删除
            await getPool().query('UPDATE contacts SET deleted_at = NOW() WHERE id = ?', [targetId]);
            return { success: true, message: '已重做删除客户' };

        default:
            return { success: false, message: `不支持重做 ${action} 操作` };
    }
}

// 撤销产品操作
async function undoProductOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销，必须留痕迹
            return { success: false, message: '新增操作不可撤销，请使用删除功能' };

        case 'update':
            if (!oldData) return { success: false, message: '缺少原始数据，无法撤销' };
            await getPool().query(
                'UPDATE products SET name = ?, spec = ?, unit = ?, remark = ? WHERE id = ?',
                [oldData.name, oldData.spec, oldData.unit, oldData.remark, targetId]
            );
            return { success: true, message: '已撤销更新产品', data: oldData };

        case 'delete':
            await getPool().query('UPDATE products SET deleted_at = NULL WHERE id = ?', [targetId]);
            return { success: true, message: '已恢复删除的产品' };

        default:
            return { success: false, message: `不支持撤销 ${action} 操作` };
    }
}

// 重做产品操作
async function redoProductOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销/重做
            return { success: false, message: '新增操作不可撤销/重做' };

        case 'update':
            if (!newData) return { success: false, message: '缺少新数据，无法重做' };
            await getPool().query(
                'UPDATE products SET name = ?, spec = ?, unit = ?, remark = ? WHERE id = ?',
                [newData.name, newData.spec, newData.unit, newData.remark, targetId]
            );
            return { success: true, message: '已重做更新产品', data: newData };

        case 'delete':
            await getPool().query('UPDATE products SET deleted_at = NOW() WHERE id = ?', [targetId]);
            return { success: true, message: '已重做删除产品' };

        default:
            return { success: false, message: `不支持重做 ${action} 操作` };
    }
}

// 撤销订单操作
async function undoOrderOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销，必须留痕迹
            return { success: false, message: '新增操作不可撤销，请使用废弃功能' };

        case 'update':
            // 撤销更新订单 = 恢复旧数据
            if (!oldData) return { success: false, message: '缺少原始数据，无法撤销' };

            // 恢复订单主表
            await getPool().query(
                `UPDATE orders SET order_no = ?, contact_id = ?, contact_name_raw = ?, order_date = ?,
                 total_amount = ?, remark = ?, auto_verified = ?, manual_verified = ? WHERE id = ?`,
                [oldData.order_no, oldData.contact_id, oldData.contact_name_raw, oldData.order_date,
                 oldData.total_amount, oldData.remark, oldData.auto_verified ? 1 : 0, oldData.manual_verified ? 1 : 0, targetId]
            );

            // 恢复订单项
            if (oldData.items && Array.isArray(oldData.items)) {
                // 删除当前所有订单项
                await getPool().query('DELETE FROM order_items WHERE order_id = ?', [targetId]);
                // 重新插入旧的订单项
                for (const item of oldData.items) {
                    await getPool().query(
                        `INSERT INTO order_items (order_id, product_id, product_name_raw, unit, unit_price, quantity, line_total)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [targetId, item.product_id, item.product_name_raw, item.unit, item.unit_price, item.quantity, item.line_total]
                    );
                }
            }
            return { success: true, message: '已撤销更新订单', data: oldData };

        case 'verify':
            // 撤销审核 = 取消审核状态
            await getPool().query('UPDATE orders SET manual_verified = 0 WHERE id = ?', [targetId]);
            return { success: true, message: '已撤销审核订单' };

        case 'cancel':
            // 撤销废弃 = 恢复订单
            await getPool().query('UPDATE orders SET deleted_at = NULL WHERE id = ?', [targetId]);
            return { success: true, message: '已撤销废弃订单' };

        case 'restore':
            // 撤销恢复 = 重新废弃
            await getPool().query('UPDATE orders SET deleted_at = NOW() WHERE id = ?', [targetId]);
            return { success: true, message: '已撤销恢复订单' };

        case 'upload_image':
            // 撤销上传图片 = 删除图片
            if (!newData || !newData.image_id) return { success: false, message: '缺少图片ID，无法撤销' };
            await getPool().query('DELETE FROM order_images WHERE id = ?', [newData.image_id]);
            return { success: true, message: '已撤销上传图片' };

        case 'delete_image':
            // 撤销删除图片 = 恢复图片
            if (!oldData || !oldData.image_data) return { success: false, message: '缺少图片数据，无法撤销' };
            const [insertResult] = await getPool().query(
                'INSERT INTO order_images (order_id, mime_type, image_data) VALUES (?, ?, ?)',
                [oldData.order_id, oldData.mime_type, oldData.image_data]
            );
            return { success: true, message: '已恢复删除的图片', data: { new_image_id: insertResult.insertId } };

        default:
            return { success: false, message: `不支持撤销 ${action} 操作` };
    }
}

// 重做订单操作
async function redoOrderOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销/重做
            return { success: false, message: '新增操作不可撤销/重做' };

        case 'update':
            if (!newData) return { success: false, message: '缺少新数据，无法重做' };

            await getPool().query(
                `UPDATE orders SET order_no = ?, contact_id = ?, contact_name_raw = ?, order_date = ?,
                 total_amount = ?, remark = ?, auto_verified = ?, manual_verified = ? WHERE id = ?`,
                [newData.order_no, newData.contact_id, newData.contact_name_raw, newData.order_date,
                 newData.total_amount, newData.remark, newData.auto_verified ? 1 : 0, newData.manual_verified ? 1 : 0, targetId]
            );

            if (newData.items && Array.isArray(newData.items)) {
                await getPool().query('DELETE FROM order_items WHERE order_id = ?', [targetId]);
                for (const item of newData.items) {
                    await getPool().query(
                        `INSERT INTO order_items (order_id, product_id, product_name_raw, unit, unit_price, quantity, line_total)
                         VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        [targetId, item.product_id, item.product_name_raw, item.unit, item.unit_price, item.quantity, item.line_total]
                    );
                }
            }
            return { success: true, message: '已重做更新订单', data: newData };

        case 'verify':
            await getPool().query('UPDATE orders SET manual_verified = 1 WHERE id = ?', [targetId]);
            return { success: true, message: '已重做审核订单' };

        case 'cancel':
            await getPool().query('UPDATE orders SET deleted_at = NOW() WHERE id = ?', [targetId]);
            return { success: true, message: '已重做废弃订单' };

        case 'restore':
            await getPool().query('UPDATE orders SET deleted_at = NULL WHERE id = ?', [targetId]);
            return { success: true, message: '已重做恢复订单' };

        case 'upload_image':
            // 重做上传 = 重新插入图片（如果有数据）
            if (!newData || !newData.image_data) return { success: false, message: '缺少图片数据，无法重做' };
            const [result] = await getPool().query(
                'INSERT INTO order_images (order_id, mime_type, image_data) VALUES (?, ?, ?)',
                [targetId, newData.mime_type, newData.image_data]
            );
            return { success: true, message: '已重做上传图片', data: { new_image_id: result.insertId } };

        case 'delete_image':
            // 重做删除 = 删除图片
            if (!oldData || !oldData.image_id) return { success: false, message: '缺少图片ID，无法重做' };
            await getPool().query('DELETE FROM order_images WHERE id = ?', [oldData.image_id]);
            return { success: true, message: '已重做删除图片' };

        default:
            return { success: false, message: `不支持重做 ${action} 操作` };
    }
}

// 撤销资金操作
async function undoCashOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销，必须留痕迹
            return { success: false, message: '新增操作不可撤销，请使用删除功能' };

        default:
            return { success: false, message: `不支持撤销 ${action} 操作` };
    }
}

// 重做资金操作
async function redoCashOperation(action, targetId, oldData, newData) {
    switch (action) {
        case 'create':
            // 新增操作不可撤销/重做
            return { success: false, message: '新增操作不可撤销/重做' };

        default:
            return { success: false, message: `不支持重做 ${action} 操作` };
    }
}

// 启动服务器 (支持 HTTP 和 HTTPS 两种模式)
const ENABLE_HTTPS = process.env.ENABLE_HTTPS === 'true';

function startServer() {
    const printEndpoints = () => {
        console.log('可用 API 端点:');
        console.log('  认证相关:');
        console.log('    POST /auth/login        - 用户登录');
        console.log('    POST /auth/logout       - 用户登出');
        console.log('    POST /auth/refresh      - 刷新令牌');
        console.log('    GET  /auth/me           - 获取当前用户');
        console.log('    PUT  /auth/password     - 修改密码');
        console.log('  业务接口:');
        console.log('    GET  /lookups/version');
        console.log('    GET  /lookups/products');
        console.log('    GET  /lookups/contacts');
        console.log('    GET  /orders/:type');
        console.log('    GET  /orders/:type/:order_id');
        console.log('    PUT  /orders/:type/:order_id');
        console.log('    POST /orders/:type/:order_id/verify');
        console.log('    POST /orders/:type/:order_id/cancel');
        console.log('    POST /orders/:type/:order_id/restore');
        console.log('    POST /orders/:type/:order_id/images');
        console.log('    DELETE /orders/:type/:order_id/images/:image_id');
        console.log('    POST/PUT/DELETE /contacts/:id');
        console.log('    POST/PUT/DELETE /products/:id');
        console.log('    GET/POST /cash/transactions');
        console.log('    GET  /dashboard/stats');
        console.log('    GET  /logs');
    };

    if (ENABLE_HTTPS) {
        // HTTPS 模式
        const certPath = process.env.TLS_CERT_PATH || './certs/server.crt';
        const keyPath = process.env.TLS_KEY_PATH || './certs/server.key';

        try {
            const options = {
                cert: fs.readFileSync(path.resolve(__dirname, certPath)),
                key: fs.readFileSync(path.resolve(__dirname, keyPath)),
            };

            https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
                console.log(`🔒 后端 API 服务运行在 https://0.0.0.0:${PORT} (HTTPS 已启用)`);
                console.log(`   证书: ${certPath}`);
                printEndpoints();
            });
        } catch (error) {
            console.error('❌ 无法启动 HTTPS 服务:', error.message);
            console.log('   请检查证书文件是否存在');
            process.exit(1);
        }
    } else {
        // HTTP 模式 (开发环境)
        app.listen(PORT, '0.0.0.0', () => {
            console.log(`后端 API 服务运行在 http://0.0.0.0:${PORT}`);
            console.log('提示: 设置 ENABLE_HTTPS=true 启用 HTTPS 加密传输');
            printEndpoints();
        });
    }
}

startServer();
