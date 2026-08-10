import { getSupabaseAdmin } from "./supabaseAdmin";
import {
  DEFAULT_FOOTER,
  migrujStopke,
  type FooterData,
  type FooterKolumna,
} from "./footerTypes";

/**
 * Dane stopki z site_settings (klucz „footer") z fallbackiem do kodu.
 *
 * Wpisy zapisane przed wprowadzeniem kolumn są przepisywane w locie
 * (migrujStopke), więc stopka wygląda tak samo bez ruszania bazy.
 */
export async function getFooterData(): Promise<FooterData> {
  const sb = getSupabaseAdmin();
  if (!sb) return DEFAULT_FOOTER;
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "footer")
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    const v = data?.value as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return DEFAULT_FOOTER;

    // Stary układ: brak pola „kolumny", za to links/downloads/documents.
    if (!Array.isArray(v.kolumny)) return migrujStopke(v);

    const kolumny = (v.kolumny as FooterKolumna[])
      .filter((k) => k && typeof k.id === "string")
      .map((k) => ({
        id: k.id,
        tytul: typeof k.tytul === "string" ? k.tytul : "",
        rodzaj: k.rodzaj === "kontakt" ? ("kontakt" as const) : ("linki" as const),
        widoczna: k.widoczna !== false,
        pokazProfile: k.pokazProfile === true,
        pozycje: Array.isArray(k.pozycje) ? k.pozycje : [],
      }));

    return {
      kolumny: kolumny.length ? kolumny : DEFAULT_FOOTER.kolumny,
      copyright: typeof v.copyright === "string" ? v.copyright : DEFAULT_FOOTER.copyright,
    };
  } catch (e) {
    console.warn("[footer] getFooterData - fallback:", e);
    return DEFAULT_FOOTER;
  }
}
