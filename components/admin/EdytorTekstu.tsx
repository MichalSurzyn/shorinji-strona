"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KLASY_KONTROLKI } from "./Pole";
import {
  bezKropekList,
  domNaZnaki,
  formatyZaznaczenia,
  odcinekLinku,
  offsetyZaznaczenia,
  poprawAdres,
  przelaczFormat,
  punktDlaOffsetu,
  tekstNaZnaki,
  tekstZakresu,
  ustawLink,
  wyczyscFormat,
  wygladajaTakSamo,
  zamienZakres,
  zlozZnaki,
  znakiNaHtml,
  type Link,
  type Znacznik,
  type Znak,
} from "@/lib/formatTekstu";

/**
 * Pole tekstu, w którym widać formatowanie — zamiast `**gwiazdek**` w textarea.
 *
 * Zgłoszenie właściciela: klient widział w polu znaczniki i nie wiedział, jak
 * tekst wyjdzie na stronie. Format zapisu to nadal `**`, `*`, `==` i
 * `[tekst](adres)` — od 2026-10 z zagnieżdżeniami i linkiem „bez koloru",
 * patrz `lib/formatTekstu.ts`. Stare bloki czytają się bez zmian.
 *
 * BEZ BIBLIOTEKI, ZA TO Z MODELEM
 * -------------------------------
 * Pisanie zostawiamy przeglądarce, ale formatowanie już nie: B, I, Żółty, link
 * i wklejka czytają pole do tablicy znaków z formatem, zmieniają znaki od–do
 * i rysują pole od nowa z TEGO, CO ODCZYTA STRONA (zapis → odczyt). Dzięki temu
 * pole nie pokaże połączenia formatów, którego strona by nie narysowała.
 *
 * WŁASNE COFANIE
 * --------------
 * Pole rysowane od nowa wypada z historii przeglądarki, a jej Ctrl+Z
 * cofałby wtedy litery w drzewie, którego już nie ma. Dlatego Ctrl+Z / Ctrl+Y
 * (i „Cofnij" z menu kontekstowego) obsługuje własny stos stanów pola.
 */

const NAZWA: Record<Znacznik | "zolty", string> = {
  b: "pogrubienie",
  i: "kursywę",
  z: "żółty kolor",
  zolty: "żółty kolor",
};

type Stan = { tekst: string; od: number; doo: number };
type Okno = { tekst: string; adres: string; zolty: boolean; istniejacy: boolean; od: number; doo: number };
type Aktywne = { b: boolean; i: boolean; zolty: boolean; link: boolean };

/** Kolejne litery wpisywane szybciej niż co sekundę cofają się razem, jak słowo w Wordzie. */
const SKLEJANIE_PISANIA_MS = 1000;
const MAKS_HISTORII = 200;

export default function EdytorTekstu({
  value,
  onChange,
  zolty = true,
  idPola,
  idOpisu,
  etykieta,
  podpowiedz = "Wpisz treść albo wklej z Worda...",
  lista = false,
}: {
  value: string;
  onChange: (tekst: string) => void;
  /** Przycisk „Żółty" i wybór koloru linku — poza trybem „article", tak jak dawny przycisk. */
  zolty?: boolean;
  idPola: string;
  idOpisu?: string;
  etykieta: string;
  podpowiedz?: string;
  /** Pole listy: każda linia to punkt, wklejka zdejmuje kropki i numery z Worda. */
  lista?: boolean;
}) {
  const pole = useRef<HTMLDivElement>(null);
  /**
   * Ostatni tekst, który pole SAMO oddało do `onChange`.
   *
   * Pole jest niekontrolowane: React nie przepisuje jego zawartości przy każdej
   * literze, bo przepisanie przesuwa kursor na początek. Wartość z zewnątrz
   * wgrywamy tylko wtedy, gdy różni się od tego, co pole wysłało — czyli przy
   * „Cofnij" w edytorze bloków albo przesunięciu bloku strzałką (bloki mają
   * klucz po indeksie, więc to samo pole dostaje wtedy cudzy tekst).
   */
  const ostatni = useRef<string | null>(null);
  const historia = useRef<{ stany: Stan[]; poz: number; pisanie: boolean; czas: number }>({
    stany: [],
    poz: -1,
    pisanie: false,
    czas: 0,
  });
  // Liczone z `value`, nie trzymane osobno: rodzic oddaje to, co pole wysłało.
  const pusty = value === "";
  const [aktywne, setAktywne] = useState<Aktywne>({ b: false, i: false, zolty: false, link: false });
  const [uwaga, setUwaga] = useState<string | null>(null);
  const [okno, setOkno] = useState<Okno | null>(null);

  /** Rysuje pole z tekstu zapisu — dokładnie tak, jak przeczyta go strona. */
  const rysuj = useCallback((tekst: string) => {
    if (pole.current) pole.current.innerHTML = znakiNaHtml(tekstNaZnaki(tekst));
  }, []);

  const zaznaczenie = useCallback((): [number, number] | null => {
    const sel = window.getSelection();
    const el = pole.current;
    if (!sel || sel.rangeCount === 0 || !el) return null;
    const r = sel.getRangeAt(0);
    return el.contains(r.commonAncestorContainer) ? offsetyZaznaczenia(el, r) : null;
  }, []);

  const ustawZaznaczenie = useCallback((od: number, doo: number) => {
    const el = pole.current;
    const sel = window.getSelection();
    if (!el || !sel) return;
    const a = punktDlaOffsetu(el, od);
    const b = punktDlaOffsetu(el, doo);
    const r = document.createRange();
    r.setStart(a.wezel, a.offset);
    r.setEnd(b.wezel, b.offset);
    sel.removeAllRanges();
    sel.addRange(r);
  }, []);

  const odswiezPrzyciski = useCallback(() => {
    const el = pole.current;
    const z = zaznaczenie();
    if (!el || !z) return;
    const f = formatyZaznaczenia(domNaZnaki(el), z[0], z[1]);
    setAktywne((p) =>
      p.b === f.b && p.i === f.i && p.zolty === f.zolty && p.link === !!f.link
        ? p
        : { b: f.b, i: f.i, zolty: f.zolty, link: !!f.link },
    );
  }, [zaznaczenie]);

  const doHistorii = useCallback((stan: Stan, pisanie: boolean) => {
    const h = historia.current;
    const teraz = Date.now();
    if (pisanie && h.pisanie && h.poz > 0 && h.poz === h.stany.length - 1 && teraz - h.czas < SKLEJANIE_PISANIA_MS) {
      h.stany[h.poz] = stan;
    } else {
      h.stany = [...h.stany.slice(0, h.poz + 1), stan].slice(-MAKS_HISTORII);
      h.poz = h.stany.length - 1;
    }
    h.pisanie = pisanie;
    h.czas = teraz;
  }, []);

  useEffect(() => {
    if (value === ostatni.current) return;
    rysuj(value);
    ostatni.current = value;
    historia.current = { stany: [{ tekst: value, od: value.length, doo: value.length }], poz: 0, pisanie: false, czas: 0 };
  }, [value, rysuj]);

  useEffect(() => {
    if (!uwaga) return;
    const t = setTimeout(() => setUwaga(null), 5000);
    return () => clearTimeout(t);
  }, [uwaga]);

  /** Po literach z klawiatury: odczyt pola i wysyłka, jeśli tekst się zmienił. */
  const wyslij = useCallback(() => {
    const el = pole.current;
    if (!el) return;
    const tekst = zlozZnaki(domNaZnaki(el));
    if (tekst === ostatni.current) return;
    ostatni.current = tekst;
    onChange(tekst);
    const z = zaznaczenie() ?? [tekst.length, tekst.length];
    doHistorii({ tekst, od: z[0], doo: z[1] }, true);
  }, [onChange, zaznaczenie, doHistorii]);

  /** Wynik operacji na znakach → zapis → pole narysowane z odczytu zapisu. */
  const zastosuj = useCallback(
    (znaki: Znak[], od: number, doo: number) => {
      const tekst = zlozZnaki(znaki);
      rysuj(tekst);
      const dlugosc = tekstNaZnaki(tekst).length;
      ustawZaznaczenie(Math.min(od, dlugosc), Math.min(doo, dlugosc));
      if (tekst !== ostatni.current) {
        ostatni.current = tekst;
        onChange(tekst);
        doHistorii({ tekst, od, doo }, false);
      }
      odswiezPrzyciski();
    },
    [rysuj, ustawZaznaczenie, onChange, doHistorii, odswiezPrzyciski],
  );

  const przywroc = useCallback(
    (krok: -1 | 1) => {
      const h = historia.current;
      const cel = h.poz + krok;
      if (cel < 0 || cel >= h.stany.length) return;
      h.poz = cel;
      h.pisanie = false;
      const stan = h.stany[cel];
      rysuj(stan.tekst);
      ustawZaznaczenie(stan.od, stan.doo);
      ostatni.current = stan.tekst;
      onChange(stan.tekst);
      odswiezPrzyciski();
    },
    [rysuj, ustawZaznaczenie, onChange, odswiezPrzyciski],
  );

  /**
   * B / I / Żółty — jak przyciski na wstążce Worda: zaznaczenie bez formatu
   * dostaje format, zaznaczenie w formacie go traci. Formaty łączą się dowolnie.
   */
  function przelacz(cecha: "b" | "i" | "zolty") {
    const el = pole.current;
    const z = zaznaczenie();
    if (!el || !z) {
      el?.focus();
      setUwaga(`Zaznacz w polu tekst, który ma dostać ${NAZWA[cecha]}.`);
      return;
    }
    const wynik = przelaczFormat(domNaZnaki(el), z[0], z[1], cecha);
    if (!wynik) {
      setUwaga(`Najpierw zaznacz tekst, który ma dostać ${NAZWA[cecha]}.`);
      return;
    }
    zastosuj(wynik, z[0], z[1]);
  }

  function wyczysc() {
    const el = pole.current;
    const z = zaznaczenie();
    const wynik = el && z ? wyczyscFormat(domNaZnaki(el), z[0], z[1]) : null;
    if (!el || !z || !wynik) {
      setUwaga("Zaznacz tekst, z którego zdjąć formatowanie.");
      return;
    }
    zastosuj(wynik, z[0], z[1]);
  }

  /** Link: okno z tekstem, adresem i kolorem. Zaznaczenie odkładamy jako numery znaków. */
  function otworzLink() {
    const el = pole.current;
    if (!el) return;
    const znaki = domNaZnaki(el);
    const [od, doo] = zaznaczenie() ?? [znaki.length, znaki.length];
    const istniejacy = odcinekLinku(znaki, od, doo);
    if (istniejacy) {
      setOkno({
        tekst: tekstZakresu(znaki, istniejacy.od, istniejacy.doo),
        adres: istniejacy.link.adres,
        zolty: !istniejacy.link.bezKoloru,
        istniejacy: true,
        od: istniejacy.od,
        doo: istniejacy.doo,
      });
      return;
    }
    setOkno({
      tekst: tekstZakresu(znaki, od, doo).replace(/\s*\n\s*/g, " "),
      adres: "",
      zolty: true,
      istniejacy: false,
      od,
      doo,
    });
  }

  function zamknijOkno(wynik: { tekst: string; adres: string; zolty: boolean } | "usun" | null) {
    const o = okno;
    setOkno(null);
    const el = pole.current;
    el?.focus();
    if (!o || !el) return;
    if (!wynik) {
      ustawZaznaczenie(o.od, o.doo);
      return;
    }
    const znaki = domNaZnaki(el);
    if (wynik === "usun") {
      zastosuj(ustawLink(znaki, o.od, o.doo, null), o.od, o.doo);
      return;
    }
    // W trybie bez żółtego (podstrony tematyczne) link zostaje żółty jak dotąd.
    const link: Link = wynik.zolty || !zolty ? { adres: wynik.adres } : { adres: wynik.adres, bezKoloru: true };
    if (o.od < o.doo && wynik.tekst === tekstZakresu(znaki, o.od, o.doo)) {
      // Tekst bez zmian: link nakłada się na zaznaczenie i nie zdejmuje z niego pogrubienia.
      zastosuj(ustawLink(znaki, o.od, o.doo, link), o.od, o.doo);
      return;
    }
    // Nowy tekst linku dostaje pogrubienie i kursywę pierwszej zastępowanej litery.
    const wzor = (o.od < o.doo ? znaki[o.od] : znaki[o.od - 1])?.f ?? {};
    const f = { ...(wzor.b ? { b: true } : {}), ...(wzor.i ? { i: true } : {}), link };
    const nowe = wynik.tekst.split("").map((c) => ({ c, f }));
    const koniec = o.od + nowe.length;
    zastosuj(zamienZakres(znaki, o.od, o.doo, nowe), koniec, koniec);
  }

  /**
   * Wklejka z Worda, Google Docs albo innej strony.
   *
   * Zostaje to, co strona umie pokazać: pogrubienie, kursywa, linki i podział
   * na akapity. Czcionki, kolory, rozmiary i ukryte śmieci Worda (`mso-*`,
   * komentarze warunkowe, puste `<o:p>`) odpadają w `domNaZnaki`.
   */
  function wklej(e: React.ClipboardEvent<HTMLDivElement>) {
    e.preventDefault();
    const el = pole.current;
    if (!el) return;
    const html = e.clipboardData.getData("text/html");
    const zwykly = e.clipboardData.getData("text/plain").replace(/\r\n?/g, "\n");
    let wstawiane: Znak[] = html
      ? domNaZnaki(new DOMParser().parseFromString(html, "text/html").body, "wklejka")
      : zwykly.split("").map((c) => ({ c, f: {} }));
    if (lista) wstawiane = bezKropekList(wstawiane);
    if (!wstawiane.length) return;
    const znaki = domNaZnaki(el);
    const [od, doo] = zaznaczenie() ?? [znaki.length, znaki.length];
    const koniec = od + wstawiane.length;
    zastosuj(zamienZakres(znaki, od, doo, wstawiane), koniec, koniec);
  }

  function nowaLinia() {
    // Jeden Enter = jeden `\n`. Bez tego Chrome wstawia `<div>`, a Firefox `<br>`
    // i pole zachowywałoby się różnie w zależności od przeglądarki.
    if (document.execCommand("insertLineBreak")) {
      wyslij();
      return;
    }
    const el = pole.current;
    if (!el) return;
    const znaki = domNaZnaki(el);
    const [od, doo] = zaznaczenie() ?? [znaki.length, znaki.length];
    zastosuj(zamienZakres(znaki, od, doo, [{ c: "\n", f: {} }]), od + 1, od + 1);
  }

  function klawisz(e: React.KeyboardEvent<HTMLDivElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "b") return e.preventDefault(), przelacz("b");
      if (k === "i") return e.preventDefault(), przelacz("i");
      if (k === "k") return e.preventDefault(), otworzLink();
      // Podkreślenia strona nie pokazuje, a przeglądarka dodałaby je po cichu.
      if (k === "u") return e.preventDefault();
      if (k === "z" && !e.shiftKey) return e.preventDefault(), przywroc(-1);
      if ((k === "z" && e.shiftKey) || k === "y") return e.preventDefault(), przywroc(1);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      nowaLinia();
    }
  }

  // Słuchacze DOM dostają zawsze najświeższe funkcje — bez przepinania przy każdym renderze.
  const akcje = useRef({ przelacz, przywroc, nowaLinia });
  useEffect(() => {
    akcje.current = { przelacz, przywroc, nowaLinia };
  });

  /**
   * Polecenia spoza klawiatury: „Cofnij" z menu kontekstowego, pogrubienie
   * z menu Safari, Enter z klawiatury telefonu (bez `keydown` z klawiszem)
   * oraz autokorekta jak w Wordzie: „ - " → „ – " i polskie cudzysłowy.
   *
   * Autokorekta na `beforeinput`, nie po fakcie: podmiana wchodzi jako jedno
   * zdarzenie wpisania i nie zostawia dziwnego stanu pośredniego. Półpauza,
   * nie pauza — tak jak w całym serwisie.
   */
  useEffect(() => {
    const el = pole.current;
    if (!el) return;
    const naWpis = (e: InputEvent) => {
      const typ = e.inputType;
      if (typ === "historyUndo" || typ === "historyRedo") {
        e.preventDefault();
        akcje.current.przywroc(typ === "historyUndo" ? -1 : 1);
        return;
      }
      if (typ.startsWith("format")) {
        e.preventDefault();
        if (typ === "formatBold") akcje.current.przelacz("b");
        if (typ === "formatItalic") akcje.current.przelacz("i");
        return;
      }
      if (typ === "insertParagraph") {
        e.preventDefault();
        akcje.current.nowaLinia();
        return;
      }
      if (typ !== "insertText" || !e.data) return;
      const sel = window.getSelection();
      const r = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
      if (!r || !r.collapsed || r.startContainer.nodeType !== 3 || !el.contains(r.startContainer)) return;
      const wezel = r.startContainer;
      const przed = (wezel.nodeValue ?? "").slice(0, r.startOffset);

      if (e.data === '"') {
        e.preventDefault();
        const otwiera = przed === "" || /[\s(\[ ]$/.test(przed);
        document.execCommand("insertText", false, otwiera ? "„" : "”");
      } else if (e.data === " " && /(^|[\s ])-$/.test(przed)) {
        e.preventDefault();
        const myslnik = document.createRange();
        myslnik.setStart(wezel, r.startOffset - 1);
        myslnik.setEnd(wezel, r.startOffset);
        sel?.removeAllRanges();
        sel?.addRange(myslnik);
        document.execCommand("insertText", false, "– ");
      }
    };
    el.addEventListener("beforeinput", naWpis);
    return () => el.removeEventListener("beforeinput", naWpis);
  }, []);

  /** Podświetlenie przycisków jak na wstążce — kursor w pogrubionym linku zapala B i Link. */
  useEffect(() => {
    document.addEventListener("selectionchange", odswiezPrzyciski);
    return () => document.removeEventListener("selectionchange", odswiezPrzyciski);
  }, [odswiezPrzyciski]);

  /**
   * Po wyjściu z pola rysujemy je z odczytu zapisu, jeśli różni się od tego,
   * co widać — np. wpisane ręcznie `**gwiazdki**` stają się pogrubieniem,
   * a gwiazdka w środku pogrubienia je zdejmuje, tak jak zrobi to strona.
   */
  function poWyjsciu() {
    const el = pole.current;
    const tekst = ostatni.current;
    if (!el || tekst === null) return;
    if (!wygladajaTakSamo(domNaZnaki(el), tekstNaZnaki(tekst))) rysuj(tekst);
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <PrzyciskFormatu opis="Pogrubienie (Ctrl+B)" klasy="border-slate-300 font-bold hover:bg-slate-100" onClick={() => przelacz("b")} wcisniety={aktywne.b}>
          B
        </PrzyciskFormatu>
        <PrzyciskFormatu opis="Kursywa (Ctrl+I)" klasy="border-slate-300 font-semibold italic hover:bg-slate-100" onClick={() => przelacz("i")} wcisniety={aktywne.i}>
          I
        </PrzyciskFormatu>
        {zolty && (
          <PrzyciskFormatu
            opis={
              aktywne.link
                ? "Kolor linku: wciśnięty – żółty od razu; zwolniony – w kolorze tekstu, żółknie po najechaniu"
                : "Żółty kolor tekstu – kolor strony"
            }
            klasy="border-yellow-400 bg-yellow-50 font-bold text-yellow-700 hover:bg-yellow-100"
            onClick={() => przelacz("zolty")}
            wcisniety={aktywne.zolty}
          >
            Żółty
          </PrzyciskFormatu>
        )}
        <PrzyciskFormatu opis={aktywne.link ? "Zmień albo usuń link (Ctrl+K)" : "Wstaw link (Ctrl+K)"} klasy="border-indigo-300 bg-indigo-50 font-bold text-indigo-700 hover:bg-indigo-100" onClick={otworzLink} wcisniety={aktywne.link}>
          {aktywne.link ? "Zmień link" : "Link"}
        </PrzyciskFormatu>
        <PrzyciskFormatu opis="Wyczyść formatowanie zaznaczonego tekstu" klasy="border-slate-300 text-slate-600 hover:bg-slate-100" onClick={wyczysc}>
          Wyczyść
        </PrzyciskFormatu>
        {uwaga && (
          <span role="status" className="ml-1 text-sm text-amber-700">
            {uwaga}
          </span>
        )}
      </div>

      <div className="relative">
        <div
          ref={pole}
          id={idPola}
          role="textbox"
          aria-multiline="true"
          aria-label={etykieta}
          aria-describedby={idOpisu}
          contentEditable
          suppressContentEditableWarning
          // Słownik przeglądarki podkreśla literówki — po polsku, jak w Wordzie.
          spellCheck
          lang="pl"
          onInput={wyslij}
          onKeyDown={klawisz}
          onPaste={wklej}
          onBlur={poWyjsciu}
          onDrop={(e) => e.preventDefault()}
          // `pre-wrap`: spacje i Entery są dokładnie tym, co wpisał klient,
          // a twarde spacje z bazy (5 bloków je ma) przeżywają edycję.
          //
          // Kolory jak na stronie, przełożone na jasne tło panelu: żółte tło =
          // na stronie żółte (wyróżnienie albo żółty link), podkreślenie = link.
          // Link „bez koloru" ma samo podkreślenie — na stronie żółknie dopiero
          // po najechaniu.
          className={`${KLASY_KONTROLKI} min-h-[6.5rem] cursor-text whitespace-pre-wrap break-words leading-relaxed
            [&_a]:rounded-sm [&_a]:bg-yellow-100 [&_a]:text-yellow-900 [&_a]:underline [&_a]:decoration-yellow-600 [&_a]:decoration-2 [&_a]:underline-offset-2
            [&_a[data-bez-koloru]]:bg-transparent [&_a[data-bez-koloru]]:text-slate-900 [&_a[data-bez-koloru]]:decoration-slate-400
            [&_b]:font-bold [&_strong]:font-bold [&_em]:italic [&_i]:italic
            [&_mark]:rounded-sm [&_mark]:bg-yellow-100 [&_mark]:px-0.5 [&_mark]:text-yellow-900`}
        />
        {pusty && (
          <span aria-hidden className="pointer-events-none absolute left-3.5 top-2.5 text-base text-slate-400">
            {podpowiedz}
          </span>
        )}
      </div>

      {okno && <OknoLinku poczatek={okno} wyborKoloru={zolty} onZamknij={zamknijOkno} />}
    </div>
  );
}

/** Przycisk paska formatowania. */
function PrzyciskFormatu({
  opis,
  klasy,
  onClick,
  wcisniety,
  children,
}: {
  opis: string;
  klasy: string;
  onClick: () => void;
  wcisniety?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // `mousedown` bez domyślnej akcji: inaczej klik w przycisk zabiera focus
      // z pola i zaznaczenie, które klient właśnie zrobił, znika.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      title={opis}
      aria-label={opis}
      aria-pressed={wcisniety}
      className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${klasy} ${
        wcisniety ? "ring-2 ring-indigo-400 ring-offset-1" : ""
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Okno linku. Adres przechodzi przez `poprawAdres`, który dopisuje brakujący
 * ukośnik albo `https://` i odrzuca `javascript:`. Wybór strony z listy
 * dochodzi w następnym kroku.
 */
function OknoLinku({
  poczatek,
  wyborKoloru,
  onZamknij,
}: {
  poczatek: Okno;
  wyborKoloru: boolean;
  onZamknij: (wynik: { tekst: string; adres: string; zolty: boolean } | "usun" | null) => void;
}) {
  const [tekst, setTekst] = useState(poczatek.tekst);
  const [adres, setAdres] = useState(poczatek.adres);
  const [zolty, setZolty] = useState(poczatek.zolty);
  const [blad, setBlad] = useState<string | null>(null);
  const idTytulu = useId();
  const idTekstu = useId();
  const idAdresu = useId();

  // Escape na oknie przeglądarki, nie na kontenerze — patrz `DialogPotwierdzenia`.
  useEffect(() => {
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key === "Escape") onZamknij(null);
    };
    window.addEventListener("keydown", naKlawisz);
    return () => window.removeEventListener("keydown", naKlawisz);
  }, [onZamknij]);

  function zatwierdz(e: React.FormEvent) {
    e.preventDefault();
    const t = tekst.replace(/[[\]]/g, "").replace(/\s+/g, " ").trim();
    if (!t) return setBlad("Wpisz tekst, który ma być klikalny.");
    const a = poprawAdres(adres);
    if (!a) return setBlad("Ten adres nie zadziała. Wpisz np. /zajecia/cennik albo https://…");
    onZamknij({ tekst: t, adres: a, zolty });
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => onZamknij(null)} />
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTytulu}
        onSubmit={zatwierdz}
        className="relative w-full max-w-[38rem] space-y-4 rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
      >
        <h2 id={idTytulu} className="text-xl font-bold">
          {poczatek.istniejacy ? "Zmień link" : "Wstaw link"}
        </h2>
        <div>
          <label htmlFor={idTekstu} className="mb-1.5 block text-base font-semibold">
            Tekst linku
          </label>
          <input
            id={idTekstu}
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            autoFocus={!poczatek.tekst}
            className={KLASY_KONTROLKI}
          />
        </div>
        <div>
          <label htmlFor={idAdresu} className="mb-1.5 block text-base font-semibold">
            Adres
          </label>
          <input
            id={idAdresu}
            value={adres}
            onChange={(e) => setAdres(e.target.value)}
            autoFocus={!!poczatek.tekst}
            placeholder="/zajecia/cennik albo https://…"
            className={KLASY_KONTROLKI}
          />
          <p className="mt-1.5 text-sm text-slate-500">
            Strona klubu: adres po domenie, np. /zajecia/cennik. Inna strona: cały adres
            z https://. Można też wpisać adres e-mail.
          </p>
        </div>
        {wyborKoloru && (
          <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <input
              type="checkbox"
              checked={zolty}
              onChange={(e) => setZolty(e.target.checked)}
              className="mt-1 h-4 w-4 accent-yellow-500"
            />
            <span>
              <span className="block text-base font-semibold">Żółty od razu</span>
              <span className="block text-sm text-slate-500">
                Tak wyglądają linki na stronie. Bez zaznaczenia link ma kolor tekstu
                i żółknie dopiero po najechaniu myszką.
              </span>
            </span>
          </label>
        )}
        {blad && <p className="text-sm text-red-600">{blad}</p>}
        <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
          {poczatek.istniejacy && (
            <button
              type="button"
              onClick={() => onZamknij("usun")}
              className="mr-auto rounded-lg border border-red-300 px-4 py-2.5 text-base text-red-600 hover:bg-red-50"
            >
              Usuń link
            </button>
          )}
          <button
            type="button"
            onClick={() => onZamknij(null)}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50"
          >
            Anuluj
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-5 py-2.5 text-base font-semibold text-white hover:bg-indigo-700"
          >
            {poczatek.istniejacy ? "Zapisz link" : "Wstaw link"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
