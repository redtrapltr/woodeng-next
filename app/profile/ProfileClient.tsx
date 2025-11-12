/* ------------------------------------------------------------------ *
 *  Profile page – Music & Sound-Meme dashboard                        *
 * ------------------------------------------------------------------ */
'use client';




import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Plus, Loader2, Music2, Wand2, ShoppingCart,
  HandCoins, ArrowUpRight, Flame,
} from 'lucide-react';

import { loadUserMusicNfts, loadUserSoundMemes } from '@/lib/loadUserNfts';
import { useSplBalances } from '@/hooks/useSplBalances';
import {
  buySoundMeme, sellSoundMeme, mintSoundMeme, burnSoundMeme,
} from '@/lib/sound-memes';
import { listOrUpdateListing } from '@/lib/useMusicTrade';

import { NFTCard as MemeCard } from '@/components/NFTCard';
import { NFTCard as MarketCard } from '../marketplace/NFTCard';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileUpdateForm } from '@/components/profile/ProfileUpdateForm';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { cn } from '@/lib/utils';

import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';

import type { PoolType } from '@/lib/sound-meme-types';
import type { NFT } from '@/types/nft';
import { useSoundMemeModals } from '@/hooks/useSoundMemeModals';
import { stillOwnsNft } from '@/lib/sound-meme-helpers';

import { PublicKey } from '@solana/web3.js';
import { toast } from 'sonner';
import { Footer } from '@/contexts/components/Footer';

/* ------------------------------------------------------------------ */
/*  Local types                                                        */
/* ------------------------------------------------------------------ */
type MainTab = 'music' | 'memes' | 'settings';
type SubTab  = 'created' | 'collected';

/* ------------------------------------------------------------------ */
/*  Page component                                                     */
/* ------------------------------------------------------------------ */
export default function ProfileClient() {
  const router        = useRouter();
  const wallet        = useWallet();
  const { publicKey } = wallet;

  /* ------- UI state -------- */
  const [mainTab, setMainTab] = useState<MainTab>('music');
  const [subTab,  setSubTab]  = useState<SubTab>('created');
  const [loading, setLoading] = useState(false);

  /* ------- fetched NFT lists -------- */
  const [musicCreated, setMusicCreated] = useState<NFT[]>([]);
  const [musicBought,  setMusicBought]  = useState<NFT[]>([]);
  const [memeCreated,  setMemeCreated]  = useState<NFT[]>([]);
  const [memeBought,   setMemeBought]   = useState<NFT[]>([]);

  /* ------- SPL balances (meme tokens) -------- */
  const { memeBalances, loading: balancesLoading } = useSplBalances([]);

  /* ------------------------------------------------------------------ */
  /*  (re-)load wallet-dependent data                                   */
  /* ------------------------------------------------------------------ */
  const refreshData = useCallback(async () => {
    if (!publicKey) return;
    setLoading(true);
    try {
      const [music, memes] = await Promise.all([
        loadUserMusicNfts(publicKey),
        loadUserSoundMemes(publicKey),
      ]);
      setMusicCreated(music.created);
      setMusicBought (music.collected);
      setMemeCreated (memes.created);
      setMemeBought  (memes.collected);
    } catch {
      toast.error('Failed to reload NFTs');
    }
    setLoading(false);
  }, [publicKey]);

  useEffect(() => { if (publicKey) refreshData(); }, [publicKey, refreshData]);

  /* ------------------------------------------------------------------ */
  /*  SOUND-MEME modal helpers                                          */
  /* ------------------------------------------------------------------ */
  const {
    openBuyModal, openSellModal, openMintModal, openBurnModal, Modals: MemeModals,
  } = useSoundMemeModals({
    onBuy : async (p,a,s) => { await buySoundMeme({ pool:p, amountWoodengIn:a, minMemeOut:s, wallet }); },
    onSell: async (p,a,s) => { await sellSoundMeme({ pool:p, memeAmountIn:a, minWoodengOut:s, wallet }); },
    onMint: async (p)     => { await mintSoundMeme({ pool:p, wallet, setStatus:()=>{} }); },
    onBurn: async (p,l,m) => { await burnSoundMeme({ pool:p, lockId:l, mint:m, wallet, setStatus:()=>{} }); },
  });

  /* ------------------------------------------------------------------ */
  /*  Derived list for current tab                                      */
  /* ------------------------------------------------------------------ */
  const visibleNfts: NFT[] = mainTab === 'music'
    ? (subTab === 'created' ? musicCreated : musicBought)
    : (subTab === 'created' ? memeCreated  : memeBought);

  /* ------------------------------------------------------------------ */
  /*  Early return – wallet not connected                               */
  /* ------------------------------------------------------------------ */
  if (!publicKey) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-6">
        <p className="text-xl">Connect your wallet to view your profile</p>
        <WalletMultiButton />
      </div>
    );
  }

  const user = {
    id: publicKey.toBase58(),
    username: `${publicKey.toBase58().slice(0,4)}…${publicKey.toBase58().slice(-4)}`,
  };

  /* ------------------------------------------------------------------ */
  /*  JSX                                                               */
  /* ------------------------------------------------------------------ */
  return (
    <>
      {/* ----- main content, with side padding + bottom margin ----- */}
      <div className="space-y-8 container mx-auto mt-8 px-8 md:px-12 pb-24">


        {/* ---------- banner / profile header ---------- */}
        <div className="mb-12">
          <ProfileHeader
            username={user.username}
            bio=""
            avatarUrl=""
            coverUrl=""
            isVerified={false}
            isArtist={false}
            userId={user.id}
            onEditProfile={() => { setMainTab('settings'); setSubTab('created'); }}
          />
        </div>

        {/* ---------- main tab switch ---------- */}
        <Tabs
          value={mainTab}
          onValueChange={(v) => setMainTab(v as MainTab)}
        >
          <TabsList className="flex flex-wrap gap-2 bg-transparent">
            <TabsTrigger value="music">
              <Music2 className="w-4 h-4 mr-1" /> Music NFTs
            </TabsTrigger>
            <TabsTrigger value="memes">
              <Wand2 className="w-4 h-4 mr-1" /> Sound Memes
            </TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ---------- MUSIC & MEME sections ---------- */}
          {(['music','memes'] as const).map((section) => (
            <TabsContent key={section} value={section} className="mt-6 space-y-6">

              {/* sub-tab toggle */}
              <div className="flex gap-2">
                {(['created','collected'] as SubTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSubTab(t)}
                    className={cn(
                      'px-4 py-2 rounded-lg text-sm',
                      subTab === t
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/70',
                    )}
                  >
                    {t === 'created' ? 'Created' : 'Collected'}
                  </button>
                ))}
              </div>

              {/* meme balances */}
              {section === 'memes' && subTab === 'collected' && (
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  {balancesLoading ? '…loading balances…'
                    : memeBalances.length === 0
                      ? '(No meme token balances found)'
                      : memeBalances.map((amt,i) => (
                          <span key={i} className="px-3 py-1 rounded-lg bg-muted">
                            {(amt ?? 0).toLocaleString()}
                          </span>
                        ))}
                </div>
              )}

              {/* grid of NFT cards */}
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : visibleNfts.length ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {visibleNfts.map((n) =>
                    section === 'music' ? (
                      /* --- Music card re-use --- */
                      <div key={`${n.id}-${n.hasPool?'pool':'direct'}`} className="relative">
                        <MarketCard
                          nft={n}
                          view="grid"
                          onOpen={() =>
                            n.hasPool && n.poolPda
                              ? router.push(`/amm?addr=${n.poolPda}`)
                              : router.push(`/nft/${n.mint || n.id}`)}
                        />
                        {/* List / update listing overlay */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            listOrUpdateListing(n, n.listing ? 'update' : 'list');
                          }}
                          title={n.listing ? 'Update listing' : 'List for sale'}
                          className="icon-btn absolute top-2 right-2 z-10"
                        >
                          <HandCoins className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      /* --- Sound-Meme card --- */
                      <MemeCard
                        key={n.id}
                        {...n}
                        extraActions={subTab === 'collected' && (
                          <>
                            <button onClick={(e)=>{e.stopPropagation(); n.pool && openBuyModal(n.pool as PoolType);}}
                                    title="Buy more" className="icon-btn">
                              <ShoppingCart className="w-4 h-4" />
                            </button>
                            <button onClick={(e)=>{e.stopPropagation(); n.pool && openSellModal(n.pool as PoolType);}}
                                    title="Sell" className="icon-btn">
                              <HandCoins className="w-4 h-4" />
                            </button>
                            <button onClick={(e)=>{e.stopPropagation(); n.pool && openMintModal(n.pool as PoolType);}}
                                    title="Mint NFT" className="icon-btn">
                              <Plus className="w-4 h-4" />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!n.pool || !n.userLockers) return;
                                const alive = (await Promise.all(
                                  n.userLockers.map(async l =>
                                    (await stillOwnsNft(new PublicKey(l.mint), publicKey!)) ? l : null
                                  ))).filter(Boolean) as typeof n.userLockers;
                                if (!alive.length) {
                                  toast.error('You have already burned every NFT of this meme.');
                                  return;
                                }
                                openBurnModal(n.pool as PoolType, alive);
                              }}
                              title="Burn NFT"
                              className="icon-btn"
                              disabled={!n.userLockers || n.userLockers.length === 0}
                            >
                              <Flame className="w-4 h-4 text-red-500" />
                            </button>
                          </>
                        )}
                        onClick={() => n.pool && router.push(`/amm?addr=${n.pool}`)}
                      />
                    )
                  )}
                </div>
              ) : (
                <EmptyState section={section} subTab={subTab} router={router} />
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* SOUND-MEME modals */}
        {MemeModals}
      </div>

      {/* site-wide footer */}
      <Footer />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty-state helper                                                */
/* ------------------------------------------------------------------ */
function EmptyState({
  section, subTab, router,
}: {
  section: 'music' | 'memes';
  subTab:  'created' | 'collected';
  router:  ReturnType<typeof useRouter>;
}) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-muted-foreground">
      {section === 'music' ? <Music2 className="w-10 h-10" /> : <Wand2 className="w-10 h-10" />}
      <p className="text-xl">
        No {section === 'music' ? 'Music NFTs' : 'Sound Memes'} {subTab} yet
      </p>

      {section === 'memes' && subTab === 'collected' && (
        <button
          className="px-5 py-2 bg-primary text-primary-foreground rounded-lg"
          onClick={() => router.push('/sound-memes')}
        >
          Explore Sound Memes <ArrowUpRight className="w-4 h-4 ml-1" />
        </button>
      )}

      {section === 'music' && subTab === 'created' && (
        <button
          className="flex items-center gap-2 px-5 py-2 bg-primary/10 text-primary rounded-lg"
          onClick={() => router.push('/create')}
        >
          <Plus className="w-4 h-4" /> Create NFT
        </button>
      )}

    {/* NEW:  “Create Sound Meme” when user hasn’t created any yet */}
  {section === 'memes' && subTab === 'created' && (
    <button
      className="flex items-center gap-2 px-5 py-2 bg-primary/10 text-primary rounded-lg"
      onClick={() => router.push('/create')}
    >
      <Plus className="w-4 h-4" /> Create Sound Meme
    </button>
  )}
    </div>
  );
}
