"use client";

import { useState, useEffect } from 'react';
import { CldImage } from 'next-cloudinary';
import Masonry from 'react-masonry-css';
import { getImagesFromFolder } from '../actions/galleryActions';

// Definiujemy typ, jaki przyjdzie z serwera
interface Folder {
  name: string;
  path: string;
}

interface GalleryClientProps {
  folders: Folder[];
}

export default function GalleryClient({ folders }: GalleryClientProps) {
  // Stan przechowujący aktualnie wybrany folder (domyślnie pierwszy z listy, jeśli istnieje)
  const [activeFolder, setActiveFolder] = useState<Folder | null>(folders[0] || null);
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Funkcja ładująca zdjęcia po kliknięciu w zakładkę
  useEffect(() => {
    if (!activeFolder) return;

    const fetchImages = async () => {
      setIsLoading(true);
      const publicIds = await getImagesFromFolder(activeFolder.path);
      setImages(publicIds);
      setIsLoading(false);
    };

    fetchImages();
  }, [activeFolder]);

  // Ustawienia dla paczki Masonry (ile kolumn na jakich ekranach)
  const breakpointColumnsObj = {
    default: 4,
    1280: 3,
    768: 2,
    640: 1
  };

  return (
    <div className="w-full">
      {/* Pasek zakładek */}
      <div className="flex flex-wrap justify-center items-center gap-6 border-b border-neutral-800 pb-4 mb-10">
        {folders.map((folder) => (
          <button
            key={folder.path}
            onClick={() => setActiveFolder(folder)}
            className={`text-sm md:text-base font-bold uppercase tracking-wider transition-colors relative pb-2 ${
              activeFolder?.path === folder.path 
                ? 'text-yellow-500' 
                : 'text-neutral-400 hover:text-yellow-500'
            }`}
          >
            {/* Dodajemy wizualny znak "*", gdy zakładka jest aktywna (jak na screenie) */}
            {activeFolder?.path === folder.path && (
              <span className="text-red-500 mr-2 text-xl align-middle">*</span>
            )}
            {/* Nazwy folderów na Cloudinary są małą literą, więc używamy capitalize, żeby ładnie wyglądały */}
            <span className="capitalize">{folder.name}</span>

            {/* Złota linia pod aktywną zakładką */}
            {activeFolder?.path === folder.path && (
              <span className="absolute left-0 bottom-[-17px] w-full h-[2px] bg-yellow-500"></span>
            )}
          </button>
        ))}
      </div>

      {/* Wyświetlanie stanu ładowania */}
      {isLoading ? (
        <div className="text-center text-yellow-500 py-20 animate-pulse">
          Wczytywanie zwojów...
        </div>
      ) : (
        /* Siatka Masonry w akcji */
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="flex w-auto -ml-4" // Tailwind załatwia "ujemny margines" siatki
          columnClassName="pl-4 bg-clip-padding space-y-4" // Odstępy między kolumnami i wierszami
        >
          {images.map((publicId) => (
            <div key={publicId} className="relative group overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800 cursor-pointer">
              <CldImage
                width="800"
                height="800"
                src={publicId}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                alt="Galeria Shorinji Kempo"
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Złoty overlay pojawiający się po najechaniu myszką */}
              <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </Masonry>
      )}

      {/* Wiadomość, gdy folder jest pusty */}
      {!isLoading && images.length === 0 && (
        <div className="text-center text-neutral-500 py-20">
          Brak zdjęć w tym folderze.
        </div>
      )}
    </div>
  );
}