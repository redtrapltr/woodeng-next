// app/client-provider.tsx
"use client";  // this component must be client‑side

import React, { ReactNode } from "react";

// 1) Solana Wallet‑Adapter imports
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider }    from "@solana/wallet-adapter-react-ui";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl }          from "@solana/web3.js";
import "@solana/wallet-adapter-react-ui/styles.css";

// 2) Your existing WalletContext (if you still need it)
import { WalletContext } from "../src/contexts/WalletContext";

export default function ClientProvider({ children }: { children: ReactNode }) {
  // Point to Devnet
  const endpoint = clusterApiUrl("devnet");
  // Choose which wallets to support
  const wallets = [
    new PhantomWalletAdapter(),
    new SolflareWalletAdapter(),
  ];

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {/* Wrap your own context inside the wallet layer */}
          <WalletContext>
            {children}
          </WalletContext>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
