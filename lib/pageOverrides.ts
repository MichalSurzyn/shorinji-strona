import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsBlock, PageContent } from "./newsTypes";

/**
 * Treść stron serwisu w bazie (site_settings, klucz "page:<slug>").
 * Wartość: { title?, lead?, kicker?, blocks } — jedno źródło prawdy,
 * edytowane w panelu (Strony). Starsze wpisy mają samo { blocks }.
 */

function key(slug: string) {
  return `page:${slug}`;
}

function isBlockArray(v: unknown): v is NewsBlock[] {
  return (
    Array.isArray(v) &&
    v.every(
      (b) => typeof b === "object" && b !== null && typeof (b as { type?: unknown }).type === "string"
    )
  );
}

function asText(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/**
 * Pełna treść strony z bazy albo null (brak wpisu / błąd / brak konfiguracji).
 * `cache()` deduplikuje odczyt w obrębie jednego renderu (PageHeader + PageBody).
 */
export const getPageContent = cache(
  async (slug: string): Promise<PageContent | null> => {
    const sb = getSupabaseAdmin();
    if (!sb) return null;
    try {
      const { data, error } = await sb
        .from("site_settings")
        .select("value")
        .eq("key", key(slug))
        .abortSignal(AbortSignal.timeout(6000))
        .maybeSingle();
      if (error) throw error;
      const v = data?.value as
        | { blocks?: unknown; title?: unknown; lead?: unknown; kicker?: unknown }
        | null;
      if (!v || typeof v !== "object") return null;
      return {
        title: asText(v.title),
        lead: asText(v.lead),
        kicker: asText(v.kicker),
        blocks: isBlockArray(v.blocks) ? v.blocks : [],
      };
    } catch (e) {
      console.warn(`[pageOverrides] getPageContent("${slug}"):`, e);
      return null;
    }
  }
);

/** Same bloki strony (kompatybilność ze starszym kodem). */
export async function getPageBlocks(slug: string): Promise<NewsBlock[] | null> {
  const content = await getPageContent(slug);
  return content && content.blocks.length > 0 ? content.blocks : null;
}

/** Slugi stron, które mają zapisaną treść (do plakietek w panelu). */
export async function listPageOverrideSlugs(): Promise<Set<string>> {
  const sb = getSupabaseAdmin();
  if (!sb) return new Set();
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("key")
      .like("key", "page:%");
    if (error || !data) return new Set();
    return new Set(data.map((r) => String(r.key).slice(5)));
  } catch {
    return new Set();
  }
}
