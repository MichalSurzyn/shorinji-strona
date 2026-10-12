import Link from "@/components/Odnosnik";

/**
 * „W tej sekcji" — przyklejona lista stron z tego samego poziomu, po prawej,
 * na szerokich ekranach (od xl, 1280 px).
 *
 * Decyzja właściciela po pomiarze (2026-10-12): kolumna treści ma celowo ~77 znaków
 * w linii (górna granica wygodnego czytania), więc na szerokim ekranie ok. 1/3
 * kontenera po prawej stała pusta. Zamiast poszerzać tekst — mapa sekcji, czyli
 * to, o co prosił przy czwartym poziomie: szybkie przechodzenie między technikami
 * jednego stopnia (docelowo ~40). Wygląd jak „Na tej stronie" w ArticlePage.
 *
 * Poniżej xl lista znika — zostają okruszki i „← / →" nad tytułem.
 */
export default function ListaSekcji({
  rodzic,
  strony,
}: {
  rodzic: { title: string; href: string | null };
  strony: { href: string; title: string; biezaca: boolean }[];
}) {
  return (
    <aside className="hidden xl:block">
      {/* Przyklejona pod menu (`--nav-h` mierzy navbar na żywo), z własnym
          przewijaniem — 40 technik nie zmieści się w oknie. */}
      <nav
        aria-label="W tej sekcji"
        data-lista-sekcji
        className="sticky top-[calc(var(--nav-h)+1.5rem)] max-h-[calc(100vh-var(--nav-h)-3rem)] overflow-y-auto pb-4"
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.16em] text-yellow-500">W tej sekcji</p>
        {rodzic.href ? (
          <Link href={rodzic.href} className="mb-4 block text-sm font-semibold text-neutral-200 transition-colors hover:text-yellow-500">
            {rodzic.title}
          </Link>
        ) : (
          <p className="mb-4 text-sm font-semibold text-neutral-200">{rodzic.title}</p>
        )}
        <ul className="space-y-1 border-l border-yellow-500/30 text-sm">
          {strony.map((s) => (
            <li key={s.href}>
              {s.biezaca ? (
                <span
                  aria-current="page"
                  className="-ml-px block border-l-2 border-yellow-500 py-1 pl-4 font-medium text-yellow-500"
                >
                  {s.title}
                </span>
              ) : (
                <Link
                  href={s.href}
                  className="-ml-px block border-l-2 border-transparent py-1 pl-4 text-neutral-400 transition-colors hover:border-yellow-500 hover:text-yellow-500"
                >
                  {s.title}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
