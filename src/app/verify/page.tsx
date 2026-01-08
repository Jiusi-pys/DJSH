'use client';

import { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { Calendar as CalendarIcon, Filter } from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { QueueTabs } from '@/features/verify/components/QueueTabs';
import { VerificationQueueTable } from '@/features/verify/components/VerificationQueueTable';
import { fetchOrders } from '@/features/verify/api';
import { VerificationTab } from '@/features/verify/types';
import { createVerifyFilterFromParams, verifyFilterToSearchParams } from '@/lib/routeState';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const initialFilter = useMemo(
    () => createVerifyFilterFromParams(searchParams),
    [searchParams]
  );

  const [filter, setFilter] = useState<{
    tab: VerificationTab;
    q: string;
    dateFrom: Date | undefined;
    dateTo: Date | undefined;
  }>({
    tab: initialFilter.tab,
    q: initialFilter.q || '',
    dateFrom: initialFilter.date_from ? new Date(initialFilter.date_from) : undefined,
    dateTo: initialFilter.date_to ? new Date(initialFilter.date_to) : undefined,
  });

  // Fetch orders for "quick" tab (auto_verified=true, manual_verified=false)
  const quickOrders = useQuery({
    queryKey: ['orders', 'sales', 'quick', filter.q, filter.dateFrom, filter.dateTo],
    queryFn: () =>
      fetchOrders({
        type: 'sales',
        tab: 'quick',
        q: filter.q,
        date_from: filter.dateFrom ? format(filter.dateFrom, 'yyyy-MM-dd') : undefined,
        date_to: filter.dateTo ? format(filter.dateTo, 'yyyy-MM-dd') : undefined,
      }),
    enabled: filter.tab === 'quick',
  });

  // Fetch orders for "needs-work" tab (auto_verified=false, manual_verified=false)
  const needsWorkOrders = useQuery({
    queryKey: ['orders', 'sales', 'needs-work', filter.q, filter.dateFrom, filter.dateTo],
    queryFn: () =>
      fetchOrders({
        type: 'sales',
        tab: 'needs-work',
        q: filter.q,
        date_from: filter.dateFrom ? format(filter.dateFrom, 'yyyy-MM-dd') : undefined,
        date_to: filter.dateTo ? format(filter.dateTo, 'yyyy-MM-dd') : undefined,
      }),
    enabled: filter.tab === 'needs-work',
  });

  // Fetch orders for "all" tab (manual_verified=false)
  const allOrders = useQuery({
    queryKey: ['orders', 'sales', 'all', filter.q, filter.dateFrom, filter.dateTo],
    queryFn: () =>
      fetchOrders({
        type: 'sales',
        tab: 'all',
        q: filter.q,
        date_from: filter.dateFrom ? format(filter.dateFrom, 'yyyy-MM-dd') : undefined,
        date_to: filter.dateTo ? format(filter.dateTo, 'yyyy-MM-dd') : undefined,
      }),
    enabled: filter.tab === 'all',
  });

  const handleTabChange = useCallback((tab: VerificationTab) => {
    setFilter((prev) => ({ ...prev, tab }));
  }, []);

  const handleSearchChange = useCallback((q: string) => {
    setFilter((prev) => ({ ...prev, q }));
  }, []);

  const handleDateFromChange = useCallback((date: Date | undefined) => {
    setFilter((prev) => ({ ...prev, dateFrom: date }));
  }, []);

  const handleDateToChange = useCallback((date: Date | undefined) => {
    setFilter((prev) => ({ ...prev, dateTo: date }));
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilter({
      tab: 'all',
      q: '',
      dateFrom: undefined,
      dateTo: undefined,
    });
  }, []);

  const getCurrentOrders = () => {
    switch (filter.tab) {
      case 'quick':
        return quickOrders.data?.items || [];
      case 'needs-work':
        return needsWorkOrders.data?.items || [];
      case 'all':
        return allOrders.data?.items || [];
      default:
        return [];
    }
  };

  const isLoading =
    (filter.tab === 'quick' && quickOrders.isLoading) ||
    (filter.tab === 'needs-work' && needsWorkOrders.isLoading) ||
    (filter.tab === 'all' && allOrders.isLoading);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">订单筛选</CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="flex flex-col gap-3 sm:gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索订单号、客户名称..."
                value={filter.q}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="h-10"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none sm:w-[140px] justify-start h-10">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{filter.dateFrom ? format(filter.dateFrom, 'MM-dd') : '开始'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filter.dateFrom}
                    onSelect={handleDateFromChange}
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1 sm:flex-none sm:w-[140px] justify-start h-10">
                    <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{filter.dateTo ? format(filter.dateTo, 'MM-dd') : '结束'}</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={filter.dateTo}
                    onSelect={handleDateToChange}
                    initialFocus
                    locale={zhCN}
                  />
                </PopoverContent>
              </Popover>
              <Button variant="ghost" onClick={handleClearFilters} className="h-10">
                <Filter className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">清空</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <QueueTabs
        value={filter.tab}
        onValueChange={handleTabChange}
        counts={{
          quick: quickOrders.data?.total || 0,
          needsWork: needsWorkOrders.data?.total || 0,
          all: allOrders.data?.total || 0,
        }}
      />

      <VerificationQueueTable
        orders={getCurrentOrders()}
        isLoading={isLoading}
        type="sales"
      />
    </div>
  );
}
