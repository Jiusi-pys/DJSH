/**
 * Contact service - Business logic for contacts
 */

const contactRepository = require('../repositories/contactRepository');
const { logOperation, logError } = require('../middleware/logger');
const { NotFoundError, DisabledResourceError } = require('../utils/errors/AppError');

class ContactService {
  /**
   * Create a new contact
   */
  async create(data, req) {
    try {
      const id = await contactRepository.create(data);
      const newContact = await contactRepository.findById(id);

      await logOperation({
        module: 'contacts',
        action: 'create',
        targetType: 'contact',
        targetId: id,
        targetName: data.name,
        newData: newContact,
        req
      });

      return newContact;
    } catch (error) {
      await logError({
        module: 'contacts',
        action: 'create',
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Update a contact
   */
  async update(id, data, req) {
    try {
      const oldData = await contactRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Contact');
      }

      await contactRepository.update(id, data);
      const updatedContact = await contactRepository.findById(id);

      await logOperation({
        module: 'contacts',
        action: 'update',
        targetType: 'contact',
        targetId: parseInt(id),
        targetName: data.name,
        oldData: oldData,
        newData: updatedContact,
        req
      });

      return updatedContact;
    } catch (error) {
      await logError({
        module: 'contacts',
        action: 'update',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Delete a contact (hard delete)
   */
  async delete(id, req) {
    try {
      const oldData = await contactRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Contact');
      }

      await contactRepository.hardDelete(id);

      await logOperation({
        module: 'contacts',
        action: 'delete',
        targetType: 'contact',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'contacts',
        action: 'delete',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Disable a contact
   */
  async disable(id, req) {
    try {
      const oldData = await contactRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Contact');
      }

      if (oldData.is_disabled) {
        throw new Error('该客户已被废除');
      }

      await contactRepository.disable(id);
      const newData = await contactRepository.findById(id);

      await logOperation({
        module: 'contacts',
        action: 'cancel',
        targetType: 'contact',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'contacts',
        action: 'cancel',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }

  /**
   * Enable a contact
   */
  async enable(id, req) {
    try {
      const oldData = await contactRepository.findById(id);
      if (!oldData) {
        throw new NotFoundError('Contact');
      }

      if (!oldData.is_disabled) {
        throw new Error('该客户未被废除');
      }

      await contactRepository.enable(id);
      const newData = await contactRepository.findById(id);

      await logOperation({
        module: 'contacts',
        action: 'restore',
        targetType: 'contact',
        targetId: parseInt(id),
        targetName: oldData.name,
        oldData: oldData,
        newData: newData,
        req
      });

      return true;
    } catch (error) {
      await logError({
        module: 'contacts',
        action: 'restore',
        targetId: parseInt(id),
        errorMessage: error.message,
        req
      });
      throw error;
    }
  }
}

module.exports = new ContactService();
