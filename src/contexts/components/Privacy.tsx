'use client';

import React from 'react';
import { Shield, Lock } from 'lucide-react';
import Link from 'next/link';

type SubSection = {
  subtitle?: string;           // optional – some blocks have no subtitle
  items: string[];
};

type Section = {
  title: string;
  content: SubSection[];       // always an array of subsections
};

/* ——— static data ——— */
const lastUpdated = 'June 30, 2025';

const sections: Section[] = [
  {
    title: '1. Information We Collect',
    content: [
      {
        subtitle: 'Personal Information',
        items: [
          'Wallet addresses and transaction history',
          'Profile information (username, bio, avatar)',
          'Social media handles (when provided)',
          'Authentication credentials',
        ],
      },
      {
        subtitle: 'Usage Information',
        items: [
          'Device and browser information',
          'IP address and location data',
          'Log data and activity timestamps',
          'Platform interaction metrics',
          'Performance and error data',
        ],
      },
      {
        subtitle: 'Content Information',
        items: [
          'Uploaded audio files and metadata',
          'NFT creation and transaction data',
          'Sound meme token ownership records',
          'Comments and community interactions',
          'Collection and playlist data',
        ],
      },
      {
        subtitle: 'Blockchain Data',
        items: [
          'Public blockchain transactions',
          'Token ownership records',
          'Smart contract interactions',
          'Pool and liquidity data',
          'On-chain activity history',
        ],
      },
    ],
  },
  {
    title: '2. How We Use Your Information',
    content: [
      {
        items: [
          'Provide and maintain the Platform services',
          'Process transactions and payments',
          'Verify identity and prevent fraud',
          'Communicate important updates and announcements',
          'Improve and personalize user experience',
          'Analyze platform usage and performance',
          'Comply with legal obligations',
          'Respond to user support requests',
          'Facilitate token trading and ownership verification',
          'Manage liquidity pools and automated market makers',
        ],
      },
    ],
  },
  {
    title: '3. Information Sharing',
    content: [
      {
        subtitle: 'We may share your information with:',
        items: [
          'Service providers and business partners',
          'Legal authorities when required by law',
          'Other users (public profile information)',
          'Analytics and security providers',
          'Blockchain networks (for transaction processing)',
        ],
      },
      {
        subtitle: 'We will never:',
        items: [
          'Sell your personal data to third parties',
          'Share your data for marketing purposes without consent',
          'Disclose more information than necessary',
        ],
      },
    ],
  },
  {
    title: '4. Data Security',
    content: [
      {
        items: [
          'Industry-standard encryption for data transmission',
          'Regular security audits and assessments',
          'Secure storage of personal information',
          'Access controls and authentication measures',
          'Incident response procedures',
          'Employee data-handling training',
          'Smart-contract security reviews',
          'Decentralized storage for content files',
        ],
      },
    ],
  },
  {
    title: '5. Your Rights',
    content: [
      {
        items: [
          'Access your personal information',
          'Correct inaccurate data',
          'Request data deletion (where possible, noting that blockchain data is immutable)',
          'Object to data processing',
          'Export your data',
          'Withdraw consent',
          'Lodge complaints with supervisory authorities',
        ],
      },
    ],
  },
  {
    title: '6. Cookies and Tracking',
    content: [
      {
        subtitle: 'We use cookies for:',
        items: [
          'Essential platform functionality',
          'Authentication and security',
          'Performance monitoring',
          'User preference storage',
          'Analytics and improvements',
        ],
      },
    ],
  },
  {
    title: "7. Children's Privacy",
    content: [
      {
        items: [
          'The Platform is not intended for users under 18',
          'We do not knowingly collect data from children',
          "Parents should supervise children's online activities",
          'Contact us to remove underage user data',
        ],
      },
    ],
  },
  {
    title: '8. Blockchain Data Considerations',
    content: [
      {
        items: [
          'Blockchain transactions are public and immutable',
          'Wallet addresses and transaction history are visible on-chain',
          'Token ownership records are publicly accessible',
          'Pool activity and trading history cannot be deleted',
          'Consider these factors before using our platform',
        ],
      },
    ],
  },
  {
    title: '9. SPL404 Token Privacy',
    content: [
      {
        items: [
          'Token ownership is recorded on the Solana blockchain',
          'Transaction history for tokens is publicly visible',
          'Token balances are linked to wallet addresses',
          'Trading activity in liquidity pools is transparent',
          'Consider using separate wallets for different activities if privacy is a concern',
        ],
      },
    ],
  },
  {
    title: '10. International Data Transfers',
    content: [
      {
        items: [
          'Data may be processed in different jurisdictions',
          'We ensure appropriate safeguards for data transfers',
          'Compliance with international data-protection laws',
          'Transparency about data storage locations',
        ],
      },
    ],
  },
  {
    title: '11. Changes to Privacy Policy',
    content: [
      {
        items: [
          'We may update this policy periodically',
          'Changes will be posted on the Platform',
          'Continued use implies acceptance of changes',
          'Significant changes will be notified directly',
        ],
      },
    ],
  },
  {
    title: '12. Retention Period',
    content: [
      {
        items: [
          'Account data retained while account is active',
          'Transaction records kept for legal requirements',
          'Inactive account data archived after 12 months',
          'Deleted data permanently removed within 30 days',
          'Blockchain data remains permanent and immutable',
        ],
      },
    ],
  },
];

/* ————————— component ————————— */
export default function Privacy() {
  return (
    <div className="py-12 space-y-12">
      {/* HEADER */}
      <header className="text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Lock className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Privacy Policy</h1>
        <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>

      {/* INTRO */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <p className="font-medium">Your Privacy Matters</p>
          </div>
          <p className="text-muted-foreground">
            This Privacy Policy explains how Woodeng collects, uses, and safeguards your
            information. We’re committed to protecting your privacy and ensuring a positive
            experience on our platform.
          </p>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="max-w-3xl mx-auto space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-6">
            <h2 id={`section-${idx + 1}`} className="text-2xl font-bold">
              {section.title}
            </h2>

            {section.content.map((sub, i) => (
              <div key={i} className="space-y-4">
                {sub.subtitle && (
                  <h3 className="text-lg font-semibold text-primary">{sub.subtitle}</h3>
                )}

                <ul className="space-y-2">
                  {sub.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-3 text-muted-foreground">
                      <span className="select-none">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* CONTACT BLOCK */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Questions?</h2>
          </div>
          <p className="text-muted-foreground mb-6">
            If you have any questions about our use of your data, feel free to reach out.
          </p>
          <Link
            href="/contact"
            className="inline-flex px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
