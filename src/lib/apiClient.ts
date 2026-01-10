// Typed API client wrapper for the finance management API
// This module provides type-safe API calls without exposing internal IDs

// Validate API base URL
function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!url) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('NEXT_PUBLIC_API_BASE_URL must be set in production');
    }
    console.warn('NEXT_PUBLIC_API_BASE_URL not set, using default localhost:8080');
    return 'http://localhost:8080';
  }

  // Validate URL format
  try {
    new URL(url);
  } catch {
    throw new Error(`Invalid NEXT_PUBLIC_API_BASE_URL: ${url}`);
  }

  return url;
}

const API_BASE_URL = getApiBaseUrl();

// Request timeout in milliseconds
const REQUEST_TIMEOUT = 30000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

// Safe error messages mapping
const ERROR_MESSAGES: Record<number, string> = {
  400: '请求参数错误',
  401: '认证失败，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  409: '数据冲突，请刷新后重试',
  422: '数据验证失败',
  500: '服务器错误，请稍后重试',
  502: '网关错误，请稍后重试',
  503: '服务暂时不可用，请稍后重试',
};

function sanitizeErrorMessage(status: number, message?: string): string {
  // Use safe predefined message for the status code
  const safeMessage = ERROR_MESSAGES[status];

  if (safeMessage) {
    return safeMessage;
  }

  // For other errors, provide generic message
  if (status >= 500) {
    return '服务器错误，请稍后重试';
  }

  if (status >= 400) {
    return '请求失败，请检查输入或稍后重试';
  }

  return message || `请求失败 (${status})`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('请求超时，请检查网络连接');
    }
    throw error;
  }
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, timeout = REQUEST_TIMEOUT } = options;

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

  const response = await fetchWithTimeout(
    url.toString(),
    {
      method,
      headers,
      credentials: 'include', // ✅ Include cookies for authentication
      body: body ? JSON.stringify(body) : undefined,
    },
    timeout
  );

  // Validate Content-Type before parsing
  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let errorMessage: string;

    if (isJson) {
      const errorData = await response.json().catch(() => ({}));
      // Sanitize error message to prevent information leakage
      errorMessage = sanitizeErrorMessage(response.status, errorData.message);
    } else {
      errorMessage = sanitizeErrorMessage(response.status);
    }

    throw new Error(errorMessage);
  }

  if (!isJson) {
    throw new Error('服务器返回了无效的响应格式');
  }

  return response.json();
}

// Lookup APIs
export const lookupApi = {
  getVersion: () => request<{ version: string }>('/lookups/version'),

  getProducts: () =>
    request<{ version: string; items: LookupEntry[] }>('/lookups/products'),

  getContacts: (type?: 'customer' | 'supplier') =>
    request<{ version: string; items: LookupEntry[] }>('/lookups/contacts', {
      params: type ? { type } : undefined,
    }),
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

  verifyOrder: (type: 'sales' | 'purchase', orderId: number, version: number, settledImmediately?: boolean) =>
    request<OrderDetail>(`/orders/${type}/${orderId}/verify`, {
      method: 'POST',
      body: { version, settled_immediately: settledImmediately },
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
  getBalance: () => request<{ balance: number }>('/cash/balance'),
  getTransactions: (params?: { type?: string; date_from?: string; date_to?: string; page?: number; page_size?: number }) =>
    request<CashTransactionsResponse>('/cash/transactions', { params }),
  create: (data: { trans_type: 'income' | 'expense'; amount: number; category?: string; trans_date?: string; remark?: string }) =>
    request<CashTransaction>('/cash/transactions', { method: 'POST', body: data }),
  uploadImage: (transactionId: number, data: { image_data: string; mime_type: string }) =>
    request<ImageUploadResponse>(`/cash/transactions/${transactionId}/images`, {
      method: 'POST',
      body: data,
    }),
  getImages: (transactionId: number) =>
    request<{ items: Array<{ key: { image_id: number }; display: { mime_type: string; base64: string } }> }>(`/cash/transactions/${transactionId}/images`),
  deleteImage: (transactionId: number, imageId: number) =>
    request<{ success: boolean }>(`/cash/transactions/${transactionId}/images/${imageId}`, {
      method: 'DELETE',
    }),
  cancel: (transactionId: number, version: number, reason?: string) =>
    request<{ success: boolean }>(`/cash/transactions/${transactionId}/cancel`, {
      method: 'PUT',
      body: { version, reason },
    }),
  restore: (transactionId: number, version: number) =>
    request<{ success: boolean }>(`/cash/transactions/${transactionId}/restore`, {
      method: 'PUT',
      body: { version },
    }),
  verify: (transactionId: number, version: number) =>
    request<{ success: boolean }>(`/cash/transactions/${transactionId}/verify`, {
      method: 'PUT',
      body: { version },
    }),
  unverify: (transactionId: number, version: number) =>
    request<{ success: boolean }>(`/cash/transactions/${transactionId}/unverify`, {
      method: 'PUT',
      body: { version },
    }),
};

export const dashboardApi = {
  getStats: () => request<DashboardStats>('/dashboard/stats'),
};

// Statistics APIs
export const statisticsApi = {
  getCustomerOutstanding: () => request<{
    items: Array<{
      key: { contact_id: number };
      display: {
        contact_name: string;
        contact_type: string;
        phone: string;
        total_sales: number;
        total_received: number;
        outstanding: number;
      };
    }>;
  }>('/statistics/customer-outstanding'),

  getProductSales: () => request<{
    items: Array<{
      key: { product_id: number };
      display: {
        product_name: string;
        spec: string;
        unit: string;
        current_price: number;
        category: string;
        total_sold: number;
        total_revenue: number;
        avg_price: number;
      };
    }>;
  }>('/statistics/product-sales'),

  getInventory: () => request<{
    items: Array<{
      key: { product_id: number };
      display: {
        product_name: string;
        spec: string;
        unit: string;
        unit_price: number;
        category: string;
        purchased: number;
        sold: number;
        stock: number;
        purchase_cost: number;
        sales_revenue: number;
      };
    }>;
  }>('/statistics/inventory'),
};

// Create APIs
export const contactsApi = {
  create: (data: { name: string; phone?: string; contact_person?: string; wechat?: string; qq?: string; contact_type?: 'customer' | 'supplier' | 'both' }) =>
    request<LookupEntry>('/contacts', { method: 'POST', body: data }),
  update: (id: number, data: { name: string; contact_person?: string; phone?: string; wechat?: string; qq?: string; contact_type?: 'customer' | 'supplier' | 'both' }) =>
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
