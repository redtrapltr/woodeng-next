// app/artists/guidelines/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Shield,
  AlertCircle,
  CheckCircle2,
  FileText,
  Music2,
  Image,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';          // already in your project
import { Footer } from '@/contexts/components/Footer';

/* ------------------------------------------------------------------ */
/*  DATA                                                               */
/* ------------------------------------------------------------------ */
const guidelineSections = [
  {
    category: 'Audio Requirements',
    icon: Music2,
    items: [
      'Minimum quality: 320 kbps MP3 or lossless format (WAV, FLAC)',
      'Maximum file size: 100 MB',
      'Supported formats: MP3, WAV, MP4, FLAC, AIFF',
      'No copyrighted samples without proper clearance',
      'Clean, properly mastered audio',
    ],
  },
  {
    category: 'Artwork Requirements',
    icon: Image,
    items: [
      'Minimum resolution: 3000 × 3000 px',
      'Maximum file size: 50 MB',
      'Supported formats: JPG, PNG',
      'Original artwork only',
      'No explicit or offensive content',
    ],
  },
  {
    category: 'Metadata Standards',
    icon: FileText,
    items: [
      'Clear, accurate title and description',
      'Proper artist name and credits',
      'Relevant tags and categories',
      'Complete licensing information',
      'Accurate release date',
    ],
  },
  {
    category: 'Release Timeline',
    icon: Clock,
    items: [
      'Minimum 48-hour review period',
      'Maximum 30-day pre-release window',
      'Regular communication about delays',
      'Co-ordinated marketing timeline',
      'Clear launch schedule',
    ],
  },
] as const;

const bestPractices = [
  {
    title: 'Quality First',
    description:
      'Ensure your music and artwork meet professional standards before submission.',
  },
  {
    title: 'Clear Communication',
    description:
      'Provide detailed information about your release and respond promptly to queries.',
  },
  {
    title: 'Marketing Plan',
    description:
      'Develop a promotion strategy before launch to maximise visibility.',
  },
  {
    title: 'Community Engagement',
    description:
      'Actively engage with your audience before, during, and after release.',
  },
] as const;

/* ------------------------------------------------------------------ */
/*  PAGE                                                               */
/* ------------------------------------------------------------------ */
export default function GuidelinesPage() {
  return (
    <>
      <main className="container mx-auto px-6 py-12 space-y-24">
        {/* ───────── Header ───────── */}
        <section className="text-center space-y-6">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Artist Guidelines</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Follow these guidelines to ensure your music NFTs meet our quality
            standards and provide the best experience for collectors.
          </p>
        </section>

        {/* ───────── Detailed Guidelines ───────── */}
        <section className="space-y-12">
          {guidelineSections.map(({ category, icon: Icon, items }) => (
            <div key={category}>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{category}</h2>
              </div>

              <div className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300">
                <ul className="space-y-4">
                  {items.map((item) => (
                    <li
                      key={item}
                      className="flex items-start gap-3 leading-relaxed"
                    >
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </section>

        {/* ───────── Best Practices ───────── */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-12">
            Best Practices
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestPractices.map(({ title, description }) => (
              <div
                key={title}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
              >
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───────── Important Notes ───────── */}
        <section className="bg-card border border-border rounded-lg p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>

            <div>
              <h2 className="text-xl font-bold mb-4">Important Notes</h2>
              <ul className="space-y-4">
                {[
                  'All submissions are reviewed manually by our team.',
                  'Guidelines may change with platform updates.',
                  'Repeated violations may result in account restrictions.',
                ].map((note) => (
                  <li
                    key={note}
                    className="flex items-start gap-3 leading-relaxed"
                  >
                    <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ───────── Resources & Support ───────── */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4">Need Help?</h3>
            <p className="text-muted-foreground mb-6">
              Our support team is available to help you with any questions
              about these guidelines.
            </p>

            <Link
              href="/contact"
              className={cn(
                'inline-flex items-center gap-2 font-medium text-primary',
                'hover:text-primary/80 transition-colors',
              )}
            >
              Contact Support
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      {/* keep footer at bottom */}
      <Footer />
    </>
  );
}
