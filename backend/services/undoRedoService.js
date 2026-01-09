/**
 * Undo/Redo service - Handles undo and redo operations using registry pattern
 */

const { getPool } = require('../config/database');
const contactRepository = require('../repositories/contactRepository');
const productRepository = require('../repositories/productRepository');
const orderRepository = require('../repositories/orderRepository');
const orderImageRepository = require('../repositories/orderImageRepository');
const logRepository = require('../repositories/logRepository');
const { logOperation } = require('../middleware/logger');

// Actions that cannot be undone
const NON_UNDOABLE_ACTIONS = ['create'];

// Undo handlers registry
const undoHandlers = {
  contacts: {
    update: async (targetId, oldData) => {
      await contactRepository.updateFull(targetId, oldData);
      return { success: true, message: '已撤销更新客户', data: oldData };
    },
    delete: async (targetId) => {
      await contactRepository.restore(targetId);
      return { success: true, message: '已恢复删除的客户' };
    },
  },

  products: {
    update: async (targetId, oldData) => {
      await productRepository.updateFull(targetId, oldData);
      return { success: true, message: '已撤销更新产品', data: oldData };
    },
    delete: async (targetId) => {
      await productRepository.restore(targetId);
      return { success: true, message: '已恢复删除的产品' };
    },
  },

  orders: {
    update: async (targetId, oldData) => {
      // Restore order
      await orderRepository.updateFull(targetId, oldData.order || oldData);

      // Restore items if present
      if (oldData.items && Array.isArray(oldData.items)) {
        await orderRepository.deleteItems(targetId);
        await orderRepository.createItems(targetId, oldData.items);
      }
      return { success: true, message: '已撤销更新订单', data: oldData };
    },

    verify: async (targetId) => {
      await orderRepository.setManualVerified(targetId, false);
      return { success: true, message: '已撤销审核订单' };
    },

    cancel: async (targetId) => {
      await orderRepository.restore(targetId);
      return { success: true, message: '已撤销废弃订单' };
    },

    restore: async (targetId) => {
      await orderRepository.softDelete(targetId);
      return { success: true, message: '已撤销恢复订单' };
    },

    upload_image: async (targetId, oldData, newData) => {
      if (!newData?.image_id) {
        return { success: false, message: '缺少图片ID，无法撤销' };
      }
      await orderImageRepository.delete(newData.image_id);
      return { success: true, message: '已撤销上传图片' };
    },

    delete_image: async (targetId, oldData) => {
      if (!oldData?.image_data) {
        return { success: false, message: '缺少图片数据，无法撤销' };
      }
      const imageId = await orderImageRepository.create({
        order_id: oldData.order_id,
        mime_type: oldData.mime_type,
        image_data: oldData.image_data,
        image_path: oldData.image_path
      });
      return { success: true, message: '已恢复删除的图片', data: { new_image_id: imageId } };
    },
  },

  cash: {
    // Cash create cannot be undone
  },
};

// Redo handlers registry
const redoHandlers = {
  contacts: {
    update: async (targetId, oldData, newData) => {
      if (!newData) return { success: false, message: '缺少新数据，无法重做' };
      await contactRepository.updateFull(targetId, newData);
      return { success: true, message: '已重做更新客户', data: newData };
    },
    delete: async (targetId) => {
      await contactRepository.softDelete(targetId);
      return { success: true, message: '已重做删除客户' };
    },
  },

  products: {
    update: async (targetId, oldData, newData) => {
      if (!newData) return { success: false, message: '缺少新数据，无法重做' };
      await productRepository.updateFull(targetId, newData);
      return { success: true, message: '已重做更新产品', data: newData };
    },
    delete: async (targetId) => {
      await productRepository.softDelete(targetId);
      return { success: true, message: '已重做删除产品' };
    },
  },

  orders: {
    update: async (targetId, oldData, newData) => {
      if (!newData) return { success: false, message: '缺少新数据，无法重做' };

      await orderRepository.updateFull(targetId, newData.order || newData);

      if (newData.items && Array.isArray(newData.items)) {
        await orderRepository.deleteItems(targetId);
        await orderRepository.createItems(targetId, newData.items);
      }
      return { success: true, message: '已重做更新订单', data: newData };
    },

    verify: async (targetId) => {
      await orderRepository.setManualVerified(targetId, true);
      return { success: true, message: '已重做审核订单' };
    },

    cancel: async (targetId) => {
      await orderRepository.softDelete(targetId);
      return { success: true, message: '已重做废弃订单' };
    },

    restore: async (targetId) => {
      await orderRepository.restore(targetId);
      return { success: true, message: '已重做恢复订单' };
    },

    upload_image: async (targetId, oldData, newData) => {
      if (!newData?.image_data) return { success: false, message: '缺少图片数据，无法重做' };
      const imageId = await orderImageRepository.create({
        order_id: targetId,
        mime_type: newData.mime_type,
        image_data: newData.image_data,
        image_path: newData.image_path || `base64_redo_${Date.now()}`
      });
      return { success: true, message: '已重做上传图片', data: { new_image_id: imageId } };
    },

    delete_image: async (targetId, oldData) => {
      if (!oldData?.image_id) return { success: false, message: '缺少图片ID，无法重做' };
      await orderImageRepository.delete(oldData.image_id);
      return { success: true, message: '已重做删除图片' };
    },
  },

  cash: {
    // Cash operations cannot be redone
  },
};

class UndoRedoService {
  /**
   * Undo an operation
   */
  async undo(log, req) {
    const oldData = this._parseJson(log.old_data);
    const newData = this._parseJson(log.new_data);

    // Check if action is undoable
    if (NON_UNDOABLE_ACTIONS.includes(log.action)) {
      return { success: false, message: '新增操作不可撤销，请使用删除功能' };
    }

    // Get handler
    const moduleHandlers = undoHandlers[log.module];
    if (!moduleHandlers) {
      return { success: false, message: `不支持撤销 ${log.module} 模块的操作` };
    }

    const handler = moduleHandlers[log.action];
    if (!handler) {
      return { success: false, message: `不支持撤销 ${log.action} 操作` };
    }

    // Execute undo
    const result = await handler(log.target_id, oldData, newData);

    if (result.success) {
      // Mark log as undone
      await logRepository.markUndone(log.id);

      // Log the undo operation
      await logOperation({
        module: 'logs',
        action: 'undo',
        targetType: log.module,
        targetId: log.target_id,
        targetName: log.target_name,
        oldData: { original_log_id: log.id, original_action: log.action },
        newData: result.data || null,
        req,
      });
    }

    return result;
  }

  /**
   * Redo an operation
   */
  async redo(log, req) {
    const oldData = this._parseJson(log.old_data);
    const newData = this._parseJson(log.new_data);

    // Check if action can be redone
    if (NON_UNDOABLE_ACTIONS.includes(log.action)) {
      return { success: false, message: '新增操作不可撤销/重做' };
    }

    // Get handler
    const moduleHandlers = redoHandlers[log.module];
    if (!moduleHandlers) {
      return { success: false, message: `不支持重做 ${log.module} 模块的操作` };
    }

    const handler = moduleHandlers[log.action];
    if (!handler) {
      return { success: false, message: `不支持重做 ${log.action} 操作` };
    }

    // Execute redo
    const result = await handler(log.target_id, oldData, newData);

    if (result.success) {
      // Mark log as not undone
      await logRepository.markRedone(log.id);

      // Log the redo operation
      await logOperation({
        module: 'logs',
        action: 'redo',
        targetType: log.module,
        targetId: log.target_id,
        targetName: log.target_name,
        oldData: { original_log_id: log.id, original_action: log.action },
        newData: result.data || null,
        req,
      });
    }

    return result;
  }

  /**
   * Parse JSON safely
   */
  _parseJson(data) {
    if (!data) return null;
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch {
        return null;
      }
    }
    return data;
  }
}

module.exports = new UndoRedoService();
