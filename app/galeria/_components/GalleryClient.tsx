"use client";

import { useState, useEffect } from 'react';
import { CldImage } from 'next-cloudinary';
import Masonry from 'react-masonry-css';
import { getImagesFromFolder } from '../../../actions/galleryActions';

interface Folder {
  name: string;
  path: string;
}

interface GalleryClientProps {
  folders: Folder[];
}

export default function GalleryClient({ folders }: GalleryClientProps) {
  // Dodajemy wirtualny folder "Wszystkie" (z gwiazdką) na sam początek listy zakładek
  const allTabs = [{ name: '*', path: 'all' }, ...folders];
  
  // Domyślnie ładujemy gwiazdkę (wszystkie zdjęcia)
  const [activeFolder, setActiveFolder] = useState<Folder>(allTabs[0]);
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // PAMIĘĆ PODRĘCZNA (CACHE) dla API
  // Kiedy raz załadujesz zakładkę, zdjęcia zapisują się tutaj. 
  // Wróć do niej, a załaduje się natychmiast, za 0 zapytań do API Cloudinary!
  const [imageCache, setImageCache] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const fetchImages = async () => {
      // Optymalizacja: Sprawdzamy, czy mamy już te zdjęcia w naszej pamięci
      if (imageCache[activeFolder.path]) {
        setImages(imageCache[activeFolder.path]);
        return; 
      }

      setIsLoading(true);
      const publicIds = await getImagesFromFolder(activeFolder.path);
      
      // Zapisujemy nowy wynik do pamięci podręcznej oraz do wyświetlenia
      setImageCache(prev => ({ ...prev, [activeFolder.path]: publicIds }));
      setImages(publicIds);
      setIsLoading(false);
    };

    fetchImages();
  }, [activeFolder, imageCache]);

  const breakpointColumnsObj = {
    default: 4,
    1280: 3,
    768: 2,
    640: 1
  };

  return (
    <div className="w-full">
      {/* Pasek zakładek */}
      <div className="flex flex-wrap justify-center items-baseline gap-6 border-b border-neutral-800 pb-4 mb-10">
        {allTabs.map((folder) => (
          <button
            key={folder.path}
            onClick={() => setActiveFolder(folder)}
            className={`font-bold uppercase tracking-wider transition-colors relative pb-2 ${
              activeFolder.path === folder.path 
                ? 'text-yellow-500' 
                : 'text-neutral-400 hover:text-yellow-500'
            }`}
          >
            {/* Specjalne stylowanie gwiazdki (większa, przesunięta) */}
            {folder.name === '*' ? (
              <span className="text-2xl md:text-3xl inline-block translate-y-2">*</span>
            ) : (
              <span className="text-sm md:text-base capitalize">{folder.name}</span>
            )}

            {/* Złota linia pokazująca się pod aktualnie wybraną zakładką */}
            {activeFolder.path === folder.path && (
              <span className="absolute left-0 bottom-[-17px] w-full h-[2px] bg-yellow-500"></span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center text-yellow-500 py-20 animate-pulse font-bold tracking-widest uppercase">
          Wczytywanie zwojów...
        </div>
      ) : (
        <Masonry
          breakpointCols={breakpointColumnsObj}
          className="flex w-auto -ml-4" 
          columnClassName="pl-4 bg-clip-padding space-y-4"
        >
          {images.map((publicId) => (
            <div key={publicId} className="relative group overflow-hidden rounded-xl bg-neutral-900 border border-neutral-800">
              <CldImage
                width="800"
                height="800"
                src={publicId}
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
                alt="Galeria Shorinji Kempo"
                className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-105"
              />
              {/* Delikatny złoty filtr po najechaniu, idealnie pasujący do paska */}
              <div className="absolute inset-0 bg-yellow-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            </div>
          ))}
        </Masonry>
      )}

      {!isLoading && images.length === 0 && (
        <div className="text-center text-neutral-500 py-20">
          Brak zdjęć w tym folderze.
        </div>
      )}
    </div>
  );
}