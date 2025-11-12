'use client';

import React, { useState } from 'react';
import { ChevronDown, Search, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export default function FAQ() {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedQuestions, setExpandedQuestions] = useState<string[]>([]);

  const faqCategories = [
    {
      title: "Getting Started",
      questions: [
        {
          q: "What is Woo?",
          a: "Woo is a decentralized platform that enables creators to create, sell, and distribute their music as NFTs and sound memes on the Solana blockchain. We provide tools for artists to monetize their work directly while giving fans new ways to support and connect with their favorite creators through blockchain technology and fair economics."
        },
        {
          q: "How do I create an account?",
          a: "To create an account, you'll need a compatible crypto wallet (like Phantom). Click the 'Connect Wallet' button, and you're ready to start using Woo. The entire process takes less than a minute."
        },
        {
          q: "What cryptocurrencies are supported?",
          a: "We use our native token Woodeng and Solana for all transactions on the platform. Woodeng is built on the Solana blockchain, providing fast and low-cost transactions for our users."
        },
        {
          q: "What makes Woodeng different from other music platforms?",
          a: "Woodeng revolutionizes music distribution through blockchain technology, offering both Music NFTs and SWL-444 Sound Memes. Our platform features automated market makers (AMM) for dynamic pricing, permanently locked liquidity, and a fair revenue distribution model that benefits creators, token holders, and the ecosystem."
        }
      ]
    },
    {
      title: "Music NFTs",
      questions: [
        {
          q: "What is a music NFT?",
          a: "A music NFT is a unique digital asset that represents ownership of a piece of music on the blockchain. It can include the audio file, artwork, and exclusive perks defined by the artist. On Woo, music NFTs can be created with either fixed pricing and royalties or with automated market makers (AMM) for dynamic pricing."
        },
        {
          q: "How do I create a music NFT?",
          a: "After connecting your wallet, go to the 'Create' section, select 'Music NFT', upload your audio file and artwork, set your pricing in Woodeng tokens or SOL, choose between royalties or AMM pool, and click 'Mint'. Your NFT will be created on the blockchain and listed on our marketplace. For AMM pools, you'll need to set an initial deposit to provide liquidity."
        },
        {
          q: "What are the fees and revenue distribution for music NFTs?",
          a: "For music NFT primary sales, 80% goes to the Creator and 20% to $WOODENG Holders (who receive 100% of the 20% platform fee). For secondary sales, creators can set royalties up to 15%, with 80% going to the original Creator and 20% of those royalties to $WOODENG Holders. For NFTs with AMM, there are no royalties, but creators benefit from price appreciation as NFTs are purchased from the pool."
        },
        {
          q: "What's the difference between NFTs with and without AMM?",
          a: "NFTs with AMM (Automated Market Maker) use dynamic pricing based on supply and demand, with no royalties. Instead, creators benefit from price appreciation as NFTs are purchased from the pool. NFTs without AMM use fixed pricing and can have royalties up to 15% on secondary sales. The choice between these options is made at minting time and cannot be changed later."
        }
      ]
    },
    {
      title: "Sound Memes",
      questions: [
        {
          q: "What is a sound meme NFT?",
          a: "A sound meme NFT is a short, viral audio clip turned into a unique digital asset using the SWL-444 standard on Solana. These can be funny sounds, catchy phrases, or memorable musical moments that can be collected and traded with tokenized ownership, allowing multiple people to own a piece of the same sound meme."
        },
        {
          q: "How do I create a sound meme NFT?",
          a: "Choose 'Sound Meme' in the Create section, upload your audio clip (max 30 seconds), add a title and description, set your pricing in Woodeng tokens or Solana, choose between liquidity pool or bonding curve deployment, and mint. For liquidity pools, you'll need to make an initial deposit. For bonding curves, no initial deposit is required."
        },
        {
          q: "What are tokens in sound memes?",
          a: "Tokens represent fractional ownership in a sound meme NFT. When you create a sound meme, you specify the total supply of tokens. These tokens can be bought and sold individually, allowing multiple people to own a piece of the same sound meme."
        },
        {
          q: "What are the fees for sound memes?",
          a: "For sound meme liquidity pool transactions, there's a 0.1% fee (100% to $WOODENG Holders). For bonding curves, pre-migration fees are 1% on transactions + 4% on early sellers (100% to $WOODENG Holders), and post-migration it's 0.1% (100% to $WOODENG Holders). Sound meme creators earn from token value appreciation as demand increases."
        },
        {
          q: "What's the difference between liquidity pools and bonding curves for sound memes?",
          a: "Sound memes with liquidity pools require an initial deposit and have immediate trading in WOODENG or SOL with a 0.1% transaction fee (100% to $WOODENG Holders). Bonding curves don't require initial liquidity, with price automatically increasing as tokens are purchased. They have fees of 1% + 4% on early sellers pre-migration and 0.1% post-migration (all fees to $WOODENG Holders), with automatic migration to DEX at $44K market cap."
        }
      ]
    },
    {
      title: "Rewards & Staking",
      questions: [
        {
          q: "How does the reward pool work?",
          a: "The reward pool is funded by multiple revenue streams from platform activity, with 100% of collected fees distributed to $WOODENG Holders through staking: 20% from Music NFT primary sales, 20% from Music NFT secondary royalties (up to 15%), 0.1% from Sound Meme liquidity pool transactions, 1% + 4% on early sellers from bonding curves (pre-migration), and 0.1% from bonding curves (post-migration). Rewards are distributed in both WOODENG and SOL tokens."
        },
        {
          q: "How does staking work?",
          a: "You can stake your Woodeng tokens to earn rewards from the platform's activity. We offer two staking options: Flexible staking with no mandatory lock period (but 30-day reward claim period and 10% penalty for early withdrawal), and Lock staking with fixed periods (3 months, 6 months, or 1 year) that provide yield bonuses depending on the lock duration."
        },
        {
          q: "Can I withdraw my staked tokens early?",
          a: "For flexible staking, yes, you can withdraw your staked tokens at any time. However, if you withdraw before the 30-day reward claim period, a 10% penalty will be applied to your unclaimed rewards. For lock staking, tokens are locked for the chosen period (3, 6, or 12 months) and cannot be withdrawn early, but you earn higher yields with bonus rates depending on the lock duration."
        },
        {
          q: "How are rewards calculated?",
          a: "Rewards are distributed proportionally based on your stake in the total staking pool and the staking type you choose. Flexible staking earns base rewards, while lock staking earns additional yield bonuses: higher bonuses for longer lock periods. The more Woodeng tokens you stake and the longer your commitment, the more rewards you can earn from platform activity."
        },
        {
          q: "What types of rewards can I earn?",
          a: "You can earn both WOODENG and SOL rewards through staking. The distribution depends on the proportion of pools using each token type. Rewards come from platform fees and transaction activity across both Music NFTs and Sound Memes. Lock staking provides additional yield bonuses on top of base rewards, with higher bonuses for longer commitment periods."
        },
        {
          q: "What are the differences between flexible and lock staking?",
          a: "Flexible staking allows you to withdraw tokens anytime but has a 30-day reward claim period and 10% penalty for early withdrawal of rewards. Lock staking requires you to commit tokens for 3, 6, or 12 months but provides yield bonuses depending on the lock duration - the longer the lock period, the higher the bonus yield you earn on top of base staking rewards."
        },
        {
          q: "What yield bonuses do I get with lock staking?",
          a: "Lock staking provides additional yield bonuses based on platform performance. The bonus percentage increases with longer lock periods: 3-month lock provides up to 30% bonus, 6-month lock provides up to 80% bonus, and 12-month lock provides up to 200% bonus. These bonuses are applied to both WOODENG and SOL rewards earned during the lock period, rewarding long-term commitment to the ecosystem."
        }
      ]
    },
    {
      title: "Trading & Marketplace",
      questions: [
        {
          q: "How do I buy NFTs?",
          a: "Browse the marketplace, find an NFT you like, ensure you have sufficient Woodeng tokens or Solana in your wallet, and click 'Buy Now' or place a bid. The NFT will be transferred to your wallet upon successful purchase."
        },
        {
          q: "How do I buy sound meme tokens?",
          a: "Navigate to the Sound Memes section, select a meme you're interested in, click 'Buy Tokens', enter the number of tokens you want to purchase, and confirm the transaction. You'll receive the tokens in your wallet after the transaction is processed."
        },
        {
          q: "Can I resell my NFTs?",
          a: "Yes, you can resell your NFTs on our secondary marketplace. For music NFTs without AMM, the original artist will receive their set royalty percentage (up to 15%) from each sale, with 80% going to the original Creator and 20% to Woodeng Holders. For NFTs with AMM and sound memes, the standard transaction fees apply."
        },
        {
          q: "What trading tools are available on the platform?",
          a: "Woodeng offers integrated trading tools including Woo Swap for seamless token swaps directly within the platform (supporting WOODENG and SOL pairings) and Woo Dex for advanced DEX visualization with real-time price charts, market data, and liquidity pool monitoring."
        }
      ]
    },
    {
      title: "Pools & Liquidity",
      questions: [
        {
          q: "What is a liquidity pool in Woodeng?",
          a: "A liquidity pool is an automated market maker (AMM) that allows for the trading of NFTs without needing a direct buyer-seller match. When you create an NFT with a pool, you're setting up a system where the price automatically adjusts based on supply and demand."
        },
        {
          q: "How do I create a pool for my NFT?",
          a: "When minting your music NFT, you'll have the option to 'Create and Seed Pool'. You'll need to specify the token type (Woodeng or Solana) and make an initial deposit to provide liquidity. This creates an AMM pool where others can buy your NFT directly."
        },
        {
          q: "What's the difference between NFTs with and without pools?",
          a: "NFTs with pools use an automated market maker for pricing and don't have royalties. Instead, the creator benefits from price appreciation as NFTs are purchased from the pool. NFTs without pools use fixed pricing and can have royalties of up to 15% on secondary sales."
        },
        {
          q: "Can I convert between pool and non-pool NFTs?",
          a: "No, the decision to create a pool is made at the time of minting and cannot be changed later. Choose carefully based on your monetization preferences."
        },
        {
          q: "Is liquidity locked in the pools?",
          a: "Yes, all liquidity is permanently locked in our Smart Contract Locker with no possibility of withdrawal. This ensures long-term stability for the platform. Users may voluntarily add additional liquidity at any time."
        }
      ]
    },
    {
      title: "Rights & Ownership",
      questions: [
        {
          q: "What rights do I get when buying an NFT?",
          a: "When you purchase a music NFT, you own the token that represents the piece of music. This typically includes personal listening rights and the ability to resell the NFT. Commercial usage rights vary by artist."
        },
        {
          q: "As an artist, do I keep my copyright?",
          a: "Yes, creating an NFT does not transfer your copyright. You retain all rights to your original work while selling NFTs that represent the work."
        },
        {
          q: "How are royalties handled?",
          a: "Royalties are automatically distributed through smart contracts in Woodeng tokens or Solana. For music NFTs without AMM, creators can set royalties up to 15% for secondary sales, with 80% going to the original Creator and 20% of those royalties to $WOODENG Holders (who receive 100% of the 20% platform fee). NFTs with AMM don't have royalties but benefit from price appreciation."
        },
        {
          q: "Do I need to be verified to distribute music?",
          a: "Verification is required for artists with record labels, agents, or applicable copyright protection. If you want to distribute protected music, you must request verification through your profile settings. Self-published artists may use the platform without verification."
        }
      ]
    },
    {
      title: "Technical",
      questions: [
        {
          q: "How is the content stored?",
          a: "All content is stored on decentralized storage networks (IPFS) to ensure permanence and accessibility. The NFT metadata is stored on the Solana blockchain."
        },
        {
          q: "What happens if I lose access to my wallet?",
          a: "Your NFTs are tied to your wallet address. Make sure to keep your seed phrase safe. If you lose access to your wallet, you'll lose access to your NFTs."
        },
        {
          q: "Is my content safe?",
          a: "Yes, we use decentralized storage solutions and blockchain technology to ensure your content remains secure and accessible. Multiple backup nodes maintain content integrity."
        },
        {
          q: "What is SWL-444?",
          a: "SWL-444 is a revolutionary token standard on Solana that merges the properties of fungible and non-fungible tokens. While initially focused on sound memes, SWL-444 is designed to support any type of metadata-rich digital asset. It allows for tokenized ownership that can be divided among multiple people, making digital assets more accessible and tradeable. Token ownership and transaction history are recorded on the Solana blockchain and publicly visible."
        },
        {
          q: "What security measures are in place?",
          a: "Woodeng employs industry-standard security measures including smart contracts for secure transactions, decentralized storage on IPFS, automated payments with claimed fee distribution, secure wallet connections, permanent liquidity locking, and anti-sniper protection to prevent bot manipulation."
        }
      ]
    }
  ];

  const toggleQuestion = (question: string) => {
    setExpandedQuestions(prev =>
      prev.includes(question) ? prev.filter(q => q !== question) : [...prev, question],
    );
  };

  const filteredCategories = faqCategories
    .map(category => ({
      ...category,
      questions: category.questions.filter(
        q =>
          q.q.toLowerCase().includes(searchQuery.toLowerCase()) ||
          q.a.toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    }))
    .filter(category => category.questions.length > 0);

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 space-y-12">
      {/* Header */}
      <div className="text-center space-y-6">
        <h1 className="text-4xl font-bold">Frequently Asked Questions</h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Find answers to common questions about Woodeng&apos;s music NFT and sound meme platform
        </p>
      </div>

      {/* Search */}
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search questions..."
            className="w-full pl-12 pr-4 py-3 bg-background border border-border rounded-lg focus:border-primary transition-colors"
          />
        </div>
      </div>

      {/* FAQ Categories */}
      <div className="space-y-8">
        {filteredCategories.map((category, categoryIndex) => (
          <div key={categoryIndex}>
            <h2 className="text-2xl font-bold mb-6">{category.title}</h2>
            <div className="space-y-4">
              {category.questions.map((item, questionIndex) => (
                <div key={questionIndex} className="border border-border rounded-lg overflow-hidden">
                  <button
                    onClick={() => toggleQuestion(item.q)}
                    className="w-full px-6 py-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                  >
                    <span className="font-medium text-left">{item.q}</span>
                    <ChevronDown
                      className={cn(
                        'w-5 h-5 transition-transform duration-200',
                        expandedQuestions.includes(item.q) && 'rotate-180',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'grid transition-all duration-200',
                      expandedQuestions.includes(item.q) ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                    )}
                  >
                    <div className="overflow-hidden">
                      <p className="px-6 py-4 text-muted-foreground border-t border-border">{item.a}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-full bg-muted mb-4">
              <AlertCircle className="w-6 h-6 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground">Try adjusting your search terms or browse all categories</p>
          </div>
        )}
      </div>

      {/* Contact Support */}
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Still have questions?</h2>
        <p className="text-muted-foreground mb-6">
          Can&apos;t find the answer you&apos;re looking for? Our support team is here to help.
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
