import type { NavChild, NavLink } from "./navTypes";
import { widoczneGalezie } from "./widocznosc";

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
  published: boolean;
  in_menu: boolean;
}

/** Adres, pod który prowadzi pozycja menu. Nagłówek nie prowadzi nigdzie. */
function adres(w: PageNavRow): string | undefined {
  if (w.kind === "link") return w.external_url ?? undefined;
  if (w.kind === "header") return undefined;
  return w.full_path ?? undefined;
}

/**
 * Składa menu z KOMPLETU żywych wierszy drzewa.
 *
 * Filtr widoczności siedzi TUTAJ, a nie w zapytaniu — i to jest cała zmiana
 * z punktu A6. Powód jest ten sam, dla którego ten plik w ogóle powstał:
 * `scripts/snapshot-menu.mjs` woła tę samą funkcję, żeby wyprodukować zapas
 * menu do repozytorium. Reguła zostawiona po stronie zapytania musiałaby być
 * skopiowana do skryptu ręcznie — a rozjazd między nimi widać dopiero wtedy,
 * gdy baza milczy i serwis pokazuje zapas, czyli w najgorszym możliwym momencie.
 *
 * Wejściem są WSZYSTKIE wiersze z `deleted_at is null`, także ukryte i te poza
 * menu: bez ukrytego rodzica w zestawie nie da się stwierdzić, że jego dziecko
 * ma zniknąć razem z nim.
 */
export function buildNavTree(wszystkieZywe: PageNavRow[]): NavLink[] {
  const { wMenu } = widoczneGalezie(wszystkieZywe);
  const rows = wszystkieZywe.filter((w) => wMenu.has(w.id));

  /**
   * Pozycja, a przy remisie `id` — dokładnie ten sam klucz, którym sortuje
   * panel (`dzieci` w TreeManager) i akcje (`przenumeruj` w pagesActions).
   *
   * Indeks `pages_parent_position_idx` NIE jest unikalny, więc dwoje rodzeństwa
   * może mieć tę samą pozycję. Bez drugiego kryterium kolejność menu u
   * odwiedzającego jest wtedy NIEOKREŚLONA — a panel pokazuje swoją, bo on
   * tie-break ma. Porównanie znak po znaku, nie `localeCompare`: to drugie jest
   * zależne od locale, a ICU pomija myślnik na pierwszym poziomie porównania,
   * więc dla identyfikatorów dawałoby inny porządek niż `order("id")`
   * w Postgresie.
   */
  const wgPozycji = (a: PageNavRow, b: PageNavRow) =>
    a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

  /**
   * Gałąź poniżej pierwszego poziomu — rekurencyjnie, bo drugi i trzeci poziom
   * różnią się w menu tylko wcięciem i rozmiarem pisma.
   *
   * Węzeł bez adresu (nagłówek zagnieżdżony) ZOSTAJE, jeśli ma widoczne
   * podstrony: renderuje się jako podpis. Wypada tylko wtedy, gdy nie prowadzi
   * nigdzie i nie ma czego grupować — wcześniej wypadał zawsze, zabierając ze
   * sobą całą swoją gałąź.
   */
  const galaz = (rodzic: string): NavChild[] =>
    rows
      .filter((w) => w.parent_id === rodzic)
      .sort(wgPozycji)
      .map((w) => {
        const wnuki = galaz(w.id);
        return {
          label: w.menu_label ?? w.title,
          ...(adres(w) ? { href: adres(w) } : {}),
          ...(wnuki.length ? { children: wnuki } : {}),
        };
      })
      .filter((w) => w.href || w.children?.length);

  return rows
    .filter((w) => w.depth === 0)
    .sort(wgPozycji)
    .map((rodzic) => {
      const dzieci = galaz(rodzic.id);
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
