// app/client-provider.tsx
"use client";

import React, { type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter, SolflareWalletAdapter } from "@solana/wallet-adapter-wallets";
import "@solana/wallet-adapter-react-ui/styles.css";
import { useNetwork } from "./network-context";
import { useChainMode } from "./contexts/NetworkContext";
import { PrivyWalletBridge } from "./providers/PrivyWalletBridge";

export default function ClientProvider({ children }: { children: ReactNode }) {
  const { endpoint } = useNetwork();
  const { isRobinhood } = useChainMode();
  const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()];

  return (
    <ConnectionProvider endpoint={endpoint}>
      {/* Don't auto-reconnect the Solana wallet (and the RPC handshake that
          comes with it) while the user is in Robinhood mode. */}
      <WalletProvider wallets={wallets} autoConnect={!isRobinhood}>
        <WalletModalProvider>
          <PrivyWalletBridge>
            {children}
          </PrivyWalletBridge>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
