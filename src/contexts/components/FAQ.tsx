'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/* ──────────────────────────────────────────
   TYPES
────────────────────────────────────────── */
type QA       = { q: string; a: string };
type Category = { title: string; questions: QA[] };

/* ──────────────────────────────────────────
   FULL FAQ DATA  (unchanged wording)
────────────────────────────────────────── */
const faqCategories: Category[] = [
  {
    title: 'Getting Started',
    questions: [
      {
        q: 'What is Woo?',
        a:
          'Woo is a decentralized platform that enables creators to create, sell, and distribute their music as NFTs and sound memes on the Solana blockchain. We provide tools for artists to monetize their work directly while giving fans new ways to support and connect with their favorite creators through blockchain technology and fair economics.',
      },
      {
        q: 'How do I create an account?',
        a:
          "To create an account, you'll need a compatible crypto wallet (like Phantom). Click the 'Connect Wallet' button, and you're ready to start using Woo. The entire process takes less than a minute.",
      },
      {
        q: 'What cryptocurrencies are supported?',
        a:
          'We use our native token Woodeng and Solana for all transactions on the platform. Woodeng is built on the Solana blockchain, providing fast and low-cost transactions for our users.',
      },
      {
        q: 'What makes Woodeng different from other music platforms?',
        a:
          'Woodeng revolutionizes music distribution through blockchain technology, offering both Music NFTs and SPL404 Sound Memes. Our platform features automated market makers (AMM) for dynamic pricing, permanently locked liquidity, and a fair revenue distribution model that benefits creators, token holders, and the ecosystem.',
      },
    ],
  },
  {
    title: 'Music NFTs',
    questions: [
      {
        q: 'What is a music NFT?',
        a:
          'A music NFT is a unique digital asset that represents ownership of a piece of music on the blockchain. It can include the audio file, artwork, and exclusive perks defined by the artist. On Woo, music NFTs can be created with either fixed pricing and royalties or with automated market makers (AMM) for dynamic pricing.',
      },
      {
        q: 'How do I create a music NFT?',
        a:
          "After connecting your wallet, go to the 'Create' section, select 'Music NFT', upload your audio file and artwork, set your pricing in Woodeng tokens or SOL, choose between royalties or AMM pool, and click 'Mint'. Your NFT will be created on the blockchain and listed on our marketplace. For AMM pools, you'll need to set an initial deposit to provide liquidity.",
      },
      {
        q: 'What are the fees and revenue distribution for music NFTs?',
        a:
          'For music NFT sales without AMM, the revenue is distributed as follows: 80% goes to the Creator and 20% to Woodeng Holders. For secondary sales, creators can set royalties up to 15%, with 80% going to the original Creator and 20% to Woodeng Holders. For NFTs with AMM, there are no royalties, but creators benefit from price appreciation as NFTs are purchased from the pool.',
      },
      {
        q: "What's the difference between NFTs with and without AMM?",
        a:
          'NFTs with AMM (Automated Market Maker) use dynamic pricing based on supply and demand, with no royalties. Instead, creators benefit from price appreciation as NFTs are purchased from the pool. NFTs without AMM use fixed pricing and can have royalties up to 15% on secondary sales. The choice between these options is made at minting time and cannot be changed later.',
      },
    ],
  },
  {
    title: 'Sound Memes',
    questions: [
      {
        q: 'What is a sound meme NFT?',
        a:
          'A sound meme NFT is a short, viral audio clip turned into a unique digital asset using the SPL404 standard on Solana. These can be funny sounds, catchy phrases, or memorable musical moments that can be collected and traded with tokenized ownership, allowing multiple people to own a piece of the same sound meme.',
      },
      {
        q: 'How do I create a sound meme NFT?',
        a:
          "Choose 'Sound Meme' in the Create section, upload your audio clip (max 30 seconds), add a title and description, set your pricing in Woodeng tokens or Solana, choose between liquidity pool or bonding curve deployment, and mint. For liquidity pools, you'll need to make an initial deposit. For bonding curves, no initial deposit is required.",
      },
      {
        q: 'What are tokens in sound memes?',
        a:
          'Tokens represent fractional ownership in a sound meme NFT. When you create a sound meme, you specify the total supply of tokens. These tokens can be bought and sold individually, allowing multiple people to own a piece of the same sound meme.',
      },
      {
        q: 'What are the fees for sound memes?',
        a:
          'For sound meme transactions with liquidity pools, there is a 0.3% transaction fee, with 0.2% going to the Sound Meme Creator and 0.1% to Woodeng Holders. For bonding curves, there is a 1.5% fee pre-migration (1% to Woodeng Holders, 0.5% to Creator) and 0.3% post-migration (0.2% to Creator, 0.1% to Woodeng Holders).',
      },
      {
        q: "What's the difference between liquidity pools and bonding curves for sound memes?",
        a:
          'Sound memes with liquidity pools require an initial deposit and have immediate trading in WOODENG or SOL with a 0.3% transaction fee. Bonding curves do not require initial liquidity; price automatically increases as tokens are purchased. They start with a 1.5% fee and drop to 0.3% after automatic migration to DEX at a $44 k market cap.',
      },
    ],
  },
  {
    title: 'Rewards & Staking',
    questions: [
      {
        q: 'How does the reward pool work?',
        a:
          'The reward pool is funded by multiple sources: 20% from Music NFT primary sales, 20% from Music NFT secondary royalties, 0.1% from Sound Meme liquidity transactions, 1% from Sound Meme bonding curve transactions (pre-migration), and 0.1% from Sound Meme bonding curve transactions (post-migration). This pool is distributed to users who participate in our staking program.',
      },
      {
        q: 'How does staking work?',
        a:
          'You can stake your Woodeng tokens to earn rewards from platform activity. There is no mandatory lock period, but you must wait 30 days before claiming rewards in WOODENG or SOL.',
      },
      {
        q: 'Can I withdraw my staked tokens early?',
        a:
          'Yes. You can withdraw anytime, but withdrawing before the 30-day reward-claim period incurs a 10 % penalty on unclaimed rewards, which is returned to the reward pool.',
      },
      {
        q: 'How are rewards calculated?',
        a:
          'Rewards are distributed proportionally based on your share of the total staking pool. The more tokens you stake—and the longer you keep them—the larger your reward.',
      },
      {
        q: 'What types of rewards can I earn?',
        a:
          'You can earn both WOODENG and SOL. Distribution depends on the proportion of pools using each token and overall platform fees.',
      },
    ],
  },
  {
    title: 'Trading & Marketplace',
    questions: [
      {
        q: 'How do I buy NFTs?',
        a:
          "Browse the marketplace, find an NFT you like, make sure you have enough Woodeng tokens or SOL, then click 'Buy Now' or place a bid. The NFT transfers to your wallet after purchase.",
      },
      {
        q: 'How do I buy sound meme tokens?',
        a:
          "Go to the Sound Memes section, select a meme, click 'Buy Tokens', enter the amount, and confirm. Tokens arrive in your wallet after the transaction.",
      },
      {
        q: 'Can I resell my NFTs?',
        a:
          'Yes. Music NFTs without AMM pay the creator royalties (up to 15 %) on each resale: 80 % to the creator, 20 % to Woodeng Holders. NFTs with AMM and sound memes use the standard transaction-fee model.',
      },
      {
        q: 'What trading tools are available?',
        a:
          'Woodeng offers Woo Swap (instant token swaps for WOODENG & SOL) and Woo Dex (real-time charts, liquidity tracking, and market analytics).',
      },
    ],
  },
  {
    title: 'Pools & Liquidity',
    questions: [
      {
        q: 'What is a liquidity pool in Woodeng?',
        a:
          'A liquidity pool is an AMM that lets NFTs trade without direct buyer-seller matches. Price adjusts automatically with supply/demand.',
      },
      {
        q: 'How do I create a pool for my NFT?',
        a:
          "During mint, pick 'Create and Seed Pool', choose WOODENG or SOL, and deposit initial liquidity. The AMM pool goes live immediately.",
      },
      {
        q: "What's the difference between NFTs with and without pools?",
        a:
          "Pool NFTs have dynamic AMM pricing and no royalties; creators earn from price appreciation. Non-pool NFTs have fixed price and optional royalties (up to 15 %).",
      },
      {
        q: 'Can I convert between pool and non-pool NFTs?',
        a:
          'No. The decision is made at minting time and is permanent.',
      },
      {
        q: 'Is liquidity locked in the pools?',
        a:
          'Yes. All liquidity is permanently locked in our Smart Contract Locker. Users can add more liquidity but can never withdraw it.',
      },
    ],
  },
  {
    title: 'Rights & Ownership',
    questions: [
      {
        q: 'What rights do I get when buying an NFT?',
        a:
          'You own the token representing that piece of music. This usually includes personal listening and resale rights. Commercial rights depend on the artist.',
      },
      {
        q: 'As an artist, do I keep my copyright?',
        a:
          'Yes. Minting an NFT does not transfer copyright. You retain full rights.',
      },
      {
        q: 'How are royalties handled?',
        a:
          'Royalties are distributed automatically by smart contract. Music NFTs without AMM can set up to 15 % royalties (80 % creator / 20 % Woodeng Holders). NFTs with AMM rely on price appreciation instead of royalties.',
      },
      {
        q: 'Do I need to be verified to distribute music?',
        a:
          'Verification is required for artists working with labels, agents, or copyrighted material. Independent artists may publish without verification.',
      },
    ],
  },
  {
    title: 'Technical',
    questions: [
      {
        q: 'How is the content stored?',
        a:
          'Audio and artwork live on decentralized storage (IPFS). Metadata is on chain (Solana).',
      },
      {
        q: 'What happens if I lose access to my wallet?',
        a:
          'NFTs are tied to your wallet address. Keep your seed phrase safe—losing the wallet means losing the NFTs.',
      },
      {
        q: 'Is my content safe?',
        a:
          'Yes. Multiple IPFS nodes replicate the data, while blockchain records guarantee integrity.',
      },
      {
        q: 'What is SPL404?',
        a:
          'SPL404 is a Solana token standard for sound memes, allowing fractionalised ownership via fungible tokens recorded publicly on-chain.',
      },
      {
        q: 'What security measures are in place?',
        a:
          'Woodeng uses audited smart contracts, decentralized storage, automated royalty distribution, permanent liquidity locking, secure wallet connections, and anti-sniper protection.',
      },
    ],
  },
];

/* ──────────────────────────────────────────
   COMPONENT
────────────────────────────────────────── */
export default function FAQ() {
  const [query,    setQuery]    = useState('');
  const [opened,   setOpened]   = useState<string[]>([]);

  const toggle = (q: string) =>
    setOpened(prev =>
      prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q],
    );

  const filtered = faqCategories
    .map(cat => ({
      ...cat,
      questions: cat.questions.filter(
        qa =>
          qa.q.toLowerCase().includes(query.toLowerCase()) ||
          qa.a.toLowerCase().includes(query.toLowerCase()),
      ),
    }))
    .filter(cat => cat.questions.length);

  return (
    <div className="py-12 space-y-12">
      {/* Header */}
      <header className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Find answers to common questions about Woodeng&rsquo;s music&nbsp;NFT and
          sound&nbsp;meme platform
        </p>
      </header>

      {/* Search */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search questions…"
            className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-lg focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-8">
        {filtered.map(cat => (
          <div key={cat.title}>
            <h2 className="text-2xl font-bold mb-6">{cat.title}</h2>
            <div className="space-y-4">
              {cat.questions.map(item => (
                <div
                  key={item.q}
                  className="border border-border rounded-lg overflow-hidden"
                >
                  <button
                    onClick={() => toggle(item.q)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-left">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 transition-transform duration-200',
                        opened.includes(item.q) && 'rotate-180',
                      )}
                    />
                  </button>

                  <div
                    className={cn(
                      'grid transition-all duration-200',
                      opened.includes(item.q)
                        ? 'grid-rows-[1fr]'
                        : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 py-4 text-muted-foreground border-t border-border">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* No results */}
        {filtered.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground">
              Try different keywords or browse all categories
            </p>
          </div>
        )}
      </div>

      {/* Contact CTA */}
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
        <p className="text-muted-foreground mb-6">
          Can&rsquo;t find the answer you&rsquo;re looking for? Our support team is here to
          help.
        </p>
        <Link
          href="/contact"
          className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
        >
          Contact Support
        </Link>
      </div>
    </div>
  );
}
