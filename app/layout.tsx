import "./globals.css";
import type { ReactNode } from "react";
import ClientShell from "./client-shell";

export const metadata = {
  title: "Woodeng Next 13",
  description: "dApp Solana with Next.js 13",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="safe-top" style={{ margin: 0, padding: 0, background: "#000", color: "white" }}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
