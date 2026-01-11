/**
 * OCR Order Creation Service
 * Creates orders from OCR-parsed receipt data using existing orderService
 */

const orderService = require('./orderService');
const productMatcher = require('./productMatcher');
const ocrConfig = require('../config/ocr');
const logger = require('../utils/logger');

class OcrOrderCreationService {
  /**
   * Create order from OCR parsed data
   * @param {Object} parsedData - Data from OCR/LLM parsing
   * @param {string} scanType - 'sales' or 'purchase'
   * @param {string} imagePath - Path to original receipt image
   * @returns {Object} - { orderId, orderNo, matchedCount, unmatchedCount, unmatchedItems }
   */
  async createOrderFromReceipt(parsedData, scanType, imagePath) {
    const startTime = Date.now();

    try {
      logger.info('Creating order from OCR data', {
        scanType,
        contactName: parsedData.contact_name,
        itemCount: parsedData.items.length
      });

      // Step 1: Match contact
      const contactMatch = await productMatcher.matchContact(
        parsedData.contact_name,
        scanType === 'sales' ? 'customer' : 'supplier'
      );

      if (!contactMatch) {
        logger.warn('Contact not found in database', {
          ocrContactName: parsedData.contact_name,
          scanType
        });
      }

      // Step 2: Match products and infer units
      const { matchedItems, unmatchedItems, matchedCount, unmatchedCount } =
        await this.matchAndPrepareItems(parsedData.items);

      logger.info('Product matching completed', {
        total: parsedData.items.length,
        matched: matchedCount,
        unmatched: unmatchedCount
      });

      // Step 3: Prepare order data
      const orderData = {
        // order_no is auto-generated, store receipt order_no in remark
        contact_id: contactMatch?.contact?.contact_id || null,
        order_date: parsedData.order_date,
        remark: this.buildOrderRemark(parsedData, imagePath),
        items: matchedItems // Only include matched items
      };

      // Step 4: Create fake request object for orderService
      const fakeReq = this.createFakeRequest();

      // Step 5: Create order using existing orderService
      const result = await orderService.createOrder(scanType, orderData, fakeReq);

      logger.info('Order created successfully', {
        orderId: result.orderId,
        orderNo: result.orderNo,
        duration: Date.now() - startTime
      });

      return {
        orderId: result.orderId,
        orderNo: result.orderNo,
        matchedCount,
        unmatchedCount,
        unmatchedItems: unmatchedItems.map(item => ({
          name: item.name,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total
        }))
      };

    } catch (error) {
      logger.error('Order creation failed', {
        error: error.message,
        scanType,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Match products and prepare order items
   * Skips unmatched items per requirements
   */
  async matchAndPrepareItems(ocrItems) {
    const matchedItems = [];
    const unmatchedItems = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    for (const item of ocrItems) {
      try {
        // Match product
        const productMatch = await productMatcher.matchProduct(item.name);

        // Infer unit if empty
        const inferredUnit = productMatcher.inferUnit(item.name, item.unit);

        if (productMatch && productMatch.matched) {
          // Product matched - include in order
          matchedItems.push({
            product_id: productMatch.product.product_id,
            product_name_raw: item.name, // Keep original name for reference
            unit: inferredUnit,
            unit_price: item.unit_price,
            quantity: item.quantity
          });
          matchedCount++;

          logger.debug('Product matched for order item', {
            ocrName: item.name,
            matchedId: productMatch.product.product_id,
            matchedName: productMatch.product.name,
            confidence: productMatch.confidence
          });

        } else {
          // Product not matched - skip but report
          unmatchedItems.push({
            name: item.name,
            unit: inferredUnit,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total
          });
          unmatchedCount++;

          logger.warn('Product not matched - skipping item', {
            ocrName: item.name
          });
        }

      } catch (error) {
        logger.error('Error processing item', {
          item: item.name,
          error: error.message
        });
        unmatchedItems.push(item);
        unmatchedCount++;
      }
    }

    return {
      matchedItems,
      unmatchedItems,
      matchedCount,
      unmatchedCount
    };
  }

  /**
   * Build order remark with OCR metadata
   */
  buildOrderRemark(parsedData, imagePath) {
    const parts = [];

    // OCR scan marker
    parts.push('【OCR自动扫描】');

    // Receipt order number if available
    if (parsedData.order_no) {
      parts.push(`票据编号: ${parsedData.order_no}`);
    }

    // Image source
    const fileName = imagePath.split('/').pop();
    parts.push(`来源: ${fileName}`);

    // Confidence score
    if (parsedData.confidence) {
      parts.push(`识别置信度: ${(parsedData.confidence * 100).toFixed(0)}%`);
    }

    // Warning if confidence is low
    if (parsedData.confidence < 0.7) {
      parts.push('⚠️ 低置信度，需人工复核');
    }

    return parts.join(' | ');
  }

  /**
   * Create fake request object for orderService
   * Required because orderService expects Express req object
   */
  createFakeRequest() {
    return {
      user: ocrConfig.orderAPI.adminUser,
      headers: {},
      cookies: {},
      ip: 'ocr-scanner'
    };
  }
}

module.exports = new OcrOrderCreationService();
