// Types for orders feature

import { OrderItem, LookupEntry } from '@/lib/apiClient';

// Form state types
export interface OrderFormData {
  contact_id: number | null;
  contact_name_raw: string | null;
  contact?: LookupEntry | null;
  order_date: string;
  remark: string;
  items: OrderItemFormData[];
}

export interface OrderItemFormData {
  item_id: number;
  product_id: number | null;
  product_name_raw: string | null;
  product?: LookupEntry | null;
  unit: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

// Computed totals
export interface OrderTotals {
  itemCount: number;
  totalAmount: number;
}

// New item placeholder type
export interface NewItemPlaceholder {
  isNew: true;
  temp_id: number;
  display: {
    product_name: null;
    product_name_raw: string | null;
    unit: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };
  key: {
    item_id: number;
    product_id: null;
  };
}

// Combined type for items
export type OrderItemDisplay = (OrderItem & { key: { product_id?: number | null } }) | NewItemPlaceholder;

// Helper to check if item is new
export function isNewItem(item: OrderItemDisplay): item is NewItemPlaceholder {
  return 'isNew' in item && item.isNew;
}

// Helper to create new item placeholder
export function createNewItem(tempId: number): NewItemPlaceholder {
  return {
    isNew: true,
    temp_id: tempId,
    display: {
      product_name: null,
      product_name_raw: null,
      unit: '个',
      unit_price: 0,
      quantity: 1,
      line_total: 0,
    },
    key: {
      item_id: -tempId,
      product_id: null,
    },
  };
}
