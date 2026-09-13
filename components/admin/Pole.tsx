"use client";

import { useId } from "react";

/**
 * Jedno pole formularza: ETYKIETA → KONTROLKA → OPIS.
 *
 * DLACZEGO AKURAT W TEJ KOLEJNOŚCI
 * --------------------------------
 * Edytory panelu miały dotąd jeden szary napis nad polem, w którym siedziało
 * wszystko naraz: nazwa pola i wyjaśnienie w nawiasie, tą samą wielkością
 * liter — „Wstęp — pokazuje się pod tytułem ORAZ na kafelku u strony
 * nadrzędnej". Przy sześciu polach pod rząd nie dało się wzrokiem znaleźć,
 * gdzie jest TYTUŁ: nazwa pola tonęła w objaśnieniu.
 *
 * Zgłoszenie właściciela: „daj boldem i większą czcionką co to za pole np
 * TYTUŁ, potem samo pole a niżej krótki opis czyli to co w nawiasach jest,
 * mniejszą czcionką, może być też inny kolor np taki neutralny że to
 * komentarz. WIĘKSZE PADDINGI".
 *
 * Opis idzie POD kontrolkę świadomie — to przypis do tego, co się wpisało,
 * a nie warunek wstępny. Nad polem czytelnik szuka nazwy i tylko nazwy.
 */

/**
 * Wygląd samej kontrolki trzymamy w jednej stałej, żeby input i textarea nie
 * rozjechały się przy pierwszej poprawce. `py-2.5` zamiast dawnego `py-2`
 * i `text-base` zamiast `text-sm` to są właśnie „większe paddingi".
 */
export const KLASY_KONTROLKI =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 " +
  "placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500";

/**
 * Opakowanie dla kontrolki, której nie obsługują `PoleTekst` /
 * `PoleWieloliniowe` — select, przełącznik, wybór pliku, cokolwiek.
 *
 * Odstępów na zewnątrz (marginesów) komponent NIE dokłada: rytm listy pól
 * ustala kontener, zwykle przez `space-y-*`. Własny `mb-*` tutaj podwajałby
 * się z tamtym i każdy formularz wyglądałby inaczej.
 */
export function Pole({
  etykieta,
  opis,
  htmlFor,
  children,
}: {
  etykieta: string;
  opis?: string;
  /**
   * Id kontrolki w środku. Podany — etykieta staje się prawdziwym `<label>`
   * (klik w napis ustawia focus w polu), a opis dostaje id `${htmlFor}-opis`,
   * które trzeba wpiąć w `aria-describedby` swojej kontrolki. Bez tego id
   * czytnik ekranu przeczyta nazwę pola i nie przeczyta wyjaśnienia.
   */
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const idOpisu = htmlFor ? `${htmlFor}-opis` : undefined;

  return (
    <div>
      {/* Bez `htmlFor` nie robimy `<label>`: etykieta niezwiązana z żadną
          kontrolką myli czytniki ekranu bardziej, niż pomaga. */}
      {htmlFor ? (
        <label htmlFor={htmlFor} className="mb-1.5 block text-base font-semibold text-slate-900">
          {etykieta}
        </label>
      ) : (
        <span className="mb-1.5 block text-base font-semibold text-slate-900">{etykieta}</span>
      )}

      {children}

      {opis && (
        <p id={idOpisu} className="mt-1.5 text-sm leading-snug text-slate-500">
          {opis}
        </p>
      )}
    </div>
  );
}

/** Wspólne dla obu gotowych pól — reszta propsów leci prosto na element. */
type PropsWspolne = {
  etykieta: string;
  opis?: string;
};

export function PoleTekst({
  etykieta,
  opis,
  id,
  className,
  type = "text",
  ...reszta
}: PropsWspolne & React.InputHTMLAttributes<HTMLInputElement>) {
  // `useId` zamiast licznika czy nazwy pola: dwa formularze na jednym ekranie
  // (np. edytor bloku i panel boczny) miałyby inaczej zduplikowane id,
  // a wtedy klik w etykietę ustawia focus w cudzym polu.
  const wygenerowane = useId();
  const idPola = id ?? wygenerowane;
  const idOpisu = opis ? `${idPola}-opis` : undefined;

  return (
    <Pole etykieta={etykieta} opis={opis} htmlFor={idPola}>
      <input
        {...reszta}
        id={idPola}
        type={type}
        // Opis wpięty ręcznie, bo `Pole` tylko wystawia id — składamy go
        // z ewentualnym `aria-describedby` od wołającego, zamiast nadpisywać.
        aria-describedby={[reszta["aria-describedby"], idOpisu].filter(Boolean).join(" ") || undefined}
        className={[KLASY_KONTROLKI, className].filter(Boolean).join(" ")}
      />
    </Pole>
  );
}

export function PoleWieloliniowe({
  etykieta,
  opis,
  id,
  className,
  rows = 4,
  ...reszta
}: PropsWspolne & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const wygenerowane = useId();
  const idPola = id ?? wygenerowane;
  const idOpisu = opis ? `${idPola}-opis` : undefined;

  return (
    <Pole etykieta={etykieta} opis={opis} htmlFor={idPola}>
      <textarea
        {...reszta}
        id={idPola}
        rows={rows}
        aria-describedby={[reszta["aria-describedby"], idOpisu].filter(Boolean).join(" ") || undefined}
        className={[KLASY_KONTROLKI, className].filter(Boolean).join(" ")}
      />
    </Pole>
  );
}
