'use client';

import React from 'react';
import { Shield, FileText, Music2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

/* ────────────────────────────────────────────
 *  Types
 * ──────────────────────────────────────────── */
type Bullet = { subtitle: string; items: string[] };
type Section = { title: string; content: (string | Bullet)[] };

/* ────────────────────────────────────────────
 *  Static data
 *    – identical to the front-end you showed,
 *      but WITHOUT the extra outer brackets.
 * ──────────────────────────────────────────── */
const lastUpdated = 'June 30, 2025';

const sections: Section[] = [
  {
    title: '1. Acceptance of Terms',
    content: [
      "By accessing and using the Woo platform ('Platform'), you agree to be bound by these Terms of Service ('Terms'). If you disagree with any part of the terms, you may not access the Platform.",
      'These Terms constitute a legally binding agreement between you and Woodeng regarding your use of the Platform and any services offered through the Platform, including but not limited to NFT creation, buying, selling, and trading of both music NFTs and sound memes.',
    ],
  },
  {
    title: '2. Platform Services',
    content: [
      {
        subtitle: 'Decentralized Storage',
        items: [
          'All content uploaded to Woodeng is stored on decentralized storage networks for enhanced security and reliability',
          'Content is distributed across multiple nodes to ensure availability and redundancy',
          'IPFS and other decentralized protocols are used to maintain content integrity',
          'Users retain control over their content through blockchain-verified ownership',
        ],
      },
      {
        subtitle: 'Music NFT Creation',
        items: [
          'Upload and transform musical works into NFTs with our easy-to-use minting tools',
          'Set pricing and royalty terms',
          'Manage metadata and properties',
          'Distribute through smart contracts',
        ],
      },
      {
        subtitle: 'Sound Meme Creation (SPL404)',
        items: [
          'Create viral sound meme NFTs with tokenized ownership',
          'Set token supply and distribution parameters',
          'Choose between liquidity pools or bonding curves for token pricing',
          'Establish initial liquidity pools or set bonding-curve parameters',
          'Manage token properties and metadata',
        ],
      },
      {
        subtitle: 'Trading and Marketplace',
        items: [
          'Buy and sell music NFTs and sound meme tokens',
          'Secondary market trading',
          'Automated royalty distribution for music NFTs',
          'Real-time price tracking',
        ],
      },
    ],
  },
  {
    title: '3. User Obligations and Content Responsibility',
    content: [
      {
        subtitle: 'Content Creation and Ownership',
        items: [
          'Users are solely responsible for all content they upload, create, or share on the Platform',
          'Users must have full rights or permissions for any content they use',
          'Woodeng is not responsible for user-generated content',
          'Users indemnify Woodeng Ecosystem against any claims related to their content',
        ],
      },
      {
        subtitle: 'Content Compliance',
        items: [
          'Content must not infringe on third-party rights',
          'Users must verify rights before uploading',
          'Users bear all legal responsibility for their content',
          'Platform may remove content that violates these terms',
        ],
      },
      {
        subtitle: 'Sound Meme Guidelines',
        items: [
          'Ensure meme content respects copyright laws',
          'Obtain necessary permissions for source material',
          'Follow fair-use guidelines where applicable',
          'Respect original content creators’ rights',
        ],
      },
      {
        subtitle: 'Platform Usage',
        items: [
          'Use services legally and responsibly',
          'Maintain wallet security',
          'Report violations and issues',
          'Follow community guidelines',
        ],
      },
    ],
  },
  {
    title: '4. Intellectual Property',
    content: [
      {
        subtitle: 'Platform Rights',
        items: [
          'All platform content is owned by Woo Platform',
          'Interface and features are protected',
          'Trademarks and branding are reserved',
        ],
      },
      {
        subtitle: 'Creator Rights',
        items: [
          'Creators retain original copyright',
          'Moral rights are preserved',
        ],
      },
      {
        subtitle: 'Meme Rights',
        items: [
          'Sound meme creators must respect source-material rights',
          'Derivative works must comply with copyright law',
          'Fair-use principles apply where relevant',
        ],
      },
    ],
  },
  {
    title: '5. Financial Terms',
    content: [
      {
        subtitle: 'Fees and Payments',
        items: [
          'Platform fees apply to transactions',
          'Smart contracts handle distributions',
          'Cryptocurrency payments only',
          'No refunds on blockchain transactions',
        ],
      },
      {
        subtitle: 'Royalties',
        items: [
          'Automatic royalty distribution for music NFTs without pools',
          'Secondary-sale commissions',
          'Creator-set royalty rates up to 15 %',
          'Transparent payment tracking',
        ],
      },
      {
        subtitle: 'Liquidity Pools',
        items: [
          'Music NFTs can be created with liquidity pools instead of royalties',
          'Sound-meme SPL404 tokens can include liquidity pools',
          'Initial liquidity is locked in the smart contract',
          'Creators benefit from price appreciation as tokens are purchased',
        ],
      },
      {
        subtitle: 'Bonding Curves',
        items: [
          'Sound memes can be created with bonding curves instead of initial liquidity',
          'Price automatically increases as tokens are purchased',
          'No initial liquidity required from creator',
          'Automatic migration to WOO DEX when market cap reaches $44 000',
          'Liquidity will be created and locked in our smart contract',
        ],
      },
      {
        subtitle: 'SPL404 Token Economics',
        items: [
          'Sound memes use the SPL404 token standard for fractionalised ownership',
          'Tokens represent partial ownership of the sound meme',
          '0.3 % transaction fee applies to all token trades',
          'Transaction fees are distributed to stakers in the Woodeng ecosystem',
          'Liquidity cannot be withdrawn after deployment',
        ],
      },
    ],
  },
  {
    title: '6. Artist Verification',
    content: [
      {
        subtitle: 'Verification Eligibility',
        items: [
          'Verification is available for artists with record labels, agents, or applicable copyright protection',
          'Artists must provide proof of their professional status',
          'Verification is required to distribute protected music on the platform',
          'Self-published artists may use the platform without verification',
        ],
      },
      {
        subtitle: 'Verification Process',
        items: [
          'Submit verification request through your profile settings',
          'Provide record-label information, agent details, or copyright documentation',
          'Include links to your professional portfolio and social-media accounts',
          'Verification requests are reviewed within 5–7 business days',
        ],
      },
      {
        subtitle: 'Verification Benefits',
        items: [
          'Verified badge on your profile',
          'Copyright protection for your music',
          'Eligibility for featured-artist promotions',
        ],
      },
      {
        subtitle: 'Verification Policies',
        items: [
          'Verification status may be revoked for Terms-of-Service violations',
          'Rejected applications may be resubmitted after 72 hours',
          'False information in verification applications will result in permanent rejection',
          'Verification decisions are at Woodeng’s sole discretion',
        ],
      },
    ],
  },
  {
    title: '7. Liability and Warranties',
    content: [
      "The Platform is provided 'as is' without warranties of any kind",
      'Woo platform explicitly disclaims all responsibility for user-generated content',
      'Users are solely responsible for verifying rights to content they upload or use',
      'Woo platform is not liable for any disputes between users regarding content ownership',
      'We are not responsible for blockchain network issues',
      'Users are responsible for wallet security',
      'No liability for NFT or token value fluctuations',
      'Platform may experience technical interruptions',
      'Users agree to indemnify Woodeng against any claims related to their content or platform usage',
      'Woo platform bears no responsibility for the content of sound memes or music NFTs created by users',
    ],
  },
  {
    title: '8. Account Security',
    content: [
      'Users must secure their wallets',
      'Private keys are user responsibility',
      'Report unauthorised access immediately',
      'Enable additional security features when available',
    ],
  },
  {
    title: '9. Prohibited Activities',
    content: [
      'No unauthorised content reproduction',
      'No market manipulation',
      'No fraudulent activities',
      'No harmful technical interference',
      'No violation of others’ rights',
      'No creation of offensive or harmful memes',
      'No misuse of copyrighted material',
      'No attempts to withdraw locked liquidity from pools',
    ],
  },
  {
    title: '10. SPL404 Sound Meme Terms',
    content: [
      'SPL404 is a token standard for sound memes with tokenised ownership',
      'Creating a sound meme establishes a token with the specified supply',
      'Users can choose between liquidity pools or bonding curves for token pricing',
      'For liquidity pools, initial liquidity is locked in the smart contract and cannot be withdrawn',
      'For bonding curves, no initial liquidity is required, and price increases with each purchase',
      'Bonding-curve tokens automatically migrate to our WOO DEX when market cap reaches $44 000',
      'Token holders own a proportional share of the sound meme',
      'Tokens can be freely traded on the platform subject to the 0.3 % transaction fee',
      'Transaction fees are distributed to stakers in the Woodeng ecosystem',
      'Creators receive an initial allocation of tokens as specified during creation',
      'Token prices fluctuate based on market demand and trading activity',
      'Woo platform is not responsible for token price volatility or market conditions',
    ],
  },
  {
    title: '11. Termination',
    content: [
      'We may suspend accounts for violations',
      'Users can terminate at any time',
      'Some obligations survive termination',
      'NFT and token ownership persists post-termination',
    ],
  },
  {
    title: '12. Changes to Terms',
    content: [
      'Terms may be updated periodically',
      'Changes effective upon posting',
      'Continued use implies acceptance',
      'Users notified of major changes',
    ],
  },
];

/* ────────────────────────────────────────────
 *  Component
 * ──────────────────────────────────────────── */
export default function Terms() {
  const router = useRouter();

  const handleVerificationClick = () => router.push('/profile');

  return (
    <div className="py-12 space-y-12">
      {/* header */}
      <header className="text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Shield className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Terms of Service</h1>
        <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>

      {/* intro */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <p className="font-medium">Please read these terms carefully</p>
          </div>
          <p className="text-muted-foreground">
            These Terms govern your use of the Woo platform and outline your rights and obligations.
            By using Woodeng you agree to everything below.
          </p>
        </div>
      </div>

      {/* sections */}
      <div className="max-w-3xl mx-auto space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h2 id={`section-${idx + 1}`} className="text-2xl font-bold">
              {section.title}
            </h2>

            {section.content.map((entry, i) =>
              typeof entry === 'string' ? (
                /* simple paragraph bullet */
                <ul key={i} className="space-y-2">
                  <li className="flex items-start gap-3 text-muted-foreground">
                    <span className="select-none">•</span>
                    <span>{entry}</span>
                  </li>
                </ul>
              ) : (
                /* Bullet subsection card */
                <div
                  key={entry.subtitle}
                  className="bg-card border border-border rounded-lg p-6 space-y-4"
                >
                  <h4 className="font-semibold">{entry.subtitle}</h4>
                  <ul className="space-y-1">
                    {entry.items.map((text, j) => (
                      <li
                        key={j}
                        className="flex items-start gap-2 text-sm text-muted-foreground"
                      >
                        <span className="select-none">•</span>
                        <span>{text}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        ))}
      </div>

      {/* artist verification CTA */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-lg p-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-6 h-6 text-primary" />
            <h2 className="text-xl font-bold">Artist Verification</h2>
          </div>

          <p className="text-muted-foreground mb-6">
            If you’re an artist with professional representation, request verification before
            distributing protected music.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="bg-card border border-border rounded-lg p-4">
              <FileText className="w-4 h-4 text-primary mb-2" />
              <h3 className="font-medium mb-2">Required Documentation</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Record-label contract</li>
                <li>• Agent contact details</li>
                <li>• Copyright certificates</li>
                <li>• Portfolio / socials links</li>
              </ul>
            </div>

            <div className="bg-card border border-border rounded-lg p-4">
              <Music2 className="w-4 h-4 text-primary mb-2" />
              <h3 className="font-medium mb-2">Verification Benefits</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Verified badge</li>
                <li>• Copyright protection</li>
                <li>• Featured-artist spots</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleVerificationClick}
              className={cn(
                'px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors',
              )}
            >
              Request Verification
            </button>
          </div>
        </div>
      </div>

      {/* contact */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-xl font-bold mb-4">Questions about our Terms?</h2>
          <p className="text-muted-foreground mb-6">
            If you have any questions, please contact us.
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
