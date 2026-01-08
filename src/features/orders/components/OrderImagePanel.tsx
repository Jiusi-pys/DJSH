'use client';

// Order image viewer panel component

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ZoomIn, ZoomOut, RotateCw, Image as ImageIcon, ChevronLeft, ChevronRight, Upload, Trash2 } from 'lucide-react';

// Server image (already saved)
interface ServerImage {
  key: { image_id: number };
  display: { mime_type: string; base64: string; image_path?: string };
}

// Pending image (not yet saved)
export interface PendingImage {
  tempId: string;
  base64: string;
  mimeType: string;
}

// Combined image for display
type DisplayImage =
  | { type: 'server'; image: ServerImage }
  | { type: 'pending'; image: PendingImage };

interface OrderImagePanelProps {
  images: ServerImage[];  // Server-saved images
  pendingImages: PendingImage[];  // Locally cached pending uploads
  deletedImageIds: number[];  // Server image IDs marked for deletion
  onAddImage: (image: PendingImage) => void;
  onRemovePendingImage: (tempId: string) => void;
  onMarkDelete: (imageId: number) => void;
  onUnmarkDelete: (imageId: number) => void;
}

export function OrderImagePanel({
  images,
  pendingImages,
  deletedImageIds,
  onAddImage,
  onRemovePendingImage,
  onMarkDelete,
  onUnmarkDelete,
}: OrderImagePanelProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [uploading, setUploading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Combine server images (excluding deleted) and pending images for display
  const displayImages: DisplayImage[] = [
    ...images
      .filter((img) => !deletedImageIds.includes(img.key.image_id))
      .map((img) => ({ type: 'server' as const, image: img })),
    ...pendingImages.map((img) => ({ type: 'pending' as const, image: img })),
  ];

  const currentImage = displayImages[currentIndex];
  const hasImages = displayImages.length > 0;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result as string;
        const base64Data = dataUrl.split(',')[1];
        const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        onAddImage({
          tempId,
          base64: base64Data,
          mimeType: file.type,
        });
        setUploading(false);
      };
      reader.onerror = () => {
        alert('文件读取失败');
        setUploading(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setUploading(false);
    }
    e.target.value = '';
  };

  const handleDelete = () => {
    if (!currentImage) return;
    if (confirm('确定要删除这张图片吗？')) {
      if (currentImage.type === 'server') {
        onMarkDelete(currentImage.image.key.image_id);
      } else {
        onRemovePendingImage(currentImage.image.tempId);
      }
      // Adjust index if needed
      if (currentIndex >= displayImages.length - 1) {
        setCurrentIndex(Math.max(0, displayImages.length - 2));
      }
    }
  };

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : displayImages.length - 1));
  }, [displayImages.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < displayImages.length - 1 ? prev + 1 : 0));
  }, [displayImages.length]);

  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + 0.25, 3));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - 0.25, 0.5));
  }, []);

  const handleRotate = useCallback(() => {
    setRotation((prev) => (prev + 90) % 360);
  }, []);

  const handleFitToWidth = useCallback(() => {
    setZoom(1);
    setRotation(0);
  }, []);

  const getImageSrc = (displayImage: DisplayImage) => {
    if (displayImage.type === 'server') {
      const img = displayImage.image;
      if (img.display.base64) {
        return `data:${img.display.mime_type};base64,${img.display.base64}`;
      }
    } else {
      const img = displayImage.image;
      return `data:${img.mimeType};base64,${img.base64}`;
    }
    return '';
  };

  const getImageKey = (displayImage: DisplayImage) => {
    if (displayImage.type === 'server') {
      return `server_${displayImage.image.key.image_id}`;
    }
    return displayImage.image.tempId;
  };

  if (!hasImages) {
    return (
      <Card className="h-full min-h-[400px]">
        <CardContent className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
          <ImageIcon className="w-12 h-12 mb-2" />
          <p className="mb-4">暂无图片</p>
          <div>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
              id="order-image-upload"
              ref={fileInputRef}
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? '上传中...' : '上传图片'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full overflow-hidden">
      <CardContent className="p-4 h-full flex flex-col">
        {/* Thumbnails and upload button */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {displayImages.map((displayImage, index) => (
            <button
              key={getImageKey(displayImage)}
              onClick={() => {
                setCurrentIndex(index);
                setZoom(1);
                setRotation(0);
              }}
              className={`relative w-16 h-16 flex-shrink-0 rounded-md overflow-hidden border-2 ${
                index === currentIndex ? 'border-primary' : 'border-transparent'
              } ${displayImage.type === 'pending' ? 'ring-2 ring-yellow-400' : ''}`}
            >
              <img
                src={getImageSrc(displayImage)}
                alt=""
                className="w-full h-full object-cover"
              />
              {displayImage.type === 'pending' && (
                <div className="absolute inset-0 bg-yellow-400/20 flex items-center justify-center">
                  <span className="text-[8px] text-yellow-800 font-bold">待保存</span>
                </div>
              )}
            </button>
          ))}
          {/* Add image button */}
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="relative w-16 h-16 flex-shrink-0 rounded-md border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors"
          >
            {uploading ? (
              <span className="text-xs text-muted-foreground">上传中...</span>
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Main image viewer */}
        <div className="flex-1 relative overflow-auto bg-muted rounded-lg flex items-center justify-center min-h-[300px]">
          <div className="image-viewer-container w-full h-full flex items-center justify-center p-4">
            {currentImage && (
              <img
                ref={imgRef}
                src={getImageSrc(currentImage)}
                alt="Receipt"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                  transition: 'transform 0.2s ease',
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                }}
              />
            )}
          </div>

          {/* Controls */}
          <div className="image-viewer-controls">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} title="缩小">
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} title="放大">
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleRotate} title="旋转">
              <RotateCw className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleFitToWidth} title="适应宽度">
              <ImageIcon className="w-4 h-4" />
            </Button>
            {displayImages.length > 1 && (
              <>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="icon" onClick={handlePrev} title="上一张">
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-foreground px-2">
                  {currentIndex + 1} / {displayImages.length}
                </span>
                <Button variant="ghost" size="icon" onClick={handleNext} title="下一张">
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            <div className="w-px h-6 bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDelete}
              title="删除图片"
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
