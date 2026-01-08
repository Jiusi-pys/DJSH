// Query keys constants for TanStack Query
// Centralized to make cache management easier

export const queryKeys = {
  // Lookups
  lookups: {
    all: ['lookups'] as const,
    version: ['lookups', 'version'] as const,
    products: ['lookups', 'products'] as const,
    contacts: ['lookups', 'contacts'] as const,
  },

  // Orders
  orders: {
    all: (type: 'sales' | 'purchase') => ['orders', type] as const,
    list: (type: 'sales' | 'purchase', params: Record<string, unknown>) =>
      ['orders', type, 'list', params] as const,
    detail: (type: 'sales' | 'purchase', orderId: number) =>
      ['orders', type, 'detail', orderId] as const,
  },
} as const;
