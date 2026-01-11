'use client';

import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/lib/format';
import { dashboardApi } from '@/lib/apiClient';
import { LoadingState } from '@/components/common/LoadingState';
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  DollarSign,
  Users,
  Package,
  AlertCircle,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  BarChart3,
  Clock,
  ShoppingBag,
} from 'lucide-react';

// Stat Card Component
function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  variant = 'default',
  onClick,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | null;
  trendValue?: string;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  const variantStyles = {
    default: 'bg-card',
    primary: 'bg-gradient-to-br from-primary to-primary/80 text-white',
    success: 'bg-gradient-to-br from-emerald-500 to-emerald-600 text-white',
    warning: 'bg-gradient-to-br from-amber-500 to-amber-600 text-white',
    danger: 'bg-gradient-to-br from-rose-500 to-rose-600 text-white',
  };

  const iconBgStyles = {
    default: 'bg-primary/10 text-primary',
    primary: 'bg-white/20 text-white',
    success: 'bg-white/20 text-white',
    warning: 'bg-white/20 text-white',
    danger: 'bg-white/20 text-white',
  };

  return (
    <Card
      className={`stat-card ${variantStyles[variant]} border-0 shadow-lg ${onClick ? 'cursor-pointer transition-transform hover:scale-105 hover:shadow-xl' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-3 sm:p-4 lg:p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1 sm:space-y-2 min-w-0 flex-1">
            <p className={`text-xs sm:text-sm font-medium ${variant === 'default' ? 'text-muted-foreground' : 'text-white/80'}`}>
              {title}
            </p>
            <p className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">{value}</p>
            {(trend || subValue) && (
              <div className="flex flex-wrap items-center gap-1 sm:gap-2">
                {trend && trendValue && (
                  <span className={`flex items-center text-xs sm:text-sm font-medium ${
                    variant === 'default'
                      ? trend === 'up' ? 'text-emerald-600' : 'text-rose-600'
                      : 'text-white/90'
                  }`}>
                    {trend === 'up' ? <ArrowUpRight className="w-3 h-3 sm:w-4 sm:h-4" /> : <ArrowDownRight className="w-3 h-3 sm:w-4 sm:h-4" />}
                    {trendValue}
                  </span>
                )}
                {subValue && (
                  <span className={`text-xs sm:text-sm ${variant === 'default' ? 'text-muted-foreground' : 'text-white/70'}`}>
                    {subValue}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className={`p-2 sm:p-3 rounded-lg sm:rounded-xl ${iconBgStyles[variant]} ml-2 flex-shrink-0`}>
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 lg:w-6 lg:h-6" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Mini Stat Card
function MiniStatCard({
  title,
  value,
  icon: Icon,
  color,
  onClick,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
  color: 'orange' | 'green' | 'gray' | 'blue' | 'purple';
  onClick?: () => void;
}) {
  const colorStyles = {
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    gray: 'bg-gray-50 text-gray-500 border-gray-100',
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
  };

  return (
    <div
      className={`flex items-center gap-2 sm:gap-4 p-2 sm:p-4 rounded-lg sm:rounded-xl border ${colorStyles[color]} ${onClick ? 'cursor-pointer transition-all hover:scale-105 hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-lg sm:text-2xl font-bold">{value}</p>
        <p className="text-xs sm:text-sm opacity-80 truncate">{title}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: () => dashboardApi.getStats(),
  });

  if (isLoading) {
    return <LoadingState message="加载数据中..." />;
  }

  const recentOrders = stats?.recentOrders || [];
  const salesTrend = stats?.salesTrend || [];
  const topProducts = stats?.topProducts || [];
  const topCustomers = stats?.topCustomers || [];

  // Calculate growth rates
  const monthGrowth = stats?.lastMonthSales && stats.lastMonthSales > 0
    ? ((stats.monthSales.amount - stats.lastMonthSales) / stats.lastMonthSales * 100).toFixed(1)
    : null;
  const dayGrowth = stats?.yesterdaySales && stats.yesterdaySales > 0
    ? ((stats.todaySales.amount - stats.yesterdaySales) / stats.yesterdaySales * 100).toFixed(1)
    : null;

  // Calculate max for chart
  const maxTrendAmount = Math.max(...salesTrend.map(d => d.amount), 1);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
        <StatCard
          title="今日销售额"
          value={formatCurrency(stats?.todaySales?.amount || 0)}
          icon={DollarSign}
          variant="primary"
          trend={dayGrowth ? (parseFloat(dayGrowth) >= 0 ? 'up' : 'down') : null}
          trendValue={dayGrowth ? `${Math.abs(parseFloat(dayGrowth))}% 较昨日` : undefined}
          subValue={!dayGrowth ? `${stats?.todaySales?.count || 0} 笔订单` : undefined}
          onClick={() => router.push('/orders/sales')}
        />
        <StatCard
          title="本月销售额"
          value={formatCurrency(stats?.monthSales?.amount || 0)}
          icon={BarChart3}
          trend={monthGrowth ? (parseFloat(monthGrowth) >= 0 ? 'up' : 'down') : null}
          trendValue={monthGrowth ? `${Math.abs(parseFloat(monthGrowth))}% 较上月` : undefined}
          subValue={`${stats?.monthSales?.count || 0} 笔订单`}
          onClick={() => router.push('/orders/sales')}
        />
        <StatCard
          title="本月采购额"
          value={formatCurrency(stats?.monthPurchase?.amount || 0)}
          icon={ShoppingBag}
          subValue={`${stats?.monthPurchase?.count || 0} 笔订单`}
          onClick={() => router.push('/orders/purchase')}
        />
        <StatCard
          title="本月净现金流"
          value={formatCurrency(stats?.cashFlow?.net || 0)}
          icon={Wallet}
          variant={(stats?.cashFlow?.net || 0) >= 0 ? 'success' : 'danger'}
          subValue={`收 ${formatCurrency(stats?.cashFlow?.income || 0)}`}
          onClick={() => router.push('/cash')}
        />
      </div>

      {/* Order Status */}
      <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 sm:gap-4">
        <MiniStatCard
          title="待审核"
          value={stats?.orderStats?.pending || 0}
          icon={Clock}
          color="orange"
          onClick={() => router.push('/verify')}
        />
        <MiniStatCard
          title="已审核"
          value={stats?.orderStats?.verified || 0}
          icon={CheckCircle}
          color="green"
          onClick={() => router.push('/verify')}
        />
        <MiniStatCard
          title="已废弃"
          value={stats?.orderStats?.cancelled || 0}
          icon={XCircle}
          color="gray"
          onClick={() => router.push('/verify')}
        />
        <MiniStatCard
          title="客户数"
          value={stats?.totalCustomers || 0}
          icon={Users}
          color="blue"
          onClick={() => router.push('/contacts')}
        />
        <MiniStatCard
          title="商品数"
          value={stats?.totalProducts || 0}
          icon={Package}
          color="purple"
          onClick={() => router.push('/products')}
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Sales Trend Chart */}
        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">近7天销售趋势</CardTitle>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            <div className="chart-container">
              <div className="h-36 sm:h-48 flex items-end justify-between gap-1 sm:gap-3">
                {salesTrend.map((day, index) => {
                  const height = Math.max((day.amount / maxTrendAmount) * 120, 8);
                  const isToday = index === salesTrend.length - 1;
                  return (
                    <div key={day.date} className="flex-1 flex flex-col items-center group min-w-0">
                      <div className="relative w-full">
                        <div
                          className={`w-full rounded-t-md sm:rounded-t-lg transition-all duration-300 ${
                            isToday
                              ? 'bg-gradient-to-t from-primary to-primary/60'
                              : 'bg-primary/30 group-hover:bg-primary/50'
                          }`}
                          style={{ height: `${height}px` }}
                        />
                        {/* Tooltip - hidden on mobile */}
                        <div className="hidden sm:block absolute -top-12 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-xs px-2 py-1 rounded whitespace-nowrap z-10">
                          {formatCurrency(day.amount)}
                          <br />
                          {day.count} 笔
                        </div>
                      </div>
                      <div className="mt-1 sm:mt-3 text-center">
                        <div className={`text-[10px] sm:text-xs ${isToday ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                          {day.date.slice(5)}
                        </div>
                        <div className="text-[10px] sm:text-xs font-semibold mt-0.5 hidden sm:block">
                          {day.amount >= 10000
                            ? `${(day.amount / 10000).toFixed(1)}万`
                            : day.amount >= 1000
                            ? `${(day.amount / 1000).toFixed(1)}k`
                            : Math.round(day.amount)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">热销产品</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topProducts.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-muted-foreground text-sm">本月暂无销售数据</div>
            ) : (
              <div className="divide-y">
                {topProducts.map((product, index) => (
                  <div
                    key={product.name}
                    className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push('/products')}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </span>
                      <span className="text-xs sm:text-sm font-medium truncate">{product.name}</span>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-primary flex-shrink-0 ml-2">{formatCurrency(product.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Top Customers */}
        <Card className="shadow-lg border-0">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">客户贡献</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {topCustomers.length === 0 ? (
              <div className="p-4 sm:p-6 text-center text-muted-foreground text-sm">本月暂无销售数据</div>
            ) : (
              <div className="divide-y">
                {topCustomers.map((customer, index) => (
                  <div
                    key={customer.name}
                    className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => router.push('/contacts')}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <span className={`w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        index === 0 ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-white' :
                        index === 1 ? 'bg-gradient-to-br from-gray-300 to-gray-400 text-white' :
                        index === 2 ? 'bg-gradient-to-br from-orange-300 to-orange-400 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {index + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-[10px] sm:text-xs text-muted-foreground">{customer.orderCount} 笔订单</p>
                      </div>
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-primary flex-shrink-0 ml-2">{formatCurrency(customer.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card className="lg:col-span-2 shadow-lg border-0">
          <CardHeader className="pb-2 px-3 sm:px-6">
            <CardTitle className="text-base sm:text-lg font-semibold">最近订单</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentOrders.length === 0 ? (
              <div className="p-6 sm:p-8 text-center text-muted-foreground">暂无订单数据</div>
            ) : (
              <>
                {/* Mobile: Card layout */}
                <div className="sm:hidden divide-y">
                  {recentOrders.map((order) => (
                    <div
                      key={`${order.key.order_type}-${order.key.order_id}`}
                      className="p-3 hover:bg-muted/30 cursor-pointer"
                      onClick={() => router.push(`/orders/${order.key.order_type}/${order.key.order_id}`)}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-sm">{order.display.order_no}</span>
                        {order.display.cancelled ? (
                          <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-0 text-xs">
                            已废弃
                          </Badge>
                        ) : order.display.manual_verified ? (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                            已审核
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-xs">
                            待审核
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{order.display.contact_name || '-'}</span>
                        <span className="font-semibold text-foreground">{formatCurrency(order.display.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                {/* Desktop: Table layout */}
                <div className="hidden sm:block">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wider">订单号</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">客户</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider text-right">金额</TableHead>
                        <TableHead className="text-xs uppercase tracking-wider">状态</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentOrders.map((order) => (
                        <TableRow
                          key={`${order.key.order_type}-${order.key.order_id}`}
                          className="cursor-pointer data-row"
                          onClick={() => router.push(`/orders/${order.key.order_type}/${order.key.order_id}`)}
                        >
                          <TableCell className="font-medium">{order.display.order_no}</TableCell>
                          <TableCell className="text-muted-foreground">{order.display.contact_name || '-'}</TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(order.display.total_amount)}
                          </TableCell>
                          <TableCell>
                            {order.display.cancelled ? (
                              <Badge variant="secondary" className="bg-gray-100 text-gray-500 border-0">
                                已废弃
                              </Badge>
                            ) : order.display.manual_verified ? (
                              <Badge className="bg-emerald-100 text-emerald-700 border-0 hover:bg-emerald-100">
                                已审核
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200">
                                待审核
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
