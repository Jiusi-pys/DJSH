# 丁记商行 - 进销存财务管理系统

## 📋 目录

- [项目简介](#项目简介)
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

丁记商行进销存财务管理系统是一款专业的企业级业务管理工具，支持：

- 📦 **进销存管理** - 订单、客户、产品全生命周期管理
- 💰 **财务管理** - 现金流、账款统计
- 📊 **数据分析** - 销售趋势、产品排名、客户统计
- 👥 **权限管理** - 基于角色的访问控制（RBAC）
- 🔐 **用户认证** - JWT + HTTP-Only Cookie 安全认证
- 📝 **操作日志** - 完整的审计追踪和操作记录

**特点**：
- 响应式设计，支持移动端和桌面端
- 实时数据验证和业务规则检查
- 乐观锁机制防止数据冲突
- 完整的错误处理和日志记录

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
│  │ ├─ /contacts - 客户管理                                │  │
│  │ ├─ /products - 产品管理                                │  │
│  │ ├─ /orders - 订单管理                                  │  │
│  │ ├─ /cash - 现金管理                                    │  │
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
│  ├─ 事务表: order_items, order_images, cash_transactions   │  │
│  ├─ 日志表: operation_logs, login_attempts, refresh_tokens │  │
│  └─ 视图: 9个复杂查询视图用于数据聚合                       │  │
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

### 权限模型

```
┌─────────────────────────────────────────────────────┐
│              用户角色 (user.role)                    │
├─────────────────────────────────────────────────────┤
│  ├─ admin (管理员)                                   │
│  │  └─ 所有权限 (完全访问所有功能)                   │
│  │                                                   │
│  └─ user (普通用户)                                  │
│     ├─ 仅可查看: 客户、产品、订单、资金              │
│     ├─ 可创建订单                                    │
│     ├─ 可编辑自己创建的订单                         │
│     ├─ 可上传订单相关图片                           │
│     ├─ 不可: 审核订单、删除数据、管理用户           │
│     └─ 不可: 访问日志、修改系统设置                 │
└─────────────────────────────────────────────────────┘
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

存储用户账户信息和认证数据：

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,          -- 唯一用户名
  password_hash VARCHAR(255) NOT NULL,           -- bcrypt 哈希（不存储明文）
  role ENUM('admin', 'user') DEFAULT 'user',   -- 用户角色
  status ENUM('active', 'locked', 'disabled') DEFAULT 'active',
  display_name VARCHAR(100),                     -- 显示名称
  failed_login_attempts INT DEFAULT 0,           -- 登录失败计数
  locked_until TIMESTAMP NULL,                   -- 锁定截止时间
  last_login_at TIMESTAMP NULL,                  -- 最后登录时间
  last_login_ip VARCHAR(45),                     -- 最后登录 IP
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**说明**:
- `password_hash`: 永远不存储明文，使用 bcrypt 10 轮 salt 加密
- `status`: 防止暴力破解，5 次失败自动锁定，持续 30 分钟
- `failed_login_attempts`: 成功登录时重置为 0

#### 2. 联系人表 (contacts)

存储客户和供应商信息：

```sql
CREATE TABLE contacts (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  email VARCHAR(100),
  address TEXT,
  contact_type ENUM('customer', 'supplier', 'both') DEFAULT 'customer',
  balance DECIMAL(15,2) DEFAULT 0.00,           -- 账户余额
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL                     -- 软删除（不真正删除）
);
```

#### 3. 产品表 (products)

存储商品信息：

```sql
CREATE TABLE products (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  spec VARCHAR(100),                            -- 规格型号
  unit VARCHAR(20) DEFAULT '个',
  unit_price DECIMAL(15,2) DEFAULT 0.00,
  category VARCHAR(50),
  stock_quantity DECIMAL(15,2) DEFAULT 0,       -- 库存数量
  remark TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);
```

#### 4. 订单表 (orders)

存储销售和采购订单：

```sql
CREATE TABLE orders (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(50) NOT NULL UNIQUE,         -- 唯一订单编号
  order_type ENUM('sales', 'purchase'),         -- 订单类型
  contact_id BIGINT,                            -- 客户/供应商 ID
  order_date DATE NOT NULL,
  total_amount DECIMAL(15,2) DEFAULT 0.00,

  -- 状态字段（支持多种组合）
  auto_verified TINYINT DEFAULT 0,              -- 自动验证
  manual_verified TINYINT DEFAULT 0,            -- 人工审核
  settled TINYINT DEFAULT 0,                    -- 是否结算
  cancelled TINYINT DEFAULT 0,                  -- 是否废弃

  cancelled_reason TEXT,
  cancelled_at TIMESTAMP NULL,
  version INT DEFAULT 1,                        -- 乐观锁版本号（防止并发冲突）
  issues JSON,                                  -- 问题标签（JSON 格式）
  remark TEXT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP NULL
);
```

**特点**:
- `version`: 乐观锁，更新时检查版本号，防止覆盖其他用户的修改
- `issues`: 存储 JSON 格式的问题标签（如缺少发票、金额错误等）

#### 5. 订单明细表 (order_items)

```sql
CREATE TABLE order_items (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  order_id BIGINT NOT NULL,
  product_id BIGINT,                           -- 可为 NULL（未关联产品）
  product_name_raw VARCHAR(200),               -- 原始产品名称
  unit VARCHAR(20) DEFAULT '个',
  unit_price DECIMAL(15,2) DEFAULT 0.00,
  quantity DECIMAL(15,3) DEFAULT 0,
  line_total DECIMAL(15,2) DEFAULT 0.00,       -- 行小计
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
```

#### 6. 操作日志表 (operation_logs)

完整的操作审计追踪，支持数据恢复和合规检查：

```sql
CREATE TABLE operation_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT,                              -- 操作用户 ID
  module VARCHAR(50) NOT NULL,                 -- 模块: auth, contacts, orders 等
  action VARCHAR(50) NOT NULL,                 -- 操作: create, update, delete, login
  target_type VARCHAR(50),                     -- 目标类型: user, contact, order
  target_id BIGINT,
  target_name VARCHAR(200),

  -- 请求信息
  request_method VARCHAR(10),
  request_path VARCHAR(500),
  ip_address VARCHAR(45),
  user_agent TEXT,

  -- 数据变化
  old_data JSON,                               -- 变更前数据
  new_data JSON,                               -- 变更后数据

  -- 执行结果
  status ENUM('success', 'failed') DEFAULT 'success',
  error_message TEXT,
  duration_ms INT,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. 其他辅助表

- **refresh_tokens**: 存储刷新令牌（哈希形式）
- **login_attempts**: 记录每次登录尝试（用于防暴力破解）
- **order_images**: 存储订单附件图片（Base64 编码）
- **cash_transactions**: 现金交易记录

### 数据库视图（9 个）

| 视图名 | 用途 | 使用场景 |
|--------|------|---------|
| `v_pending_verification` | 待审核订单列表 | 审核队列页面 |
| `v_sales_summary` | 销售订单汇总统计 | 仪表盘销售数据 |
| `v_purchase_summary` | 采购订单汇总统计 | 仪表盘采购数据 |
| `v_customer_receivables` | 客户应收账款 | 财务报表 |
| `v_supplier_payables` | 供应商应付账款 | 财务报表 |
| `v_product_sales_ranking` | 产品销售排名 | 产品分析 |
| `v_daily_cash_flow` | 每日现金流统计 | 资金分析 |
| `v_order_details` | 订单详情（含产品信息） | 订单详情页 |
| `v_recent_logs` | 最近 100 条操作日志 | 审计日志 |

---

## 认证和安全

### JWT 令牌机制

```
访问令牌 (accessToken)
├─ 有效期: 8 小时
├─ 储存位置: HTTP-Only Cookie (无法被 JavaScript 访问，防止 XSS 攻击)
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
│  └─ 数据库: 哈希形式（原始令牌从不存储）
├─ 用途: 在 accessToken 过期时获取新的 accessToken
├─ 特点: 从不用来直接访问 API，只用于续期
└─ 安全: 失效后立即撤销
```

### 密码安全

```
用户输入密码: "admin123"
             ↓
bcrypt 哈希处理 (10 轮 salt)
             ↓
存储哈希值: $2b$10$ufI7AqWbhl5DqBE6Z/p7A.zA5zruGedW1C/Hty2OrBa8lVl4iHLdy
             ↓
验证时: bcrypt.compare(输入密码, 存储的哈希)
```

**特点**:
- ❌ 永不存储明文密码
- ✅ 使用 bcrypt（比 MD5/SHA1 安全得多）
- ✅ 每个密码都有唯一的 salt
- ✅ 即使数据库泄露也无法恢复原始密码

### 登录防暴力破解

```
登录尝试 1-4 次失败
  ↓
记录失败次数 +1，返回错误

第 5 次失败登录 →
  ├─ 将账户状态改为 'locked'
  ├─ 设置 locked_until = 现在 + 30 分钟
  ├─ 返回错误: "账户已锁定，请稍后重试"
  └─ 数据库记录此次尝试

等待 30 分钟
  ↓
自动解锁或管理员手动解锁
  ↓
成功登录
  ├─ 失败计数重置为 0
  └─ 状态恢复为 'active'
```

### CORS 跨域策略

```
允许的来源 (origins):
├─ http://localhost:3000      (本地开发)
├─ http://localhost:3001      (备用端口)
├─ http://127.0.0.1:3000      (本地回环)
├─ http://192.168.8.105:3000  (内网地址)
└─ 自定义来源 (从环境变量读取)

允许的 HTTP 方法:
├─ GET, POST, PUT, DELETE, PATCH, OPTIONS

允许的请求头:
├─ Content-Type
└─ Authorization

凭证设置:
└─ credentials: true (允许发送 Cookie)
```

---

## 环境配置

### 前端环境变量

**文件位置**: `/home/jiusi/DJSH/.env.local`

```bash
# API 服务器地址（必须配置）
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

说明：
- `NEXT_PUBLIC_` 前缀表示变量会被编译到浏览器代码中（对客户端可见）
- 开发环境：使用 `http://localhost:8080`
- 生产环境：改为你的实际域名，如 `https://api.example.com`

### 后端环境变量

**文件位置**: `/home/jiusi/DJSH/backend/.env`

```bash
# ====== 数据库配置 ======
DB_HOST=localhost              # MySQL 服务器地址
DB_PORT=3306                   # MySQL 端口
DB_USER=root                   # MySQL 用户名
DB_PASSWORD=your_password      # MySQL 密码（改成你的）
DB_NAME=djsh_finance_db        # 数据库名称

# ====== 服务配置 ======
PORT=8080                      # 后端服务运行端口

# ====== JWT 密钥（生产环境必须修改！）======
JWT_ACCESS_SECRET=2f0bbadbc9b437292f8ead7cd96ac866c31b14f5582987e46512e6e9faee8e0d
JWT_REFRESH_SECRET=a3fac4029130d875bc24ac358342d953220039aa508ea4f46b353b122cb6e1f4

# ====== CORS 跨域配置 ======
FRONTEND_URL=http://localhost:3000    # 前端地址（用于 CORS 验证）

# ====== TLS/HTTPS 配置 ======
ENABLE_HTTPS=false                     # false: HTTP, true: HTTPS
TLS_CERT_PATH=./certs/server.crt      # 证书路径
TLS_KEY_PATH=./certs/server.key       # 密钥路径
```

### 生成新的 JWT 密钥

```bash
# 生成 32 字节（256 位）的随机密钥
openssl rand -hex 32

# 输出类似:
# 2f0bbadbc9b437292f8ead7cd96ac866c31b14f5582987e46512e6e9faee8e0d
```

### 创建自签名 TLS 证书（仅用于本地开发）

```bash
cd /home/jiusi/DJSH/backend/certs

# 生成 365 天有效的自签名证书
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout server.key \
  -out server.crt \
  -subj "/C=CN/ST=Local/L=Local/O=DJSH/OU=Dev/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"
```

---

## 部署教程

### 系统要求

```
操作系统: Linux / macOS / Windows (with WSL)
Node.js: 18.0 或更高版本
npm: 9.0 或更高版本
MySQL: 8.0 或更高版本
内存: 最少 512MB RAM
磁盘: 最少 1GB 可用空间
```

### 1. 数据库初始化

#### Step 1: 创建数据库和表

```bash
# 登录 MySQL
mysql -u root -p

# 在 MySQL 命令行中执行：
source /home/jiusi/DJSH/database/schema.sql;
source /home/jiusi/DJSH/database/migrations/001_add_users_table.sql;
```

#### Step 2: 验证安装

```bash
# 查看是否成功创建用户表
mysql -u root -p djsh_finance_db -e "SELECT id, username, role, status FROM users;"

# 应该显示默认管理员:
# id | username | role  | status
# 1  | admin    | admin | active
```

### 2. 后端部署

#### Step 1: 安装依赖

```bash
cd /home/jiusi/DJSH/backend
npm install
```

#### Step 2: 配置环境变量

编辑 `.env` 文件：

```bash
nano .env

# 主要修改以下内容：
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
PORT=8080
```

#### Step 3: 启动服务

**开发模式（HTTP）**：
```bash
npm start
```

**生产模式（HTTPS）**：
```bash
ENABLE_HTTPS=true npm start
```

**验证启动**：
```bash
# 检查服务是否运行
curl http://localhost:8080/lookups/version

# 应该返回类似:
# {"version":"2026-01-09T10:00:00.000Z"}
```

### 3. 前端部署

#### Step 1: 安装依赖

```bash
cd /home/jiusi/DJSH
npm install
```

#### Step 2: 配置环境变量

创建或修改 `.env.local`：

```bash
echo "NEXT_PUBLIC_API_BASE_URL=http://your-backend-ip:8080" > .env.local
```

#### Step 3: 启动开发服务

```bash
npm run dev
```

访问：`http://localhost:3000`

#### Step 4: 构建生产版本

```bash
npm run build
npm start
```

### 4. 使用 PM2 进程管理（推荐用于生产）

#### Step 1: 安装 PM2

```bash
npm install -g pm2
```

#### Step 2: 启动后端服务

```bash
cd /home/jiusi/DJSH/backend

# 启动
pm2 start server.js --name "djsh-backend"
```

#### Step 3: 启动前端服务

```bash
cd /home/jiusi/DJSH

# 先构建
npm run build

# 启动
pm2 start npm --name "djsh-frontend" -- start
```

#### Step 4: 进程管理命令

```bash
# 查看所有进程
pm2 list

# 查看日志
pm2 logs djsh-backend
pm2 logs djsh-frontend

# 重启
pm2 restart djsh-backend djsh-frontend

# 停止
pm2 stop djsh-backend djsh-frontend

# 删除
pm2 delete djsh-backend djsh-frontend

# 设置开机自启
pm2 startup
pm2 save
```

---

## CI/CD 流程

![Docker Build](https://github.com/jiusi/DJSH/actions/workflows/docker-build.yml/badge.svg)

本项目使用 GitHub Actions 自动化构建和部署 Docker 镜像。每当代码推送到 `main` 或 `jiusi` 分支时，工作流会自动：

1. **验证** - 检查 Docker Compose 配置文件的有效性
2. **构建** - 为前端和后端构建多平台镜像 (amd64 + arm64)
3. **推送** - 将镜像推送到 Docker Hub
4. **扫描** - 使用 Trivy 进行安全漏洞扫描
5. **总结** - 生成部署指令和构建摘要

### 工作流特性

- ✅ **多平台构建** - 支持 Linux AMD64 和 ARM64 架构
- ✅ **安全扫描** - Trivy 检测 HIGH 和 CRITICAL 级别的漏洞
- ✅ **层缓存** - GitHub Actions 缓存加速后续构建
- ✅ **镜像标签** - 自动生成 `latest`、分支名和提交 SHA 标签
- ✅ **并发控制** - 同一分支只允许一个构建任务运行

### 镜像信息

所有镜像推送到 Docker Hub：

```
docker.io/<username>/djsh-frontend:<tag>
docker.io/<username>/djsh-backend:<tag>
```

**标签策略**：
- `latest` - 最新版本（仅来自 main/jiusi）
- `<branch>` - 分支名称（如 `jiusi`）
- `<branch>-<sha>` - 分支名加提交哈希（可追踪具体版本）

### 快速部署

构建完成后，使用新镜像部署：

```bash
# 拉取最新镜像
docker pull <username>/djsh-frontend:latest
docker pull <username>/djsh-backend:latest

# 部署
docker compose up -d
```

### 更多信息

详见 [docs/CI-CD.md](docs/CI-CD.md) 获取完整的：
- 工作流架构详解
- 故障排除指南
- 性能预期
- 安全扫描配置
- 部署验证步骤

---

## API 文档

### 认证 API

#### 登录

```bash
POST /auth/login
Content-Type: application/json

请求:
{
  "username": "admin",
  "password": "admin123"
}

成功响应 (200):
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "username": "admin",
      "role": "admin",
      "displayName": "系统管理员"
    },
    "accessToken": "eyJ...",
    "refreshToken": "4dce...",
    "expiresIn": 28800
  }
}

失败响应 (401):
{
  "success": false,
  "error": "INVALID_CREDENTIALS",
  "message": "用户名或密码错误",
  "attemptsRemaining": 4
}
```

#### 登出

```bash
POST /auth/logout
Authorization: Bearer <accessToken>

响应 (200):
{
  "success": true,
  "message": "已成功登出"
}
```

#### 获取当前用户

```bash
GET /auth/me
Authorization: Bearer <accessToken>

响应 (200):
{
  "success": true,
  "data": {
    "id": 1,
    "username": "admin",
    "role": "admin",
    "displayName": "系统管理员",
    "status": "active"
  }
}
```

#### 刷新令牌

```bash
POST /auth/refresh
Content-Type: application/json

请求:
{
  "refreshToken": "4dce8691..."
}

响应 (200):
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 28800
  }
}
```

### 业务 API

所有业务 API 都需要认证（Authorization header 或 Cookie）

#### 获取订单列表

```bash
GET /orders/sales?page=1&page_size=20&manual_verified=false
Authorization: Bearer <accessToken>

响应:
{
  "page": 1,
  "page_size": 20,
  "total": 100,
  "items": [...]
}
```

#### 获取仪表盘数据

```bash
GET /dashboard/stats
Authorization: Bearer <accessToken>

响应:
{
  "totalRevenue": 100000,
  "orderCount": 50,
  "topProducts": [...],
  "topCustomers": [...],
  ...
}
```

---

## 常见问题

### Q: 如何重置管理员密码？

```bash
# 1. 生成新密码的哈希值
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('newpassword123', 10).then(hash => {
  console.log(hash);
});"

# 2. 更新数据库
mysql -u root -p djsh_finance_db \
  -e "UPDATE users SET password_hash = 'NEW_HASH_HERE' WHERE username = 'admin';"
```

### Q: 如何添加新用户？

```bash
# 1. 生成密码哈希
node -e "
const bcrypt = require('bcrypt');
bcrypt.hash('user123', 10).then(hash => {
  console.log(hash);
});"

# 2. 插入数据库
mysql -u root -p djsh_finance_db \
  -e "INSERT INTO users (username, password_hash, role, display_name)
       VALUES ('newuser', 'HASH_HERE', 'user', '新用户');"
```

### Q: 如何启用 HTTPS？

生产环境建议使用正规 CA 签发的证书（如 Let's Encrypt 免费证书）：

```bash
# 1. 获取证书后放在 certs 目录
# 2. 修改 .env
ENABLE_HTTPS=true
TLS_CERT_PATH=./certs/certificate.pem
TLS_KEY_PATH=./certs/private.key

# 3. 重启服务
npm restart
```

### Q: 前端无法连接到后端？

检查清单：
1. ✓ 后端服务是否运行：`curl http://localhost:8080/lookups/version`
2. ✓ `.env.local` 中 `NEXT_PUBLIC_API_BASE_URL` 是否正确
3. ✓ CORS 配置是否包含前端地址
4. ✓ 防火墙是否允许访问后端端口
5. ✓ 浏览器开发者工具（F12）Network 标签查看具体错误

### Q: 登录失败"密码错误"？

检查：
1. 用户名是否正确（区分大小写）
2. 密码是否正确
3. 账户是否被锁定（5 次失败会锁定 30 分钟）

```bash
# 查看账户状态
mysql -u root -p djsh_finance_db \
  -e "SELECT id, username, status, failed_login_attempts FROM users WHERE username = 'admin';"
```

### Q: 如何恢复被锁定的账户？

```bash
mysql -u root -p djsh_finance_db \
  -e "UPDATE users SET status = 'active', failed_login_attempts = 0, locked_until = NULL WHERE username = 'admin';"
```

### Q: 数据库查询变慢？

```bash
# 添加必要的索引
ALTER TABLE operation_logs ADD INDEX idx_created_at (created_at);
ALTER TABLE orders ADD INDEX idx_order_date (order_date);
ALTER TABLE orders ADD INDEX idx_contact_id (contact_id);
```

### Q: 如何备份数据库？

```bash
# 备份
mysqldump -u root -p djsh_finance_db > backup_$(date +%Y%m%d).sql

# 恢复
mysql -u root -p djsh_finance_db < backup_20260109.sql
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
│   │   ├── cash/                # 现金管理
│   │   ├── logs/                # 操作日志
│   │   └── layout.tsx           # 根布局
│   ├── components/              # React 组件
│   │   ├── ui/                  # 基础 UI 组件
│   │   ├── nav/                 # 导航组件
│   │   └── layout/              # 布局组件
│   ├── lib/                      # 工具库
│   │   ├── auth/                # 认证模块
│   │   ├── apiClient.ts         # API 客户端
│   │   └── utils.ts             # 工具函数
│   └── types/                   # TypeScript 类型定义
│
├── backend/                      # 后端代码
│   ├── server.js                # Express 主文件
│   ├── config/                  # 配置文件
│   │   ├── database.js          # 数据库配置
│   │   └── auth.js              # 认证配置
│   ├── middleware/              # 中间件
│   │   ├── auth.js              # 认证中间件
│   │   ├── rateLimiter.js       # 限流中间件
│   │   └── logger.js            # 日志中间件
│   ├── routes/                  # 路由
│   │   └── auth.js              # 认证路由
│   ├── utils/                   # 工具函数
│   │   ├── password.js          # 密码哈希
│   │   ├── jwt.js               # JWT 令牌
│   │   └── permissions.js       # 权限检查
│   ├── certs/                   # TLS 证书
│   │   ├── server.crt           # 证书文件
│   │   └── server.key           # 私钥文件
│   ├── .env                     # 环境变量（生产）
│   └── package.json             # 依赖配置
│
├── database/                    # 数据库文件
│   ├── schema.sql               # 数据库架构
│   └── migrations/              # 数据库迁移
│       └── 001_add_users_table.sql
│
├── .env.local                   # 前端环境变量
├── package.json                 # 前端依赖配置
└── README.md                    # 本文件
```

---

## 许可证

本项目为内部使用项目。

**最后更新**: 2026-01-09
**版本**: 1.0.0
