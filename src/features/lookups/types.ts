// Types for lookups feature

import { LookupEntry } from '@/lib/apiClient';

export type ProductLookup = LookupEntry & { type: 'product' };
export type ContactLookup = LookupEntry & { type: 'contact' };

export interface ProductSearchItem {
  key: { product_id: number };
  display: { name: string; spec?: string; default_unit: string };
  type: 'product';
}

export interface ContactSearchItem {
  key: { contact_id: number };
  display: { name: string; phone?: string };
  type: 'contact';
}

export type SearchItem = ProductSearchItem | ContactSearchItem;

export interface SearchResult {
  items: SearchItem[];
  total: number;
}

// Local search options
export interface LocalSearchOptions {
  limit?: number;
  debounceMs?: number;
}

// Comparison result for sorting
export interface MatchResult {
  item: SearchItem;
  score: number;
  matchType: 'prefix' | 'contains' | 'none';
}
