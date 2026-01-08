'use client';

// Issue badges component for displaying issue tags

import { Badge } from '@/components/ui/badge';
import { ISSUE_TAG_LABELS, ISSUE_TAG_SEVERITY } from '../types';

interface IssueBadgesProps {
  issues: string[];
  className?: string;
}

export function IssueBadges({ issues, className = '' }: IssueBadgesProps) {
  if (!issues || issues.length === 0) {
    return null;
  }

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {issues.map((code) => {
        const label = ISSUE_TAG_LABELS[code] || code;
        const severity = ISSUE_TAG_SEVERITY[code] || 'warning';

        const variantMap = {
          error: 'destructive' as const,
          warning: 'secondary' as const,
          info: 'outline' as const,
        };

        return (
          <Badge key={code} variant={variantMap[severity]} className="text-xs">
            {label}
          </Badge>
        );
      })}
    </div>
  );
}
