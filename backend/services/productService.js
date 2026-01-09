/**
 * Product service - Business logic for products
 */

const productRepository = require('../repositories/productRepository');
const { logOperation, logError } = require('../middleware/logger');
const { NotFoundError } = require('../utils/errors/AppError');

class ProductService {
  /**
   * Create a new product
   */
  async create(data, req) {
    try {
      const id = await productRepository.create(data);
      const newProduct = await productRepository.findById(id);

      await logOperation({
        module: 'products',
        action: 'create',
        targetType: 'product',
        targetId: id,
        targetName: data.name,
        newData: newProduct,
        req
      });

      return newProduct;
    } catch (error) {
      await logError({
        module: 'products',
        action: 'create',
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Update a product
   */
  async update(id, data, req) {
    try {
      const oldData = await productRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Product');
      }

      await productRepository.update(id, data);
      const updatedProduct = await productRepository.findById(id);

      await logOperation({
        module: 'products',
        action: 'update',
        targetType: 'product',
        targetId: parseInt(id),
        targetName: data.name,
        oldData: oldData,
        newData: updatedProduct,
        req
      });

      return updatedProduct;
    } catch (error) {
      await logError({
        module: 'products',
        action: 'update',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Delete a product (hard delete)
   */
  async delete(id, req) {
    try {
      const oldData = await productRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Product');
      }

      await productRepository.hardDelete(id);

      await logOperation({
        module: 'products',
        action: 'delete',
        targetType: 'product',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'products',
        action: 'delete',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Disable a product
   */
  async disable(id, req) {
    try {
      const oldData = await productRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Product');
      }

      if (oldData.is_disabled) {
        throw new Error('该产品已被废除');
      }

      await productRepository.disable(id);
      const newData = await productRepository.findById(id);

      await logOperation({
        module: 'products',
        action: 'cancel',
        targetType: 'product',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'products',
        action: 'cancel',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Enable a product
   */
  async enable(id, req) {
    try {
      const oldData = await productRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Product');
      }

      if (!oldData.is_disabled) {
        throw new Error('该产品未被废除');
      }

      await productRepository.enable(id);
      const newData = await productRepository.findById(id);

      await logOperation({
        module: 'products',
        action: 'restore',
        targetType: 'product',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'products',
        action: 'restore',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }
}

module.exports = new ProductService();
