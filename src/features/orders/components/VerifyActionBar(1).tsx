'use client';

// Verify action bar component for order detail page

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save, CheckCircle, DollarSign } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VerifyActionBarProps {
  onBack: () => void;
  onSave: () => void;
  onVerify: (settledImmediately: boolean) => void;
  isSaving: boolean;
  isVerifying: boolean;
  isDirty: boolean;
  hasChanges?: boolean;
  settledImmediately: boolean;
  onSettledImmediatelyChange: (checked: boolean) => void;
}

export function VerifyActionBar({
  onBack,
  onSave,
  onVerify,
  isSaving,
  isVerifying,
  isDirty,
  settledImmediately,
  onSettledImmediatelyChange,
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

          <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="settled-immediately"
                checked={settledImmediately}
                onCheckedChange={onSettledImmediatelyChange}
                disabled={isSaving || isVerifying}
              />
              <Label
                htmlFor="settled-immediately"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center gap-1"
              >
                <DollarSign className="w-4 h-4" />
                当场结算
              </Label>
            </div>

            <Button
              variant="outline"
              onClick={onSave}
              disabled={isSaving || isVerifying || !isDirty}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? '保存中...' : '保存'}
            </Button>

            <Button
              onClick={() => onVerify(settledImmediately)}
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
