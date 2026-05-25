"use client";

import { useState, useEffect } from 'react';
import { Yuji_Mai } from 'next/font/google';

const yujiMai = Yuji_Mai({
  weight: '400',
  // Dla fontów japońskich (zawierających tysiące znaków) najlepiej
  // wyłączyć preload, aby uniknąć błędów przy budowaniu aplikacji.
  preload: false,
});

interface KanjiProps {
  characters: string[];
  side: 'left' | 'right';
}

export default function VerticalKanji({ characters, side }: KanjiProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [footerVisible, setFooterVisible] = useState(false);

  // Stopniowe pojawianie się kolejnych znaków (efekt początkowy).
  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => (prev < characters.length ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, [characters.length]);

  // Chowamy kanji gdy stopka wjeżdża w viewport – fixed kanji w przeciwnym razie
  // nakładałyby się wizualnie na stopkę (są niżej w z-stacku i prześwitują).
  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0, rootMargin: '0px' },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const positionClass = side === 'left' ? 'left-8 2xl:left-4' : 'right-8 2xl:right-4';

  return (
    <div
      aria-hidden="true"
      className={`fixed top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-10 text-8xl text-white z-10 pointer-events-none transition-opacity duration-500 ${
        footerVisible ? 'opacity-0' : 'opacity-20'
      } ${positionClass} ${yujiMai.className}`}
    >
      {characters.map((char, index) => (
        <span
          key={index}
          className={`transition-opacity duration-1000 ${
            index < visibleCount ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
