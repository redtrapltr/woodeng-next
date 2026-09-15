"use client";

// Chain-mode context: switches the whole app between the Solana launchpad and
// the Robinhood Chain (EVM) launchpad. Named ChainMode/useChainMode (not
// Network/useNetwork) to avoid colliding with app/network-context.tsx, which
// already exports useNetwork() for the Solana RPC endpoint (devnet/mainnet).
import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { RH_CONFIG } from "../lib/robinhoodChain";

export type ChainMode = "solana" | "robinhood";

const STORAGE_KEY = "woodeng_network";

interface ChainModeContextValue {
  network: ChainMode;
  setNetwork: (n: ChainMode) => void;
  isSolana: boolean;
  isRobinhood: boolean;
  // Robinhood Chain config — mirrors RH_CONFIG (mainnet by default, testnet
  // when NEXT_PUBLIC_RH_NETWORK=testnet)
  rhChainId: number;
  rhRpc: string;
  rhFactoryAddress: `0x${string}`;
  rhGateAddress: `0x${string}`;
  rhExplorer: string;
}

const ChainModeContext = createContext<ChainModeContextValue>(null!);

export function ChainModeProvider({ children }: { children: ReactNode }) {
  const [network, setNetwork] = useState<ChainMode>("robinhood");

  // Read persisted choice after mount only — keeps SSR and first client render
  // in sync (both "robinhood") so hydration never mismatches.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "solana" || stored === "robinhood") setNetwork(stored);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, network);
    document.documentElement.setAttribute("data-network", network);
  }, [network]);

  return (
    <ChainModeContext.Provider
      value={{
        network,
        setNetwork,
        isSolana: network === "solana",
        isRobinhood: network === "robinhood",
        rhChainId: RH_CONFIG.chainId,
        rhRpc: RH_CONFIG.rpc,
        rhFactoryAddress: RH_CONFIG.factory,
        rhGateAddress: RH_CONFIG.gate,
        rhExplorer: RH_CONFIG.explorer,
      }}
    >
      {children}
    </ChainModeContext.Provider>
  );
}

export function useChainMode() {
  return useContext(ChainModeContext);
}
