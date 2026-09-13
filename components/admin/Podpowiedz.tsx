"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * Chmurka z wyjaśnieniem przy kursorze.
 *
 * DLACZEGO
 * --------
 * Rząd akcji w drzewie stron to osiem kontrolek podpisanych skrótowo
 * („Zdejmij z menu", „Zamień na nagłówek", cztery strzałki). Napis mówi, CO
 * przycisk robi, ale nie mówi, co się po tym stanie ze stroną — a te dwa
 * działania są mylące szczególnie: zdjęcie z menu NIE wyłącza strony,
 * zamiana na nagłówek wyłącza jej treść. Redaktor klikał i cofał.
 *
 * Natywny dymek z `title` tego nie załatwia: pojawia się po ~1,5 s, ma
 * czcionkę systemową (na Windows ~11 px), łamie się gdzie chce i nie da się
 * go ostylować. Zgłoszenie właściciela: „powinna pojawiać się chmurka
 * responsywna przy kursorze […] w środku też większa czcionka i wytłumaczone
 * kilkoma słowami co robi przycisk".
 *
 * PRZYCISKI W ŚRODKU CELOWO NIE NOSZĄ `title` — I TAK MA ZOSTAĆ
 * ------------------------------------------------------------
 * Wcześniej nosiły, a ten komponent zdejmował im atrybut na czas pokazu
 * własnej chmurki i przywracał przy zjechaniu kursorem — po to, żeby nad
 * przyciskiem nie wisiały dwa dymki naraz. Pomiar playwrightem pokazał, że ten
 * ping-pong rozsypuje się przy NIERUCHOMYM kursorze: po kliknięciu „Wyżej"
 * lista przebudowuje się pod myszą, przeglądarka wysyła mouseout+mouseover,
 * chmurka wychodzi nad nowym przyciskiem i zdejmuje mu `title` — a
 * `mouseleave`, które miało go przywrócić, dotyczyłoby starego, już usuniętego
 * elementu i nigdy nie pada. Przycisk zostaje bez `title`, dopóki mysz się nie
 * ruszy. Testy odbioru szukają kontrolek selektorem po tym atrybucie i wisiały
 * do timeoutu.
 *
 * Dlatego przyciski mają dziś stałe `aria-label` (patrz TreeManager) zamiast
 * `title`: czytnik ekranu ma po czym je nazwać, testy mają po czym je znaleźć,
 * a skoro `title` w DOM nie ma, to natywny dymek nie ma się z czego wziąć —
 * i nie ma czego zdejmować. Nie dorzucaj `title` z powrotem „dla dostępności";
 * wróciłby razem z nim cały ten mechanizm i ta sama awaria.
 *
 * UŻYCIE
 * ------
 *     <Podpowiedz tresc="Zdejmuje pozycję z menu, ale strona dalej działa pod swoim adresem.">
 *       <button aria-label="Zdejmij z menu" …>…</button>
 *     </Podpowiedz>
 */

/** Ile trzeba postać na przycisku, zanim chmurka wyjdzie. */
const ZWLOKA_MS = 120;
/** Odsunięcie od kursora — tyle, żeby chmurka nie leżała pod strzałką myszy. */
const ODSTEP_OD_KURSORA = 16;
/** Minimalny prześwit przy krawędzi okna. */
const MARGINES_OKNA = 8;

type ZrodloMedia = {
  subskrybuj: (przyZmianie: () => void) => () => void;
  czytaj: () => boolean;
  czytajZSerwera: () => boolean;
};

/**
 * JEDNO modułowe źródło odpowiedzi na zapytanie o media, współdzielone przez
 * wszystkie chmurki na ekranie.
 *
 * Poprzednia wersja trzymała `useSyncExternalStore` w każdej instancji, a jego
 * migawka wołała `window.matchMedia` przy każdym wywołaniu. Pomiar: dwa
 * zapytania x ~360 instancji w rzędach akcji drzewa stron = ~720 wywołań
 * `matchMedia` na każdy render drzewa, ~1,7 ms — a render drzewa leci po
 * każdym kliknięciu strzałki. Każde wywołanie tworzyło przy tym nowy obiekt
 * MediaQueryList do posprzątania. Tutaj MediaQueryList i nasłuch powstają RAZ
 * na moduł, a instancja tylko dopisuje się do zbioru subskrybentów.
 *
 * Migawka siedzi w zmiennej modułu, zamiast być czytana z `mql.matches` przy
 * każdym wywołaniu: `czytaj()` leci przy każdym renderze, a stan mediów zmienia
 * się wyłącznie razem ze zdarzeniem `change` — więc jest co zapamiętać.
 *
 * Nasłuchu nie zdejmujemy, gdy zniknie ostatni subskrybent. To jeden listener
 * na cały moduł, żyjący tyle co karta przeglądarki; zakładanie go i zdejmowanie
 * przy każdym przemontowaniu drzewa kosztowałoby więcej, niż oszczędza.
 *
 * Dlaczego w ogóle `useSyncExternalStore`, a nie `useEffect` + `setState`:
 * reguła `react-hooks/set-state-in-effect` (React Compiler w `npx eslint`)
 * wywala `setState` w ciele efektu, a `matchMedia` to podręcznikowy
 * „zewnętrzny magazyn" — subskrypcja łapie też ZMIANĘ warunków w trakcie
 * pracy: redaktor podpina mysz do tabletu albo włącza w systemie ograniczenie
 * animacji i panel dostosowuje się bez przeładowania.
 *
 * Migawka serwera to `false`: na serwerze `window` nie istnieje, a w HTML
 * z serwera chmurki i tak nie ma — „brak hovera" jest bezpiecznym założeniem,
 * które nie rozjeżdża hydracji.
 */
function utworzZrodloMedia(zapytanie: string): ZrodloMedia {
  let mql: MediaQueryList | null = null;
  let migawka = false;
  const subskrybenci = new Set<() => void>();

  const zapewnijNasluch = () => {
    if (mql) return;
    mql = window.matchMedia(zapytanie);
    migawka = mql.matches;
    mql.addEventListener("change", (e) => {
      migawka = e.matches;
      for (const powiadom of subskrybenci) powiadom();
    });
  };

  return {
    subskrybuj(przyZmianie) {
      zapewnijNasluch();
      subskrybenci.add(przyZmianie);
      return () => {
        subskrybenci.delete(przyZmianie);
      };
    },
    czytaj() {
      // Pierwsze czytanie pada w renderze, czyli PRZED subskrypcją (efekty lecą
      // po nim) — magazyn musi umieć zainicjować się sam. Bez tego pierwszy
      // render zwracałby „false" i chmurka milczałaby aż do zmiany ustawień.
      zapewnijNasluch();
      return migawka;
    },
    czytajZSerwera() {
      return false;
    },
  };
}

const ZRODLO_HOVER = utworzZrodloMedia("(hover: hover)");
const ZRODLO_BEZ_RUCHU = utworzZrodloMedia("(prefers-reduced-motion: reduce)");

/**
 * Uchwyty magazynu są stałymi obiektu modułowego, więc ich tożsamość nie
 * zmienia się między renderami — React nie przepina subskrypcji po każdym
 * renderze i nie potrzeba tu `useCallback`.
 */
function useZrodloMedia(zrodlo: ZrodloMedia) {
  return useSyncExternalStore(zrodlo.subskrybuj, zrodlo.czytaj, zrodlo.czytajZSerwera);
}

export default function Podpowiedz({
  tresc,
  children,
}: {
  /** Kilka słów o skutku kliknięcia — nie powtórzenie napisu z przycisku. */
  tresc: string;
  /** Dokładnie JEDNO dziecko: przycisk albo inna kontrolka rzędu akcji. */
  children: React.ReactNode;
}) {
  const [widoczna, setWidoczna] = useState(false);
  const obslugujeHover = useZrodloMedia(ZRODLO_HOVER);
  const bezRuchu = useZrodloMedia(ZRODLO_BEZ_RUCHU);

  /**
   * Pozycja kursora siedzi w ref, nie w stanie. Gdyby była w stanie, każdy
   * `mousemove` (dziesiątki na sekundę) przerysowywałby cały rząd akcji
   * drzewa — a przy trzydziestu kartach to widać. Chmurkę przesuwamy więc
   * imperatywnie, przez `style.left/top`, i React renderuje ją raz na pokaz.
   */
  const kursorRef = useRef({ x: 0, y: 0 });
  const chmurkaRef = useRef<HTMLDivElement | null>(null);
  const licznikRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Trzymanie się w oknie liczone z RZECZYWISTEGO rozmiaru chmurki
   * (`clientWidth`/`clientHeight`), a nie z szacunku po długości tekstu:
   * przy `max-w-[22rem]` ta sama liczba znaków daje raz jedną, raz trzy
   * linie, więc „na oko" chmurka przy dolnej krawędzi i tak by wystawała.
   */
  const ustawPozycje = useCallback(() => {
    const el = chmurkaRef.current;
    if (!el) return;

    const { x, y } = kursorRef.current;
    const szerokosc = el.clientWidth;
    const wysokosc = el.clientHeight;

    let lewo = x + ODSTEP_OD_KURSORA;
    let gora = y + ODSTEP_OD_KURSORA;

    // Nie mieści się po prawej / pod spodem — odbijamy na drugą stronę kursora.
    if (lewo + szerokosc + MARGINES_OKNA > window.innerWidth) {
      lewo = x - ODSTEP_OD_KURSORA - szerokosc;
    }
    if (gora + wysokosc + MARGINES_OKNA > window.innerHeight) {
      gora = y - ODSTEP_OD_KURSORA - wysokosc;
    }

    el.style.left = `${Math.max(MARGINES_OKNA, lewo)}px`;
    el.style.top = `${Math.max(MARGINES_OKNA, gora)}px`;
  }, []);

  const schowaj = useCallback(() => {
    if (licznikRef.current) {
      clearTimeout(licznikRef.current);
      licznikRef.current = null;
    }
    setWidoczna(false);
  }, []);

  /**
   * Ustawienie pozycji w zwykłym `useEffect`, nie `useLayoutEffect`.
   *
   * `useLayoutEffect` w komponencie renderowanym także na serwerze sypie
   * ostrzeżeniem w konsoli, a nie jest tu potrzebny: pierwszy render chmurki
   * ma `opacity: 0`, więc klatka sprzed ustawienia współrzędnych i tak jest
   * niewidoczna. Nie ma czego zobaczyć w lewym górnym rogu.
   */
  useEffect(() => {
    if (!widoczna) return;
    const el = chmurkaRef.current;
    if (!el) return;

    ustawPozycje();

    if (bezRuchu) {
      el.style.opacity = "1";
      return;
    }
    // Zapalenie w kolejnej klatce — inaczej przeglądarka nie ma od czego
    // animować przejścia i chmurka po prostu wyskakuje.
    const klatka = requestAnimationFrame(() => {
      el.style.opacity = "1";
    });
    return () => cancelAnimationFrame(klatka);
  }, [widoczna, bezRuchu, ustawPozycje]);

  // Escape gasi chmurkę natychmiast — także wtedy, gdy kursor stoi w miejscu.
  useEffect(() => {
    if (!widoczna) return;
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") schowaj();
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [widoczna, schowaj]);

  useEffect(
    () => () => {
      // Odmontowanie w trakcie odliczania (wiersz zniknął po zapisie) nie może
      // zostawić timera, który po chwili zawoła setState na martwym komponencie.
      if (licznikRef.current) clearTimeout(licznikRef.current);
    },
    [],
  );

  return (
    <>
      {/*
        `display: contents` (klasa `contents`) — ten span NIE tworzy własnego
        pudełka, więc przycisk zostaje bezpośrednim elementem `flex` rzędu akcji
        i `gap-3` między grupami strzałek nie rozjeżdża się o dodatkowy poziom.
        Owijamy, zamiast klonować dziecko przez `cloneElement`: reguła
        `react-hooks/refs` (React Compiler, `npx eslint`) uznaje przekazanie do
        `cloneElement` funkcji sięgającej do refów za odczyt refa w czasie
        renderu i wywala build lintera. Na zwykłym elemencie JSX ten sam uchwyt
        przechodzi. Nie jest to więc kwestia gustu — powrót do `cloneElement`
        wymaga wyłączenia reguły.

        Uchwyty siedzą na spanie, a nie na dziecku, więc własne `onMouseEnter`
        czy `onClick` przycisku zostają nietknięte: zdarzenia po prostu do nas
        bąbelkują.
      */}
      <span
        className="contents"
        onMouseEnter={(e) => {
          // Brak hovera (telefon, tablet) — nic nie pokazujemy.
          if (!obslugujeHover) return;
          // Pozycję bierzemy już tu: jeśli kursor wjedzie i znieruchomieje,
          // `mousemove` może nie paść ani razu przed upływem zwłoki.
          kursorRef.current = { x: e.clientX, y: e.clientY };
          if (licznikRef.current) clearTimeout(licznikRef.current);
          licznikRef.current = setTimeout(() => setWidoczna(true), ZWLOKA_MS);
        }}
        onMouseMove={(e) => {
          if (!obslugujeHover) return;
          kursorRef.current = { x: e.clientX, y: e.clientY };
          if (widoczna) ustawPozycje();
        }}
        onMouseLeave={() => schowaj()}
        onMouseDown={() => {
          // Po kliknięciu wiersz często się przebudowuje albo przykrywa go
          // okno potwierdzenia — `mouseleave` bywa wtedy nigdy nie dostarczony
          // i chmurka zostaje na ekranie jako sierota.
          schowaj();
        }}
        onBlur={() => schowaj()}
      >
        {children}
      </span>

      {/* Portal do `document.body`, bo rząd akcji siedzi w kartach
          z `overflow-hidden` (grupy strzałek) i w przewijanej kolumnie panelu —
          chmurka renderowana w miejscu byłaby przycinana. Panel stoi na
          z-[80], więc chmurka na z-[100]. `pointer-events-none` jest
          obowiązkowe: chmurka idzie za kursorem, więc bez tego wjeżdżałaby
          pod niego, zabierała hover przyciskowi i migotała. */}
      {widoczna &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={chmurkaRef}
            role="tooltip"
            data-podpowiedz=""
            style={{ position: "fixed", left: 0, top: 0, opacity: 0 }}
            className={`pointer-events-none z-[100] max-w-[22rem] rounded-lg bg-slate-900 px-3 py-2 text-[0.95rem] leading-snug text-white shadow-lg ${
              bezRuchu ? "" : "transition-opacity duration-100"
            }`}
          >
            {tresc}
          </div>,
          document.body,
        )}
    </>
  );
}
