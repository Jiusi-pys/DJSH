// Types for verify feature

import { OrderSummary } from '@/lib/apiClient';

export type VerificationTab = 'quick' | 'needs-work' | 'all';

export interface VerificationQueueItem extends OrderSummary {
  // Additional computed fields for display
  hasIssues: boolean;
  issueCount: number;
}

export type QueueTabConfig = {
  label: string;
  value: VerificationTab;
  description: string;
};

export const QUEUE_TABS: QueueTabConfig[] = [
  {
    label: '快速审核',
    value: 'quick',
    description: '自动通过待人工确认',
  },
  {
    label: '待处理',
    value: 'needs-work',
    description: '需要人工处理问题',
  },
  {
    label: '全部待审',
    value: 'all',
    description: '所有未审核订单',
  },
];

// Issue tag display mapping
export const ISSUE_TAG_LABELS: Record<string, string> = {
  CONTACT_NOT_FOUND: '客户未找到',
  PRODUCT_NOT_FOUND: '商品未找到',
  TOTAL_MISMATCH: '金额不符',
  DATE_PARSE_FAIL: '日期解析失败',
  AMOUNT_PARSE_FAIL: '金额解析失败',
  DUPLICATE_ORDER: '重复单据',
  INVALID_FORMAT: '格式错误',
  OCR_FAILED: '识别失败',
  IMAGE_QUALITY_LOW: '图片模糊',
};

// Issue tag severity for styling
export const ISSUE_TAG_SEVERITY: Record<string, 'error' | 'warning' | 'info'> = {
  CONTACT_NOT_FOUND: 'warning',
  PRODUCT_NOT_FOUND: 'warning',
  TOTAL_MISMATCH: 'error',
  DATE_PARSE_FAIL: 'warning',
  AMOUNT_PARSE_FAIL: 'warning',
  DUPLICATE_ORDER: 'warning',
  INVALID_FORMAT: 'error',
  OCR_FAILED: 'warning',
  IMAGE_QUALITY_LOW: 'info',
};
