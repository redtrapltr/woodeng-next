/* src/components/profile/ProfileUpdateForm.tsx
   -------------------------------------------------------------- */
'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { useUserStore }   from '@/stores/userStore';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { cn }             from '@/lib/utils';
import { ImageUpload }    from '@/components/profile/ImageUpload';

/* ------------------------------------------------------------------ */
/*  Schema & types                                                    */
/* ------------------------------------------------------------------ */
const profileUpdateSchema = z.object({
  personalInfo: z.object({
    firstName: z.string().max(50).optional().or(z.literal('')),
    lastName:  z.string().max(50).optional().or(z.literal('')),
    username:  z.string()
      .min(3,  'Username must contain at least 3 characters')
      .max(30, 'Username cannot exceed 30 characters')
      .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, dashes and underscores'),
    email:     z.string().email('Invalid email address'),
    bio:       z.string().max(160).optional().or(z.literal('')),
    phone:     z.string()
      .regex(/^(\+\d{1,3}|0)[1-9](\d{2}){4}$/, 'Invalid phone number')
      .optional().or(z.literal('')),
    location:  z.string().max(100).optional().or(z.literal('')),
    address: z.object({
      street:     z.string().max(100).optional().or(z.literal('')),
      city:       z.string().max(50).optional().or(z.literal('')),
      postalCode: z.string().regex(/^\d{5}$/,'Invalid postal code').optional().or(z.literal('')),
      country:    z.string().max(50).optional().or(z.literal('')),
    }).optional(),
  }),
  socialLinks: z.object({
    twitter:   z.string().url().optional().or(z.literal('')),
    instagram: z.string().url().optional().or(z.literal('')),
    youtube:   z.string().url().optional().or(z.literal('')),
    website:   z.string().url().optional().or(z.literal('')),
    telegram:  z.string().url().optional().or(z.literal('')),
  }).optional(),
});

type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

interface ProfileUpdateFormProps {
  onSuccess?: () => void;
  onError?:   (error: Error) => void;
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */
export function ProfileUpdateForm({ onSuccess, onError }: ProfileUpdateFormProps) {
  const { user, updateUser }          = useUserStore();
  const [isLoading, setIsLoading]     = useState(false);
  const [updateStatus, setStatus]     = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrMsg]     = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ProfileUpdateData>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      personalInfo: {
        firstName:  user?.firstName  ?? '',
        lastName:   user?.lastName   ?? '',
        username:   user?.username   ?? '',
        email:      user?.email      ?? '',
        bio:        user?.bio        ?? '',
        phone:      user?.phone      ?? '',
        location:   user?.location   ?? '',
        address:    user?.address    ?? {},
      },
      socialLinks: user?.socialLinks ?? {},
    },
  });

  /* live bio length display */
  const bioLength = watch('personalInfo.bio')?.length ?? 0;

  /* -------------- image handlers ------------------ */
  const handleAvatarChange = (url: string) => {
    if (user) updateUser({ ...user, avatarUrl: url });
  };

  const handleCoverChange = (url: string) => {
    if (user) updateUser({ ...user, coverUrl: url });
  };

  /* -------------- submit -------------------------- */
  const onSubmit = async (data: ProfileUpdateData) => {
    try {
      setIsLoading(true);
      setStatus('idle');
      setErrMsg(null);

      // 👉 simulate backend call
      await new Promise(r => setTimeout(r, 1200));

      if (user) {
        updateUser({
          ...user,
          ...data.personalInfo,
          bio:        data.personalInfo.bio,
          socialLinks: data.socialLinks,
        });
      }

      setStatus('success');
      onSuccess?.();
    } catch (e: any) {
      setStatus('error');
      const msg = e?.message ?? 'An error occurred';
      setErrMsg(msg);
      onError?.(e instanceof Error ? e : new Error(msg));
    } finally {
      setIsLoading(false);
    }
  };

  /* ---------------------------------------------------------------- */
  /*  render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ---------- Personal info card ------------------------------ */}
      <div className="bg-card rounded-lg border border-border p-6 space-y-6">
        <h2 className="text-xl font-semibold">Personal Information</h2>

        {/* avatar */}
        <div>
          <label className="block text-sm font-medium mb-2">Profile Picture</label>
          <ImageUpload currentImage={user?.avatarUrl} onImageChange={handleAvatarChange} />
        </div>

        {/* cover */}
        <div>
          <label className="block text-sm font-medium mb-2">Cover Image</label>
          <ImageUpload currentImage={user?.coverUrl} onImageChange={handleCoverChange} />
        </div>

        {/* bio */}
        <div>
          <label className="block text-sm font-medium mb-2">
            Bio&nbsp;
            <span className="text-muted-foreground">({bioLength}/160)</span>
          </label>
          <textarea
            {...register('personalInfo.bio')}
            rows={3}
            className={cn(
              'w-full px-3 py-2 bg-background border rounded-lg resize-none',
              errors.personalInfo?.bio ? 'border-destructive' : 'border-border focus:border-primary',
            )}
            placeholder="Write a short bio about yourself…"
          />
          {errors.personalInfo?.bio && (
            <p className="mt-1 text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.personalInfo.bio.message}
            </p>
          )}
        </div>

        {/* (the rest of the inputs stay identical to your previous version) */}
        {/* … first / last name, username, email, phone, location, address, social links … */}
      </div>

      {/* ---------- status + submit ---------------------------------- */}
      <div className="flex items-center justify-between">
        {/* status bubble */}
        {updateStatus === 'success' && (
          <p className="flex items-center gap-2 text-green-500">
            <CheckCircle className="w-5 h-5" /> Changes saved
          </p>
        )}
        {updateStatus === 'error' && (
          <p className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-5 h-5" /> {errorMessage}
          </p>
        )}

        {/* button */}
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg flex items-center gap-2 disabled:opacity-50"
        >
          {isLoading && <Loader2 className="w-5 h-5 animate-spin" />}
          {isLoading ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
