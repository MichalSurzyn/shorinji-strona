"use server";

import { v2 as cloudinary } from "cloudinary";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

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

/**
 * Aktualności do PANELU — czytane kluczem serwisowym.
 *
 * DLACZEGO NIE KLIENTEM SESYJNYM
 * ------------------------------
 * Tabela `articles` ma włączony RLS i ZERO polityk (sprawdzone: `relrowsecurity`
 * = true, `pg_policies` = 0). Klient sesyjny dostaje wtedy pustą listę
 * PO CICHU — nie błąd, nie odmowę, po prostu zero wierszy. Skutek zgłoszony
 * przez właściciela: na `/aktualnosci` widać artykuł, a panel mówi „Brak
 * artykułów. Utwórz pierwszy!". Ekran edycji pojedynczego artykułu dawał z tego
 * samego powodu 404.
 *
 * Cała reszta panelu czyta kluczem serwisowym po `requireUser()` — te dwa
 * ekrany były jedynymi wyjątkami. Dostęp jest już obroniony wcześniej:
 * `requireUser()` sprawdza rolę z `app_metadata`, a layout panelu odbija konta
 * bez uprawnień.
 */
export async function pobierzArtykulyDoPanelu() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Brak konfiguracji Supabase.");
  const { data, error } = await sb
    .from("articles")
    .select("id,slug,title,excerpt,cover_image,published,published_at")
    // Kosz ma własną sekcję niżej — lista główna go pomija.
    .is("deleted_at", null)
    .order("published_at", { ascending: false });
  if (error) throw new Error(`Nie udało się wczytać aktualności: ${error.message}`);
  return data ?? [];
}

/** Jedna aktualność do ekranu edycji — ten sam powód co wyżej. */
export async function pobierzArtykulDoPanelu(id: string) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Brak konfiguracji Supabase.");
  const { data, error } = await sb.from("articles").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Nie udało się wczytać artykułu: ${error.message}`);
  return data ?? null;
}
