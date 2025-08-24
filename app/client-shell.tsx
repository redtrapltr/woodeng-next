"use client";

import type { ReactNode } from "react";
import ClientProvider from "./client-provider";
import Header from "../src/contexts/components/Header";
import StopAudioOnRouteChange from "../src/contexts/components/StopAudioOnRouteChange";

export default function ClientShell({ children }: { children: ReactNode }) {
  return (
    <ClientProvider>
      <Header />
      <StopAudioOnRouteChange />
      {children}
    </ClientProvider>
  );
}
