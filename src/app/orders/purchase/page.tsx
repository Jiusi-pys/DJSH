'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ArrowLeft, FileText, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
import { LoadingState } from '@/components/common/LoadingState';
import { fetchOrders } from '@/features/verify/api';
import { CreateOrderDialog } from '@/features/orders/components/CreateOrderDialog';
import { ordersApi } from '@/lib/apiClient';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OrdersResponse } from '@/lib/apiClient';

export default function PurchaseOrderPage() {
  return <OrderListContent />;
}

function OrderListContent() {
  const type: 'sales' | 'purchase' = 'purchase';
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [restoreDialogOpen, setRestoreDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<typeof orders[0] | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const queryClient = useQueryClient();

  const { data: ordersData, isLoading } = useQuery<OrdersResponse>({
    queryKey: ['orders', type, 'all'],
    queryFn: () => fetchOrders({ type, tab: 'all' }),
  });

  const orders = ordersData?.items || [];
  const typeLabel = '采购订单';

  // 废弃订单 (版本号传0，由后端处理乐观锁)
  const cancelMutation = useMutation({
    mutationFn: () => ordersApi.cancel(type, selectedOrder!.key.order_id, 0, cancelReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', type, 'all'] });
      queryClient.invalidateQueries({ queryKey: ['orders', type, 'pending'] });
      setCancelDialogOpen(false);
      setCancelReason('');
      setSelectedOrder(null);
    },
  });

  // 恢复订单 (版本号传0，由后端处理乐观锁)
  const restoreMutation = useMutation({
    mutationFn: () => ordersApi.restore(type, selectedOrder!.key.order_id, 0),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders', type, 'all'] });
      queryClient.invalidateQueries({ queryKey: ['orders', type, 'pending'] });
      setRestoreDialogOpen(false);
      setSelectedOrder(null);
    },
  });

  const handleCancel = (order: typeof orders[0]) => {
    setSelectedOrder(order);
    setCancelDialogOpen(true);
  };

  const handleRestore = (order: typeof orders[0]) => {
    setSelectedOrder(order);
    setRestoreDialogOpen(true);
  };

  const handleConfirmCancel = () => {
    if (selectedOrder) {
      cancelMutation.mutate();
    }
  };

  const handleConfirmRestore = () => {
    if (selectedOrder) {
      restoreMutation.mutate();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/verify">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">{typeLabel}</h1>
          <Badge variant="outline">{ordersData?.total || 0} 个订单</Badge>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-1" />
          新建{typeLabel}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            订单列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <LoadingState message="加载中..." />
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              暂无订单
            </div>
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <div
                  key={order.key.order_id}
                  className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                    order.display.cancelled ? 'bg-muted/50 opacity-75' : 'hover:bg-accent'
                  }`}
                >
                  <Link
                    href={`/orders/${type}/${order.key.order_id}`}
                    className="flex-1 block"
                  >
                    <div className="space-y-1">
                      <div className="font-medium flex items-center gap-2">
                        {order.display.order_no}
                        {order.display.cancelled && (
                          <Badge variant="destructive" className="text-xs">
                            已废弃
                          </Badge>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {order.display.contact_name || '未指定供应商'} ·{' '}
                        {order.display.order_date}
                      </div>
                    </div>
                  </Link>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-medium">
                        ¥{order.display.total_amount.toFixed(2)}
                      </div>
                      <div className="flex gap-1 mt-1">
                        <Badge variant={order.display.manual_verified ? 'default' : 'secondary'}>
                          {order.display.manual_verified ? '已审核' : '待审核'}
                        </Badge>
                        <Badge variant={order.display.settled ? 'default' : 'outline'}>
                          {order.display.settled ? '已结算' : '未结算'}
                        </Badge>
                      </div>
                    </div>
                    {/* 废弃/恢复按钮 */}
                    <div className="flex gap-1">
                      {order.display.cancelled ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleRestore(order)}
                          title="恢复订单"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      ) : (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancel(order)}
                          className="text-muted-foreground hover:text-destructive"
                          title="废弃订单"
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        type={type}
      />

      {/* 废弃订单确认对话框 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              确认废弃订单
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>确定要废弃订单 <strong>{selectedOrder?.display.order_no}</strong> 吗？</p>
            <div>
              <Label>废弃原因（可选）</Label>
              <Input
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="输入废弃原因..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>取消</Button>
            <Button
              variant="destructive"
              onClick={handleConfirmCancel}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? '废弃中...' : '确认废弃'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 恢复订单确认对话框 */}
      <Dialog open={restoreDialogOpen} onOpenChange={setRestoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认恢复订单</DialogTitle>
          </DialogHeader>
          <p>确定要恢复订单 <strong>{selectedOrder?.display.order_no}</strong> 吗？</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleConfirmRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? '恢复中...' : '确认恢复'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
