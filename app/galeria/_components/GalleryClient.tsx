"use client";

import { useEffect, useRef, useState } from "react";
import { CldImage } from "next-cloudinary";
import Masonry from "react-masonry-css";
import { getImagesFromFolder, type GalleryFolder } from "../../../actions/galleryActions";

/**
 * Galeria w dwóch widokach.
 *
 * 1. Albumy - kafelki ze zdjęciami nałożonymi na siebie, jak stos odbitek.
 * 2. Album otwarty - te same zdjęcia rozlane w siatkę.
 *
 * Wcześniej był tylko pasek zakładek na górze i jedna siatka. Przy kilku
 * albumach nie widać było, co jest w środku, dopóki się nie kliknęło.
 */

const KOLUMNY = { default: 4, 1280: 3, 768: 2, 640: 1 };

/** Album „Wszystkie zdjęcia" - wirtualny, zbiera zawartość pozostałych. */
const WSZYSTKIE = "all";

/**
 * Okładka albumu: do trzech zdjęć nałożonych na siebie, jak stos odbitek.
 *
 * NA WIERZCHU LEŻY covers[0]. Wcześniej głębokość liczyliśmy od końca tablicy,
 * więc na wierzchu lądowało trzecie zdjęcie od końca - a redaktor nie miał jak
 * wskazać, które ma być widoczne. Odwrócenie tej kolejności daje jedną regułę:
 * pierwsze zdjęcie listy jest okładką albumu, także wtedy, gdy zostało
 * wyróżnione ręcznie w panelu.
 *
 * Obrót nadal przypisujemy według GŁĘBOKOŚCI, nie według liczby zdjęć.
 * Przy liczeniu od końca album z dwoma zdjęciami wyglądał jak stos,
 * a z dwudziestoma jak pojedyncze zdjęcie.
 *
 * Warstwy pod spodem zostają w skali 1. Pomniejszone o 8% chowały się
 * całkowicie: kwadrat obrócony o 6° wystaje poza swój obrys o około 5%,
 * czyli mniej, niż zabierało pomniejszenie.
 */
function Stos({ covers, alt }: { covers: string[]; alt: string }) {
  const widoczne = covers.slice(0, 3);

  if (!widoczne.length) {
    return (
      <div className="aspect-square rounded-xl border border-neutral-800 bg-neutral-900 flex items-center justify-center">
        <span aria-hidden className="text-4xl text-neutral-700">
          ▢
        </span>
      </div>
    );
  }

  /** Obrót według głębokości: wierzch prosto, spód najbardziej odchylony. */
  const obrotDlaGlebokosci = ["rotate-0", "rotate-6", "-rotate-6"];

  return (
    <div className="relative aspect-square">
      {widoczne.map((publicId, i) => {
        const glebokosc = i; // 0 = wierzch, czyli covers[0]
        const naWierzchu = glebokosc === 0;
        return (
          <div
            key={publicId}
            className={`absolute inset-0 overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900 transition-transform duration-500 ${
              obrotDlaGlebokosci[glebokosc]
            } ${naWierzchu ? "shadow-2xl shadow-black/60" : "shadow-lg"} group-hover:rotate-0`}
            style={{ zIndex: widoczne.length - 1 - i }}
          >
            <CldImage
              width="600"
              height="600"
              src={publicId}
              sizes="(max-width: 640px) 90vw, (max-width: 1024px) 45vw, 30vw"
              /* Opis tylko dla wierzchniego - pozostałe są dekoracją. */
              alt={naWierzchu ? alt : ""}
              className="w-full h-full object-cover"
            />
          </div>
        );
      })}
    </div>
  );
}

export default function GalleryClient({ folders }: { folders: GalleryFolder[] }) {
  const [otwarty, setOtwarty] = useState<GalleryFolder | null>(null);
  // Raz wczytany album zostaje w pamięci - powrót do niego nie kosztuje
  // kolejnego zapytania do Cloudinary.
  const [cache, setCache] = useState<Record<string, string[]>>({});
  // Albumy, o które już zapytaliśmy. Referencja, nie stan - nic w renderze
  // od tego nie zależy, a stan wymuszałby zapis wewnątrz efektu i kaskadę
  // renderów.
  const wZapytaniu = useRef<Set<string>>(new Set());

  // Lista zdjęć jest WYPROWADZONA z pamięci podręcznej, nie trzymana osobno.
  const images = otwarty ? cache[otwarty.path] : undefined;
  const isLoading = !!otwarty && images === undefined;

  useEffect(() => {
    if (!otwarty) return;
    const sciezka = otwarty.path;
    if (cache[sciezka] !== undefined || wZapytaniu.current.has(sciezka)) return;
    wZapytaniu.current.add(sciezka);

    let aktualne = true;
    getImagesFromFolder(sciezka)
      .then((publicIds) => {
        if (aktualne) setCache((p) => ({ ...p, [sciezka]: publicIds }));
      })
      .catch(() => {
        // Pusta tablica zamiast wiecznego „wczytywanie" - odwiedzający
        // dostanie komunikat o pustym albumie zamiast zawieszonej strony.
        if (aktualne) setCache((p) => ({ ...p, [sciezka]: [] }));
      });
    return () => {
      aktualne = false;
    };
  }, [otwarty, cache]);

  const wszystkieZdjec = folders.reduce((s, f) => s + f.count, 0);

  /* ---------------- Widok albumu ---------------- */
  if (otwarty) {
    return (
      <div className="w-full">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-neutral-800 pb-4 mb-10">
          <div>
            <button
              onClick={() => setOtwarty(null)}
              className="text-sm text-neutral-400 hover:text-yellow-500 transition-colors"
            >
              ← Wszystkie albumy
            </button>
            <h2 className="text-2xl md:text-3xl font-bold text-white capitalize mt-1">
              {otwarty.path === WSZYSTKIE ? "Wszystkie zdjęcia" : otwarty.name}
            </h2>
          </div>
          {!isLoading && (images?.length ?? 0) > 0 && (
            <p className="text-sm text-neutral-500">
              {images!.length} {images!.length === 1 ? "zdjęcie" : "zdjęć"}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="text-center text-yellow-500 py-20 animate-pulse font-bold tracking-widest uppercase">
            Wczytywanie zdjęć...
          </div>
        ) : (images?.length ?? 0) === 0 ? (
          <div className="text-center text-neutral-500 py-20">Ten album jest jeszcze pusty.</div>
        ) : (
          <Masonry
            breakpointCols={KOLUMNY}
            className="flex w-auto -ml-4"
            columnClassName="pl-4 bg-clip-padding space-y-4"
          >
            {images!.map((publicId) => (
              <div
                key={publicId}
                className="relative group overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800"
              >
                <CldImage
                  width="800"
                  height="800"
                  src={publicId}
                  sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                  alt={`Zdjęcie z albumu ${otwarty.name}`}
                  className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
              </div>
            ))}
          </Masonry>
        )}
      </div>
    );
  }

  /* ---------------- Widok albumów ---------------- */
  const albumWszystkie: GalleryFolder = {
    name: "Wszystkie zdjęcia",
    path: WSZYSTKIE,
    covers: folders.flatMap((f) => f.covers).slice(0, 3),
    count: wszystkieZdjec,
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 md:gap-8">
        {[albumWszystkie, ...folders].map((f) => (
          <button
            key={f.path}
            onClick={() => setOtwarty(f)}
            className="group text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-500 rounded-xl"
          >
            <Stos covers={f.covers} alt={`Album ${f.name}`} />
            <p className="mt-4 font-bold uppercase tracking-wider text-sm text-neutral-200 group-hover:text-yellow-500 transition-colors">
              {f.name}
            </p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {f.count === 0 ? "pusty" : `${f.count} ${f.count === 1 ? "zdjęcie" : "zdjęć"}`}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
