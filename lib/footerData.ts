import { getSupabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_FOOTER, type FooterData } from "./footerTypes";

/** Dane stopki z site_settings (klucz "footer") z fallbackiem do kodu. */
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
    const v = data?.value as Partial<FooterData> | null;
    if (!v || typeof v !== "object") return DEFAULT_FOOTER;
    // Scal z domyślnymi - brakujące pola nie wywrócą stopki.
    return {
      about: v.about ?? DEFAULT_FOOTER.about,
      social: { ...DEFAULT_FOOTER.social, ...(v.social ?? {}) },
      downloads: Array.isArray(v.downloads) ? v.downloads : DEFAULT_FOOTER.downloads,
      documents: Array.isArray(v.documents) ? v.documents : DEFAULT_FOOTER.documents,
      contact: { ...DEFAULT_FOOTER.contact, ...(v.contact ?? {}) },
      copyright: v.copyright ?? DEFAULT_FOOTER.copyright,
    };
  } catch (e) {
    console.warn("[footer] getFooterData - fallback:", e);
    return DEFAULT_FOOTER;
  }
}
