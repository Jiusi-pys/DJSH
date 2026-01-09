/**
 * Cash controller - Request handlers for cash transactions
 */

const cashService = require('../services/cashService');
const { mapCashTransaction, mapPaginatedResponse, formatDate } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class CashController {
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

    res.status(201).json({
      key: { transaction_id: tx.id },
      display: {
        trans_date: formatDate(tx.trans_date),
        trans_type: tx.trans_type,
        amount: parseFloat(tx.amount) || 0,
        category: tx.category || '',
        contact_name: '',
        remark: tx.remark || '',
      }
    });
  });
}

module.exports = new CashController();
