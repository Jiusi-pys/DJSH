'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Search, ArrowUpRight, ArrowDownLeft, Plus as PlusIcon, X, Image as ImageIcon, Ban, Undo2, CheckCircle, XCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cashApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { CashImagePanel } from '@/features/cash/components/CashImagePanel';
import { CashImageUploader, type PendingImage } from '@/features/cash/components/CashImageUploader';
import { useLookups } from '@/features/lookups/useLookups';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import type { LookupEntry } from '@/lib/apiClient';

// 默认分类选项
const DEFAULT_CATEGORIES = [
  '销售收入',
  '采购支出',
  '房租',
  '工资',
  '水电费',
  '运输费',
  '其他收入',
  '其他支出'
];

export default function CashPage() {
  const [filter, setFilter] = useState({ type: '', q: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<number | null>(null);
  const [categoryInputOpen, setCategoryInputOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [contactOpen, setContactOpen] = useState(false);
  const [contactSearch, setContactSearch] = useState('');
  const [formData, setFormData] = useState({
    trans_type: 'income' as 'income' | 'expense',
    amount: '',
    categories: [] as string[],
    categoryInput: '',
    trans_date: new Date().toISOString().split('T')[0],
    remark: '',
    images: [] as PendingImage[],
    contact: null as LookupEntry | null,
  });

  const queryClient = useQueryClient();

  // Load contacts based on transaction type: income -> customers, expense -> suppliers
  const contactType = formData.trans_type === 'income' ? 'customer' : 'supplier';
  const { contacts } = useLookups(contactType);

  const { data, isLoading } = useQuery({
    queryKey: ['cash', 'transactions', filter],
    queryFn: () => cashApi.getTransactions({
      type: filter.type || undefined,
    }),
  });

  // 获取当前余额（不在前端计算，避免废除交易导致的计算错误）
  const { data: balanceData } = useQuery({
    queryKey: ['cash', 'balance'],
    queryFn: cashApi.getBalance,
  });

  // 获取选中交易的图片
  const { data: imagesData } = useQuery({
    queryKey: ['cash', 'images', selectedTransaction],
    queryFn: () => selectedTransaction ? cashApi.getImages(selectedTransaction) : Promise.resolve({ items: [] }),
    enabled: !!selectedTransaction,
  });

  // 从已有交易中提取分类
  const existingCategories = useMemo(() => {
    const categories = new Set(DEFAULT_CATEGORIES);
    data?.items?.forEach(tx => {
      if (tx.display.category) {
        categories.add(tx.display.category);
      }
    });
    return Array.from(categories).sort();
  }, [data]);

  const createMutation = useMutation({
    mutationFn: cashApi.create,
    onSuccess: async (response) => {
      // Upload images if any
      const transactionId = response.key.transaction_id;
      if (formData.images.length > 0) {
        try {
          await Promise.all(
            formData.images.map((img) =>
              cashApi.uploadImage(transactionId, {
                image_data: img.base64,
                mime_type: img.mimeType,
              })
            )
          );
        } catch (error) {
          console.error('Failed to upload images:', error);
          alert('流水创建成功，但图片上传失败');
        }
      }

      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash', 'balance'] });
      setDialogOpen(false);
      setFormData({
        trans_type: 'income',
        amount: '',
        categories: [],
        categoryInput: '',
        trans_date: new Date().toISOString().split('T')[0],
        remark: '',
        images: [],
        contact: null,
      });
      setContactSearch('');
    },
  });

  const cancelMutation = useMutation({
    mutationFn: ({ transactionId, version, reason }: { transactionId: number; version: number; reason?: string }) =>
      cashApi.cancel(transactionId, version, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash', 'balance'] });
      setCancelDialogOpen(false);
      setCancelReason('');
      setDetailDialogOpen(false);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: ({ transactionId, version }: { transactionId: number; version: number }) =>
      cashApi.restore(transactionId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
      queryClient.invalidateQueries({ queryKey: ['cash', 'balance'] });
      setDetailDialogOpen(false);
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ transactionId, version }: { transactionId: number; version: number }) =>
      cashApi.verify(transactionId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
    },
  });

  const unverifyMutation = useMutation({
    mutationFn: ({ transactionId, version }: { transactionId: number; version: number }) =>
      cashApi.unverify(transactionId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
    },
  });

  const transactions = data?.items || [];
  const currentBalance = balanceData?.balance || 0;

  const handleSubmit = () => {
    if (!formData.amount) return;
    createMutation.mutate({
      trans_type: formData.trans_type,
      amount: parseFloat(formData.amount) || 0,
      category: formData.categories[0] || undefined,
      trans_date: formData.trans_date,
      remark: formData.remark || undefined,
      contact_id: formData.contact?.key.contact_id || undefined,
    });
  };

  // Filter contacts based on search
  const filteredContacts = useMemo(() => {
    if (!contacts) return [];
    if (!contactSearch) return contacts;
    const query = contactSearch.toLowerCase();
    return contacts.filter(c =>
      c.display.name.toLowerCase().includes(query) ||
      c.display.phone?.toLowerCase().includes(query) ||
      c.display.contact_person?.toLowerCase().includes(query)
    );
  }, [contacts, contactSearch]);

  const handleRemoveCategory = (catToRemove: string) => {
    setFormData({
      ...formData,
      categories: formData.categories.filter(c => c !== catToRemove)
    });
  };

  const handleCategoryInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.currentTarget;
      const value = input.value.trim();
      if (value && !formData.categories.includes(value)) {
        setFormData({
          ...formData,
          categories: [...formData.categories, value],
          categoryInput: ''
        });
      }
    }
  };

  const filteredCategories = existingCategories.filter(
    cat => cat.toLowerCase().includes(formData.categoryInput?.toLowerCase() || '')
  );

  const handleRowClick = (transactionId: number) => {
    setSelectedTransaction(transactionId);
    setDetailDialogOpen(true);
  };

  const selectedTx = transactions.find(tx => tx.key.transaction_id === selectedTransaction);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索流水..."
            className="pl-9"
            value={filter.q}
            onChange={(e) => setFilter({ ...filter, q: e.target.value })}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter.type === 'income' ? 'default' : 'outline'}
            onClick={() => setFilter({ ...filter, type: filter.type === 'income' ? '' : 'income' })}
          >
            <ArrowDownLeft className="h-4 w-4 mr-2" />
            收入
          </Button>
          <Button
            variant={filter.type === 'expense' ? 'destructive' : 'outline'}
            onClick={() => setFilter({ ...filter, type: filter.type === 'expense' ? '' : 'expense' })}
          >
            <ArrowUpRight className="h-4 w-4 mr-2" />
            支出
          </Button>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            新增流水
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>资金流水</CardTitle>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">当前余额</div>
              <div className="text-2xl font-bold">{formatCurrency(currentBalance)}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState message="加载中..." />
          ) : transactions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              暂无资金流水数据
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日期</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>金额</TableHead>
                  <TableHead>说明</TableHead>
                  <TableHead>审核状态</TableHead>
                  <TableHead className="text-center w-20">图片</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => (
                  <TableRow
                    key={tx.key.transaction_id}
                    className={`cursor-pointer ${tx.display.cancelled ? 'opacity-50' : ''}`}
                    onClick={() => handleRowClick(tx.key.transaction_id)}
                  >
                    <TableCell>{formatDate(tx.display.trans_date)}</TableCell>
                    <TableCell>
                      <div className="flex gap-2 items-center">
                        <Badge variant={tx.display.trans_type === 'income' ? 'default' : 'destructive'}>
                          {tx.display.trans_type === 'income' ? '收入' : '支出'}
                        </Badge>
                        {tx.display.cancelled && (
                          <Badge variant="outline" className="text-muted-foreground">
                            已废除
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={tx.display.trans_type === 'income' ? 'text-green-600' : 'text-red-600'}>
                      {tx.display.trans_type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.display.amount)}
                    </TableCell>
                    <TableCell>
                      {tx.display.category || tx.display.remark || '-'}
                    </TableCell>
                    <TableCell>
                      {(tx.display as any).verified ? (
                        <Badge variant="outline" className="text-green-600 border-green-300">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          已审核
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-orange-600 border-orange-300">
                          <XCircle className="h-3 w-3 mr-1" />
                          未审核
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增流水对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>新增资金流水</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>类型 *</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  variant={formData.trans_type === 'income' ? 'default' : 'outline'}
                  onClick={() => {
                    setFormData({ ...formData, trans_type: 'income', contact: null });
                    setContactSearch('');
                  }}
                  className="flex-1"
                >
                  <ArrowDownLeft className="h-4 w-4 mr-1" />
                  收入
                </Button>
                <Button
                  type="button"
                  variant={formData.trans_type === 'expense' ? 'destructive' : 'outline'}
                  onClick={() => {
                    setFormData({ ...formData, trans_type: 'expense', contact: null });
                    setContactSearch('');
                  }}
                  className="flex-1"
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  支出
                </Button>
              </div>
            </div>
            <div>
              <Label>{formData.trans_type === 'income' ? '客户' : '供应商'}</Label>
              <Popover open={contactOpen} onOpenChange={setContactOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={contactOpen}
                    className="w-full justify-between"
                  >
                    {formData.contact?.display.name || `选择${formData.trans_type === 'income' ? '客户' : '供应商'}（可选）`}
                    <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-full p-0" align="start">
                  <Command>
                    <div className="flex items-center border-b px-3">
                      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
                      <input
                        className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={`搜索${formData.trans_type === 'income' ? '客户' : '供应商'}...`}
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                      />
                    </div>
                    <CommandEmpty>未找到相关{formData.trans_type === 'income' ? '客户' : '供应商'}</CommandEmpty>
                    <CommandGroup className="max-h-64 overflow-auto">
                      {filteredContacts.map((contact) => (
                        <CommandItem
                          key={contact.key.contact_id}
                          onSelect={() => {
                            if (!contact.display.is_disabled) {
                              setFormData({ ...formData, contact });
                              setContactOpen(false);
                              setContactSearch('');
                            }
                          }}
                        >
                          <div className="flex flex-col">
                            <span className={contact.display.is_disabled ? 'text-muted-foreground' : ''}>
                              {contact.display.name}
                              {contact.display.is_disabled && ' (已禁用)'}
                            </span>
                            {contact.display.contact_person && (
                              <span className="text-xs text-muted-foreground">
                                {contact.display.contact_person}
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>金额 *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>日期</Label>
                <DatePicker
                  value={formData.trans_date}
                  onChange={(value) => setFormData({ ...formData, trans_date: value })}
                />
              </div>
            </div>
            <div>
              <Label>分类</Label>
              <div className="relative">
                <div className="min-h-[42px] p-1.5 border rounded-md bg-background flex flex-wrap gap-1.5 items-center">
                  {formData.categories.map((cat, index) => {
                    const colors = [
                      'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
                      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
                      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
                      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
                    ];
                    const colorClass = colors[index % colors.length];
                    return (
                      <span
                        key={cat}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm ${colorClass}`}
                      >
                        {cat}
                        <button
                          type="button"
                          onClick={() => handleRemoveCategory(cat)}
                          className="hover:opacity-70 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                  <input
                    className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
                    value={formData.categoryInput}
                    onChange={(e) => {
                      setFormData({ ...formData, categoryInput: e.target.value });
                    }}
                    onFocus={() => setCategoryInputOpen(true)}
                    onKeyDown={handleCategoryInputKeyDown}
                    placeholder="选择或输入分类"
                  />
                </div>
                {categoryInputOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                    {(formData.categoryInput ? filteredCategories : existingCategories)
                      .filter(c => !formData.categories.includes(c))
                      .map((cat) => (
                        <div
                          key={cat}
                          className="px-3 py-2 hover:bg-accent cursor-pointer"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              categories: [...formData.categories, cat],
                              categoryInput: ''
                            });
                            setCategoryInputOpen(false);
                          }}
                        >
                          {cat}
                        </div>
                      ))}
                    {formData.categoryInput && !existingCategories.some(c => c.toLowerCase() === formData.categoryInput.toLowerCase()) && (
                      <div
                        className="px-3 py-2 hover:bg-accent cursor-pointer flex items-center gap-2 text-primary border-t"
                        onClick={() => {
                          if (formData.categoryInput.trim() && !formData.categories.includes(formData.categoryInput.trim())) {
                            setFormData({
                              ...formData,
                              categories: [...formData.categories, formData.categoryInput.trim()],
                              categoryInput: ''
                            });
                          }
                          setCategoryInputOpen(false);
                        }}
                      >
                        <PlusIcon className="h-4 w-4" />
                        添加 "{formData.categoryInput}"
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label>备注</Label>
              <Input
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                placeholder="输入备注信息"
              />
            </div>
            <div>
              <Label>附件图片</Label>
              <CashImageUploader
                images={formData.images}
                onAddImage={(img) => setFormData({ ...formData, images: [...formData.images, img] })}
                onRemoveImage={(tempId) => setFormData({ ...formData, images: formData.images.filter(i => i.tempId !== tempId) })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!formData.amount || createMutation.isPending}>
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              流水详情
              {selectedTx?.display.cancelled && (
                <Badge variant="outline" className="text-muted-foreground">
                  已废除
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {selectedTx && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">类型</div>
                  <Badge variant={selectedTx.display.trans_type === 'income' ? 'default' : 'destructive'} className="mt-1">
                    {selectedTx.display.trans_type === 'income' ? '收入' : '支出'}
                  </Badge>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">金额</div>
                  <div className={`text-lg font-semibold mt-1 ${selectedTx.display.trans_type === 'income' ? 'text-green-600' : 'text-red-600'}`}>
                    {selectedTx.display.trans_type === 'income' ? '+' : '-'}
                    {formatCurrency(selectedTx.display.amount)}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">日期</div>
                  <div className="mt-1">{formatDate(selectedTx.display.trans_date)}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">分类</div>
                  <div className="mt-1">{selectedTx.display.category || '-'}</div>
                </div>
                {selectedTx.display.contact_name && (
                  <div>
                    <div className="text-sm text-muted-foreground">{selectedTx.display.trans_type === 'income' ? '客户' : '供应商'}</div>
                    <div className="mt-1">{selectedTx.display.contact_name}</div>
                  </div>
                )}
              </div>
              {selectedTx.display.remark && (
                <div>
                  <div className="text-sm text-muted-foreground">备注</div>
                  <div className="mt-1">{selectedTx.display.remark}</div>
                </div>
              )}
              {selectedTx.display.cancelled && selectedTx.display.cancelled_reason && (
                <div>
                  <div className="text-sm text-muted-foreground">废除原因</div>
                  <div className="mt-1 text-destructive">{selectedTx.display.cancelled_reason}</div>
                </div>
              )}
              <div>
                <div className="text-sm text-muted-foreground mb-2">附件图片</div>
                {selectedTransaction && (
                  <CashImagePanel
                    transactionId={selectedTransaction}
                    images={imagesData?.items || []}
                  />
                )}
              </div>
              <div className="flex justify-between gap-2 pt-4 border-t">
                <div className="flex gap-2">
                  {(selectedTx.display as any).verified ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        unverifyMutation.mutate({
                          transactionId: selectedTx.key.transaction_id,
                          version: selectedTx.display.version || 1,
                        });
                      }}
                      disabled={unverifyMutation.isPending}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      {unverifyMutation.isPending ? '取消审核中...' : '取消审核'}
                    </Button>
                  ) : (
                    <Button
                      variant="default"
                      onClick={() => {
                        verifyMutation.mutate({
                          transactionId: selectedTx.key.transaction_id,
                          version: selectedTx.display.version || 1,
                        });
                      }}
                      disabled={verifyMutation.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      {verifyMutation.isPending ? '审核中...' : '审核'}
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  {selectedTx.display.cancelled ? (
                    <Button
                      variant="outline"
                      onClick={() => {
                        restoreMutation.mutate({
                          transactionId: selectedTx.key.transaction_id,
                          version: selectedTx.display.version || 1,
                        });
                      }}
                      disabled={restoreMutation.isPending}
                    >
                      <Undo2 className="h-4 w-4 mr-2" />
                      {restoreMutation.isPending ? '恢复中...' : '恢复'}
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => setCancelDialogOpen(true)}
                    >
                      <Ban className="h-4 w-4 mr-2" />
                      废除
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 废除理由对话框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>废除流水</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>废除原因</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="请输入废除原因（可选）"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (selectedTx) {
                  cancelMutation.mutate({
                    transactionId: selectedTx.key.transaction_id,
                    version: selectedTx.display.version || 1,
                    reason: cancelReason || undefined,
                  });
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? '废除中...' : '确认废除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
