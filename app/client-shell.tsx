"use client";

import type { ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";
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
        appearance: { theme: "dark" },
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
