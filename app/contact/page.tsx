'use client';

import React from 'react';
import ContactForm from '@/contexts/components/ContactForm';  // ✅ path
import { Footer }  from '@/contexts/components/Footer';

export default function ContactPage() {
  return (
    /*  min-height flex-column keeps footer at the bottom  */
    <div className="min-h-screen flex flex-col">
      <div className="flex-grow py-12 px-4">
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

      {/* sticky footer */}
      <Footer />
    </div>
  );
}
