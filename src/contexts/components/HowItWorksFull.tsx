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

export default function HowItWorksFull() {
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
      benefits: ['Unique digital assets', 'Trading opportunities', 'Exclusive content access'],
    },
    {
      title: 'For Woodeng Holders',
      icon: Coins,
      benefits: ['Revenue sharing from platform fees', 'Staking rewards', 'Exclusive features'],
    },
  ];

  return (
    <div className="py-12 space-y-24">
      {/* Hero Section */}
      <section className="text-center space-y-8">
        <div className="space-y-6">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Rocket className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold">How Woodeng Ecosystem Works</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Discover how Woo platform revolutionizes music NFTs and sound memes through innovative technology and fair economics
          </p>
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/mint"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors flex items-center gap-2"
          >
            Start Creating
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/faq" className="px-6 py-3 bg-card hover:bg-muted border border-border rounded-full transition-colors">
            Learn More
          </Link>
        </div>
      </section>

      {/* Flow Diagram */}
      <section className="relative">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="relative">
          <h2 className="text-3xl font-bold text-center mb-12">Platform Flow</h2>
          <div className="grid md:grid-cols-4 gap-6">
            {flowSteps.map((step, index) => (
              <div key={index} className="relative h-full">
                <div className={cn('bg-gradient-to-r p-[2px] rounded-lg h-full', step.color)}>
                  <div className="bg-card rounded-lg p-6 h-full">
                    <div className="flex flex-col items-center text-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <step.icon className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="text-sm text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                </div>
                {index < flowSteps.length - 1 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-primary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stakeholder Benefits */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-12">Platform Benefits</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {stakeholderBenefits.map((role, index) => (
            <div key={index} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <role.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">{role.title}</h3>
              </div>
              <ul className="space-y-3">
                {role.benefits.map((benefit, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* NFT Types Comparison */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center mb-8">Circularity of Fees</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {/* Music NFTs Without AMM */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Music2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Music NFTs (Without AMM)</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                Traditional NFTs representing full ownership of a music piece with royalties for secondary sales.
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>No deployment Fee (only gas fees)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Primary sale: 80% to Creator, 20% to $WOODENG Holders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Secondary royalties (up to 15%): 80% to original Creator, 20% to $WOODENG Holders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Fixed pricing model</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Music NFTs With AMM */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Music2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Music NFTs (With AMM)</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Music NFTs with integrated Automated Market Maker for dynamic pricing and liquidity.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>No deployment Fee (only gas fees)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Sale split: 80% to original Creator, 20% to $WOODENG Holders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Open trading with dynamic pricing</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Automated price discovery</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sound Memes with Liquidity */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Sound Memes with Liquidity</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">SPL404 tokenized NFTs with liquidity pools for immediate trading in WOODENG or SOL.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>No deployment Fee (only gas fees)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.3% transaction Fee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.2% to the Sound Meme Creator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.1% to $WOODENG Holders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>WOODENG or SOL pairing options</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>Permanently locked liquidity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Sound Memes with Bonding Curve */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ChartLine className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Sound Memes with Bonding Curve</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">SPL404 tokenized NFTs with bonding curve for price discovery in WOODENG or SOL.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span>No deployment Fee (only gas fees)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>1.5% transaction Fee</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>1% to the $WOODENG Holders</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.5% to the Sound Meme Creator</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>No initial deposit required</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary mt-1" />
                    <span>
                      Fees change after migration at $44K market cap:
                      <ul className="ml-6 mt-1 space-y-1 list-disc">
                        <li>0.3% Fee per transaction</li>
                        <li>0.2% to the Sound Meme Creator</li>
                        <li>0.1% to the $WOODENG Holders</li>
                      </ul>
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>Permanently locked liquidity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Creator Benefits Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center mb-8">Creator Advantages & Revenue</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Music2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Music NFT Creator Benefits</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Maximize your earnings and reach as a music creator on our platform.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Revenue Streams</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>80% of primary sales revenue</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>80% of secondary sales royalties (up to 15%)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>AMM pool price appreciation benefits</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Sound Meme Creator Benefits</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Turn viral sounds into sustainable revenue streams with SPL404 tokenization.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Revenue Streams</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.2% of all liquidity pool transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.5% of bonding curve transactions (pre-migration)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.2% of bonding curve transactions (post-migration)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Woo Staking Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center mb-8">Woo Staking</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Coins className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Staking Rewards</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Earn passive income by staking your WOODENG tokens and receive rewards from platform activity.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Earn both WOODENG and SOL rewards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Two staking options</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>30-day flexible (10% penalty under this period)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Lock period (3 months, 6 months or 1 year) and yield bonus</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Rewards from platform fees and transaction activity</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Repeat className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Reward Distribution</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Transparent and fair distribution of platform fees to WOODENG stakers.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Distribution Sources</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>20% of Music NFT primary sales</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>20% of Music NFT secondary royalties (up to 15%)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.1% from Sound Meme liquidity transactions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>1% from Sound Meme bonding curve transactions (pre-migration)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>0.1% from Sound Meme bonding curve transactions (post-migration)</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Woo Tools Section */}
      <section className="space-y-8">
        <h2 className="text-3xl font-bold text-center mb-8">Integrated Trading Tools</h2>
        <div className="grid md:grid-cols-2 gap-8">
          {/* Woo Swap */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <ArrowUpDown className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Woo Swap</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Our integrated token swap interface for seamless trading directly within the platform.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Instant token swaps without leaving the platform</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Support for WOODENG and SOL pairings</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Optimized routing for best prices</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Low slippage and fast execution</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Woo Dex */}
          <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-primary/10 rounded-lg">
                <BarChart className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Woo Dex</h3>
            </div>
            <div className="space-y-4">
              <p className="text-muted-foreground">Advanced DEX visualization tool for monitoring market activity and trading opportunities.</p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Key Features</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Real-time price charts and market data</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Detailed trading volume analytics</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Liquidity pool monitoring</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary" />
                    <span>Token pair performance tracking</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Liquidity Locking Section */}
      <section className="bg-card border border-border rounded-lg p-8">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Lock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Liquidity Locking Policy</h2>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-base">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>All liquidity is permanently locked in our Smart Contract Locker</span>
              </li>
              <li className="flex items-start gap-3 text-base">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>No possibility of withdrawal</span>
              </li>
              <li className="flex items-start gap-3 text-base">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>Users may voluntarily add additional liquidity at any time</span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security Features */}
      <section>
        <h2 className="text-3xl font-bold text-center mb-12">Platform Security</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            {
              icon: Lock,
              title: 'Smart Contracts',
              description: 'Secure smart contracts handle all transactions and royalty distributions',
            },
            {
              icon: Users,
              title: 'Decentralized Storage',
              description: 'Content stored on IPFS ensuring permanent availability and integrity',
            },
            {
              icon: Shield,
              title: 'Automated Payments',
              description: 'Instant and secure payment processing with claimed fee distribution',
            },
            {
              icon: Wallet,
              title: 'Secure Wallet Connection',
              description: 'Industry-standard portfolio connection protocol and enhanced security measures',
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
              description: 'Advanced measures to prevent bot manipulation and protect fair market dynamics',
            },
          ].map((feature, index) => (
            <div key={index} className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
              <div className="p-3 bg-primary/10 rounded-lg w-fit mb-4">
                <feature.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
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
            <Link href="/mint" className="px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors">
              Start Creating
            </Link>
            <Link href="/faq" className="px-6 py-3 bg-card hover:bg-muted border border-border rounded-full transition-colors">
              Learn More
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
