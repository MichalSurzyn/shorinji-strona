import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Data dodania albumu galerii: ścieżka folderu -> znacznik czasu ISO.
 *
 * PO CO, SKORO CLOUDINARY MA DATY
 * -------------------------------
 * Cloudinary daje datę utworzenia ZASOBU, nie FOLDERU — `api.sub_folders`
 * zwraca wyłącznie nazwę i ścieżkę. Album świeżo utworzony i jeszcze pusty
 * nie ma więc żadnej daty, a właśnie on ma stanąć na początku listy: redaktor
 * zakłada folder, żeby zaraz coś do niego wrzucić.
 *
 * Sortowanie po najnowszym zdjęciu w albumie też nie wystarcza. Na dziś trzy
 * z czterech albumów są PUSTE („2023 - Taikai w Japonii", „2025 - Gasshuku
 * w Hombu", „2026 - Taikai w Berlinie") — po dacie zdjęć wszystkie trzy
 * wylądowałyby razem, w kolejności przypadkowej.
 *
 * Trzymane w `site_settings` pod jednym kluczem, dokładnie jak `galeria:okladki`
 * i z tego samego powodu: osobna tabela znaczyłaby DDL, którego PostgREST nie
 * wykona — właściciel musiałby ręcznie wklejać SQL, żeby ta funkcja w ogóle
 * zadziałała.
 */

export const KLUCZ_KOLEJNOSCI = "galeria:dodane";

/** Ścieżka folderu (np. „Galeria/Pokazy") -> data dodania w ISO. */
export type DatyDodania = Record<string, string>;

/** Mapa dat dodania. Przy awarii bazy pusta — galeria działa dalej. */
export async function pobierzDatyDodania(): Promise<DatyDodania> {
  const sb = getSupabaseAdmin();
  if (!sb) return {};
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", KLUCZ_KOLEJNOSCI)
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    const value = data?.value;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    // Wpis po wpisie: w bazie mógł zostać kształt z wcześniejszej wersji,
    // a jedna zła data nie może wywrócić całej galerii.
    const wynik: DatyDodania = {};
    for (const [folder, kiedy] of Object.entries(value as Record<string, unknown>)) {
      if (typeof kiedy === "string" && !Number.isNaN(Date.parse(kiedy))) wynik[folder] = kiedy;
    }
    return wynik;
  } catch (e) {
    console.warn("[galeriaKolejnosc] pobierzDatyDodania:", e);
    return {};
  }
}

/** Zapisuje datę dodania folderu. Cicha porażka: kolejność to nie treść. */
export async function zapiszDateDodania(sciezka: string, kiedy = new Date().toISOString()) {
  const sb = getSupabaseAdmin();
  if (!sb) return;
  try {
    const daty = await pobierzDatyDodania();
    daty[sciezka] = kiedy;
    await sb.from("site_settings").upsert({
      key: KLUCZ_KOLEJNOSCI,
      value: daty,
      updated_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn("[galeriaKolejnosc] zapiszDateDodania:", e);
  }
}

/**
 * Porządek albumów: najnowszy dodany na początku.
 *
 * Albumy BEZ zapisanej daty (czyli te, które istniały przed wprowadzeniem tej
 * funkcji) zachowują swoją dotychczasową kolejność alfabetyczną i stoją PO
 * tych z datą. To celowo: świadomym życzeniem było, żeby nowy folder trafiał
 * na początek — nie żeby przemeblować to, co redaktor już zna. Gdyby zamiast
 * tego wstawić im daty „na oko", każdy album zmieniłby miejsce naraz.
 */
export function wgDatyDodania<T extends { path: string; name: string }>(
  foldery: T[],
  daty: DatyDodania,
): T[] {
  const zData = foldery.filter((f) => daty[f.path]);
  const bezDaty = foldery.filter((f) => !daty[f.path]);
  zData.sort((a, b) => Date.parse(daty[b.path]) - Date.parse(daty[a.path]));
  bezDaty.sort((a, b) => a.name.localeCompare(b.name, "pl"));
  return [...zData, ...bezDaty];
}
