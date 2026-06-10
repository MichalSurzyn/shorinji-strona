"use server";

import { revalidatePath } from "next/cache";
import type { ScheduleSlot } from "@/data/schedule";
import { isValidSlot } from "@/lib/schedule";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

function revalidateSchedulePages() {
  revalidatePath("/zajecia/dorosli");
  revalidatePath("/zajecia/dzieci");
}

export async function saveSchedule(slots: ScheduleSlot[]) {
  await requireUser();
  if (!Array.isArray(slots) || slots.length === 0)
    return { ok: false as const, error: "Harmonogram nie może być pusty." };
  for (const s of slots) {
    if (!isValidSlot(s))
      return {
        ok: false as const,
        error:
          "Każdy termin musi mieć grupę, dzień, godziny (HH:MM) i miejsce.",
      };
  }
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const { error } = await sb.from("site_settings").upsert({
    key: "schedule",
    value: slots,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidateSchedulePages();
  return { ok: true as const };
}

/** Usuwa nadpisanie - wraca harmonogram bazowy z kodu. */
export async function resetSchedule() {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  const { error } = await sb.from("site_settings").delete().eq("key", "schedule");
  if (error) return { ok: false as const, error: error.message };

  revalidateSchedulePages();
  return { ok: true as const };
}
