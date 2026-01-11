/**
 * Product Matcher Service - Fuzzy matching for OCR product names
 * Uses Levenshtein distance algorithm with caching
 */

const productRepository = require('../repositories/productRepository');
const contactRepository = require('../repositories/contactRepository');
const ocrConfig = require('../config/ocr');
const logger = require('../utils/logger');

// Simple Levenshtein distance implementation
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

  for (let i = 0; i <= len1; i++) matrix[0][i] = i;
  for (let j = 0; j <= len2; j++) matrix[j][0] = j;

  for (let j = 1; j <= len2; j++) {
    for (let i = 1; i <= len1; i++) {
      const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[j][i] = Math.min(
        matrix[j][i - 1] + 1,       // deletion
        matrix[j - 1][i] + 1,       // insertion
        matrix[j - 1][i - 1] + indicator  // substitution
      );
    }
  }

  return matrix[len2][len1];
}

// Calculate similarity score (0.0 to 1.0)
function calculateSimilarity(str1, str2) {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  return maxLength === 0 ? 1.0 : 1.0 - (distance / maxLength);
}

class ProductMatcher {
  constructor() {
    // LRU Cache for fuzzy matching results
    this.cache = new Map();
    this.cacheMaxSize = ocrConfig.matching.cacheSize;
    this.cacheTtl = ocrConfig.matching.cacheTtl;
  }

  /**
   * Match product name from OCR against database products
   * @param {string} ocrName - Product name from OCR
   * @param {Array} allProducts - All products from database (optional, will load if not provided)
   * @returns {Object} - { matched: boolean, product: {...}, confidence: 0.95 } or null
   */
  async matchProduct(ocrName, allProducts = null) {
    if (!ocrName || ocrName.trim().length === 0) {
      return null;
    }

    // Check cache first
    const cacheKey = this.normalize(ocrName);
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.debug('Product match cache hit', { ocrName, cachedProductId: cached.product?.product_id });
      return cached;
    }

    // Load all products if not provided
    if (!allProducts) {
      allProducts = await productRepository.findAllForLookup();
    }

    if (!allProducts || allProducts.length === 0) {
      logger.warn('No products in database for matching');
      return null;
    }

    // Find best match using fuzzy matching
    const normalizedOcrName = this.normalize(ocrName);
    let bestMatch = null;
    let bestScore = 0;

    for (const product of allProducts) {
      // Skip disabled products
      if (product.is_disabled) {
        continue;
      }

      // Match against product name and spec (if exists)
      const nameScore = calculateSimilarity(
        normalizedOcrName,
        this.normalize(product.name)
      );

      let specScore = 0;
      if (product.spec) {
        specScore = calculateSimilarity(
          normalizedOcrName,
          this.normalize(`${product.name} ${product.spec}`)
        );
      }

      // Use the higher score
      const score = Math.max(nameScore, specScore);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = product;
      }
    }

    // Check if best match exceeds threshold
    const threshold = ocrConfig.matching.productThreshold;

    if (bestScore >= threshold) {
      const result = {
        matched: true,
        product: bestMatch,
        confidence: parseFloat(bestScore.toFixed(3))
      };

      // Cache the result
      this.setInCache(cacheKey, result);

      logger.debug('Product matched', {
        ocrName,
        matchedName: bestMatch.name,
        matchedId: bestMatch.product_id,
        confidence: result.confidence
      });

      return result;
    }

    // No match found
    logger.debug('No product match found', {
      ocrName,
      bestScore: bestScore.toFixed(3),
      threshold
    });

    return null;
  }

  /**
   * Match contact name (exact match only per requirements)
   * @param {string} ocrContactName - Contact name from OCR
   * @param {string} contactType - 'customer' or 'supplier'
   * @returns {Object} - { matched: boolean, contact: {...} } or null
   */
  async matchContact(ocrContactName, contactType) {
    if (!ocrContactName || ocrContactName.trim().length === 0) {
      return null;
    }

    // Load all contacts for the type
    const allContacts = await contactRepository.findAllForLookup(contactType);

    if (!allContacts || allContacts.length === 0) {
      logger.warn('No contacts in database for matching', { contactType });
      return null;
    }

    // Normalize for comparison
    const normalizedOcrName = this.normalize(ocrContactName);

    // Exact match only (per requirements)
    for (const contact of allContacts) {
      if (contact.is_disabled) {
        continue;
      }

      const normalizedContactName = this.normalize(contact.name);

      if (normalizedOcrName === normalizedContactName) {
        logger.debug('Contact matched (exact)', {
          ocrName: ocrContactName,
          matchedName: contact.name,
          matchedId: contact.contact_id
        });

        return {
          matched: true,
          contact: contact
        };
      }
    }

    // No exact match found
    logger.debug('No contact match found', {
      ocrName: ocrContactName,
      contactType
    });

    return null;
  }

  /**
   * Infer unit from product name/spec if unit is empty
   * @param {string} productName - Product name from OCR
   * @param {string} unit - Current unit (may be empty)
   * @returns {string} - Inferred or original unit
   */
  inferUnit(productName, unit) {
    // If unit already provided, use it
    if (unit && unit.trim().length > 0) {
      return unit.trim();
    }

    if (!ocrConfig.unitInference.enabled) {
      return ocrConfig.unitInference.defaultUnit;
    }

    // Apply inference rules
    const rules = ocrConfig.unitInference.rules;
    for (const rule of rules) {
      if (rule.pattern.test(productName)) {
        logger.debug('Unit inferred from product name', {
          productName,
          inferredUnit: rule.unit,
          pattern: rule.pattern.toString()
        });
        return rule.unit;
      }
    }

    // No pattern matched, use default
    return ocrConfig.unitInference.defaultUnit;
  }

  /**
   * Normalize string for comparison
   * - Lowercase
   * - Trim whitespace
   * - Remove special characters
   */
  normalize(str) {
    return str
      .toLowerCase()
      .trim()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ''); // Keep only Chinese, letters, numbers
  }

  /**
   * Cache management - Get from cache
   */
  getFromCache(key) {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }

    // Check TTL
    if (Date.now() - entry.timestamp > this.cacheTtl) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Cache management - Set in cache (LRU eviction)
   */
  setInCache(key, value) {
    // If cache is full, remove oldest entry (first in Map)
    if (this.cache.size >= this.cacheMaxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache (useful for testing)
   */
  clearCache() {
    this.cache.clear();
    logger.debug('Product matcher cache cleared');
  }
}

module.exports = new ProductMatcher();
