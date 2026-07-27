"use client";

import { useState, useEffect } from 'react';
import { Yuji_Mai } from 'next/font/google';

const yujiMai = Yuji_Mai({
  weight: '400',
  preload: false,
});

interface KanjiProps {
  characters: string[];
  side: 'left' | 'right';
}

/**
 * Dekoracyjne pionowe kanji przy krawędziach ekranu.
 * Kolumna zajmuje CAŁĄ wysokość okna (inset-y-0) i centruje znaki
 * flexboxem - zero przeliczania translate, więc nic się nie rozjeżdża
 * przy zmianach szerokości/wysokości okna. Odstęp między znakami
 * skaluje się z wysokością viewportu (gap w vh), a rozmiar znaku
 * z szerokością (clamp), żeby całość zawsze mieściła się na ekranie.
 */
export default function VerticalKanji({ characters, side }: KanjiProps) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => (prev < characters.length ? prev + 1 : prev));
    }, 600);
    return () => clearInterval(interval);
  }, [characters.length]);

  useEffect(() => {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const positionClass = side === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-y-0 ${positionClass} w-24 2xl:w-28 hidden xl:flex flex-col items-center justify-center gap-[4vh] text-white z-10 pointer-events-none transition-opacity duration-500 ${
        footerVisible ? 'opacity-0' : 'opacity-20'
      } ${yujiMai.className}`}
      style={{ fontSize: 'clamp(3.5rem, 4.5vw, 6rem)' }}
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
