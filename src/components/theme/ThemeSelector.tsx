'use client';

import { Palette, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTheme } from '@/lib/theme/ThemeProvider';
import { useEffect, useState } from 'react';

const themes = [
  { value: 'default', label: '默认', color: 'bg-indigo-500' },
  { value: 'blue', label: '蓝色', color: 'bg-blue-500' },
  { value: 'green', label: '绿色', color: 'bg-green-600' },
  { value: 'purple', label: '紫色', color: 'bg-purple-500' },
  { value: 'dark', label: '深色', color: 'bg-slate-800' },
] as const;

export function ThemeSelector() {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
        <Palette className="h-5 w-5" />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-10 sm:w-10">
          <Palette className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        {themes.map((t) => (
          <DropdownMenuItem
            key={t.value}
            onClick={() => setTheme(t.value as any)}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${t.color}`} />
              <span>{t.label}</span>
            </div>
            {theme === t.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
