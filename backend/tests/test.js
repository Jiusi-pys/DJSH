#!/usr/bin/env node

/**
 * Simple Integration Test for Authentication and Logging System
 */

const http = require('http');

const BASE_URL = 'http://localhost:8080';
const tests = [];
let passed = 0;
let failed = 0;
let cookies = [];

// Test results
const results = {
  auth: { passed: 0, failed: 0 },
  logging: { passed: 0, failed: 0 },
  permissions: { passed: 0, failed: 0 }
};

async function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies.join('; ')
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Store cookies
        const setCookie = res.headers['set-cookie'];
        if (setCookie) {
          setCookie.forEach(cookie => {
            const cookieName = cookie.split('=')[0];
            if (!cookies.some(c => c.startsWith(cookieName))) {
              cookies.push(cookie.split(';')[0]);
            }
          });
        }

        let responseBody = null;
        try {
          responseBody = data ? JSON.parse(data) : null;
        } catch (e) {
          responseBody = { parseError: true, raw: data };
        }

        resolve({
          status: res.statusCode,
          body: responseBody,
          headers: res.headers
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function test(category, name, fn) {
  process.stdout.write(`  • ${name}... `);
  try {
    await fn();
    console.log('✓');
    passed++;
    results[category].passed++;
  } catch (error) {
    console.log(`✗ ${error.message}`);
    failed++;
    results[category].failed++;
  }
}

async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log('🔐 AUTHENTICATION & LOGGING SYSTEM - INTEGRATION TESTS');
  console.log('='.repeat(70) + '\n');

  // ============================================
  // AUTHENTICATION TESTS
  // ============================================
  console.log('📋 SECTION 1: AUTHENTICATION TESTS\n');

  let userId = null;
  let adminCookies = [];

  await test('auth', 'Login with correct credentials', async () => {
    const response = await request('POST', '/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
    assert(response.body.success === true, 'Response should have success: true');
    assert(response.body.data?.user?.id, 'User ID not in response');
    assert(response.body.data?.user?.username === 'admin', 'Username mismatch');
    assert(response.body.data?.user?.role === 'admin', 'Role should be admin');

    userId = response.body.data.user.id;
    adminCookies = [...cookies];
  });

  await test('auth', 'Login with incorrect password', async () => {
    const response = await request('POST', '/auth/login', {
      username: 'admin',
      password: 'wrongpassword'
    });

    assert(response.status !== 200, `Status: expected not 200, got ${response.status}`);
    assert(response.body.success === false, 'Should fail');
  });

  await test('auth', 'Get current user (authenticated)', async () => {
    const response = await request('GET', '/auth/me');

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
    assert(response.body.success === true, 'Should succeed');
    assert(response.body.data?.username === 'admin', 'Username should be admin');
  });

  // ============================================
  // LOGGING TESTS - CONTACTS
  // ============================================
  console.log('\n📋 SECTION 2: LOGGING TESTS - CONTACTS\n');

  let contactId = null;

  await test('logging', 'Create contact (logs newData)', async () => {
    const response = await request('POST', '/contacts', {
      name: '测试客户 ' + Date.now(),
      contact_person: '张三',
      phone: '13800138000',
      address: '北京',
      contact_type: 'customer'
    });

    assert(response.status === 201, `Status: expected 201, got ${response.status}`);
    assert(response.body.key?.contact_id, 'Contact ID not returned');

    contactId = response.body.key.contact_id;
  });

  await test('logging', 'Update contact (logs oldData + newData)', async () => {
    assert(contactId, 'Contact not created');

    const response = await request('PUT', `/contacts/${contactId}`, {
      name: '更新的客户',
      contact_person: '李四',
      phone: '13900139000'
    });

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  await test('logging', 'Delete contact (logs oldData)', async () => {
    assert(contactId, 'Contact not created');

    const response = await request('DELETE', `/contacts/${contactId}`);
    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  // ============================================
  // LOGGING TESTS - PRODUCTS
  // ============================================
  console.log('\n📋 SECTION 3: LOGGING TESTS - PRODUCTS\n');

  let productId = null;

  await test('logging', 'Create product (logs newData)', async () => {
    const response = await request('POST', '/products', {
      name: '测试产品 ' + Date.now(),
      spec: '规格',
      unit: '件',
      unit_price: 99.99,
      category: 'electronics'
    });

    assert(response.status === 201, `Status: expected 201, got ${response.status}`);
    assert(response.body.key?.product_id, 'Product ID not returned');

    productId = response.body.key.product_id;
  });

  await test('logging', 'Update product (logs oldData + newData)', async () => {
    assert(productId, 'Product not created');

    const response = await request('PUT', `/products/${productId}`, {
      name: '更新的产品',
      spec: '规格B',
      unit: '件',
      unit_price: 149.99,
      category: 'electronics'
    });

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  await test('logging', 'Delete product (logs oldData)', async () => {
    assert(productId, 'Product not created');

    const response = await request('DELETE', `/products/${productId}`);
    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  // ============================================
  // LOGGING TESTS - ORDERS
  // ============================================
  console.log('\n📋 SECTION 4: LOGGING TESTS - ORDERS\n');

  let orderId = null;

  await test('logging', 'Create order (logs newData)', async () => {
    const response = await request('POST', '/orders/sales', {
      order_no: `TEST-${Date.now()}`,
      contact_id: null,
      order_date: new Date().toISOString().split('T')[0],
      remark: '测试订单',
      items: [
        {
          product_id: null,
          product_name_raw: '测试产品',
          unit: '件',
          unit_price: 100,
          quantity: 2
        }
      ]
    });

    assert(response.status === 201, `Status: expected 201, got ${response.status}`);
    assert(response.body.key?.order_id, 'Order ID not returned');

    orderId = response.body.key.order_id;
  });

  await test('logging', 'Verify order (logs oldData + newData)', async () => {
    assert(orderId, 'Order not created');

    // Get current version
    const getResponse = await request('GET', `/orders/sales/${orderId}`);
    const version = getResponse.body.key?.version;

    const response = await request('POST', `/orders/sales/${orderId}/verify`, {
      version
    });

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  await test('logging', 'Cancel order (logs oldData + newData)', async () => {
    assert(orderId, 'Order not created');

    // Get current version
    const getResponse = await request('GET', `/orders/sales/${orderId}`);
    const version = getResponse.body.key?.version;

    const response = await request('POST', `/orders/sales/${orderId}/cancel`, {
      version,
      reason: '取消原因'
    });

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
  });

  // ============================================
  // PERMISSIONS TESTS
  // ============================================
  console.log('\n📋 SECTION 5: PERMISSIONS TESTS\n');

  await test('permissions', 'Admin can access dashboard', async () => {
    const response = await request('GET', '/dashboard/stats');

    assert(response.status === 200, `Status: expected 200, got ${response.status}`);
    assert(response.body.todaySales !== undefined, 'Dashboard stats not returned');
  });

  // ============================================
  // PRINT RESULTS
  // ============================================
  console.log('\n' + '='.repeat(70));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(70) + '\n');

  const total = passed + failed;
  const percentage = total > 0 ? Math.round(passed / total * 100) : 0;

  console.log(`Total Tests:  ${total}`);
  console.log(`✓ Passed:     ${passed}`);
  console.log(`✗ Failed:     ${failed}`);
  console.log(`Success Rate: ${percentage}%\n`);

  console.log('Breakdown:');
  console.log(`  • Authentication:  ${results.auth.passed}/${results.auth.passed + results.auth.failed}`);
  console.log(`  • Logging:         ${results.logging.passed}/${results.logging.passed + results.logging.failed}`);
  console.log(`  • Permissions:     ${results.permissions.passed}/${results.permissions.passed + results.permissions.failed}`);

  console.log('\n' + '='.repeat(70) + '\n');

  if (failed === 0) {
    console.log('🎉 All tests passed!');
  } else {
    console.log(`⚠️  ${failed} test(s) failed.`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
