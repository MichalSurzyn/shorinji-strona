"use server";

import { v2 as cloudinary } from 'cloudinary';

// Konfiguracja bezpiecznego połączenia
cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Pobieranie podfolderów z folderu "Galeria"
export async function getGalleryFolders() {
  try {
    const { folders } = await cloudinary.api.sub_folders('Galeria');
    return folders.map((f: any) => ({ name: f.name, path: f.path }));
  } catch (error) {
    console.error("Błąd pobierania folderów:", error);
    return [];
  }
}

// Pobieranie zdjęć z konkretnego folderu
export async function getImagesFromFolder(folderPath: string) {
  try {
    const result = await cloudinary.search
      .expression(`folder:"${folderPath}"`)
      .sort_by('created_at', 'desc')
      .max_results(50) // Limit dla bezpieczeństwa
      .execute();
      
    // Zwracamy tylko to, co potrzebne (public_id) dla komponentu CldImage
    return result.resources.map((r: any) => r.public_id);
  } catch (error) {
    console.error("Błąd pobierania zdjęć:", error);
    return [];
  }
}