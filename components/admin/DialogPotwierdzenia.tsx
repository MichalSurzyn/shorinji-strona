"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Własne okno potwierdzenia — zamiennik `window.confirm` jeden do jednego.
 *
 * DLACZEGO
 * --------
 * Panel pyta o potwierdzenie kilkunastu rzeczy (kosz, usunięcie na zawsze,
 * zamiana rodzaju pozycji, porzucenie niezapisanych zmian), a pytania bywają
 * wielozdaniowe — „Przenieść X do kosza? Razem z nią: …". Natywny `confirm`
 * pokazuje to systemową czcionką ~12 px, bez akapitów, i redaktor czyta
 * z niego tylko pierwszą linijkę. Zgłoszenie właściciela: „czy dało by się
 * większą czcionkę w nim, żeby był czytelniejszy? […] może napiszmy jeden
 * komponent na takie komunikaty i go zawsze używajmy".
 *
 * Drugi, cichszy powód: `window.confirm` blokuje wątek przeglądarki, więc
 * wszystko, co akurat leci w tle (autozapis, odświeżenie listy), staje aż do
 * kliknięcia. Ten dialog jest zwykłym stanem Reacta i niczego nie zamraża.
 *
 * PODMIANA MA BYĆ MECHANICZNA. Dlatego `potwierdz` zwraca `Promise<boolean>`
 * i wchodzi dokładnie tam, gdzie stało `confirm(...)`:
 *
 *     const { potwierdz, element } = usePotwierdzenie();
 *     …
 *     if (!(await potwierdz({ tytul: "Do kosza?", tresc: linie.join("\n") }))) return;
 *     …
 *     return (<> … {element} </>);
 */
export type OpcjePotwierdzenia = {
  /** Jedno zdanie pytania — to, co redaktor przeczyta na pewno. */
  tytul: string;
  /** Skutki. Może być wielolinijkowa — złamania zostają (`whitespace-pre-line`). */
  tresc: string;
  potwierdzEtykieta?: string;
  anulujEtykieta?: string;
  /** `usuwanie` = czerwony przycisk potwierdzenia, dla rzeczy nieodwracalnych. */
  wariant?: "zwykly" | "usuwanie";
};

export function usePotwierdzenie() {
  const [pytanie, setPytanie] = useState<OpcjePotwierdzenia | null>(null);

  /**
   * `resolve` obietnicy trzymamy w ref, nie w stanie: gdyby siedział w stanie,
   * jego podmiana wymuszałaby dodatkowy render, a dialog i tak musi być
   * rozstrzygnięty dokładnie raz. Ref daje też pewność, że przy odmontowaniu
   * mamy do czego sięgnąć — bez tego `await potwierdz(...)` wisiałby wiecznie
   * i kod wołający nigdy nie wróciłby z funkcji.
   */
  const rozstrzygnijRef = useRef<((wynik: boolean) => void) | null>(null);

  const potwierdz = useCallback((opcje: OpcjePotwierdzenia) => {
    // Drugie pytanie przed odpowiedzią na pierwsze (dwuklik w „Usuń")
    // zamyka poprzednie odmową, zamiast zostawiać wiszącą obietnicę.
    rozstrzygnijRef.current?.(false);
    setPytanie(opcje);
    return new Promise<boolean>((resolve) => {
      rozstrzygnijRef.current = resolve;
    });
  }, []);

  const zamknij = useCallback((wynik: boolean) => {
    rozstrzygnijRef.current?.(wynik);
    rozstrzygnijRef.current = null;
    setPytanie(null);
  }, []);

  // Ekran zniknął z pytaniem na wierzchu (nawigacja w panelu) — traktujemy to
  // jak „Anuluj", żeby `await` po drugiej stronie nie został bez odpowiedzi.
  useEffect(
    () => () => {
      rozstrzygnijRef.current?.(false);
      rozstrzygnijRef.current = null;
    },
    [],
  );

  const element = pytanie ? <Karta pytanie={pytanie} onZamknij={zamknij} /> : null;

  return { potwierdz, element };
}

/**
 * Stos otwartych kart, od najstarszej do tej na wierzchu.
 *
 * Escape łapiemy na poziomie dokumentu (patrz efekt w `Karta`), więc gdyby
 * otwarte były dwa dialogi naraz — pytanie o porzucenie zmian nad pytaniem
 * o kosz — jedno naciśnięcie zamknęłoby OBA, a każde z nich rozstrzygnęłoby
 * swoją obietnicę odmową. Redaktor zobaczyłby, jak z jednego Escape znika cała
 * kolejka pytań. Nasłuch odzywa się więc tylko wtedy, gdy to jego karta jest
 * ostatnia na stosie.
 */
const otwarteKarty: object[] = [];

/**
 * Karta jest montowana dopiero z pytaniem i odmontowywana po odpowiedzi.
 * To nie kosmetyka: dzięki temu efekty od blokady przewijania i od
 * przywrócenia focusu mają naturalny cykl życia (montaż = otwarcie,
 * sprzątanie = zamknięcie) i nie trzeba ich pilnować warunkami.
 */
function Karta({
  pytanie,
  onZamknij,
}: {
  pytanie: OpcjePotwierdzenia;
  onZamknij: (wynik: boolean) => void;
}) {
  const idTytulu = useId();
  const idTresci = useId();
  const kartaRef = useRef<HTMLDivElement | null>(null);
  const potwierdzRef = useRef<HTMLButtonElement | null>(null);

  const usuwanie = pytanie.wariant === "usuwanie";

  useEffect(() => {
    // Kto pytał, do tego wracamy. Bez tego po zamknięciu focus siada na
    // <body> i klawiatura zaczyna zwiedzanie panelu od początku.
    const wracamyDo = document.activeElement as HTMLElement | null;
    potwierdzRef.current?.focus();

    // Blokada przewijania tła: bez niej kółko myszy przewija listę stron pod
    // spodem, a nie kartę, i wygląda to jakby dialog się zawiesił.
    const poprzedniOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = poprzedniOverflow;
      wracamyDo?.focus?.();
    };
  }, []);

  /**
   * Escape na DOKUMENCIE, nie na kontenerze portalu.
   *
   * Uchwyt `onKeyDown` kontenera widzi wyłącznie zdarzenia, których cel leży
   * wewnątrz dialogu. Karta nie ma `tabIndex`, więc wystarczy, że redaktor
   * przeciągnie myszą po liście podstron w pytaniu „Przenieść do kosza?" —
   * focus ląduje na `<body>`, klawisz idzie bokiem i Escape przestaje działać.
   * Pomiar playwrightem to potwierdził. A `window.confirm`, który ten dialog
   * zastąpił, zamykał się Escapem ZAWSZE — więc odruch jest wyuczony i musi
   * działać bez względu na to, gdzie stoi focus.
   *
   * Nasłuch żyje tylko tyle, co karta (montaż = otwarcie pytania), więc po
   * zamknięciu nie ma czego łapać. Bez `stopPropagation`: chmurka podpowiedzi
   * nasłuchuje Escape na `window`, czyli piętro wyżej, i ma prawo zgasnąć
   * razem z otwarciem dialogu.
   */
  useEffect(() => {
    const znacznik = {};
    otwarteKarty.push(znacznik);

    const naKlawiszDokumentu = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (otwarteKarty[otwarteKarty.length - 1] !== znacznik) return;
      e.preventDefault();
      onZamknij(false);
    };

    document.addEventListener("keydown", naKlawiszDokumentu);
    return () => {
      document.removeEventListener("keydown", naKlawiszDokumentu);
      const pozycja = otwarteKarty.indexOf(znacznik);
      if (pozycja !== -1) otwarteKarty.splice(pozycja, 1);
    };
  }, [onZamknij]);

  /**
   * Enter zostaje przy kontenerze — celowo. Gdyby i on wisiał na dokumencie,
   * naciśnięcie Enter z focusem na `<body>` (czyli po zaznaczeniu tekstu myszą)
   * potwierdzałoby pytanie o nieodwracalne „Usuń na zawsze" bez żadnego
   * świadomego kliknięcia. Escape gasi dialog bezpiecznie, Enter nie.
   */
  const naKlawisz = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter") {
      // Gdy focus stoi na przycisku, Enter i tak go kliknie — nasza obsługa
      // zrobiłaby z „Anuluj" potwierdzenie, czyli dokładnie odwrotność.
      if ((e.target as HTMLElement).tagName === "BUTTON") return;
      e.preventDefault();
      onZamknij(true);
      return;
    }

    if (e.key === "Tab") {
      // Pułapka na focus. Dialog przykrywa panel, więc tabulator wychodzący
      // poza kartę prowadziłby po niewidocznych kontrolkach pod spodem.
      const fokusowalne = kartaRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!fokusowalne || fokusowalne.length === 0) return;
      const pierwszy = fokusowalne[0];
      const ostatni = fokusowalne[fokusowalne.length - 1];
      if (e.shiftKey && document.activeElement === pierwszy) {
        e.preventDefault();
        ostatni.focus();
      } else if (!e.shiftKey && document.activeElement === ostatni) {
        e.preventDefault();
        pierwszy.focus();
      }
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    // Portal do `document.body`, bo `element` bywa renderowany wewnątrz
    // przewijanych kart edytora — `position: fixed` potrafi tam zostać
    // przypięte do przodka z `transform` i karta wylądowałaby w połowie ekranu.
    <div
      data-dialog-potwierdzenia=""
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onKeyDown={naKlawisz}
    >
      <div className="absolute inset-0 bg-black/50" onClick={() => onZamknij(false)} />

      <div
        ref={kartaRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTytulu}
        aria-describedby={idTresci}
        className="relative w-full max-w-[38rem] rounded-2xl bg-white p-6 text-slate-900 shadow-2xl"
      >
        <h2 id={idTytulu} className="text-xl font-bold">
          {pytanie.tytul}
        </h2>

        {/* `whitespace-pre-line`, bo kod wołający składa treść z linii
            (`linie.join("\n")`) dokładnie tak, jak robił to dla `confirm`. */}
        <p id={idTresci} className="mt-3 whitespace-pre-line text-base leading-relaxed text-slate-700">
          {pytanie.tresc}
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => onZamknij(false)}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            {pytanie.anulujEtykieta ?? "Anuluj"}
          </button>
          <button
            ref={potwierdzRef}
            type="button"
            onClick={() => onZamknij(true)}
            className={`rounded-lg px-5 py-2.5 text-base font-semibold text-white transition-colors ${
              usuwanie ? "bg-red-600 hover:bg-red-700" : "bg-indigo-600 hover:bg-indigo-700"
            }`}
          >
            {pytanie.potwierdzEtykieta ?? "Tak, zrób to"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
