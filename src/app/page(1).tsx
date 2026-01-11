import { redirect } from 'next/navigation';

export default function HomePage() {
  // 未登录用户会被 AuthProvider 重定向到 /login
  // 已登录用户直接跳转到仪表盘
  redirect('/dashboard');
}
