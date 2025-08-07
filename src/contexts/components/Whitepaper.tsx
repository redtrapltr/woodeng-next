'use client';

import React from 'react';
import Link from 'next/link';
import {
  Search, Shield, Coins, ArrowRight, CheckCircle2, FileText, BarChart3,
  Music2, Users, User, Target, Trophy, ChevronRight, Sparkles, Zap, Globe,
  Calendar, Rocket, Lightbulb, AlertCircle, Lock, Wallet, X, Layers
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 *  FULL-LENGTH WHITEPAPER COMPONENT
 *  (The markup is long, but Next.js is happy with large files.)
 */
export default function Whitepaper() {
  /* ─── any helper fns you need ─── */
  const copyToClipboard = (txt: string) => navigator.clipboard.writeText(txt);

  /* ─── the entire design you pasted lives INSIDE this return ─── */
  return (<div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
      {/* Header */}
      <div className="text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Woodeng Ecosystem Whitepaper</h1>
        <p className="text-xl text-muted-foreground">
          Revolutionizing the Future of Music
        </p>
      </div>

      {/* Table of Contents */}
      <div className="bg-card border border-border rounded-lg p-6">
        <h2 className="text-xl font-bold mb-4">Table of Contents</h2>
        <ol className="space-y-2">
          {[
            "Executive Summary",
            "Project Overview",
            "Technical Specifications",
            "SPL404 Sound Memes",
            "Music NFTs",
            "Market Analysis",
            "Woodeng Native Token",
            "Economic Model",
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
        <div className="bg-card border border-border rounded-lg p-6 space-y-6">
          <p className="text-muted-foreground">
            Woodeng Ecosystem is a decentralized platform that empowers artists and fans through blockchain technology.
            Our mission is to create a transparent, fair, and innovative ecosystem for music creation,
            distribution, and monetization. By leveraging the Solana blockchain, we provide a high-performance,
            low-cost solution for music NFTs and sound memes.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Music2,
                title: "Music NFTs",
                description: "Revolutionary digital assets representing music ownership"
              },
              {
                icon: Users,
                title: "Community",
                description: "Vibrant ecosystem of artists and collectors"
              },
              {
                icon: Shield,
                title: "Security",
                description: "Blockchain-powered rights management"
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
        </div>
      </section>

      {/* Project Overview */}
      <section id="section-2" className="space-y-6">
        <h2 className="text-3xl font-bold">2. Project Overview</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Vision</h3>
              </div>
              <p className="text-muted-foreground">
                To become the leading platform for music NFTs, creating new opportunities
                for artists to monetize their work and connect with fans.
              </p>
              <ul className="space-y-2">
                {[
                  "Global music NFT marketplace",
                  "Artist empowerment platform",
                  "Fan engagement hub"
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
                Build a sustainable ecosystem that benefits all participants while pushing
                the boundaries of music ownership and distribution.
              </p>
              <ul className="space-y-2">
                {[
                  "Fair revenue distribution",
                  "Transparent royalty system",
                  "Community governance"
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
            <h3 className="text-xl font-semibold mb-4">Key Offerings</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Music2 className="w-6 h-6 text-primary" />
                  <h4 className="font-semibold">Music NFTs</h4>
                </div>
                <p className="text-muted-foreground mb-4">
                  Full-featured music NFT platform allowing artists to create, sell, and distribute
                  their music directly to fans with automated royalty distribution.
                </p>
                <ul className="space-y-2">
                  {[
                    "Single tracks and album bundles",
                    "Automated market makers",
                    "Customizable royalty settings",
                    "Secondary market support",
                    "Exclusive content options"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                  <h4 className="font-semibold">Sound Memes</h4>
                </div>
                <p className="text-muted-foreground mb-4">
                  Innovative SPL404 NFT platform for creating and trading viral sound memes with
                  tokenized ownership and liquidity pools.
                </p>
                <ul className="space-y-2">
                  {[
                    "Tokenized ownership",
                    "Locker Smart contract",
                    "Viral distribution mechanisms",
                    "Low barrier to entry"
                  ].map((item, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <ChevronRight className="w-4 h-4 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
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
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Blockchain Infrastructure</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    icon: Zap,
                    title: "Solana Blockchain",
                    description: "High-performance, low-cost transactions with fast finality"
                  },
                  {
                    icon: Shield,
                    title: "Smart Contracts",
                    description: "Secure contracts for NFT minting and trading"
                  },
                  {
                    icon: Globe,
                    title: "Decentralized Storage",
                    description: "IPFS-based content storage for permanence and reliability"
                  }
                ].map((tech, index) => (
                  <div key={index} className="bg-muted/50 p-4 rounded-lg">
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
              <h3 className="text-xl font-semibold">NFT Standards</h3>
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="space-y-4">
                  <p className="text-muted-foreground">
                    Woodeng implements custom NFT standards optimized for music and audio content:
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-2">Music NFT Standard</h4>
                      <ul className="space-y-2">
                        {[
                          "Extended metadata for music-specific attributes",
                          "Multi-tier royalty distribution",
                          "Bundle support for albums and collections"
                        ].map((item, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2">Sound Meme Standard</h4>
                      <ul className="space-y-2">
                        {[
                          "Tokenized ownership model",
                          "Viral distribution mechanisms",
                          "Simplified metadata structure"
                        ].map((item, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 text-primary" />
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
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div>
                    <h4 className="font-medium mb-3">Frontend</h4>
                    <ul className="space-y-2">
                      {[
                        "React-based web application",
                        "Mobile-responsive design",
                        "Progressive web app capabilities",
                        "WebRTC for real-time features",
                        "Optimized media streaming",
                        "Woo Swap for seamless token swaps directly within the platform",
                        "Woo Dex for advanced DEX visualization with real-time price charts"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="w-4 h-4 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-3">Backend</h4>
                    <ul className="space-y-2">
                      {[
                        "Serverless architecture",
                        "GraphQL API for efficient data fetching",
                        "IPFS integration for decentralized storage",
                        "Solana program integration",
                        "Real-time indexing and search"
                      ].map((item, index) => (
                        <li key={index} className="flex items-center gap-2 text-sm">
                          <ChevronRight className="w-4 h-4 text-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SPL404 Sound Memes */}
      <section id="section-4" className="space-y-6">
        <h2 className="text-3xl font-bold">4. SPL404 Sound Memes</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">SPL404 Token Standard</h3>
              <p className="text-muted-foreground">
                SPL404 is our innovative token standard built on Solana, specifically designed for sound memes. 
                It enables tokenized ownership of NFTs, allowing multiple users to own portions of the same 
                digital asset through tokens.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h4 className="font-medium mb-4">Key Features</h4>
                  <ul className="space-y-3">
                    {[
                      "Tokenized ownership instead of single-owner NFTs",
                      "Built-in liquidity pools for instant trading",
                      "Lower entry barrier with partial ownership",
                      "Viral distribution mechanisms",
                      "Automated price discovery"
                    ].map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h4 className="font-medium mb-4">Technical Advantages</h4>
                  <ul className="space-y-3">
                    {[
                      "Solana's high throughput enables low-cost token transfers",
                      "Smart contract security with locked liquidity",
                      "Metadata-rich token standard",
                      "Composable with other Solana protocols",
                      "Efficient on-chain token distribution"
                    ].map((advantage, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="w-4 h-4 text-primary mt-0.5" />
                        <span>{advantage}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            
            {/* SPL404 Architecture Diagram */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">SPL404 Architecture</h3>
              <p className="text-muted-foreground mb-6">
                The SPL404 standard implements a unique architecture that combines NFT ownership with tokenized distribution.
                Below is a diagram explaining the flow from creation to trading:
              </p>
              
              <div className="bg-muted/50 p-6 rounded-lg">
                <div className="relative">
                  {/* Step 1: Creation */}
                  <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Wallet className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center mt-2">
                      <h4 className="font-medium">1. Creation</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Artist uploads sound meme and sets token parameters
                      </p>
                    </div>
                  </div>
                  
                  {/* Arrow Down */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -mt-8">
                    <div className="h-8 w-0.5 bg-primary mx-auto"></div>
                    <div className="w-3 h-3 border-r-2 border-b-2 border-primary transform rotate-45 mx-auto"></div>
                  </div>
                  
                  {/* Step 2: Minting */}
                  <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Sparkles className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center mt-2">
                      <h4 className="font-medium">2. Minting</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        SPL404 NFT is minted with specified token supply
                      </p>
                    </div>
                  </div>
                  
                  {/* Arrow Down */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -mt-8">
                    <div className="h-8 w-0.5 bg-primary mx-auto"></div>
                    <div className="w-3 h-3 border-r-2 border-b-2 border-primary transform rotate-45 mx-auto"></div>
                  </div>
                  
                  {/* Step 3: Smart Contract */}
                  <div className="flex flex-col items-center mb-12">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Lock className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center mt-2">
                      <h4 className="font-medium">3. Smart Contract Locker</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tokens are locked in smart contract with initial liquidity
                      </p>
                    </div>
                  </div>
                  
                  {/* Arrow Down */}
                  <div className="absolute left-1/2 transform -translate-x-1/2 -mt-8">
                    <div className="h-8 w-0.5 bg-primary mx-auto"></div>
                    <div className="w-3 h-3 border-r-2 border-b-2 border-primary transform rotate-45 mx-auto"></div>
                  </div>
                  
                  {/* Step 4: Deployment */}
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                      <Rocket className="w-8 h-8 text-primary" />
                    </div>
                    <div className="text-center mt-2">
                      <h4 className="font-medium">4. Deployment</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Tokens become available for trading with locked liquidity
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Important Note */}
                <div className="mt-8 p-4 border border-primary/20 bg-primary/5 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <h5 className="font-medium text-primary">Important Security Feature</h5>
                      <p className="text-sm text-muted-foreground mt-1">
                        Liquidity cannot be removed from the pool after deployment. This prevents rug pulls and ensures 
                        that all tokens remain tradeable, protecting both creators and collectors.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Token Economics */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">Token Economics</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-muted/50 p-6 rounded-lg">
                  <h4 className="font-medium mb-4">Creator Benefits</h4>
                  <ul className="space-y-3">
                    {[
                      "Price appreciation as demand increases",
                      "No ongoing royalty management required",
                      "Secure deployment"
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
                      "Partial ownership of viral content"
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
            
            {/* Use Cases */}
            <div className="space-y-4">
              <h3 className="text-xl font-semibold">SPL404 Use Cases</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                  {
                    title: "Viral Sound Clips",
                    description: "Short, catchy audio clips that can spread virally across social media"
                  },
                  {
                    title: "Meme Culture",
                    description: "Audio memes that capture internet culture moments and trends"
                  },
                  {
                    title: "Artist Snippets",
                    description: "Short samples or teasers from established artists to promote full releases"
                  }
                ].map((useCase, index) => (
                  <div key={index} className="bg-muted/50 p-4 rounded-lg">
                    <h4 className="font-medium mb-2">{useCase.title}</h4>
                    <p className="text-sm text-muted-foreground">{useCase.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Music NFTs */}
      <section id="section-5" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">5. Music NFTs</h2>
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[
              {
                icon: Music2,
                title: "Unique Digital Assets",
                description: "Blockchain-verified ownership of musical works",
                features: [
                  "High-quality audio formats",
                  "Decentralized storage",
                  "Verifiable authenticity"
                ]
              },
              {
                icon: Coins,
                title: "Artist Empowerment",
                description: "Direct monetization without intermediaries",
                features: [
                  "No platform deployment fees",
                  "Transparent revenue",
                  "Instant payouts"
                ]
              },
              {
                icon: Users,
                title: "Fan Engagement",
                description: "New ways for fans to support artists",
                features: [
                  "Direct artist support",
                  "Exclusive content access",
                  "Investment opportunities"
                ]
              }
            ].map((card, index) => (
              <div key={index} className="bg-muted/50 p-6 rounded-lg hover:bg-muted/70 transition-all duration-300">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <card.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                  </div>
                </div>
                <ul className="space-y-2">
                  {card.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
            <div className="bg-muted/50 p-6 rounded-lg hover:bg-muted/70 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <Music2 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">Royalty-Based NFTs</h3>
                  <p className="text-sm text-muted-foreground">Traditional royalty model with secondary sales revenue</p>
                </div>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Up to 15% royalties on resales</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>80% to creator, 20% to token holders</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Fixed pricing model</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>No initial liquidity required</span>
                </li>
              </ul>
            </div>
            
            <div className="bg-muted/50 p-6 rounded-lg hover:bg-muted/70 transition-all duration-300">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">AMM Pool NFTs</h3>
                  <p className="text-sm text-muted-foreground">Dynamic pricing with automated market maker</p>
                </div>
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Automated price discovery</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Benefit from price appreciation</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Initial liquidity required</span>
                </li>
                <li className="flex items-center gap-2 text-sm">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full"></span>
                  <span>Supply and demand based pricing</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="mt-8 bg-primary/5 border border-primary/20 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-semibold mb-2">Minting Process</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    { step: "Upload", desc: "Audio & artwork" },
                    { step: "Configure", desc: "Set parameters" },
                    { step: "Choose Model", desc: "Royalty or AMM" },
                    { step: "Mint", desc: "Deploy to blockchain" }
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                        {i+1}
                      </div>
                      <div className="text-sm">
                        <p className="font-medium">{step.step}</p>
                        <p className="text-muted-foreground">{step.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Market Analysis */}
      <section id="section-6" className="space-y-6">
        <h2 className="text-3xl font-bold">6. Market Analysis</h2>
        <div className="bg-card border border-border rounded-lg p-6">
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h3 className="text-xl font-semibold mb-4">Market Opportunity</h3>
                <div className="space-y-4">
                  {[
                    {
                      metric: "$22.5B",
                      label: "Global NFT Market",
                      growth: "+127% YoY"
                    },
                    {
                      metric: "$5.2B",
                      label: "Music NFT Segment",
                      growth: "+215% YoY"
                    },
                    {
                      metric: "2.8M",
                      label: "Active Collectors",
                      growth: "+85% YoY"
                    }
                  ].map((stat, index) => (
                    <div key={index} className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-2xl font-bold text-primary">{stat.metric}</span>
                        <span className="text-sm text-green-500">{stat.growth}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-xl font-semibold mb-4">Industry Challenges</h3>
                <div className="space-y-4">
                  {[
                    {
                      challenge: "Artist Compensation",
                      solution: "Direct monetization and fair royalty distribution"
                    },
                    {
                      challenge: "Ownership Transparency",
                      solution: "Blockchain-verified ownership and provenance"
                    },
                    {
                      challenge: "Fan Engagement",
                      solution: "Direct artist-fan relationships and exclusive content"
                    },
                    {
                      challenge: "Technical Barriers",
                      solution: "User-friendly platform with low entry barriers"
                    }
                  ].map((item, index) => (
                    <div key={index} className="bg-muted/50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-1">
                        <AlertCircle className="w-4 h-4 text-primary" />
                        <h4 className="font-medium">{item.challenge}</h4>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <p>{item.solution}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <div>
              <h3 className="text-xl font-semibold mb-4">Competitive Landscape</h3>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="py-3 px-4 text-left">Feature</th>
                      <th className="py-3 px-4 text-center">Woo</th>
                      <th className="py-3 px-4 text-center">Sound.xyz</th>
                      <th className="py-3 px-4 text-center">PumpFun</th>
                      <th className="py-3 px-4 text-center">Audius</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      {   
                        feature: "Zero Deployment costs",
                        woo: true,
                        compA: false,
                        compB: true,
                        compC: false
                      },
                      {
                        feature: "Music NFTs",
                        woo: true,
                        compA: true,
                        compB: false,
                        compC: false
                      },
                      {
                        feature: "Sound Memes",
                        woo: true,
                        compA: false,
                        compB: false,
                        compC: false
                      },
                      {
                        feature: "Tokenized Ownership",
                        woo: true,
                        compA: false,
                        compB: false,
                        compC: false
                      },
                      {
                        feature: "Automated Royalties",
                        woo: true,
                        compA: true,
                        compB: true,
                        compC: true
                      },
                      {
                        feature: "Low Transaction Fees",
                        woo: true,
                        compA: false,
                        compB: true,
                        compC: true
                      }
                    ].map((row, index) => (
                      <tr key={index} className="border-b border-border">
                        <td className="py-3 px-4">{row.feature}</td>
                        <td className="py-3 px-4 text-center">
                          {row.woo ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.compA ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.compB ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {row.compC ? <CheckCircle2 className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-red-500 mx-auto" />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Woodeng Native Token */}
      <section id="section-7" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">7. Woodeng Native Token</h2>
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
                      { label: "Ecosystem", value: "53%", description: "Platform development and rewards" },
                      { label: "Team", value: "8%", description: "Core team allocation" },
                      { label: "Development & Marketing", value: "18%", description: "Platform growth and partnerships" },
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
                    <h4 className="font-semibold">Team Wallets (8%)</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 1:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">C39kidEviBHX9KEgdFcJhuCq6cVkXsnFWgTRtXwDZ1p4</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 2:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">8BSenySKrt6GgZ41sEmEmXgxpYVyWqwritj5JbftFidn</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 3:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">DtZ4teD54FNtr6xYcjNWdWVrt8F2sEdYSnCHVtjSqs58</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 4:</span>
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
                    <h4 className="font-semibold">Development Wallets (18%)</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 1:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">D7CxjW737TjNbigtVUTovq7wGMvThf1AJKu6bd7VKAk</span>
                      </p>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg">
                      <p className="font-mono text-xs break-all">
                        <span className="block mb-2 text-sm font-medium text-primary">Wallet 2:</span>
                        <span className="block overflow-x-auto whitespace-nowrap">J65nfjoufAqVKysRd8SLkc18AbF1TGDCqNodUVSpuGBw</span>
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

      {/* Implementation Strategy */}
      <section id="section-8" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">8. Economic Model</h2>
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
                {/* Creators */}
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <User className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Creators</p>
                  <p className="text-xs text-muted-foreground mt-1">Content producers</p>
                </div>
                
                {/* Platform */}
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Music2 className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Platform</p>
                  <p className="text-xs text-muted-foreground mt-1">Woodeng Ecosystem</p>
                </div>
                
                {/* Token Holders */}
                <div className="bg-muted/50 p-6 rounded-lg text-center">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-2">
                    <Coins className="w-8 h-8 text-primary" />
                  </div>
                  <p className="font-medium">Token Holders</p>
                  <p className="text-xs text-muted-foreground mt-1">$WOODENG stakers</p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                {/* Music NFTs Without AMM */}
                <div className="bg-muted/50 p-5 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Music2 className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-base font-medium">Music NFTs (Without AMM)</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Traditional NFTs with royalties for secondary sales.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>No deployment fee (only gas fees)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>Primary sale: 80% to Creator, 20% to $WOODENG Holders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>Secondary royalties (up to 15%): 80% to original Creator, 20% to $WOODENG Holders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>WOODENG or SOL pairing options</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Music NFTs With AMM */}
                <div className="bg-muted/50 p-5 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Music2 className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-base font-medium">Music NFTs (With AMM)</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Music NFTs with integrated Automated Market Maker for dynamic pricing.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>No deployment fee (only gas fees)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>Sale split: 80% to original Creator, 20% to $WOODENG Holders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>Creators benefit from price appreciation as NFTs are purchased</span>
                      </div>
                       <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>WOODENG or SOL pairing options</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sound Memes with Liquidity */}
                <div className="bg-muted/50 p-5 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Sparkles className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-base font-medium">Sound Memes with Liquidity</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      SPL404 tokenized NFTs with liquidity pools for immediate trading.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>No deployment fee (only gas fees)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>0.3% transaction fee: 0.2% to Creator, 0.1% to $WOODENG Holders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>WOODENG or SOL pairing options with permanently locked liquidity</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Sound Memes with Bonding Curve */}
                <div className="bg-muted/50 p-5 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <BarChart3 className="w-5 h-5 text-primary" />
                    </div>
                    <h4 className="text-base font-medium">Sound Memes with Bonding Curve</h4>
                  </div>
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      SPL404 tokenized NFTs with bonding curve for price discovery.
                    </p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>No deployment fee (only gas fees)</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>1.5% transaction fee: 0.5% to Creator, 1% to $WOODENG Holders</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>Fees change to 0.3% after $44K market cap (0.2% to Creator, 0.1% to $WOODENG Holders)</span>  
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                        <span>WOODENG or SOL pairing options with permanently locked liquidity</span>
                      </div>
                    </div>
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
              
              {/* Revenue Sections - Side by Side */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Creator Revenue */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Creator Revenue</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Primary Revenue</h5>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>80% of initial Music NFT sales</span>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium mb-2">Secondary Revenue</h5>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>80% of royalties on resales (capped at 15%)</span>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium mb-2">Liquidity Revenue</h5>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.2% on Sound Meme transactions</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.5% on pre-migration transactions (bonding curve)</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.2% on post-migration transactions (bonding curve)</span>
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
                
                {/* Platform Revenue */}
                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-3">Woodeng Holders Revenue</h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="text-sm font-medium mb-2">Music NFT Primary Sales</h5>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>20% of sale (100% to $WOODENG Holders)</span>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium mb-2">Music NFT Secondary Royalties</h5>
                      <div className="flex items-start gap-2 text-sm">
                        <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                        <span>20% of royalties up to 15% (100% to $WOODENG Holders)</span>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium mb-2">Sound Meme Transactions</h5>
                      <div className="space-y-2">
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.1% on liquidity transactions (100% to $WOODENG Holders)</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>1% on pre-migration bonding curve (100% to $WOODENG Holders)</span>
                        </div>
                        <div className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5"></span>
                          <span>0.1% on post-migration bonding curve (100% to $WOODENG Holders)</span>
                        </div>
                      </div>
                    </div>
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
                      "SPL404 token standard for sound memes",
                      "Automated Market Makers (AMM) for NFT liquidity",
                      "Bonding curves for tokenized sound memes",
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

      {/* Future Roadmap */}
      <section id="section-9" className="space-y-6 w-full">
        <h2 className="text-3xl font-bold">9. Roadmap</h2>
        
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
                  "Sound Memes SPL404 NFT Integration",
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
                  "First Sound Memes Launch",
                  "Ambassors emboarding",
                  "NFT Airdrop Campaign",
                  "Marketing Campaign"
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
        
        <div className="bg-card border border-border rounded-lg p-6 w-full">
          <div className="space-y-8">
            <div className="relative">
              <div className="absolute left-8 top-8 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-12">
                {[
                  {
                    year: "2025",
                    title: "Platform Launch & Expansion",
                    items: [
                      "Core platform launch",
                      "Artist verification system",
                      "Multi Cryptocurrencies support",
                      "First major artist & creator partnerships"
                    ]
                  },
                  {
                    year: "2026",
                    title: "Ecosystem Growth",
                    items: [
                      "Developer API and SDK",
                      "Mobile application development",
                      "Revenue Dashboard Release",
                      "Advanced royalty distribution",
                      "Enhanced analytics dashboard"
                    ]
                  },
                  {
                    year: "2027",
                    title: "Industry Integration",
                    items: [
                      "Major label partnerships",
                      "Cross-chain integration",
                      "Live event integration",
                      "Metaverse presence",
                      "Global expansion"
                    ]
                  }
                ].map((phase, index) => (
                  <div key={index} className="relative pl-16">
                    <div className="absolute left-0 top-0 w-16 h-16 flex items-center justify-center">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center z-10">
                        <Rocket className="w-4 h-4 text-primary-foreground" />
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-primary font-medium">{phase.year}</div>
                      <h3 className="text-xl font-semibold mb-3">{phase.title}</h3>
                      <ul className="space-y-2">
                        {phase.items.map((item, i) => (
                          <li key={i} className="flex items-center gap-2 text-muted-foreground">
                            <ChevronRight className="w-4 h-4 text-primary" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gradient-to-r from-primary/10 via-secondary/10 to-primary/10 rounded-lg p-6 mt-8">
              <div className="flex items-center gap-3 mb-4">
                <Lightbulb className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-semibold">Long-term Vision</h3>
              </div> 
              <p className="text-muted-foreground mb-4">
               Our ultimate goal is to bring a different approach to the music, Web3 and meme industries by creating an ecosystem that is fairer, more transparent and more focused on creators and users. We envision a future where creators have complete control over their work and can build direct and meaningful relationships with their fans.
              </p>
              <p className="text-muted-foreground">
               Through continuous innovation and community-driven development, the Woo platform aims to become an alternative decentralised space where creators and users benefit equally.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
