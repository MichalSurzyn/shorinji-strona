import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_ORGANIZATION, type OrganizationData } from "./organizationTypes";

/**
 * Dane podmiotu z bazy (site_settings, klucz "organization").
 *
 * Scalanie sekcja po sekcji z wartościami startowymi: wpis zapisany przed
 * dodaniem nowego pola nie wywróci strony brakiem klucza. To NIE jest
 * podstawianie treści z kodu w miejsce pustych pól - pusty string zapisany
 * przez redaktora zostaje pusty i konsument ma go pominąć.
 */

const KLUCZ = "organization";

function scal(zapisane: unknown): OrganizationData {
  if (!zapisane || typeof zapisane !== "object") return DEFAULT_ORGANIZATION;
  const z = zapisane as Partial<OrganizationData>;
  return {
    nazwy: { ...DEFAULT_ORGANIZATION.nazwy, ...(z.nazwy ?? {}) },
    kontakt: { ...DEFAULT_ORGANIZATION.kontakt, ...(z.kontakt ?? {}) },
    miejsceZajec: {
      ...DEFAULT_ORGANIZATION.miejsceZajec,
      ...(z.miejsceZajec ?? {}),
      adres: {
        ...DEFAULT_ORGANIZATION.miejsceZajec.adres,
        ...(z.miejsceZajec?.adres ?? {}),
      },
    },
    siedziba: {
      ...DEFAULT_ORGANIZATION.siedziba,
      ...(z.siedziba ?? {}),
      adres: { ...DEFAULT_ORGANIZATION.siedziba.adres, ...(z.siedziba?.adres ?? {}) },
    },
    rejestr: { ...DEFAULT_ORGANIZATION.rejestr, ...(z.rejestr ?? {}) },
    social: { ...DEFAULT_ORGANIZATION.social, ...(z.social ?? {}) },
    bank: { ...DEFAULT_ORGANIZATION.bank, ...(z.bank ?? {}) },
    emailDaneOsobowe: z.emailDaneOsobowe ?? DEFAULT_ORGANIZATION.emailDaneOsobowe,
  };
}

/**
 * `cache()` deduplikuje odczyt w obrębie jednego renderu - stopkę, mapę,
 * dane strukturalne i metadane obsługuje jedno zapytanie.
 */
export const getOrganization = cache(async (): Promise<OrganizationData> => {
  const sb = getSupabaseAdmin();
  if (!sb) return DEFAULT_ORGANIZATION;
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", KLUCZ)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    return scal(data?.value);
  } catch (e) {
    // Awaria bazy nie może wywrócić strony - lepiej pokazać komplet danych
    // sprzed migracji niż pustą stopkę i mapę bez adresu.
    console.warn("[organization] getOrganization - wartości startowe:", e);
    return DEFAULT_ORGANIZATION;
  }
});

/** Czy dane zostały już zapisane w panelu (do plakietki w panelu). */
export async function czyZapisanoOrganizacje(): Promise<boolean> {
  const sb = getSupabaseAdmin();
  if (!sb) return false;
  try {
    const { data } = await sb.from("site_settings").select("key").eq("key", KLUCZ).maybeSingle();
    return !!data;
  } catch {
    return false;
  }
}
