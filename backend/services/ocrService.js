/**
 * OCR Service - Extract text from receipt images and parse with LLM
 * Hybrid approach: Tesseract OCR → LLM intelligent parsing
 */

const { createWorker } = require('tesseract.js');
const OpenAI = require('openai');
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs').promises;
const crypto = require('crypto');
const ocrConfig = require('../config/ocr');
const logger = require('../utils/logger');

class OcrService {
  constructor() {
    this.llmClient = null;
    this.initializeLLM();
  }

  /**
   * Initialize LLM client based on configuration
   */
  initializeLLM() {
    const provider = ocrConfig.llm.provider;

    if (provider === 'openai') {
      if (!ocrConfig.llm.openai.apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
      }
      this.llmClient = new OpenAI({
        apiKey: ocrConfig.llm.openai.apiKey
      });
      this.llmProvider = 'openai';
    } else if (provider === 'anthropic') {
      if (!ocrConfig.llm.anthropic.apiKey) {
        throw new Error('ANTHROPIC_API_KEY not configured');
      }
      this.llmClient = new Anthropic({
        apiKey: ocrConfig.llm.anthropic.apiKey
      });
      this.llmProvider = 'anthropic';
    } else {
      throw new Error(`Unsupported LLM provider: ${provider}`);
    }

    logger.info('LLM client initialized', { provider: this.llmProvider });
  }

  /**
   * Process receipt image: OCR → Parse → Return structured data
   * @param {string} imagePath - Path to receipt image
   * @param {string} scanType - 'sales' or 'purchase'
   * @returns {Object} - Parsed receipt data with confidence
   */
  async processReceipt(imagePath, scanType) {
    const startTime = Date.now();

    try {
      // Step 1: Extract text with Tesseract OCR
      logger.info('Starting OCR extraction', { imagePath, scanType });
      const ocrText = await this.extractTextWithRetry(imagePath);

      if (!ocrText || ocrText.trim().length === 0) {
        throw new Error('OCR extracted empty text from image');
      }

      logger.info('OCR extraction completed', {
        textLength: ocrText.length,
        duration: Date.now() - startTime
      });

      // Step 2: Parse with LLM
      logger.info('Starting LLM parsing', { provider: this.llmProvider });
      const parsedData = await this.parseWithLLM(ocrText, scanType);

      // Step 3: Calculate image hash for deduplication
      const imageHash = await this.calculateImageHash(imagePath);

      const duration = Date.now() - startTime;
      logger.info('Receipt processing completed', {
        duration,
        confidence: parsedData.confidence,
        itemCount: parsedData.items?.length || 0
      });

      return {
        success: true,
        imageHash,
        ocrText,
        parsedData,
        processingTime: duration
      };

    } catch (error) {
      logger.error('Receipt processing failed', {
        imagePath,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Extract text from image using Tesseract OCR with retry
   */
  async extractTextWithRetry(imagePath) {
    const { maxAttempts, initialDelay, maxDelay, backoffMultiplier } = ocrConfig.ocr.retry;
    let lastError;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await this.extractText(imagePath);
      } catch (error) {
        lastError = error;
        logger.warn(`OCR attempt ${attempt}/${maxAttempts} failed`, {
          error: error.message,
          imagePath
        });

        if (attempt < maxAttempts) {
          const delay = Math.min(initialDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
          logger.info(`Retrying OCR after ${delay}ms`);
          await this.sleep(delay);
        }
      }
    }

    throw new Error(`OCR failed after ${maxAttempts} attempts: ${lastError.message}`);
  }

  /**
   * Extract text using Tesseract OCR
   */
  async extractText(imagePath) {
    const worker = await createWorker(ocrConfig.ocr.tesseract.language, 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          logger.debug('OCR progress', { progress: Math.round(m.progress * 100) });
        }
      }
    });

    try {
      const { data: { text, confidence } } = await worker.recognize(imagePath);

      logger.debug('Tesseract OCR completed', {
        textLength: text.length,
        confidence: confidence.toFixed(2)
      });

      return text;
    } finally {
      await worker.terminate();
    }
  }

  /**
   * Parse OCR text using LLM
   */
  async parseWithLLM(ocrText, scanType) {
    const prompt = this.buildParsingPrompt(ocrText, scanType);

    if (this.llmProvider === 'openai') {
      return await this.parseWithOpenAI(prompt);
    } else if (this.llmProvider === 'anthropic') {
      return await this.parseWithClaude(prompt);
    }

    throw new Error(`Unsupported LLM provider: ${this.llmProvider}`);
  }

  /**
   * Parse using OpenAI
   */
  async parseWithOpenAI(prompt) {
    const response = await this.llmClient.chat.completions.create({
      model: ocrConfig.llm.openai.model,
      messages: [
        {
          role: 'system',
          content: '你是一个专业的票据识别助手，擅长从OCR文本中提取结构化数据。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: ocrConfig.llm.openai.temperature,
      max_tokens: ocrConfig.llm.openai.maxTokens,
      response_format: { type: 'json_object' }
    });

    const content = response.choices[0]?.message?.content;
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from OpenAI');
    }

    const parsed = JSON.parse(content);

    return this.validateAndNormalizeParsedData(parsed);
  }

  /**
   * Parse using Claude (Anthropic)
   */
  async parseWithClaude(prompt) {
    const response = await this.llmClient.messages.create({
      model: ocrConfig.llm.anthropic.model,
      max_tokens: ocrConfig.llm.anthropic.maxTokens,
      temperature: ocrConfig.llm.anthropic.temperature,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const content = response.content[0]?.text;
    if (!content || content.trim().length === 0) {
      throw new Error('Empty response from Claude');
    }

    const parsed = JSON.parse(content);

    return this.validateAndNormalizeParsedData(parsed);
  }

  /**
   * Build LLM parsing prompt
   */
  buildParsingPrompt(ocrText, scanType) {
    const orderTypeZh = scanType === 'sales' ? '销售订单' : '采购订单';

    return `你是一个专业的票据识别助手。请从以下OCR识别的文本中提取${orderTypeZh}信息。

**OCR文本：**
${ocrText}

**要求提取的字段：**
1. contact_name (联系人/客户/供应商名称) - 必填
2. order_date (日期，格式：YYYY-MM-DD) - 必填
3. order_no (票据上的订单号) - 可选，如果找不到则返回null
4. items (商品条目数组) - 必填，至少1项
   每个商品包含：
   - name (产品名称及规格)
   - unit (单位：个/箱/件/包/袋/斤/两，如果OCR文本中没有则留空)
   - quantity (数量，数字)
   - unit_price (单价，数字)
   - total (小计，数字)

**输出格式（JSON）：**
{
  "contact_name": "客户名称",
  "order_date": "2026-01-11",
  "order_no": "票据编号或null",
  "items": [
    {
      "name": "产品名称及规格",
      "unit": "单位或空字符串",
      "quantity": 10,
      "unit_price": 25.50,
      "total": 255.00
    }
  ],
  "total_amount": 255.00,
  "confidence": 0.85
}

**注意事项：**
- contact_name、order_date、items 是必填字段，如果找不到请标记 confidence 为 0.5 以下
- order_no 如果找不到则设为 null
- items 数组至少要有1个商品
- unit 如果OCR中没有明确单位，留空字符串 ""
- 所有金额保留2位小数
- confidence 是你对整个识别结果的置信度评分（0.0-1.0）

请只返回JSON，不要包含任何解释或其他文字。`;
  }

  /**
   * Validate and normalize parsed data from LLM
   */
  validateAndNormalizeParsedData(data) {
    // Required fields validation
    if (!data.contact_name || data.contact_name.trim().length === 0) {
      throw new Error('Missing required field: contact_name');
    }

    if (!data.order_date) {
      throw new Error('Missing required field: order_date');
    }

    if (!data.items || !Array.isArray(data.items) || data.items.length === 0) {
      throw new Error('Missing or empty required field: items');
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.order_date)) {
      throw new Error(`Invalid date format: ${data.order_date}. Expected YYYY-MM-DD`);
    }

    // Validate each item
    data.items.forEach((item, index) => {
      if (!item.name || item.name.trim().length === 0) {
        throw new Error(`Item ${index + 1}: Missing product name`);
      }

      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Item ${index + 1}: Invalid quantity: ${item.quantity}`);
      }

      if (typeof item.unit_price !== 'number' || item.unit_price < 0) {
        throw new Error(`Item ${index + 1}: Invalid unit_price: ${item.unit_price}`);
      }

      // Normalize unit to empty string if not provided
      item.unit = item.unit || '';

      // Calculate total if not provided
      if (!item.total) {
        item.total = parseFloat((item.quantity * item.unit_price).toFixed(2));
      }
    });

    // Calculate total_amount if not provided
    if (!data.total_amount) {
      data.total_amount = data.items.reduce((sum, item) => sum + item.total, 0);
      data.total_amount = parseFloat(data.total_amount.toFixed(2));
    }

    // Set default confidence if not provided
    if (typeof data.confidence !== 'number') {
      data.confidence = 0.8; // Default confidence
    }

    // Ensure confidence is between 0 and 1
    data.confidence = Math.max(0, Math.min(1, data.confidence));

    return data;
  }

  /**
   * Calculate SHA256 hash of image file for deduplication
   */
  async calculateImageHash(imagePath) {
    const fileBuffer = await fs.readFile(imagePath);
    const hash = crypto.createHash('sha256');
    hash.update(fileBuffer);
    return hash.digest('hex');
  }

  /**
   * Sleep utility for retry delays
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = new OcrService();
