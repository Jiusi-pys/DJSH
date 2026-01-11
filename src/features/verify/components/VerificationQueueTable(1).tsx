'use client';

// Verification queue table component

import { useRouter } from 'next/navigation';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { formatCurrency, formatDate } from '@/lib/format';
import { OrderSummary } from '@/lib/apiClient';
import { IssueBadges } from './IssueBadges';
import { Eye, Image } from 'lucide-react';

interface VerificationQueueTableProps {
  orders: OrderSummary[];
  isLoading: boolean;
  type: 'sales' | 'purchase';
}

export function VerificationQueueTable({ orders, isLoading, type }: VerificationQueueTableProps) {
  const router = useRouter();

  const handleRowClick = (order: OrderSummary) => {
    router.push(`/orders/${type}/${order.key.order_id}`);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          加载中...
        </CardContent>
      </Card>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">
          暂无待审核订单
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">单号</TableHead>
              <TableHead className="w-[100px]">日期</TableHead>
              <TableHead>客户</TableHead>
              <TableHead className="text-right w-[100px]">金额</TableHead>
              <TableHead className="w-[100px]">状态</TableHead>
              <TableHead className="w-[140px]">问题标签</TableHead>
              <TableHead className="w-[80px]">图片</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow
                key={order.key.order_id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(order)}
              >
                <TableCell className="font-medium">{order.display.order_no}</TableCell>
                <TableCell>{formatDate(order.display.order_date)}</TableCell>
                <TableCell>{order.display.contact_name}</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(order.display.total_amount)}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <Badge variant={order.display.manual_verified ? 'default' : 'outline'}>
                      {order.display.manual_verified ? '已审核' : '待审核'}
                    </Badge>
                    <Badge variant={order.display.auto_verified ? 'secondary' : 'destructive'} className="text-xs">
                      {order.display.auto_verified ? '自动通过' : '自动标记'}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell>
                  <IssueBadges issues={order.display.issue_tags} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <span>{order.display.image_count}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={(e) => {
                    e.stopPropagation();
                    handleRowClick(order);
                  }}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
