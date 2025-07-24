/* src/contexts/components/profile/CertificationForm.tsx */
'use client';

import React, { useState } from 'react';
import { useForm }                 from 'react-hook-form';
import { zodResolver }             from '@hookform/resolvers/zod';
import { z }                       from 'zod';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Link as LinkIcon,
  Shield,
  Music2,
  Mail,
  FileText,
  Building,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Schema / types                                                     */
/* ------------------------------------------------------------------ */
const schema = z.object({
  artistName:    z.string().min(2, 'Artist name is required'),
  recordLabel:   z.string().min(2, 'Record label information is required'),
  agentInfo:     z.string().optional().or(z.literal('')),
  copyrightInfo: z.string().min(10, 'Copyright information is required'),
  portfolio:     z
    .array(z.string().url('Invalid URL'))
    .refine((arr) => arr.filter(Boolean).length >= 1, 'At least one portfolio link is required'),
  description:   z.string().min(50).max(500),
  email:         z.string().email('Invalid email address'),
  socialProof:   z
    .array(z.string().url('Invalid URL'))
    .refine((arr) => arr.filter(Boolean).length >= 1, 'At least one social media link is required'),
  documentUrl:   z.string().optional().or(z.literal('')),
});

type FormData = z.infer<typeof schema>;

interface Props {
  onSuccess?: () => void;
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export function CertificationForm({ onSuccess }: Props) {
  const [isSubmitting, setSubmitting] = useState(false);
  const [status, setStatus]           = useState<'idle' | 'success' | 'error'>('idle');
  const [errMsg, setErrMsg]           = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isValid },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
  });

  /* helper – TS safe error message */
  const err = (e: unknown) =>
    (e as { message?: string } | undefined)?.message ?? undefined;

  const descriptionLen = watch('description')?.length ?? 0;

  const onSubmit = async (data: FormData) => {
    try {
      setSubmitting(true);
      setStatus('idle');
      setErrMsg(null);

      /* mimic API call */
      await new Promise((r) => setTimeout(r, 2_000));
      console.log('Certification payload', data);

      setStatus('success');
      onSuccess?.();
    } catch (e) {
      setStatus('error');
      setErrMsg(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  /* -------------------------------------------------------------- */
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ------------------------ Artist info --------------------- */}
      <Section title="Artist Information" icon={<Shield className="w-5 h-5" />}>
        <TwoCols>
          <Input
            label="Artist Name"
            required
            icon={<Music2 className="icon-left" />}
            {...register('artistName')}
            error={err(errors.artistName)}
          />
          <Input
            label="Email"
            required
            type="email"
            icon={<Mail className="icon-left" />}
            {...register('email')}
            error={err(errors.email)}
          />
        </TwoCols>

        <Textarea
          label="Description"
          required
          rows={4}
          counter={`${descriptionLen}/500`}
          {...register('description')}
          error={err(errors.description)}
        />
      </Section>

      {/* ---------------- Label / copyright ----------------------- */}
      <Section
        title="Record Label & Copyright Information"
        icon={<Building className="w-5 h-5" />}
      >
        <TwoCols>
          <Textarea
            label="Record Label Information"
            required
            rows={3}
            {...register('recordLabel')}
            error={err(errors.recordLabel)}
          />
          <Textarea
            label="Agent Information (optional)"
            rows={3}
            {...register('agentInfo')}
          />
        </TwoCols>

        <Textarea
          label="Copyright Information"
          required
          rows={3}
          {...register('copyrightInfo')}
          error={err(errors.copyrightInfo)}
        />

        <Input
          label="Documentation URL (optional)"
          icon={<FileText className="icon-left" />}
          {...register('documentUrl')}
        />
      </Section>

      {/* ---------------- Portfolio / socials --------------------- */}
      <Section title="Portfolio & Social Media" icon={<LinkIcon className="w-5 h-5" />}>
        <Label>
          Portfolio Links <span className="text-destructive">*</span>
        </Label>
        {[0, 1, 2].map((i) => (
          <Input
            key={`portfolio-${i}`}
            placeholder={`Portfolio link ${i + 1}${i === 0 ? ' (required)' : ''}`}
            {...register(`portfolio.${i}` as const)}
          />
        ))}
        {err(errors.portfolio) && <ErrorText>{err(errors.portfolio)}</ErrorText>}

        <Label>
          Social Media Links <span className="text-destructive">*</span>
        </Label>
        {[0, 1, 2].map((i) => (
          <Input
            key={`social-${i}`}
            placeholder={`Social link ${i + 1}${i === 0 ? ' (required)' : ''}`}
            {...register(`socialProof.${i}` as const)}
          />
        ))}
        {err(errors.socialProof) && <ErrorText>{err(errors.socialProof)}</ErrorText>}
      </Section>

      {/* ---------------- Status banners -------------------------- */}
      {status === 'success' && (
        <Banner tone="success" icon={<CheckCircle2 className="w-5 h-5" />}>
          Request submitted successfully! We’ll email you after review.
        </Banner>
      )}
      {status === 'error' && (
        <Banner tone="error" icon={<AlertCircle className="w-5 h-5" />}>
          {errMsg}
        </Banner>
      )}

      {/* ---------------- Submit button --------------------------- */}
      <button
        type="submit"
        disabled={isSubmitting || !isValid}
        className={cn(
          'w-full py-3 flex items-center justify-center gap-2 rounded-lg',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          'disabled:opacity-50',
        )}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Submitting…
          </>
        ) : (
          <>
            <Shield className="w-5 h-5" />
            Submit Verification Request
          </>
        )}
      </button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Tiny helpers / atoms                                               */
/* ------------------------------------------------------------------ */
const Section = ({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 text-primary">
      {icon}
      <h3 className="text-lg font-semibold">{title}</h3>
    </div>
    {children}
  </div>
);

const TwoCols = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{children}</div>
);

const Label = ({ children }: { children: React.ReactNode }) => (
  <label className="block text-sm font-medium mb-2">{children}</label>
);

const ErrorText = ({ children }: { children: React.ReactNode }) => (
  <p className="mt-1 text-sm text-destructive flex items-center gap-1">
    <AlertCircle className="w-4 h-4" />
    {children}
  </p>
);

const Banner = ({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'error';
  icon: React.ReactNode;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      'flex items-center gap-2 px-4 py-3 rounded-lg',
      tone === 'success' && 'text-green-500 bg-green-500/10',
      tone === 'error' && 'text-destructive bg-destructive/10',
    )}
  >
    {icon}
    <p>{children}</p>
  </div>
);

/* generic input ---------------------------------------------------- */
const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & {
    label?: string;
    error?: string;
    icon?: React.ReactElement; // ensure it has props
  }
>(({ label, error, icon, className, ...props }, ref) => (
  <div>
    {label && <Label>{label}</Label>}
    <div className="relative">
            {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          {icon}
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-4 py-2 bg-background border rounded-lg transition-colors',
          icon ? 'pl-10' : '',
          error ? 'border-destructive' : 'border-border focus:border-primary',
          className ?? undefined, // avoid passing null
        )}
        {...props}
      />
    </div>
    {error && <ErrorText>{error}</ErrorText>}
  </div>
));
Input.displayName = 'Input';

/* generic textarea ------------------------------------------------- */
const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    label?: string;
    error?: string;
    counter?: string;
  }
>(({ label, error, counter, className, ...props }, ref) => (
  <div>
    {label && (
      <Label>
        {label}
        {counter && <span className="text-muted-foreground ml-2">({counter})</span>}
      </Label>
    )}
    <textarea
      ref={ref}
      className={cn(
        'w-full px-4 py-2 bg-background border rounded-lg resize-none transition-colors',
        error ? 'border-destructive' : 'border-border focus:border-primary',
        className ?? undefined,
      )}
      {...props}
    />
    {error && <ErrorText>{error}</ErrorText>}
  </div>
));
Textarea.displayName = 'Textarea';
