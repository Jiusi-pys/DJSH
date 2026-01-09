/**
 * Order service - Business logic for orders
 */

const { getPool } = require('../config/database');
const orderRepository = require('../repositories/orderRepository');
const orderImageRepository = require('../repositories/orderImageRepository');
const contactRepository = require('../repositories/contactRepository');
const productRepository = require('../repositories/productRepository');
const { logOperation, logError } = require('../middleware/logger');
const { NotFoundError, VersionMismatchError, DisabledResourceError, ValidationError } = require('../utils/errors/AppError');

class OrderService {
  /**
   * Get orders list with filters
   */
  async getOrders(type, filters, pagination) {
    if (!['sales', 'purchase'].includes(type)) {
      throw new ValidationError('Invalid order type');
    }
    return await orderRepository.findAllWithFilters(type, filters, pagination);
  }

  /**
   * Get single order with details
   */
  async getOrderById(type, orderId) {
    const order = await orderRepository.findWithContact(orderId);
    if (!order) {
      throw new NotFoundError('Order');
    }

    const items = await orderRepository.getItems(orderId);
    const images = await orderImageRepository.findByOrderId(orderId);

    return { order, items, images };
  }

  /**
   * Create a new order
   */
  async createOrder(type, data, req) {
    if (!['sales', 'purchase'].includes(type)) {
      throw new ValidationError('Invalid order type');
    }

    try {
      // Validate contact
      if (data.contact_id) {
        const contact = await contactRepository.findById(data.contact_id);
        if (!contact) {
          throw new ValidationError('客户不存在');
        }
        if (contact.is_disabled) {
          throw new DisabledResourceError('客户', contact.name);
        }
      }

      // Validate products
      await this._validateProducts(data.items);

      // Generate order number
      const orderNo = data.order_no || await this._generateOrderNo(type);

      // Calculate total
      const totalAmount = this._calculateTotal(data.items);

      // Create order
      const orderId = await orderRepository.create({
        order_no: orderNo,
        order_type: type,
        contact_id: data.contact_id,
        order_date: data.order_date,
        total_amount: totalAmount,
        remark: data.remark
      });

      // Create items
      if (data.items && data.items.length > 0) {
        await orderRepository.createItems(orderId, data.items);
      }

      // Get created order for logging
      const newOrder = await orderRepository.findById(orderId);
      const newItems = await orderRepository.getItemsRaw(orderId);

      await logOperation({
        module: 'orders',
        action: 'create',
        targetType: 'order',
        targetId: orderId,
        targetName: orderNo,
        newData: { order: newOrder, items: newItems },
        req
      });

      return {
        orderId,
        orderNo,
        totalAmount,
        items: data.items
      };
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'create',
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Update an order
   */
  async updateOrder(type, orderId, data, req) {
    const connection = await getPool().getConnection();

    try {
      await connection.beginTransaction();

      // Get old data
      const [oldOrders] = await connection.query('SELECT * FROM orders WHERE id = ? AND deleted_at IS NULL', [orderId]);
      const [oldItems] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

      if (oldOrders.length === 0) {
        throw new NotFoundError('Order');
      }

      // Check version
      if (oldOrders[0].version !== data.version) {
        throw new VersionMismatchError();
      }

      const oldData = { order: oldOrders[0], items: oldItems };

      // Update order
      await orderRepository.update(orderId, data, connection);

      // Update total amount
      const totalAmount = this._calculateTotal(data.items);
      await orderRepository.updateTotalAmount(orderId, totalAmount, connection);

      // Update items
      for (const item of data.items) {
        if (item.item_id) {
          await orderRepository.updateItem(item.item_id, item, connection);
        }
      }

      await connection.commit();

      // Get updated data
      const [updatedOrders] = await connection.query(
        `SELECT o.*, c.name as contact_name, c.phone as contact_phone
         FROM orders o
         LEFT JOIN contacts c ON o.contact_id = c.id AND c.deleted_at IS NULL
         WHERE o.id = ?`,
        [orderId]
      );
      const [updatedItems] = await connection.query('SELECT * FROM order_items WHERE order_id = ?', [orderId]);
      const images = await orderImageRepository.findByOrderId(orderId);

      await logOperation({
        module: 'orders',
        action: 'update',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: data.order_no || oldOrders[0].order_no,
        oldData: oldData,
        newData: { order: updatedOrders[0], items: updatedItems },
        req
      });

      return { order: updatedOrders[0], items: updatedItems, images };
    } catch (error) {
      await connection.rollback();
      await logError({
        module: 'orders',
        action: 'update',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Verify an order
   */
  async verifyOrder(orderId, version, req) {
    try {
      const oldData = await orderRepository.findById(orderId);
      if (!oldData) {
        throw new NotFoundError('Order');
      }

      const success = await orderRepository.verify(orderId, version);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await orderRepository.findById(orderId);

      await logOperation({
        module: 'orders',
        action: 'verify',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: oldData.order_no,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'verify',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Cancel an order
   */
  async cancelOrder(orderId, version, reason, req) {
    try {
      const oldData = await orderRepository.findById(orderId);
      if (!oldData) {
        throw new NotFoundError('Order');
      }

      const success = await orderRepository.cancel(orderId, version, reason);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await orderRepository.findById(orderId);

      await logOperation({
        module: 'orders',
        action: 'cancel',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: oldData.order_no,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'cancel',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Restore a cancelled order
   */
  async restoreOrder(orderId, version, req) {
    try {
      const oldData = await orderRepository.findById(orderId);
      if (!oldData) {
        throw new NotFoundError('Order');
      }

      const success = await orderRepository.restoreOrder(orderId, version);
      if (!success) {
        throw new VersionMismatchError();
      }

      const newData = await orderRepository.findById(orderId);

      await logOperation({
        module: 'orders',
        action: 'restore',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: oldData.order_no,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'restore',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Upload an image to an order
   */
  async uploadImage(orderId, imageData, mimeType, req) {
    try {
      // Get order info for logging
      const order = await orderRepository.findById(orderId);
      const orderNo = order?.order_no || `order_${orderId}`;

      // Extract base64 data
      const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
      const imagePath = `base64_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const imageId = await orderImageRepository.create({
        order_id: orderId,
        mime_type: mimeType || 'image/jpeg',
        image_data: base64Data,
        image_path: imagePath
      });

      await logOperation({
        module: 'orders',
        action: 'upload_image',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: orderNo,
        newData: {
          image_id: imageId,
          order_id: parseInt(orderId),
          mime_type: mimeType || 'image/jpeg'
        },
        req
      });

      return { imageId, base64Data, mimeType: mimeType || 'image/jpeg' };
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'upload_image',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Get images for an order
   */
  async getImages(orderId) {
    return await orderImageRepository.findByOrderId(orderId);
  }

  /**
   * Delete an image from an order
   */
  async deleteImage(orderId, imageId, req) {
    try {
      // Get image data for logging
      const oldData = await orderImageRepository.findWithData(imageId);
      if (!oldData) {
        throw new NotFoundError('Image');
      }

      // Get order info
      const order = await orderRepository.findById(orderId);
      const orderNo = order?.order_no || `order_${orderId}`;

      await orderImageRepository.delete(imageId);

      await logOperation({
        module: 'orders',
        action: 'delete_image',
        targetType: 'order',
        targetId: parseInt(orderId),
        targetName: orderNo,
        oldData: {
          image_id: parseInt(imageId),
          order_id: oldData.order_id,
          mime_type: oldData.mime_type,
          image_data: oldData.image_data,
          image_path: oldData.image_path
        },
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'orders',
        action: 'delete_image',
        targetId: parseInt(orderId),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  // Private helpers
  async _validateProducts(items) {
    if (!items || items.length === 0) return;

    const productIds = items.filter(i => i.product_id).map(i => i.product_id);
    if (productIds.length === 0) return;

    const products = await productRepository.findByIds(productIds);
    const disabledProducts = products.filter(p => p.is_disabled);

    if (disabledProducts.length > 0) {
      const names = disabledProducts.map(p => p.name).join(', ');
      throw new DisabledResourceError('产品', names);
    }
  }

  _calculateTotal(items) {
    return items?.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0) || 0;
  }

  async _generateOrderNo(type) {
    const prefix = type === 'sales' ? 'SO' : 'PO';
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const count = await orderRepository.countByOrderNoPrefix(`${prefix}-${dateStr}-`);
    return `${prefix}-${dateStr}-${String(count + 1).padStart(3, '0')}`;
  }
}

module.exports = new OrderService();
