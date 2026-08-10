import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Wyróżnione zdjęcia albumów galerii: ścieżka folderu -> public_id zdjęcia.
 *
 * Trzymane w `site_settings` pod jednym kluczem, a nie w osobnej tabeli ani
 * w metadanych Cloudinary. Osobna tabela znaczyłaby DDL, którego PostgREST
 * nie wykona - właściciel musiałby ręcznie wklejać SQL w Supabase, żeby
 * w ogóle uruchomić tę funkcję. Metadane Cloudinary z kolei wymagałyby
 * zapisu do zasobu przy każdej zmianie i gubiłyby się przy ponownym wgraniu.
 */

export const KLUCZ_OKLADEK = "galeria:okladki";

/** Ścieżka folderu (np. „Galeria/Pokazy") -> public_id wyróżnionego zdjęcia. */
export type OkladkiAlbumow = Record<string, string>;

/**
 * Ustawia wyróżnione zdjęcie na początku listy.
 *
 * Gdy wyróżnionego zdjęcia nie ma już w folderze (redaktor je skasował),
 * kolejność zostaje bez zmian. Dzięki temu skasowanie zdjęcia nie wymaga
 * sprzątania wpisu w ustawieniach - album po prostu wraca do układu
 * domyślnego, zamiast pokazywać pustą ramkę.
 */
export function naPoczatek(zdjecia: string[], okladka: string | undefined): string[] {
  if (!okladka) return zdjecia;
  const i = zdjecia.indexOf(okladka);
  if (i <= 0) return zdjecia;
  return [zdjecia[i], ...zdjecia.slice(0, i), ...zdjecia.slice(i + 1)];
}

/** Mapa wyróżnionych zdjęć. Przy awarii bazy pusta - galeria działa dalej. */
export async function pobierzOkladki(): Promise<OkladkiAlbumow> {
  const sb = getSupabaseAdmin();
  if (!sb) return {};
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", KLUCZ_OKLADEK)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    const value = data?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    // Przepisujemy wpis po wpisie - w bazie mógł zostać kształt z wcześniejszej
    // wersji, a jeden zły wpis nie może wywrócić całej galerii.
    const wynik: OkladkiAlbumow = {};
    for (const [folder, publicId] of Object.entries(value as Record<string, unknown>)) {
      if (typeof publicId === "string" && publicId.trim()) wynik[folder] = publicId;
    }
    return wynik;
  } catch (e) {
    console.warn("[galeriaOkladki] pobierzOkladki:", e);
    return {};
  }
}
