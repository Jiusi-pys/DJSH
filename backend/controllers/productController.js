/**
 * Product controller - Request handlers for products
 */

const productService = require('../services/productService');
const { mapProduct } = require('../utils/responseMapper');
const { asyncHandler } = require('../middleware/errorHandler');

class ProductController {
  /**
   * POST /products
   */
  create = asyncHandler(async (req, res) => {
    const product = await productService.create(req.body, req);
    res.status(201).json({
      key: { product_id: product.id },
      display: { name: product.name, spec: product.spec, default_unit: product.unit }
    });
  });

  /**
   * PUT /products/:id
   */
  update = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const product = await productService.update(id, req.body, req);
    res.json({
      key: { product_id: product.id },
      display: {
        name: product.name,
        spec: product.spec,
        default_unit: product.unit,
        unit_price: parseFloat(product.unit_price) || 0,
        category: product.category
      }
    });
  });

  /**
   * DELETE /products/:id
   */
  delete = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await productService.delete(id, req);
    res.json({ success: true });
  });

  /**
   * POST /products/:id/disable
   */
  disable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await productService.disable(id, req);
    res.json({ success: true, message: '产品已废除' });
  });

  /**
   * POST /products/:id/enable
   */
  enable = asyncHandler(async (req, res) => {
    const { id } = req.params;
    await productService.enable(id, req);
    res.json({ success: true, message: '产品已恢复' });
  });
}

module.exports = new ProductController();
