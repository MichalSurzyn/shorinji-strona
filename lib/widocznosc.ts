/**
 * Widoczność liczona PO GAŁĘZI, nie po wierszu.
 *
 * ZGŁOSZENIE, KTÓRE TO WYWOŁAŁO (punkt A6, trzecia runda)
 * -------------------------------------------------------
 * „jak ukryję podstronę 2 poziomu, to podstrona 3 poziomu (ta pod nią) zostaje
 * ukryta, ale plakietka na to nie wskazuje”.
 *
 * Do tej pory `published` i `in_menu` sprawdzało się WIERSZ PO WIERSZU,
 * w pięciu niezależnych zapytaniach (menu, render strony, kafelki, prerender,
 * sitemapa). Ukrycie rodzica wyrzucało z menu także jego dzieci — ale nie
 * dlatego, że ktoś tak zdecydował, tylko dlatego, że dziecko zostawało bez
 * rodzica w zestawie i `buildNavTree` gubiło je jako sierotę. Skutek uboczny
 * wyglądał jak funkcja, a nie był nią: w bazie dziecko dalej miało
 * `published = true`, panel nie pokazywał niczego niepokojącego, a jego adres
 * DALEJ oddawał 200. Redaktor mógł więc „ukryć” gałąź i zostawić w serwisie
 * żywe, zaindeksowane strony, o których był przekonany, że ich nie ma.
 *
 * Decyzja właściciela: ukrycie liczone po gałęzi. Flag dzieci NIE ruszamy
 * w bazie — dzięki temu odkrycie rodzica przywraca dokładnie ten układ, który
 * był wcześniej, i nie trzeba nigdzie pamiętać stanu sprzed kaskady.
 *
 * DLACZEGO TO CZYSTA FUNKCJA, A NIE WIDOK W POSTGRESIE
 * -----------------------------------------------------
 * `full_path` liczy trigger, bo wiersze bywają zapisywane skryptem migracji
 * i wprost z SQL Editora — derywacja musi być przy danych. Tutaj ten argument
 * nie działa: widoczność po gałęzi jest wyłącznie ODCZYTYWANA, nigdy
 * zapisywana, więc żaden skrypt nie ma jak jej zepsuć. Widok kosztowałby drugą
 * nazwę obiektu i drugą listę kolumn do utrzymania, wdrażaną ręcznie w SQL
 * Editorze — czyli kod mógłby wyprzedzić bazę bez żadnego sygnału.
 *
 * Plik jest CZYSTY: zero importów, zero wejścia-wyjścia. Dzięki temu wołają go
 * zarówno render serwerowy, jak i `scripts/snapshot-menu.mjs` (Node, bez
 * klienta bazy) oraz komponent panelu oznaczony `"use client"`.
 */

/** Wiersz `public.pages` w zakresie potrzebnym do policzenia widoczności. */
export interface WierszWidocznosci {
  id: string;
  parent_id: string | null;
  published: boolean;
  in_menu: boolean;
}

export interface WidoczneGalezie {
  /** Id wierszy, których CAŁY łańcuch w górę jest opublikowany. */
  opublikowane: Set<string>;
  /** Id wierszy, których cały łańcuch jest opublikowany ORAZ trzymany w menu. */
  wMenu: Set<string>;
}

/**
 * Ile skoków w górę wolno zrobić, zanim uznamy dane za zapętlone.
 *
 * Drzewo ma `depth` 0..2, więc realnie potrzeba najwyżej trzech. Limit jest
 * mimo to jawny i z zapasem — dokładnie tak, jak `poziom < 10` w obu CTE
 * w `supabase/03-drzewo-stron.sql`. Bez niego jeden zapętlony wiersz (a taki
 * potrafi powstać przy ręcznym zapisie z pominięciem triggera) zawiesiłby
 * render KAŻDEJ strony serwisu, bo menu siedzi w layoucie.
 */
const LIMIT_SKOKOW = 12;

/**
 * Liczy obie widoczności jednym przebiegiem.
 *
 * WEJŚCIE MUSI BYĆ KOMPLETNE: wszystkie żywe wiersze drzewa (`deleted_at is
 * null`), łącznie z nagłówkami i wierszami `source='route'`. Nie wolno podawać
 * tu wyniku zapytania zawężonego po `kind` albo `source` — wtedy część rodziców
 * wypada z zestawu i reguła liczy się na urwanym łańcuchu. Realny przykład
 * z tego serwisu: `/faq` jest stroną z bazy stojącą pod NAGŁÓWKIEM „ZAJĘCIA”,
 * a zapytanie sitemapy ma `.eq("kind","page")` — nagłówek by z niego wypadł.
 *
 * Wiersz, którego rodzica nie ma w zestawie, jest traktowany jako NIEWIDOCZNY.
 * Przy kompletnym wejściu znaczy to „rodzic leży w koszu”, a strona pod
 * wyrzuconym rodzicem nie ma prawa świecić publicznie.
 */
export function widoczneGalezie(wiersze: WierszWidocznosci[]): WidoczneGalezie {
  const wgId = new Map<string, WierszWidocznosci>();
  for (const w of wiersze) wgId.set(w.id, w);

  const opublikowane = new Set<string>();
  const wMenu = new Set<string>();
  // Wynik per wiersz, żeby wspólny przodek nie był przechodzony raz na każde
  // dziecko. Przy trzydziestu wierszach to nie ma znaczenia, przy trzystu ma.
  const policzone = new Map<string, { opublikowany: boolean; wMenu: boolean }>();

  const policz = (id: string): { opublikowany: boolean; wMenu: boolean } => {
    const gotowe = policzone.get(id);
    if (gotowe) return gotowe;

    let opublikowany = true;
    let widocznyWMenu = true;
    let biezacy: string | null = id;

    for (let skok = 0; skok < LIMIT_SKOKOW; skok++) {
      if (biezacy === null) break; // doszliśmy do korzenia — łańcuch cały
      const w: WierszWidocznosci | undefined = wgId.get(biezacy);
      if (!w) {
        // Rodzic spoza zestawu: łańcuch urwany, więc nic pod nim nie świeci.
        opublikowany = false;
        widocznyWMenu = false;
        break;
      }
      if (!w.published) opublikowany = false;
      if (!w.published || !w.in_menu) widocznyWMenu = false;
      if (!opublikowany && !widocznyWMenu) break; // dalej i tak nic nie zmieni
      biezacy = w.parent_id;
    }

    const wynik = { opublikowany, wMenu: widocznyWMenu };
    policzone.set(id, wynik);
    return wynik;
  };

  for (const w of wiersze) {
    const { opublikowany, wMenu: wm } = policz(w.id);
    if (opublikowany) opublikowane.add(w.id);
    if (wm) wMenu.add(w.id);
  }

  return { opublikowane, wMenu };
}

/**
 * Powód, dla którego pozycja jest niewidoczna MIMO własnych ustawień —
 * do plakietki w panelu.
 *
 * Zwraca `null`, gdy pozycja jest widoczna albo gdy jest niewidoczna z powodu
 * WŁASNYCH pól (wtedy panel pokazuje zwykłe „ukryta” / „poza menu” i drugie
 * zdanie o rodzicu byłoby szumem).
 */
export function powodNiewidocznosci(
  id: string,
  wiersze: WierszWidocznosci[],
): "rodzic-ukryty" | "rodzic-poza-menu" | null {
  const wgId = new Map(wiersze.map((w) => [w.id, w]));
  const ja = wgId.get(id);
  if (!ja) return null;
  if (!ja.published || !ja.in_menu) return null;

  let biezacy = ja.parent_id;
  for (let skok = 0; skok < LIMIT_SKOKOW && biezacy !== null; skok++) {
    const w = wgId.get(biezacy);
    if (!w) return "rodzic-ukryty";
    if (!w.published) return "rodzic-ukryty";
    if (!w.in_menu) return "rodzic-poza-menu";
    biezacy = w.parent_id;
  }
  return null;
}
