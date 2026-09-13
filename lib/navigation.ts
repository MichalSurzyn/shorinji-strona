import { getSupabaseAdmin } from "./supabaseAdmin";
import { buildNavTree, type PageNavRow } from "./navTree";
import { MENU_FALLBACK } from "../data/menuFallback";
import type { NavLink } from "./navTypes";

/**
 * Nawigacja strony — od etapu 3a czytana z drzewa `public.pages`, nie z `nav_items`.
 *
 * DLACZEGO ZAPASEM NIE JEST JUŻ `DEFAULT_NAV`
 * -------------------------------------------
 * Dopóki menu było listą etykiet nad adresami zakutymi w plikach tras, zapas
 * z kodu mógł się co najwyżej rozjechać z nazwami. Teraz z bazy pochodzi CAŁE
 * drzewo adresów, więc zapas, który jej nie odpowiada, podstawia w awarii linki
 * do stron, których nie ma. `DEFAULT_NAV` został usunięty w etapie 8 razem
 * z `NavItemRow` — oba opisywały tabelę `nav_items`, której już nie ma.
 * Zapasem jest `data/menuFallback.ts`, generowany z tej samej tabeli tą samą
 * funkcją `buildNavTree` (`scripts/snapshot-menu.mjs`).
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

/**
 * Kolumny `pages` potrzebne do menu. Trzymane obok typu, żeby nie rozjechały się z nim.
 *
 * `published` i `in_menu` są tu od punktu A6: filtr widoczności przeniósł się
 * z zapytania do `buildNavTree`, więc obie flagi muszą DOJECHAĆ do funkcji.
 */
const KOLUMNY_MENU =
  "id,parent_id,kind,full_path,external_url,title,menu_label,depth,position,published,in_menu";

export async function getNavTree(): Promise<NavLink[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return MENU_FALLBACK; // gałąź 1

  try {
    const { data, error } = await sb
      .from("pages")
      .select(KOLUMNY_MENU)
      // ŚWIADOMIE BEZ `.eq("in_menu", true)` i `.eq("published", true)`.
      //
      // Do punktu A6 oba filtry stały tutaj. Ukryty rodzic wypadał wtedy
      // z zestawu, a jego dziecko zostawało sierotą — znikało z menu jako
      // skutek uboczny mechaniki składania drzewa, nie jako decyzja. Że to
      // skutek uboczny, a nie funkcja, widać było po tym, że adres tego
      // dziecka dalej oddawał 200, a panel nie pokazywał niczego.
      //
      // Teraz pobieramy KOMPLET żywych wierszy i widoczność liczy
      // `widoczneGalezie` wewnątrz `buildNavTree` — po całym łańcuchu przodków,
      // raz, wspólnie ze `scripts/snapshot-menu.mjs`. Tabela ma kilkadziesiąt
      // wierszy i tak nie ma indeksu na tych kolumnach, więc koszt jest zerowy.
      .is("deleted_at", null)
      // Wszystkie trzy poziomy. Wcześniej stało tu `.lte("depth", 1)` z
      // założeniem, że trzeci poziom pokazuje się wyłącznie jako kafelek na
      // stronie rodzica — właściciel to odwołał: „nigdy nie ustalałem, że ma
      // być ukryty, to tylko mniejsza kreska i czcionka w menu". Kafelki
      // zostają, menu dostaje trzeci poziom jako wciętą pozycję listy.
      // Drugie kryterium jak w panelu i w `buildNavTree`. `position` nie ma
      // indeksu unikalnego, a bez tie-breaka PostgREST przy remisie zwraca
      // kolejność nieokreśloną — menu potrafiłoby zmienić układ między dwoma
      // odświeżeniami tej samej strony.
      .order("position", { ascending: true })
      .order("id", { ascending: true })
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
