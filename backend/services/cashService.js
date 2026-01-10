/**
 * Cash service - Business logic for cash transactions
 */

const cashRepository = require('../repositories/cashRepository');
const cashImageRepository = require('../repositories/cashImageRepository');
const { logOperation, logError } = require('../middleware/logger');
const { NotFoundError, VersionMismatchError } = require('../middleware/errorHandler');

class CashService {
  /**
   * Get transactions list with filters
   */
  async getTransactions(filters, pagination) {
    return await cashRepository.findAllWithFilters(filters, pagination);
  }

  /**
   * Get current balance
   */
  async getCurrentBalance() {
    return await cashRepository.getCurrentBalance();
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

  /**
   * Upload an image to a transaction
   */
  async uploadImage(transactionId, imageData, mimeType, req) {
    try {
      // Get transaction info for logging
      const transaction = await cashRepository.findById(transactionId);
      const transName = `${transaction.trans_type === 'income' ? '收入' : '支出'} ¥${transaction.amount || 0}`;

      // Extract base64 data
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      const imagePath = `base64_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const imageId = await cashImageRepository.create({
        transaction_id: transactionId,
        mime_type: mimeType || 'image/jpeg',
        image_data: base64Data,
        image_path: imagePath
      });

      await logOperation({
        module: 'cash',
        action: 'upload_image',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        newData: {
          image_id: imageId,
          transaction_id: parseInt(transactionId),
          mime_type: mimeType || 'image/jpeg'
        },
        req
      });

      return { imageId, base64Data, mimeType: mimeType || 'image/jpeg' };
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'upload_image',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Get images for a transaction
   */
  async getImages(transactionId) {
    return await cashImageRepository.findByTransactionId(transactionId);
  }

  /**
   * Delete an image from a transaction
   */
  async deleteImage(transactionId, imageId, req) {
    try {
      // Get image data for logging
      const oldData = await cashImageRepository.findWithData(imageId);
      if (!oldData) {
        throw new NotFoundError('Image');
      }

      // Get transaction info
      const transaction = await cashRepository.findById(transactionId);
      const transName = `${transaction.trans_type === 'income' ? '收入' : '支出'} ¥${transaction.amount || 0}`;

      await cashImageRepository.delete(imageId);

      await logOperation({
        module: 'cash',
        action: 'delete_image',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        oldData: {
          image_id: parseInt(imageId),
          transaction_id: oldData.transaction_id,
          mime_type: oldData.mime_type,
          image_data: oldData.image_data,
          image_path: oldData.image_path
        },
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'delete_image',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Cancel a transaction
   */
  async cancelTransaction(transactionId, version, reason, req) {
    try {
      const oldData = await cashRepository.findById(transactionId);
      if (!oldData) {
        throw new NotFoundError('Transaction');
      }

      const success = await cashRepository.cancel(transactionId, version, reason);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await cashRepository.findById(transactionId);
      const transName = `${oldData.trans_type === 'income' ? '收入' : '支出'} ¥${oldData.amount || 0}`;

      await logOperation({
        module: 'cash',
        action: 'cancel',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'cancel',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Restore a cancelled transaction
   */
  async restoreTransaction(transactionId, version, req) {
    try {
      const oldData = await cashRepository.findById(transactionId);
      if (!oldData) {
        throw new NotFoundError('Transaction');
      }

      const success = await cashRepository.restore(transactionId, version);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await cashRepository.findById(transactionId);
      const transName = `${oldData.trans_type === 'income' ? '收入' : '支出'} ¥${oldData.amount || 0}`;

      await logOperation({
        module: 'cash',
        action: 'restore',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'restore',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Verify a transaction
   */
  async verifyTransaction(transactionId, version, req) {
    try {
      const oldData = await cashRepository.findById(transactionId);
      if (!oldData) {
        throw new NotFoundError('Transaction');
      }

      const success = await cashRepository.verify(transactionId, version);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await cashRepository.findById(transactionId);
      const transName = `${oldData.trans_type === 'income' ? '收入' : '支出'} ¥${oldData.amount || 0}`;

      await logOperation({
        module: 'cash',
        action: 'verify',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'verify',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Unverify a transaction
   */
  async unverifyTransaction(transactionId, version, req) {
    try {
      const oldData = await cashRepository.findById(transactionId);
      if (!oldData) {
        throw new NotFoundError('Transaction');
      }

      const success = await cashRepository.unverify(transactionId, version);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await cashRepository.findById(transactionId);
      const transName = `${oldData.trans_type === 'income' ? '收入' : '支出'} ¥${oldData.amount || 0}`;

      await logOperation({
        module: 'cash',
        action: 'unverify',
        targetType: 'transaction',
        targetId: parseInt(transactionId),
        targetName: transName,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'cash',
        action: 'unverify',
        targetId: parseInt(transactionId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }
}

module.exports = new CashService();
