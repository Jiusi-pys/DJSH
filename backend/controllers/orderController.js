/**
 * Order controller - Request handlers for orders
 */

const orderService = require('../services/orderService');
const { mapOrderResponse, mapOrderListItem, mapOrderItem, mapOrderImage, mapPaginatedResponse, formatDate } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class OrderController {
  /**
   * GET /orders/:type
   */
  list = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const filters = {
      manual_verified: req.query.manual_verified,
      auto_verified: req.query.auto_verified,
      settled: req.query.settled,
      q: req.query.q,
      date_from: req.query.date_from,
      date_to: req.query.date_to,
    };
    const pagination = {
      page: parseInt(req.query.page) || 1,
      page_size: parseInt(req.query.page_size) || 20,
    };

    const result = await orderService.getOrders(type, filters, pagination);
    res.json(mapPaginatedResponse(result.items, result.total, result.page, result.page_size, mapOrderListItem));
  });

  /**
   * GET /orders/:type/:order_id
   */
  getById = asyncHandler(async (req, res) => {
    const { type, order_id } = req.params;
    const { order, items, images } = await orderService.getOrderById(type, order_id);
    res.json(mapOrderResponse(order, items, images));
  });

  /**
   * POST /orders/:type
   */
  create = asyncHandler(async (req, res) => {
    const { type } = req.params;
    const { order_no, contact_id, order_date, remark, items } = req.body;

    const result = await orderService.createOrder(type, {
      order_no, contact_id, order_date, remark, items
    }, req);

    res.status(201).json({
      key: { order_id: result.orderId, order_type: type, version: 1 },
      display: {
        order_no: result.orderNo,
        contact: null,
        order_date: order_date,
        manual_verified: false,
        auto_verified: false,
        settled: false,
        total_amount: result.totalAmount,
        remark: remark || '',
        issues: [],
        images: [],
        items: result.items?.map((item, index) => ({
          key: { item_id: index + 1, product_id: item.product_id || null },
          display: {
            product_name: null,
            product_name_raw: item.product_name_raw || null,
            unit: item.unit,
            unit_price: item.unit_price,
            quantity: item.quantity,
            line_total: item.unit_price * item.quantity
          }
        })) || []
      }
    });
  });

  /**
   * PUT /orders/:type/:order_id
   */
  update = asyncHandler(async (req, res) => {
    const { type, order_id } = req.params;
    const { order, items, images } = await orderService.updateOrder(type, order_id, req.body, req);
    res.json(mapOrderResponse(order, items, images));
  });

  /**
   * POST /orders/:type/:order_id/verify
   */
  verify = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { version, settled_immediately } = req.body;
    await orderService.verifyOrder(order_id, version, settled_immediately, req);
    res.json({ success: true });
  });

  /**
   * POST /orders/:type/:order_id/cancel
   */
  cancel = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { version, reason } = req.body;
    await orderService.cancelOrder(order_id, version, reason, req);
    res.json({ success: true });
  });

  /**
   * POST /orders/:type/:order_id/restore
   */
  restore = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { version } = req.body;
    await orderService.restoreOrder(order_id, version, req);
    res.json({ success: true });
  });

  /**
   * POST /orders/:type/:order_id/images
   */
  uploadImage = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const { image_data, mime_type } = req.body;

    if (!image_data) {
      return res.status(400).json({ error: 'No image data' });
    }

    const result = await orderService.uploadImage(order_id, image_data, mime_type, req);

    res.status(201).json({
      key: { image_id: result.imageId },
      display: {
        mime_type: result.mimeType,
        base64: result.base64Data
      }
    });
  });

  /**
   * GET /orders/:type/:order_id/images
   */
  getImages = asyncHandler(async (req, res) => {
    const { order_id } = req.params;
    const images = await orderService.getImages(order_id);

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
   * DELETE /orders/:type/:order_id/images/:image_id
   */
  deleteImage = asyncHandler(async (req, res) => {
    const { order_id, image_id } = req.params;
    await orderService.deleteImage(order_id, image_id, req);
    res.json({ success: true });
  });
}

module.exports = new OrderController();
