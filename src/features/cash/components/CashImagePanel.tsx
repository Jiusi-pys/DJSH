'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Image as ImageIcon, X } from 'lucide-react';
import { cashApi } from '@/lib/apiClient';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const ALLOWED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface ServerImage {
  key: { image_id: number };
  display: { mime_type: string; base64: string };
}

interface CashImagePanelProps {
  transactionId: number;
  images: ServerImage[];
}

export function CashImagePanel({ transactionId, images }: CashImagePanelProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: (data: { image_data: string; mime_type: string }) =>
      cashApi.uploadImage(transactionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'images', transactionId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageId: number) => cashApi.deleteImage(transactionId, imageId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash', 'images', transactionId] });
      setSelectedImage(null);
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];

    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.type)) {
      alert('不支持的图片格式，请上传 JPG、PNG、GIF 或 WebP 格式的图片');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      alert('图片大小不能超过 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      await uploadMutation.mutateAsync({
        image_data: base64,
        mime_type: file.type,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      {/* 图片网格 */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {images.map((img, index) => (
          <div
            key={img.key.image_id}
            className="relative aspect-square border rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-primary"
            onClick={() => setSelectedImage(index)}
          >
            <img
              src={`data:${img.display.mime_type};base64,${img.display.base64}`}
              alt={`图片 ${index + 1}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}

        {/* 上传按钮 */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="aspect-square border-2 border-dashed rounded-lg flex flex-col items-center justify-center hover:border-primary hover:bg-accent transition-colors"
          disabled={uploadMutation.isPending}
        >
          <Upload className="h-6 w-6 text-muted-foreground mb-1" />
          <span className="text-xs text-muted-foreground">
            {uploadMutation.isPending ? '上传中...' : '上传图片'}
          </span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_IMAGE_MIME_TYPES.join(',')}
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* 图片预览对话框 */}
      {selectedImage !== null && images[selectedImage] && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl w-full" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2 z-10 bg-black/50 hover:bg-black/70 text-white"
              onClick={() => setSelectedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={`data:${images[selectedImage].display.mime_type};base64,${images[selectedImage].display.base64}`}
              alt="预览"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(images[selectedImage].key.image_id)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {deleteMutation.isPending ? '删除中...' : '删除图片'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
