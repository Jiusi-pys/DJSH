'use client';

// Order header form component

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { LookupEntry } from '@/lib/apiClient';
import { useContactSearch } from '@/features/lookups/useLookups';

interface OrderHeaderFormProps {
  orderNo: string;
  orderDate: string;
  remark: string;
  contact?: LookupEntry | null;
  contactNameRaw?: string | null;
  onOrderNoChange?: (orderNo: string) => void;
  onDateChange: (date: string) => void;
  onRemarkChange: (remark: string) => void;
  onContactSelect: (contact: LookupEntry | null) => void;
  onContactRawChange: (name: string | null) => void;
  readOnly?: boolean;
}

export function OrderHeaderForm({
  orderNo,
  orderDate,
  remark,
  contact,
  contactNameRaw,
  onOrderNoChange,
  onDateChange,
  onRemarkChange,
  onContactSelect,
  onContactRawChange,
  readOnly = false,
}: OrderHeaderFormProps) {
  const [dateOpen, setDateOpen] = useState(false);
  const [contactOpen, setContactOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, setQuery: search, isLoading } = useContactSearch(query);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(format(date, 'yyyy-MM-dd'));
      setDateOpen(false);
    }
  };

  const handleContactSelect = (c: LookupEntry) => {
    onContactSelect(c);
    onContactRawChange(null);
    setContactOpen(false);
    setQuery('');
  };

  const handleContactInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    search(value);

    if (contact) {
      onContactSelect(null);
    }
    onContactRawChange(value || null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b">
      {/* Order Number */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">订单号</Label>
        <Input
          value={orderNo}
          onChange={(e) => onOrderNoChange?.(e.target.value)}
          placeholder="输入订单号"
          disabled={readOnly}
        />
      </div>

      {/* Order Date */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">日期</Label>
        <Popover open={dateOpen} onOpenChange={setDateOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={`w-full justify-start text-left font-normal ${!orderDate ? 'text-muted-foreground' : ''}`}
              disabled={readOnly}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {orderDate ? format(new Date(orderDate), 'yyyy年MM月dd日') : '选择日期'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={orderDate ? new Date(orderDate) : undefined}
              onSelect={handleDateSelect}
              initialFocus
              locale={zhCN}
            />
          </PopoverContent>
        </Popover>
      </div>

      {/* Contact Selector */}
      <div>
        <Label className="text-xs text-muted-foreground mb-1 block">客户</Label>
        <Popover open={contactOpen} onOpenChange={setContactOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              className={`w-full justify-between ${!contact && !contactNameRaw ? 'text-muted-foreground' : ''}`}
              disabled={readOnly}
            >
              {contact?.display.name || contactNameRaw || '搜索客户...'}
              <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[300px] p-0" align="start">
            <Command>
              <div className="flex items-center border-b px-3">
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                <input
                  placeholder="搜索客户..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    search(e.target.value);
                  }}
                  className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <CommandEmpty>未找到客户</CommandEmpty>
              <CommandGroup>
                {results.map((c) => (
                  <CommandItem
                    key={c.key.contact_id}
                    value={c.display.name}
                    onSelect={() => handleContactSelect(c as unknown as LookupEntry)}
                  >
                    <div className="flex flex-col">
                      <span>{c.display.name}</span>
                      {c.display.phone && (
                        <span className="text-xs text-muted-foreground">{c.display.phone}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {/* Remark */}
      <div className="md:col-span-3">
        <Label className="text-xs text-muted-foreground mb-1 block">备注</Label>
        <Input
          value={remark}
          onChange={(e) => onRemarkChange(e.target.value)}
          placeholder="添加备注..."
          disabled={readOnly}
        />
      </div>
    </div>
  );
}
