'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

const ALLOWED_IMAGE_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export interface PendingImage {
  tempId: string;
  base64: string;
  mimeType: string;
  fileName: string;
}

interface CashImageUploaderProps {
  images: PendingImage[];
  onAddImage: (image: PendingImage) => void;
  onRemoveImage: (tempId: string) => void;
}

export function CashImageUploader({ images, onAddImage, onRemoveImage }: CashImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      // Validate file type
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
        alert(`不支持的文件格式: ${file.name}。仅支持 JPG, PNG, GIF, WebP 格式。`);
        continue;
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        alert(`文件过大: ${file.name}。最大支持 10MB。`);
        continue;
      }

      // Read file as base64
      try {
        const base64 = await readFileAsBase64(file);
        const pendingImage: PendingImage = {
          tempId: `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          base64,
          mimeType: file.type,
          fileName: file.name,
        };
        onAddImage(pendingImage);
      } catch (error) {
        console.error('Failed to read file:', error);
        alert(`读取文件失败: ${file.name}`);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-2" />
          选择图片
        </Button>
        <span className="text-xs text-muted-foreground">
          支持 JPG, PNG, GIF, WebP，最大 10MB
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img) => (
            <div
              key={img.tempId}
              className="relative group aspect-square rounded-lg overflow-hidden border bg-muted"
            >
              <img
                src={img.base64}
                alt={img.fileName}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => onRemoveImage(img.tempId)}
                >
                  <X className="h-4 w-4 mr-1" />
                  删除
                </Button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                {img.fileName}
              </div>
            </div>
          ))}
        </div>
      )}

      {images.length === 0 && (
        <div className="border-2 border-dashed rounded-lg p-8 text-center text-muted-foreground">
          <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">暂无图片</p>
          <p className="text-xs mt-1">点击上方按钮选择图片</p>
        </div>
      )}
    </div>
  );
}
