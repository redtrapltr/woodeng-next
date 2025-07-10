import React, { useEffect, useRef } from 'react';

interface AnimatedWelcomeTextProps {
  text: string;
  className?: string;
  waveDelay?: number; // seconds between wave letters (default 0.1)
  waveClassName?: string; // extra class for wave chars (color etc)
}

export function AnimatedWelcomeText({
  text,
  className = '',
  waveDelay = 0.11,
  waveClassName = 'text-primary'
}: AnimatedWelcomeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const words = text.split(' ');
    container.innerHTML = '';

    words.forEach((word, wordIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'inline-block opacity-0 translate-y-8 transition-all';
      wordSpan.style.transition = `opacity 0.7s cubic-bezier(.6,.4,0,1) ${wordIndex * 0.06}s,transform 0.7s cubic-bezier(.6,.4,0,1) ${wordIndex * 0.06}s`;

      const isMoney = word === "Money";
      const isLastSound = word === "Sound" && words[wordIndex + 1] === "Money";

      // Split word into characters for wave
      word.split('').forEach((char, charIndex) => {
        const charSpan = document.createElement('span');
        charSpan.textContent = char;

        if (isMoney || isLastSound) {
          charSpan.className = `inline-block wave-char ${waveClassName}`;
          charSpan.style.animationDelay = `${charIndex * waveDelay}s`;
          charSpan.style.animationDuration = `1.7s`;
        } else {
          charSpan.className = 'inline-block';
        }

        wordSpan.appendChild(charSpan);
      });

      container.appendChild(wordSpan);

      // Add space after word (except last word)
      if (wordIndex < words.length - 1) {
        const space = document.createElement('span');
        space.innerHTML = '&nbsp;';
        container.appendChild(space);
      }
    });

    // Animate in words
    setTimeout(() => {
      container.querySelectorAll('span.inline-block').forEach((span) => {
        (span as HTMLElement).style.opacity = '1';
        (span as HTMLElement).style.transform = 'translateY(0)';
      });
    }, 80);
  }, [text, waveDelay, waveClassName]);

  return (
    <div
      ref={containerRef}
      className={`overflow-hidden w-full ${className}`}
      aria-label={text}
    >
      {text}
    </div>
  );
}
