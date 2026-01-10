/**
 * Response mapping utilities
 * Standardizes the {key: {...}, display: {...}} response format
 */

/**
 * Format a date to YYYY-MM-DD string
 */
function formatDate(date) {
  if (!date) return '';
  if (date instanceof Date) {
    return date.toISOString().split('T')[0];
  }
  return String(date).split('T')[0];
}

/**
 * Map a single order to API response format
 */
function mapOrderResponse(order, items = [], images = []) {
  const contactLookup = order.contact_id ? {
    key: { contact_id: order.contact_id },
    display: { name: order.contact_name, phone: order.contact_phone }
  } : null;

  return {
    key: { order_id: order.id, order_type: order.order_type, version: order.version },
    display: {
      order_no: order.order_no,
      contact: contactLookup,
      order_date: formatDate(order.order_date),
      manual_verified: order.manual_verified === 1,
      auto_verified: order.auto_verified === 1,
      settled: order.settled === 1,
      total_amount: parseFloat(order.total_amount) || 0,
      remark: order.remark || '',
      issues: order.issues ? (typeof order.issues === 'string' ? JSON.parse(order.issues) : order.issues) : [],
      images: images.map(mapOrderImage),
      items: items.map(mapOrderItem),
    }
  };
}

/**
 * Map an order for list display
 */
function mapOrderListItem(order) {
  return {
    key: { order_id: order.id, order_type: order.order_type },
    display: {
      order_no: order.order_no,
      contact_name: order.contact_name || '',
      order_date: formatDate(order.order_date),
      total_amount: parseFloat(order.total_amount) || 0,
      manual_verified: order.manual_verified === 1,
      auto_verified: order.auto_verified === 1,
      settled: order.settled === 1,
      issue_tags: order.issues ? (typeof order.issues === 'string' ? JSON.parse(order.issues) : order.issues).map(i => i.code) : [],
      image_count: order.image_count || 0,
    }
  };
}

/**
 * Map an order item
 */
function mapOrderItem(item) {
  return {
    key: { item_id: item.id, product_id: item.product_id || null },
    display: {
      product_name: item.product_name || null,
      product_name_raw: item.product_name_raw || null,
      unit: item.unit,
      unit_price: parseFloat(item.unit_price) || 0,
      quantity: parseFloat(item.quantity) || 0,
      line_total: parseFloat(item.line_total) || 0,
    }
  };
}

/**
 * Map an order image
 */
function mapOrderImage(img) {
  return {
    key: { image_id: img.image_id || img.id },
    display: { mime_type: img.mime_type, base64: img.image_data || '' }
  };
}

/**
 * Map a contact for API response
 */
function mapContact(contact) {
  return {
    key: { contact_id: contact.id },
    display: {
      name: contact.name,
      contact_person: contact.contact_person,
      phone: contact.phone,
      wechat: contact.wechat,
      qq: contact.qq,
      is_disabled: contact.is_disabled === 1,
    }
  };
}

/**
 * Map a contact for lookup list
 */
function mapContactLookup(contact) {
  return {
    key: { contact_id: contact.contact_id || contact.id },
    display: {
      name: contact.name,
      contact_person: contact.contact_person,
      phone: contact.phone,
      wechat: contact.wechat,
      qq: contact.qq,
      contact_type: contact.contact_type || 'customer',
      is_disabled: contact.is_disabled === 1,
    }
  };
}

/**
 * Map a product for API response
 */
function mapProduct(product) {
  return {
    key: { product_id: product.id },
    display: {
      name: product.name,
      spec: product.spec,
      default_unit: product.unit,
      unit_price: parseFloat(product.unit_price) || 0,
      category: product.category,
      is_disabled: product.is_disabled === 1,
    }
  };
}

/**
 * Map a product for lookup list
 */
function mapProductLookup(product) {
  return {
    key: { product_id: product.product_id || product.id },
    display: {
      name: product.name,
      spec: product.spec,
      default_unit: product.unit,
      is_disabled: product.is_disabled === 1,
    }
  };
}

/**
 * Map a cash transaction for API response
 */
function mapCashTransaction(tx) {
  return {
    key: { transaction_id: tx.id },
    display: {
      trans_date: formatDate(tx.trans_date),
      trans_type: tx.trans_type,
      amount: parseFloat(tx.amount) || 0,
      category: tx.category || '',
      contact_name: tx.contact_name || '',
      remark: tx.remark || '',
      cancelled: tx.cancelled === 1,
      cancelled_reason: tx.cancelled_reason || '',
      cancelled_at: tx.cancelled_at ? formatDate(tx.cancelled_at) : null,
      verified: tx.verified === 1,
      verified_at: tx.verified_at ? formatDate(tx.verified_at) : null,
      version: tx.version || 1,
    }
  };
}

/**
 * Map a log entry for API response
 */
function mapLogEntry(log) {
  return {
    key: { log_id: log.id },
    display: {
      module: log.module,
      action: log.action,
      target_type: log.target_type,
      target_id: log.target_id,
      target_name: log.target_name,
      user_info: log.user_info,
      request_method: log.request_method,
      request_path: log.request_path,
      ip_address: log.ip_address,
      status: log.status,
      error_message: log.error_message,
      duration_ms: log.duration_ms,
      created_at: log.created_at,
      old_data: log.old_data ? (typeof log.old_data === 'string' ? JSON.parse(log.old_data) : log.old_data) : null,
      new_data: log.new_data ? (typeof log.new_data === 'string' ? JSON.parse(log.new_data) : log.new_data) : null,
      is_undone: !!log.is_undone,
    }
  };
}

/**
 * Create a paginated response
 */
function mapPaginatedResponse(items, total, page, pageSize, mapper) {
  return {
    page: parseInt(page),
    page_size: parseInt(pageSize),
    total,
    items: items.map(mapper),
  };
}

/**
 * Create a simple list response with version
 */
function mapLookupResponse(items, mapper) {
  return {
    version: new Date().toISOString(),
    items: items.map(mapper),
  };
}

module.exports = {
  formatDate,
  mapOrderResponse,
  mapOrderListItem,
  mapOrderItem,
  mapOrderImage,
  mapContact,
  mapContactLookup,
  mapProduct,
  mapProductLookup,
  mapCashTransaction,
  mapLogEntry,
  mapPaginatedResponse,
  mapLookupResponse,
};
