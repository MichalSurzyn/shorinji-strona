import { SCHEDULE, type ScheduleSlot } from "@/data/schedule";
import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Harmonogram zajęć: wersja zapisana w panelu (site_settings, klucz
 * "schedule") ma pierwszeństwo; gdy jej nie ma albo baza nie odpowiada,
 * obowiązuje harmonogram bazowy z data/schedule.ts.
 */

const KEY = "schedule";
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidSlot(s: unknown): s is ScheduleSlot {
  if (typeof s !== "object" || s === null) return false;
  const o = s as Record<string, unknown>;
  return (
    (o.group === "dzieci" || o.group === "dorosli") &&
    typeof o.day === "number" &&
    o.day >= 1 &&
    o.day <= 7 &&
    typeof o.start === "string" &&
    TIME_RE.test(o.start) &&
    typeof o.end === "string" &&
    TIME_RE.test(o.end) &&
    typeof o.location === "string" &&
    o.location.trim() !== "" &&
    (o.note === undefined || o.note === null || typeof o.note === "string")
  );
}

/** Harmonogram z nadpisaniem z panelu (lub bazowy). */
export async function getSchedule(): Promise<ScheduleSlot[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return SCHEDULE;
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", KEY)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    const value = data?.value;
    if (Array.isArray(value) && value.length > 0 && value.every(isValidSlot)) {
      return value as ScheduleSlot[];
    }
  } catch (e) {
    console.warn("[schedule] getSchedule - fallback:", e);
  }
  return SCHEDULE;
}

