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
import { Footer } from '@/contexts/components/Footer';

export default function GuidelinesPage() {
  const guidelines = [
    {
      category: "Music NFT - Audio Requirements",
      icon: Music2,
      items: [
        "Minimum quality: 320kbps MP3 or lossless format",
        "Supported formats: MP3, MP4, WAV, FLAC, AIFF",
        "Maximum file size: 100MB",
        "No copyrighted samples without proper clearance",
        "Clean, properly mastered audio"
      ]
    },
    {
      category: "Sound Meme - Audio Requirements",
      icon: Music2,
      items: [
        "Maximum duration: 3 minutes",
        "Supported formats: MP3, M4A (AAC), OGG",
        "Maximum file size: 25MB",
        "Creative and original content",
        "Clean audio quality"
      ]
    },
    {
      category: "Music NFT - Artwork Requirements",
      icon: Image,
      items: [
        "Minimum resolution: 3000x3000 pixels",
        "Supported formats: JPG, PNG",
        "Maximum file size: 50MB",
        "Original artwork only",
        "No explicit or offensive content"
      ]
    },
    {
      category: "Sound Meme - Artwork Requirements",
      icon: Image,
      items: [
        "Image is optional but recommended",
        "Supported formats: PNG, JPG",
        "Maximum file size: 50MB",
        "Original artwork only",
        "No explicit or offensive content"
      ]
    },
    {
      category: "Metadata Standards",
      icon: FileText,
      items: [
        "Clear, accurate title and description",
        "Proper artist name and credits",
        "Relevant tags and categories",
        "Complete licensing information",
        "Accurate release date"
      ]
    },
    {
      category: "Release Timeline",
      icon: Clock,
      items: [
        "Minimum 48-hour review period",
        "Maximum 30-day pre-release window",
        "Regular communication about delays",
        "Coordinated marketing timeline",
        "Clear launch schedule"
      ]
    }
  ];

  const bestPractices = [
    {
      title: "Quality First",
      description: "Ensure your music and artwork meet professional standards before submission"
    },
    {
      title: "Clear Communication",
      description: "Provide detailed information about your release and respond promptly to queries"
    },
    {
      title: "Marketing Plan",
      description: "Develop a promotion strategy before launch to maximize visibility"
    },
    {
      title: "Community Engagement",
      description: "Actively engage with your audience before, during, and after release"
    }
  ];

  return (
    <>
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-12 space-y-24">
        {/* Header */}
        <section className="text-center space-y-6">
          <div className="inline-flex p-4 rounded-full bg-primary/10 mb-4">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-4xl font-bold">Artist Guidelines</h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Follow these guidelines to ensure your music NFTs meet our quality standards
            and provide the best experience for collectors.
          </p>
        </section>

        {/* Guidelines Sections */}
        <section className="space-y-12">
          {guidelines.map((section, index) => {
            const Icon = section.icon;
            return (
              <div key={index}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">{section.category}</h2>
                </div>
                <div className="bg-card border border-border rounded-lg p-6">
                  <ul className="space-y-4">
                    {section.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </section>

        {/* Best Practices */}
        <section>
          <h2 className="text-3xl font-bold text-center mb-12">Best Practices</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {bestPractices.map((practice, index) => (
              <div
                key={index}
                className="bg-card border border-border rounded-lg p-6 hover:border-primary/50 transition-all duration-300"
              >
                <h3 className="font-semibold mb-2">{practice.title}</h3>
                <p className="text-muted-foreground">{practice.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Important Notes */}
        <section className="bg-card border border-border rounded-lg p-8">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <AlertCircle className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold mb-4">Important Notes</h2>
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>All submissions are reviewed manually by our team</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Guidelines are subject to change with platform updates</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                  <span>Repeated violations may result in account restrictions</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Resources & Support */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8">
            <h3 className="text-xl font-bold mb-4">Need Help?</h3>
            <p className="text-muted-foreground mb-6">
              Our support team is available to help you with any questions about these guidelines.
            </p>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 transition-colors"
            >
              Contact Support
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
