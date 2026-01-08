import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '登录 - 丁记商行',
  description: '丁记商行进销存管理系统登录',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 登录页面不使用主布局的侧边栏和顶栏
  return <>{children}</>;
}
