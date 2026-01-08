'use client';

// Order editor main component

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { OrderDetail } from '@/lib/apiClient';
import { fetchOrderDetail, updateOrder, verifyOrder, orderDetailToFormData } from '../api';
import { queryKeys } from '@/lib/queryKeys';
import { OrderHeaderForm } from './OrderHeaderForm';
import { OrderItemsTable } from './OrderItemsTable';
import { OrderImagePanel, PendingImage } from './OrderImagePanel';
import { VerifyActionBar } from './VerifyActionBar';
import { IssueBadges } from '@/features/verify/components/IssueBadges';
import { OrderItemDisplay, NewItemPlaceholder } from '../types';
import { isNewItem } from '../types';
import { imageApi } from '@/lib/apiClient';

interface OrderEditorProps {
  type: 'sales' | 'purchase';
  orderId: number;
}

export function OrderEditor({ type, orderId }: OrderEditorProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<{
    order_no: string;
    contact_id: number | null;
    contact_name_raw: string | null;
    contact: unknown;
    order_date: string;
    remark: string;
    items: (OrderItemDisplay | NewItemPlaceholder)[];
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Image state: pending uploads and marked deletions
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [deletedImageIds, setDeletedImageIds] = useState<number[]>([]);

  // Fetch order detail
  const { data: order, isLoading, error } = useQuery({
    queryKey: queryKeys.orders.detail(type, orderId),
    queryFn: () => fetchOrderDetail(type, orderId),
  });

  // Initialize form data when order loads
  useEffect(() => {
    if (order) {
      const data = orderDetailToFormData(order);
      setFormData({
        ...data,
        order_no: order.display.order_no,
        items: data.items as unknown as (OrderItemDisplay | NewItemPlaceholder)[],
      });
    }
  }, [order]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (version: number) => {
      if (!formData) throw new Error('No form data');
      return updateOrder(type, orderId, {
        version,
        // 始终发送order_no，允许为空字符串来清空
        order_no: formData.order_no,
        contact_id: formData.contact_id,
        contact_name_raw: formData.contact_name_raw,
        order_date: formData.order_date,
        remark: formData.remark || undefined,
        items: formData.items.map((item) => ({
          item_id: item.key.item_id,
          product_id: item.key.product_id ?? null,
          product_name_raw: isNewItem(item) ? item.display.product_name_raw : item.display.product_name_raw,
          unit: item.display.unit,
          unit_price: item.display.unit_price,
          quantity: item.display.quantity,
        })),
      });
    },
    onSuccess: (newOrder) => {
      // 更新查询缓存
      queryClient.setQueryData(queryKeys.orders.detail(type, orderId), newOrder);
      // 重置表单数据为服务器返回的最新数据
      const data = orderDetailToFormData(newOrder);
      setFormData({
        ...data,
        order_no: newOrder.display.order_no,
        items: data.items as unknown as (OrderItemDisplay | NewItemPlaceholder)[],
      });
      setHasChanges(false);
      // Clear pending image states
      setPendingImages([]);
      setDeletedImageIds([]);
      // Refresh list cache
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(type) });
    },
    onError: (error: Error) => {
      // 如果是版本冲突错误，提示用户刷新
      if (error.message.includes('version') || error.message.includes('409')) {
        alert('数据已被他人修改，请刷新页面后重试');
        queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(type, orderId) });
      } else {
        alert(`保存失败: ${error.message || '请重试'}`);
      }
    },
  });

  // Verify mutation
  const verifyMutation = useMutation({
    mutationFn: (version: number) => verifyOrder(type, orderId, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all(type) });
      router.push('/verify');
    },
  });

  // Image handlers
  const handleAddImage = useCallback((image: PendingImage) => {
    setPendingImages((prev) => [...prev, image]);
    setHasChanges(true);
  }, []);

  const handleRemovePendingImage = useCallback((tempId: string) => {
    setPendingImages((prev) => prev.filter((img) => img.tempId !== tempId));
    setHasChanges(true);
  }, []);

  const handleMarkDelete = useCallback((imageId: number) => {
    setDeletedImageIds((prev) => [...prev, imageId]);
    setHasChanges(true);
  }, []);

  const handleUnmarkDelete = useCallback((imageId: number) => {
    setDeletedImageIds((prev) => prev.filter((id) => id !== imageId));
  }, []);

  const handleSave = useCallback(async () => {
    if (!order || !formData) return;

    try {
      // 1. Upload pending images
      for (const pending of pendingImages) {
        await imageApi.upload(type, orderId, {
          image_data: pending.base64,
          mime_type: pending.mimeType,
        });
      }

      // 2. Delete marked images
      for (const imageId of deletedImageIds) {
        await imageApi.delete(type, orderId, imageId);
      }

      // 3. Update order data
      updateMutation.mutate(order.key.version);

      // 4. Clear pending states on success (handled in mutation onSuccess)
    } catch (error) {
      alert(`保存失败: ${(error as Error).message || '请重试'}`);
    }
  }, [order, formData, updateMutation, pendingImages, deletedImageIds, type, orderId]);

  const handleVerify = useCallback(() => {
    if (!order) return;
    verifyMutation.mutate(order.key.version);
  }, [order, verifyMutation]);

  const handleBack = useCallback(() => {
    // 返回上一页面
    if (typeof window !== 'undefined') {
      window.history.back();
    } else {
      router.push(`/orders/${type}`);
    }
  }, [router, type]);

  const handleItemsChange = useCallback((items: (OrderItemDisplay | NewItemPlaceholder)[]) => {
    if (!formData) return;
    setFormData({ ...formData, items });
    setHasChanges(true);
  }, [formData]);

  const handleHeaderChange = useCallback((updates: Partial<typeof formData>) => {
    if (!formData) return;
    setFormData({ ...formData, ...updates } as typeof formData);
    setHasChanges(true);
  }, [formData]);

  // 获取当前显示的订单号（优先使用表单中的值，如果为空则保持空而不是回退）
  const displayOrderNo = formData?.order_no !== undefined
    ? formData.order_no
    : order?.display?.order_no || '';

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          无法加载订单详情，请检查订单ID或网络连接
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Issues Alert */}
      {order.display.issues.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p>订单存在问题，请检查：</p>
              <IssueBadges issues={order.display.issues.map((i) => i.code)} />
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Desktop: Split view */}
      <div className="hidden lg:grid lg:grid-cols-2 gap-4">
        {/* Left: Images */}
        <OrderImagePanel
          images={order?.display?.images || []}
          pendingImages={pendingImages}
          deletedImageIds={deletedImageIds}
          onAddImage={handleAddImage}
          onRemovePendingImage={handleRemovePendingImage}
          onMarkDelete={handleMarkDelete}
          onUnmarkDelete={handleUnmarkDelete}
        />

        {/* Right: Form */}
        <div className="space-y-4">
          {/* Header */}
          <div className="border rounded-lg bg-card">
            <OrderHeaderForm
              orderNo={displayOrderNo}
              orderDate={formData?.order_date || order?.display?.order_date || ''}
              remark={formData?.remark || order?.display?.remark || ''}
              contact={order?.display?.contact || null}
              contactNameRaw={formData?.contact_name_raw}
              onOrderNoChange={(order_no) => handleHeaderChange({ order_no })}
              onDateChange={(date) => handleHeaderChange({ order_date: date })}
              onRemarkChange={(remark) => handleHeaderChange({ remark })}
              onContactSelect={(contact) =>
                handleHeaderChange({
                  contact_id: contact?.key?.contact_id ?? null,
                  contact,
                })
              }
              onContactRawChange={(name) => handleHeaderChange({ contact_name_raw: name })}
            />
          </div>

          {/* Items */}
          <OrderItemsTable
            items={formData?.items || []}
            onItemsChange={handleItemsChange}
          />
        </div>
      </div>

      {/* Mobile: Stacked view */}
      <div className="lg:hidden space-y-4">
        <OrderImagePanel
          images={order?.display?.images || []}
          pendingImages={pendingImages}
          deletedImageIds={deletedImageIds}
          onAddImage={handleAddImage}
          onRemovePendingImage={handleRemovePendingImage}
          onMarkDelete={handleMarkDelete}
          onUnmarkDelete={handleUnmarkDelete}
        />
        <div className="border rounded-lg bg-card">
          <OrderHeaderForm
            orderNo={displayOrderNo}
            orderDate={formData?.order_date || order?.display?.order_date || ''}
            remark={formData?.remark || order?.display?.remark || ''}
            contact={order?.display?.contact || null}
            contactNameRaw={formData?.contact_name_raw}
            onOrderNoChange={(order_no) => handleHeaderChange({ order_no })}
            onDateChange={(date) => handleHeaderChange({ order_date: date })}
            onRemarkChange={(remark) => handleHeaderChange({ remark })}
            onContactSelect={(contact) =>
              handleHeaderChange({
                contact_id: contact?.key?.contact_id ?? null,
                contact,
              })
            }
            onContactRawChange={(name) => handleHeaderChange({ contact_name_raw: name })}
          />
        </div>
        <OrderItemsTable
          items={formData?.items || []}
          onItemsChange={handleItemsChange}
        />
      </div>

      {/* Action Bar */}
      <VerifyActionBar
        onBack={handleBack}
        onSave={handleSave}
        onVerify={handleVerify}
        isSaving={updateMutation.isPending}
        isVerifying={verifyMutation.isPending}
        isDirty={hasChanges}
      />
    </div>
  );
}
