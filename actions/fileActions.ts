"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";
import { bezpiecznaNazwa, KUBELEK, MAX_ROZMIAR, type PlikDoPobrania } from "@/lib/pliki";

/**
 * Pliki do pobrania (deklaracje, statuty, regulaminy).
 *
 * Magazyn: Supabase Storage, kubełek „pliki". Nie Cloudinary - tamten jest
 * potokiem do obrazów i wideo, dla PDF-a jego transformacje nie dają nic,
 * a pliki zjadałyby ten sam limit co zdjęcia galerii.
 *
 * Adresy publiczne przechodzą przez trasę /downloads/<nazwa>, a nie przez
 * adres magazynu. Dzięki temu odnośniki wpisane w stopce i te podane komuś
 * kiedyś nie przestaną działać, gdyby magazyn się zmienił.
 */

export async function listFiles(): Promise<
  { ok: true; pliki: PlikDoPobrania[] } | { ok: false; error: string }
> {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Brak konfiguracji Supabase." };
  const { data, error } = await sb.storage
    .from(KUBELEK)
    .list("", { sortBy: { column: "name", order: "asc" } });
  if (error) return { ok: false, error: error.message };
  return {
    ok: true,
    pliki: (data ?? [])
      // Storage zwraca też wpisy-zaślepki folderów - nie mają metadanych.
      .filter((f) => f.name && f.metadata)
      .map((f) => ({
        nazwa: f.name,
        rozmiar: (f.metadata?.size as number) ?? 0,
        typ: (f.metadata?.mimetype as string) ?? null,
        zmieniony: f.updated_at ?? f.created_at ?? "",
        adres: `/downloads/${f.name}`,
      })),
  };
}

export async function uploadFile(formData: FormData) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const plik = formData.get("plik");
  if (!(plik instanceof File) || plik.size === 0)
    return { ok: false as const, error: "Nie wybrano pliku." };

  if (plik.size > MAX_ROZMIAR)
    return {
      ok: false as const,
      error: `Plik waży ${(plik.size / 1024 / 1024).toFixed(1)} MB, a limit to 20 MB. Zmniejsz go i spróbuj ponownie.`,
    };

  const nazwa = bezpiecznaNazwa(plik.name);
  // upsert: false - inaczej wgranie pliku o tej samej nazwie po cichu
  // podmieniłoby dokument, do którego ktoś już podał odnośnik.
  const { error } = await sb.storage.from(KUBELEK).upload(nazwa, plik, {
    contentType: plik.type || "application/octet-stream",
    upsert: false,
  });
  if (error) {
    const zajete = /exists|duplicate/i.test(error.message);
    return {
      ok: false as const,
      error: zajete
        ? `Plik o nazwie „${nazwa}" już tu jest. Zmień nazwę pliku na dysku albo najpierw usuń stary.`
        : error.message,
    };
  }
  revalidatePath("/", "layout");
  return { ok: true as const, nazwa, adres: `/downloads/${nazwa}` };
}

/** Podmienia zawartość istniejącego pliku, zachowując nazwę i adres. */
export async function replaceFile(nazwa: string, formData: FormData) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  const plik = formData.get("plik");
  if (!(plik instanceof File) || plik.size === 0)
    return { ok: false as const, error: "Nie wybrano pliku." };
  const { error } = await sb.storage.from(KUBELEK).upload(nazwa, plik, {
    contentType: plik.type || "application/octet-stream",
    upsert: true,
  });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function deleteFile(nazwa: string) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  const { error } = await sb.storage.from(KUBELEK).remove([nazwa]);
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true as const };
}
