"use server";

import { v2 as cloudinary } from 'cloudinary';
import { naPoczatek, pobierzOkladki } from '@/lib/galeriaOkladki';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface GalleryFolder {
  name: string;
  path: string;
  /**
   * Do trzech zdjęć na okładkę albumu (nałożone na siebie).
   * Pierwsze z nich leży na wierzchu stosu - to ono jest okładką albumu.
   */
  covers: string[];
  count: number;
}

export async function getGalleryFolders(): Promise<GalleryFolder[]> {
  try {
    const { folders } = await cloudinary.api.sub_folders('Galeria');
    const lista = folders as { name: string; path: string }[];

    // Zdjęcia wszystkich albumów jednym zapytaniem, zamiast jednego na album.
    const wszystkie = await cloudinary.search
      .expression('folder:Galeria/*')
      .sort_by('created_at', 'desc')
      .max_results(500)
      .execute();

    const wgFolderu = new Map<string, string[]>();
    for (const r of (wszystkie.resources ?? []) as { public_id: string; folder?: string; asset_folder?: string }[]) {
      const f = r.asset_folder ?? r.folder;
      if (!f) continue;
      const biezace = wgFolderu.get(f) ?? [];
      biezace.push(r.public_id);
      wgFolderu.set(f, biezace);
    }

    // Zdjęcia wyróżnione w panelu (Zdjęcia -> album -> „Ustaw jako okładkę").
    // Bez wpisu album zachowuje układ domyślny: najnowsze zdjęcie na wierzchu.
    const okladki = await pobierzOkladki();

    return lista.map((f) => {
      const zdjecia = naPoczatek(wgFolderu.get(f.path) ?? [], okladki[f.path]);
      return { name: f.name, path: f.path, covers: zdjecia.slice(0, 3), count: zdjecia.length };
    });
  } catch (error) {
    console.error("Błąd pobierania folderów:", error);
    return [];
  }
}

export async function getImagesFromFolder(folderPath: string) {
  try {
    const result = await cloudinary.search
      .expression(`folder:"${folderPath}"`)
      .sort_by('created_at', 'desc')
      .max_results(50) // Limit żeby nam nie spaliło transferu przy setkach zdjęć
      .execute();
      
    return result.resources.map((r: { public_id: string }) => r.public_id);
  } catch (error) {
    console.error("Błąd pobierania zdjęć:", error);
    return [];
  }
}