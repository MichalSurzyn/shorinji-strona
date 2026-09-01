import Link from "next/link";

/**
 * Strona-hub z kafelkami podstron.
 *
 * Przyjmuje ZNORMALIZOWANY kształt, a nie `ArticleGroup` z `data/articles`.
 * Powód: od etapu 6 te same kafelki składa się z dwóch źródeł — z drzewa
 * `pages` (normalnie) i z treści bazowej w kodzie (gdy baza milczy). Gdyby
 * komponent znał tylko jedno z nich, drugie źródło wymagałoby drugiego
 * renderera, a dwa renderery nad jednym widokiem rozjeżdżają się po cichu.
 */

export interface KafelekListingu {
  href: string;
  title: string;
  intro?: string | null;
}

type Props = {
  title: string;
  intro?: string | null;
  kicker?: string | null;
  items: KafelekListingu[];
};

export default function ArticleListing({ title, intro, kicker, items }: Props) {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">

        {/* Nagłówek sekcji */}
        <header className="mb-12">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            {kicker ?? "Shorinji Kempo"}
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{title}</h1>
          {intro && <p className="text-neutral-300 text-lg max-w-3xl">{intro}</p>}
        </header>

        {/* Kafelki */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((a, idx) => (
            <Link
              key={a.href}
              href={a.href}
              className="group flex flex-col rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors p-6"
            >
              <div className="text-xs uppercase tracking-[0.14em] text-yellow-500/80 group-hover:text-yellow-500 font-semibold mb-3">
                {String(idx + 1).padStart(2, "0")}
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 tracking-wide">
                {a.title}
              </h2>
              {a.intro && (
                <p className="text-sm text-neutral-400 leading-relaxed flex-1">{a.intro}</p>
              )}
              <div className="mt-5 text-xs uppercase tracking-wider text-yellow-500 group-hover:text-yellow-400 transition-colors">
                Czytaj →
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
