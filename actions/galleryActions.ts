"use server";

import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function getGalleryFolders() {
  try {
    const { folders } = await cloudinary.api.sub_folders('Galeria');
    return folders.map((f: any) => ({ name: f.name, path: f.path }));
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
      
    return result.resources.map((r: any) => r.public_id);
  } catch (error) {
    console.error("Błąd pobierania zdjęć:", error);
    return [];
  }
}