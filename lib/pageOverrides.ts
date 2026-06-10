import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsBlock } from "./newsTypes";

/**
 * Nadpisania treści stron statycznych (cennik, kontakt, zajęcia itd.).
 * Klucz w site_settings: "page:<slug>", wartość: { blocks: NewsBlock[] }.
 * Brak wpisu / błąd bazy => strona pokazuje treść bazową z kodu.
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

export async function getPageBlocks(slug: string): Promise<NewsBlock[] | null> {
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
    const blocks = (data?.value as { blocks?: unknown } | null)?.blocks;
    if (isBlockArray(blocks) && blocks.length > 0) return blocks;
  } catch (e) {
    console.warn(`[pageOverrides] getPageBlocks("${slug}") - fallback:`, e);
  }
  return null;
}

/** Slugi stron, które mają zapisane nadpisanie (do plakietek w panelu). */
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
