'use client';

// Loading state component

import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  className?: string;
}

export function LoadingState({ message = '加载中...', className = '' }: LoadingStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  );
}
