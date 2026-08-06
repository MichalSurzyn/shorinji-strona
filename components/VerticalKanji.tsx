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
 * Kolumna ma szerokość CAŁEGO marginesu strony (miejsca między krawędzią
 * ekranu a treścią `.container-site` = min(90%, 87.5rem)), a flexbox centruje
 * znaki - kanji siedzą więc zawsze idealnie pośrodku między krawędzią a treścią.
 * Pojawianie się znaków to czysta animacja CSS (keyframes w globals.css),
 * dzięki czemu kanji widać nawet zanim/bez zhydratowania JS.
 */
export default function VerticalKanji({ characters, side }: KanjiProps) {
  const [footerVisible, setFooterVisible] = useState(false);

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
      className={`fixed ${positionClass} hidden xl:flex flex-col items-center justify-center gap-[4vh] text-white z-10 pointer-events-none transition-opacity duration-500 ${
        footerVisible ? 'opacity-0' : 'opacity-20'
      } ${yujiMai.className}`}
      style={{
        // Zaczynamy pod navbarem (--nav-h, ta sama zmienna co .page-shell),
        // żeby fixed nav (z-50, tło pełne) nie zasłaniał górnych znaków.
        top: 'var(--nav-h)',
        bottom: 0,
        // Szerokość = margines strony (kontener to min(90%, 87.5rem), reszta / 2).
        width: 'calc((100% - min(90%, 87.5rem)) / 2)',
        fontSize: 'clamp(3.5rem, 4.5vw, 6rem)',
      }}
    >
      {characters.map((char, index) => (
        <span
          key={index}
          className="kanji-fade-in"
          style={{ animationDelay: `${index * 0.6}s` }}
        >
          {char}
        </span>
      ))}
    </div>
  );
}
