"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const DEFAULT_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC as string;

interface NetworkContextValue {
  endpoint: string;
  setEndpoint: (url: string) => void;
}

const NetworkContext = createContext<NetworkContextValue>({
  endpoint: DEFAULT_ENDPOINT,
  setEndpoint: () => {},
});

export function NetworkProvider({ children }: { children: ReactNode }) {
  const [endpoint, setEndpoint] = useState(DEFAULT_ENDPOINT);
  return (
    <NetworkContext.Provider value={{ endpoint, setEndpoint }}>
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
