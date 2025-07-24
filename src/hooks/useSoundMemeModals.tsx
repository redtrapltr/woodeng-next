'use client';
import React, { useState, useCallback } from 'react';
import type { PoolType } from '@/lib/sound-meme-types';
import { BuyMemeModal } from '@/components/sound-memes/BuyMemeModal';
import { SellMemeModal } from '@/components/sound-memes/SellMemeModal';
import { MintMemeModal } from '@/components/sound-memes/MintMemeModal';
import { BurnMemeModal } from '@/components/sound-memes/BurnMemeModal';
import { PublicKey } from "@solana/web3.js";

// --------- NEW: SPL TOKEN BALANCES HOOK ----------
import { useSplBalances } from '@/hooks/useSplBalances'; // You created this hook

type LockerInfo = { lockId: number; mint: string };

type Handlers = {
  onBuy: (pool: PoolType, woodengRawIn: number, memeRawOut: number) => Promise<void>;
  onSell: (pool: PoolType, memeRawIn: number, minWoodengOut: number) => Promise<void>;
  onMint: (pool: PoolType) => Promise<void>;
  onBurn: (pool: PoolType, lockId: number, mint: string) => Promise<void>;
};





function getMemeMints(pool: PoolType | null): PublicKey[] {
  if (!pool) return [];
  if (pool.memeMint instanceof PublicKey) return [pool.memeMint];
  return [];
}



const SELECTED_MINT_INDEX = 0; // always 0, unless you support bundle pools

export function useSoundMemeModals(handlers: Handlers) {
  const [buyPool, setBuyPool] = useState<PoolType | null>(null);
  const [sellPool, setSellPool] = useState<PoolType | null>(null);
  const [mintPool, setMintPool] = useState<PoolType | null>(null);
  const [burnModal, setBurnModal] = useState<{ pool: PoolType; userLockers: LockerInfo[] } | null>(null);

  const [buyStatus, setBuyStatus] = useState({ status: '', message: '' });
  const [sellStatus, setSellStatus] = useState({ status: '', message: '' });
  const [mintStatus, setMintStatus] = useState({ minting: false, status: '' });
  const [burnStatus, setBurnStatus] = useState({ burning: false, status: '' });

  // ---- ACTUAL BALANCES ----
  const activePool: PoolType | null = buyPool || sellPool || mintPool || burnModal?.pool || null;
  const memeMints = getMemeMints(activePool);
  const { woodengBalance, memeBalances, loading } = useSplBalances(memeMints);

  // ---- Modal Open/Close ----
  const openBuyModal = useCallback((pool: PoolType) => {
    setBuyStatus({ status: '', message: '' });
    setBuyPool(pool);
  }, []);
  const closeBuyModal = useCallback(() => setBuyPool(null), []);

  const openSellModal = useCallback((pool: PoolType) => {
    setSellStatus({ status: '', message: '' });
    setSellPool(pool);
  }, []);
  const closeSellModal = useCallback(() => setSellPool(null), []);

  const openMintModal = useCallback((pool: PoolType) => {
    setMintStatus({ minting: false, status: '' });
    setMintPool(pool);
  }, []);
  const closeMintModal = useCallback(() => setMintPool(null), []);

  const openBurnModal = useCallback((pool: PoolType, userLockers: LockerInfo[]) => {
    setBurnStatus({ burning: false, status: '' });
    setBurnModal({ pool, userLockers });
  }, []);
  const closeBurnModal = useCallback(() => setBurnModal(null), []);

  // ---- Handler wrappers ----
  const handleBuyConfirm = async (woodengRawIn: number, memeRawOut: number) => {
    if (!buyPool) return;
    setBuyStatus({ status: 'processing', message: '' });
    try {
      await handlers.onBuy(buyPool, woodengRawIn, memeRawOut);
      setBuyStatus({ status: 'success', message: 'Buy successful!' });
      setTimeout(closeBuyModal, 900);
    } catch (e: any) {
      setBuyStatus({ status: 'error', message: e?.message || 'Error buying' });
    }
  };

  const handleSellConfirm = async (memeRawIn: number, minWoodengOut: number) => {
    if (!sellPool) return;
    setSellStatus({ status: 'processing', message: '' });
    try {
      await handlers.onSell(sellPool, memeRawIn, minWoodengOut);
      setSellStatus({ status: 'success', message: 'Sell successful!' });
      setTimeout(closeSellModal, 900);
    } catch (e: any) {
      setSellStatus({ status: 'error', message: e?.message || 'Error selling' });
    }
  };

  const handleMintConfirm = async () => {
    if (!mintPool) return;
    setMintStatus({ minting: true, status: '' });
    try {
      await handlers.onMint(mintPool);
      setMintStatus({ minting: false, status: 'NFT minted!' });
      setTimeout(closeMintModal, 900);
    } catch (e: any) {
      setMintStatus({ minting: false, status: e?.message || 'Error minting' });
    }
  };

  const handleBurnConfirm = async (lockId: number, mint: string) => {
    if (!burnModal) return;
    setBurnStatus({ burning: true, status: '' });
    try {
      await handlers.onBurn(burnModal.pool, lockId, mint);
      setBurnStatus({ burning: false, status: 'NFT burned and tokens unlocked!' });
      setTimeout(closeBurnModal, 900);
    } catch (e: any) {
      setBurnStatus({ burning: false, status: e?.message || 'Error burning NFT' });
    }
  };

  // ---- Render all modals ----
  const Modals = (
    <>
      {buyPool && (
        <BuyMemeModal
          pool={buyPool}
          open={!!buyPool}
          onClose={closeBuyModal}
          onConfirm={handleBuyConfirm}
          transactionStatus={buyStatus.status}
          transactionMessage={buyStatus.message}
          woodengBalance={woodengBalance}
        />
      )}
      {sellPool && (
        <SellMemeModal
          pool={sellPool}
          open={!!sellPool}
          onClose={closeSellModal}
          onConfirm={handleSellConfirm}
          transactionStatus={sellStatus.status}
          transactionMessage={sellStatus.message}
          memeBalance={memeBalances[SELECTED_MINT_INDEX] || 0}
        />
      )}
      {mintPool && (
        <MintMemeModal
          pool={mintPool}
          open={!!mintPool}
          onClose={closeMintModal}
          onMint={handleMintConfirm}
          minting={mintStatus.minting}
          status={mintStatus.status}
        />
      )}
      {burnModal && (
        <BurnMemeModal
          pool={burnModal.pool}
          userLockers={burnModal.userLockers}
          open={!!burnModal}
          onClose={closeBurnModal}
          onBurn={handleBurnConfirm}
          burning={burnStatus.burning}
          status={burnStatus.status}
        />
      )}
    </>
  );

  return {
    openBuyModal,
    openSellModal,
    openMintModal,
    openBurnModal,
    Modals,
  };
}
