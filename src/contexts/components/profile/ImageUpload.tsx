/* src/components/profile/ImageUpload.tsx
   -------------------------------------------------------------- */
'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone }           from 'react-dropzone';
import { Upload, X, AlertCircle, CheckCircle2 } from 'lucide-react';

import { cn }                    from '@/lib/utils';
import { validateImage, uploadImage } from '@/lib/image';

interface ImageUploadProps {
  currentImage?: string;
  onImageChange: (url: string) => void;
  onError?: (msg: string) => void;
  customButton?: React.ReactNode;
}

export function ImageUpload({
  currentImage,
  onImageChange,
  onError,
  customButton,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  /* drop-handler -------------------------------------------------- */
  const onDrop = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      await validateImage(file);
      const url = await uploadImage(file);
      onImageChange(url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to upload image';
      setError(msg);
      onError?.(msg);
    } finally {
      setIsUploading(false);
    }
  }, [onError, onImageChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    maxFiles: 1,
    accept: { 'image/jpeg': [], 'image/png': [] },
  });

  const removeImage = () => {
    onImageChange('');
    setError(null);
  };

  /* custom trigger button ---------------------------------------- */
  if (customButton) {
    return (
      <div {...getRootProps()}>
        <input {...getInputProps()} />
        {customButton}
      </div>
    );
  }

  /* default drag-and-drop area ----------------------------------- */
  return (
    <div className="space-y-2">
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-lg transition-all duration-200 relative cursor-pointer',
          isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50',
        )}
      >
        <input {...getInputProps()} />

        {currentImage ? (
          <div className="relative p-4">
            <img
              src={currentImage}
              alt="preview"
              className="w-32 h-32 mx-auto rounded-full object-cover"
            />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeImage();
              }}
              className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="p-8 flex flex-col items-center gap-3">
            <div
              className={cn(
                'p-4 rounded-full transition-colors duration-200',
                isDragActive ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              <Upload className="w-8 h-8" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium">
                {isDragActive
                  ? 'Drop the image here'
                  : 'Drop an image here, or click to select'}
              </p>
              <p className="text-xs text-muted-foreground">
                JPG / PNG · max 5 MB · min 400 × 400 px
              </p>
            </div>
          </div>
        )}
      </div>

      {/* status / errors ------------------------------------------- */}
      {error && (
        <p className="text-sm text-destructive flex items-center gap-1">
          <AlertCircle className="w-4 h-4" /> {error}
        </p>
      )}

      {isUploading && (
        <p className="text-sm text-primary flex items-center gap-1">
          <CheckCircle2 className="w-4 h-4" /> Uploading…
        </p>
      )}
    </div>
  );
}
