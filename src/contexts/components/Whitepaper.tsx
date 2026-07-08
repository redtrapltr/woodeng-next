'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search,
  Shield,
  Coins,
  ArrowRight,
  CheckCircle2,
  FileText,
  BarChart3,
  Users,
  User,
  Target,
  Trophy,
  ChevronRight,
  Sparkles,
  Zap,
  Globe,
  Calendar,
  Rocket,
  Lightbulb,
  AlertCircle,
  Lock,
  Unlock,
  Wallet,
  X,
  Layers,
  TrendingUp,
  PieChart,
  Calculator,
  Award,
  Building2,
  Palette,
} from 'lucide-react';



/**
 *  FULL-LENGTH WHITEPAPER COMPONENT
 *  (The markup is long, but Next.js is happy with large files.)
 */
export default function Whitepaper() {
  /* ─── any helper fns you need ─── */
  const copyToClipboard = (txt: string) => navigator.clipboard.writeText(txt);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Woodeng Ecosystem Whitepaper</h1>
      </div>

      {/* Table of Contents */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Table of Contents</h2>
        <ol className="space-y-2">
          {[
            "Executive Summary",
            "Project Overview",
            "Technical Specifications",
            "The SWL-444 Token Standard",
            "SWL-444 Token Lifecycle",
            "Diamond-Hand Holder Gate",
            "Market Analysis",
            "Woodeng Native Token",
            "Economic Model",
            "Staking",
            "Roadmap"
          ].map((item, index) => (
            <li key={index}>
              <a 
                href={`#section-${index + 1}`} 
                className="flex items-center gap-2 hover:text-primary transition-colors"
              >
                <span className="font-medium">{index + 1}.</span>
                <span>{item}</span>
              </a>
            </li>
          ))}
        </ol>
      </div>

      {/* Executive Summary */}
      <section id="section-1" className="space-y-6">
        <h2 className="text-3xl font-bold">1. Executive Summary</h2>
        <div className="bg-card border border-border rounded-lg p-6 space-y-8">
          <div className="space-y-4">
            <p className="text-lg text-muted-foreground leading-relaxed">
              Woodeng Ecosystem introduces <span className="font-semibold text-foreground">SWL-444</span>,
              a revolutionary token standard on Solana that merges the properties of fungible and non-fungible tokens.
              For the first time, creators can mint tokens that are both tradable like regular SPL tokens and carry
              rich metadata like NFTs — creating what we call "tokens with a soul."
            </p>

            <p className="text-muted-foreground">
              Built on Solana's high-performance blockchain, our platform empowers creators, investors, and communities
              through transparent, fair, and innovative infrastructure. Our implementation demonstrates the standard
              through SWL-444 tokens with built-in bonding curves, automated graduation to Meteora DAMM v2,
              diamond-hand holder verification, and Living Meme updatable metadata. The SWL-444 architecture is
              designed to support any type of metadata-rich digital asset.
            </p>
          </div>

          <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-6 rounded-lg border border-primary/10">
            <div className="flex items-start gap-4">
              <Lightbulb className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
              <div>
                <h3 className="font-semibold mb-2">The Breakthrough</h3>
                <p className="text-sm text-muted-foreground">
                  Traditional tokens force a choice: either fungible (tradable but generic) or non-fungible (unique but
                  illiquid). SWL-444 eliminates this trade-off, enabling fractional ownership of metadata-rich assets
                  with built-in liquidity, opening entirely new possibilities for digital content monetization and
                  distribution.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Layers,
                title: "SWL-444 Standard",
                description: "Hybrid tokens combining fungibility with rich on-chain metadata"
              },
              {
                icon: Rocket,
                title: "Extensible Platform",
                description: "Open architecture supporting audio, video, AI, gaming, and beyond"
              },
              {
                icon: Users,
                title: "Creator Economy",
                description: "Transparent revenue models and community-driven governance"
              }
            ].map((item, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-12 h-12 mx-auto bg-primary/10 rounded-full flex items-center justify-center">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="font-semibold">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-primary" />
                  Current Implementation
                </h4>
                <ul className="space-y-1 ml-7 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>SWL-444 tokens with bonding curves and Meteora graduation</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Diamond-hand holder gate for premium launches</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>WOODENG native token ecosystem</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  Future Horizons
                </h4>
                <ul className="space-y-1 ml-7 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Video content with embedded data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>AI models and training datasets</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Gaming assets and metaverse items</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Project Overview */}
      <section id="section-2" className="space-y-6">
        <h2 className="text-3xl font-bold">2. Project Overview</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-6 mb-8">
            <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-6 rounded-lg border border-primary/10">
              <p className="text-lg text-muted-foreground leading-relaxed">
                Woodeng Ecosystem is pioneering the next generation of blockchain-based digital assets through the
                <span className="font-semibold text-foreground"> SWL-444 token standard</span>. We're building an open,
                extensible platform that bridges the gap between fungible and non-fungible tokens, enabling creators
                to tokenize any type of content with rich metadata while maintaining the tradability and divisibility
                of standard tokens.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Vision</h3>
              </div>
              <p className="text-muted-foreground">
                Establish the foundational infrastructure for hybrid, metadata-rich tokens on Solana,
                empowering creators across all digital content verticals to innovate and monetize in ways
                previously impossible.
              </p>
              <ul className="space-y-2">
                {[
                  "Universal platform for hybrid tokens",
                  "Open standard for innovation",
                  "Creator-first ecosystem",
                  "Cross-vertical content marketplace"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Trophy className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Mission</h3>
              </div>
              <p className="text-muted-foreground">
                Build a sustainable, transparent ecosystem powered by the SWL-444 standard,
                demonstrating its capabilities through community-driven token launches while laying
                groundwork for future content types.
              </p>
              <ul className="space-y-2">
                {[
                  "Prove hybrid token utility",
                  "Fair revenue distribution",
                  "Transparent on-chain mechanics"
                ].map((item, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="w-4 h-4 text-primary" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Current Applications</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Our initial implementations focus on audio content, demonstrating the versatility and power
              of the SWL-444 standard while establishing proven use cases for future content types.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <h4 className="font-semibold">SWL-444 Tokens</h4>
                </div>
                <p className="text-muted-foreground mb-4">
                  The flagship implementation of SWL-444: community-driven tokens with exponential bonding curves,
                  automated graduation to Meteora DAMM v2 DEX, and permanently locked liquidity.
                </p>
                <ul className="space-y-2">
                  {[
                    "Exponential bonding curve pricing",
                    "Automated Meteora DAMM v2 graduation",
                    "Permanently locked liquidity (anti-rug)",
                    "Diamond-hand holder gate",
                    "On-chain metadata with Living Meme updates"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="mt-6 bg-primary/5 p-6 rounded-lg border border-primary/20">
              <div className="flex items-start gap-4">
                <Rocket className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-semibold">Extensible by Design</h4>
                  <p className="text-sm text-muted-foreground">
                    While SWL-444 tokens showcase our initial capabilities, the SWL-444 standard architecture
                    supports any media type or data structure. Future implementations could include video content,
                    AI models, gaming assets, interactive experiences, and more — all leveraging the same proven
                    infrastructure for metadata-rich, tradable tokens.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Technical Specifications */}
      <section id="section-3" className="space-y-6">
        <h2 className="text-3xl font-bold">3. Technical Specifications</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-6 rounded-lg border border-primary/10">
              <p className="text-muted-foreground">
                The Woodeng Ecosystem is built on a modern, scalable architecture designed to support the
                <span className="font-semibold text-foreground"> SWL-444 token standard</span> and enable
                extensibility for future content types and use cases. Our technical foundation prioritizes
                performance, security, and flexibility.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Blockchain Infrastructure</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Zap,
                    title: "Solana Blockchain",
                    description: "High-throughput, low-latency transactions enabling real-time trading and minting"
                  },
                  {
                    icon: Shield,
                    title: "Smart Contracts",
                    description: "Custom Solana programs for SWL-444 tokens, liquidity pools, and governance"
                  },
                  {
                    icon: Globe,
                    title: "Decentralized Storage",
                    description: "IPFS integration for immutable, permanent metadata and media storage"
                  }
                ].map((tech, index) => (
                  <div key={index} className="bg-muted/50 p-4 rounded-lg border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <tech.icon className="w-5 h-5 text-primary" />
                      </div>
                      <h4 className="font-medium">{tech.title}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">{tech.description}</p>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Token Standards</h3>
              <div className="space-y-4">
                <p className="text-muted-foreground">
                  Woodeng implements a hybrid approach to tokenization, combining traditional NFT standards
                  with the innovative SWL-444 standard for maximum flexibility and future compatibility.
                </p>

                <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-6 rounded-lg border border-primary/20">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Layers className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-lg mb-2">SWL-444: The Hybrid Standard</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Our flagship token standard merging fungibility with rich metadata capabilities,
                        enabling fractional ownership of content-rich assets with built-in liquidity.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="font-medium mb-3 text-sm">Core Features</h5>
                      <ul className="space-y-2">
                        {[
                          "Fungible token mechanics (SPL-compatible)",
                          "Rich on-chain metadata storage",
                          "Extensible data structures",
                          "Built-in liquidity pool support",
                          "Fractional ownership by default"
                        ].map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium mb-3 text-sm">Current Applications</h5>
                      <ul className="space-y-2">
                        {[
                          "SWL-444 Tokens: Community-driven tokens with bonding curves",
                          "Meteora DAMM v2: Graduated DEX liquidity",
                          "Diamond-hand gate: Holder verification",
                          "Future: Video, AI models, gaming assets"
                        ].map((item, index) => (
                          <li key={index} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Technical Architecture</h3>
              <p className="text-sm text-muted-foreground">
                Our modular architecture is designed for scalability, supporting current audio applications
                while remaining flexible enough to accommodate future content types and features.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Globe className="w-5 h-5 text-primary" />
                    Frontend Layer
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "React-based web application with TypeScript",
                      "Mobile-responsive, progressive web app",
                      "Solana wallet integration (Phantom, Solflare, etc.)",
                      "Optimized media streaming for audio/video",
                      "Real-time WebSocket connections",
                      "Woo Swap: Integrated token exchange",
                      "Woo Dex: Live trading charts and analytics"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Backend Infrastructure
                  </h4>
                  <ul className="space-y-2">
                    {[
                      "Supabase for database and authentication",
                      "Serverless edge functions",
                      "IPFS/Arweave for permanent storage",
                      "Solana RPC node infrastructure",
                      "Real-time indexing and caching",
                      "GraphQL API for efficient queries",
                      "Webhook handlers for blockchain events"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-primary/5 p-6 rounded-lg border border-primary/20 mt-4">
                <div className="flex items-start gap-4">
                  <Rocket className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                  <div className="space-y-2">
                    <h4 className="font-semibold">Extensibility Built-In</h4>
                    <p className="text-sm text-muted-foreground">
                      Our architecture separates content processing from token mechanics, allowing new media types
                      to be integrated without modifying core smart contracts. The SWL-444 standard's flexible
                      metadata structure means future implementations (video, AI models, etc.) can leverage
                      existing infrastructure with minimal changes. SWL-444 tokens are our first major implementation.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The SWL-444 Token Standard */}
      <section id="section-4" className="space-y-6">
        <h2 className="text-3xl font-bold">4. The SWL-444 Token Standard</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Bridging Fungible and Non-Fungible Tokens</h3>
              <p className="text-muted-foreground">
                Traditional crypto tokens fall into two distinct categories: fungible tokens like SPL tokens (e.g. $SOL, $USDC)
                that are interchangeable and divisible, and non-fungible tokens (NFTs) that represent unique items like art,
                music, and collectibles. Each category has served its purpose, but both have inherent limitations when it comes
                to modern use cases.
              </p>

              <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-6 rounded-lg border border-primary/10 my-6">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div className="space-y-3">
                    <h4 className="text-lg font-semibold">SWL-444: A Hybrid Token Standard</h4>
                    <p className="text-muted-foreground">
                      SWL-444 merges both worlds. It allows a single token type to carry rich metadata — sound, image, video,
                      AI data, or any other information — while still being tradable and divisible like a regular SPL token.
                    </p>
                    <p className="font-medium text-primary">
                      In short: it's a token with a soul — data attached directly on-chain.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Fungible</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Divisible and tradable like regular SPL tokens, enabling fractional ownership and seamless exchange.
                  </p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Metadata-Rich</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Carries comprehensive on-chain data including media files, attributes, and custom information.
                  </p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Composable</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Integrates seamlessly with existing Solana protocols and DeFi infrastructure.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Technical Foundation</h3>
              <p className="text-muted-foreground">
                Built on Solana's high-performance blockchain, SWL-444 leverages the network's speed and low transaction costs
                to enable a new generation of hybrid assets. The standard is designed to be extensible and future-proof,
                supporting various types of metadata and use cases beyond what we've implemented today.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-primary" />
                    Current Applications
                  </h4>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>SWL-444 Tokens: Community tokens with bonding curves and Meteora graduation</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Living Memes: Tokens with updatable on-chain metadata</span>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium flex items-center gap-2">
                    <Rocket className="w-5 h-5 text-primary" />
                    Future Possibilities
                  </h4>
                  <ul className="space-y-2 ml-7">
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Video content with embedded metadata</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>AI models and training data</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Interactive digital experiences</span>
                    </li>
                    <li className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>Gaming assets and in-game items</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-primary/5 p-6 rounded-lg border border-primary/20">
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                <div className="space-y-2">
                  <h4 className="font-semibold">Open-Ended Innovation</h4>
                  <p className="text-sm text-muted-foreground">
                    The SWL-444 standard is designed to evolve with the ecosystem. While SWL-444 tokens are our first major
                    implementation, the standard's architecture supports any type of metadata-rich, fungible asset.
                    We're building the infrastructure for tomorrow's digital assets, not just today's use cases.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SWL-444 Token Lifecycle */}
      <section id="section-5" className="space-y-6">
        <h2 className="text-3xl font-bold">5. SWL-444 Token Lifecycle</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <p className="text-muted-foreground">
              SWL-444 tokens follow a four-phase lifecycle from creation to fully decentralized trading on Meteora.
              Each phase has distinct mechanics, fee structures, and protections designed to ensure fair price
              discovery and anti-rug security.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Phase 1 — Creation</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Creator uploads content and sets token parameters",
                    "Fixed supply: 444,000,000 tokens per SWL-444",
                    "Quote pair: WOODENG or SOL",
                    "Optional: set diamond-hand gate (min_avg_hold_days)",
                    "No deployment fee (only gas)"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Phase 2 — Bonding Curve</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Exponential bonding curve: price rises from p0 to target",
                    "WOODENG pairs: target 0.1 WOODENG/token, ~1.4M WOODENG to graduate",
                    "SOL pairs: target ~0.000003 SOL/token, ~40 SOL to graduate",
                    "44M tokens sold through bonding (of 444M total)",
                    "Buy fees: 1.5% (0.5% creator + 1% stakers)",
                    "Early sell penalty: 10% (6% creator + 4% stakers)"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Phase 3 — AMM Pool</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Auto-flips to XYK AMM when bonding threshold reached",
                    "Meme tokens minted proportionally to vault balance",
                    "Trading fees: 0.3% (0.2% creator + 0.1% stakers)",
                    "Pool ready for graduation"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Rocket className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Phase 4 — Meteora Graduation</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Liquidity migrates to Meteora DAMM v2",
                    "Position permanently locked — nobody can withdraw (anti-rug)",
                    "Token tradeable on Birdeye, Jupiter, and all Solana DEX aggregators",
                    "Trading fees earned by Meteora liquidity providers"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="p-4 border border-primary/20 bg-primary/5 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-medium text-primary">Security: Permanently Locked Liquidity</h5>
                  <p className="text-sm text-muted-foreground mt-1">
                    After graduation, liquidity is permanently locked on Meteora DAMM v2. This is enforced
                    on-chain — no one, not even the token creator, can remove liquidity. This provides the same
                    anti-rug protection as pump.fun's locked LP approach.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Token Economics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h4 className="font-medium mb-4">Creator Benefits</h4>
                  <ul className="space-y-3">
                    {[
                      "Fee revenue during bonding and AMM phases",
                      "Price appreciation as demand increases",
                      "No ongoing management required",
                      "First purchase up to 1% of supply"
                    ].map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg">
                  <h4 className="font-medium mb-4">Collector Benefits</h4>
                  <ul className="space-y-3">
                    {[
                      "Low entry barrier (buy as few or as many tokens as desired)",
                      "Potential for value appreciation",
                      "Partial ownership of community tokens"
                    ].map((benefit, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5" />
                        <span>{benefit}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Diamond-Hand Holder Gate */}
      <section id="section-6" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">6. Diamond-Hand Holder Gate</h2>
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="space-y-8">
            <p className="text-muted-foreground">
              The Diamond-Hand Holder Gate is a unique feature that allows SWL-444 token creators to restrict
              bonding curve participation to proven long-term holders. This rewards loyal community members and
              prevents sniper bots from front-running launches.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Shield className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">HolderProfile Tracking</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "One PDA per wallet tracks time-weighted holdings",
                    "Tracks cumulative token-seconds across ALL SWL-444 tokens",
                    "Records current balance, total sold, and first buy timestamp",
                    "Permissionless sync via sync_holder_balance instruction"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Lock className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Gate Mechanics</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Creator sets min_avg_hold_days at token creation (0 = open to all)",
                    "Buyer's average hold time must exceed threshold",
                    "Formula: cumulative_token_seconds ÷ (current_balance + total_sold) ÷ 86400",
                    "Users who never sold: score = days since first purchase"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-muted/50 p-6 rounded-lg border border-border">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Award className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="font-semibold">Benefits</h4>
                </div>
                <ul className="space-y-2">
                  {[
                    "Rewards loyal community members with exclusive access",
                    "Prevents sniper bots and mercenary capital",
                    "Builds trust: only proven holders can participate",
                    "Creates demand for holding SWL-444 tokens long-term"
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">The diamond-hand gate is optional.</span> Creators
                  who set min_avg_hold_days to 0 allow anyone to participate in their bonding curve. The gate only
                  applies during the bonding phase — after graduation to Meteora, anyone can trade freely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

 {/* === Enhanced Market Analysis (no competitor table) === */}
<section id="section-7" className="space-y-6">
  <h2 className="text-3xl font-bold">7. Market Analysis</h2>

  <div className="bg-card border border-border rounded-lg p-6">
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Market Opportunity */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Market Opportunity</h3>
          <div className="space-y-4">
            {[
              { 
                metric: "USD 47.7B", 
                label: "Global NFT Market (2025)", 
                growth: ["+34% YoY (2024 → 2025)", "CAGR 2025 → 2034: 34.5%"]
              },  
              { 
                metric: "USD 3.72B", 
                label: "Global Music NFT Market (2025)", 
                growth: ["+29% YoY (2024 → 2025)", "CAGR 2025 → 2034: 28.8%"]
              }, 
              { 
                metric: "USD 1.42B", 
                label: "Royalty-Free Music NFT (2024)", 
                growth: ["+21.5% YoY (2024 → 2025)"]
              },
              { 
                metric: "USD 85B", 
                label: "Memecoin Market (2025)", 
                growth: ["+44% YoY (2024 → 2025)"]
              }  
            ].map((stat, index) => (
              <div key={index} className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-2xl font-bold text-primary">{stat.metric}</span>
                  <div className="flex flex-col text-right">
                    {Array.isArray(stat.growth) ? (
                      stat.growth.map((line, i) => (
                        <span key={i} className="text-sm text-green-500">{line}</span>
                      ))
                    ) : (
                      <span className="text-sm text-green-500">{stat.growth}</span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Industry Challenges */}
        <div>
          <h3 className="text-xl font-semibold mb-4">Industry Insights</h3>
          <div className="grid grid-cols-1 gap-4">
            {[
              {
                pain: "Artist Compensation",
                solution: "Direct monetization & instant on-chain payouts",
                explain: "Optimize value capture for creators without intermediaries (automatic splits).",
              },
              {
                pain: "Ownership Transparency",
                solution: "On-chain provenance & verifiable rights",
                explain: "Standardize metadata and proofs of origin to reduce rights disputes.",
              },
              {
              pain: "Fan Engagement",
              solution: "Token-gated access & collectible utilities",
              explain: "Exclusive access, perks, and gamified retention loops.",
              },
              {
              pain: "Technical Barriers",
              solution: "Frictionless UX on Solana (low fees, fast finality)",
              explain: "One-click flows (mint/list/buy), mobile-ready, with minimized costs.",
              },
            ].map((it, i) => (
              <div
                key={i}
                className="bg-muted/50 p-4 rounded-lg border border-border hover:border-primary/40 transition"
              >
                <div className="flex items-start gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-primary mt-0.5" />
                  <div>
                    <h4 className="font-medium">{it.pain}</h4>
                    <p className="text-xs text-muted-foreground">{it.explain}</p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <p className="font-medium">{it.solution}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ecosystem Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Segments distribution */}
        <div className="bg-muted/30 border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Ecosystem Snapshot — Segments</h3>
          </div>
          <ul className="space-y-3">
            {[
              { name: "Gaming NFTs", value: 38 },
              { name: "Art & Collectibles", value: 27 },
              { name: "Music NFTs", value: 12 },
              { name: "Memecoins (NFT-adjacent culture)", value: 15 },
              { name: "Other (Loyalty, Tickets, IP)", value: 8 }
            ].map((row, i) => (
              <li key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">{row.value}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-primary/80 rounded-full transition-all duration-500"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>      
        </div>

        {/* Chains distribution */}
        <div className="bg-muted/30 border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Ecosystem Snapshot — Chains</h3>
          </div>
          <ul className="space-y-3">
            {[
              { name: "Ethereum", value: 62, note: "Deep liquidity" },
              { name: "Solana", value: 26, note: "Low fees / speed" },
              { name: "Others (Polygon, BNB, etc.)", value: 12, note: "Scaling / niches" }
            ].map((row, i) => (
              <li key={i}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{row.name}</span>
                  <span className="text-muted-foreground">{row.value}%</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-primary/80 rounded-full transition-all duration-500"
                    style={{ width: `${row.value}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">{row.note}</div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2 mt-3">
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Low fees: Solana</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Deep liquidity: Ethereum</span>
            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">Scaling: L2 & sidechains</span>
          </div>
        </div>

        {/* Adoption signals */}
        <div className="bg-muted/30 border border-border rounded-lg p-5">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold">Adoption & Market Signals</h3>
          </div>

          <div className="space-y-3">
            {[
              { kpi: "Active collectors (est.)", value: "2.8M", trend: "YoY +" },
              { kpi: "Monthly unique buyers (est.)", value: "1.2M", trend: "YoY +" },
              { kpi: "Primary sales share", value: "≈ 40%", trend: "stable" },
              { kpi: "Secondary sales share", value: "≈ 60%", trend: "↑ liquidity" }
            ].map((k, i) => (
              <div
                key={i}
                className="flex items-center justify-between bg-background/60 rounded-md px-3 py-2 hover:bg-background transition"
              >
                <div className="text-sm">{k.kpi}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-primary">{k.value}</span>
                  <span className="text-xs text-green-500">{k.trend}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Creator revenue outlook</p>
              <p className="text-lg font-semibold">↑ Sustainable</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground">Regulatory trajectory</p>
              <p className="text-lg font-semibold">↔ Fragmented</p>
            </div>
          </div>
        </div>
      </div>

      {/* Go-to-Market Signals */}
      <div className="bg-muted/20 border border-border rounded-lg p-5">
        <h3 className="text-xl font-semibold mb-4">Go-to-Market Signals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: "Creator-first Economics",
              bullets: [
                "Automated on-chain royalty routing",
                "Zero deployment costs for artists",
                "Transparent splits & payouts"
              ]
            },
            {
              title: "Frictionless UX",
              bullets: [
                "One-click mint & list",
                "Mobile-ready flows",
                "Low fees (Solana) and fast settlement"
              ]
            },
            {
              title: "Community Flywheel",
              bullets: [
                "Token-gated access & perks",
                "Collect-to-earn engagement loops",
                "Curated drops & contests"
              ]
            }
          ].map((col, i) => (
            <div
              key={i}
              className="rounded-lg bg-background/70 border border-border p-4 hover:shadow-md hover:border-primary/40 transition"
            >
              <h4 className="font-medium mb-2">{col.title}</h4>
              <ul className="text-sm space-y-1 list-disc list-inside text-muted-foreground">
                {col.bullets.map((b, j) => (<li key={j}>{b}</li>))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
</section>



      {/* Woodeng Native Token */}
      <section id="section-8" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">8. Woodeng Native Token</h2>
        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-xl p-8 w-full">
          <div className="space-y-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-primary/20 rounded-full">
                <Coins className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-2xl font-bold">$WOODENG Token</h3>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
              <div className="bg-card border border-border rounded-lg p-6 space-y-4">
                <h3 className="text-xl font-semibold mb-2">Token Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground">Token Name</h4>
                    <p className="font-medium mt-auto">Woodeng</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground">Symbol</h4>
                    <p className="font-medium mt-auto">$WOODENG</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground">Blockchain</h4>
                    <p className="font-medium mt-auto">Solana</p>
                  </div>
                  <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                    <h4 className="text-sm font-medium text-muted-foreground">Token Type</h4>
                    <p className="font-medium mt-auto">SPL Token</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="font-medium">Contract Address:</span>
                  </div>
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <div className="font-mono text-xs text-primary break-all">
                      83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                      <h4 className="text-sm font-medium text-muted-foreground">Total Supply</h4>
                      <p className="font-medium mt-auto">1,000,000,000</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                      <h4 className="text-sm font-medium text-muted-foreground">Transaction Tax</h4>
                      <p className="font-medium mt-auto">0%</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                      <h4 className="text-sm font-medium text-muted-foreground">Liquidity</h4>
                      <p className="font-medium mt-auto">Burnt</p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col h-full">
                      <h4 className="text-sm font-medium text-muted-foreground">Ownership Status</h4>
                      <p className="font-medium mt-auto">Mint & Authority Revoked</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Token Distribution */}
            <div className="space-y-4 mt-8">
              <h3 className="text-xl font-semibold">Token Distribution</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Layers className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Distribution Breakdown</h4>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "Ecosystem", value: "56%", description: "Ecosystem supply" },
                      { label: "Team", value: "4%", description: "Core team allocation" },
                      { label: "Development & Marketing", value: "19%", description: "Platform growth and partnerships" },
                      { label: "Liquidity Provision", value: "21%", description: "DEX liquidity and trading" }
                    ].map((item, index) => (
                      <div key={index} className="bg-muted/50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{item.label}</span>
                          <span className="font-bold text-primary">{item.value}</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Coins className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Token Utility</h4>
                  </div>
                  <div className="space-y-3">
                    {[
                      { title: "Platform Currency", description: "Native token for all ecosystem transactions" },
                      { title: "Staking Rewards", description: "Earn passive income from platform revenue" },
                      { title: "Access Control", description: "Unlock premium features and exclusive content" }
                    ].map((utility, index) => (
                      <div key={index} className="bg-muted/50 p-3 rounded-lg">
                        <h5 className="font-medium mb-1">{utility.title}</h5>
                        <p className="text-sm text-muted-foreground">{utility.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Token Distribution Wallets */}
            <div className="space-y-4 mt-8">
              <h3 className="text-xl font-semibold">Token Distribution Wallets</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
                <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Users className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Team Wallets (4%)</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 1:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">DtZ4teD54FNtr6xYcjNWdWVrt8F2sEdYSnCHVtjSqs58</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 2:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">CwcF6ca7XznU83D5KR8iVN1mAQtQSVLNeDxXfvXRfVp4</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Rocket className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Development Wallet (19%)</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Multisig Wallet:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">2SUKCvy2HU4j7238UCQoANSgGf5y5k6f6ryv9vdTe3gh</span>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Wallet className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Creator Wallet</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Creator Wallet:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">G1euAuDWQ82S4ZxdgwHoxMrvtpHMjAcjnTLhZpfWtuSD</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            

            {/* Token Verification */}
            <div className="space-y-4 mt-8">
              <h3 className="text-xl font-semibold">Token Verification</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-8">
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                  <h4 className="text-lg font-semibold">Smart Contract Audit</h4>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <a 
                    href="https://coinsult.net/projects/woodeng/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-90 transition-opacity"
                  >
                    <img 
                      src="https://i.postimg.cc/B6Fgqb00/audit-by-coinsult.png" 
                      alt="Audited by Coinsult" 
                      className="h-16 object-contain"
                    />
                  </a>
                  <p className="text-sm text-muted-foreground text-center">
                    The Woodeng token smart contract has been thoroughly audited by Coinsult, 
                    ensuring security and reliability.
                  </p>
                  <a 
                    href="https://coinsult.net/projects/woodeng/" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View Audit Report</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                  <h4 className="text-lg font-semibold">KYC Verification</h4>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <a 
                    href="https://pinksale.notion.site/Woodeng-KYC-Verification-133d7dc69b3e802da597e608ecb353ac" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-90 transition-opacity"
                  >
                    <img 
                      src="https://i.postimg.cc/YST0wfkd/pinksale-white-removebg-preview.png" 
                      alt="KYC Verified by PinkSale" 
                      className="h-16 object-contain"
                    />
                  </a>
                  <p className="text-sm text-muted-foreground text-center">
                    The Woodeng team has completed KYC verification, demonstrating commitment 
                    to transparency and accountability.
                  </p>
                  <a 
                    href="https://pinksale.notion.site/Woodeng-KYC-Verification-133d7dc69b3e802da597e608ecb353ac" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View KYC Verification</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
              
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="w-6 h-6 text-primary" />
                  <h4 className="text-lg font-semibold">Solscan</h4>
                </div>
                <div className="flex flex-col items-center gap-4">
                  <a 
                    href="https://solscan.io/token/83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="hover:opacity-90 transition-opacity"
                  >
                    <img 
                      src="https://i.postimg.cc/sDVLQWsT/solscan.png" 
                      alt="Solscan" 
                      className="h-16 object-contain"
                    />
                  </a>
                  <p className="text-sm text-muted-foreground text-center">
                    View the Woodeng token on Solscan for complete transparency of all transactions 
                    and contract details.
                  </p>
                  <a 
                    href="https://solscan.io/token/83zcTaQRqL1s3PxBRdGVkee9PiGLVP6JXg3oLVF6eAR5" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-primary hover:underline flex items-center gap-1"
                  >
                    <span>View on Solscan</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Economic Model */}
      <section id="section-9" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">9. Economic Model</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            {/* Circularity of Fees */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Circularity of Fees</h3>
              </div>

              <p className="text-base text-muted-foreground">
                Our economic model is built on a circular fee structure that ensures value flows between all participants in the ecosystem, creating a sustainable and balanced economy.
              </p>

              {/* Key Stakeholders */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Creators</p>
                  <p className="text-xs text-muted-foreground mt-1">Content producers</p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Layers className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Platform</p>
                  <p className="text-xs text-muted-foreground mt-1">Woodeng Ecosystem</p>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Coins className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Token Holders</p>
                  <p className="text-xs text-muted-foreground mt-1">$WOODENG stakers</p>
                </div>
              </div>

              {/* SWL-444 Tokens with Bonding Curve — full width */}
              <div className="bg-muted/50 p-5 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <BarChart3 className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-base font-medium">SWL-444 Tokens with Bonding Curve</h4>
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    SWL-444 tokens with exponential bonding curve, Meteora DAMM v2 graduation, and permanently locked liquidity.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {[
                      "No deployment fee (only gas fees)",
                      "Bonding buy fees: 1.5% (0.5% to Creator, 1% to $WOODENG Stakers)",
                      "Early sell penalty: 10% (6% to Creator, 4% to $WOODENG Stakers)",
                      "AMM fees after flip: 0.3% (0.2% to Creator, 0.1% to $WOODENG Stakers)",
                      "After Meteora graduation: trading fees go to Meteora LP, not to our program",
                      "WOODENG or SOL pairing options",
                      "Creator may make the first purchase up to 1% of total supply"
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Revenue Sources */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Coins className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Revenue Sources</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Creator Revenue */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Creator Revenue</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Liquidity Revenue</h5>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.5% on bonding curve buys</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>6% on bonding early sells</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.2% on AMM swaps (pre-graduation)</span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h5 className="text-sm font-medium mb-2">Variable Revenue</h5>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>Potential gains from price appreciation in automated market maker (AMM) pools</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Woodeng Holders Revenue */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Woodeng Holders Revenue</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">SWL-444 Token Transactions</h5>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>1% on bonding curve buys (100% to $WOODENG Stakers)</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>4% on bonding early sells (100% to $WOODENG Stakers)</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.1% on AMM swaps pre-graduation (100% to $WOODENG Stakers)</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      After graduation to Meteora DAMM v2, trading fees are earned by Meteora liquidity providers.
                      Staking rewards come only from pre-graduation activity.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Economic Viability */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold">Economic Viability</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-base font-medium mb-3">Sustainable Growth Model</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Our economic model ensures long-term sustainability through multiple revenue streams and balanced distribution:
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Multiple revenue sources create stability",
                      "Fair fee structure benefits all parties",
                      "Low operational costs on Solana",
                      "Continuous platform development"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-base font-medium mb-3">Market Efficiency</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Our platform optimizes market dynamics for all participants:
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Automated price discovery mechanisms",
                      "Reduced transaction costs",
                      "Transparent fee structure",
                      "Balanced creator and platform rewards"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-base font-medium mb-3">Long-term Value</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    Our ecosystem is designed for sustainable long-term growth:
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Staking rewards incentivize holding",
                      "Platform fees distributed to token holders",
                      "Continuous development and innovation",
                      "Expanding use cases for $WOODENG"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="text-base font-medium mb-3">Technical Specifications</h4>
                  <ul className="space-y-2">
                    {[
                      "Built on Solana blockchain for fast, low-cost transactions",
                      "Smart contracts for secure, automated transactions",
                      "Decentralized storage for content via IPFS",
                      "SWL-444 token standard with bonding curves",
                      "Automated graduation to Meteora DAMM v2",
                      "Diamond-hand holder gate for premium launches",
                      "Woo Swap for seamless token swaps directly within the platform",
                      "Woo Dex for advanced DEX visualization with real-time price charts"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Staking */}
      <section id="section-10" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">10. Staking</h2>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 p-6 rounded-lg border border-primary/10">
              <p className="text-muted-foreground">
                The Woodeng staking mechanism provides WOODENG token holders with passive income opportunities
                while contributing to platform stability and growth. Our staking system is designed to reward
                long-term commitment while maintaining flexibility for users.
              </p>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                Staking Mechanism
              </h3>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Fixed Staking</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "Lock period: 3 months / 6 months / 1 year",
                      "Yield bonus based on lock duration",
                      "WOODENG & SOL rewards",
                      "Claiming rewards available"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Unlock className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="font-semibold">Flexible Staking</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "30-day minimum staking period for rewards",
                      "10% penalty on early withdrawal",
                      "Stake and unstake at any time",
                      "WOODENG & SOL rewards",
                      "Claiming rewards available"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                Yield Bonus (Platform Performance)
              </h3>

              <div className="grid md:grid-cols-3 gap-6">
                {[
                  { period: "3 Months Lock", bonus: "Up to 30%", color: "from-blue-500/10 to-cyan-500/10" },
                  { period: "6 Months Lock", bonus: "Up to 80%", color: "from-purple-500/10 to-pink-500/10" },
                  { period: "1 Year Lock", bonus: "Up to 200%", color: "from-orange-500/10 to-red-500/10" }
                ].map((tier, index) => (
                  <div key={index} className={`bg-gradient-to-br ${tier.color} p-6 rounded-lg border border-primary/20`}>
                    <div className="text-center space-y-3">
                      <h4 className="font-semibold">{tier.period}</h4>
                      <div className="text-3xl font-bold text-primary">{tier.bonus}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Coins className="w-5 h-5 text-primary" />
                </div>
                Reward Sources
              </h3>

              <p className="text-sm text-muted-foreground">
                Staking rewards are funded by multiple revenue streams from platform activity.
                <span className="font-semibold text-foreground"> 100% of collected fees are distributed to $WOODENG Holders.</span>
              </p>

              <div className="grid md:grid-cols-1 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Coins className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold">SWL-444 Token Revenue</h4>
                  </div>
                  <ul className="space-y-3">
                    <li className="space-y-1">
                      <div className="flex items-start gap-2 text-sm font-medium">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Bonding Curve Buys: 1% to $WOODENG Stakers</span>
                      </div>
                    </li>
                    <li className="space-y-1">
                      <div className="flex items-start gap-2 text-sm font-medium">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>Bonding Early Sells: 4% to $WOODENG Stakers</span>
                      </div>
                    </li>
                    <li className="space-y-1">
                      <div className="flex items-start gap-2 text-sm font-medium">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>AMM Swaps (pre-graduation): 0.1% to $WOODENG Stakers</span>
                      </div>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-4">
                    After graduation to Meteora, trading fees go to Meteora LPs. Staking rewards are funded by pre-graduation trading activity only.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <PieChart className="w-5 h-5 text-primary" />
                </div>
                Reward Distribution
              </h3>

              <p className="text-sm text-muted-foreground">
                Rewards are distributed proportionally based on staking participation and platform activity:
              </p>

              <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-6 rounded-lg border border-primary/20">
                <h4 className="font-semibold mb-4 flex items-center gap-2">
                  <Calculator className="w-5 h-5 text-primary" />
                  Distribution Formula
                </h4>
                <div className="space-y-3">
                  <div className="bg-background p-4 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Fixed Staking:</div>
                    <div className="font-mono text-sm">
                      User Reward = ((User Stake / Total Staked) × Pool Rewards × Time Factor) + Yield Bonus
                    </div>
                  </div>
                  <div className="bg-background p-4 rounded-lg border border-border">
                    <div className="text-xs text-muted-foreground mb-1">Flexible Staking:</div>
                    <div className="font-mono text-sm">
                      User Reward = (User Stake / Total Staked) × Pool Rewards × Time Factor
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mt-4">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <h4 className="font-semibold mb-2">WOODENG Rewards</h4>
                  <p className="text-sm text-muted-foreground">
                    Distributed based on WOODENG pool activity and platform fees collected in WOODENG tokens.
                  </p>
                </div>
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <h4 className="font-semibold mb-2">SOL Rewards</h4>
                  <p className="text-sm text-muted-foreground">
                    Distributed based on SOL pool activity and platform fees collected in SOL tokens.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-semibold flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Award className="w-5 h-5 text-primary" />
                </div>
                Economic Benefits
              </h3>

              <div className="grid md:grid-cols-3 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Users className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold">For Token Holders</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "Passive income generation",
                      "Platform governance participation",
                      "Reduced token circulation",
                      "Long-term value appreciation"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Building2 className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold">For the Platform</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "Increased token utility",
                      "Enhanced ecosystem stability",
                      "Community engagement",
                      "Sustainable tokenomics"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="bg-muted/50 p-6 rounded-lg border border-border">
                  <div className="flex items-center gap-3 mb-4">
                    <Palette className="w-5 h-5 text-primary" />
                    <h4 className="font-semibold">For Creators</h4>
                  </div>
                  <ul className="space-y-2">
                    {[
                      "Stable platform ecosystem",
                      "Increased token demand",
                      "Community support",
                      "Long-term sustainability"
                    ].map((item, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Future Roadmap */}
      <section id="section-11" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">11. Roadmap</h2>
        
        {/* Development Milestones / Current Roadmap */}
      <section id="section-7-milestones" className="space-y-6 w-full">
        <h3 className="text-2xl font-bold">Development Milestones</h3>
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="space-y-4">
            {[
              {
                milestone: "Q4 2024: Foundation",
                description: "Initial foundation",
                items: [
                  "Website v1",
                  "Whitepaper V1",
                  "Social Media",
                  "Pinkasle Presale",
                  "Smart contract Audit",
                  "KYC",
                  "Launch of Woodeng Native token on Solana Blockchain",
                  "Marketing Launch Campaign & Listings",
                  "Woodeng Ecosystem Development",
                  "First NFT Collection"
                ]
              },
              {
                milestone: "Q1 2025: Platform & New Brand",
                description: "Reborn",
                items: [
                  "Plateform interface creation",
                  "Multi Minter development",
                  "Trade Liquidity Pools Development",
                  "White Paper V2",
                  "Website V2",
                  "SWL-444 Token Standard Integration",
                  "Marketing Campaign"
                ]
              },
              {
                milestone: "Q2 2025: Advanced Features",
                description: "Enhanced platform capabilities",
                items: [
                  "Development Of Woo Platform Features",
                  "User Accounts & Community Utility",
                  "Economic model Integration",
                  "Staking revenue feature",
                  "Decentralized Storage Integration",
                  "Responsive development"
                ]
              },
              {
                milestone: "Q3 2025: Platform Deployment",
                description: "Woodeng Ecosystem Live",
                items: [
                  "Woodeng Platform V1 live",
                  "First SWL-444 Token Launches",
                  "Meteora DAMM v2 Graduation Integration",
                  "Diamond-Hand Holder Gate",
                  "Ambassors emboarding",
                  "NFT Airdrop Campaign",
                  "Marketing Campaign"
                ]
              },
              {
                milestone: "Q4 2025: Expansion",
                description: "Woodeng Ecosystem Exposure",
                items: [
                  "Core platform expansion",
                  "Artist verification system",
                  "Multi Cryptocurrencies support",
                  "First major artist & creator partnerships"
                ]
              },
              {
                milestone: "2026: Ecosystem Growth",
                description: "Ecosystem Growth",
                items: [
                  "Developer API and SDK",
                  "Mobile application development",
                  "Revenue Dashboard Release",
                  "Advanced royalty distribution",
                  "Enhanced analytics dashboard",
                  "Investment coverage integration"
                ]
              },
               {
                milestone: "2027: Industry Integration",
                description: "Mass Evolution",
                items: [
                  "Major label partnerships",
                  "Cross-chain integration",
                  "Live event integration",
                  "Metaverse presence",
                  "Global expansion"
                ]
              }
            ].map((item, index) => (
              <div key={index} className="bg-muted/50 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <Calendar className="w-5 h-5 text-primary" />
                  <h4 className="font-medium">{item.milestone}</h4>
                </div>
                <p className="text-muted-foreground mb-3">{item.description}</p>
                <ul className="space-y-2">
                  {item.items.map((subitem, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      <span>{subitem}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

        <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-lg p-6 mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Lightbulb className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-semibold">Long-term Vision</h3>
          </div>
          <p className="text-muted-foreground mb-4">
            Our ultimate goal is to bring a different approach to Web3, DeFi, and creator economy by creating an ecosystem that is fairer, more transparent and more focused on creators and users. We envision a future where creators have complete control over their work and can build direct and meaningful relationships with their fans.
          </p>
          <p className="text-muted-foreground">
            Through continuous innovation and community-driven development, the Woo platform aims to become an alternative decentralised space where creators and users benefit equally.
          </p>
        </div>
      </section>
    </div>
  );
}