import type { Article } from "../data/articles/types";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { parseMarkdownToSections } from "./markdown";
import { sectionsToBlocks } from "./blockConvert";
import type { NewsBlock } from "./newsTypes";

const TABLE = "article_overrides";

export type ArticleOverrideRow = {
  topic: string;
  slug: string;
  title: string | null;
  intro: string | null;
  /** Treść jako bloki (aktualny format zapisu z panelu). */
  blocks: NewsBlock[] | null;
  /** Treść jako markdown (starszy format - nadal odczytywany). */
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
      .abortSignal(AbortSignal.timeout(6000))
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

export interface ResolvedArticle {
  slug: string;
  title: string;
  intro: string;
  blocks: NewsBlock[];
}

/** Bloki z wiersza nadpisania (bloki > markdown) albo null. */
export function overrideToBlocks(ov: ArticleOverrideRow | null): NewsBlock[] | null {
  if (!ov) return null;
  if (Array.isArray(ov.blocks) && ov.blocks.length > 0) return ov.blocks;
  if (ov.body_md && ov.body_md.trim())
    return sectionsToBlocks(parseMarkdownToSections(ov.body_md));
  return null;
}

/**
 * Treść podstrony tematycznej jako bloki: nadpisanie z bazy ma
 * pierwszeństwo, fallback to treść bazowa z kodu (data/articles).
 */
export async function resolveArticleBlocks(
  topic: string,
  slug: string,
  base: Article,
): Promise<ResolvedArticle> {
  const ov = await getArticleOverride(topic, slug);
  return {
    slug,
    title: ov?.title?.trim() || base.title,
    intro: ov?.intro?.trim() || base.intro,
    blocks: overrideToBlocks(ov) ?? sectionsToBlocks(base.sections),
  };
}

/** Zbiór kluczy "topic/slug", które mają zapisane nadpisanie. */
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

/** Zapisuje (lub aktualizuje) nadpisanie treści - w formacie blokowym. */
export async function upsertArticleOverride(row: {
  topic: string;
  slug: string;
  title: string;
  intro: string;
  blocks: NewsBlock[];
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) {
    return {
      ok: false,
      error:
        "Brak konfiguracji Supabase. Ustaw SUPABASE_SERVICE_ROLE_KEY i NEXT_PUBLIC_SUPABASE_URL.",
    };
  }
  const { error } = await sb.from(TABLE).upsert(
    {
      topic: row.topic,
      slug: row.slug,
      title: row.title,
      intro: row.intro,
      blocks: row.blocks,
      body_md: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "topic,slug" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
