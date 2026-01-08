// API functions for verify feature

import { orderApi, OrdersResponse } from '@/lib/apiClient';
import { VerificationTab } from './types';

export interface UseOrdersOptions {
  type: 'sales' | 'purchase';
  tab: VerificationTab;
  q?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

export function buildOrdersParams(options: UseOrdersOptions): Record<string, string | number | boolean | undefined> {
  const { tab, q, date_from, date_to, page = 1, page_size = 20 } = options;

  const baseParams: Record<string, string | number | boolean | undefined> = {
    page,
    page_size,
  };

  if (q) baseParams.q = q;
  if (date_from) baseParams.date_from = date_from;
  if (date_to) baseParams.date_to = date_to;

  switch (tab) {
    case 'quick':
      baseParams.auto_verified = true;
      baseParams.manual_verified = false;
      break;
    case 'needs-work':
      baseParams.auto_verified = false;
      baseParams.manual_verified = false;
      break;
    case 'all':
      baseParams.manual_verified = false;
      break;
  }

  return baseParams;
}

export function fetchOrders(options: UseOrdersOptions): Promise<OrdersResponse> {
  const params = buildOrdersParams(options);
  return orderApi.getOrders(options.type, params);
}
