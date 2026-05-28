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
  try {
    const folder = `Strona/${topic}/${slug}`;
    const result = await cloudinary.search
      .expression(`folder:"${folder}"`)
      .sort_by("created_at", "desc")
      .max_results(20)
      .execute();

    return (result.resources ?? []).map((r: { public_id: string }) => r.public_id);
  } catch (error) {
    // Brak folderu / brak uprawnień – po prostu pusta galeria.
    console.warn(`[getArticleImages] no images for ${topic}/${slug}:`, error);
    return [];
  }
}
