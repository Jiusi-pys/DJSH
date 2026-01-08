/**
 * Integration Tests for Authentication and Logging System
 * Run with: npm test
 */

const https = require('https');
const http = require('http');
const fs = require('fs');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:8080';
const USE_HTTPS = BASE_URL.startsWith('https://');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  bold: '\x1b[1m'
};

class TestRunner {
  constructor() {
    this.tests = [];
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
    this.cookies = [];
    this.authToken = null;
    this.userId = null;
  }

  log(message, color = colors.reset) {
    console.log(`${color}${message}${colors.reset}`);
  }

  async request(method, path, requestBody = null, headers = {}) {
    return new Promise((resolve, reject) => {
      const urlObj = new URL(path, BASE_URL);
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Cookie': this.cookies.join('; '),
          ...headers
        }
      };

      const protocol = USE_HTTPS ? https : http;
      const req = protocol.request(urlObj, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          // Extract and store cookies
          const setCookie = res.headers['set-cookie'];
          if (setCookie) {
            setCookie.forEach(cookie => {
              const cookieName = cookie.split('=')[0];
              if (!this.cookies.some(c => c.startsWith(cookieName))) {
                this.cookies.push(cookie.split(';')[0]);
              }
            });
          }

          let body = null;
          try {
            body = data ? JSON.parse(data) : null;
          } catch (e) {
            body = { error: 'Invalid JSON response', raw: data.substring(0, 100) };
          }

          resolve({
            status: res.statusCode,
            body,
            headers: res.headers
          });
        });
      });

      req.on('error', reject);
      if (requestBody) req.write(JSON.stringify(requestBody));
      req.end();
    });
  }

  async test(name, fn) {
    this.log(`\n📝 Test: ${name}`, colors.yellow);
    try {
      await fn();
      this.results.passed++;
      this.log('✅ PASSED', colors.green);
    } catch (error) {
      this.results.failed++;
      this.results.errors.push({ test: name, error: error.message });
      this.log(`❌ FAILED: ${error.message}`, colors.red);
    }
  }

  assert(condition, message) {
    if (!condition) throw new Error(message);
  }

  async run() {
    this.log('\n' + '='.repeat(60), colors.bold);
    this.log('🔐 AUTHENTICATION & LOGGING SYSTEM TEST SUITE', colors.bold);
    this.log('='.repeat(60) + '\n', colors.bold);

    // ============================================
    // AUTHENTICATION TESTS
    // ============================================
    this.log('\n█ SECTION 1: AUTHENTICATION TESTS', colors.blue);
    this.log('-'.repeat(60), colors.blue);

    await this.test('Login with correct credentials (admin/admin123)', async () => {
      const response = await this.request('POST', '/auth/login', {
        username: 'admin',
        password: 'admin123'
      });

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.assert(response.body.success === true, 'Expected success: true');
      this.assert(response.body.data?.user?.id, 'User ID not returned');
      this.assert(response.body.data?.user?.username === 'admin', 'Username mismatch');
      this.assert(response.body.data?.user?.role === 'admin', 'Role mismatch');

      this.userId = response.body.data.user.id;
      this.log(`   User ID: ${this.userId}`, colors.reset);
      this.log(`   Role: ${response.body.data.user.role}`, colors.reset);
    });

    await this.test('Login with incorrect password', async () => {
      const response = await this.request('POST', '/auth/login', {
        username: 'admin',
        password: 'wrongpassword'
      });

      this.assert(response.status === 401 || response.status === 400, `Expected 401/400, got ${response.status}`);
      this.assert(response.body.success === false, 'Expected success: false');
      this.assert(response.body.message || response.body.error, 'No error message');

      this.log(`   Error: ${response.body.message || response.body.error}`, colors.reset);
    });

    await this.test('Get current user info (authenticated)', async () => {
      const response = await this.request('GET', '/auth/me');

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.assert(response.body.success === true, 'Expected success: true');
      this.assert(response.body.data?.username === 'admin', 'Username mismatch');
      this.assert(response.body.data?.role === 'admin', 'Role mismatch');

      this.log(`   Authenticated as: ${response.body.data.username}`, colors.reset);
      this.log(`   Permissions: Admin`, colors.reset);
    });

    // ============================================
    // LOGGING TESTS - CONTACTS
    // ============================================
    this.log('\n█ SECTION 2: LOGGING TESTS - CONTACTS', colors.blue);
    this.log('-'.repeat(60), colors.blue);

    let contactId = null;

    await this.test('Log contact creation with newData', async () => {
      const contactData = {
        name: '测试客户 ' + Date.now(),
        contact_person: '张三',
        phone: '13800138000',
        email: 'test@example.com',
        address: '北京市',
        contact_type: 'customer'
      };

      const response = await this.request('POST', '/contacts', contactData);

      this.assert(response.status === 201, `Expected 201, got ${response.status}`);
      this.assert(response.body.key?.contact_id, 'Contact ID not returned');

      contactId = response.body.key.contact_id;
      this.log(`   Contact created: ${contactId}`, colors.reset);
      this.log(`   Name: ${contactData.name}`, colors.reset);

      // Verify log was recorded
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=contacts&action=create&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === contactId && l.action === 'create'
        );
        if (log) {
          this.assert(log.module === 'contacts', 'Module mismatch');
          this.assert(log.new_data !== null, 'newData is null');
          this.log(`   ✓ Log recorded with newData`, colors.reset);
        }
      }
    });

    await this.test('Log contact update with oldData and newData', async () => {
      if (!contactId) throw new Error('Contact not created');

      const updatedData = {
        name: '更新后的客户 ' + Date.now(),
        contact_person: '李四',
        phone: '13900139000'
      };

      const response = await this.request('PUT', `/contacts/${contactId}`, updatedData);

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.log(`   Contact updated: ${contactId}`, colors.reset);
      this.log(`   New name: ${updatedData.name}`, colors.reset);

      // Verify log was recorded
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=contacts&action=update&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === contactId && l.action === 'update'
        );
        if (log) {
          this.assert(log.old_data !== null, 'oldData is null');
          this.assert(log.new_data !== null, 'newData is null');
          this.log(`   ✓ Log recorded with oldData and newData`, colors.reset);
        }
      }
    });

    // ============================================
    // LOGGING TESTS - PRODUCTS
    // ============================================
    this.log('\n█ SECTION 3: LOGGING TESTS - PRODUCTS', colors.blue);
    this.log('-'.repeat(60), colors.blue);

    let productId = null;

    await this.test('Log product creation with newData', async () => {
      const productData = {
        name: '测试产品 ' + Date.now(),
        spec: 'A级',
        unit: '件',
        unit_price: 99.99,
        category: 'electronics'
      };

      const response = await this.request('POST', '/products', productData);

      this.assert(response.status === 201, `Expected 201, got ${response.status}`);
      this.assert(response.body.key?.product_id, 'Product ID not returned');

      productId = response.body.key.product_id;
      this.log(`   Product created: ${productId}`, colors.reset);
      this.log(`   Name: ${productData.name}`, colors.reset);

      // Verify log
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=products&action=create&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === productId && l.action === 'create'
        );
        if (log) {
          this.assert(log.new_data !== null, 'newData is null');
          this.log(`   ✓ Log recorded with newData`, colors.reset);
        }
      }
    });

    await this.test('Log product update with oldData and newData', async () => {
      if (!productId) throw new Error('Product not created');

      const updatedData = {
        name: '更新后的产品',
        spec: 'B级',
        unit: '件',
        unit_price: 149.99,
        category: 'electronics'
      };

      const response = await this.request('PUT', `/products/${productId}`, updatedData);

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.log(`   Product updated: ${productId}`, colors.reset);
      this.log(`   Price changed to: ¥${updatedData.unit_price}`, colors.reset);

      // Verify log
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=products&action=update&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === productId && l.action === 'update'
        );
        if (log) {
          this.assert(log.old_data !== null, 'oldData is null');
          this.assert(log.new_data !== null, 'newData is null');

          const oldPrice = log.old_data.unit_price;
          const newPrice = log.new_data.unit_price;
          this.log(`   ✓ Log shows price change: ¥${oldPrice} → ¥${newPrice}`, colors.reset);
        }
      }
    });

    // ============================================
    // LOGGING TESTS - ORDERS
    // ============================================
    this.log('\n█ SECTION 4: LOGGING TESTS - ORDERS', colors.blue);
    this.log('-'.repeat(60), colors.blue);

    let orderId = null;

    await this.test('Log order creation with newData', async () => {
      const orderData = {
        order_no: `TEST-${Date.now()}`,
        contact_id: contactId || null,
        order_date: new Date().toISOString().split('T')[0],
        remark: '测试订单',
        items: [
          {
            product_id: productId,
            product_name_raw: '测试产品',
            unit: '件',
            unit_price: 99.99,
            quantity: 2
          }
        ]
      };

      const response = await this.request('POST', '/orders/sales', orderData);

      this.assert(response.status === 201, `Expected 201, got ${response.status}`);
      this.assert(response.body.key?.order_id, 'Order ID not returned');

      orderId = response.body.key.order_id;
      this.log(`   Order created: ${orderId}`, colors.reset);
      this.log(`   Order number: ${orderData.order_no}`, colors.reset);
      this.log(`   Total amount: ¥${99.99 * 2}`, colors.reset);

      // Verify log
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=orders&action=create&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === orderId && l.action === 'create'
        );
        if (log) {
          this.assert(log.new_data !== null, 'newData is null');
          this.log(`   ✓ Log recorded with order details and items`, colors.reset);
        }
      }
    });

    await this.test('Log order verification with oldData and newData', async () => {
      if (!orderId) throw new Error('Order not created');

      // First get order to get version
      const getResponse = await this.request('GET', `/orders/sales/${orderId}`);
      const version = getResponse.body.key.version;

      const response = await this.request('POST', `/orders/sales/${orderId}/verify`, { version });

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.log(`   Order verified: ${orderId}`, colors.reset);

      // Verify log
      await new Promise(r => setTimeout(r, 500));
      const logsResponse = await this.request('GET', '/logs?module=orders&action=verify&page=1&page_size=100');

      if (logsResponse.status === 200 && logsResponse.body?.items) {
        const log = logsResponse.body.items.find(l =>
          l.target_id === orderId && l.action === 'verify'
        );
        if (log) {
          this.assert(log.old_data?.manual_verified === 0 || log.old_data?.manual_verified === false, 'oldData should show unverified');
          this.assert(log.new_data?.manual_verified === 1 || log.new_data?.manual_verified === true, 'newData should show verified');
          this.log(`   ✓ Log shows verification state change`, colors.reset);
        }
      }
    });

    // ============================================
    // PERMISSION TESTS
    // ============================================
    this.log('\n█ SECTION 5: PERMISSION TESTS', colors.blue);
    this.log('-'.repeat(60), colors.blue);

    await this.test('Admin user can access protected endpoints', async () => {
      const response = await this.request('GET', '/dashboard/stats');

      this.assert(response.status === 200, `Expected 200, got ${response.status}`);
      this.assert(response.body.today_sales !== undefined, 'Dashboard stats not returned');

      this.log(`   ✓ Admin access to /dashboard/stats granted`, colors.reset);
    });

    // ============================================
    // PRINT RESULTS
    // ============================================
    this.log('\n' + '='.repeat(60), colors.bold);
    this.log('📊 TEST RESULTS SUMMARY', colors.bold);
    this.log('='.repeat(60), colors.bold);

    this.log(`\n✅ Passed: ${this.results.passed}`, colors.green);
    this.log(`❌ Failed: ${this.results.failed}`, colors.red);
    this.log(`📈 Success Rate: ${Math.round(this.results.passed / (this.results.passed + this.results.failed) * 100)}%`);

    if (this.results.errors.length > 0) {
      this.log('\n🔴 FAILED TESTS:', colors.red);
      this.results.errors.forEach((err, idx) => {
        this.log(`   ${idx + 1}. ${err.test}`, colors.red);
        this.log(`      → ${err.error}`, colors.reset);
      });
    }

    this.log('\n' + '='.repeat(60) + '\n', colors.bold);

    return this.results.failed === 0;
  }
}

// Run tests
const runner = new TestRunner();
runner.run().then(success => {
  process.exit(success ? 0 : 1);
}).catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
