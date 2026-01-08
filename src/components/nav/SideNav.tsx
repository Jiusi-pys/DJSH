'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CheckSquare,
  ShoppingCart,
  ShoppingBag,
  Users,
  Package,
  DollarSign,
  Menu,
  FileText,
  X,
  TrendingUp,
  Settings,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useState } from 'react';

const navGroups = [
  {
    label: '概览',
    items: [
      { href: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
      { href: '/verify', label: '审核队列', icon: CheckSquare, badge: true },
    ],
  },
  {
    label: '业务管理',
    items: [
      { href: '/orders/sales', label: '销售订单', icon: TrendingUp },
      { href: '/orders/purchase', label: '采购订单', icon: ShoppingBag },
      { href: '/cash', label: '资金流水', icon: DollarSign },
    ],
  },
  {
    label: '基础数据',
    items: [
      { href: '/contacts', label: '客户管理', icon: Users },
      { href: '/products', label: '商品管理', icon: Package },
    ],
  },
  {
    label: '系统',
    items: [
      { href: '/logs', label: '操作日志', icon: FileText },
    ],
  },
];

function NavContent({ onItemClick }: { onItemClick?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-6 border-b border-white/10 safe-area-top">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
            <span className="text-lg font-bold text-white">丁</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">丁记商行</h1>
            <p className="text-xs text-white/50">进销存管理系统</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        {navGroups.map((group) => (
          <div key={group.label}>
            <h3 className="px-3 mb-2 text-xs font-medium text-white/40 uppercase tracking-wider">
              {group.label}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onItemClick}
                    className={cn(
                      'sidebar-item',
                      isActive ? 'sidebar-item-active' : 'sidebar-item-inactive'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-white/10 safe-area-bottom">
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <span className="text-xs font-bold text-white">丁</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">丁记商行</p>
            <p className="text-xs text-white/50 truncate">管理员</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function SideNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile: Sheet menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="lg:hidden fixed top-4 left-4 z-50">
          <Button variant="outline" size="icon" className="bg-card shadow-lg">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 sidebar border-0">
          <NavContent onItemClick={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop: Fixed sidebar */}
      <aside className="hidden lg:flex lg:w-[280px] lg:flex-col lg:fixed lg:inset-y-0 sidebar">
        <NavContent />
      </aside>
    </>
  );
}
