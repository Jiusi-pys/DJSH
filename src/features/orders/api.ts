// API functions for orders feature

import { orderApi, UpdateOrderRequest, OrderDetail } from '@/lib/apiClient';

export async function fetchOrderDetail(type: 'sales' | 'purchase', orderId: number) {
  return orderApi.getOrder(type, orderId);
}

export async function updateOrder(
  type: 'sales' | 'purchase',
  orderId: number,
  data: UpdateOrderRequest
) {
  return orderApi.updateOrder(type, orderId, data);
}

export async function verifyOrder(
  type: 'sales' | 'purchase',
  orderId: number,
  version: number
) {
  return orderApi.verifyOrder(type, orderId, version);
}

// Transform order detail to form data
export function orderDetailToFormData(order: OrderDetail) {
  return {
    contact_id: order.display.contact?.key.contact_id ?? null,
    contact_name_raw: null,
    contact: order.display.contact,
    order_date: order.display.order_date,
    remark: order.display.remark || '',
    items: order.display.items.map((item) => ({
      key: { item_id: item.key.item_id, product_id: item.key.product_id ?? null },
      display: {
        product_name: item.display.product_name ?? null,
        product_name_raw: item.display.product_name_raw ?? null,
        unit: item.display.unit,
        unit_price: item.display.unit_price,
        quantity: item.display.quantity,
        line_total: item.display.line_total,
      },
    })),
  };
}

// Transform form data to update request
export function formDataToUpdateRequest(
  formData: ReturnType<typeof orderDetailToFormData>,
  version: number
): UpdateOrderRequest {
  return {
    version,
    contact_id: formData.contact_id,
    contact_name_raw: formData.contact_name_raw,
    order_date: formData.order_date,
    remark: formData.remark || undefined,
    items: formData.items.map((item) => ({
      item_id: item.key.item_id,
      product_id: item.key.product_id,
      product_name_raw: item.display.product_name_raw,
      unit: item.display.unit,
      unit_price: item.display.unit_price,
      quantity: item.display.quantity,
    })),
  };
}
