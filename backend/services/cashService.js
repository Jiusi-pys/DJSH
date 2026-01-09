/**
 * Cash service - Business logic for cash transactions
 */

const cashRepository = require('../repositories/cashRepository');
const { logOperation, logError } = require('../middleware/logger');

class CashService {
  /**
   * Get transactions list with filters
   */
  async getTransactions(filters, pagination) {
    return await cashRepository.findAllWithFilters(filters, pagination);
  }

  /**
   * Create a new transaction
   */
  async create(data, req) {
    try {
      const id = await cashRepository.create(data);
      const newTx = await cashRepository.findById(id);

      const transName = `${data.trans_type === 'income' ? '收入' : '支出'} ¥${data.amount || 0}`;
      await logOperation({
        module: 'cash',
        action: 'create',
        targetType: 'transaction',
        targetId: id,
        targetName: transName,
        newData: newTx,
        req
      });

      return newTx;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'create',
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }
}

module.exports = new CashService();
