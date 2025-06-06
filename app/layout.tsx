import './globals.css';
import type { ReactNode } from 'react';
import ClientProvider from './client-provider';
import Header from '../src/contexts/components/Header'; // Adjust path if needed

export const metadata = {
  title: 'Woodeng Next 13',
  description: 'dApp Solana with Next.js 13',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, background: '#000', color: 'white' }}>
        <ClientProvider>
          <Header />
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
