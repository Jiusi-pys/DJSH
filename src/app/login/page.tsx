'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Lock } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading, error, clearError, isAuthenticated } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [attemptsRemaining, setAttemptsRemaining] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [lockDuration, setLockDuration] = useState<number | null>(null);

  // 清除错误当输入变化时
  useEffect(() => {
    if (localError || error) {
      clearError();
      setLocalError(null);
    }
  }, [username, password]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setAttemptsRemaining(null);
    setLocked(false);
    setLockDuration(null);

    if (!username.trim()) {
      setLocalError('请输入用户名');
      return;
    }

    if (!password) {
      setLocalError('请输入密码');
      return;
    }

    const result = await login(username.trim(), password);

    if (!result.success) {
      setLocalError(result.message || '登录失败');
      if (result.attemptsRemaining !== undefined) {
        setAttemptsRemaining(result.attemptsRemaining);
      }
      if (result.locked) {
        setLocked(true);
        setLockDuration(result.lockDuration || null);
      }
    }
  };

  // 如果已登录，显示加载状态（路由保护会自动跳转）
  if (isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">丁记商行</CardTitle>
          <CardDescription className="text-base">进销存管理系统</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            {displayError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {displayError}
                  {attemptsRemaining !== null && attemptsRemaining > 0 && (
                    <span className="block mt-1 text-sm">
                      剩余尝试次数: {attemptsRemaining}
                    </span>
                  )}
                  {locked && lockDuration && (
                    <span className="block mt-1 text-sm">
                      账户已锁定 {lockDuration} 分钟
                    </span>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="username">用户名</Label>
              <Input
                id="username"
                type="text"
                placeholder="请输入用户名"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || locked}
                autoComplete="username"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="请输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || locked}
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11"
              disabled={isLoading || locked}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : locked ? (
                '账户已锁定'
              ) : (
                '登录'
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            如需账号请联系系统管理员
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
