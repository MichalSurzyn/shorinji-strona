"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import type { NewsBlock } from "@/lib/newsTypes";

export interface NewsInput {
  slug: string;
  title: string;
  excerpt: string | null;
  cover_image: string | null;
  content: NewsBlock[];
  published: boolean;
  published_at: string;
}

function revalidateNews(slug?: string) {
  revalidatePath("/");
  revalidatePath("/aktualnosci");
  if (slug) revalidatePath(`/aktualnosci/${slug}`);
}

export async function createNewsArticle(input: NewsInput) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("articles")
    .insert({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
    })
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };

  revalidateNews(input.slug);
  return { ok: true as const, id: data.id as string };
}

export async function saveNewsArticle(id: string, input: NewsInput) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("articles")
    .update({
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      cover_image: input.cover_image,
      content: input.content,
      published: input.published,
      published_at: input.published_at,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidateNews(input.slug);
  return { ok: true as const };
}

export async function deleteNewsArticle(id: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.from("articles").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  revalidateNews();
  return { ok: true as const };
}
