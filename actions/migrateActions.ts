"use server";

import { revalidatePath } from "next/cache";
import { o_shorinji } from "@/data/articles/o-shorinji";
import { organizacja } from "@/data/articles/organizacja";
import { buddyzm } from "@/data/articles/buddyzm";
import { listOverrideKeys, upsertArticleOverride } from "@/lib/articleContent";
import { sectionsToBlocks } from "@/lib/blockConvert";
import { EDITABLE_PAGES } from "@/lib/editablePages";
import { listPageOverrideSlugs } from "@/lib/pageOverrides";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

/**
 * Jednorazowe przeniesienie wszystkich treści bazowych z kodu do Supabase.
 * Idempotentne: pomija strony, które już mają wpis w bazie (nie nadpisuje
 * niczego, co zostało zmienione w panelu).
 */
export async function migrateAllContent() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  let inserted = 0;
  let skipped = 0;

  // 1. Strony serwisu -> site_settings (page:<slug>)
  const existingPages = await listPageOverrideSlugs();
  for (const page of EDITABLE_PAGES) {
    if (existingPages.has(page.slug)) {
      skipped++;
      continue;
    }
    const { error } = await sb.from("site_settings").upsert({
      key: `page:${page.slug}`,
      value: { blocks: page.prefill },
      updated_at: new Date().toISOString(),
    });
    if (error) return { ok: false as const, error: error.message };
    inserted++;
  }

  // 2. Podstrony tematyczne -> article_overrides (bloki)
  const existingArticles = await listOverrideKeys();
  for (const group of [o_shorinji, organizacja, buddyzm]) {
    for (const article of group.articles) {
      const key = `${group.topic}/${article.slug}`;
      if (existingArticles.has(key)) {
        skipped++;
        continue;
      }
      const res = await upsertArticleOverride({
        topic: group.topic,
        slug: article.slug,
        title: article.title,
        intro: article.intro,
        blocks: sectionsToBlocks(article.sections),
      });
      if (!res.ok) return { ok: false as const, error: res.error ?? "Błąd zapisu." };
      inserted++;
    }
  }

  revalidatePath("/", "layout");
  return { ok: true as const, inserted, skipped };
}
