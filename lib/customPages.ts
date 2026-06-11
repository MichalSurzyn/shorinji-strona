import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsBlock } from "./newsTypes";

/** Własne podstrony tworzone w panelu (tabela custom_pages), dostępne pod /<slug>. */

export interface CustomPage {
  id: string;
  slug: string;
  title: string;
  intro: string | null;
  blocks: NewsBlock[];
  published: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Slugi zajęte przez istniejące trasy - nie do użycia dla własnych podstron. */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "aktualnosci",
  "buddyzm",
  "cennik",
  "galeria",
  "kontakt",
  "o-shorinji",
  "organizacja",
  "program-nauczania",
  "zajecia",
  "downloads",
  "sitemap.xml",
  "robots.txt",
]);

export async function getCustomPage(slug: string): Promise<CustomPage | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("custom_pages")
      .select("*")
      .eq("slug", slug)
      .eq("published", true)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    return (data as CustomPage) ?? null;
  } catch (e) {
    console.warn(`[customPages] getCustomPage("${slug}"):`, e);
    return null;
  }
}

export async function listCustomPages(): Promise<CustomPage[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("custom_pages")
      .select("id,slug,title,intro,published,updated_at")
      .order("title", { ascending: true });
    if (error) throw error;
    return (data ?? []) as CustomPage[];
  } catch {
    return [];
  }
}
