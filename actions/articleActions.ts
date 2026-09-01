"use server";

import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Pobiera publiczne ID wszystkich zdjęć z folderu Cloudinary
 * `Strona/<topic>/<slug>` (np. `Strona/buddyzm/podstawy`).
 *
 * Jeśli folder nie istnieje albo nie zawiera zdjęć – zwraca pustą tablicę.
 * Strona renderuje galerię tylko gdy tablica nie jest pusta.
 */
export async function getArticleImages(
  topic: string,
  slug: string,
): Promise<string[]> {
  return getImagesFromFolder(`Strona/${topic}/${slug}`);
}

/**
 * Zdjęcia z DOWOLNEGO folderu Cloudinary.
 *
 * Wydzielone z `getArticleImages`, bo od etapu 7 folder nie jest już sklejany
 * z tematu i sluga — siedzi w kolumnie `pages.cloudinary_folder`. Powód jest
 * konkretny: folder był dotąd kluczowany KSZTAŁTEM ADRESU, więc zmiana sluga
 * (czyli cała pointa tej migracji) osierociłaby go i nic by tego nie zgłosiło.
 * Teraz adres i folder to dwie osobne kolumny, a zmiana jednej nie rusza drugiej.
 */
export async function getImagesFromFolder(folder: string): Promise<string[]> {
  try {
    const result = await cloudinary.search
      .expression(`folder:"${folder}"`)
      .sort_by("created_at", "desc")
      .max_results(20)
      .execute();

    return (result.resources ?? []).map((r: { public_id: string }) => r.public_id);
  } catch (error) {
    // Brak folderu / brak uprawnień – po prostu pusta galeria.
    console.warn(`[getImagesFromFolder] brak zdjęć w ${folder}:`, error);
    return [];
  }
}
