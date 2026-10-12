import Link from "@/components/Odnosnik";

export type SasiedniaStrona = { href: string; title: string };

/**
 * „Gdzie jesteś" na górze strony z drzewa: ścieżka do strony głównej
 * i przejście do poprzedniej / następnej strony na tym samym poziomie.
 *
 * Zgłoszenie właściciela przy czwartym poziomie: „mapa do przechodzenia między
 * tymi stronami, jak ich nie ma w menu (…) żeby szybko się cofać i przechodzić".
 * Stopnie i techniki są poza menu, a docelowo ma być ~40 technik na stopień —
 * bez tego jedyną drogą z techniki do następnej był powrót na stronę stopnia.
 *
 * Człon bez adresu (nagłówek grupujący, np. „Zajęcia") jest samym podpisem:
 * nagłówek publicznie nie ma strony, a link przerzucałby na jego pierwszą
 * podstronę — czyli prowadziłby gdzie indziej, niż mówi napis.
 */
export default function Okruszki({
  przodkowie,
  tytul,
  poprzednia,
  nastepna,
}: {
  przodkowie: { title: string; href: string | null }[];
  tytul: string;
  poprzednia?: SasiedniaStrona;
  nastepna?: SasiedniaStrona;
}) {
  const czlony = [{ title: "Strona główna", href: "/" as string | null }, ...przodkowie];
  return (
    // `max-w-4xl` — szerokość kolumny treści. Bez niej „Następna →" stawała przy
    // prawej krawędzi kontenera (~1260 px), daleko od tekstu, którego dotyczy.
    // Odstępy z pierwszego przeklikania właściciela: ścieżka i „← / →" zlewały
    // się w jeden szary blok, a cały pasek kleił się do tytułu.
    <nav aria-label="Gdzie jesteś" className="mb-12 max-w-4xl text-sm" data-okruszki>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-neutral-400">
        {czlony.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {c.href ? (
              <Link href={c.href} className="transition-colors hover:text-yellow-500">
                {c.title}
              </Link>
            ) : (
              <span>{c.title}</span>
            )}
            <span aria-hidden="true" className="text-neutral-600">
              ›
            </span>
          </li>
        ))}
        <li aria-current="page" className="text-neutral-200">
          {tytul}
        </li>
      </ol>
      {(poprzednia || nastepna) && (
        // Osobny rząd z cienką linią i większym pismem: to inna czynność niż
        // ścieżka (przejście w bok, nie w górę). Pole kliknięcia `py-2 px-3`
        // z ujemnym marginesem — tekst stoi w linii z resztą, a palec na
        // telefonie ma w co trafić.
        <div className="mt-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-neutral-800 pt-3 text-base">
          {poprzednia ? (
            <Link
              href={poprzednia.href}
              rel="prev"
              className="-mx-3 rounded-md px-3 py-2 text-neutral-300 transition-colors hover:bg-white/5 hover:text-yellow-500"
            >
              <span aria-hidden="true">← </span>
              <span className="sr-only">Poprzednia: </span>
              {poprzednia.title}
            </Link>
          ) : (
            <span />
          )}
          {nastepna && (
            <Link
              href={nastepna.href}
              rel="next"
              className="-mx-3 rounded-md px-3 py-2 text-right text-neutral-300 transition-colors hover:bg-white/5 hover:text-yellow-500"
            >
              <span className="sr-only">Następna: </span>
              {nastepna.title}
              <span aria-hidden="true"> →</span>
            </Link>
          )}
        </div>
      )}
    </nav>
  );
}
