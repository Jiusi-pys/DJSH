'use client';

import { usePathname } from 'next/navigation';
import { SideNav } from '@/components/nav/SideNav';
import { TopBar } from '@/components/nav/TopBar';

// 不需要显示导航栏的页面路径
const NO_NAV_PATHS = ['/login'];

interface AppLayoutProps {
  children: React.ReactNode;
}

/**
 * 应用布局组件
 * 根据路径决定是否显示侧边栏和顶部栏
 */
export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname();

  // 检查是否是不需要导航的页面
  const isNoNavPage = NO_NAV_PATHS.some(path => pathname?.startsWith(path));

  if (isNoNavPage) {
    // 登录页面等不需要导航的页面直接渲染内容
    return <>{children}</>;
  }

  // 其他页面显示完整布局
  return (
    <div className="flex min-h-screen">
      <SideNav />
      <main className="flex-1 lg:pl-[280px] min-w-0">
        <TopBar />
        <div className="p-3 sm:p-4 lg:p-8 animate-fadeIn pb-20 sm:pb-8">
          {children}
        </div>
      </main>
    </div>
  );
}
