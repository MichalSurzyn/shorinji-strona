"use server";

import { revalidatePath } from "next/cache";
import type { FooterData } from "@/lib/footerTypes";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

export async function saveFooter(data: FooterData) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb.from("site_settings").upsert({
    key: "footer",
    value: data,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Usuwa nadpisanie - stopka wraca do wartości z kodu. */
export async function resetFooter() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb.from("site_settings").delete().eq("key", "footer");
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/", "layout");
  return { ok: true as const };
}
