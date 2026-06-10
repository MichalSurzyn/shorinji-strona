import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsArticle } from "./newsTypes";
import newsFallback from "@/content-fallback/articles.json";

/**
 * Aktualności z Supabase z lokalnym fallbackiem.
 * Jeśli baza nie odpowiada (uśpiony projekt, brak konfiguracji),
 * strona pokazuje snapshot z content-fallback/articles.json.
 */

const fb = newsFallback as unknown as NewsArticle[];

function fallbackList(limit?: number): NewsArticle[] {
  const list = [...fb]
    .filter((a) => a.published !== false)
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
  return limit ? list.slice(0, limit) : list;
}

export async function getNews(limit?: number): Promise<NewsArticle[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return fallbackList(limit);
  try {
    let q = sb
      .from("articles")
      .select("id,slug,title,excerpt,cover_image,published,published_at")
      .eq("published", true)
      .order("published_at", { ascending: false })
      .abortSignal(AbortSignal.timeout(6000));
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as unknown as NewsArticle[];
  } catch (e) {
    console.warn("[news] getNews - fallback:", e);
    return fallbackList(limit);
  }
}

export async function getNewsBySlug(slug: string): Promise<NewsArticle | null> {
  const sb = getSupabaseAdmin();
  if (sb) {
    try {
      const { data, error } = await sb
        .from("articles")
        .select("*")
        .eq("slug", slug)
        .eq("published", true)
        .abortSignal(AbortSignal.timeout(6000))
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as NewsArticle;
      return null;
    } catch (e) {
      console.warn(`[news] getNewsBySlug("${slug}") - fallback:`, e);
    }
  }
  return fb.find((a) => a.slug === slug) ?? null;
}
