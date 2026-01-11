# Receipt OCR Scanning System

票据扫描自动入库系统 - 使用OCR技术自动识别票据并创建订单

## 📋 系统概述

本系统采用**混合架构**设计，结合以下技术：
- **Tesseract.js** - 开源OCR引擎，识别票据文字
- **OpenAI GPT / Claude** - LLM智能解析结构化数据
- **Levenshtein距离** - 模糊匹配产品到数据库
- **数据库事务** - 确保数据一致性
- **重试机制** - 自动处理临时故障

---

## 🚀 快速开始

### 1. 安装依赖

```bash
cd backend
npm install
```

新增依赖包括：
- `tesseract.js@5.0.4` - OCR引擎
- `openai@4.28.0` - OpenAI API客户端
- `@anthropic-ai/sdk@0.24.0` - Claude API客户端
- `winston@3.11.0` - 日志系统

### 2. 运行数据库迁移

```bash
mysql -u root -p djsh_finance_db < database/migrations/003_extend_scan_jobs_for_ocr.sql
```

这将：
- 扩展`scan_jobs`表字段（重试次数、错误信息、图片哈希等）
- 创建`scan_jobs_dead_letter`表（失败任务队列）
- 添加必要的索引

### 3. 配置环境变量

在`backend/.env`文件中添加：

```bash
# LLM API配置（二选一）
LLM_PROVIDER=openai          # 或 anthropic
OPENAI_API_KEY=sk-...        # OpenAI API密钥
# ANTHROPIC_API_KEY=sk-ant-...  # Claude API密钥（如果使用Claude）

# OCR配置
RECEIPTS_DIR=/Users/jiusi/receipts  # 票据文件夹根目录
BATCH_SIZE=50                        # 每次处理任务数量
WORKER_POOL_SIZE=5                   # 并行worker数量
MAX_RETRIES=3                        # 最大重试次数

# 日志配置
LOG_LEVEL=info                       # debug | info | warn | error
LOG_DIR=./logs                       # 日志目录
```

### 4. 创建票据目录结构

```bash
mkdir -p /Users/jiusi/receipts/sales
mkdir -p /Users/jiusi/receipts/purchase
```

目录结构规则：
```
/Users/jiusi/receipts/
├── sales/                    # 销售订单票据
│   ├── 2026-01-11/
│   │   ├── receipt_001.jpg
│   │   └── receipt_002.png
│   └── 2026-01-12/
│       └── receipt_003.jpg
└── purchase/                 # 采购订单票据
    └── 2026-01-11/
        └── receipt_001.jpg
```

**重要**：
- 票据必须按日期分类到`YYYY-MM-DD`子文件夹
- 销售票据放在`sales/`，采购票据放在`purchase/`
- 支持格式：`.jpg`, `.jpeg`, `.png`, `.pdf`

---

## 📝 使用说明

### 方式一：手动运行扫描

```bash
# 基本用法 - 处理所有待处理任务
npm run ocr:scan

# 或直接运行脚本
node cli/receipt-scanner.js
```

### 方式二：预览模式（不执行）

```bash
# 查看有哪些任务待处理，但不实际执行
npm run ocr:scan:dry

# 或
node cli/receipt-scanner.js --dry-run
```

### 方式三：调试模式

```bash
# 启用详细日志
npm run ocr:scan:debug

# 或
node cli/receipt-scanner.js --debug
```

### 方式四：重置卡住的任务

```bash
# 重置超过30分钟未完成的任务
npm run ocr:reset-stuck

# 或
node cli/receipt-scanner.js --reset-stuck
```

### 方式五：自定义参数

```bash
# 只处理10个任务，启用调试
node cli/receipt-scanner.js --batch-size 10 --debug

# 先重置卡住任务，再处理50个任务
node cli/receipt-scanner.js --reset-stuck --batch-size 50
```

---

## ⏰ 定时任务配置

### 使用Cron（推荐）

编辑crontab：
```bash
crontab -e
```

添加以下行（每小时9am-2am运行）：
```cron
0 9-23,0-2 * * * cd /Users/jiusi/Documents/DJSH/backend && /usr/bin/node cli/receipt-scanner.js >> /tmp/ocr-scanner.log 2>&1
```

### 使用systemd Timer（Linux系统）

创建服务文件`/etc/systemd/system/receipt-ocr-scanner.service`：
```ini
[Unit]
Description=Receipt OCR Scanner

[Service]
Type=oneshot
User=jiusi
WorkingDirectory=/Users/jiusi/Documents/DJSH/backend
Environment="NODE_ENV=production"
ExecStart=/usr/bin/node cli/receipt-scanner.js
StandardOutput=journal
StandardError=journal
```

创建定时器`/etc/systemd/system/receipt-ocr-scanner.timer`：
```ini
[Unit]
Description=Receipt OCR Scanner Timer

[Timer]
OnCalendar=hourly
Persistent=true

[Install]
WantedBy=timers.target
```

启动定时器：
```bash
sudo systemctl enable receipt-ocr-scanner.timer
sudo systemctl start receipt-ocr-scanner.timer
sudo systemctl status receipt-ocr-scanner.timer
```

---

## 🔄 工作流程

### 1. 准备票据

手动或程序将票据图片放入正确的文件夹：

```bash
# 销售订单票据
/Users/jiusi/receipts/sales/2026-01-11/receipt_001.jpg

# 采购订单票据
/Users/jiusi/receipts/purchase/2026-01-11/supplier_invoice.jpg
```

### 2. 创建扫描任务

在`scan_jobs`表中插入记录（可以手动或通过API）：

```sql
INSERT INTO scan_jobs (image_path, scan_type, status)
VALUES ('/Users/jiusi/receipts/sales/2026-01-11/receipt_001.jpg', 'sales', 'pending');
```

或使用Web界面上传图片（如果已实现）。

### 3. 运行扫描器

```bash
npm run ocr:scan
```

系统将：
1. ✅ 查询数据库中`status='pending'`的任务
2. ✅ 使用Tesseract OCR提取文字
3. ✅ 使用LLM解析为结构化数据（联系人、日期、商品列表）
4. ✅ 模糊匹配产品到数据库（Levenshtein距离，阈值0.7）
5. ✅ 精确匹配联系人（必须完全匹配）
6. ✅ 推断商品单位（如果OCR未识别）
7. ✅ 创建订单（只包含匹配成功的商品）
8. ✅ 更新任务状态为`completed`

### 4. 查看结果

**成功的订单**：
```sql
SELECT * FROM orders WHERE remark LIKE '%OCR自动扫描%';
```

**未匹配的商品**：
查看生成的JSON报告：
```bash
cat reports/ocr/ocr-report-2026-01-11T10-30-00.json
```

**失败的任务**：
```sql
SELECT * FROM scan_jobs WHERE status = 'failed';
SELECT * FROM scan_jobs_dead_letter WHERE resolution_status = 'pending';
```

---

## 📊 数据流说明

### OCR识别结果格式

LLM解析后的JSON格式：
```json
{
  "contact_name": "张三餐厅",
  "order_date": "2026-01-11",
  "order_no": "INV-20260111-001",
  "items": [
    {
      "name": "苹果 红富士",
      "unit": "箱",
      "quantity": 10,
      "unit_price": 25.50,
      "total": 255.00
    },
    {
      "name": "香蕉 进口",
      "unit": "",
      "quantity": 5,
      "unit_price": 15.00,
      "total": 75.00
    }
  ],
  "total_amount": 330.00,
  "confidence": 0.92
}
```

### 产品匹配逻辑

```
OCR产品名: "苹果 红富士"
          ↓
数据库产品列表:
  1. "苹果" (similarity: 0.50)
  2. "红富士苹果" (similarity: 0.85) ← 最佳匹配
  3. "香蕉" (similarity: 0.20)
          ↓
匹配结果: product_id=2, confidence=0.85 (> 0.7阈值)
```

### 单位推断规则

| 产品名称包含 | 推断单位 |
|------------|---------|
| "箱" | 箱 |
| "盒" | 盒 |
| "包" | 包 |
| "袋" | 袋 |
| "斤" | 斤 |
| "两" | 两 |
| "件" | 件 |
| 其他 | 个（默认） |

---

## 🔍 故障排查

### 问题1：OCR无法识别文字

**症状**：日志显示 `OCR extracted empty text from image`

**原因**：
- 图片质量太差
- 图片格式不支持
- 文字太小或模糊

**解决**：
1. 检查图片是否清晰可读
2. 使用扫描仪扫描而非手机拍照
3. 确保图片分辨率 > 300 DPI

### 问题2：LLM解析失败

**症状**：日志显示 `Missing required field: contact_name`

**原因**：
- OCR文字质量太差，LLM无法识别结构
- 票据格式不标准

**解决**：
1. 查看日志中的OCR原文
2. 如果OCR文字混乱，改善图片质量
3. 如果OCR正确但LLM解析失败，检查prompt配置

### 问题3：产品匹配率低

**症状**：大量商品未匹配，报告中`unmatchedCount`很高

**原因**：
- OCR识别的产品名称与数据库差异大
- 匹配阈值(0.7)太严格

**解决**：
1. 标准化数据库中的产品名称
2. 调整匹配阈值：编辑`backend/config/ocr.js`
   ```javascript
   matching: {
     productThreshold: 0.6,  // 降低到60%
   }
   ```
3. 查看日志中的匹配详情：`npm run ocr:scan:debug`

### 问题4：联系人未匹配

**症状**：订单中`contact_id`为`null`

**原因**：
- 联系人名称不完全匹配（系统要求精确匹配）
- 数据库中没有该联系人

**解决**：
1. 在数据库中添加该联系人
2. 确保名称完全一致（包括空格、标点）
3. 查看日志中的联系人匹配详情

### 问题5：任务卡在processing状态

**症状**：`SELECT * FROM scan_jobs WHERE status='processing'` 返回很多记录

**原因**：
- 扫描器进程被强制终止
- 系统崩溃

**解决**：
```bash
# 重置卡住的任务
npm run ocr:reset-stuck

# 或手动SQL
UPDATE scan_jobs
SET status='pending', processing_started_at=NULL
WHERE status='processing' AND processing_started_at < NOW() - INTERVAL 30 MINUTE;
```

### 问题6：重复订单

**症状**：同一张票据被扫描多次，创建了多个订单

**原因**：
- 图片被复制到多个日期文件夹
- 任务被手动重置

**解决**：
- 系统会自动检测图片哈希值，标记为重复
- 查看日志中的 `Duplicate image detected` 消息
- 删除重复的`scan_jobs`记录

---

## 📈 监控和报告

### 查看任务统计

```sql
SELECT
  status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries,
  AVG(ocr_confidence) as avg_confidence
FROM scan_jobs
WHERE deleted_at IS NULL
GROUP BY status;
```

### 查看失败任务

```sql
SELECT
  id,
  image_path,
  retry_count,
  last_error,
  processing_started_at
FROM scan_jobs
WHERE status = 'failed'
ORDER BY updated_at DESC
LIMIT 20;
```

### 查看死信队列

```sql
SELECT
  original_job_id,
  image_path,
  error_type,
  error_message,
  retry_count,
  moved_at
FROM scan_jobs_dead_letter
WHERE resolution_status = 'pending'
ORDER BY moved_at DESC;
```

### JSON报告

每次运行扫描器都会生成报告：
```bash
reports/ocr/ocr-report-2026-01-11T10-30-00-000Z.json
```

报告内容包括：
```json
{
  "summary": {
    "totalJobs": 50,
    "processed": 50,
    "succeeded": 45,
    "failed": 5,
    "successRate": "90.0%",
    "duration": 120500
  },
  "errors": [
    {
      "jobId": 123,
      "imagePath": "/receipts/sales/2026-01-11/bad.jpg",
      "error": "OCR extracted empty text from image"
    }
  ]
}
```

---

## 🔧 高级配置

### 切换LLM提供商

**从OpenAI切换到Claude**：

编辑`backend/.env`：
```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
```

### 调整并发数

编辑`backend/.env`：
```bash
WORKER_POOL_SIZE=10  # 增加到10个并行worker
```

**注意**：更多worker = 更高吞吐量，但也会增加API调用频率和成本

### 自定义产品匹配算法

编辑`backend/services/productMatcher.js`，修改`calculateSimilarity`函数：
```javascript
// 使用Jaro-Winkler距离代替Levenshtein
function calculateSimilarity(str1, str2) {
  return jaroWinkler(str1, str2);
}
```

### 自定义单位推断规则

编辑`backend/config/ocr.js`：
```javascript
unitInference: {
  enabled: true,
  rules: [
    { pattern: /箱/, unit: '箱' },
    { pattern: /托/, unit: '托' },  // 新增
    // ... 更多规则
  ],
  defaultUnit: '个'
}
```

---

## 📚 API参考

### OcrService

```javascript
const ocrService = require('./services/ocrService');

// 处理单张票据
const result = await ocrService.processReceipt(imagePath, scanType);
// 返回: { success, imageHash, ocrText, parsedData, processingTime }
```

### ProductMatcher

```javascript
const productMatcher = require('./services/productMatcher');

// 匹配产品
const match = await productMatcher.matchProduct('苹果红富士');
// 返回: { matched: true, product: {...}, confidence: 0.85 } 或 null

// 匹配联系人
const contactMatch = await productMatcher.matchContact('张三餐厅', 'customer');
// 返回: { matched: true, contact: {...} } 或 null

// 推断单位
const unit = productMatcher.inferUnit('一箱苹果', '');
// 返回: '箱'
```

### OcrOrderCreationService

```javascript
const ocrOrderCreationService = require('./services/ocrOrderCreationService');

// 从OCR数据创建订单
const result = await ocrOrderCreationService.createOrderFromReceipt(
  parsedData,
  'sales',
  imagePath
);
// 返回: { orderId, orderNo, matchedCount, unmatchedCount, unmatchedItems }
```

---

## 🤝 贡献指南

### 添加新的OCR提供商

1. 在`backend/services/ocrProviders/`创建新文件
2. 实现`extractText(imagePath)`方法
3. 在`ocrService.js`中注册提供商

### 添加新的匹配算法

1. 在`backend/services/matchers/`创建新文件
2. 实现`calculateSimilarity(str1, str2)`函数
3. 在`productMatcher.js`中引用

---

## 📄 许可证

内部使用项目

**版本**: 1.0.0
**最后更新**: 2026-01-11
