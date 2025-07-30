'use client';

import React from 'react';
import Link from 'next/link';
import {
  Music2,
  Coins,
  ArrowRight,
  Crown,
  Sparkles,
  Users,
  Rocket,
  Zap,
  Repeat,
  BarChart3,
  Lock,
  Wallet,
  Shield,
  LineChart as ChartLine,
  CheckCircle2,
  BarChart,
  ArrowUpDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  FULL-LENGTH “HOW IT WORKS” PAGE-LEVEL COMPONENT                    */
/* ------------------------------------------------------------------ */
export default function HowItWorksFull() {
  /* ─────────── Static Data ─────────── */
  const flowSteps = [
    {
      title: 'Connect Wallet',
      icon: Wallet,
      description: 'Connect your wallet to start creating or collecting NFTs',
      color: 'from-primary/20 to-primary/10',
    },
    {
      title: 'Create & Mint',
      icon: Music2,
      description: 'Upload your music or sound meme and mint your NFT',
      color: 'from-primary/20 to-secondary/10',
    },
    {
      title: 'Set Pools',
      icon: BarChart3,
      description: 'Define pricing, royalties, and pool parameters',
      color: 'from-secondary/20 to-primary/10',
    },
    {
      title: 'Launch & Trade',
      icon: Rocket,
      description: 'Your NFT is live and ready for trading',
      color: 'from-primary/20 to-secondary/10',
    },
  ];

  const stakeholderBenefits = [
    {
      title: 'For Creators & Users',
      icon: Crown,
      benefits: [
        'Direct monetization of music and memes',
        'Automatic royalty distribution',
        'Community building tools',
      ],
    },
    {
      title: 'For Collectors',
      icon: Users,
      benefits: [
        'Unique digital assets',
        'Trading opportunities',
        'Exclusive content access',
      ],
    },
    {
      title: 'For Woodeng Holders',
      icon: Coins,
      benefits: [
        'Revenue sharing from platform fees',
        'Staking rewards',
        'Exclusive features',
      ],
    },
  ];

  /* ─────────── Render ─────────── */
  return (
    <div className="py-12 space-y-24">
      {/* ═════════════════ HERO ═════════════════ */}
      <section className="text-center space-y-8">
        <div className="space-y-6">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">
            How Woodeng Ecosystem Works
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover how Woo platform revolutionizes music NFTs and sound memes
            through innovative technology and fair economics
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/create"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            Start Creating
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/faq"
            className="px-6 py-3 bg-card hover:bg-muted border border-border rounded-full transition-colors"
          >
            Learn More
          </Link>
        </div>
      </section>

      {/* ═════════════════ FLOW DIAGRAM ═════════════════ */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Flow</h2>

          <div className="grid md:grid-cols-4 gap-6">
            {flowSteps.map((step, idx) => (
              <div key={idx} className="relative h-full">
                <div
                  className={cn(
                    'bg-gradient-to-r p-[2px] rounded-lg h-full',
                    step.color,
                  )}
                >
                  <div className="bg-card rounded-lg p-6 h-full">
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                {idx < flowSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═════════════════ STAKEHOLDER BENEFITS ═════════════════ */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-12">
          Platform Benefits
        </h2>

        <div className="grid md:grid-cols-3 gap-8">
          {stakeholderBenefits.map((role, idx) => (
            <div
              key={idx}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <role.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{role.title}</h3>
              </div>

              <ul className="space-y-3">
                {role.benefits.map((b, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════ CIRCULARITY OF FEES ═════════════════ */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center mb-8">
          Circularity of Fees
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* MUSIC NFT – NO AMM */}
          <FeeCard
            title="Music NFTs (Without AMM)"
            icon={Music2}
            points={[
              'No deployment Fee (only gas fees)',
              'Primary sale: 80% to Creator, 20% to $WOODENG Holders',
              'Secondary royalties (up to 15%): 80% to original Creator, 20% to $WOODENG Holders',
              'Fixed pricing model',
            ]}
          />

          {/* MUSIC NFT – WITH AMM */}
          <FeeCard
            title="Music NFTs (With AMM)"
            icon={Music2}
            points={[
              'No deployment Fee (only gas fees)',
              'Sale split: 80% to original Creator, 20% to $WOODENG Holders',
              'Open trading with dynamic pricing',
              'Automated price discovery',
            ]}
          />

          {/* SOUND MEME – XYK */}
          <FeeCard
            title="Sound Memes with Liquidity"
            icon={Sparkles}
            points={[
              'No deployment Fee (only gas fees)',
              '0.3% transaction Fee',
              '0.2% to the Sound Meme Creator',
              '0.1% to $WOODENG Holders',
              'WOODENG or SOL pairing options',
              'Permanently locked liquidity',
            ]}
          />

          {/* SOUND MEME – BONDING */}
          <FeeCard
            title="Sound Memes with Bonding Curve"
            icon={ChartLine}
            points={[
              'No deployment Fee (only gas fees)',
              '1.5% transaction Fee',
              '1% to the $WOODENG Holders',
              '0.5% to the Sound Meme Creator',
              'No initial deposit required',
              'Fees drop to 0.3 % / 0.2 % / 0.1 % after $44 k mcap',
              'Permanently locked liquidity',
            ]}
          />
        </div>
      </section>

      {/* ═════════════════ CREATOR ADVANTAGES ═════════════════ */}
      <TwoColSection
        title="Creator Advantages & Revenue"
        items={[
          {
            cardTitle: 'Music NFT Creator Benefits',
            icon: Music2,
            desc:
              'Maximize your earnings and reach as a music creator on our platform.',
            bullets: [
              '80% of primary sales revenue',
              '80% of secondary sales royalties (up to 15%)',
              'AMM pool price appreciation benefits',
            ],
          },
          {
            cardTitle: 'Sound Meme Creator Benefits',
            icon: Zap,
            desc:
              'Turn viral sounds into sustainable revenue streams with SPL404 tokenization.',
            bullets: [
              '0.2% of all liquidity pool transactions',
              '0.5% of bonding curve transactions (pre-migration)',
              '0.2% of bonding curve transactions (post-migration)',
            ],
          },
        ]}
      />

      {/* ═════════════════ WOO STAKING ═════════════════ */}
      <TwoColSection
        title="Woo Staking"
        items={[
          {
            cardTitle: 'Staking Rewards',
            icon: Coins,
            desc:
              'Earn passive income by staking your WOODENG tokens and receive rewards from platform activity.',
            bullets: [
              'Earn both WOODENG and SOL rewards',
              'No mandatory lock period',
              '30-day reward claim period (10 % penalty under this period)',
              'Rewards from platform fees and transaction activity',
            ],
          },
          {
            cardTitle: 'Reward Distribution',
            icon: Repeat,
            desc:
              'Transparent and fair distribution of platform fees to WOODENG stakers.',
            bullets: [
              '20% of Music NFT primary sales',
              '20% of Music NFT secondary royalties (up to 15%)',
              '0.1% from Sound Meme liquidity transactions',
              '1% from Sound Meme bonding curve transactions (pre-migration)',
              '0.1% from Sound Meme bonding curve transactions (post-migration)',
            ],
          },
        ]}
      />

      {/* ═════════════════ WOO TOOLS ═════════════════ */}
      <TwoColSection
        title="Integrated Trading Tools"
        items={[
          {
            cardTitle: 'Woo Swap',
            icon: ArrowUpDown,
            desc:
              'Our integrated token swap interface for seamless trading directly within the platform.',
            bullets: [
              'Instant token swaps without leaving the platform',
              'Support for WOODENG and SOL pairings',
              'Optimized routing for best prices',
              'Low slippage and fast execution',
            ],
          },
          {
            cardTitle: 'Woo Dex',
            icon: BarChart,
            desc:
              'Advanced DEX visualization tool for monitoring market activity and trading opportunities.',
            bullets: [
              'Real-time price charts and market data',
              'Detailed trading volume analytics',
              'Liquidity pool monitoring',
              'Token pair performance tracking',
            ],
          },
        ]}
      />

      {/* ═════════════════ LIQUIDITY LOCKING ═════════════════ */}
      <section className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Liquidity Locking Policy</h2>
            <ul className="space-y-4">
              {[
                'All liquidity is permanently locked in our Smart Contract Locker',
                'No possibility of withdrawal',
                'Users may voluntarily add additional liquidity at any time',
              ].map((t, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 text-base leading-snug"
                >
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ═════════════════ SECURITY FEATURES ═════════════════ */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-12">
          Platform Security
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Lock,
              title: 'Smart Contracts',
              description:
                'Secure smart contracts handle all transactions and royalty distributions',
            },
            {
              icon: Users,
              title: 'Decentralized Storage',
              description:
                'Content stored on IPFS ensuring permanent availability and integrity',
            },
            {
              icon: Shield,
              title: 'Automated Payments',
              description:
                'Instant and secure payment processing with claimed fee distribution',
            },
            {
              icon: Wallet,
              title: 'Secure Wallet Connection',
              description:
                'Industry-standard portfolio connection protocol and enhanced security measures',
            },
            {
              icon: Lock,
              title: 'Smart Contract Locker',
              description:
                'Permanent liquidity locking mechanism with no withdrawal possibility, ensuring long-term stability',
            },
            {
              icon: Shield,
              title: 'Anti-Sniper Protection',
              description:
                'Advanced measures to prevent bot manipulation and protect fair market dynamics',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
            >
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <f.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
              <p className="text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═════════════════ CTA ═════════════════ */}
      <section className="text-center">
        <div className="space-y-6">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-3xl font-bold">Ready to Get Started?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Join the next generation of music NFTs and Sound Memes on Woodeng
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
               href="/create"
              className="px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              Start Creating
            </Link>
            <Link
              href="/faq"
              className="px-6 py-3 bg-card hover:bg-muted border border-border rounded-full transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small helper components                                            */
/* ------------------------------------------------------------------ */

type FeeCardProps = {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  points: string[];
};
function FeeCard({ title, icon: Icon, points }: FeeCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Icon className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-xl font-semibold">{title}</h3>
      </div>
      <div className="space-y-4">
        <p className="text-muted-foreground">
          {title.includes('Sound')
            ? title.includes('Bonding')
              ? 'SPL404 tokenized NFTs with bonding curve for price discovery in WOODENG or SOL.'
              : 'SPL404 tokenized NFTs with liquidity pools for immediate trading in WOODENG or SOL.'
            : title.includes('With AMM')
            ? 'Music NFTs with integrated Automated Market Maker for dynamic pricing and liquidity.'
            : 'Traditional NFTs representing full ownership of a music piece with royalties for secondary sales.'}
        </p>

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2">Key Features</h4>
          <ul className="space-y-2 text-sm">
            {points.map((p, i) => (
              <li key={i} className="flex items-center gap-2">
                {p.startsWith('0.') || p.startsWith('1') ? (
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                ) : (
                  <Sparkles className="w-4 h-4 text-primary" />
                )}
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

type TwoColSectionItem = {
  cardTitle: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  bullets: string[];
};

function TwoColSection({
  title,
  items,
}: {
  title: string;
  items: TwoColSectionItem[];
}) {
  return (
    <section className="space-y-8">
      <h2 className="text-3xl font-bold text-center mb-8">{title}</h2>
      <div className="grid md:grid-cols-2 gap-8">
        {items.map((it, idx) => (
          <div
            key={idx}
            className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <it.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">{it.cardTitle}</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">{it.desc}</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  {it.bullets.map((b, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
