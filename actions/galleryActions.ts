"use server";

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface GalleryFolder {
  name: string;
  path: string;
  /** Do trzech zdjęć na okładkę albumu (nałożone na siebie). */
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

    return lista.map((f) => {
      const zdjecia = wgFolderu.get(f.path) ?? [];
      return { name: f.name, path: f.path, covers: zdjecia.slice(0, 3), count: zdjecia.length };
    });
  } catch (error) {
    console.error("Błąd pobierania folderów:", error);
    return [];
  }
}

export async function getImagesFromFolder(folderPath: string) {
  try {
    // MAGIA: Jeśli kliknęliśmy '*', ścieżka to 'all'. 
    // Wtedy szukamy we wszystkich podfolderach Galerii (używając /*)
    const searchQuery = folderPath === 'all' 
      ? 'folder:Galeria/*' 
      : `folder:"${folderPath}"`;

    const result = await cloudinary.search
      .expression(searchQuery)
      .sort_by('created_at', 'desc')
      .max_results(50) // Limit żeby nam nie spaliło transferu przy setkach zdjęć
      .execute();
      
    return result.resources.map((r: { public_id: string }) => r.public_id);
  } catch (error) {
    console.error("Błąd pobierania zdjęć:", error);
    return [];
  }
}