/**
 * Server startup file
 * Handles HTTP/HTTPS server creation and startup
 * Uses centralized configuration from config.json
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const app = require('./app');
// Use explicit path to avoid conflict with mounted config.json
const config = require('./config/index');

const HOST = config.server.host;
const PORT = config.server.port;
const ENABLE_HTTPS = config.https.enabled;

/**
 * Print available API endpoints
 */
function printEndpoints() {
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
}

/**
 * Start the server
 */
function startServer() {
  if (ENABLE_HTTPS) {
    // HTTPS mode
    const certPath = config.https.certPath;
    const keyPath = config.https.keyPath;

    try {
      const options = {
        cert: fs.readFileSync(path.resolve(__dirname, certPath)),
        key: fs.readFileSync(path.resolve(__dirname, keyPath)),
      };

      https.createServer(options, app).listen(PORT, HOST, () => {
        console.log(`🔒 后端 API 服务运行在 https://${HOST}:${PORT} (HTTPS 已启用)`);
        console.log(`   证书: ${certPath}`);
        printEndpoints();
      });
    } catch (error) {
      console.error('❌ 无法启动 HTTPS 服务:', error.message);
      console.log('   请检查证书文件是否存在');
      process.exit(1);
    }
  } else {
    // HTTP mode (development)
    app.listen(PORT, HOST, () => {
      console.log(`后端 API 服务运行在 http://${HOST}:${PORT}`);
      console.log('提示: 设置 backend.https.enabled=true 启用 HTTPS 加密传输');
      printEndpoints();
    });
  }
}

startServer();
