"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Komunikat po zapisie — jeden dla całego panelu.
 *
 * DLACZEGO OSOBNY KOMPONENT
 * -------------------------
 * Każdy ekran panelu miał własny komunikat inline, tuż pod formularzem. Przy
 * dłuższej liście (drzewo stron ma dziś ponad dwadzieścia pozycji) redaktor
 * klikał przycisk w dolnej części ekranu i musiał przewijać w górę, żeby się
 * dowiedzieć, czy panel w ogóle odpowiedział — więc odmowy wyglądały jak brak
 * reakcji. Zgłoszone dosłownie: „komunikaty w dupie się wyświetlają".
 *
 * Do tego każdy ekran robił to inaczej (emerald/rose kontra green/red, raz
 * z ramką, raz bez), a to samo działanie ma wyglądać tak samo wszędzie.
 *
 * SUKCESY GASNĄ, BŁĘDY ZOSTAJĄ — decyzja właściciela z 2026-09-07. Nie
 * symetrycznie, bo komunikat odmowy bywa dwuzdaniowy (np. ten o trzecim
 * poziomie i kafelkach) i gdyby gasł po kilku sekundach, redaktor zdążyłby
 * przeczytać połowę.
 */
export type StanKomunikatu = { ok: boolean; text: string; nr: number } | null;

/**
 * Numer komunikatu jest częścią stanu, nie ozdobą: bez niego nie da się
 * odróżnić „ten sam komunikat wciąż wisi" od „przyszedł nowy o tej samej
 * treści". Dwa przesunięcia z rzędu dają dwa razy „Przesunięte niżej.",
 * a testy odbioru w Poligon/ czekają właśnie na ZMIANĘ numeru — czekanie na
 * obecność napisu przechodziłoby od razu na poprzednim toaście.
 */
export function useKomunikat() {
  const [msg, setMsg] = useState<StanKomunikatu>(null);
  const nr = useRef(0);

  /**
   * Stabilne referencje — to nie kosmetyka. Ekrany plików, zdjęć i kosza
   * wkładają takie funkcje do zależności `useCallback`, a te trafiają dalej
   * do `useEffect` wczytującego listę. Funkcja tworzona na nowo przy każdym
   * renderze zapętliłaby to wczytywanie: cichy błąd czasu wykonania, który
   * przechodzi i `tsc`, i build.
   */
  const pokaz = useCallback((ok: boolean, text: string) => {
    nr.current += 1;
    setMsg({ ok, text, nr: nr.current });
  }, []);
  const wyczysc = useCallback(() => setMsg(null), []);

  /**
   * Zgodność z ekranami, które wołały `setMsg({ ok, text })` — a jest ich
   * kilkanaście, część w wywołaniach wielolinijkowych. Adapter siedzi TUTAJ,
   * a nie w każdym pliku osobno, właśnie dlatego, że musi mieć stabilną
   * referencję: w ekranie plików taka funkcja wchodzi do zależności
   * `useCallback`, a stamtąd do `useEffect` wczytującego listę.
   */
  const ustaw = useCallback(
    (m: { ok: boolean; text: string } | null) => (m === null ? wyczysc() : pokaz(m.ok, m.text)),
    [pokaz, wyczysc],
  );

  useEffect(() => {
    if (!msg?.ok) return;
    const licznik = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(licznik);
  }, [msg]);

  return { msg, pokaz, wyczysc, ustaw };
}

export default function Komunikat({
  msg,
  onZamknij,
}: {
  msg: StanKomunikatu;
  onZamknij: () => void;
}) {
  if (!msg) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 w-[min(24rem,calc(100vw-2.5rem))]">
      <div
        // `status` dla sukcesu, `alert` dla błędu: czytnik ekranu przerywa
        // tylko przy błędzie. Bez tego redaktor korzystający z czytnika klikał
        // i nie dowiadywał się, czy cokolwiek się stało.
        role={msg.ok ? "status" : "alert"}
        data-komunikat={msg.ok ? "ok" : "blad"}
        data-komunikat-nr={msg.nr}
        className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${
          msg.ok
            ? "text-emerald-900 bg-emerald-50 border-emerald-300"
            : "text-rose-900 bg-rose-50 border-rose-300"
        }`}
      >
        <span className="flex-1">{msg.text}</span>
        {!msg.ok && (
          <button
            type="button"
            onClick={onZamknij}
            aria-label="Zamknij komunikat"
            className="shrink-0 -mr-1 -mt-0.5 rounded px-1.5 text-lg leading-none text-rose-700 hover:bg-rose-100"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
