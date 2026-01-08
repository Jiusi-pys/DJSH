'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2 } from 'lucide-react';
import { ordersApi, LookupEntry } from '@/lib/apiClient';
import { useLookups } from '@/features/lookups/useLookups';
import { formatCurrency, calculateLineTotal } from '@/lib/format';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Search } from 'lucide-react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface CreateOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: 'sales' | 'purchase';
}

interface OrderItemForm {
  product_id?: number | null;
  product_name: string;
  unit: string;
  unit_price: number;
  quantity: number;
}

export function CreateOrderDialog({ open, onOpenChange, type }: CreateOrderDialogProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { contacts, products } = useLookups();

  const [orderNo, setOrderNo] = useState('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [selectedContact, setSelectedContact] = useState<LookupEntry | null>(null);
  const [contactSearch, setContactSearch] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [items, setItems] = useState<OrderItemForm[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [productOpen, setProductOpen] = useState(false);

  // 重置表单当对话框打开时
  useEffect(() => {
    if (open) {
      setOrderNo('');
      setOrderDate(new Date());
      setSelectedContact(null);
      setItems([]);
    }
  }, [open]);

  const filteredContacts = useMemo(() => {
    if (!contactSearch) return contacts;
    return contacts.filter(c =>
      c.display.name.toLowerCase().includes(contactSearch.toLowerCase())
    );
  }, [contacts, contactSearch]);

  const filteredProducts = useMemo(() => {
    if (!productSearch) return products;
    return products.filter(p =>
      p.display.name.toLowerCase().includes(productSearch.toLowerCase())
    );
  }, [products, productSearch]);

  const createMutation = useMutation({
    mutationFn: (data: { order_no?: string; contact_id?: number; order_date: string; items: OrderItemForm[] }) =>
      ordersApi.create(type, {
        order_no: data.order_no || undefined,
        contact_id: data.contact_id,
        order_date: format(data.order_date, 'yyyy-MM-dd'),
        items: data.items.map(item => ({
          product_id: item.product_id,
          product_name_raw: item.product_id ? undefined : item.product_name,
          unit: item.unit,
          unit_price: item.unit_price,
          quantity: item.quantity,
        })),
      }),
    onSuccess: (newOrder) => {
      queryClient.invalidateQueries({ queryKey: ['orders', type] });
      queryClient.invalidateQueries({ queryKey: ['lookups'] });
      onOpenChange(false);
      // 跳转到新订单详情页
      router.push(`/orders/${type}/${newOrder.key.order_id}`);
    },
  });

  const handleAddProduct = (product: LookupEntry) => {
    const existing = items.find(i => i.product_id === product.key.product_id);
    if (existing) return;

    setItems([...items, {
      product_id: product.key.product_id,
      product_name: product.display.name,
      unit: product.display.default_unit || '个',
      unit_price: 0,
      quantity: 1,
    }]);
    setProductSearch('');
    setProductOpen(false);
  };

  const handleAddCustomProduct = () => {
    if (!productSearch.trim()) return;
    setItems([...items, {
      product_id: null,
      product_name: productSearch,
      unit: '个',
      unit_price: 0,
      quantity: 1,
    }]);
    setProductSearch('');
  };

  const handleUpdateItem = (index: number, updates: Partial<OrderItemForm>) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], ...updates };
    setItems(newItems);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (items.length === 0) return;
    createMutation.mutate({
      order_no: orderNo || undefined,
      contact_id: selectedContact?.key.contact_id,
      order_date: format(orderDate, 'yyyy-MM-dd'),
      items,
    });
  };

  const totalAmount = items.reduce((sum, item) => sum + calculateLineTotal(item.unit_price, item.quantity), 0);

  return (
    <>
      {/* 隐藏的 Dialog 容器 */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => onOpenChange(false)}
          />

          {/* Dialog */}
          <div className="relative bg-background rounded-lg shadow-lg w-full max-w-3xl max-h-[90vh] overflow-auto m-4">
            <div className="p-6">
              <h2 className="text-xl font-bold mb-4">
                {type === 'sales' ? '新建销售订单' : '新建采购订单'}
              </h2>

              {/* 订单信息 */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <Label>订单号</Label>
                  <Input
                    placeholder="例：1234567张三"
                    value={orderNo}
                    onChange={(e) => setOrderNo(e.target.value)}
                  />
                </div>
                <div>
                  <Label>订单日期 *</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(orderDate, 'yyyy-MM-dd')}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={orderDate}
                        onSelect={(date) => date && setOrderDate(date)}
                        initialFocus
                        locale={zhCN}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>{type === 'sales' ? '客户' : '供应商'}</Label>
                  <Popover open={contactOpen} onOpenChange={setContactOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start">
                        {selectedContact
                          ? `${selectedContact.display.name}${selectedContact.display.contact_person ? ` - ${selectedContact.display.contact_person}` : ''}`
                          : `选择${type === 'sales' ? '客户' : '供应商'}...`}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                      <Command>
                        <div className="flex items-center border-b px-3">
                          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                          <input
                            placeholder="搜索..."
                            value={contactSearch}
                            onChange={(e) => setContactSearch(e.target.value)}
                            className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <CommandEmpty>未找到</CommandEmpty>
                        <CommandGroup>
                          {filteredContacts.slice(0, 20).map((contact) => (
                            <CommandItem
                              key={contact.key.contact_id}
                              onSelect={() => {
                                setSelectedContact(contact);
                                setContactSearch('');
                                setContactOpen(false);
                              }}
                            >
                              <div className="flex flex-col">
                                <span>{contact.display.name}</span>
                                {contact.display.contact_person && (
                                  <span className="text-xs text-muted-foreground">{contact.display.contact_person}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* 商品选择 */}
              <div className="mb-4">
                <Label>添加商品</Label>
                <Popover open={productOpen} onOpenChange={setProductOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start">
                      <Search className="mr-2 h-4 w-4" />
                      搜索商品或输入新商品...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command>
                      <div className="flex items-center border-b px-3">
                        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                        <input
                          placeholder="搜索商品..."
                          value={productSearch}
                          onChange={(e) => setProductSearch(e.target.value)}
                          className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        />
                      </div>
                      <CommandEmpty>
                        <Button variant="ghost" onClick={handleAddCustomProduct} className="w-full">
                          添加 "{productSearch}" 为新商品
                        </Button>
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredProducts.slice(0, 20).map((product) => (
                          <CommandItem
                            key={product.key.product_id}
                            onSelect={() => handleAddProduct(product)}
                          >
                            <div className="flex flex-col">
                              <span>{product.display.name}</span>
                              {product.display.spec && (
                                <span className="text-xs text-muted-foreground">
                                  {product.display.spec} · {product.display.default_unit}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* 商品清单 */}
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[200px]">商品</TableHead>
                      <TableHead className="w-[80px]">单位</TableHead>
                      <TableHead className="w-[100px]">单价</TableHead>
                      <TableHead className="w-[100px]">数量</TableHead>
                      <TableHead className="w-[100px] text-right">金额</TableHead>
                      <TableHead className="w-[60px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          暂无商品，请添加
                        </TableCell>
                      </TableRow>
                    ) : (
                      items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.product_name}</TableCell>
                          <TableCell>
                            <Input
                              value={item.unit}
                              onChange={(e) => handleUpdateItem(index, { unit: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.unit_price}
                              onChange={(e) => handleUpdateItem(index, { unit_price: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                              step="0.01"
                              min="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateItem(index, { quantity: parseFloat(e.target.value) || 0 })}
                              className="h-8"
                              step="0.01"
                              min="0"
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(calculateLineTotal(item.unit_price, item.quantity))}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveItem(index)}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* 合计 */}
              <div className="flex justify-end mt-4">
                <div className="text-right">
                  <div className="text-sm text-muted-foreground">
                    共 {items.length} 项
                  </div>
                  <div className="text-2xl font-bold">
                    合计: {formatCurrency(totalAmount)}
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  取消
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={items.length === 0 || createMutation.isPending}
                >
                  {createMutation.isPending ? '保存中...' : '创建订单'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
