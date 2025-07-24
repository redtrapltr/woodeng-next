/* src/components/profile/ProfileSettings.tsx
   -------------------------------------------------------------- */
'use client';

import React, { useState } from 'react';
import { Globe, Shield, AlertCircle } from 'lucide-react';

import { useUserStore }         from '@/stores/userStore';
import { CertificationForm }    from '@/components/profile/CertificationForm';
import { cn }                   from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Small helper – card wrapper                                       */
/* ------------------------------------------------------------------ */
interface SettingsSectionProps {
  title: string;
  icon:  React.ReactNode;
  children: React.ReactNode;
}

function SettingsSection({ title, icon, children }: SettingsSectionProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <div className="flex items-center gap-3 mb-6">
        {icon}
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                    */
/* ------------------------------------------------------------------ */
export function ProfileSettings() {
  const { user } = useUserStore();
  const [showCertificationForm, setShowCertificationForm] = useState(false);

  /* ---------- helpers -------------------------------------------- */
  const canRequestCertification = (): boolean => {
    if (!user?.certification) return true;

    if (
      user.certification.status === 'rejected' &&
      user.certification.rejectionDate
    ) {
      const rejected  = new Date(user.certification.rejectionDate).getTime();
      const coolDown  = 72 * 60 * 60 * 1000; // 72 h
      return Date.now() - rejected >= coolDown;
    }
    return user.certification.status === 'none';
  };

  const statusMessage = (() => {
    if (!user?.certification) return null;

    switch (user.certification.status) {
      case 'pending':
        return { message: 'Your certification request is being reviewed', type: 'info' };
      case 'rejected': {
        if (user.certification.rejectionDate) {
          const rejected  = new Date(user.certification.rejectionDate).getTime();
          const coolDown  = rejected + 72 * 60 * 60 * 1000;
          const hoursLeft = Math.ceil((coolDown - Date.now()) / (60 * 60 * 1000));
          if (Date.now() < coolDown) {
            return { message: `You can submit a new request in ${hoursLeft} h`, type: 'warning' };
          }
        }
        return { message: 'Your previous request was rejected. You can submit a new request now.', type: 'warning' };
      }
      case 'approved':
        return { message: 'Your account is certified', type: 'success' };
      default:
        return null;
    }
  })();

  /* ---------------------------------------------------------------- */
  /*  render                                                          */
  /* ---------------------------------------------------------------- */
  return (
    <div className="space-y-6">
      {/* ---------- Account-verification card ---------------------- */}
      <SettingsSection
        title="Account Verification"
        icon={<Globe className="w-5 h-5 text-primary" />}
      >
        <div className="space-y-4">
          {/* info block */}
          <div className="bg-muted/50 rounded-lg p-6 space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Artist Verification</h4>
              <p className="text-muted-foreground">
                Verification is required for artists with record labels, agents, or
                applicable copyright protection.
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-card rounded-lg">
              {/* badge copy */}
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Verified Creator Status</p>
                  <p className="text-sm text-muted-foreground">Get a verified badge</p>
                </div>
              </div>

              {/* request button / status */}
              <div>
                {statusMessage && (
                  <p
                    className={cn(
                      'text-sm mb-2 flex items-center gap-1',
                      statusMessage.type === 'info'    && 'text-primary',
                      statusMessage.type === 'warning' && 'text-yellow-500',
                      statusMessage.type === 'success' && 'text-green-500'
                    )}
                  >
                    <AlertCircle className="w-4 h-4" />
                    {statusMessage.message}
                  </p>
                )}

                {canRequestCertification() && user?.certification?.status !== 'approved' && (
                  <button
                    onClick={() => setShowCertificationForm(true)}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 flex items-center gap-2"
                  >
                    <Shield className="w-4 h-4" />
                    Request Verification
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* benefits */}
          <div className="bg-muted/50 rounded-lg p-6">
            <h4 className="font-semibold mb-4">Benefits of Verification</h4>
            <ul className="space-y-2">
              <li className="flex items-start gap-2"><span className="text-primary">•</span>Verified badge on your profile</li>
              <li className="flex items-start gap-2"><span className="text-primary">•</span>Copyright protection for your music</li>
              <li className="flex items-start gap-2"><span className="text-primary">•</span>Eligibility for featured-artist promos</li>
            </ul>
          </div>
        </div>
      </SettingsSection>

      {/* ---------- modal ------------------------------------------ */}
      {showCertificationForm && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">Verification Request</h2>
            <p className="text-muted-foreground mb-6">
              Provide details about your label, agent, or copyright to apply for
              verified-artist status.
            </p>

            <CertificationForm onSuccess={() => setShowCertificationForm(false)} />

            <button
              onClick={() => setShowCertificationForm(false)}
              className="mt-6 w-full py-2 bg-muted hover:bg-muted/80 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
