"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServer, requireUser } from "@/lib/supabase/server";
import { upsertArticleOverride } from "@/lib/articleContent";
import type { NewsBlock } from "@/lib/newsTypes";

export async function logoutAction() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}

/** Zapis podstrony tematycznej (o-shorinji / organizacja / buddyzm) - bloki. */
export async function saveTopicArticle(
  topic: string,
  slug: string,
  input: { title: string; intro: string; blocks: NewsBlock[] }
) {
  await requireUser();

  if (!input.title.trim())
    return { ok: false as const, error: "Podstrona musi mieć tytuł." };
  if (!Array.isArray(input.blocks) || input.blocks.length === 0)
    return { ok: false as const, error: "Treść nie może być pusta." };

  const res = await upsertArticleOverride({
    topic,
    slug,
    title: input.title.trim(),
    intro: input.intro.trim(),
    blocks: input.blocks,
  });
  if (!res.ok) return { ok: false as const, error: res.error ?? "Błąd zapisu." };

  revalidatePath(`/${topic}/${slug}`);
  revalidatePath(`/${topic}`);
  return { ok: true as const };
}
