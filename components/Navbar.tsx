"use client";

import { useState, useEffect, useRef, useId } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { type NavChild, type NavLink } from '@/lib/navTypes';
import { MENU_FALLBACK } from '@/data/menuFallback';

/**
 * Menu górne. Oba widoki - desktopowy i mobilny - stoją na wzorcu disclosure:
 * lista `<ul>/<li>`, a pozycja z podstronami ma OSOBNY przycisk rozwijający
 * obok linku.
 *
 * DLACZEGO OSOBNY PRZYCISK, A NIE `aria-expanded` NA LINKU
 * -------------------------------------------------------
 * „O Shorinji Kempo" jest jednocześnie stroną i grupą. Jeden element nie może
 * uczciwie znaczyć obu rzeczy naraz: czytnik ekranu przeczytałby „link,
 * zwinięty", a użytkownik nie miałby jak wejść na samą stronę bez rozwijania
 * listy. Stąd para: `<a>` prowadzi na stronę, sąsiedni `<button>` rozwija
 * podstrony i to on nosi `aria-expanded`/`aria-controls`.
 *
 * DLACZEGO KLIK, A NIE HOVER
 * --------------------------
 * Poprzednia wersja otwierała listę czystym CSS-em (`group-hover`), bez stanu
 * w Reakcie. Na dotyku działało to przez przypadek - `globals.css` zdejmuje
 * `@media (hover:hover)` z wariantu `hover:`, więc pierwsze dotknięcie
 * „najeżdżało". Efekt: nie dało się tego zamknąć inaczej niż przez dotknięcie
 * gdzie indziej, a z klawiatury nie dało się otworzyć w ogóle. Teraz otwiera
 * klik, zamyka Escape (oddając fokus na przycisk), klik poza menu i zmiana trasy.
 *
 * `--nav-h` - UWAGA PRZY KAŻDEJ ZMIANIE TEGO PLIKU
 * ------------------------------------------------
 * `ResizeObserver` MUSI obserwować ZEWNĘTRZNY `<nav>`, ten sam, który jest
 * przyklejony do góry ekranu. Przeniesienie `ref` na element wewnętrzny albo
 * na `<ul>` zaniża zmierzoną wysokość i treść wjeżdża pod menu NA WSZYSTKICH
 * TRASACH (`.page-shell` liczy padding z tej zmiennej w 16 miejscach), a skoki
 * po kotwicach spisu treści lądują pod navbarem. Wartość startowa `200px`
 * z `globals.css` ma zostać nadpisana po pierwszym renderze - jeśli zostaje
 * `200px`, to znaczy, że obserwator nie działa.
 */
export default function Navbar({ links }: { links?: NavLink[] }) {
  const [isVisible, setIsVisible] = useState(true);
  const [menuMobilneOtwarte, setMenuMobilneOtwarte] = useState(false);
  /** Etykieta rozwiniętej pozycji na desktopie; null = wszystko zwinięte. */
  const [rozwinieta, setRozwinieta] = useState<string | null>(null);
  /** To samo w widoku mobilnym - osobno, bo widoki bywają otwarte niezależnie. */
  const [rozwinietaMobil, setRozwinietaMobil] = useState<string | null>(null);

  const navRef = useRef<HTMLElement | null>(null);
  const przyciskiRef = useRef<Record<string, HTMLButtonElement | null>>({});
  const hamburgerRef = useRef<HTMLButtonElement | null>(null);
  const idBazowy = useId();

  const pathname = usePathname();

  // Menu z bazy (przekazane przez layout); zapas - zrzut drzewa w repo.
  // Piąta gałąź zapasu, obok czterech w getNavTree: layout mógł przekazać
  // pustą listę. DEFAULT_NAV tu NIE wraca - po migracji nie odpowiada już
  // drzewu adresów i podstawiałby linki do stron, których nie ma.
  //
  // Filtr na końcu jest zabezpieczeniem, nie ozdobą: pozycja bez adresu
  // i bez podstron renderowałaby się jako martwa etykieta, a w poprzedniej
  // wersji jako `<Link href={undefined}>`, co wywalało KAŻDĄ trasę, bo menu
  // siedzi w layoucie. `buildNavTree` już to odsiewa - to jest drugi zamek.
  const navLinks: NavLink[] = (links && links.length ? links : MENU_FALLBACK).filter(
    (l) => l.href || l.dropdown?.length,
  );

  // Chowanie navbara przy scrollu w dół (bez re-subskrypcji na każdy scroll).
  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      setIsVisible(!(y > lastY && y > 50));
      lastY = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Realna wysokość navbara -> zmienna CSS --nav-h. Patrz ostrzeżenie w nagłówku.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Zmiana trasy zamyka wszystko. Bez tego po kliknięciu w podstronę lista
  // zostaje rozwinięta nad nową stroną, a szuflada mobilna przykrywa treść.
  //
  // Korekta W TRAKCIE RENDERU, nie w useEffect. Efekt wykonałby się dopiero po
  // odmalowaniu, więc przez jedną klatkę widać otwarte menu nad nową stroną;
  // React przerywa ten render i liczy go od nowa z poprawionym stanem, zanim
  // cokolwiek trafi na ekran. To jest udokumentowany wzorzec „dostosowanie
  // stanu przy zmianie propsa" - i jedyny, którego nie zgłasza reguła
  // react-hooks/set-state-in-effect.
  const [poprzedniaSciezka, setPoprzedniaSciezka] = useState(pathname);
  if (pathname !== poprzedniaSciezka) {
    setPoprzedniaSciezka(pathname);
    setRozwinieta(null);
    setRozwinietaMobil(null);
    setMenuMobilneOtwarte(false);
  }

  // Klik poza menu zwija rozwiniętą listę. Dotyczy tylko desktopu - szuflada
  // mobilna ma własną przesłonę, która to obsługuje.
  //
  // Dwa nasłuchy, nie jeden. `pointerdown` nie dociera do dokumentu, gdy klik
  // wyląduje w RAMCE - a na /kontakt, /zajecia/dorosli i /zajecia/dzieci
  // pół ekranu zajmuje mapa Google w <iframe>. Zmierzone: klik w mapę przy
  // rozwiniętej liście nie zamykał jej niczym. `blur` okna łapie dokładnie ten
  // przypadek, bo fokus przechodzi wtedy do ramki. Efekt uboczny - zwinięcie
  // listy przy przełączeniu na inne okno - jest tym, czego użytkownik i tak oczekuje.
  useEffect(() => {
    if (!rozwinieta) return;
    const pozaMenu = (e: PointerEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setRozwinieta(null);
    };
    const utrataFokusu = () => setRozwinieta(null);
    document.addEventListener('pointerdown', pozaMenu);
    window.addEventListener('blur', utrataFokusu);
    return () => {
      document.removeEventListener('pointerdown', pozaMenu);
      window.removeEventListener('blur', utrataFokusu);
    };
  }, [rozwinieta]);

  // Escape zamyka i ODDAJE FOKUS na przycisk, który otworzył listę. Bez oddania
  // fokusu użytkownik klawiatury ląduje na początku dokumentu i musi przejść
  // całe menu od nowa.
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (rozwinieta) {
        const przycisk = przyciskiRef.current[rozwinieta];
        setRozwinieta(null);
        przycisk?.focus();
      } else if (menuMobilneOtwarte) {
        setMenuMobilneOtwarte(false);
        hamburgerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', naKlawisz);
    return () => document.removeEventListener('keydown', naKlawisz);
  }, [rozwinieta, menuMobilneOtwarte]);

  /**
   * Czy pozycja obejmuje bieżącą trasę — razem z CAŁĄ swoją gałęzią.
   *
   * Rekurencja po `children`, bo od etapu F menu ma trzy poziomy. Bez niej
   * wejście na stronę trzeciego poziomu nie podświetlało ani jej rodzica, ani
   * sekcji na górze — użytkownik nie widział, gdzie w serwisie stoi.
   * `item.href` jest opcjonalny (nagłówek zagnieżdżony), więc sprawdzamy go
   * przed `startsWith` — na `undefined` poleciałby wyjątek w layoucie, czyli
   * na każdej trasie.
   */
  const wGalezi = (galaz?: NavChild[]): boolean =>
    Boolean(
      galaz?.some(
        (item) =>
          (item.href && (pathname === item.href || pathname.startsWith(item.href + '/'))) ||
          wGalezi(item.children),
      ),
    );

  const isActive = (href?: string, dropdown?: NavChild[]) => {
    if (href && pathname === href) return true;
    if (href && pathname.startsWith(href + '/')) return true;
    return wGalezi(dropdown);
  };

  /** Identyfikator listy podstron - cel `aria-controls`. Stabilny w obrębie renderu. */
  const idListy = (prefiks: string, i: number) => `${idBazowy}-${prefiks}-${i}`;

  const strzalka = (obrocona: boolean) => (
    <svg
      className={`w-4 h-4 transition-transform ${obrocona ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
    </svg>
  );

  /**
   * Pozycje rozwijanej listy — rekurencyjnie, dla drugiego i trzeciego poziomu.
   *
   * Jedna funkcja na oba widoki, bo różnica między nimi to same klasy. Dwa
   * osobne renderery znaczyłyby, że trzeci poziom można dodać na telefonie
   * i zapomnieć o desktopie (albo odwrotnie) — a to jest dokładnie ten rodzaj
   * rozjazdu, którego nie widać, dopóki ktoś nie otworzy drugiego widoku.
   *
   * Podstrona bez adresu (nagłówek zagnieżdżony) renderuje się jako PODPIS,
   * nie link. Wcześniej taki węzeł wypadał z menu razem z całą swoją gałęzią,
   * bo `NavChild` wymagało `href`.
   */
  const pozycjeGalezi = (galaz: NavChild[], poziom: number, wariant: 'desktop' | 'mobil') => {
    const zamknijSzuflade = wariant === 'mobil' ? () => setMenuMobilneOtwarte(false) : undefined;

    const klasaLinku = (aktywny: boolean) => {
      const kolor = aktywny ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500';
      // Trzeci poziom mniejszym pismem — właściciel: „to tylko mniejsza kreska
      // i czcionka w menu". Wcięcie robi obramowanie listy nadrzędnej.
      // `text-xs`, a NIE `text-[13px]`. Pierwsza wersja miała tu 13 px na sztywno
      // i była WIĘKSZA od drugiego poziomu, nie mniejsza: `globals.css` zwęża
      // korzeń do `clamp(12.8px, 10.24px + 0.2vw, 15.2px)`, więc `text-sm`
      // (0.875rem) wychodzi ~11,6 px. Rozmiar w px nie skaluje się razem
      // z resztą serwisu — trzeci poziom musi być krokiem w tej samej skali.
      const rozmiar = poziom === 0 ? 'text-sm' : 'text-xs';
      return wariant === 'desktop'
        ? `block transition-colors hover:bg-neutral-900 ${poziom === 0 ? 'px-4 py-3' : 'px-4 py-2'} ${rozmiar} ${kolor}`
        : `block transition-colors ${rozmiar} ${kolor}`;
    };

    return galaz.map((sub) => (
      <li key={`${wariant}-${poziom}-${sub.label}`}>
        {sub.href ? (
          <Link href={sub.href} onClick={zamknijSzuflade} className={klasaLinku(isActive(sub.href, sub.children))}>
            {sub.label}
          </Link>
        ) : (
          <span
            className={`block text-[11px] uppercase tracking-[0.12em] text-neutral-500 ${
              wariant === 'desktop' ? 'px-4 pt-3 pb-1' : 'pb-1'
            }`}
          >
            {sub.label}
          </span>
        )}

        {Boolean(sub.children?.length) && (
          <ul
            className={`flex flex-col list-none border-l border-neutral-800 ${
              // `py-0 pr-0 pl-4`, a nie `p-0 pl-4`: dwie klasy o tej samej
              // specyficzności rozstrzyga kolejność w wygenerowanym CSS, więc
              // „zeruj, potem wcinaj" działa tylko dopóki Tailwind emituje
              // `pl-*` po `p-*`. Wcięcie listy to nie jest rzecz, która ma
              // zależeć od kolejności reguł w cudzym generatorze.
              wariant === 'desktop' ? 'ml-4 my-1 p-0' : 'ml-1 py-0 pr-0 pl-4 mt-3 space-y-3'
            }`}
          >
            {pozycjeGalezi(sub.children ?? [], poziom + 1, wariant)}
          </ul>
        )}
      </li>
    ));
  };

  /**
   * Kolor i wysokość pozycji menu — bez podkreślenia.
   *
   * Podkreślenie aktywnej sekcji siedzi na wspólnym opakowaniu (`klasaGrupy`),
   * a nie na tym elemencie. Pozycja z podstronami to link PLUS osobny przycisk
   * strzałki (patrz komentarz na górze pliku), więc dopóki `border-b-2` było na
   * obu, aktywna sekcja dostawała DWA rozłączne żółte odcinki z dziurą po
   * `gap-1` między nimi. Dokładnie to zgłoszono jako „podkreśla tę strzałkę
   * rozwijania, co źle i dziwnie wygląda".
   */
  const klasaPozycji = (aktywna: boolean) =>
    `flex items-center transition-colors py-4 ${
      aktywna ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'
    }`;

  /** Podkreślenie aktywnej sekcji — jedno, pod całą pozycją razem ze strzałką. */
  const klasaGrupy = (aktywna: boolean) =>
    `flex items-center gap-1 border-b-2 ${aktywna ? 'border-yellow-500' : 'border-transparent'}`;

  return (
    <>
      <nav
        ref={navRef}
        aria-label="Menu główne"
        className={`fixed w-full top-0 z-50 transition-transform duration-500 bg-black border-b border-neutral-800 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="w-full px-4 md:px-0 md:w-[90%] md:max-w-[87.5rem] mx-auto">

          {/* Wiersz 1: Logo + Social */}
          <div className="flex justify-between items-center py-4 border-b border-neutral-900">
            <button
              ref={hamburgerRef}
              type="button"
              onClick={() => setMenuMobilneOtwarte((prev) => !prev)}
              aria-expanded={menuMobilneOtwarte}
              aria-controls={`${idBazowy}-szuflada`}
              aria-label={menuMobilneOtwarte ? 'Zamknij menu' : 'Otwórz menu'}
              className="md:hidden p-2 text-neutral-300 hover:text-yellow-500 transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between" aria-hidden="true">
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
              </div>
            </button>

            <Link href="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
              <Image
                src="/SOEN.jpg"
                alt="Shorinji Kempo Logo"
                width={1022}
                height={202}
                className="h-12 sm:h-16 md:h-24 xl:h-32 w-auto max-w-[calc(100vw-7.5rem)] object-contain object-left"
                priority
              />
            </Link>

            {/* Ikony social wyleciały z navbara (zostały w stopce) - tu tylko szybki kontakt. */}
            <div className="flex items-center">
              <Link href="/kontakt" aria-label="Kontakt" className="text-neutral-400 hover:text-yellow-500 transition-colors p-1">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Wiersz 2: linki. Nawigacja desktopowa zostaje widoczna - NN/g: schowanie
              jej pod hamburgerem pogarsza mierzalne wskaźniki wykonania zadania. */}
          <ul className="hidden md:flex flex-wrap justify-between items-center text-[11px] lg:text-sm xl:text-base uppercase tracking-[0.08em] list-none m-0 p-0">
            {navLinks.map((link, i) => {
              const maPodstrony = Boolean(link.dropdown?.length);
              const otwarta = rozwinieta === link.label;
              const id = idListy('desktop', i);

              return (
                <li key={link.label} className="relative">
                  <div className={klasaGrupy(isActive(link.href, link.dropdown))}>
                    {link.href ? (
                      <Link href={link.href} className={klasaPozycji(isActive(link.href, link.dropdown))}>
                        {link.label}
                      </Link>
                    ) : (
                      // Pozycja-nagłówek (np. „ZAJĘCIA") nie ma własnej strony.
                      // Wtedy przycisk NIESIE etykietę - nie ma obok czego stać.
                      !maPodstrony && <span className={klasaPozycji(false)}>{link.label}</span>
                    )}

                    {maPodstrony && (
                      <button
                        ref={(el) => {
                          przyciskiRef.current[link.label] = el;
                        }}
                        type="button"
                        onClick={() => setRozwinieta(otwarta ? null : link.label)}
                        aria-expanded={otwarta}
                        aria-controls={id}
                        aria-label={
                          link.href
                            ? `${otwarta ? 'Zwiń' : 'Rozwiń'} podstrony: ${link.label}`
                            : undefined
                        }
                        className={`${klasaPozycji(isActive(link.href, link.dropdown))} ${
                          link.href ? 'px-1' : 'gap-1'
                        }`}
                      >
                        {!link.href && <span>{link.label}</span>}
                        {strzalka(otwarta)}
                      </button>
                    )}
                  </div>

                  {maPodstrony && (
                    // `hidden` jako ATRYBUT, nie klasa: element zostaje w DOM,
                    // więc `aria-controls` wskazuje na coś istniejącego także
                    // wtedy, gdy lista jest zwinięta.
                    <div id={id} hidden={!otwarta} className="absolute top-full left-0 pt-2 z-50">
                      <ul className="flex flex-col bg-black border border-neutral-800 shadow-xl py-2 min-w-[220px] list-none m-0 p-0">
                        {pozycjeGalezi(link.dropdown ?? [], 0, 'desktop')}
                      </ul>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

        </div>
      </nav>

      {/* Przesłona pod szufladą mobilną. aria-hidden, bo Escape i przycisk
          „Zamknij" załatwiają to samo dla klawiatury i czytnika ekranu. */}
      <div
        aria-hidden="true"
        className={`md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          menuMobilneOtwarte ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setMenuMobilneOtwarte(false)}
      />

      <aside
        id={`${idBazowy}-szuflada`}
        className={`md:hidden fixed top-0 left-0 z-50 h-screen w-72 bg-black border-r border-neutral-800 transition-transform duration-300 ${
          menuMobilneOtwarte ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <div className="relative h-20 border-b border-neutral-800 flex items-center px-6">
          <button
            type="button"
            onClick={() => {
              setMenuMobilneOtwarte(false);
              hamburgerRef.current?.focus();
            }}
            aria-label="Zamknij menu"
            className="absolute left-5 text-neutral-300 hover:text-yellow-500 transition-colors text-5xl leading-none"
          >
            <span aria-hidden="true">×</span>
          </button>
        </div>

        {/* Druga nawigacja, z własną etykietą - inaczej czytnik ekranu ogłasza
            dwa punkty orientacyjne „nawigacja" i nie da się ich rozróżnić.
            W danym momencie widoczna jest tylko jedna (md:hidden / hidden md:flex). */}
        <nav aria-label="Menu główne (telefon)" className="pt-8 px-6 pb-8">
          <ul className="flex flex-col space-y-6 text-sm uppercase tracking-[0.08em] list-none m-0 p-0">
            {navLinks.map((link, i) => {
              const maPodstrony = Boolean(link.dropdown?.length);
              const otwarta = rozwinietaMobil === link.label;
              const id = idListy('mobil', i);

              return (
                <li key={`mobile-${link.label}`}>
                  <div className="flex items-center justify-between gap-2">
                    {link.href ? (
                      <Link
                        href={link.href}
                        onClick={() => setMenuMobilneOtwarte(false)}
                        className={`font-bold transition-colors ${
                          isActive(link.href, link.dropdown)
                            ? 'text-yellow-500'
                            : 'text-neutral-300 hover:text-yellow-500'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      !maPodstrony && <span className="font-bold text-neutral-500">{link.label}</span>
                    )}

                    {maPodstrony && (
                      <button
                        type="button"
                        onClick={() => setRozwinietaMobil(otwarta ? null : link.label)}
                        aria-expanded={otwarta}
                        aria-controls={id}
                        aria-label={
                          link.href ? `${otwarta ? 'Zwiń' : 'Rozwiń'} podstrony: ${link.label}` : undefined
                        }
                        // Nagłówek sekcji („ZAJĘCIA") dostaje TEN SAM kolor co pozycja
                        // ze stroną. Wcześniej stało tu `text-neutral-500`, o dwa
                        // stopnie ciemniej niż `text-neutral-300` sąsiadów, i wyglądało
                        // na wyłączone — zgłoszone jako „zajęcia z jakiegoś powodu są
                        // wyszarzone na menu telefonowym". Podświetlenie liczy się z całej
                        // gałęzi, bo nagłówek nie ma własnego adresu.
                        className={`flex items-center gap-2 font-bold transition-colors ${
                          isActive(link.href, link.dropdown)
                            ? 'text-yellow-500'
                            : 'text-neutral-300 hover:text-yellow-500'
                        } ${link.href ? 'p-1' : 'flex-1'}`}
                      >
                        {!link.href && <span>{link.label}</span>}
                        {strzalka(otwarta)}
                      </button>
                    )}
                  </div>

                  {maPodstrony && (
                    // Poprzednia wersja trzymała podstrony ZAWSZE rozwinięte -
                    // przy dzisiejszym drzewie to 14 pozycji na jednym ekranie
                    // telefonu. Teraz to akordeon, na tym samym wzorcu co desktop.
                    <ul
                      id={id}
                      hidden={!otwarta}
                      className="flex flex-col pl-4 mt-4 space-y-4 border-l border-neutral-800 list-none"
                    >
                      {pozycjeGalezi(link.dropdown ?? [], 0, 'mobil')}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>
    </>
  );
}
