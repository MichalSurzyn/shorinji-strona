import type { Article } from "../data/articles/types";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { parseMarkdownToSections } from "./markdown";

const TABLE = "article_overrides";

export type ArticleOverrideRow = {
  topic: string;
  slug: string;
  title: string | null;
  intro: string | null;
  body_md: string | null;
  updated_at?: string;
};

/** Pobiera nadpisanie treści (z Supabase) dla danej podstrony. null = brak / błąd / brak konfiguracji. */
export async function getArticleOverride(
  topic: string,
  slug: string,
): Promise<ArticleOverrideRow | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("topic", topic)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.warn(`[articleContent] odczyt ${topic}/${slug}:`, error.message);
      return null;
    }
    return (data as ArticleOverrideRow) ?? null;
  } catch (e) {
    console.warn(`[articleContent] wyjątek przy ${topic}/${slug}:`, e);
    return null;
  }
}

/** Nakłada nadpisanie na treść bazową z kodu. Puste pola = zostaje oryginał. */
export function applyOverride(base: Article, ov: ArticleOverrideRow | null): Article {
  if (!ov) return base;
  const sections =
    ov.body_md && ov.body_md.trim() ? parseMarkdownToSections(ov.body_md) : base.sections;
  return {
    ...base,
    title: ov.title?.trim() || base.title,
    intro: ov.intro?.trim() || base.intro,
    sections,
  };
}

/** Treść bazowa z kodu + ewentualne nadpisanie z panelu. */
export async function resolveArticle(
  topic: string,
  slug: string,
  base: Article,
): Promise<Article> {
  const ov = await getArticleOverride(topic, slug);
  return applyOverride(base, ov);
}

/** Zbiór kluczy "topic/slug", które mają zapisane nadpisanie (do oznaczeń w panelu). */
export async function listOverrideKeys(): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  if (!sb) return new Set();
  try {
    const { data, error } = await sb.from(TABLE).select("topic,slug");
    if (error || !data) return new Set();
    return new Set(data.map((r) => `${r.topic}/${r.slug}`));
  } catch {
    return new Set();
  }
}

/** Zapisuje (lub aktualizuje) nadpisanie treści. */
export async function upsertArticleOverride(row: {
  topic: string;
  slug: string;
  title: string;
  intro: string;
  body_md: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      ok: false,
      error:
        "Brak konfiguracji Supabase. Ustaw SUPABASE_SERVICE_ROLE_KEY i NEXT_PUBLIC_SUPABASE_URL.",
    };
  }
  const { error } = await sb
    .from(TABLE)
    .upsert(
      { ...row, updated_at: new Date().toISOString() },
      { onConflict: "topic,slug" },
    );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
