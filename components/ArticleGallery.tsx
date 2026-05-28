"use client";

import Image from "next/image";
import { useState } from "react";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dyn3apjzb";

function cldUrl(publicId: string, w: number, h: number) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,g_auto,w_${w},h_${h},q_auto,f_auto/${publicId}`;
}

type Props = {
  publicIds: string[];
  /** Nazwa sekcji – używana w alt-text. */
  alt: string;
};

/**
 * Galeria zdjęć z folderu Cloudinary danej podstrony. Renderuje siatkę
 * miniatur, po kliknięciu otwiera podgląd na całą szerokość (lightbox).
 * Brak zdjęć → komponent się nie renderuje.
 */
export default function ArticleGallery({ publicIds, alt }: Props) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  if (!publicIds || publicIds.length === 0) return null;

  return (
    <section className="mt-12">
      <h2 className="text-xs uppercase tracking-[0.18em] text-yellow-500 font-semibold mb-4">
        Galeria
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {publicIds.map((id, idx) => (
          <button
            key={id}
            type="button"
            onClick={() => setOpenIdx(idx)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-yellow-500/30 hover:border-yellow-500 transition-colors"
            aria-label={`Powiększ zdjęcie ${idx + 1}`}
          >
            <Image
              src={cldUrl(id, 400, 300)}
              alt={`${alt} – zdjęcie ${idx + 1}`}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </button>
        ))}
      </div>

      {openIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setOpenIdx(null)}
          role="dialog"
          aria-modal="true"
        >
          <button
            type="button"
            onClick={() => setOpenIdx(null)}
            className="absolute top-6 right-6 text-white hover:text-yellow-500 text-4xl leading-none"
            aria-label="Zamknij podgląd"
          >
            ×
          </button>
          <div className="relative w-full max-w-5xl aspect-[4/3]">
            <Image
              src={cldUrl(publicIds[openIdx], 1600, 1200)}
              alt={`${alt} – zdjęcie ${openIdx + 1}`}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>
        </div>
      )}
    </section>
  );
}
