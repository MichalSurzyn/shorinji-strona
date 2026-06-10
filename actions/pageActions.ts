"use server";

import { revalidatePath } from "next/cache";
import { routeForEditablePage } from "@/lib/editablePages";
import type { NewsBlock } from "@/lib/newsTypes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

function revalidate(slug: string) {
  const route = routeForEditablePage(slug);
  revalidatePath(route);
  if (route !== "/") revalidatePath("/");
}

export async function savePageBlocks(slug: string, blocks: NewsBlock[]) {
  await requireUser();
  if (!Array.isArray(blocks) || blocks.length === 0)
    return {
      ok: false as const,
      error: "Treść nie może być pusta. Użyj „Przywróć wersję bazową”, aby wrócić do oryginału.",
    };

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb.from("site_settings").upsert({
    key: `page:${slug}`,
    value: { blocks },
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidate(slug);
  return { ok: true as const };
}

/** Usuwa nadpisanie - strona wraca do treści bazowej z kodu. */
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
