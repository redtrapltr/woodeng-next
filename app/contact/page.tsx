'use client';

import React from 'react';
import ContactForm from '@/contexts/components/ContactForm';
import { Footer }  from '@/contexts/components/Footer';

export default function ContactPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* push content below fixed header */}
      <div className="flex-grow px-4 pt-24 md:pt-28 pb-12">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4">Contact Us</h1>
            <p className="text-xl text-muted-foreground">
              Send us a message and we’ll get back to you as soon as possible.
            </p>
          </div>

          <ContactForm />
        </div>
      </div>

      <Footer />
    </div>
  );
}
