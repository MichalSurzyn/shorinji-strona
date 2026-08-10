"use server";

import { revalidatePath } from "next/cache";
import { routeForEditablePage } from "@/lib/editablePages";
import type { PageContent } from "@/lib/newsTypes";
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

