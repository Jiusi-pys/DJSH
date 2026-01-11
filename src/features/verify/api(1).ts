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

// Sanitize search query to prevent injection attacks
function sanitizeSearchQuery(query: string): string {
  // Remove potentially dangerous characters and limit length
  return query
    .trim()
    .substring(0, 100)
    .replace(/[<>'"\\;]/g, '');
}

// Validate date format (YYYY-MM-DD)
function isValidDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date);
}

export function buildOrdersParams(options: UseOrdersOptions): Record<string, string | number | boolean | undefined> {
  const { tab, q, date_from, date_to, page = 1, page_size = 20 } = options;

  const baseParams: Record<string, string | number | boolean | undefined> = {
    page,
    page_size,
  };

  // Sanitize and validate search query
  if (q) {
    const sanitized = sanitizeSearchQuery(q);
    if (sanitized) {
      baseParams.q = sanitized;
    }
  }

  // Validate date formats before adding to params
  if (date_from && isValidDateFormat(date_from)) {
    baseParams.date_from = date_from;
  }

  if (date_to && isValidDateFormat(date_to)) {
    baseParams.date_to = date_to;
  }

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
