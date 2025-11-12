'use client';

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import '@solana/wallet-adapter-react-ui/styles.css';

export function WalletContext({ children }) {
  // Use your Helius endpoint from .env.local
  // Fallback to NEXT_PUBLIC_SOLANA_RPC for flexibility
  const endpoint = useMemo(() => {
    const envUrl =
      process.env.NEXT_PUBLIC_HELIUS_RPC_URL ||
      process.env.NEXT_PUBLIC_SOLANA_RPC; // both are fine as long as one is set
    if (!envUrl) {
      // Last-resort warning so we don't silently hit api.mainnet-beta.solana.com
      console.warn(
        '[WalletContext] No NEXT_PUBLIC_HELIUS_RPC_URL / NEXT_PUBLIC_SOLANA_RPC set. ' +
          'Browser calls will fail CORS on api.mainnet-beta.solana.com.'
      );
    } else {
      // helpful breadcrumb in dev tools
      if (typeof window !== 'undefined') {
        console.debug('[WalletContext] Using RPC endpoint:', envUrl);
      }
    }
    return envUrl ?? 'https://mainnet.helius-rpc.com/?api-key=REQUIRED';
  }, []);

  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

export function WalletStatus() {
  return <div style={{ padding: '10px', color: 'white' }}>Wallet status here</div>;
}
