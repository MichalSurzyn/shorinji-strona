import { getSupabaseAdmin } from "./supabaseAdmin";

/**
 * Historia zmian treści i kosz.
 *
 * Migawkę zapisujemy PRZED nadpisaniem, więc historia zawiera stany, do
 * których da się wrócić. Zapis migawki nigdy nie blokuje zapisu treści -
 * gdyby historia była niedostępna, redaktor i tak musi móc zapisać pracę.
 */

/** Rodzaj treści, której dotyczy migawka. */
export type RodzajTresci =
  | "article"
  | "custom_page"
  | "page"
  | "topic_article"
  | "footer"
  | "schedule"
  | "organization";

/**
 * Ile wersji trzymamy na jeden element.
 *
 * Limit pilnuje KOD, nie baza. Bez niego tabela rosłaby bez ograniczeń,
 * a plan darmowy Supabase ma 500 MB. Przy 20 wersjach i kilkudziesięciu
 * elementach mówimy o mniej niż jednym megabajcie.
 */
const LIMIT_WERSJI = 20;

/** Po ilu dniach rzeczy z kosza znikają na dobre. */
export const DNI_W_KOSZU = 30;

export interface WersjaTresci {
  id: string;
  value: unknown;
  author: string | null;
  created_at: string;
}

/**
 * Zapisuje migawkę stanu SPRZED zmiany.
 *
 * Świadomie nie zwraca błędu: nieudany zapis historii nie może przerwać
 * zapisu treści. Redaktor straciłby pracę przez awarię mechanizmu, który
 * ma go przed stratą pracy chronić.
 */
export async function zapiszWersje(
  rodzaj: RodzajTresci,
  klucz: string,
  wartosc: unknown,
  autor?: string | null
): Promise<void> {
  const sb = getSupabaseAdmin();
  if (!sb || wartosc === undefined || wartosc === null) return;
  try {
    await sb.from("content_versions").insert({
      entity_type: rodzaj,
      entity_key: klucz,
      value: wartosc,
      author: autor ?? null,
    });
    await przytnijHistorie(sb, rodzaj, klucz);
  } catch (e) {
    console.warn(`[wersje] nie zapisano migawki ${rodzaj}/${klucz}:`, e);
  }
}

/** Kasuje najstarsze wersje ponad limit. */
async function przytnijHistorie(
  sb: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  rodzaj: RodzajTresci,
  klucz: string
): Promise<void> {
  const { data } = await sb
    .from("content_versions")
    .select("id")
    .eq("entity_type", rodzaj)
    .eq("entity_key", klucz)
    .order("created_at", { ascending: false });
  const nadmiar = (data ?? []).slice(LIMIT_WERSJI).map((r) => r.id as string);
  if (nadmiar.length) await sb.from("content_versions").delete().in("id", nadmiar);
}

/** Historia elementu, od najnowszej. */
export async function historia(
  rodzaj: RodzajTresci,
  klucz: string
): Promise<WersjaTresci[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("content_versions")
      .select("id,value,author,created_at")
      .eq("entity_type", rodzaj)
      .eq("entity_key", klucz)
      .order("created_at", { ascending: false })
      .limit(LIMIT_WERSJI);
    if (error) throw error;
    return (data ?? []) as WersjaTresci[];
  } catch (e) {
    console.warn(`[wersje] odczyt historii ${rodzaj}/${klucz}:`, e);
    return [];
  }
}

/** Pojedyncza wersja - do przywrócenia. */
export async function wersja(id: string): Promise<WersjaTresci | null> {
  const sb = getSupabaseAdmin();
  if (!sb) return null;
  try {
    const { data } = await sb
      .from("content_versions")
      .select("id,value,author,created_at")
      .eq("id", id)
      .maybeSingle();
    return (data as WersjaTresci) ?? null;
  } catch {
    return null;
  }
}

/**
 * Opróżnia kosz z rzeczy starszych niż {@link DNI_W_KOSZU}.
 *
 * Wywoływane przy wyświetlaniu list w panelu - kosz i tak ogląda tylko
 * zalogowana osoba, a osobnego zadania cyklicznego tu nie ma.
 */
export async function oproznijStaryKosz(tabela: "articles" | "custom_pages"): Promise<number> {
  const sb = getSupabaseAdmin();
  if (!sb) return 0;
  const granica = new Date();
  granica.setDate(granica.getDate() - DNI_W_KOSZU);
  try {
    const { data, error } = await sb
      .from(tabela)
      .delete()
      .not("deleted_at", "is", null)
      .lt("deleted_at", granica.toISOString())
      .select("id");
    if (error) throw error;
    return (data ?? []).length;
  } catch (e) {
    console.warn(`[kosz] czyszczenie ${tabela}:`, e);
    return 0;
  }
}
