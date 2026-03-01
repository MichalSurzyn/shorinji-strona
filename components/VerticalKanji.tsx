"use client";

import { useState, useEffect } from 'react';
//importujemy font bezpośrednio
import { Yuji_Mai } from 'next/font/google';

// 2. Konfigurujemy font
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

  useEffect(() => {
    const interval = setInterval(() => {
      setVisibleCount((prev) => (prev < characters.length ? prev + 1 : prev));
    }, 600);

    return () => clearInterval(interval);
  }, [characters.length]);

  const positionClass = side === 'left' ? 'left-8 2xl:left-4' : 'right-8 2xl:right-4';

  return (
    // 3. Dodajemy yujiMai.className do głównego kontenera
    <div className={`fixed opacity-20 top-1/2 -translate-y-1/2 hidden xl:flex flex-col gap-10 text-8xl text-white z-10 ${positionClass} ${yujiMai.className}`}>
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