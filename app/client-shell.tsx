"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { NetworkProvider } from "./network-context";
import { ChainModeProvider } from "./contexts/NetworkContext";
import RobinhoodParticles from "./components/RobinhoodParticles";
import ClientProvider from "./client-provider";
import Header from "../src/contexts/components/Header";
import StopAudioOnRouteChange from "../src/contexts/components/StopAudioOnRouteChange";
import { Footer } from "../src/contexts/components/Footer";
import { robinhoodChain } from "./lib/robinhoodChain";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID!}
      config={{
        // "wallet" first so Connect Wallet is the prominent option, not buried
        // behind social logins.
        loginMethods: ["wallet", "twitter", "google", "email"],
        // Solana keeps auto-creating for every login (established Woodeng UX).
        // Ethereum only auto-creates for users who land with zero EVM wallet
        // at all — a user who connects MetaMask/Phantom directly already has
        // one, so Privy skips creating a redundant embedded wallet for them.
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
          ethereum: { createOnLogin: "users-without-wallets" },
        } as any,
        // Solana connectors (Phantom, Solflare, etc.) alongside Privy's default
        // Ethereum connectors (MetaMask, Coinbase Wallet, ...) — both chains'
        // external wallets are offered side by side in the connect modal.
        externalWallets: {
          solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: true }) },
        },
        appearance: { theme: "dark", walletChainType: "ethereum-and-solana" },
        // The app's only EVM chain is Robinhood Chain (mainnet by default,
        // testnet when NEXT_PUBLIC_RH_NETWORK=testnet — see RH_CONFIG in
        // app/lib/robinhoodChain.ts), which isn't one of Privy's built-in
        // default chains — without registering it here,
        // wallet.switchChain(...) in useRobinhoodWallet.ts throws
        // "Unsupported chainId" before every write.
        supportedChains: [robinhoodChain],
        defaultChain: robinhoodChain,
      }}
    >
      <NetworkProvider>
        <ChainModeProvider>
          <RobinhoodParticles />
          <ClientProvider>
            <Header />
            <StopAudioOnRouteChange />
            {children}
            <Footer />
          </ClientProvider>
        </ChainModeProvider>
      </NetworkProvider>
    </PrivyProvider>
  );
}
