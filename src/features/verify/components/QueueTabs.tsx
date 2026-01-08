'use client';

// Queue tabs component for switching between verification views

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QUEUE_TABS, VerificationTab } from '../types';

interface QueueTabsProps {
  value: VerificationTab;
  onValueChange: (value: VerificationTab) => void;
  counts?: {
    quick: number;
    needsWork: number;
    all: number;
  };
  className?: string;
}

export function QueueTabs({ value, onValueChange, counts, className = '' }: QueueTabsProps) {
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as VerificationTab)} className={className}>
      <TabsList className="grid w-full grid-cols-3">
        {QUEUE_TABS.map((tab) => (
          <TabsTrigger key={tab.value} value={tab.value} className="relative">
            {tab.label}
            {counts && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                ({counts[tab.value === 'quick' ? 'quick' : tab.value === 'needs-work' ? 'needsWork' : 'all'] ?? 0})
              </span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  );
}
