import Link from "next/link";
import type { ComponentProps } from "react";

/**
 * Link wewnętrzny BEZ pobierania stron z wyprzedzeniem (prefetch).
 *
 * DLACZEGO NIE GOŁY `next/link`
 * -----------------------------
 * Next domyślnie pobiera w tle każdą stronę, do której link widać na ekranie:
 * menu, stopka i kafelki to na stronie głównej ~31 zapytań na wejście. Na
 * Netlify każde takie zapytanie to osobny wpis w cache CDN (klucz zależy od
 * strony, z której przyszło), a przy małym ruchu wpis jest zwykle
 * przeterminowany — CDN oddaje kopię i w tle odpala funkcję po świeżą.
 * Zmierzone 2026-10-12: ~3 500 wywołań funkcji dziennie przy ~100 wizytach,
 * czyli ~32 na wizytę, przy limicie planu Free 125 000 na miesiąc. Po
 * przekroczeniu Netlify wyłącza WSZYSTKIE projekty zespołu do 1. dnia
 * kolejnego miesiąca.
 *
 * Skutek dla odwiedzającego: po kliknięciu strona dociąga się w chwili
 * kliknięcia (ułamek sekundy), a nie z góry.
 *
 * `prefetch={false}` w Next 16 wyłącza pobieranie i po wejściu w ekran, i po
 * najechaniu (node_modules/next/dist/client/app-dir/link.js: `prefetchEnabled`).
 * Reguła `no-restricted-imports` w eslint.config.mjs pilnuje, żeby nowy kod
 * nie wrócił do gołego `next/link`.
 */
export default function Odnosnik(props: ComponentProps<typeof Link>) {
  return <Link prefetch={false} {...props} />;
}
