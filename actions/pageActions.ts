"use server";

import { revalidatePath } from "next/cache";
import { routeForEditablePage } from "@/lib/editablePages";
import type { NewsBlock, PageContent } from "@/lib/newsTypes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

function revalidate(slug: string) {
  const route = routeForEditablePage(slug);
  revalidatePath(route);
  if (route !== "/") revalidatePath("/");
}

/** Zapisuje pełną treść strony: nagłówek (kicker/tytuł/lead) + bloki. */
export async function savePageContent(slug: string, content: PageContent) {
  await requireUser();
  if (!Array.isArray(content.blocks))
    return { ok: false as const, error: "Nieprawidłowa treść bloków." };
  if (content.blocks.length === 0 && !content.title?.trim())
    return {
      ok: false as const,
      error: "Strona musi mieć przynajmniej tytuł albo jeden blok treści.",
    };

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb.from("site_settings").upsert({
    key: `page:${slug}`,
    value: {
      title: content.title?.trim() || null,
      lead: content.lead?.trim() || null,
      kicker: content.kicker?.trim() || null,
      blocks: content.blocks,
    },
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidate(slug);
  return { ok: true as const };
}

/** Zapis samych bloków (kompatybilność — zachowuje nagłówek, jeśli już jest w bazie). */
export async function savePageBlocks(slug: string, blocks: NewsBlock[]) {
  await requireUser();
  if (!Array.isArray(blocks) || blocks.length === 0)
    return { ok: false as const, error: "Treść nie może być pusta." };

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  // Nie gub nagłówka zapisanego w tym samym wierszu.
  const { data } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", `page:${slug}`)
    .maybeSingle();
  const prev = (data?.value ?? {}) as Record<string, unknown>;

  const { error } = await sb.from("site_settings").upsert({
    key: `page:${slug}`,
    value: { ...prev, blocks },
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidate(slug);
  return { ok: true as const };
}

/** Usuwa wpis strony z bazy (strona przestaje pokazywać treść — do celów porządkowych). */
export async function resetPageBlocks(slug: string) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb
    .from("site_settings")
    .delete()
    .eq("key", `page:${slug}`);
  if (error) return { ok: false as const, error: error.message };

  revalidate(slug);
  return { ok: true as const };
}
