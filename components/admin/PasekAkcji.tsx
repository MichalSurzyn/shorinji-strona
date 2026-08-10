"use client";

import Link from "next/link";

/**
 * Pasek akcji edytora, przyklejony do góry ekranu.
 *
 * Przyciski „Zapisz" i plakietka „Niezapisane zmiany" byly dotad na samej
 * gorze strony. Przy dluzszej tresci redaktor edytowal element na dole,
 * nie widzial ani stanu zapisu, ani przycisku, i musial przewijac w gore
 * po kazdej zmianie. Zglaszal nawet, ze panel „nie wykrywa zmian tekstu" -
 * wykrywal, tylko plakietka byla poza ekranem.
 *
 * Ten sam uklad we wszystkich edytorach: po lewej co edytujesz, po prawej
 * co mozesz z tym zrobic.
 */
export default function PasekAkcji({
  powrotHref,
  powrotEtykieta = "← Wszystkie strony",
  tytul,
  opis,
  zmieniono,
  busy,
  podglad,
  onZapisz,
  etykietaZapisu = "Zapisz zmiany",
  dodatkowe,
}: {
  powrotHref?: string;
  powrotEtykieta?: string;
  tytul: string;
  opis?: string;
  zmieniono: boolean;
  busy: boolean;
  /** Adres publicznej wersji strony. Pominięty = brak przycisku podglądu. */
  podglad?: string;
  onZapisz: () => void;
  etykietaZapisu?: string;
  /** Miejsce na przyciski specyficzne dla edytora, np. „Usuń”. */
  dodatkowe?: React.ReactNode;
}) {
  return (
    <div
      /* -mx-* wyrównuje pasek do krawędzi kolumny panelu, żeby tło zakrywało
         przewijaną treść na całej szerokości. */
      className="sticky top-0 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 mb-5
                 bg-slate-50/95 backdrop-blur border-b border-slate-200"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {powrotHref && (
            <Link
              href={powrotHref}
              className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
            >
              {powrotEtykieta}
            </Link>
          )}
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 truncate">{tytul}</h1>
          {opis && <p className="text-sm text-slate-500 truncate max-w-2xl">{opis}</p>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {zmieniono && !busy && (
            <span
              role="status"
              className="rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-medium whitespace-nowrap"
            >
              Niezapisane zmiany
            </span>
          )}
          {dodatkowe}
          {podglad && (
            <a
              href={podglad}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Zobacz zapisaną wersję ↗
            </a>
          )}
          <button
            onClick={onZapisz}
            disabled={busy}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold transition-colors whitespace-nowrap"
          >
            {busy ? "Zapisywanie..." : etykietaZapisu}
          </button>
        </div>
      </div>
    </div>
  );
}
