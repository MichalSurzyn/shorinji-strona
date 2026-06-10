"use server";

import { v2 as cloudinary } from "cloudinary";
import { requireUser } from "@/lib/supabase/server";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.replace(/"/g, ""),
  api_key: process.env.CLOUDINARY_API_KEY?.replace(/"/g, ""),
  api_secret: process.env.CLOUDINARY_API_SECRET?.replace(/"/g, ""),
});

export interface CloudImage {
  publicId: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface CloudFolder {
  name: string;
  path: string;
}

/**
 * Foldery dostępne w panelu: podfoldery "Galeria" (zakładki publicznej
 * galerii) oraz drzewo "Strona/<temat>/<slug>" (zdjęcia podstron).
 */
export async function listImageFolders(): Promise<CloudFolder[]> {
  await requireUser();
  const folders: CloudFolder[] = [];
  try {
    const { folders: gal } = await cloudinary.api.sub_folders("Galeria");
    for (const f of gal as { name: string; path: string }[]) {
      folders.push({ name: `Galeria / ${f.name}`, path: f.path });
    }
  } catch (e) {
    console.warn("listImageFolders Galeria:", e);
  }
  try {
    const { folders: topics } = await cloudinary.api.sub_folders("Strona");
    for (const t of topics as { name: string; path: string }[]) {
      try {
        const { folders: slugs } = await cloudinary.api.sub_folders(t.path);
        for (const s of slugs as { name: string; path: string }[]) {
          folders.push({ name: `Strona / ${t.name} / ${s.name}`, path: s.path });
        }
        if (!(slugs as unknown[]).length) {
          folders.push({ name: `Strona / ${t.name}`, path: t.path });
        }
      } catch {
        folders.push({ name: `Strona / ${t.name}`, path: t.path });
      }
    }
  } catch (e) {
    console.warn("listImageFolders Strona:", e);
  }
  return folders;
}

type CloudResource = {
  public_id: string;
  width: number;
  height: number;
  created_at: string;
};

function mapResources(resources: CloudResource[] | undefined): CloudImage[] {
  return (resources ?? []).map((r) => ({
    publicId: r.public_id,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
  }));
}

/**
 * Listuje zdjęcia przez Admin API (bez opóźnień indeksowania Search API) -
 * świeżo wgrane pliki są widoczne od razu.
 */
export async function listImages(folderPath: string): Promise<CloudImage[]> {
  await requireUser();
  try {
    if (folderPath === "all") {
      const result = await cloudinary.api.resources({
        resource_type: "image",
        type: "upload",
        max_results: 100,
        direction: "desc",
      });
      return mapResources(result.resources);
    }
    const result = await cloudinary.api.resources_by_asset_folder(folderPath, {
      max_results: 100,
    });
    return mapResources(result.resources);
  } catch (e) {
    console.warn("listImages:", e);
    return [];
  }
}

export async function createImageFolder(name: string) {
  await requireUser();
  const clean = name.trim().replace(/[^\p{L}\p{N} _-]/gu, "");
  if (!clean) return { ok: false as const, error: "Nieprawidłowa nazwa folderu" };
  try {
    await cloudinary.api.create_folder(`Galeria/${clean}`);
    return { ok: true as const, path: `Galeria/${clean}` };
  } catch (e) {
    console.warn("createImageFolder:", e);
    return { ok: false as const, error: "Nie udało się utworzyć folderu" };
  }
}

export async function deleteImage(publicId: string) {
  await requireUser();
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    if (res.result !== "ok")
      return { ok: false as const, error: `Cloudinary: ${res.result}` };
    return { ok: true as const };
  } catch (e) {
    console.warn("deleteImage:", e);
    return { ok: false as const, error: "Nie udało się usunąć zdjęcia" };
  }
}

/**
 * Podpis do bezpośredniego uploadu z przeglądarki do Cloudinary
 * (plik nie przechodzi przez serwer Next - brak limitów rozmiaru).
 * Cloud działa w trybie dynamic folders, więc używamy asset_folder -
 * public_id pozostaje krótkie, bez ścieżki folderu.
 */
export async function getUploadSignature(folder: string) {
  await requireUser();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    asset_folder: folder,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!.replace(/"/g, "")
  );
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!.replace(/"/g, ""),
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!.replace(/"/g, ""),
    folder,
  };
}
