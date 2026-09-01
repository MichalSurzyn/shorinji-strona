import { getSupabaseAdmin } from "./supabaseAdmin";
import { buildNavTree, type PageNavRow } from "./navTree";
import { MENU_FALLBACK } from "../data/menuFallback";
import type { NavItemRow, NavLink } from "./navTypes";

/**
 * Nawigacja strony — od etapu 3a czytana z drzewa `public.pages`, nie z `nav_items`.
 *
 * DLACZEGO ZAPASEM NIE JEST JUŻ `DEFAULT_NAV`
 * -------------------------------------------
 * Dopóki menu było listą etykiet nad adresami zakutymi w plikach tras, zapas
 * z kodu mógł się co najwyżej rozjechać z nazwami. Teraz z bazy pochodzi CAŁE
 * drzewo adresów, więc zapas, który jej nie odpowiada, podstawia w awarii linki
 * do stron, których nie ma. `DEFAULT_NAV` zostaje w `navTypes.ts` na czas
 * przejściowy, ale menu go już nie używa — zapasem jest `data/menuFallback.ts`,
 * generowany z tej samej tabeli tą samą funkcją `buildNavTree`
 * (`scripts/snapshot-menu.mjs`).
 *
 * CZTERY GAŁĘZIE ZAPASU — wszystkie cztery są potrzebne
 * ------------------------------------------------------
 * Trzy z nich łatwo zgubić przy przepisywaniu, bo z daleka wyglądają jak „to
 * samo co błąd", a nie są:
 *   1. brak konfiguracji Supabase   → `getSupabaseAdmin()` oddaje null i MEMOIZUJE
 *      ten wynik; po dołożeniu zmiennych trzeba zrestartować proces,
 *   2. błąd albo timeout 6 s        → zdarzyło się naprawdę: PGRST303 „JWT issued
 *      at future" przy zimnym starcie 2026-08-12 zrzucił menu, grafik i newsy,
 *   3. zero wierszy                 → tabela istnieje, ale backfill się nie wykonał,
 *   4. puste drzewo po złożeniu     → wiersze są, ale żaden nie nadaje się na
 *      pozycję menu (np. same nagłówki bez dzieci).
 *
 * Czego tu świadomie NIE MA: `normalizeNavTree`. Przenosiło ono stary adres
 * `/cennik` pod `/zajecia/cennik` i wciągało cennik do rozwijanego menu ZAJĘĆ —
 * naprawa danych w `nav_items`, robiona przy KAŻDYM renderze. W `pages` cennik
 * ma już adres `/zajecia/cennik` i wisi pod nagłówkiem ZAJĘCIA, bo backfill
 * ustawił to raz (etap 2). Transformacja, która potrafi przesunąć pozycję menu,
 * a nie ma nad czym pracować, to wyłącznie ryzyko — dane naprawia się w danych.
 */

/** Kolumny `pages` potrzebne do menu. Trzymane obok typu, żeby nie rozjechały się z nim. */
const KOLUMNY_MENU = "id,parent_id,kind,full_path,external_url,title,menu_label,depth,position";

export async function getNavTree(): Promise<NavLink[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return MENU_FALLBACK; // gałąź 1

  try {
    const { data, error } = await sb
      .from("pages")
      .select(KOLUMNY_MENU)
      .eq("in_menu", true)
      .eq("published", true)
      .is("deleted_at", null)
      // Rozwijane menu renderuje DWA poziomy. Trzeci poziom istnieje w drzewie
      // i wychodzi na stronę-hub z kafelkami (§3), więc do menu go nie bierzemy.
      .lte("depth", 1)
      .order("position", { ascending: true })
      .abortSignal(AbortSignal.timeout(6000));
    if (error) throw error;

    const rows = (data ?? []) as PageNavRow[];
    if (!rows.length) return MENU_FALLBACK; // gałąź 3

    const tree = buildNavTree(rows);
    return tree.length ? tree : MENU_FALLBACK; // gałąź 4
  } catch (e) {
    console.warn("[navigation] getNavTree - fallback:", e);
    return MENU_FALLBACK; // gałąź 2
  }
}

/**
 * Surowe wiersze `nav_items` do starego edytora w panelu (`/admin/nawigacja`).
 *
 * Zostaje na `nav_items` świadomie: publiczne menu czyta już `pages`, ale
 * zakładka „Nawigacja" nadal edytuje starą tabelę i zostanie zastąpiona
 * ekranem „Strony i menu" w etapie 5. Do tego czasu zapis w tej zakładce
 * NIE wpływa na menu na stronie — i tak ma być, bo cała gałąź idzie na
 * produkcję jednym przełączeniem, razem z nowym panelem.
 */
export async function getNavRows(): Promise<NavItemRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("nav_items")
      .select("id,parent_id,label,href,position,visible")
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as NavItemRow[];
  } catch {
    return [];
  }
}
