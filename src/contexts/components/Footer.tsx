// src/contexts/components/Footer.tsx
import React from "react";
import Link from "next/link";
import { X, Send, Mail } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-auto pt-8 pb-40 md:pb-24 px-4">
      <div className="w-full">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div className="space-y-4">
            <div>
              <img
                src="https://i.postimg.cc/pTd49kBG/Woo-Logo.png"
                alt="Woo Logo"
                className="h-20 w-auto"
              />
            </div>
            <p className="text-muted-foreground text-sm">
              Music NFT’s & Sound Memes decentralized platform.
            </p>
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <a
                  href="https://x.com/Woodeng_SOL"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </a>
                <a
                  href="https://t.me/woodeng_sol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <Send className="w-4 h-4 text-white" />
                </a>
                <Link href="/contact" className="p-2 hover:bg-muted rounded-full transition-colors">
                  <Mail className="w-4 h-4 text-white" />
                </Link>
              </div>
              <a
                href="mailto:contact@woodengsol.com"
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                contact@woodengsol.com
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4 text-sm md:text-base text-white">
              Quick Links
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/how-it-works" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                How It Works
              </Link>
              <Link href="/faq" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                FAQ
              </Link>
              <Link href="/contact" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Contact
              </Link>
              <Link href="/whitepaper" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Whitepaper
              </Link>
              <Link href="/artists/guidelines" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Guidelines
              </Link>
            </div>
          </div>

          {/* Legal & Documentation */}
          <div>
            <h3 className="font-semibold mb-4 text-sm md:text-base text-white">
              Legal & Documentation
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/terms" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-muted-foreground hover:text-white transition-colors text-sm py-1">
                Cookie Policy
              </Link>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 pt-4 border-t border-border text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Woodeng Ecosystem. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
