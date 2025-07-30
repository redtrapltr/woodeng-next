'use client';

import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { cn } from '@/lib/utils';              // ← you already have this util

/* ─────────────── validation ─────────────── */
const contactSchema = z.object({
  name:    z.string().min(2, 'Name is required'),
  email:   z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});
type ContactFormData = z.infer<typeof contactSchema>;

/* ─────────────── component ─────────────── */
export default function ContactForm() {
  const [isSubmitting, setIsSubmitting]       = useState(false);
  const [submitStatus, setSubmitStatus]       = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage]       = useState<string | null>(null);

  const {
  register,
  handleSubmit,
  reset,
  formState: { errors },
} = useForm<ContactFormData>({
  // @ts-ignore  // (zod v3 vs resolver types)
  resolver: zodResolver(contactSchema),
});

  /* ContactForm.tsx  (only the onSubmit body changes) */
const onSubmit = async (data: ContactFormData) => {
  try {
    setIsSubmitting(true);
    setSubmitStatus(null);
    setErrorMessage(null);

    /* --- call the Next.js route --- */
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    /* ─── inside onSubmit, after fetch ─── */
if (!res.ok) {
  let msg = 'Failed to send message';
  const contentType = res.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = await res.json();
    msg = body?.message ?? msg;
  }
  throw new Error(msg);
}


    setSubmitStatus('success');
    reset();
  } catch (err) {
    setSubmitStatus('error');
    setErrorMessage(
      err instanceof Error ? err.message : 'An unexpected error occurred',
    );
  } finally {
    setIsSubmitting(false);
  }
};


  /* ─────────────── UI ─────────────── */
  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <form
  onSubmit={handleSubmit(
    onSubmit,          // ✅ “valid” branch – you already have this
    () => {            // ✅ “invalid” branch – **NEW**
      /* we don’t need to do anything here because
         the field-level errors are already shown;
         this just stops the ZodError from leaking
         to the console in dev. */
    }
  )}
  className="space-y-6"
>
        {/* ── NAME & EMAIL ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* name */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Your Name <span className="text-destructive">*</span>
            </label>
            <input
              {...register('name')}
              className={cn(
                'w-full px-4 py-2 bg-background border rounded-lg transition-colors',
                errors.name
                  ? 'border-destructive'
                  : 'border-border focus:border-primary',
              )}
            />
            {errors.name && (
              <p className="mt-1 text-sm text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* email */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Email Address <span className="text-destructive">*</span>
            </label>
            <input
              type="email"
              {...register('email')}
              className={cn(
                'w-full px-4 py-2 bg-background border rounded-lg transition-colors',
                errors.email
                  ? 'border-destructive'
                  : 'border-border focus:border-primary',
              )}
            />
            {errors.email && (
              <p className="mt-1 text-sm text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
        </div>

        {/* ── SUBJECT ── */}
        <div>
          <label className="block text-sm font-medium mb-2">Subject</label>
          <input
            {...register('subject')}
            className={cn(
              'w-full px-4 py-2 bg-background border rounded-lg transition-colors',
              errors.subject
                ? 'border-destructive'
                : 'border-border focus:border-primary',
            )}
          />
          {errors.subject && (
            <p className="mt-1 text-sm text-destructive">
              {errors.subject.message}
            </p>
          )}
        </div>

        {/* ── MESSAGE ── */}
        <div>
          <label className="block text-sm font-medium mb-2">Message</label>
          <textarea
            rows={5}
            {...register('message')}
            className={cn(
              'w-full px-4 py-2 bg-background border rounded-lg transition-colors resize-none',
              errors.message
                ? 'border-destructive'
                : 'border-border focus:border-primary',
            )}
          />
          {errors.message && (
            <p className="mt-1 text-sm text-destructive">
              {errors.message.message}
            </p>
          )}
        </div>

        {/* ── STATUS BANNERS ── */}
        {submitStatus === 'success' && (
          <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-4 py-3 rounded-lg">
            <CheckCircle2 className="w-5 h-5" />
            <p>Message sent successfully! We’ll get back to you soon.</p>
          </div>
        )}
        {submitStatus === 'error' && (
          <div className="flex items-center gap-2 text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
            <AlertCircle className="w-5 h-5" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* ── SUBMIT ── */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Sending…
            </>
          ) : (
            <>
              <Send className="w-5 h-5" />
              Send Message
            </>
          )}
        </button>
      </form>
    </div>
  );
}
