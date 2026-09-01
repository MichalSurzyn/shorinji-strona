import type { NavLink } from "./navTypes";

/**
 * Budowa drzewa menu z wierszy tabeli `pages`.
 *
 * Wydzielone z `lib/navigation.ts` do osobnego pliku, bo ma DWÓCH konsumentów:
 * odczyt w czasie działania strony i `scripts/snapshot-menu.mjs`, który
 * produkuje zapasowy zrzut menu do repozytorium. Gdyby każdy z nich składał
 * drzewo po swojemu, zapas przestałby odpowiadać temu, co widzi odwiedzający —
 * i to bez śladu, bo zapas widać dopiero wtedy, gdy baza milczy.
 *
 * Funkcja jest czysta: żadnego wejścia-wyjścia, żadnego Supabase. Dzięki temu
 * da się ją wywołać ze skryptu w Node bez stawiania klienta bazy.
 */

/** Wiersz `public.pages` w zakresie potrzebnym do menu. */
export interface PageNavRow {
  id: string;
  parent_id: string | null;
  kind: "page" | "link" | "header";
  full_path: string | null;
  external_url: string | null;
  title: string;
  menu_label: string | null;
  depth: number;
  position: number;
}

/** Adres, pod który prowadzi pozycja menu. Nagłówek nie prowadzi nigdzie. */
function adres(w: PageNavRow): string | undefined {
  if (w.kind === "link") return w.external_url ?? undefined;
  if (w.kind === "header") return undefined;
  return w.full_path ?? undefined;
}

export function buildNavTree(rows: PageNavRow[]): NavLink[] {
  const wgPozycji = (a: PageNavRow, b: PageNavRow) => a.position - b.position;

  return rows
    .filter((w) => w.depth === 0)
    .sort(wgPozycji)
    .map((rodzic) => {
      const dzieci = rows
        .filter((w) => w.parent_id === rodzic.id)
        .sort(wgPozycji)
        // Dziecko bez adresu wypada z menu. Dotyczy nagłówka zagnieżdżonego pod
        // nagłówkiem: `NavChild` wymaga `href`, a rozwijane menu i tak renderuje
        // tylko dwa poziomy (§3), więc nie ma go gdzie kliknąć. Ta sama zasada
        // co w starym odczycie z `nav_items`, gdzie dziecko bez `href` też było
        // pomijane.
        .map((w) => ({ href: adres(w), label: w.menu_label ?? w.title }))
        .filter((w): w is { href: string; label: string } => Boolean(w.href));

      const hrefRodzica = adres(rodzic);
      return {
        label: rodzic.menu_label ?? rodzic.title,
        ...(hrefRodzica ? { href: hrefRodzica } : {}),
        ...(dzieci.length ? { dropdown: dzieci } : {}),
      };
    })
    // Węzeł bez adresu i bez widocznych dzieci nie ma po co być w menu:
    // wyrenderowałby się jako martwa etykieta, w którą nie da się kliknąć
    // (wymóg z tabeli etapów, wiersz 3b).
    .filter((w) => w.href || w.dropdown?.length);
}
