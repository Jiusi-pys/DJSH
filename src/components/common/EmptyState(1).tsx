'use client';

// Empty state component

import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  title = '暂无数据',
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <Inbox className="w-12 h-12 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm mb-4">{description}</p>
      )}
      {action}
    </div>
  );
}
