"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

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
