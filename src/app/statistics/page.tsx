'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TrendingUp, Package, Users, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { statisticsApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';

export default function StatisticsPage() {
  const { data: customerData, isLoading: customerLoading } = useQuery({
    queryKey: ['statistics', 'customer-outstanding'],
    queryFn: statisticsApi.getCustomerOutstanding,
  });

  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['statistics', 'product-sales'],
    queryFn: statisticsApi.getProductSales,
  });

  const { data: inventoryData, isLoading: inventoryLoading } = useQuery({
    queryKey: ['statistics', 'inventory'],
    queryFn: statisticsApi.getInventory,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">数据统计</h1>
      </div>

      <Tabs defaultValue="receivables" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receivables">
            <Users className="h-4 w-4 mr-2" />
            客户欠收
          </TabsTrigger>
          <TabsTrigger value="sales">
            <TrendingUp className="h-4 w-4 mr-2" />
            销售统计
          </TabsTrigger>
          <TabsTrigger value="inventory">
            <Package className="h-4 w-4 mr-2" />
            库存统计
          </TabsTrigger>
        </TabsList>

        {/* 客户欠收统计 */}
        <TabsContent value="receivables">
          <Card>
            <CardHeader>
              <CardTitle>客户应收账款</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {customerLoading ? (
                <LoadingState message="加载中..." />
              ) : !customerData?.items || customerData.items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  暂无客户往来数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>客户名称</TableHead>
                      <TableHead>联系方式</TableHead>
                      <TableHead className="text-right">销售总额</TableHead>
                      <TableHead className="text-right">已收金额</TableHead>
                      <TableHead className="text-right">欠收金额</TableHead>
                      <TableHead className="text-center">状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customerData.items.map((item) => {
                      const outstanding = item.display.outstanding;
                      const isOverdue = outstanding > 0;
                      const isPrepaid = outstanding < 0;

                      return (
                        <TableRow key={item.key.contact_id}>
                          <TableCell className="font-medium">
                            {item.display.contact_name}
                          </TableCell>
                          <TableCell>{item.display.phone || '-'}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(item.display.total_sales)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(item.display.total_received)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            isOverdue ? 'text-red-600' : isPrepaid ? 'text-blue-600' : ''
                          }`}>
                            {formatCurrency(Math.abs(outstanding))}
                          </TableCell>
                          <TableCell className="text-center">
                            {isOverdue ? (
                              <Badge variant="destructive">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                欠收
                              </Badge>
                            ) : isPrepaid ? (
                              <Badge variant="default">预收</Badge>
                            ) : (
                              <Badge variant="outline" className="text-green-600 border-green-300">
                                已结清
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 销售统计 */}
        <TabsContent value="sales">
          <Card>
            <CardHeader>
              <CardTitle>商品销售统计</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {salesLoading ? (
                <LoadingState message="加载中..." />
              ) : !salesData?.items || salesData.items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  暂无销售数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead className="text-right">销售数量</TableHead>
                      <TableHead className="text-right">销售收入</TableHead>
                      <TableHead className="text-right">平均售价</TableHead>
                      <TableHead className="text-right">当前价格</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {salesData.items.map((item) => (
                      <TableRow key={item.key.product_id}>
                        <TableCell className="font-medium">
                          {item.display.product_name}
                        </TableCell>
                        <TableCell>{item.display.spec || '-'}</TableCell>
                        <TableCell>{item.display.category || '-'}</TableCell>
                        <TableCell className="text-right">
                          {item.display.total_sold} {item.display.unit}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {formatCurrency(item.display.total_revenue)}
                        </TableCell>
                        <TableCell className="text-right">
                          {item.display.total_sold > 0
                            ? `${formatCurrency(item.display.avg_price)}/${item.display.unit}`
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(item.display.current_price)}/{item.display.unit}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 库存统计 */}
        <TabsContent value="inventory">
          <Card>
            <CardHeader>
              <CardTitle>库存进出统计</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {inventoryLoading ? (
                <LoadingState message="加载中..." />
              ) : !inventoryData?.items || inventoryData.items.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  暂无库存数据
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>商品名称</TableHead>
                      <TableHead>规格</TableHead>
                      <TableHead>分类</TableHead>
                      <TableHead className="text-right">采购进货</TableHead>
                      <TableHead className="text-right">销售出货</TableHead>
                      <TableHead className="text-right">当前库存</TableHead>
                      <TableHead className="text-right">采购成本</TableHead>
                      <TableHead className="text-right">销售收入</TableHead>
                      <TableHead className="text-right">利润</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {inventoryData.items.map((item) => {
                      const profit = item.display.sales_revenue - item.display.purchase_cost;
                      const isLowStock = item.display.stock < 10 && item.display.stock > 0;
                      const isNegativeStock = item.display.stock < 0;

                      return (
                        <TableRow key={item.key.product_id} className={isNegativeStock ? 'bg-red-50' : ''}>
                          <TableCell className="font-medium">
                            {item.display.product_name}
                            {isNegativeStock && (
                              <Badge variant="destructive" className="ml-2 text-xs">
                                负库存
                              </Badge>
                            )}
                            {isLowStock && (
                              <Badge variant="outline" className="ml-2 text-xs text-orange-600 border-orange-300">
                                库存不足
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{item.display.spec || '-'}</TableCell>
                          <TableCell>{item.display.category || '-'}</TableCell>
                          <TableCell className="text-right text-blue-600">
                            {item.display.purchased} {item.display.unit}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {item.display.sold} {item.display.unit}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            isNegativeStock ? 'text-red-600' : isLowStock ? 'text-orange-600' : ''
                          }`}>
                            {item.display.stock} {item.display.unit}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(item.display.purchase_cost)}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(item.display.sales_revenue)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${
                            profit > 0 ? 'text-green-600' : profit < 0 ? 'text-red-600' : ''
                          }`}>
                            {formatCurrency(profit)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
