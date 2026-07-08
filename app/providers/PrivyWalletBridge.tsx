"use client";

import { useEffect } from "react";
import { usePrivy, useSolanaWallets } from "@privy-io/react-auth";
import { useWallet } from "@solana/wallet-adapter-react";

/**
 * Bridges Privy's embedded Solana wallet into the @solana/wallet-adapter-react
 * context. Privy registers embedded wallets as Solana Standard Wallets, which
 * wallet-adapter detects automatically. This component auto-selects and connects
 * the Privy adapter so all existing useWallet() calls see it.
 */
export function PrivyWalletBridge({ children }: { children: React.ReactNode }) {
  const { authenticated } = usePrivy();
  const { wallets: privyWallets } = useSolanaWallets();
  const { select, wallets, connect, connected } = useWallet();

  useEffect(() => {
    if (!authenticated || connected) return;

    const privyEmbedded = privyWallets.find(w => w.walletClientType === "privy");
    if (!privyEmbedded) return;

    // Privy registers its embedded wallet as a Solana Standard Wallet named "Privy"
    const privyAdapter = wallets.find(
      w => w.adapter.name === "Privy" || w.adapter.name.toLowerCase().includes("privy")
    );

    if (privyAdapter) {
      select(privyAdapter.adapter.name as any);
      setTimeout(() => connect().catch(() => {}), 500);
    }
  }, [authenticated, privyWallets, wallets, connected, select, connect]);

  return <>{children}</>;
}
