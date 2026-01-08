'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bell, Search, ChevronRight, LogOut, User, Shield } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth';

interface TopBarProps {
  title?: string;
}

const pathMappings: Record<string, { label: string; parent?: string }> = {
  '/dashboard': { label: '仪表盘' },
  '/verify': { label: '审核队列' },
  '/orders/sales': { label: '销售订单', parent: '业务管理' },
  '/orders/purchase': { label: '采购订单', parent: '业务管理' },
  '/contacts': { label: '客户管理', parent: '基础数据' },
  '/products': { label: '商品管理', parent: '基础数据' },
  '/cash': { label: '资金流水', parent: '业务管理' },
  '/logs': { label: '操作日志', parent: '系统' },
};

export function TopBar({ title }: TopBarProps) {
  const pathname = usePathname();
  const { user, logout, isAuthenticated } = useAuth();

  // Find matching path
  const matchedPath = Object.keys(pathMappings).find(path =>
    pathname.startsWith(path)
  );
  const pathInfo = matchedPath ? pathMappings[matchedPath] : null;

  const displayTitle = title || pathInfo?.label || '丁记商行';
  const parentLabel = pathInfo?.parent;

  // 日期只在客户端渲染，避免 hydration 不匹配
  const [dateString, setDateString] = useState('');
  useEffect(() => {
    const today = new Date();
    const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
    setDateString(`${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 星期${weekdays[today.getDay()]}`);
  }, []);

  const handleLogout = async () => {
    await logout();
  };

  return (
    <header className="sticky top-0 z-30 border-b bg-card/80 backdrop-blur-xl safe-area-top">
      <div className="flex h-14 sm:h-16 items-center justify-between px-4 lg:px-8">
        {/* Left: Title and Breadcrumb */}
        <div className="flex flex-col min-w-0 flex-1 ml-12 lg:ml-0">
          {parentLabel && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              <span>{parentLabel}</span>
              <ChevronRight className="w-3 h-3" />
              <span className="text-foreground">{displayTitle}</span>
            </div>
          )}
          <h1 className="font-semibold text-lg sm:text-xl tracking-tight truncate">{displayTitle}</h1>
        </div>

        {/* Right: Date, Search, Notifications, User */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Date - hidden on mobile */}
          <div className="hidden md:block text-sm text-muted-foreground whitespace-nowrap">
            {dateString}
          </div>

          {/* Search - hidden on small screens */}
          <div className="hidden lg:flex relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              className="pl-9 w-[200px] h-9 bg-background/50"
            />
          </div>

          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9 sm:h-10 sm:w-10">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 sm:top-1.5 sm:right-1.5 w-2 h-2 bg-destructive rounded-full"></span>
          </Button>

          {/* User Menu */}
          {isAuthenticated && user && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 sm:h-10 px-2 sm:px-3 gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-4 h-4 text-primary" />
                  </div>
                  <span className="hidden sm:inline text-sm font-medium">
                    {user.displayName}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{user.username}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem disabled className="cursor-default">
                  <Shield className="mr-2 h-4 w-4" />
                  <span>角色</span>
                  <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="ml-auto">
                    {user.role === 'admin' ? '管理员' : '用户'}
                  </Badge>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>退出登录</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  );
}
