// Typed API client wrapper for the finance management API
// This module provides type-safe API calls without exposing internal IDs

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8080';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params } = options;

  const url = new URL(`${API_BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `API Error: ${response.status}`);
  }

  return response.json();
}

// Lookup APIs
export const lookupApi = {
  getVersion: () => request<{ version: string }>('/lookups/version'),

  getProducts: () =>
    request<{ version: string; items: LookupEntry[] }>('/lookups/products'),

  getContacts: () =>
    request<{ version: string; items: LookupEntry[] }>('/lookups/contacts'),
};

// Order APIs
export const orderApi = {
  getOrders: (type: 'sales' | 'purchase', params: Record<string, string | number | boolean | undefined>) =>
    request<OrdersResponse>(`/orders/${type}`, { params }),

  getOrder: (type: 'sales' | 'purchase', orderId: number) =>
    request<OrderDetail>(`/orders/${type}/${orderId}`),

  updateOrder: (type: 'sales' | 'purchase', orderId: number, data: UpdateOrderRequest) =>
    request<OrderDetail>(`/orders/${type}/${orderId}`, {
      method: 'PUT',
      body: data,
    }),

  verifyOrder: (type: 'sales' | 'purchase', orderId: number, version: number) =>
    request<OrderDetail>(`/orders/${type}/${orderId}/verify`, {
      method: 'POST',
      body: { version },
    }),
};

// Type definitions for API responses
export interface LookupEntry {
  key: { product_id?: number; contact_id?: number };
  display: {
    name: string;
    spec?: string;
    default_unit?: string;
    unit_price?: number;
    category?: string;
    phone?: string;
    wechat?: string;
    qq?: string;
    contact_person?: string;
    is_disabled?: boolean;
  };
}

export interface OrdersResponse {
  page: number;
  page_size: number;
  total: number;
  items: OrderSummary[];
}

export interface OrderSummary {
  key: { order_id: number; order_type: 'sales' | 'purchase' };
  display: {
    order_no: string;
    contact_name: string;
    order_date: string;
    total_amount: number;
    manual_verified: boolean;
    auto_verified: boolean;
    settled: boolean;
    cancelled: boolean;
    issue_tags: string[];
    image_count: number;
  };
}

export interface OrderDetail {
  key: { order_id: number; order_type: 'sales' | 'purchase'; version: number };
  display: {
    order_no: string;
    contact: LookupEntry | null;
    order_date: string;
    manual_verified: boolean;
    auto_verified: boolean;
    settled: boolean;
    cancelled: boolean;
    cancelled_reason?: string;
    cancelled_at?: string;
    total_amount: number;
    remark?: string;
    issues: { code: string; detail?: string }[];
    images: { key: { image_id: number }; display: { mime_type: string; base64: string } }[];
    items: OrderItem[];
  };
}

export interface OrderItem {
  key: { item_id: number; product_id?: number | null };
  display: {
    product_name?: string | null;
    product_name_raw?: string | null;
    unit: string;
    unit_price: number;
    quantity: number;
    line_total: number;
  };
}

export interface UpdateOrderRequest {
  version: number;
  order_no?: string;
  contact_id?: number | null;
  contact_name_raw?: string | null;
  order_date: string;
  remark?: string;
  items: {
    item_id: number;
    product_id?: number | null;
    product_name_raw?: string | null;
    unit: string;
    unit_price: number;
    quantity: number;
  }[];
}

// Cash Transactions API
export interface CashTransaction {
  key: { transaction_id: number };
  display: {
    trans_date: string;
    trans_type: 'income' | 'expense';
    amount: number;
    category: string;
    contact_name: string;
    remark: string;
  };
}

export interface CashTransactionsResponse {
  page: number;
  page_size: number;
  total: number;
  items: CashTransaction[];
}

export interface DashboardStats {
  todaySales: { amount: number; count: number };
  yesterdaySales: number;
  monthSales: { amount: number; count: number };
  lastMonthSales: number;
  monthPurchase: { amount: number; count: number };
  orderStats: { pending: number; verified: number; cancelled: number };
  cashFlow: { income: number; expense: number; net: number };
  totalCustomers: number;
  totalProducts: number;
  salesTrend: { date: string; amount: number; count: number }[];
  topProducts: { name: string; quantity: number; amount: number }[];
  topCustomers: { name: string; orderCount: number; amount: number }[];
  recentOrders: OrderSummary[];
}

// Cash and Dashboard APIs
export const cashApi = {
  getTransactions: (params?: { type?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }) =>
    request<CashTransactionsResponse>('/cash/transactions', { params }),
  create: (data: { trans_type: 'income' | 'expense'; amount: number; category?: string; trans_date?: string; remark?: string }) =>
    request<CashTransaction>('/cash/transactions', { method: 'POST', body: data }),
};

export const dashboardApi = {
  getStats: () => request<DashboardStats>('/dashboard/stats'),
};

// Create APIs
export const contactsApi = {
  create: (data: { name: string; phone?: string; contact_person?: string; wechat?: string; qq?: string }) =>
    request<LookupEntry>('/contacts', { method: 'POST', body: data }),
  update: (id: number, data: { name: string; contact_person?: string; phone?: string; wechat?: string; qq?: string }) =>
    request<LookupEntry>(`/contacts/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/contacts/${id}`, { method: 'DELETE' }),
  disable: (id: number) =>
    request<{ success: boolean; message: string }>(`/contacts/${id}/disable`, { method: 'POST' }),
  enable: (id: number) =>
    request<{ success: boolean; message: string }>(`/contacts/${id}/enable`, { method: 'POST' }),
};

export const productsApi = {
  create: (data: { name: string; spec?: string; unit?: string; unit_price?: number; category?: string; remark?: string }) =>
    request<LookupEntry>('/products', { method: 'POST', body: data }),
  update: (id: number, data: { name: string; spec?: string; unit: string; unit_price?: number; category?: string }) =>
    request<LookupEntry>(`/products/${id}`, { method: 'PUT', body: data }),
  delete: (id: number) =>
    request<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' }),
  disable: (id: number) =>
    request<{ success: boolean; message: string }>(`/products/${id}/disable`, { method: 'POST' }),
  enable: (id: number) =>
    request<{ success: boolean; message: string }>(`/products/${id}/enable`, { method: 'POST' }),
};

export const ordersApi = {
  create: (type: 'sales' | 'purchase', data: { order_no?: string; contact_id?: number; order_date: string; remark?: string; items: OrderItemFormData[] }) =>
    request<OrderDetail>(`/orders/${type}`, { method: 'POST', body: data }),
  cancel: (type: 'sales' | 'purchase', orderId: number, version: number, reason?: string) =>
    request<{ success: boolean }>(`/orders/${type}/${orderId}/cancel`, {
      method: 'POST',
      body: { version, reason }
    }),
  restore: (type: 'sales' | 'purchase', orderId: number, version: number) =>
    request<{ success: boolean }>(`/orders/${type}/${orderId}/restore`, {
      method: 'POST',
      body: { version }
    }),
};

export interface OrderItemFormData {
  product_id?: number | null;
  product_name_raw?: string | null;
  unit: string;
  unit_price: number;
  quantity: number;
}

// 日志相关类型
export interface LogEntry {
  key: { log_id: number };
  display: {
    module: string;
    action: string;
    target_type: string | null;
    target_id: number | null;
    target_name: string | null;
    user_info: string | null;
    request_method: string | null;
    request_path: string | null;
    ip_address: string | null;
    status: 'success' | 'failed';
    error_message: string | null;
    duration_ms: number | null;
    created_at: string;
    old_data: Record<string, unknown> | null;
    new_data: Record<string, unknown> | null;
    is_undone: boolean;
  };
}

export interface LogListResponse {
  items: LogEntry[];
  total: number;
  page: number;
  limit: number;
}

export interface UndoRedoResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export const logsApi = {
  getList: (params: { module?: string; action?: string; page?: number; limit?: number }) =>
    request<LogListResponse>('/logs', { params }),
  getModules: () =>
    request<Array<{ value: string; label: string }>>('/logs/modules'),
  getActions: () =>
    request<Array<{ value: string; label: string }>>('/logs/actions'),
  undo: (logId: number) =>
    request<UndoRedoResponse>(`/logs/${logId}/undo`, { method: 'POST' }),
  redo: (logId: number) =>
    request<UndoRedoResponse>(`/logs/${logId}/redo`, { method: 'POST' }),
};

// 图片上传和删除 API
export interface ImageUploadResponse {
  key: { image_id: number };
  display: { mime_type: string; base64: string };
}

export const imageApi = {
  // 上传 base64 图片数据
  upload: (type: 'sales' | 'purchase', orderId: number, data: { image_data: string; mime_type: string }) =>
    request<ImageUploadResponse>(`/orders/${type}/${orderId}/images`, {
      method: 'POST',
      body: data,
    }),
  delete: (type: 'sales' | 'purchase', orderId: number, imageId: number) =>
    request<{ success: boolean }>(`/orders/${type}/${orderId}/images/${imageId}`, {
      method: 'DELETE',
    }),
};
