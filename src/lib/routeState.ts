// Route state helpers for preserving tab/filter state

import { ReadonlyURLSearchParams } from 'next/navigation';

export interface VerifyFilterState {
  tab: 'quick' | 'needs-work' | 'all';
  q?: string;
  date_from?: string;
  date_to?: string;
}

export function createVerifyFilterFromParams(
  params: ReadonlyURLSearchParams
): VerifyFilterState {
  const tab = (params.get('tab') as VerifyFilterState['tab']) || 'all';
  return {
    tab,
    q: params.get('q') || undefined,
    date_from: params.get('date_from') || undefined,
    date_to: params.get('date_to') || undefined,
  };
}

export function verifyFilterToSearchParams(state: VerifyFilterState): string {
  const searchParams = new URLSearchParams();
  if (state.tab !== 'all') {
    searchParams.set('tab', state.tab);
  }
  if (state.q) {
    searchParams.set('q', state.q);
  }
  if (state.date_from) {
    searchParams.set('date_from', state.date_from);
  }
  if (state.date_to) {
    searchParams.set('date_to', state.date_to);
  }
  return searchParams.toString();
}

export function buildOrdersApiParams(state: VerifyFilterState) {
  const params: Record<string, string | number | boolean | undefined> = {
    page: 1,
    page_size: 20,
  };

  if (state.q) {
    params.q = state.q;
  }
  if (state.date_from) {
    params.date_from = state.date_from;
  }
  if (state.date_to) {
    params.date_to = state.date_to;
  }

  switch (state.tab) {
    case 'quick':
      params.auto_verified = true;
      params.manual_verified = false;
      break;
    case 'needs-work':
      params.auto_verified = false;
      params.manual_verified = false;
      break;
    case 'all':
      params.manual_verified = false;
      break;
  }

  return params;
}
