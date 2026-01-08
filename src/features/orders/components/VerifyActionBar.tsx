'use client';

// Verify action bar component for order detail page

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Save, CheckCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VerifyActionBarProps {
  onBack: () => void;
  onSave: () => void;
  onVerify: () => void;
  isSaving: boolean;
  isVerifying: boolean;
  isDirty: boolean;
  hasChanges?: boolean;
}

export function VerifyActionBar({
  onBack,
  onSave,
  onVerify,
  isSaving,
  isVerifying,
  isDirty,
}: VerifyActionBarProps) {
  const router = useRouter();

  return (
    <div className="sticky bottom-0 z-10 bg-background border-t shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <Button variant="outline" onClick={onBack} disabled={isSaving || isVerifying}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={onSave}
              disabled={isSaving || isVerifying || !isDirty}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存'}
            </Button>

            <Button
              onClick={onVerify}
              disabled={isSaving || isVerifying}
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              {isVerifying ? '审核中...' : '确认审核'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
