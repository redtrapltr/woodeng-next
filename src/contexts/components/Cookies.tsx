'use client';

import React from 'react';
import { Cookie, Shield } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

/*───────────────────────────
  Types & static data
───────────────────────────*/
const lastUpdated = 'June 30, 2025';

type Bullet = string;

type CookieCategory = {
  type:        string;
  description: string;
  examples:    string[];
  duration:    string;
};

type Section =
  | { title: string; content: Bullet[] }           // simple paragraphs / bullets
  | { title: string; content: CookieCategory[] };  // table-like cookie blocks

const sections: Section[] = [
  /* 1 – What is a cookie? */
  {
    title: '1. What is a Cookie?',
    content: [
      'A cookie is a small text file stored on your device when browsing our website. These files help remember your preferences and improve your user experience.',
    ],
  },

  /* 2 – Types we use */
  {
    title: '2. Types of Cookies We Use',
    content: [
      {
        type: 'Essential Cookies',
        description: 'Required for site functionality',
        examples: [
          'Authentication and security',
          'Session management',
          'Essential preferences storage',
        ],
        duration: 'Session – 1 year',
      },
      {
        type: 'Performance Cookies',
        description: 'Analyze site usage',
        examples: ['Navigation statistics', 'Error identification', 'New feature testing'],
        duration: '1 day – 2 years',
      },
      {
        type: 'Functionality Cookies',
        description: 'Customize experience',
        examples: ['Language preferences', 'Search history', 'Personalized recommendations'],
        duration: 'Session – 1 year',
      },
      {
        type: 'Marketing Cookies',
        description: 'Targeted advertising and content',
        examples: ['Personalized ads', 'Behavior analysis', 'Social-media sharing'],
        duration: '3 months – 2 years',
      },
    ],
  },

  /* 3 – Cookie management */
  {
    title: '3. Cookie Management',
    content: [
      'You can modify your cookie preferences at any time.',
      'Disabling certain cookies may limit access to features.',
      'Essential cookies cannot be disabled.',
      'Use your browser settings to manage cookies.',
    ],
  },

  /* 4 – Data retention */
  {
    title: '4. Data Retention',
    content: [
      'Essential cookies are deleted when closing the browser.',
      'Performance cookies are kept for up to 2 years.',
      'Functionality cookies expire after 1 year.',
      'Marketing cookies are retained for up to 2 years.',
    ],
  },

  /* 5 – Your rights */
  {
    title: '5. Your Rights',
    content: [
      'Right to access your data.',
      'Right to modify preferences.',
      'Right to object to non-essential cookies.',
      'Right to erasure of collected data.',
    ],
  },
];

/*───────────────────────────
  Helper – type guard
───────────────────────────*/
function isCookieCategoryArray(
  content: Section['content'],
): content is CookieCategory[] {
  return typeof content[0] !== 'string';
}

/*───────────────────────────
  Component
───────────────────────────*/
export default function Cookies() {
  return (
    <div className="py-12 space-y-12">
      {/* HEADER */}
      <header className="text-center space-y-6">
        <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
          <Cookie className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-4xl font-bold">Cookie Policy</h1>
        <p className="text-muted-foreground">Last updated: {lastUpdated}</p>
      </header>

      {/* INTRO */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-2 text-primary">
            <Shield className="w-5 h-5" />
            <p className="font-medium">Your privacy matters</p>
          </div>
          <p className="text-muted-foreground">
            This cookie policy explains how Woodeng uses cookies and similar technologies to
            enhance your experience.
          </p>
        </div>
      </div>

      {/* SECTIONS */}
      <div className="max-w-3xl mx-auto space-y-12">
        {sections.map((section, idx) => (
          <div key={idx} className="space-y-4">
            <h2 id={`section-${idx + 1}`} className="text-2xl font-bold">
              {section.title}
            </h2>

            {/* — simple bullet paragraphs — */}
            {!isCookieCategoryArray(section.content) && (
              <ul className="space-y-2">
                {section.content.map((txt, i) => (
                  <li key={i} className="flex items-start gap-3 text-muted-foreground">
                    <span className="select-none">•</span>
                    <span>{txt}</span>
                  </li>
                ))}
              </ul>
            )}

            {/* — cookie-category cards — */}
            {isCookieCategoryArray(section.content) && (
              <div className="grid gap-6">
                {section.content.map((cookie, i) => (
                  <div key={i} className="bg-card border border-border rounded-lg p-6 space-y-4">
                    <div className="space-y-1">
                      <h4 className="font-semibold">{cookie.type}</h4>
                      <p className="text-sm text-muted-foreground">{cookie.description}</p>
                    </div>

                    {/* examples */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Examples:</p>
                      <ul className="space-y-1">
                        {cookie.examples.map((ex, j) => (
                          <li
                            key={j}
                            className="flex items-start gap-2 text-sm text-muted-foreground"
                          >
                            <span className="select-none">•</span>
                            <span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <p className="text-sm">
                      <span className="font-medium">Duration:&nbsp;</span>
                      <span className="text-muted-foreground">{cookie.duration}</span>
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* CONTACT CTA */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold mb-4">Questions?</h2>
          <p className="text-muted-foreground mb-6">
            If you have any questions about our use of cookies, please don&rsquo;t hesitate to
            contact us.
          </p>
          <Link
            href="/contact"
            className={cn(
              'inline-flex px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors',
            )}
          >
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}
