"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

export interface NavTreeInput {
  label: string;
  href: string | null;
  visible: boolean;
  children: { label: string; href: string; visible: boolean }[];
}

/** Zapisuje całe menu (zastępuje poprzednią wersję). */
export async function saveNavTree(items: NavTreeInput[]) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  for (const item of items) {
    if (!item.label.trim())
      return { ok: false as const, error: "Każda pozycja menu musi mieć etykietę." };
    for (const child of item.children) {
      if (!child.label.trim() || !child.href.trim())
        return {
          ok: false as const,
          error: `Podpunkty pozycji „${item.label}” muszą mieć etykietę i adres.`,
        };
    }
    if (!item.href?.trim() && item.children.length === 0)
      return {
        ok: false as const,
        error: `Pozycja „${item.label}” musi mieć adres albo podpunkty.`,
      };
  }

  // Pełna podmiana drzewa (dzieci kasują się kaskadowo).
  const del = await sb.from("nav_items").delete().not("id", "is", null);
  if (del.error) return { ok: false as const, error: del.error.message };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { data, error } = await sb
      .from("nav_items")
      .insert({
        label: item.label.trim(),
        href: item.href?.trim() || null,
        position: i,
        visible: item.visible,
      })
      .select("id")
      .single();
    if (error) return { ok: false as const, error: error.message };

    if (item.children.length) {
      const { error: childErr } = await sb.from("nav_items").insert(
        item.children.map((c, j) => ({
          parent_id: data.id,
          label: c.label.trim(),
          href: c.href.trim(),
          position: j,
          visible: c.visible,
        }))
      );
      if (childErr) return { ok: false as const, error: childErr.message };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
