'use client';

// Hook for managing lookups data with React Query

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { lookupApi, LookupEntry } from '@/lib/apiClient';
import { queryKeys } from '@/lib/queryKeys';
import { ProductLookup, ContactLookup, SearchItem } from './types';
import { localSearch } from './localSearch';

export function useLookups() {
  const { data: productsData, isLoading: productsLoading } = useQuery({
    queryKey: queryKeys.lookups.products,
    queryFn: lookupApi.getProducts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: contactsData, isLoading: contactsLoading } = useQuery({
    queryKey: queryKeys.lookups.contacts,
    queryFn: lookupApi.getContacts,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const { data: versionData } = useQuery({
    queryKey: queryKeys.lookups.version,
    queryFn: lookupApi.getVersion,
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = productsLoading || contactsLoading;

  // Transform lookup entries to searchable items
  const products = useMemo<ProductLookup[]>(() => {
    if (!productsData?.items) return [];
    return productsData.items
      .filter((item): item is LookupEntry & { key: { product_id: number } } => item.key.product_id !== undefined)
      .map((item) => ({
        ...item,
        type: 'product' as const,
      }));
  }, [productsData]);

  const contacts = useMemo<ContactLookup[]>(() => {
    if (!contactsData?.items) return [];
    return contactsData.items
      .filter((item): item is LookupEntry & { key: { contact_id: number } } => item.key.contact_id !== undefined)
      .map((item) => ({
        ...item,
        type: 'contact' as const,
      }));
  }, [contactsData]);

  const version = useMemo(() => versionData?.version, [versionData]);

  return {
    products,
    contacts,
    version,
    isLoading,
  };
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Product search hook with local fuzzy matching
export function useProductSearch(initialQuery = '') {
  const { products, isLoading } = useLookups();
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 200);

  const results = useMemo(() => {
    if (!products) return [];
    return localSearch(products as unknown as SearchItem[], debouncedQuery, 20) as ProductLookup[];
  }, [products, debouncedQuery]);

  const search = useCallback((q: string) => {
    setQuery(q);
  }, []);

  return {
    query,
    setQuery: search,
    results,
    isLoading,
  };
}

// Contact search hook with local fuzzy matching
export function useContactSearch(initialQuery = '') {
  const { contacts, isLoading } = useLookups();
  const [query, setQuery] = useState(initialQuery);
  const debouncedQuery = useDebounce(query, 200);

  const results = useMemo(() => {
    if (!contacts) return [];
    return localSearch(contacts as unknown as SearchItem[], debouncedQuery, 20) as ContactLookup[];
  }, [contacts, debouncedQuery]);

  const search = useCallback((q: string) => {
    setQuery(q);
  }, []);

  return {
    query,
    setQuery: search,
    results,
    isLoading,
  };
}
