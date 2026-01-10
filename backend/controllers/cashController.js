/**
 * Cash controller - Request handlers for cash transactions
 */

const cashService = require('../services/cashService');
const { mapCashTransaction, mapPaginatedResponse, formatDate } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class CashController {
  /**
   * GET /cash/balance
   */
  getBalance = asyncHandler(async (req, res) => {
    const balance = await cashService.getCurrentBalance();
    res.json({ balance: parseFloat(balance) || 0 });
  });

  /**
   * GET /cash/transactions
   */
  list = asyncHandler(async (req, res) => {
    const filters = {
      type: req.query.type,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 20,
    };

    const result = await cashService.getTransactions(filters, pagination);
    res.json(mapPaginatedResponse(result.items, result.total, result.page, result.page_size, mapCashTransaction));
  });

  /**
   * POST /cash/transactions
   */
  create = asyncHandler(async (req, res) => {
    const tx = await cashService.create(req.body, req);
    res.status(201).json(mapCashTransaction(tx));
  });

  /**
   * POST /cash/transactions/:transaction_id/images - Upload image
   */
  uploadImage = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const { image_data, mime_type } = req.body;

    if (!image_data) {
      return res.status(400).json({ error: 'No image data' });
    }

    const result = await cashService.uploadImage(transaction_id, image_data, mime_type, req);

    res.status(201).json({
      key: { image_id: result.imageId },
      display: {
        mime_type: result.mimeType,
        base64: result.base64Data
      }
    });
  });

  /**
   * GET /cash/transactions/:transaction_id/images - Get images
   */
  getImages = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const images = await cashService.getImages(transaction_id);

    res.json({
      items: images.map(img => ({
        key: { image_id: img.image_id },
        display: {
          mime_type: img.mime_type,
          base64: img.image_data || ''
        }
      }))
    });
  });

  /**
   * DELETE /cash/transactions/:transaction_id/images/:image_id - Delete image
   */
  deleteImage = asyncHandler(async (req, res) => {
    const { transaction_id, image_id } = req.params;
    await cashService.deleteImage(transaction_id, image_id, req);
    res.json({ success: true });
  });

  /**
   * PUT /cash/transactions/:transaction_id/cancel - Cancel transaction
   */
  cancel = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const { version, reason } = req.body;

    await cashService.cancelTransaction(transaction_id, version, reason, req);
    res.json({ success: true });
  });

  /**
   * PUT /cash/transactions/:transaction_id/restore - Restore cancelled transaction
   */
  restore = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const { version } = req.body;

    await cashService.restoreTransaction(transaction_id, version, req);
    res.json({ success: true });
  });

  /**
   * PUT /cash/transactions/:transaction_id/verify - Verify transaction
   */
  verify = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const { version } = req.body;

    await cashService.verifyTransaction(transaction_id, version, req);
    res.json({ success: true });
  });

  /**
   * PUT /cash/transactions/:transaction_id/unverify - Unverify transaction
   */
  unverify = asyncHandler(async (req, res) => {
    const { transaction_id } = req.params;
    const { version } = req.body;

    await cashService.unverifyTransaction(transaction_id, version, req);
    res.json({ success: true });
  });
}

module.exports = new CashController();
