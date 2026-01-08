'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Package, Edit2, Ban, RotateCcw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLookups } from '@/features/lookups/useLookups';
import { productsApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const UNIT_OPTIONS = ['个', '箱', '包', '盒', '瓶', '袋', '千克', '克', '米', '厘米'];

export default function ProductsPage() {
  const { products, isLoading } = useLookups();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<{
    id: number;
    name: string;
    spec: string;
    unit: string;
    unit_price: string;
    category: string;
  } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    spec: '',
    unit: '个',
    unit_price: '',
    category: ''
  });

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'products'] });
      setDialogOpen(false);
      setFormData({ name: '', spec: '', unit: '个', unit_price: '', category: '' });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; spec?: string; unit: string; unit_price?: number; category?: string } }) =>
      productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'products'] });
      setEditDialogOpen(false);
      setEditingProduct(null);
    },
  });

  const disableMutation = useMutation({
    mutationFn: productsApi.disable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'products'] });
    },
    onError: (error: Error) => {
      alert(error.message);
    }
  });

  const enableMutation = useMutation({
    mutationFn: productsApi.enable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', 'products'] });
    },
    onError: (error: Error) => {
      alert(error.message);
    }
  });

  const filteredProducts = products.filter((product) =>
    product.display.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSubmit = () => {
    if (!formData.name) return;
    const unitPrice = formData.unit_price ? parseFloat(formData.unit_price) : 0;
    createMutation.mutate({
      name: formData.name,
      spec: formData.spec || undefined,
      unit: formData.unit,
      unit_price: unitPrice,
      category: formData.category || undefined,
    });
  };

  const handleEdit = (product: typeof products[0]) => {
    setEditingProduct({
      id: product.key.product_id!,
      name: product.display.name,
      spec: product.display.spec || '',
      unit: product.display.default_unit || '个',
      unit_price: product.display.unit_price?.toString() || '',
      category: product.display.category || ''
    });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingProduct || !editingProduct.name) return;
    const unitPrice = editingProduct.unit_price ? parseFloat(editingProduct.unit_price) : 0;
    updateMutation.mutate({
      id: editingProduct.id,
      data: {
        name: editingProduct.name,
        spec: editingProduct.spec || undefined,
        unit: editingProduct.unit,
        unit_price: unitPrice,
        category: editingProduct.category || undefined,
      }
    });
  };

  const handleDisable = (product: typeof products[0]) => {
    if (confirm(`确定要废除产品 "${product.display.name}" 吗？废除后将无法在新订单中使用。`)) {
      disableMutation.mutate(product.key.product_id!);
    }
  };

  const handleEnable = (product: typeof products[0]) => {
    if (confirm(`确定要恢复产品 "${product.display.name}" 吗？`)) {
      enableMutation.mutate(product.key.product_id!);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="搜索商品..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          添加商品
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>商品列表</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <LoadingState message="加载中..." />
          ) : filteredProducts.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              {search ? '未找到匹配的商品' : '暂无商品数据'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>商品名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>单价</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="w-[120px]">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map((product) => (
                  <TableRow key={product.key.product_id} className={product.display.is_disabled ? 'opacity-60' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{product.display.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{product.display.spec || '-'}</TableCell>
                    <TableCell>{product.display.default_unit || '-'}</TableCell>
                    <TableCell>
                      {product.display.unit_price ? `¥${product.display.unit_price.toFixed(2)}` : '-'}
                    </TableCell>
                    <TableCell>
                      {product.display.is_disabled ? (
                        <Badge variant="destructive">已废除</Badge>
                      ) : (
                        <Badge variant="outline" className="text-green-600 border-green-300">在售</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider>
                        <div className="flex gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(product)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>编辑</p>
                            </TooltipContent>
                          </Tooltip>
                          {product.display.is_disabled ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEnable(product)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>恢复</p>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDisable(product)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <Ban className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>废除</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 添加商品对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>添加商品</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>商品名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="输入商品名称"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>规格型号</Label>
                <Input
                  value={formData.spec}
                  onChange={(e) => setFormData({ ...formData, spec: e.target.value })}
                  placeholder="输入规格型号"
                />
              </div>
              <div>
                <Label>单位 *</Label>
                <Select value={formData.unit} onValueChange={(value) => setFormData({ ...formData, unit: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((unit) => (
                      <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>单价</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.unit_price}
                  onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label>分类</Label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  placeholder="输入分类"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={handleSubmit} disabled={!formData.name || createMutation.isPending}>
              {createMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 编辑商品对话框 */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => {
        setEditDialogOpen(open);
        if (!open) setEditingProduct(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑商品</DialogTitle>
          </DialogHeader>
          {editingProduct && (
            <div className="space-y-4">
              <div>
                <Label>商品名称 *</Label>
                <Input
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  placeholder="输入商品名称"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>规格型号</Label>
                  <Input
                    value={editingProduct.spec}
                    onChange={(e) => setEditingProduct({ ...editingProduct, spec: e.target.value })}
                    placeholder="输入规格型号"
                  />
                </div>
                <div>
                  <Label>单位 *</Label>
                  <Select value={editingProduct.unit} onValueChange={(value) => setEditingProduct({ ...editingProduct, unit: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UNIT_OPTIONS.map((unit) => (
                        <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>单价</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={editingProduct.unit_price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit_price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>分类</Label>
                  <Input
                    value={editingProduct.category}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                    placeholder="输入分类"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleUpdate} disabled={!editingProduct?.name || updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
