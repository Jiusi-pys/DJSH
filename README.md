# 丁记商行 - 进销存财务管理系统

## 📋 目录

- [项目简介](#项目简介)
- [核心功能](#核心功能)
- [系统架构](#系统架构)
- [技术栈](#技术栈)
- [数据库设计](#数据库设计)
- [认证和安全](#认证和安全)
- [环境配置](#环境配置)
- [部署教程](#部署教程)
- [CI/CD 流程](#cicd-流程)
- [API 文档](#api-文档)
- [常见问题](#常见问题)

---

## 项目简介

丁记商行进销存财务管理系统是一款专业的企业级业务管理工具，专为中小型企业打造的全功能进销存和财务管理解决方案。

### 核心特点

- 🚀 **现代化技术栈** - Next.js 14 + React 18 + TypeScript + MySQL 8.0
- 📱 **响应式设计** - 完美支持移动端、平板和桌面端
- 🔒 **企业级安全** - JWT 双令牌认证 + HTTP-Only Cookie + 登录防暴力破解
- 📊 **实时统计分析** - 客户欠收、销售统计、库存管理
- 🎨 **精美界面** - 基于 Tailwind CSS 和 Radix UI 的现代化界面
- 🔄 **并发安全** - 乐观锁机制防止数据冲突
- 📝 **完整审计** - 所有操作自动记录日志

---

## 核心功能

### 1. 订单管理

- ✅ **销售订单** - 创建、编辑、审核销售订单
- ✅ **采购订单** - 创建、编辑、审核采购订单
- ✅ **订单审核** - 人工审核流程，支持问题标记
- ✅ **图片附件** - 支持上传订单相关图片（发票、合同等）
- ✅ **当场结算** - 审核订单时可勾选当场结算，自动创建资金流水
- ✅ **订单废除** - 支持废除和恢复订单，带版本控制
- ✅ **智能筛选** - 销售订单只显示下游客户，采购订单只显示上游供应商

### 2. 资金流水管理

- ✅ **收入支出** - 记录所有资金流入流出
- ✅ **客户关联** - 自动关联对应的客户或供应商
- ✅ **图片附件** - 支持上传收据、发票等凭证图片
- ✅ **审核机制** - 手动创建默认已审核，订单自动创建默认未审核
- ✅ **余额计算** - 实时计算当前余额（只计算已审核的有效交易）
- ✅ **流水废除** - 支持废除和恢复流水记录
- ✅ **分类管理** - 支持自定义收支分类

### 3. 客户管理

- ✅ **客户类型** - 区分下游客户、上游供应商、全是（both）
- ✅ **智能筛选** - 根据业务类型自动筛选合适的客户
- ✅ **联系信息** - 管理客户电话、微信、QQ 等联系方式
- ✅ **客户禁用** - 支持禁用和恢复客户
- ✅ **应收账款** - 自动统计每个客户的欠收情况

### 4. 商品管理

- ✅ **商品信息** - 管理商品名称、规格、单位、价格
- ✅ **分类管理** - 支持商品分类
- ✅ **销售统计** - 统计每个商品的销售数量和收入
- ✅ **库存追踪** - 实时计算库存进出和当前库存
- ✅ **库存预警** - 自动标识负库存和库存不足的商品

### 5. 数据统计

- ✅ **客户欠收统计** - 统计每个客户的销售总额、已收金额、欠收金额
- ✅ **销售统计** - 统计商品销售数量、收入、平均售价
- ✅ **库存统计** - 统计采购进货、销售出货、当前库存、成本收入和利润
- ✅ **负库存预警** - 自动标识并警告负库存商品
- ✅ **库存不足预警** - 自动标识库存不足的商品（< 10）

### 6. 系统功能

- ✅ **用户认证** - JWT 双令牌认证机制
- ✅ **权限控制** - 基于角色的访问控制（RBAC）
- ✅ **操作日志** - 完整记录所有操作，支持审计追踪
- ✅ **仪表盘** - 实时显示业务关键指标
- ✅ **审核队列** - 集中展示待审核的订单

---

## 系统架构

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器 / 前端应用                         │
│              (Next.js 14 + React + TypeScript)               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTPS/HTTP
                           │ JWT 令牌
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                  Express.js 后端 API 服务                     │
│                  (Node.js + mysql2/promise)                  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 中间件层                                                │  │
│  │ ├─ CORS 跨域配置                                        │  │
│  │ ├─ JWT 身份验证                                        │  │
│  │ ├─ 权限检查                                            │  │
│  │ ├─ 登录限流保护                                        │  │
│  │ └─ 操作日志记录                                        │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │ 业务路由                                                │  │
│  │ ├─ /auth - 认证模块（登录、登出、刷新）                │  │
│  │ ├─ /lookups - 下拉数据（客户、商品）                   │  │
│  │ ├─ /contacts - 客户管理                                │  │
│  │ ├─ /products - 产品管理                                │  │
│  │ ├─ /orders - 订单管理（销售、采购）                    │  │
│  │ ├─ /cash - 资金流水管理                                │  │
│  │ ├─ /statistics - 数据统计（欠收、销售、库存）          │  │
│  │ ├─ /dashboard - 仪表盘统计                             │  │
│  │ └─ /logs - 操作日志                                    │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────┬──────────────────────────────────┘
                           │ SQL 查询
                           │ 事务管理
                           ↓
┌──────────────────────────────────────────────────────────────┐
│                    MySQL 8.0 数据库                           │
│         (InnoDB 存储引擎 + UTF8MB4 字符集)                   │
│  ├─ 核心表: users, contacts, products, orders              │  │
│  ├─ 订单表: order_items, order_images                      │  │
│  ├─ 财务表: cash_transactions, cash_transaction_images     │  │
│  ├─ 日志表: operation_logs, login_attempts, refresh_tokens │  │
│  └─ 视图: v_order_details 等复杂查询视图                   │  │
└──────────────────────────────────────────────────────────────┘
```

### 认证流程

```
1. 用户输入用户名/密码
                    ↓
2. 前端发送 POST /auth/login
                    ↓
3. 后端验证登录信息
   ├─ 查询数据库获取用户
   ├─ 验证密码（bcrypt）
   ├─ 检查账户状态
   └─ 检查登录限流（5次失败锁定30分钟）
                    ↓
4. 生成 JWT 令牌
   ├─ accessToken (8小时有效期)
   ├─ refreshToken (30天有效期)
   └─ 存储到 HTTP-Only Cookie
                    ↓
5. 返回用户信息和令牌给前端
                    ↓
6. 前端存储令牌并设置为已认证状态
                    ↓
7. 后续请求自动附带令牌
   ├─ Cookie 中获取（自动）
   ├─ Authorization 头中获取（手动）
   └─ 验证令牌有效性
                    ↓
8. 令牌过期时自动刷新（使用 refreshToken）
```

---

## 技术栈

### 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Next.js** | 14.0.4 | 全栈框架，提供 SSR 和路由 |
| **React** | 18.2.0 | UI 框架 |
| **TypeScript** | 5.3.3 | 类型安全 |
| **TanStack Query** | 5.17.0 | 服务器状态管理 |
| **Tailwind CSS** | 3.4.1 | 样式框架 |
| **Radix UI** | 最新 | 无样式组件库 |
| **date-fns** | 3.2.0 | 日期处理 |
| **Lucide React** | 0.309.0 | 图标库 |

### 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| **Node.js** | 18+ | JavaScript 运行时 |
| **Express.js** | 4.18.2 | Web 框架 |
| **MySQL2** | 3.6.5 | 数据库驱动 |
| **bcrypt** | 5.1.1 | 密码哈希 |
| **jsonwebtoken** | 9.0.2 | JWT 令牌 |
| **cors** | 2.8.5 | 跨域资源共享 |
| **cookie-parser** | 1.4.6 | Cookie 解析 |

### 数据库

| 技术 | 版本 |
|------|------|
| **MySQL** | 8.0+ |
| **InnoDB** | 默认存储引擎 |
| **UTF8MB4** | 字符编码 |

---

## 数据库设计

### 核心表结构

#### 1. 用户表 (users)

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'user') DEFAULT 'user',
  status ENUM('active', 'locked', 'disabled') DEFAULT 'active',
  display_name VARCHAR(100),
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login_at TIMESTAMP NULL,
  last_login_ip VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### 2. 联系人表 (contacts)

```sql
CREATE TABLE contacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  contact_person VARCHAR(50),
  phone VARCHAR(20),
  wechat VARCHAR(50),
  qq VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  contact_type ENUM('customer', 'supplier', 'both') DEFAULT 'customer',
  balance DECIMAL(15,2) DEFAULT 0.00,
  remark TEXT,
  is_disabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,
  INDEX idx_contact_type (contact_type),
  INDEX idx_phone (phone),
  INDEX idx_deleted_at (deleted_at)
);
```

**客户类型说明：**
- `customer` - 下游客户（仅采购方，用于销售订单和收入流水）
- `supplier` - 上游供应商（仅供货方，用于采购订单和支出流水）
- `both` - 全是（既是客户又是供应商）

#### 3. 产品表 (products)

```sql
CREATE TABLE products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  spec VARCHAR(100),
  unit VARCHAR(20) DEFAULT '个',
  unit_price DECIMAL(15,2) DEFAULT 0.00,
  category VARCHAR(50),
  remark TEXT,
  is_disabled TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);
```

#### 4. 订单表 (orders)

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(50) NOT NULL UNIQUE,
  order_type ENUM('sales', 'purchase'),
  contact_id BIGINT,
  order_date DATE NOT NULL,
  total_amount DECIMAL(15,2) DEFAULT 0.00,
  remark TEXT,

  -- 状态字段
  auto_verified TINYINT DEFAULT 0,
  manual_verified TINYINT DEFAULT 0,
  settled TINYINT DEFAULT 0,
  settled_immediately TINYINT DEFAULT 0,  -- 当场结算标志
  cancelled TINYINT DEFAULT 0,
  cancelled_reason TEXT,
  cancelled_at TIMESTAMP NULL,

  version INT DEFAULT 1,  -- 乐观锁版本号
  issues JSON,            -- 问题标签

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  INDEX idx_order_type (order_type),
  INDEX idx_order_date (order_date),
  INDEX idx_manual_verified (manual_verified),
  INDEX idx_cancelled (cancelled)
);
```

#### 5. 订单明细表 (order_items)

```sql
CREATE TABLE order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT,
  product_name_raw VARCHAR(200),
  unit VARCHAR(20) DEFAULT '个',
  unit_price DECIMAL(15,2) DEFAULT 0.00,
  quantity DECIMAL(15,3) DEFAULT 0,
  line_total DECIMAL(15,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_product_id (product_id)
);
```

#### 6. 订单图片表 (order_images)

```sql
CREATE TABLE order_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
  image_data MEDIUMTEXT,  -- Base64 编码的图片数据
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  INDEX idx_order_id (order_id)
);
```

#### 7. 资金流水表 (cash_transactions)

```sql
CREATE TABLE cash_transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  trans_type ENUM('income', 'expense') NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  category VARCHAR(50),
  trans_date DATE NOT NULL,
  contact_id BIGINT,
  order_id BIGINT,  -- 关联订单（当场结算时自动填写）
  remark TEXT,

  -- 审核状态
  verified TINYINT(1) NOT NULL DEFAULT 1,  -- 手动创建默认已审核
  verified_at TIMESTAMP NULL,

  -- 废除状态
  cancelled TINYINT(1) NOT NULL DEFAULT 0,
  cancelled_reason TEXT,
  cancelled_at TIMESTAMP NULL,

  version INT NOT NULL DEFAULT 1,  -- 乐观锁版本号

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL,

  FOREIGN KEY (contact_id) REFERENCES contacts(id),
  FOREIGN KEY (order_id) REFERENCES orders(id),
  INDEX idx_trans_type (trans_type),
  INDEX idx_trans_date (trans_date),
  INDEX idx_verified (verified),
  INDEX idx_cancelled (cancelled)
);
```

**审核状态说明：**
- 手动创建的流水：`verified = 1`（默认已审核）
- 订单当场结算自动创建的流水：`verified = 0`（默认未审核，需手动审核）
- 只有已审核的流水才计入余额

#### 8. 资金流水图片表 (cash_transaction_images)

```sql
CREATE TABLE cash_transaction_images (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  transaction_id BIGINT NOT NULL,
  image_path VARCHAR(500) NOT NULL,
  mime_type VARCHAR(50) NOT NULL DEFAULT 'image/jpeg',
  image_data MEDIUMTEXT,  -- Base64 编码的图片数据
  uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (transaction_id) REFERENCES cash_transactions(id) ON DELETE CASCADE,
  INDEX idx_transaction_id (transaction_id)
);
```

#### 9. 操作日志表 (operation_logs)

```sql
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,
  module VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id BIGINT,
  target_name VARCHAR(200),

  request_method VARCHAR(10),
  request_path VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent TEXT,

  old_data JSON,
  new_data JSON,

  status ENUM('success', 'failed') DEFAULT 'success',
  error_message TEXT,
  duration_ms INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_module (module)
);
```

---

## 认证和安全

### JWT 令牌机制

```
访问令牌 (accessToken)
├─ 有效期: 8 小时
├─ 储存位置: HTTP-Only Cookie (防止 XSS 攻击)
├─ 传递方式:
│  ├─ 自动: 浏览器自动在 Cookie 中发送
│  └─ 手动: Authorization: Bearer <token>
├─ 包含信息:
│  ├─ userId: 用户 ID
│  ├─ username: 用户名
│  ├─ role: 用户角色
│  └─ displayName: 显示名称
└─ 签名算法: HS256 (HMAC-SHA256)

刷新令牌 (refreshToken)
├─ 有效期: 30 天
├─ 储存位置:
│  ├─ 前端: HTTP-Only Cookie
│  └─ 数据库: 哈希形式
├─ 用途: 在 accessToken 过期时获取新的 accessToken
└─ 安全: 失效后立即撤销
```

### 密码安全

- ❌ 永不存储明文密码
- ✅ 使用 bcrypt 10 轮 salt 加密
- ✅ 每个密码都有唯一的 salt
- ✅ 即使数据库泄露也无法恢复原始密码

### 登录防暴力破解

- 5 次登录失败自动锁定账户 30 分钟
- 成功登录后自动重置失败计数
- 所有登录尝试记录在审计日志中

---

## 环境配置

### 前端环境变量

**文件位置**: `.env.local`

```bash
# API 服务器地址
NEXT_PUBLIC_API_BASE_URL=http://192.168.8.105:8080
```

### 后端环境变量

**文件位置**: `backend/.env`

```bash
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=djsh_finance_db

# 服务配置
PORT=8080
HOST=0.0.0.0  # 监听所有网络接口，支持局域网访问

# JWT 密钥（生产环境必须修改！）
JWT_ACCESS_SECRET=生成的随机密钥
JWT_REFRESH_SECRET=生成的随机密钥

# 前端地址（用于 CORS）
FRONTEND_URL=http://192.168.8.105:3000

# TLS/HTTPS 配置
ENABLE_HTTPS=false
```

### 生成 JWT 密钥

```bash
openssl rand -hex 32
```

---

## 部署教程

### 1. 数据库初始化

```bash
# 登录 MySQL
mysql -u root -p

# 创建数据库
CREATE DATABASE djsh_finance_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

# 导入数据库架构
source /home/jiusi/DJSH/database/schema.sql;
source /home/jiusi/DJSH/database/migrations/001_add_users_table.sql;
```

### 2. 后端部署

```bash
cd /home/jiusi/DJSH/backend

# 安装依赖
npm install

# 配置环境变量
nano .env

# 启动服务
npm start
```

### 3. 前端部署

```bash
cd /home/jiusi/DJSH

# 安装依赖
npm install

# 安装 Checkbox 组件依赖
npm install @radix-ui/react-checkbox

# 配置环境变量
echo "NEXT_PUBLIC_API_BASE_URL=http://192.168.8.105:8080" > .env.local

# 开发模式
npm run dev

# 生产模式
npm run build
npm start
```

### 4. 访问系统

- **前端**: `http://192.168.8.105:3000`
- **后端 API**: `http://192.168.8.105:8080`
- **默认账户**: admin / admin123

---

## CI/CD 流程

![Docker Build](https://github.com/Jiusi-pys/DJSH/actions/workflows/docker-build.yml/badge.svg)

本项目使用 GitHub Actions 自动化构建和部署 Docker 镜像。

### 工作流特性

- ✅ **多平台构建** - 支持 Linux AMD64 和 ARM64 架构
- ✅ **安全扫描** - Trivy 检测 HIGH 和 CRITICAL 级别的漏洞
- ✅ **层缓存** - GitHub Actions 缓存加速后续构建
- ✅ **并发控制** - 同一分支只允许一个构建任务运行

### 使用 Docker Compose 部署

```bash
# 拉取镜像
docker-compose pull

# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

---

## API 文档

### 认证 API

#### 登录

```bash
POST /auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

### 统计 API

#### 客户应收账款

```bash
GET /statistics/customer-outstanding
Authorization: Bearer <token>

响应:
{
  "items": [
    {
      "key": { "contact_id": 1 },
      "display": {
        "contact_name": "张三餐厅",
        "total_sales": 173,
        "total_received": 5000,
        "outstanding": -4827  // 负数表示预收款
      }
    }
  ]
}
```

#### 商品销售统计

```bash
GET /statistics/product-sales
Authorization: Bearer <token>

响应:
{
  "items": [
    {
      "key": { "product_id": 1 },
      "display": {
        "product_name": "苹果",
        "total_sold": 20,
        "total_revenue": 110,
        "avg_price": 5.50
      }
    }
  ]
}
```

#### 库存统计

```bash
GET /statistics/inventory
Authorization: Bearer <token>

响应:
{
  "items": [
    {
      "key": { "product_id": 1 },
      "display": {
        "product_name": "苹果",
        "purchased": 100,
        "sold": 20,
        "stock": 80,
        "purchase_cost": 400,
        "sales_revenue": 110
      }
    }
  ]
}
```

### 资金流水 API

#### 获取当前余额

```bash
GET /cash/balance
Authorization: Bearer <token>

响应:
{
  "balance": 5200  // 只计算已审核的有效交易
}
```

#### 审核资金流水

```bash
PUT /cash/transactions/:id/verify
Content-Type: application/json

{
  "version": 1
}
```

### 订单 API

#### 审核订单（支持当场结算）

```bash
POST /orders/:type/:id/verify
Content-Type: application/json

{
  "version": 1,
  "settled_immediately": true  // 自动创建未审核的资金流水
}
```

---

## 常见问题

### Q: 如何重置管理员密码？

```bash
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('newpassword123', 10).then(hash => {
  console.log(hash);
});"

# 更新数据库
mysql -u root -p djsh_finance_db \
  -e "UPDATE users SET password_hash = 'NEW_HASH' WHERE username = 'admin';"
```

### Q: 前端无法连接到后端？

检查清单：
1. ✓ 后端服务是否运行：`curl http://192.168.8.105:8080/lookups/version`
2. ✓ `.env.local` 中 API 地址是否正确
3. ✓ CORS 配置是否包含前端地址
4. ✓ 防火墙是否允许访问

### Q: 为什么余额计算不对？

余额只计算**同时满足**以下条件的交易：
- ✅ 已审核（verified=1）
- ✅ 未废除（cancelled=0）
- ✅ 未删除（deleted_at IS NULL）

未审核的流水（如订单自动创建的流水）不会计入余额。

### Q: 订单审核后如何自动创建流水？

在审核订单页面勾选"当场结算"选项：
1. 销售订单 → 自动创建收入流水（未审核）
2. 采购订单 → 自动创建支出流水（未审核）
3. 在资金流水页面审核这些流水后，余额会自动更新

### Q: 如何查看库存情况？

访问"数据统计"页面的"库存统计"标签：
- 查看每个商品的采购、销售和库存数量
- 自动标识负库存和库存不足的商品
- 查看成本、收入和利润

### Q: 如何备份数据库？

```bash
# 备份
mysqldump -u root -p djsh_finance_db > backup_$(date +%Y%m%d).sql

# 恢复
mysql -u root -p djsh_finance_db < backup_20260110.sql
```

---

## 默认账户

| 用户名 | 密码 | 角色 | 说明 |
|--------|------|------|------|
| admin | admin123 | 管理员 | 默认管理员账户，**首次登录后请修改密码** |

---

## 项目结构

```
DJSH/
├── src/                          # 前端代码
│   ├── app/                      # Next.js 页面
│   │   ├── login/               # 登录页面
│   │   ├── dashboard/           # 仪表盘
│   │   ├── verify/              # 审核队列
│   │   ├── orders/              # 订单管理
│   │   ├── contacts/            # 客户管理
│   │   ├── products/            # 产品管理
│   │   ├── cash/                # 资金流水
│   │   ├── statistics/          # 数据统计（新增）
│   │   ├── logs/                # 操作日志
│   │   └── layout.tsx           # 根布局
│   ├── components/              # React 组件
│   │   ├── ui/                  # 基础 UI 组件（含 checkbox）
│   │   ├── nav/                 # 导航组件
│   │   └── layout/              # 布局组件
│   ├── features/                # 功能模块
│   │   ├── cash/                # 资金流水组件（新增）
│   │   ├── orders/              # 订单组件
│   │   └── verify/              # 审核组件
│   ├── lib/                     # 工具库
│   │   ├── auth/                # 认证模块
│   │   ├── apiClient.ts         # API 客户端
│   │   └── format.ts            # 格式化工具
│   └── types/                   # TypeScript 类型定义
│
├── backend/                     # 后端代码
│   ├── server.js                # Express 主文件
│   ├── app.js                   # 应用配置
│   ├── config/                  # 配置文件
│   │   ├── database.js          # 数据库配置
│   │   ├── auth.js              # 认证配置
│   │   └── cors.js              # CORS 配置
│   ├── middleware/              # 中间件
│   │   ├── auth.js              # 认证中间件
│   │   ├── errorHandler.js      # 错误处理
│   │   └── logger.js            # 日志中间件
│   ├── routes/                  # 路由
│   │   ├── auth.js              # 认证路由
│   │   ├── orders.js            # 订单路由
│   │   ├── cash.js              # 资金流水路由（新增）
│   │   ├── statistics.js        # 统计路由（新增）
│   │   └── ...
│   ├── controllers/             # 控制器
│   │   ├── cashController.js    # 资金流水控制器（新增）
│   │   ├── statisticsController.js  # 统计控制器（新增）
│   │   └── ...
│   ├── services/                # 业务逻辑
│   │   ├── cashService.js       # 资金流水服务（新增）
│   │   ├── statisticsService.js # 统计服务（新增）
│   │   └── ...
│   ├── repositories/            # 数据访问层
│   │   ├── cashRepository.js    # 资金流水仓库（新增）
│   │   ├── cashImageRepository.js  # 资金流水图片仓库（新增）
│   │   ├── statisticsRepository.js  # 统计仓库（新增）
│   │   └── ...
│   ├── utils/                   # 工具函数
│   │   ├── password.js          # 密码哈希
│   │   └── responseMapper.js    # 响应映射
│   └── .env                     # 环境变量
│
├── database/                    # 数据库文件
│   ├── schema.sql               # 数据库架构
│   └── migrations/              # 数据库迁移
│
├── .github/                     # GitHub Actions
│   └── workflows/
│       └── docker-build.yml     # Docker 构建工作流
│
├── .env.local                   # 前端环境变量
├── package.json                 # 前端依赖配置
├── docker-compose.yml           # Docker 编排文件
└── README.md                    # 本文件
```

---

## 最新更新 (2026-01-10)

### 新增功能

1. **资金流水图片功能**
   - 支持上传多张图片附件
   - 图片以 Base64 格式存储
   - 支持查看、删除图片

2. **资金流水审核机制**
   - 手动创建默认已审核
   - 订单当场结算自动创建默认未审核
   - 只有已审核的流水计入余额

3. **客户类型分类**
   - 下游客户（customer）- 用于销售订单和收入流水
   - 上游供应商（supplier）- 用于采购订单和支出流水
   - 全是（both）- 两种业务都可用

4. **订单当场结算**
   - 审核订单时可勾选"当场结算"
   - 自动创建对应的资金流水（未审核状态）
   - 销售订单 → 收入流水，采购订单 → 支出流水

5. **数据统计功能**
   - 客户应收账款统计（欠收/预收/已结清）
   - 商品销售统计（销售量、收入、均价）
   - 库存统计（进货、出货、库存、利润）
   - 自动预警（负库存、库存不足）

6. **余额计算修复**
   - 从前端累计计算改为后端 SQL 查询
   - 排除已废除和未审核的交易
   - 确保余额始终准确

### 技术改进

- ✅ 修复前端页面加载问题
- ✅ 优化客户类型筛选逻辑
- ✅ 添加乐观锁版本控制
- ✅ 完善操作日志记录
- ✅ 支持多设备局域网访问

---

## 许可证

本项目为内部使用项目。

**最后更新**: 2026-01-10
**版本**: 2.0.0
**作者**: Peng Yusheng
