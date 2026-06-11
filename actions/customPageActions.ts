"use server";

import { revalidatePath } from "next/cache";
import { RESERVED_SLUGS } from "@/lib/customPages";
import type { NewsBlock } from "@/lib/newsTypes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

export interface CustomPageInput {
  slug: string;
  title: string;
  intro: string | null;
  blocks: NewsBlock[];
  published: boolean;
  /** Czy strona ma być widoczna w menu (pozycja najwyższego poziomu). */
  inMenu: boolean;
}

function validate(input: CustomPageInput) {
  if (!input.title.trim()) return "Podstrona musi mieć tytuł.";
  if (!/^[a-z0-9-]+$/.test(input.slug))
    return "Adres (slug) może zawierać tylko małe litery, cyfry i myślniki.";
  if (RESERVED_SLUGS.has(input.slug))
    return `Adres /${input.slug} jest zajęty przez istniejącą stronę serwisu.`;
  return null;
}

async function syncNavItem(slug: string, title: string, inMenu: boolean) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  const href = `/${slug}`;
  const { data } = await sb
    .from("nav_items")
    .select("id")
    .eq("href", href)
    .is("parent_id", null)
    .maybeSingle();

  if (inMenu && !data) {
    const { data: maxRow } = await sb
      .from("nav_items")
      .select("position")
      .is("parent_id", null)
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    await sb.from("nav_items").insert({
      label: title.toUpperCase(),
      href,
      position: (maxRow?.position ?? 0) + 1,
    });
  } else if (!inMenu && data) {
    await sb.from("nav_items").delete().eq("id", data.id);
  }
}

export async function createCustomPage(input: CustomPageInput) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const invalid = validate(input);
  if (invalid) return { ok: false as const, error: invalid };

  const { data, error } = await sb
    .from("custom_pages")
    .insert({
      slug: input.slug,
      title: input.title.trim(),
      intro: input.intro?.trim() || null,
      blocks: input.blocks,
      published: input.published,
    })
    .select("id")
    .single();
  if (error)
    return {
      ok: false as const,
      error: error.code === "23505" ? "Podstrona o tym adresie już istnieje." : error.message,
    };

  await syncNavItem(input.slug, input.title, input.inMenu);
  revalidatePath("/", "layout");
  return { ok: true as const, id: data.id as string };
}

export async function saveCustomPage(id: string, input: CustomPageInput) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const invalid = validate(input);
  if (invalid) return { ok: false as const, error: invalid };

  // Stary slug - do posprzątania pozycji w menu przy zmianie adresu.
  const { data: old } = await sb
    .from("custom_pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb
    .from("custom_pages")
    .update({
      slug: input.slug,
      title: input.title.trim(),
      intro: input.intro?.trim() || null,
      blocks: input.blocks,
      published: input.published,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error)
    return {
      ok: false as const,
      error: error.code === "23505" ? "Podstrona o tym adresie już istnieje." : error.message,
    };

  if (old?.slug && old.slug !== input.slug) {
    await sb.from("nav_items").delete().eq("href", `/${old.slug}`);
  }
  await syncNavItem(input.slug, input.title, input.inMenu);

  revalidatePath("/", "layout");
  revalidatePath(`/${input.slug}`);
  return { ok: true as const };
}

export async function deleteCustomPage(id: string) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { data: page } = await sb
    .from("custom_pages")
    .select("slug")
    .eq("id", id)
    .maybeSingle();

  const { error } = await sb.from("custom_pages").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };

  if (page?.slug) {
    await sb.from("nav_items").delete().eq("href", `/${page.slug}`);
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
