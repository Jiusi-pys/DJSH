'use client';

// Order items table component with inline editing

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Search } from 'lucide-react';
import { OrderItemDisplay, createNewItem, isNewItem } from '../types';
import { formatCurrency, calculateLineTotal } from '@/lib/format';
import { useProductSearch } from '@/features/lookups/useLookups';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';

// 数字输入组件 - 解决小数输入问题
interface NumberInputProps {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  step?: string;
  min?: string;
}

function NumberInput({ value, onChange, disabled, className, step = "0.01", min = "0" }: NumberInputProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditingRef = useRef(false);

  // 当外部value变化时，如果不在编辑状态，则更新显示值
  useEffect(() => {
    if (!isEditingRef.current) {
      setInputValue(String(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // 只有当输入的是有效数字时才触发onChange
    const numValue = parseFloat(newValue);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  const handleFocus = () => {
    isEditingRef.current = true;
  };

  const handleBlur = () => {
    isEditingRef.current = false;
    // 当失去焦点时，确保显示正确的数字格式
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) {
      setInputValue(String(value));
    } else {
      setInputValue(String(numValue));
      onChange(numValue);
    }
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      value={inputValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      disabled={disabled}
      className={className}
      pattern="[0-9]*\.?[0-9]*"
    />
  );
}

interface OrderItemsTableProps {
  items: OrderItemDisplay[];
  onItemsChange: (items: OrderItemDisplay[]) => void;
  readOnly?: boolean;
}

export function OrderItemsTable({ items, onItemsChange, readOnly = false }: OrderItemsTableProps) {
  const [tempIdCounter, setTempIdCounter] = useState(0);

  const handleAddItem = useCallback(() => {
    const newItem = createNewItem(tempIdCounter + 1);
    setTempIdCounter((prev) => prev + 1);
    onItemsChange([...items, newItem]);
  }, [items, onItemsChange, tempIdCounter]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onItemsChange(newItems);
    },
    [items, onItemsChange]
  );

  const handleUpdateItem = useCallback(
    (index: number, updates: Partial<OrderItemDisplay>) => {
      const newItems = items.map((item, i) => (i === index ? { ...item, ...updates } as OrderItemDisplay : item));
      onItemsChange(newItems);
    },
    [items, onItemsChange]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">商品明细</h3>
        {!readOnly && (
          <Button onClick={handleAddItem} size="sm">
            <Plus className="w-4 h-4 mr-1" />
            添加商品
          </Button>
        )}
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">商品</TableHead>
              <TableHead className="w-[80px]">单位</TableHead>
              <TableHead className="w-[100px]">单价</TableHead>
              <TableHead className="w-[100px]">数量</TableHead>
              <TableHead className="w-[100px] text-right">金额</TableHead>
              {!readOnly && <TableHead className="w-[60px]"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, index) => {
              const productName = isNewItem(item)
                ? item.display.product_name_raw || ''
                : item.display.product_name || item.display.product_name_raw || '';

              return (
                <TableRow key={item.key.item_id}>
                  <TableCell>
                    {readOnly ? (
                      <span>{productName || '-'}</span>
                    ) : (
                      <ProductSelector
                        value={item}
                        onChange={(product) => handleUpdateItem(index, product)}
                      />
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      value={item.display.unit}
                      onChange={(e) =>
                        handleUpdateItem(index, { display: { ...item.display, unit: e.target.value } } as OrderItemDisplay)
                      }
                      disabled={readOnly}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      value={item.display.unit_price}
                      onChange={(price) => {
                        const quantity = item.display.quantity;
                        const lineTotal = calculateLineTotal(price, quantity);
                        handleUpdateItem(index, {
                          display: { ...item.display, unit_price: price, line_total: lineTotal },
                        } as OrderItemDisplay);
                      }}
                      disabled={readOnly}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      value={item.display.quantity}
                      onChange={(quantity) => {
                        const price = item.display.unit_price;
                        const lineTotal = calculateLineTotal(price, quantity);
                        handleUpdateItem(index, {
                          display: { ...item.display, quantity, line_total: lineTotal },
                        } as OrderItemDisplay);
                      }}
                      disabled={readOnly}
                      className="h-8"
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(item.display.line_total)}
                  </TableCell>
                  {!readOnly && (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(index)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="text-right space-y-1">
          <div className="text-sm text-muted-foreground">
            共 {items.length} 项
          </div>
          <div className="text-2xl font-bold">
            合计: {formatCurrency(items.reduce((sum, item) => sum + item.display.line_total, 0))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Product selector component with autocomplete
interface ProductSelectorProps {
  value: OrderItemDisplay;
  onChange: (updates: Partial<OrderItemDisplay>) => void;
}

function ProductSelector({ value, onChange }: ProductSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const { results, setQuery: search } = useProductSearch(query);

  const selectedProductName = isNewItem(value)
    ? value.display.product_name_raw
    : value.display.product_name;

  const handleSelect = (product: { key: { product_id: number }; display: { name: string; spec?: string; default_unit: string } }) => {
    onChange({
      key: { ...value.key, product_id: product.key.product_id } as OrderItemDisplay['key'],
      display: {
        ...value.display,
        product_name: product.display.name,
        product_name_raw: null,
        unit: product.display.default_unit || value.display.unit,
      },
    } as Partial<OrderItemDisplay>);
    setOpen(false);
    setQuery('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setQuery(newValue);
    search(newValue);

    if (value.key.product_id) {
      onChange({
        key: { ...value.key, product_id: null } as OrderItemDisplay['key'],
        display: {
          ...value.display,
          product_name: null,
          product_name_raw: newValue,
        },
      } as Partial<OrderItemDisplay>);
    } else {
      onChange({
        display: {
          ...value.display,
          product_name_raw: newValue,
        },
      } as Partial<OrderItemDisplay>);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className={`w-full justify-between h-8 ${!selectedProductName ? 'text-muted-foreground' : ''}`}
        >
          {selectedProductName || '搜索商品...'}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <input
              placeholder="搜索商品..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                search(e.target.value);
              }}
              className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>
          <CommandEmpty>未找到商品</CommandEmpty>
          <CommandGroup>
            {results.map((product) => (
              <CommandItem
                key={product.key.product_id}
                value={product.display.name}
                onSelect={() => handleSelect(product as unknown as { key: { product_id: number }; display: { name: string; spec?: string; default_unit: string } })}
              >
                <div className="flex flex-col">
                  <span>{product.display.name}</span>
                  {product.display.spec && (
                    <span className="text-xs text-muted-foreground">{product.display.spec}</span>
                  )}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
