'use client';

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Plus, Search, ArrowUpRight, ArrowDownLeft, Plus as PlusIcon, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/format';
import { cashApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useLookups } from '@/features/lookups/useLookups';

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
  const [categoryInputOpen, setCategoryInputOpen] = useState(false);
  const [formData, setFormData] = useState({
    trans_type: 'income' as 'income' | 'expense',
    amount: '',
    categories: [] as string[],
    categoryInput: '',
    trans_date: new Date().toISOString().split('T')[0],
    remark: ''
  });

  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['cash', 'transactions', filter],
    queryFn: () => cashApi.getTransactions({
      type: filter.type || undefined,
    }),
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'transactions'] });
      setDialogOpen(false);
      setFormData({
        trans_type: 'income',
        amount: '',
        categories: [],
        categoryInput: '',
        trans_date: new Date().toISOString().split('T')[0],
        remark: ''
      });
    },
  });

  const transactions = data?.items || [];

  // 计算当前余额
  let runningBalance = 0;
  const transactionsWithBalance = [...transactions].reverse().map(tx => {
    runningBalance += tx.display.trans_type === 'income' ? tx.display.amount : -tx.display.amount;
    return { ...tx, balance: runningBalance };
  }).reverse();

  const handleSubmit = () => {
    if (!formData.amount) return;
    createMutation.mutate({
      trans_type: formData.trans_type,
      amount: parseFloat(formData.amount) || 0,
      category: formData.categories[0] || undefined,
      trans_date: formData.trans_date,
      remark: formData.remark || undefined,
    });
  };

  const handleAddCategory = () => {
    const categoryToAdd = formData.categoryInput.trim();
    if (categoryToAdd && !formData.categories.includes(categoryToAdd)) {
      setFormData({
        ...formData,
        categories: [...formData.categories, categoryToAdd],
        categoryInput: ''
      });
    }
    setCategoryInputOpen(false);
  };

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
              <div className="text-2xl font-bold">{formatCurrency(transactionsWithBalance[0]?.balance || 0)}</div>
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
                  <TableHead className="text-right">余额</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactionsWithBalance.map((tx) => (
                  <TableRow key={tx.key.transaction_id}>
                    <TableCell>{formatDate(tx.display.trans_date)}</TableCell>
                    <TableCell>
                      <Badge variant={tx.display.trans_type === 'income' ? 'default' : 'destructive'}>
                        {tx.display.trans_type === 'income' ? '收入' : '支出'}
                      </Badge>
                    </TableCell>
                    <TableCell className={tx.display.trans_type === 'income' ? 'text-green-600' : 'text-red-600'}>
                      {tx.display.trans_type === 'income' ? '+' : '-'}
                      {formatCurrency(tx.display.amount)}
                    </TableCell>
                    <TableCell>
                      {tx.display.category || tx.display.remark || '-'}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(tx.balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 新增流水对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增资金流水</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>类型 *</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  variant={formData.trans_type === 'income' ? 'default' : 'outline'}
                  onClick={() => setFormData({ ...formData, trans_type: 'income' })}
                  className="flex-1"
                >
                  <ArrowDownLeft className="h-4 w-4 mr-1" />
                  收入
                </Button>
                <Button
                  variant={formData.trans_type === 'expense' ? 'destructive' : 'outline'}
                  onClick={() => setFormData({ ...formData, trans_type: 'expense' })}
                  className="flex-1"
                >
                  <ArrowUpRight className="h-4 w-4 mr-1" />
                  支出
                </Button>
              </div>
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
                {/* Notion-style selected tags */}
                <div className="min-h-[42px] p-1.5 border rounded-md bg-background flex flex-wrap gap-1.5 items-center">
                  {formData.categories.map((cat, index) => {
                    // 简单的颜色循环
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
                  {/* 输入框 */}
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
                <datalist id="category-suggestions">
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
                {categoryInputOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-auto">
                    {/* 已有分类选项 */}
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
                    {/* 添加新分类选项 */}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!formData.amount || createMutation.isPending}>
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
