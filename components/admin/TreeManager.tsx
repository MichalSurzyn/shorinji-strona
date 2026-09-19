"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Komunikat, { useKomunikat } from "./Komunikat";
import Podpowiedz from "./Podpowiedz";
import { usePotwierdzenie } from "./DialogPotwierdzenia";
import { slugZNazwy } from "@/lib/pages";
import { powodNiewidocznosci } from "@/lib/widocznosc";
import {
  dodajWezel,
  doKosza,
  policzPotomkow,
  pobierzDrzewo,
  pobierzKosz,
  przesun,
  przywroc,
  skutkiZamiany,
  usunTrwale,
  zamienRodzaj,
  zapiszWezel,
  type Kierunek,
  type RodzajWezla,
  type WezelPanelu,
} from "@/actions/pagesActions";

/**
 * Drzewo stron i menu — jeden ekran zamiast dwóch.
 *
 * Do tej pory pozycja w menu (`nav_items`) i strona (`custom_pages`) były
 * osobnymi bytami w osobnych zakładkach, więc dało się mieć jedno bez drugiego:
 * pozycję menu prowadzącą donikąd albo stronę, do której nie ma jak dojść.
 * Tutaj to jeden wiersz, a kolumna „rodzaj" mówi wprost, czym pozycja jest.
 *
 * Świadomie BEZ przeciągania myszą w pierwszej wersji. Przyciski ↑ ↓ → ←
 * robią to samo, działają z klawiatury i na telefonie, i — co ważniejsze —
 * każdy z nich to jedno punktowe `UPDATE`, które łatwo cofnąć. Przeciąganie
 * kusi do zapisu całego drzewa naraz, a to jest dokładnie ten wzorzec, przez
 * który stary edytor menu trzymał przez chwilę dwa komplety wierszy.
 */

const OPIS_RODZAJU: Record<RodzajWezla, string> = {
  page: "strona",
  link: "odnośnik",
  header: "nagłówek",
};

/**
 * Rodzaj jako kolorowa plakietka, nie szary napis 10 px.
 *
 * Rodzaj jest STAŁY, a stany („ukryta", „poza menu") się zmieniają — dlatego
 * siedzi we własnej kolumnie, z dala od stanów. Ale własna kolumna nie znaczy
 * „ledwo widoczna": poprzednia wersja miała `text-slate-400` na białym i przy
 * skanowaniu wzrokiem po prostu nie istniała.
 */
const PLAKIETKA_RODZAJU: Record<RodzajWezla, string> = {
  page: "border-slate-300 bg-slate-100 text-slate-600",
  header: "border-amber-300 bg-amber-50 text-amber-800",
  link: "border-sky-300 bg-sky-50 text-sky-800",
};

/**
 * Krok wizualny na poziom zagnieżdżenia.
 *
 * Zgłoszenie właściciela: „możesz nawet bardziej to rozdzielić i większe
 * wcięcia i większy kontrast, nie musi to być tak do porzygu białe (…) masz
 * dużo miejsca, a bardzo ciasno to robisz".
 *
 * Poprzednia wersja niosła hierarchię samym zagnieżdżeniem kart: podstrona
 * zaczynała się osiem pikseli na prawo od rodzica, na tle jaśniejszym o jeden
 * ton. Teraz każdy poziom zmienia trzy rzeczy naraz — wcięcie, tło strefy
 * i wagę pisma — a strefa z podstronami ma pionową prowadnicę, tę samą, którą
 * trzeci poziom dostał w menu publicznym.
 */
/**
 * Rozmiary nazw sa w `rem`, nie w pikselach — i to jest tu cala roznica.
 *
 * Panel ma wlasna skale korzenia (`html:has([data-panel-admina])`
 * w `app/globals.css`, ~20,6 px przy oknie 1920). Napisy na przyciskach sa
 * w `text-sm`, czyli w `rem`, wiec urosly razem z nia — a nazwy poziomow
 * mialy `text-[16px]/[14px]/[13px]` i zostaly tam, gdzie byly. Zmierzone
 * playwrightem: „Ukryj" 18,1 px obok NAZWY STRONY 16 px, czyli to, co sie na
 * tym ekranie czyta, bylo mniejsze od podpisow pod spodem. Zgloszenie
 * wlasciciela „za male literki" dotyczylo dokladnie nazw.
 *
 * Hierarchia liczona przy 1rem = 20,6 px: nazwa poziomu 0 wieksza od napisow
 * na przyciskach (0,875rem), adres i plakietki wyraznie mniejsze. Waga pisma
 * rozroznia poziomy tak jak wczesniej — bold / semibold / medium.
 */
const STYL_POZIOMU = [
  {
    karta: "overflow-hidden rounded-xl border border-slate-400 bg-white shadow-sm",
    naglowekKarty: "border-l-4 border-l-indigo-500 px-5 py-4",
    strefa: "bg-slate-400/75 border-slate-500",
    prowadnica: "border-indigo-600",
    wciecie: "pl-6",
    nazwa: "text-[1.05rem] font-bold tracking-tight text-slate-900",
    stopka: "bg-transparent border-slate-200",
  },
  {
    karta: "overflow-hidden rounded-lg border border-slate-400 bg-white",
    naglowekKarty: "border-l-4 border-l-slate-400 px-4 py-3.5",
    strefa: "bg-slate-500/65 border-slate-600",
    prowadnica: "border-slate-700",
    wciecie: "pl-5",
    nazwa: "text-[0.95rem] font-semibold text-slate-800",
    stopka: "bg-transparent border-slate-200",
  },
  {
    karta: "overflow-hidden rounded-lg border border-slate-400 bg-slate-50",
    naglowekKarty: "border-l-4 border-l-slate-300 px-4 py-3",
    strefa: "bg-slate-600/55 border-slate-700",
    prowadnica: "border-slate-700",
    wciecie: "pl-4",
    nazwa: "text-[0.85rem] font-medium text-slate-700",
    stopka: "bg-transparent border-slate-200",
  },
] as const;

const styl = (poziom: number) => STYL_POZIOMU[Math.min(poziom, STYL_POZIOMU.length - 1)];

/** Zwinięte pozycje drzewa, pamiętane per przeglądarka. */
const KLUCZ_ZWINIETE = "kempo-drzewo-zwiniete";

/**
 * Odmiana po liczbie na plakietce zwiniętej sekcji.
 *
 * Wyjątek nastolatków stoi osobno, bo `12 % 10` to 2 — bez tego warunku
 * wyszłoby „12 podstrony".
 */
function liczbaPodstron(ile: number): string {
  if (ile === 1) return "1 podstrona";
  const koncowka = ile % 10;
  const reszta = ile % 100;
  if (koncowka >= 2 && koncowka <= 4 && !(reszta >= 12 && reszta <= 14)) return `${ile} podstrony`;
  return `${ile} podstron`;
}

export default function TreeManager({
  drzewo,
  kosz,
}: {
  drzewo: WezelPanelu[];
  kosz: WezelPanelu[];
}) {
  const [wezly, setWezly] = useState(drzewo);
  const [wKoszu, setWKoszu] = useState(kosz);
  const [busy, setBusy] = useState(false);
  // Komunikat i jego gaszenie mieszkają w `useKomunikat` — ten sam mechanizm
  // obsługuje każdy ekran panelu z zapisem.
  const { msg, pokaz: pokazKomunikat, wyczysc: wyczyscKomunikat } = useKomunikat();

  /**
   * Pytania o potwierdzenie idą przez własne okno, nie przez `confirm`.
   *
   * Powód jest jeden i konkretny: zamiana rodzaju pozycji wypisuje kilkanaście
   * linii skutków („ZMIENIĄ SIĘ ADRESY", „BEZ ZMIAN"), a systemowe okienko
   * pokazuje to czcionką ~12 px bez akapitów — redaktor czytał z niego
   * pierwsze zdanie i klikał. `element` renderujemy na końcu ekranu.
   */
  const { potwierdz, element: oknoPotwierdzenia } = usePotwierdzenie();

  const [rodzicNowego, setRodzicNowego] = useState<string | null>(null);
  const [rodzaj, setRodzaj] = useState<RodzajWezla>("page");
  const [nazwa, setNazwa] = useState("");
  const [slug, setSlug] = useState("");
  const [adresZewnetrzny, setAdresZewnetrzny] = useState("");
  const [slugRuszony, setSlugRuszony] = useState(false);
  const formularzRef = useRef<HTMLFormElement>(null);
  const polaNazwyRef = useRef<HTMLInputElement>(null);

  /**
   * Karta, pod którą stoi rozwinięty formularz dodawania — albo `null`.
   *
   * Zgłoszenie właściciela: „fajnie by było gdyby dodanie podstrony nie
   * scrollowało na dół, a tworzyło jakby szablonik nowej podstrony od razu pod
   * kliknięciem". Trzymamy ID rodzica, a nie flagę, bo rozwinięty może być
   * dokładnie jeden formularz: dwa naraz pokazywałyby te same pola (nazwa,
   * adres i rodzaj to jeden komplet stanu), więc pisanie w jednym przepisywało
   * by się w drugim.
   *
   * `null` nie znaczy „najwyższy poziom" — najwyższy poziom nie ma karty,
   * pod którą dałoby się cokolwiek rozwinąć, i dlatego został przy dolnym
   * formularzu.
   */
  const [dodawanieW, setDodawanieW] = useState<string | null>(null);
  const polaNazwyWMiejscuRef = useRef<HTMLInputElement>(null);

  /**
   * Zbiór pozycji ZWINIĘTYCH — trzymamy zamknięte, nie otwarte.
   *
   * Odwrotnie byłoby wygodniej pisać, ale gorzej działa: pusty zbiór znaczy
   * „wszystko rozwinięte", więc świeżo dodana podstrona jest widoczna od razu,
   * a testy odbioru celują w przyciski wierszy zagnieżdżonych
   * (`[data-wezel="…"] button[aria-label="…"]`) — przy drzewie domyślnie zwiniętym
   * żaden z nich nie istniałby w DOM i cztery testy padłyby na „nie ma
   * przycisku", choć produkt byłby sprawny.
   *
   * `odswiez()` po zapisie podmienia tylko dane węzłów, więc zwinięcie
   * przeżywa zapis samo z siebie. Odświeżenie strony przeżywa dzięki
   * `localStorage` — patrz dwa efekty niżej.
   */
  const [zwiniete, setZwiniete] = useState<Set<string>>(new Set());

  /**
   * Zapis do `localStorage` wolno włączyć DOPIERO po wczytaniu.
   *
   * Efekty na pierwszym montażu idą w kolejności deklaracji, ale ten drugi
   * widzi jeszcze STARĄ wartość stanu — bez tej blokady zapisywałby pusty
   * zbiór na to, co redaktor miał zapamiętane, i dopiero kolejny render
   * przywracałby wpis. Okno zamknięte w tej szczelinie gubiło zwinięcia.
   */
  const zwinieciaWczytane = useRef(false);

  /**
   * Wczytanie po montażu, a nie w `useState`: na serwerze nie ma
   * `localStorage`, a stan startowy zależny od przeglądarki znaczy, że HTML
   * z serwera różni się od pierwszego rendera — czyli błąd hydracji.
   */
  useEffect(() => {
    try {
      const zapisane: unknown = JSON.parse(localStorage.getItem(KLUCZ_ZWINIETE) ?? "[]");
      if (Array.isArray(zapisane)) {
        // Przecięcie z istniejącymi węzłami: bez niego lista puchnie o id
        // stron dawno skasowanych i nigdy się nie czyści.
        const istniejace = new Set(drzewo.map((w) => w.id));
        setZwiniete(
          new Set(zapisane.filter((id): id is string => typeof id === "string" && istniejace.has(id)))
        );
      }
    } catch {
      // Prywatne okno albo zablokowane dane witryny — zwinięć po prostu nie
      // pamiętamy. Zakładka musi działać dalej, to tylko wygoda.
    }
    zwinieciaWczytane.current = true;
  }, [drzewo]);

  useEffect(() => {
    if (!zwinieciaWczytane.current) return;
    try {
      localStorage.setItem(KLUCZ_ZWINIETE, JSON.stringify([...zwiniete]));
    } catch {
      /* jak wyżej — brak pamięci nie może zablokować klikania */
    }
  }, [zwiniete]);

  /**
   * Kursor w polu nazwy zaraz po rozwinięciu formularza w miejscu.
   *
   * `preventScroll`, bo bez tego przeglądarka dosuwa świeżo zafokusowane pole
   * do krawędzi okna — czyli robi dokładnie ten skok ekranu, przez który cała
   * ta zmiana powstała.
   */
  useEffect(() => {
    if (dodawanieW === null) return;
    polaNazwyWMiejscuRef.current?.focus({ preventScroll: true });
  }, [dodawanieW]);

  /**
   * Pozycje, które MAJĄ co zwijać — tylko one liczą się do „wszystkich".
   *
   * Gdyby zbiór obejmował wszystkie węzły, przycisk po kliknięciu „Zwiń
   * wszystkie" nigdy nie pokazałby stanu „wszystko zwinięte": strony bez
   * podstron nie mają czego schować, a ich id nigdy nie wpada do `zwiniete`.
   */
  const zwijalne = wezly.filter((w) => wezly.some((d) => d.parent_id === w.id)).map((w) => w.id);
  const wszystkoZwiniete = zwijalne.length > 0 && zwijalne.every((id) => zwiniete.has(id));

  const przelaczZwiniecie = (id: string) =>
    setZwiniete((poprzednie) => {
      const nowe = new Set(poprzednie);
      if (nowe.has(id)) nowe.delete(id);
      else nowe.add(id);
      return nowe;
    });

  async function odswiez() {
    const [d, k] = await Promise.all([pobierzDrzewo(), pobierzKosz()]);
    setWezly(d);
    setWKoszu(k);
  }

  /**
   * Zwraca `true` przy powodzeniu — korzysta z tego tylko dodawanie
   * (zamyka formularz w miejscu i rozwija rodzica dopiero wtedy, gdy pozycja
   * naprawdę powstała). Reszta wywołań wyniku nie czyta i nie musi.
   */
  async function wykonaj(
    akcja: () => Promise<{ ok: boolean; error?: string }>,
    sukces: string,
  ): Promise<boolean> {
    setBusy(true);
    wyczyscKomunikat();
    try {
      const res = await akcja();
      if (res.ok) {
        await odswiez();
        // Komunikat PO odświeżeniu, nie przed. Wcześniej „Przesunięte niżej."
        // pojawiało się, gdy ekran pokazywał jeszcze stan sprzed ruchu — przez
        // moment widać było napis o zmianie nad niezmienioną listą.
        pokazKomunikat(true, sukces);
        return true;
      }
      pokazKomunikat(false, res.error ?? "Nie udało się.");
      return false;
    } catch (e) {
      pokazKomunikat(false, e instanceof Error ? e.message : "Nie udało się.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  /**
   * Dzieci danego węzła w kolejności — drzewo składamy w pamięci, jednym przebiegiem.
   *
   * Rozstrzygnięcie po `id` przy równych pozycjach musi być TAKIE SAMO jak
   * w `pobierzDrzewo` i `przenumeruj`. Gdy ekran sortuje inaczej niż akcja,
   * „przesuń niżej" liczy się względem innego sąsiada, niż widzi redaktor.
   */
  const dzieci = (id: string | null) =>
    wezly
      .filter((w) => w.parent_id === id)
      // Porównanie znak po znaku, nie `localeCompare`: to drugie zależy od
      // locale, a ICU pomija myślnik na pierwszym poziomie porównania — czyli
      // mogłoby uszeregować identyfikatory inaczej niż `order("id")`
      // w Postgresie i znów rozjechać ekran z akcją.
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  /**
   * Dlaczego pozycja jest niewidoczna MIMO własnych ustawień (punkt A6).
   *
   * Liczone TĄ SAMĄ funkcją, co widoczność publiczna (`lib/widocznosc.ts`) —
   * inaczej panel i serwis miałyby dwie definicje tego samego słowa i któraś
   * z nich po cichu by się zestarzała. Komplet danych (`parent_id`,
   * `published`, `in_menu`) jest już w pamięci ekranu, więc nie kosztuje to
   * ani jednego zapytania.
   */
  const powod = (id: string) => powodNiewidocznosci(id, wezly);

  /**
   * Wybrany rodzic WYLICZANY, nie przechowywany — i to jest cała poprawka.
   *
   * Wcześniej `rodzicNowego` trzymało id nawet wtedy, gdy wybrana strona
   * wylądowała w koszu albo została usunięta na zawsze. `<select>` z wartością
   * nieobecną wśród `<option>` pokazuje PIERWSZĄ opcję, czyli „— najwyższy
   * poziom —", a stan dalej trzymał martwe id. Redaktor widział jedno,
   * akcja dostawała drugie i odpowiadała „Miejsce, w którym chcesz dodać
   * stronę, już nie istnieje." — zamiast walidacji, którą właśnie sprawdzał.
   * Wyliczenie sprawia, że ekran i wysyłka nie mogą się już rozjechać.
   */
  const rodzicEfektywny =
    rodzicNowego !== null && wezly.some((w) => w.id === rodzicNowego) ? rodzicNowego : null;
  const rodzicWybrany = wezly.find((w) => w.id === rodzicEfektywny) ?? null;
  const glebokoscNowego = rodzicWybrany ? rodzicWybrany.depth + 1 : 0;

  /**
   * Lista miejsc w drzewie — w kolejności DRZEWA, nie w kolejności z bazy.
   *
   * Wcześniej mapowała płaską tablicę `wezly` w kolejności zapytania, a to jest
   * `order position` GLOBALNIE; `position` ma sens wyłącznie wewnątrz jednego
   * rodzica, więc rodziny się mieszały — „Uczniowskie" wypadało przy
   * „Aktualnościach", „Medytacja" przy „Zajęciach". Wcięcie rysowane przez
   * powtórzenie myślnika sugerowało rodzica, a sąsiedztwo na liście przeczyło.
   */
  const listaMiejsc: { id: string; etykieta: string; glebokosc: number }[] = [];
  const zbierzMiejsca = (rodzic: string | null, poziom: number) => {
    for (const w of dzieci(rodzic)) {
      // Odnośnik zewnętrzny nie może mieć podstron, a poziom trzeci jest ostatni.
      if (w.kind !== "link" && w.depth < 2) {
        listaMiejsc.push({ id: w.id, etykieta: w.menu_label ?? w.title, glebokosc: poziom });
      }
      zbierzMiejsca(w.id, poziom + 1);
    }
  };
  zbierzMiejsca(null, 0);

  /**
   * Adres, jaki dostanie nowa strona — pokazywany NA ŻYWO pod polem.
   * Redaktor musi widzieć skutek, zanim kliknie „Dodaj": po zapisie zmiana
   * adresu to już zmiana czegoś, co widziała wyszukiwarka.
   */
  function podgladAdresu(): string {
    if (rodzaj === "link") return adresZewnetrzny || "(wklej adres zewnętrzny)";
    // Nagłówek BEZ adresu jest dla ścieżki przezroczysty — jego podstrony liczą
    // adres od pozycji stojącej wyżej. Nagłówek Z adresem działa jak folder.
    // Przed wariantem A pierwsze było jedyną możliwością i ta funkcja mówiła
    // wprost „nagłówek nie ma adresu"; dziś to zależy od tego, czy redaktor
    // adres wpisze.
    if (rodzaj === "header" && !slug) return "(bez adresu – nagłówek tylko grupuje)";
    const baza =
      rodzicWybrany?.full_path && rodzicWybrany.full_path !== "/" ? rodzicWybrany.full_path : "";
    return `${baza}/${slug || "…"}`;
  }

  /**
   * „+ Nowa sekcja w menu głównym": ustawia rodzica i przenosi redaktora do
   * dolnego formularza.
   *
   * Najwyższy poziom nie ma karty, pod którą dałoby się rozwinąć formularz
   * w miejscu, więc ta droga została taka, jaka była — razem z przewinięciem.
   *
   * `preventScroll` przy fokusie, a przewinięcie osobno: bez tego przeglądarka
   * przewija tak, żeby pole było ledwo widoczne przy krawędzi, i redaktor nie
   * widzi ani podglądu adresu, ani przycisku „Dodaj".
   */
  function zacznijDodawanie(parentId: string | null) {
    // Formularz w miejscu i dolny żyją z tego samego kompletu pól, więc dwa
    // otwarte naraz pokazywałyby tę samą treść w dwóch miejscach ekranu.
    setDodawanieW(null);
    setRodzicNowego(parentId);
    setRodzaj("page");
    setSlugRuszony(false);
    formularzRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    polaNazwyRef.current?.focus({ preventScroll: true });
  }

  /**
   * „+ Podstrona": rozwija formularz POD TĄ KARTĄ, z gotowym rodzicem.
   *
   * Do 2026-09-12 ten przycisk ustawiał rodzica i przewijał na dół zakładki —
   * zgłoszenie właściciela: „fajnie by było gdyby dodanie podstrony nie
   * scrollowało na dół, a tworzyło jakby szablonik nowej podstrony od razu pod
   * kliknięciem, było by to bardziej intuicyjne". Ekran zostaje więc tam, gdzie
   * był, a redaktor cały czas widzi gałąź, do której dopisuje.
   *
   * Powtórne kliknięcie zamyka — ten sam przycisk otwiera i chowa, bo pod
   * rozwiniętym formularzem nie ma innego miejsca na „nie, jednak nie".
   */
  function przelaczDodawanieWMiejscu(parentId: string) {
    if (dodawanieW === parentId) {
      setDodawanieW(null);
      return;
    }
    setDodawanieW(parentId);
    setRodzicNowego(parentId);
    setRodzaj("page");
    // Czyste pola, bo to ma być „szablonik nowej podstrony", a nie resztki po
    // poprzednim dodawaniu albo tekst przepisany z dolnego formularza.
    setNazwa("");
    setSlug("");
    setAdresZewnetrzny("");
    setSlugRuszony(false);
  }

  async function handleDodaj(e: React.FormEvent) {
    e.preventDefault();
    // Rodzic czytany PRZED `await`: po dodaniu stan może już wskazywać co
    // innego (redaktor klika dalej), a rozwinąć trzeba tę gałąź, do której
    // pozycja faktycznie poszła.
    const rodzicDodawania = rodzicEfektywny;
    const udane = await wykonaj(
      () =>
        dodajWezel({
          parentId: rodzicEfektywny,
          kind: rodzaj,
          title: nazwa,
          slug,
          externalUrl: adresZewnetrzny,
          // Nowa pozycja wchodzi OPUBLIKOWANA i w menu — decyzja właściciela
          // z 2026-09-07. Poprzednio startowała ukryta i poza menu; przy
          // przechodzeniu checklisty okazało się, że to myli bardziej, niż
          // chroni: strony nieopublikowanej nie widać, więc nie da się
          // sprawdzić, czy w ogóle działa, a nowej podstrony nie było na
          // liście miejsc, dopóki się jej nie odblokowało.
          //
          // Trzeci poziom nie jest już wyjątkiem — menu renderuje trzy poziomy.
          inMenu: true,
          published: true,
          menuLabel: undefined,
        }).then((r) => (r.ok ? { ok: true } : r)),
      rodzaj !== "page" ? "Dodane." : "Dodane – opublikowane i widoczne w menu.",
    );
    setNazwa("");
    setSlug("");
    setAdresZewnetrzny("");
    setSlugRuszony(false);

    if (!udane) return;
    setDodawanieW(null);
    // Rodzic zwinięty schowałby świeżo dodaną podstronę w strefie, której nie
    // widać — redaktor dostałby komunikat „Dodane" i pustą kartę. Rozwijamy go
    // więc za niego; to jedyne miejsce, w którym zwinięcie zmienia się samo.
    if (rodzicDodawania) {
      setZwiniete((poprzednie) => {
        if (!poprzednie.has(rodzicDodawania)) return poprzednie;
        const nowe = new Set(poprzednie);
        nowe.delete(rodzicDodawania);
        return nowe;
      });
    }
  }

  /**
   * Formularz dodawania — JEDNA definicja na dwa miejsca na ekranie.
   *
   * Rozwijany pod kartą („+ Podstrona") i stały na dole zakładki to ten sam
   * kod: te same pola, ta sama podpowiedź adresu z nazwy, to samo
   * `handleDodaj`. Skopiowanie go byłoby tu najgorszym możliwym wyjściem —
   * dwie kopie walidacji adresu rozjeżdżają się po pierwszej poprawce w jednej
   * z nich, a widać to dopiero po zapisie, jako strona pod złym adresem.
   *
   * Zwykła funkcja zwracająca JSX, a nie komponent — z tego samego powodu, co
   * `wierszDrzewa` niżej: komponent zdefiniowany w ciele `TreeManager` ma
   * nową tożsamość przy każdym renderze, więc React przemontowywałby pola
   * formularza, a razem z nimi gubił kursor w trakcie pisania.
   *
   * Różnic jest dokładnie tyle, ile widać w pierwszych liniach: oprawa karty
   * i kotwica do przewijania na dole, przezroczyste tło i własny nagłówek
   * w miejscu.
   */
  function formularzDodawania(wMiejscu: boolean) {
    return (
      <form
        // Kotwica do przewijania jest potrzebna wyłącznie dolnemu formularzowi.
        // Ten w miejscu nikogo nigdzie nie przewija — o to w nim chodzi.
        ref={wMiejscu ? undefined : formularzRef}
        onSubmit={handleDodaj}
        className={
          wMiejscu ? "space-y-3" : "bg-white rounded-2xl border border-slate-200 p-5 space-y-3"
        }
      >
        <h2 className="font-bold">{wMiejscu ? "Nowa podstrona tutaj" : "Dodaj pozycję"}</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Rodzaj</span>
            <select
              value={rodzaj}
              onChange={(e) => setRodzaj(e.target.value as RodzajWezla)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="page">Strona – ma własny adres i treść</option>
              <option value="header">Nagłówek – grupuje w menu, sam nie ma treści</option>
              <option value="link">Odnośnik – prowadzi poza serwis</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Miejsce w drzewie</span>
            <select
              value={rodzicEfektywny ?? ""}
              onChange={(e) => {
                const nowy = e.target.value || null;
                setRodzicNowego(nowy);
                // Formularz w miejscu stoi pod kartą rodzica, więc razem ze
                // zmianą wyboru przenosi się pod właściwą kartę — inaczej
                // zostałby pod starą i mówiłby co innego, niż robi.
                // „Najwyższy poziom" nie ma karty, pod którą dałoby się go
                // rozwinąć, więc wtedy się zwija i wpisane pola widać
                // w dolnym formularzu.
                if (wMiejscu) setDodawanieW(nowy);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">– najwyższy poziom –</option>
              {listaMiejsc.map((m) => (
                <option key={m.id} value={m.id}>
                  {/* Twarde spacje, bo zwykłe przeglądarka w <option> skleja. */}
                  {"   ".repeat(m.glebokosc)}
                  {m.glebokosc > 0 ? "└ " : ""}
                  {m.etykieta}
                </option>
              ))}
            </select>
            {glebokoscNowego === 2 && (
              <span className="block mt-1 text-xs text-slate-500">
                Trzeci poziom – najgłębszy. Wejdzie do rozwijanego menu jako wcięta pozycja
                mniejszym pismem i dodatkowo jako kafelek na stronie nadrzędnej.
              </span>
            )}
          </label>
        </div>

        <label className="text-sm block">
          <span className="block text-slate-500 mb-1">Nazwa</span>
          <input
            // Ref tylko w wariancie „w miejscu": tam po rozwinięciu ustawiamy
            // kursor w polu nazwy. Dolny formularz zostaje bez niego, tak jak
            // był — niczego mu tu nie dokładamy.
            ref={wMiejscu ? polaNazwyWMiejscuRef : undefined}
            required
            value={nazwa}
            onChange={(e) => {
              setNazwa(e.target.value);
              // Adres podpowiadany z nazwy, DOPÓKI redaktor go sam nie ruszy.
              // „Coś Tam" → „cos-tam". Bez tego trzeba było wpisywać adres
              // drugi raz, ręcznie zdejmując polskie znaki — a literówka
              // w adresie to rzecz, którą potem widzi wyszukiwarka.
              if (!slugRuszony) setSlug(slugZNazwy(e.target.value));
            }}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="np. Uczniowskie"
          />
        </label>

        {(rodzaj === "page" || rodzaj === "header") && (
          <label className="text-sm block">
            <span className="block text-slate-500 mb-1">
              {rodzaj === "header"
                ? "Adres (fragment po ukośniku) – nieobowiązkowy"
                : "Adres (fragment po ukośniku)"}
            </span>
            {/* Nagłówek MOŻE mieć adres (decyzja D1). Z adresem zachowuje się
                jak folder: wnosi swój segment do adresów podstron, więc
                „ucz" + podstrona „ww" daje /program-nauczania/ucz/ww. Bez
                adresu jest dla ścieżki przezroczysty, czyli tak jak działały
                wszystkie nagłówki wcześniej — i dlatego pole nie jest tu
                wymagane. */}
            <input
              required={rodzaj === "page"}
              value={slug}
              onChange={(e) => {
                // Od pierwszej ręcznej zmiany przestajemy nadpisywać adres
                // nazwą — inaczej podpowiedź kasowałaby to, co redaktor
                // właśnie wpisał.
                setSlugRuszony(true);
                setSlug(e.target.value.toLowerCase());
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder={rodzaj === "header" ? "zostaw puste, jeśli ma tylko grupować" : "np. uczniowskie"}
            />
            {rodzaj === "header" && (
              <span className="mt-1 block text-xs text-slate-500">
                Wpisany adres stanie się wspólnym początkiem adresów wszystkich podstron tego
                nagłówka. Puste pole zostawia je tam, gdzie są.
              </span>
            )}
          </label>
        )}

        {rodzaj === "link" && (
          <label className="text-sm block">
            <span className="block text-slate-500 mb-1">Adres zewnętrzny</span>
            <input
              required
              value={adresZewnetrzny}
              onChange={(e) => setAdresZewnetrzny(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </label>
        )}

        <p className="text-sm text-slate-500">
          Adres tej pozycji: <strong className="text-slate-700">{podgladAdresu()}</strong>
        </p>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Dodaj
        </button>
      </form>
    );
  }

  /**
   * Zamiana rodzaju pozycji — etap E.
   *
   * Dialog pokazuje SKUTKI, nie pyta „na pewno?". Ta operacja przestawia
   * adresy, które widziała wyszukiwarka: strona zamieniana w nagłówek oddaje
   * swój adres podstronie, a nagłówek zamieniany w stronę wsuwa swoje
   * podstrony o jeden segment głębiej. Redaktor musi to zobaczyć wyliczone,
   * zanim kliknie — samo „na pewno?" niczego mu nie mówi.
   */
  /**
   * Zamiana rodzaju — dialog mówi to, co się NAPRAWDĘ stanie.
   *
   * Do 2026-09-08 przy powrocie na stronę panel PYTAŁ redaktora o adres
   * (`prompt`), bo nagłówek żadnego nie miał, a przy zamianie na nagłówek
   * wypisywał listę podstron, którym zmienią się adresy. W wariancie A
   * (decyzja D1) nagłówek trzyma własny adres, więc:
   *   • pytanie o adres zniknęło — jest już zapisany na węźle,
   *   • lista zmian adresów zniknęła, bo żaden się nie zmienia.
   * Zostaje jedna rzecz warta pokazania: adres nagłówka przestaje oddawać
   * stronę i zaczyna przerzucać na pierwszą podstronę.
   *
   * `slug` jest podawany tylko w jednym przypadku: nagłówek założony jako
   * nagłówek nie ma adresu, więc przy zamianie na stronę trzeba go wymyślić.
   */
  async function handleZamienRodzaj(w: WezelPanelu) {
    const naStrone = w.kind === "header";
    let slug: string | undefined;

    if (naStrone && !w.slug) {
      const podany = prompt(
        `„${w.title}" to nagłówek bez własnego adresu, więc przy zamianie w stronę trzeba go nadać.\n\n` +
          "Podaj adres – fragment po ukośniku, małe litery, cyfry i myślniki:",
        // Ten sam `slugZNazwy` co w formularzu dodawania. Poprzedni zapis gubił
        // polskie znaki: „Zajęcia" dawało „zaj-cia", bo `[^a-z0-9]` zjada „ę"
        // razem z myślnikiem po nim.
        slugZNazwy(w.title),
      );
      if (podany === null) return;
      slug = podany;
    }

    const skutki = await skutkiZamiany(w.id, naStrone ? "na-strone" : "na-naglowek", slug);
    if (!skutki.mozliwe) {
      pokazKomunikat(false, skutki.powod ?? "Nie da się zamienić rodzaju tej pozycji.");
      return;
    }

    const linie: string[] = [];
    if (naStrone) {
      linie.push(`„${w.title}" przestanie być nagłówkiem i pod adresem ${skutki.adres?.z} znów będzie strona.`);
    } else {
      linie.push(
        `„${w.title}" przestanie być stroną. Adres ${skutki.adres?.z} zostaje przy niej ` +
          "jako miejsce w drzewie, ale nie będzie już otwierał żadnej treści –",
      );
      linie.push(`zamiast tego zacznie przerzucać na „${skutki.adres?.celTytul}" (${skutki.adres?.na}).`);
    }
    if (skutki.zmianyAdresow?.length) {
      linie.push("");
      linie.push("ZMIENIĄ SIĘ ADRESY podstron (stare zaczną przekierowywać):");
      skutki.zmianyAdresow.forEach((z) => linie.push(`  • ${z.title}: ${z.z} → ${z.na}`));
    }
    if (skutki.bezZmianAdresu?.length) {
      linie.push("");
      linie.push("BEZ ZMIAN – te adresy zostają dokładnie takie, jakie są:");
      skutki.bezZmianAdresu.forEach((t) => linie.push(`  • ${t}`));
    }
    if (skutki.usuwanePrzekierowania?.length) {
      linie.push("");
      linie.push("ZNIKNĄ przekierowania (adres znów będzie prawdziwą stroną):");
      skutki.usuwanePrzekierowania.forEach((p) => linie.push(`  • ${p}`));
    }

    /**
     * Tu jest cały powód, dla którego panel przestał wołać `confirm`: ta lista
     * ma nagłówki sekcji i wypunktowania, a systemowe okienko skleja ją
     * w jeden akapit małym pismem. Pytanie („Zapisać?") idzie na tytuł, skutki
     * zostają co do znaku takie, jak były — `whitespace-pre-line` w dialogu
     * trzyma złamania linii.
     *
     * Rozstrzygnięcie jest teraz asynchroniczne, ale czekamy dokładnie w tym
     * miejscu, w którym stał `confirm`: po drodze nic nie jest zapisywane ani
     * ustawiane, a `skutki` zostały już wyliczone wyżej.
     */
    const zgoda = await potwierdz({
      tytul: "Zapisać?",
      tresc: linie.join("\n"),
      potwierdzEtykieta: "Zapisz",
    });
    if (!zgoda) return;

    await wykonaj(
      () => zamienRodzaj(w.id, naStrone ? "na-strone" : "na-naglowek", slug),
      naStrone ? `„${w.title}" jest teraz stroną.` : `„${w.title}" jest teraz nagłówkiem.`,
    );
  }

  async function handleUsun(w: WezelPanelu) {
    const potomkowie = await policzPotomkow(w.id);
    // Te same słowa, co w dawnym `confirm` — zmienia się tylko to, gdzie stoją:
    // pytanie idzie na tytuł, lista potomków zostaje listą, a nie akapitem.
    const linie: string[] = [];
    if (potomkowie.length) {
      linie.push("RAZEM Z NIĄ do kosza trafią:");
      potomkowie.forEach((p) => linie.push(`  • ${p.title}${p.full_path ? ` (${p.full_path})` : ""}`));
      linie.push("");
    }
    linie.push("Z kosza da się to przywrócić.");

    const zgoda = await potwierdz({
      tytul: `Przenieść „${w.title}" do kosza?`,
      tresc: linie.join("\n"),
      potwierdzEtykieta: "Przenieś do kosza",
      wariant: "usuwanie",
    });
    if (!zgoda) return;
    await wykonaj(() => doKosza(w.id), `„${w.title}" jest w koszu.`);
  }

  /**
   * Karta pozycji jako ZWYKŁA FUNKCJA zwracająca JSX, nie komponent.
   *
   * Jako komponent zdefiniowany wewnątrz TreeManager miała NOWĄ tożsamość typu
   * przy każdym renderze, więc React nie aktualizował drzewa, tylko je
   * PRZEMONTOWYWAŁ — kasował i tworzył od nowa wszystkie węzły DOM. Skutek
   * zgłoszony przez właściciela: „przy każdym poruszeniu góra dół, lewo prawo
   * panel się odświeża i myszka ląduje u góry". Bez granicy komponentu React
   * widzi te same typy elementów i zachowuje DOM razem z przewinięciem.
   *
   * DLACZEGO KARTA, A NIE WIERSZ NA WSPÓLNEJ LIŚCIE
   * ----------------------------------------------
   * Do 2026-09-07 wszystkie poziomy leżały jedną płaską listą, a zagnieżdżenie
   * pokazywało samo wcięcie w `rem`. Przy trzech poziomach nie dawało się tego
   * przeczytać („ogólnie cała zakładka strony i menu wygląda chujowo,
   * nieczytelna"), bo różnica wcięcia była mniejsza niż szerokość plakietek
   * stanu. Teraz podstrony leżą FIZYCZNIE wewnątrz karty rodzica, na szarym
   * wypełnieniu — hierarchia jest w strukturze dokumentu, nie w liczbie pikseli.
   *
   * `data-wezel` musi zostać na WIERSZU, nie na karcie. Test odbioru szuka
   * przycisków selektorem `[data-wezel="…"] button[aria-label="…"]`; gdyby atrybut
   * siedział na karcie, ten sam selektor łapałby też przyciski podstron
   * i Playwright odmawiałby kliknięcia (strict mode).
   */
  function wierszDrzewa(w: WezelPanelu, poziom: number) {
    const potomstwo = dzieci(w.id);
    const zRoutu = w.source === "route";
    // Odnośnik zewnętrzny nie ma podstron, a trzeci poziom jest ostatni —
    // ten sam warunek co przy liście miejsc w formularzu.
    const mozeMiecPodstrony = w.kind !== "link" && w.depth < 2;
    const s = styl(poziom);
    const powodUkrycia = powod(w.id);
    const czyZwiniete = zwiniete.has(w.id);
    return (
      <div key={w.id} className={s.karta}>
        <div
          // Znaczniki `data-*` sa tu po to, zeby test odbioru mogl wskazac
          // KONKRETNY wiersz, a nie zgadywac po tresci. Dopasowanie po tekscie
          // trafialo w zagniezdzony <div> z adresem, ktory nie ma przyciskow -
          // i wygladalo to jak "przycisku nie ma", a nie jak "zly selektor".
          data-wezel={w.id}
          data-adres={w.full_path ?? ""}
          // Zagnieżdżenie widać na ekranie tylko przez wcięcie, a wcięcie jest
          // w `rem` — test odbioru musiałby przeliczać piksele przez rozmiar
          // czcionki korzenia, żeby stwierdzić, że „wsuń" faktycznie wsunęło.
          data-poziom={poziom}
          className={`flex flex-wrap items-center gap-x-5 gap-y-3 ${s.naglowekKarty}`}
        >
          {/* Strzałka zwijania przed plakietką rodzaju, przy samej krawędzi
              karty — tam, gdzie oko szuka uchwytu drzewa. Pozycja bez podstron
              dostaje w tym miejscu PUSTY tor tej samej szerokości: bez niego
              nazwy pozycji z podstronami i bez nich zaczynałyby się w dwóch
              różnych miejscach i pion kolumny by się rozjechał. */}
          {potomstwo.length > 0 ? (
            // Chmurka mówi wprost, że to widok panelu — „zwiń" brzmi jak
            // chowanie podstron przed odwiedzającym, a nie przed sobą.
            <Podpowiedz
              tresc={
                czyZwiniete
                  ? "Pokazuje z powrotem podstrony schowane w tej karcie – w menu na stronie i tak są."
                  : "Chowa podstrony w tej karcie, żeby ogarnąć długą listę – na stronie nic to nie zmienia."
              }
            >
              <button
                type="button"
                onClick={() => przelaczZwiniecie(w.id)}
                aria-expanded={!czyZwiniete}
                // BEZ `title` — powód opisany przy rzędzie akcji niżej.
                // Nazwy pozycji w etykiecie już nie ma: ma to być STAŁY ciąg,
                // po którym da się trafić selektorem, a konkretny wiersz
                // zawęża i tak `[data-wezel="…"]`.
                aria-label={czyZwiniete ? "Rozwiń podstrony" : "Zwiń podstrony"}
                // Ramka i białe tło, a nie sam znak: pierwsza wersja miała goły
                // glif w kolorze `slate-500` i na zrzucie 1920 px wyglądał jak
                // przypadkowa kropka przy plakietce — redaktor bez zaplecza
                // technicznego nie ma powodu w niego kliknąć. Reszta kontrolek
                // w tym rzędzie to obramowane przyciski, więc uchwyt drzewa
                // wygląda teraz jak one.
                className="w-7 shrink-0 rounded-md border border-slate-300 bg-white py-1 text-sm leading-none text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                {czyZwiniete ? "▸" : "▾"}
              </button>
            </Podpowiedz>
          ) : (
            <span className="w-7 shrink-0" aria-hidden="true" />
          )}

          {/* Rodzaj jako własna kolumna, nie plakietka w rzędzie z resztą:
              wcześniej „strona / nagłówek / odnośnik" konkurowało wizualnie
              ze stanami („ukryta", „poza menu"), choć to dwie różne rzeczy —
              rodzaj jest stały, stan się zmienia. */}
          <span
            className={`w-[5.5rem] shrink-0 rounded-md border px-2 py-0.5 text-center text-[0.68rem] font-semibold uppercase tracking-wide ${PLAKIETKA_RODZAJU[w.kind]}`}
          >
            {OPIS_RODZAJU[w.kind]}
          </span>

          <div className="min-w-[11rem] flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className={`truncate ${s.nazwa}`}>{w.menu_label ?? w.title}</span>
              {/* Ile podstron się schowało — tylko po zwinięciu. Bez tej
                  liczby zwinięta karta wygląda dokładnie jak pozycja, która
                  podstron nigdy nie miała, a to dwie różne rzeczy. */}
              {potomstwo.length > 0 && czyZwiniete && (
                <span className="rounded border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-slate-600">
                  {liczbaPodstron(potomstwo.length)}
                </span>
              )}
              {!w.published && (
                <span className="rounded border border-amber-300 bg-amber-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-900">
                  ukryta
                </span>
              )}
              {!w.in_menu && (
                <span className="rounded border border-slate-400 bg-slate-200 px-1.5 py-0.5 text-[0.68rem] font-medium text-slate-700">
                  poza menu
                </span>
              )}
              {/* Punkt A6: „jak ukryję podstronę 2 poziomu, to podstrona
                  3 poziomu zostaje ukryta, ale plakietka na to nie wskazuje".
                  Pokazujemy TYLKO wtedy, gdy własne pola pozycji są w porządku —
                  inaczej obok „ukryta" wisiałoby drugie zdanie o rodzicu i nie
                  dałoby się odczytać, co redaktor ustawił sam. */}
              {powodUkrycia === "rodzic-ukryty" && (
                <span
                  className="rounded border border-amber-400 bg-amber-50 px-1.5 py-0.5 text-[0.68rem] font-medium text-amber-900"
                  title="Ta pozycja ma własne ustawienia w porządku, ale leży pod ukrytą stroną – więc nie widać jej ani w menu, ani pod jej adresem. Odkryj stronę wyżej, a wróci sama."
                >
                  niewidoczna – rodzic ukryty
                </span>
              )}
              {powodUkrycia === "rodzic-poza-menu" && (
                <span
                  className="rounded border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-[0.68rem] font-medium text-slate-700"
                  title="Ta pozycja jest opublikowana i jej adres działa, ale w menu nie ma do niej drogi – pozycja wyżej jest zdjęta z menu."
                >
                  poza menu – przez rodzica
                </span>
              )}
              {zRoutu && (
                <span
                  className="rounded border border-indigo-300 bg-indigo-50 px-1.5 py-0.5 text-[0.68rem] font-medium text-indigo-700"
                  title="Układ tej strony jest częścią serwisu – z panelu zmienisz nazwę i widoczność, ale nie adres."
                >
                  stała część serwisu
                </span>
              )}
            </div>
            <div className="mt-1 truncate font-mono text-xs text-slate-500">
              {w.kind === "link" ? w.external_url : (w.full_path ?? "– bez adresu –")}
            </div>
          </div>

          {/* Trzy grupy z prawdziwą przerwą między nimi. Wcześniej wszystkie
              osiem przycisków stało w jednym `gap-1` i cztery strzałki zlewały
              się w jeden prostokąt — „strzałki się zlewają z sobą".

              Stała szerokość toru, a nie `shrink-0` po treści: przy zmiennej
              szerokości bloku nazwy (plakietki „stała część serwisu", różne
              długości tytułów) przyciski przesuwały się z wiersza na wiersz
              o kilkadziesiąt pikseli i nie dawało się ich skanować wzrokiem
              w pionie. `justify-end` trzyma prawą krawędź, więc brak przycisku
              „Usuń" w stałych częściach serwisu nie rozjeżdża reszty. */}
          {/* Akcje: od 1280 px OBOK nazwy, poniżej — we własnej linii.
              Jedno i drugie z pomiaru, nie z gustu.

              Do 2026-09-09 kolumna treści panelu miała `max-w-5xl`, co przy
              zwężonym korzeniu serwisu dawało ~792 px. Rząd sześciu kontrolek
              z „Usuń" nie mieścił się wtedy obok nazwy i zjeżdżał do własnej
              linii — przyciski skakały w pionie i nie dawało się ich skanować
              wzrokiem. Stąd wzięły się obie rezerwacje szerokości w tym rzędzie.

              Dziś powód jest odwrotny. Panel dostał własną skalę korzenia
              (`html:has([data-panel-admina])`: ~20,6 px przy oknie 1920 zamiast
              ~14,1 px), więc te same `rem` znaczą półtora raza więcej pikseli.
              Kolumna treści za tym nie poszła i pójść nie może: `max-w-[84rem]`
              to przy tej skali ~1730 px, czyli więcej, niż zostaje obok paska
              bocznego — przy 1920 kolumna kończy się na krawędzi okna
              i użytecznej szerokości ma ~73rem, nie 84. Za to rezerwacje w tym
              rzędzie urosły co do joty: `min-w-[16rem]` + `xl:min-w-[33rem]`
              to 49rem samego minimum. Pomiar playwrightem: 13 z 36 rzędów
              w jednej linii przy 1920, wobec 28 z 36 przed zmianą skali.

              Dlatego obie miary są podzielone przez skalę (16 → 11rem,
              33 → 23rem). Rezerwują tyle samo PIKSELI, ile rezerwowały przed
              zmianą — tylko zapisane w nowych `rem`. Nie jest to zwężanie
              kontrolek: same przyciski są w `text-sm`, czyli urosły razem
              z panelem, i żaden napis się nie zmienił.

              `w-full xl:w-auto` zostaje: przy wąskim oknie rząd wraca do
              własnej linii, zamiast pozwolić przyciskom zawijać się nierówno.

              Stała szerokość toru (`xl:min-w-[23rem]`), a nie `shrink-0` po
              treści: bez niej brak przycisku „Usuń" w stałych częściach
              serwisu przesuwałby cały rząd o kilkadziesiąt pikseli i pion
              znów by się rozjechał. */}
          <div className="flex w-full flex-wrap items-center justify-end gap-3 xl:ml-auto xl:w-auto xl:min-w-[23rem] xl:flex-nowrap">
            {/* ŻADEN przycisk tego rzędu nie ma już atrybutu `title` — i nie
                jest to kosmetyka.

                Chmurka (`Podpowiedz`) zdejmowała `title` na czas pokazu
                i oddawała go przy zjechaniu kursorem. Chromium przy
                przebudowie listy wysyła pod NIERUCHOMYM kursorem
                mouseout+mouseover: po kliknięciu „Wyżej" lista się przestawia,
                pod kursorem ląduje inny przycisk, chmurka zdejmuje mu `title`
                i nigdy go nie przywraca, bo mysz się nie ruszyła. Testy odbioru
                szukały wtedy `[data-wezel="…"] button[title="…"]` i nie
                znajdowały nic — wyglądało to na brak przycisku, a nie na
                zgubiony atrybut.

                Nazwa kontrolki siedzi więc w STAŁYM `aria-label`, którego nikt
                nie rusza: o treści dawnego `title` tam, gdzie przycisk jest
                samą strzałką („Wyżej", „Niżej", „Wysuń na wyższy poziom",
                „Wsuń pod pozycję powyżej"), a o treści widocznego napisu tam,
                gdzie napis jest. Te ciągi są selektorami testów odbioru
                (Poligon/test-przesuwanie.mjs, test-drzewo-panel.mjs,
                test-trzeci-poziom.mjs), więc zmiana etykiety wymaga zmiany tam.
                Wyjaśnienie skutku kliknięcia zostaje w propsie `tresc`
                chmurki. */}
            <div
              role="group"
              aria-label={`Kolejność: ${w.title}`}
              className="flex overflow-hidden rounded-lg border border-slate-300"
            >
              <Podpowiedz tresc="Zamienia się miejscem z pozycją stojącą nad nią w tej samej gałęzi – zmienia się kolejność w menu, nie adres.">
                <button
                  disabled={busy}
                  onClick={() => wykonaj(() => przesun(w.id, "gora" as Kierunek), "Przesunięte wyżej.")}
                  aria-label="Wyżej"
                  className="border-r border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
                >
                  ↑
                </button>
              </Podpowiedz>
              <Podpowiedz tresc="Zamienia się miejscem z pozycją stojącą pod nią w tej samej gałęzi – zmienia się kolejność w menu, nie adres.">
                <button
                  disabled={busy}
                  onClick={() => wykonaj(() => przesun(w.id, "dol" as Kierunek), "Przesunięte niżej.")}
                  aria-label="Niżej"
                  className="px-2.5 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
                >
                  ↓
                </button>
              </Podpowiedz>
            </div>

            {/* Poziom zagnieżdżenia — osobna grupa, bo to inna operacja niż
                kolejność: zmienia adres strony, a nie tylko miejsce na liście. */}
            <div
              role="group"
              aria-label={`Poziom w drzewie: ${w.title}`}
              className="flex overflow-hidden rounded-lg border border-slate-300"
            >
              {/* Obie chmurki mówią o adresie, bo to jedyne dwa przyciski
                  w tym rzędzie, które go przestawiają — a zmieniony adres
                  widziała już wyszukiwarka. Przekierowanie ze starego adresu
                  zakłada trigger w bazie (03-drzewo-stron.sql), więc obietnica
                  „stary zacznie przekierowywać" jest prawdziwa. */}
              <Podpowiedz tresc="Wychodzi spod swojej strony nadrzędnej o poziom wyżej – adres się skraca, a stary zacznie przekierowywać na nowy.">
                <button
                  disabled={busy}
                  onClick={() => wykonaj(() => przesun(w.id, "wysun" as Kierunek), "Wysunięte na wyższy poziom.")}
                  aria-label="Wysuń na wyższy poziom"
                  className="border-r border-slate-300 px-2.5 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
                >
                  ←
                </button>
              </Podpowiedz>
              <Podpowiedz tresc="Chowa się jako podstrona pozycji stojącej nad nią – adres wydłuża się o jej człon, a stary zacznie przekierowywać na nowy.">
                <button
                  disabled={busy}
                  onClick={() => wykonaj(() => przesun(w.id, "wsun" as Kierunek), "Wsunięte pod pozycję wyżej.")}
                  aria-label="Wsuń pod pozycję powyżej"
                  className="px-2.5 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
                >
                  →
                </button>
              </Podpowiedz>
            </div>

            {/* Chmurka przy „Ukryj" musi powiedzieć o podstronach: schowanie
                jednej strony gasi całą gałąź pod nią (`lib/widocznosc.ts`),
                a z samego napisu tego nie widać. */}
            <Podpowiedz
              tresc={
                w.published
                  ? "Znika z menu i przestaje otwierać się pod swoim adresem – razem ze wszystkim, co pod nią."
                  : "Wraca do menu i znów otwiera się pod swoim adresem."
              }
            >
              <button
                disabled={busy}
                onClick={() =>
                  wykonaj(
                    /**
                     * Ukrycie i publikacja są SYMETRYCZNE.
                     *
                     * Ukrycie musi zdjąć pozycję z menu, bo baza nie dopuszcza
                     * kombinacji „w menu, ale nieopublikowana" — menu prowadziłoby
                     * do strony, której nie ma. Ale poprzednia wersja przy
                     * publikacji oddawała `w.in_menu`, czyli wartość WŁAŚNIE
                     * wyzerowaną przez ukrycie: „Ukryj" + „Opublikuj" zostawiało
                     * pozycję poza menu i redaktor musiał zgadnąć, że brakuje
                     * trzeciego kliknięcia. Po A6 byłoby to gorsze niż wcześniej,
                     * bo razem z nią poza menu zostawałaby cała gałąź pod spodem.
                     *
                     * Cena: pozycja świadomie trzymana poza menu wróci do menu
                     * po ukryciu i odkryciu. Widać to od razu — plakietka „poza
                     * menu" znika — i odwraca się jednym kliknięciem, więc jest
                     * to wymiana lepsza niż stan, którego nie da się odgadnąć.
                     */
                    () => zapiszWezel(w.id, { published: !w.published, inMenu: !w.published }),
                    w.published ? "Ukryte." : "Opublikowane.",
                  )
                }
                aria-label={w.published ? "Ukryj" : "Opublikuj"}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
              >
                {w.published ? "Ukryj" : "Opublikuj"}
              </button>
            </Podpowiedz>
            {/* Najczęściej mylona para w całym rzędzie: „zdejmij z menu"
                brzmi jak wyłączenie strony, a strona zostaje żywa. */}
            <Podpowiedz
              tresc={
                w.in_menu
                  ? "Znika z menu na stronie, ale dalej działa pod swoim adresem – linki i wyszukiwarka bez zmian."
                  : "Wraca do menu na stronie, w swoim miejscu w drzewie."
              }
            >
              <button
                disabled={busy}
                onClick={() =>
                  wykonaj(() => zapiszWezel(w.id, { inMenu: !w.in_menu }), w.in_menu ? "Zdjęte z menu." : "Dodane do menu.")
                }
                aria-label={w.in_menu ? "Zdejmij z menu" : "Pokaż w menu"}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
              >
                {w.in_menu ? "Zdejmij z menu" : "Pokaż w menu"}
              </button>
            </Podpowiedz>

            {/* Zamiana rodzaju tylko dla pozycji z bazy. Przy „stałej części
                serwisu" baza tego nie przepuści (`pages_source_chk`), a przycisk,
                który zawsze odmawia, jest gorszy od jego braku. Odnośnik
                zewnętrzny też nie jest objęty tą funkcją. */}
            {!zRoutu && w.kind !== "link" && (
              <Podpowiedz
                tresc={
                  w.kind === "header"
                    ? "Adres znów zacznie otwierać własną treść, zamiast przerzucać na pierwszą podstronę."
                    : "Treść przestaje się otwierać – adres zostaje, ale zacznie przerzucać na pierwszą podstronę."
                }
              >
                <button
                  disabled={busy}
                  onClick={() => handleZamienRodzaj(w)}
                  aria-label={w.kind === "header" ? "Zamień na stronę" : "Zamień na nagłówek"}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-40"
                >
                  {w.kind === "header" ? "Zamień na stronę" : "Zamień na nagłówek"}
                </button>
              </Podpowiedz>
            )}

            {/* Edycja i usuwanie odsunięte od przełączników widoczności:
                pierwsze dwa da się cofnąć jednym kliknięciem, „Usuń" nie. */}
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <Podpowiedz tresc="Otwiera osobny ekran tej pozycji: nazwa, adres, opis i treść.">
                <Link
                  href={`/admin/drzewo/${w.id}`}
                  aria-label="Edytuj"
                  className="rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 hover:bg-indigo-50"
                >
                  Edytuj
                </Link>
              </Podpowiedz>
              {!zRoutu && (
                <Podpowiedz tresc="Odkłada do kosza razem z podstronami – ze strony znika od razu, ale da się ją stamtąd przywrócić.">
                  <button
                    disabled={busy}
                    onClick={() => handleUsun(w)}
                    aria-label="Usuń"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40"
                  >
                    Usuń
                  </button>
                </Podpowiedz>
              )}
            </div>
          </div>
        </div>

        {/* Strefa z podstronami — TYLKO gdy podstrony są.
            Wcześniej istniała także pusta, bo mieszkał w niej przycisk „+",
            i przy kilkudziesięciu stronach bez podstron dawało to
            kilkadziesiąt pustych pasów po ~60 px. Zakładka przewijała się
            wtedy trzy ekrany dłużej, niż potrzebowała. */}
        {potomstwo.length > 0 && !czyZwiniete && (
          <div className={`border-t p-3.5 ${s.strefa}`}>
            {/* Pionowa prowadnica plus realne wcięcie. Wcześniej strefa miała
                `p-2.5` ze wszystkich stron, więc karta dziecka zaczynała się
                osiem pikseli na prawo od karty rodzica — mniej niż szerokość
                jednej plakietki. Hierarchii nie dawało się odczytać inaczej
                niż licząc ramki. */}
            <div className={`space-y-3.5 border-l-2 ${s.prowadnica} ${s.wciecie}`}>
              {potomstwo.map((d) => wierszDrzewa(d, poziom + 1))}
            </div>
          </div>
        )}

        {/* „+ Podstrona" jako WĄSKA stopka karty, nie osobny pas.
            Właściciel prosił wprost o „delikatny «+»" pod każdą kartą,
            z gotowym miejscem w drzewie — delikatny znaczy też: niezabierający
            tyle miejsca co pozycja, którą się dodaje. Nazwy rodzica w napisie
            nie ma, bo mówi ją położenie przycisku wewnątrz karty; w razie
            wątpliwości jest podpowiedź spod kursora. */}
        {mozeMiecPodstrony && (
          <div className={`border-t px-3 py-1.5 ${s.stopka}`}>
            <button
              type="button"
              disabled={busy}
              onClick={() => przelaczDodawanieWMiejscu(w.id)}
              aria-expanded={dodawanieW === w.id}
              title={`Dodaj podstronę w „${w.title}"`}
              className="rounded-md px-2 py-0.5 text-[0.8rem] font-medium text-slate-500 transition-colors hover:bg-white hover:text-indigo-700 disabled:opacity-40"
            >
              + Podstrona
            </button>
          </div>
        )}

        {/* Formularz W MIEJSCU — ostatni element karty, czyli dokładnie pod
            przyciskiem, który go otworzył. Własne, wyraźnie inne tło
            (`bg-indigo-50/70`), bo to jedyna część karty, która nie opisuje
            istniejącej pozycji, tylko tę, która dopiero powstanie.
            `dodawanieW === w.id`, a nie osobna flaga: dzięki temu zmiana
            miejsca w drzewie w rozwiniętym formularzu przenosi go pod
            właściwą kartę, zamiast zostawiać pod starą. */}
        {dodawanieW === w.id && (
          <div className="border-t border-indigo-200 bg-indigo-50/70 px-4 py-4">
            {formularzDodawania(true)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Strony i menu</h1>
      </div>

      <Komunikat msg={msg} onZamknij={wyczyscKomunikat} />

      {/* Sekcje najwyższego poziomu stoją OSOBNO, bez wspólnej ramki.
          Poprzednia wersja trzymała wszystkie w jednym pudle na szarym
          wypełnieniu (`rounded-2xl border bg-slate-300/80 p-4`) — zgłoszenie
          właściciela: „po co ten jeden wielki zgrupowany div?". Pudło było
          nadmiarowe, bo tło panelu jest już szare (`bg-slate-100`
          w `AdminShell`), więc białe karty czytają się jako osobne obiekty
          i bez niego. Szarość została tam, gdzie coś znaczy: w strefach
          z podstronami wewnątrz kart.

          `space-y-8`, a nie `space-y-5`: odstęp między sekcjami menu musi być
          wyraźnie większy od odstępu między podstronami w strefie
          (`space-y-3.5`), inaczej granica sekcji ginie w rytmie wierszy. */}
      {/* Jeden przycisk, nie para: „Zwiń wszystkie" i „Rozwiń wszystkie" obok
          siebie zmuszałyby do sprawdzenia, który jest teraz aktywny. Napis
          mówi, co się STANIE po kliknięciu. */}
      {zwijalne.length > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setZwiniete(wszystkoZwiniete ? new Set() : new Set(zwijalne))}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:border-slate-400 hover:text-slate-900"
          >
            {wszystkoZwiniete ? "Rozwiń wszystkie" : "Zwiń wszystkie"}
          </button>
        </div>
      )}

      <div className="space-y-8">
        {dzieci(null).map((w) => wierszDrzewa(w, 0))}

        <button
          type="button"
          disabled={busy}
          onClick={() => zacznijDodawanie(null)}
          title="Dodaj pozycję najwyższego poziomu"
          className="w-full rounded-xl border border-dashed border-slate-400 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:border-indigo-400 hover:text-indigo-700 disabled:opacity-40"
        >
          + Nowa sekcja w menu głównym
        </button>
      </div>

      {formularzDodawania(false)}

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold mb-1">Kosz</h2>
        <p className="text-sm text-slate-500 mb-4">
          Usunięte strony leżą tu, dopóki ich stąd nie wyrzucisz. Przywrócenie zadziała
          tylko wtedy, gdy w międzyczasie nikt nie zajął ich adresu.
        </p>
        {wKoszu.length === 0 && <p className="text-sm text-slate-400">Kosz jest pusty.</p>}
        {wKoszu.map((w) => (
          <div
            key={w.id}
            data-kosz={w.id}
            data-kosz-slug={w.slug ?? ""}
            className="flex items-center justify-between gap-3 py-2 border-t border-slate-100"
          >
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate">{w.title}</div>
              <div className="text-sm text-slate-400 truncate">{w.full_path ?? "– bez adresu –"}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={busy}
                onClick={() => wykonaj(() => przywroc(w.id), `Przywrócone: „${w.title}".`)}
                className="rounded-lg border border-emerald-300 text-emerald-700 px-3 py-1 text-sm hover:bg-emerald-50 disabled:opacity-40"
              >
                Przywróć
              </button>
              <button
                disabled={busy}
                onClick={async () => {
                  // Pytanie idzie na tytuł, ostrzeżenie zostaje treścią —
                  // te same słowa, co w dawnym `confirm`.
                  const zgoda = await potwierdz({
                    tytul: `Usunąć „${w.title}" NA ZAWSZE?`,
                    tresc: "Tego nie da się cofnąć.",
                    potwierdzEtykieta: "Tak, usuń na zawsze",
                    wariant: "usuwanie",
                  });
                  if (!zgoda) return;
                  await wykonaj(() => usunTrwale(w.id), `Usunięte na zawsze: „${w.title}".`);
                }}
                className="rounded-lg border border-red-300 text-red-600 px-3 py-1 text-sm hover:bg-red-50 disabled:opacity-40"
              >
                Usuń na zawsze
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        Strony o stałym układzie – te z formularzem, mapą albo grafikiem –
        mają osobną zakładkę:{" "}
        <Link href="/admin/strony" className="underline">
          Strony o stałym układzie
        </Link>
        . Tutaj zmienisz ich nazwę i miejsce w menu, ale nie adres.
      </p>

      {/* Okno potwierdzenia — jedno na cały ekran, montowane dopiero z
          pytaniem. Samo idzie portalem do `document.body`, więc miejsce
          w drzewie nie ma znaczenia dla wyglądu; stoi na końcu, bo tak
          czyta się jak przypis, a nie jak kolejna sekcja zakładki. */}
      {oknoPotwierdzenia}
    </div>
  );
}
