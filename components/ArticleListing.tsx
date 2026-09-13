import KafelkiPodstron from "./KafelkiPodstron";

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

        {/* Kafelki — wspólny renderer, ten sam co w trasie catch-all
            i na `/program-nauczania`. */}
        <KafelkiPodstron items={items} />

      </div>
    </div>
  );
}
