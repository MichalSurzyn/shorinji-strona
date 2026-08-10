"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { oproznijStaryKosz, zapiszWersje } from "@/lib/versions";
import type { NewsBlock } from "@/lib/newsTypes";

export interface NewsInput {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content: NewsBlock[];
  published: boolean;
  published_at: string;
}

function revalidateNews(slug?: string) {
  revalidatePath("/");
  revalidatePath("/aktualnosci");
  if (slug) revalidatePath(`/aktualnosci/${slug}`);
}

export async function createNewsArticle(input: NewsInput) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidateNews(input.slug);
  return { ok: true as const, id: data.id as string };
}

export async function saveNewsArticle(id: string, input: NewsInput) {
  const { supabase, user } = await requireUser();

  // Migawka stanu SPRZED nadpisania - to do niej wraca się z historii.
  // Zapisujemy przez klienta serwisowego, bo tabela historii nie ma polityk
  // dla roli zalogowanej.
  const sb = getSupabaseAdmin();
  if (sb) {
    const { data: poprzedni } = await sb.from("articles").select("*").eq("id", id).maybeSingle();
    if (poprzedni) await zapiszWersje("article", id, poprzedni, user.email);
  }

  const { error } = await supabase
    .from("articles")
    .update({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
      updated_at: new Date().toISOString(),
      updated_by: user.email ?? null,
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidateNews(input.slug);
  return { ok: true as const };
}

/**
 * Przenosi artykuł do kosza.
 *
 * Nie kasujemy wiersza: przy kilku osobach z dostępem pomyłka jednej z nich
 * była dotąd nie do odwrócenia. Wiersz znika ze strony i z listy natychmiast,
 * ale wraca jednym kliknięciem przez 30 dni.
 */
export async function deleteNewsArticle(id: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("articles")
    .update({ deleted_at: new Date().toISOString(), updated_by: user.email ?? null })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidateNews();
  return { ok: true as const };
}

/** Przywraca artykuł z kosza. */
export async function restoreNewsArticle(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("articles").update({ deleted_at: null }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  revalidateNews();
  return { ok: true as const };
}

/** Kasuje artykuł z kosza NA STAŁE. Jedyna operacja bez odwrotu. */
export async function purgeNewsArticle(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("articles")
    .delete()
    .eq("id", id)
    .not("deleted_at", "is", null); // bezpiecznik: tylko z kosza
  if (error) return { ok: false as const, error: error.message };
  revalidateNews();
  return { ok: true as const };
}

/** Zawartość kosza - do sekcji w panelu. */
export async function listTrashedArticles() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  await oproznijStaryKosz("articles");
  const { data, error } = await sb
    .from("articles")
    .select("id,title,slug,deleted_at,updated_by")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, articles: data ?? [] };
}
