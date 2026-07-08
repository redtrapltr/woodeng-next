import "./globals.css";
import type { ReactNode } from "react";
import ClientShell from "./client-shell";

export const metadata = {
  title: "Woodeng",
  description: "Meme launchpad for SWL-444 standard ",
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
      <head>
        {/* Jupiter Terminal — loaded for graduated pool swap embeds */}
        <script src="https://terminal.jup.ag/main-v3.js" data-preload async />
      </head>
      <body className="safe-top" style={{ margin: 0, padding: 0, background: "#000", color: "white" }}>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}
