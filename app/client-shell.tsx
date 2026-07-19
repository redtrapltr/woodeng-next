"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { NetworkProvider } from "./network-context";
import ClientProvider from "./client-provider";
import Header from "../src/contexts/components/Header";
import StopAudioOnRouteChange from "../src/contexts/components/StopAudioOnRouteChange";
import { Footer } from "../src/contexts/components/Footer";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        loginMethods: ["twitter", "google", "email", "wallet"],
        embeddedWallets: {
          createOnLogin: "all-users",
          solana: { createOnLogin: "all-users" },
        } as any,
        // Only offer Solana wallet connectors (Phantom, Solflare, etc.) — without this,
        // Privy's "wallet" login option defaults to ethereum-and-solana and prompts
        // Ledger/other external wallets for an Ethereum connection instead of Solana.
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: true }) },
        },
        appearance: { theme: "dark", walletChainType: "solana-only" },
      }}
    >
      <NetworkProvider>
        <ClientProvider>
          <Header />
          <StopAudioOnRouteChange />
          {children}
          <Footer />
        </ClientProvider>
      </NetworkProvider>
    </PrivyProvider>
  );
}
