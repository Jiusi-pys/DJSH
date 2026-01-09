/**
 * Contact controller - Request handlers for contacts
 */

const contactService = require('../services/contactService');
const { mapContact } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class ContactController {
  /**
   * POST /contacts
   */
  create = asyncHandler(async (req, res) => {
    const contact = await contactService.create(req.body, req);
    res.status(201).json(mapContact(contact));
  });

  /**
   * PUT /contacts/:id
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const contact = await contactService.update(id, req.body, req);
    res.json(mapContact(contact));
  });

  /**
   * DELETE /contacts/:id
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await contactService.delete(id, req);
    res.json({ success: true });
  });

  /**
   * POST /contacts/:id/disable
   */
  disable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await contactService.disable(id, req);
    res.json({ success: true, message: '客户已废除' });
  });

  /**
   * POST /contacts/:id/enable
   */
  enable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await contactService.enable(id, req);
    res.json({ success: true, message: '客户已恢复' });
  });
}

module.exports = new ContactController();
