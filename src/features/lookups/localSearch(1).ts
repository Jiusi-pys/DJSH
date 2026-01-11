// Local fuzzy search implementation for lookups

import { SearchItem } from './types';

export function localSearch(
  items: SearchItem[],
  query: string,
  limit = 20
): SearchItem[] {
  if (!query || query.trim() === '') {
    return items.slice(0, limit);
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Score and match each item
  const results = items
    .map((item) => {
      const name = item.display.name.toLowerCase();
      let score = 0;
      let matchType: 'prefix' | 'contains' | 'none' = 'none';

      if (name.startsWith(normalizedQuery)) {
        // Prefix match gets highest score
        score = 100 - name.length; // Shorter names rank higher
        matchType = 'prefix';
      } else if (name.includes(normalizedQuery)) {
        // Contains match gets lower score
        score = 50 - name.length; // Shorter names rank higher
        matchType = 'contains';
      } else {
        // No match, skip
        return null;
      }

      return { item, score, matchType };
    })
    .filter((result): result is { item: SearchItem; score: number; matchType: 'prefix' | 'contains' } => result !== null);

  // Sort by match type (prefix first), then by score
  results.sort((a, b) => {
    // Priority: prefix > contains
    if (a.matchType !== b.matchType) {
      return a.matchType === 'prefix' ? -1 : 1;
    }
    // Then by score (higher is better)
    return b.score - a.score;
  });

  return results.slice(0, limit).map((r) => r.item);
}

export function getItemDisplayName(item: SearchItem): string {
  const spec = 'spec' in item.display ? item.display.spec : undefined;
  if (spec) {
    return `${item.display.name} (${spec})`;
  }
  return item.display.name;
}

export function getItemSubtitle(item: SearchItem): string {
  if (item.type === 'contact') {
    return ('phone' in item.display ? item.display.phone : '') || '';
  }
  return ('default_unit' in item.display ? item.display.default_unit : '') || '';
}
