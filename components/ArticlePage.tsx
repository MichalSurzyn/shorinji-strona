import Link from "next/link";
import NewsBlocks, { slugifyAnchor } from "./NewsBlocks";
import type { NewsBlock } from "../lib/newsTypes";

type Props = {
  topicTitle: string;
  topicHref: string; // np. /buddyzm
  title: string;
  intro: string;
  /** Treść podstrony jako wspólne bloki (te same co aktualności i strony serwisu). */
  blocks: NewsBlock[];
  /** Prev/Next w obrębie tej samej sekcji. */
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
};

/**
 * Wspólny szablon podstrony tematycznej: breadcrumb, nagłówek, treść
 * z bloków (jeden renderer dla całej strony), spis treści z nagłówków
 * i nawigacja poprzednia/następna.
 */
export default async function ArticlePage({
  topicTitle,
  topicHref,
  title,
  intro,
  blocks,
  prev,
  next,
}: Props) {
  // Spis treści budowany z bloków-nagłówków
  const tocItems = blocks
    .filter((b): b is Extract<NewsBlock, { type: "heading" }> => b.type === "heading")
    .map((b) => ({ id: slugifyAnchor(b.text), label: b.text }));

  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">

        {/* Breadcrumb */}
        <nav className="mb-4 text-xs uppercase tracking-[0.16em] text-neutral-500" aria-label="Breadcrumb">
          <Link href={topicHref} className="hover:text-yellow-500 transition-colors">
            {topicTitle}
          </Link>
          <span className="mx-2 text-neutral-700">/</span>
          <span className="text-yellow-500">{title}</span>
        </nav>

        {/* Nagłówek strony */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {title}
          </h1>
          <p className="text-neutral-300 text-lg max-w-3xl">{intro}</p>
        </header>

        {/* Główny layout: tekst + sticky TOC po prawej (lg+).
            Bez TOC nie rezerwujemy pustego toru 240px. */}
        <div
          className={`grid grid-cols-1 gap-10 ${
            tocItems.length > 1 ? "lg:grid-cols-[1fr_240px]" : ""
          }`}
        >
          <main>
            {/* Wspólny renderer z grupowaniem: kolejne bloki "person"
                stają obok siebie (np. egzaminatorzy). */}
            <NewsBlocks blocks={blocks} />

            {/* Prev / Next */}
            {(prev || next) && (
              <nav className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-4" aria-label="Nawigacja w sekcji">
                {prev ? (
                  <Link
                    href={`${topicHref}/${prev.slug}`}
                    className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors px-5 py-4"
                  >
                    <div className="text-xs uppercase tracking-wider text-yellow-500">← Poprzednia</div>
                    <div className="mt-1 text-white font-semibold">{prev.title}</div>
                  </Link>
                ) : <div />}
                {next ? (
                  <Link
                    href={`${topicHref}/${next.slug}`}
                    className="rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors px-5 py-4 sm:text-right"
                  >
                    <div className="text-xs uppercase tracking-wider text-yellow-500">Następna →</div>
                    <div className="mt-1 text-white font-semibold">{next.title}</div>
                  </Link>
                ) : <div />}
              </nav>
            )}
          </main>

          {/* Sticky TOC */}
          {tocItems.length > 1 && (
            <aside className="hidden lg:block">
              <div className="sticky top-40">
                <p className="text-xs uppercase tracking-[0.16em] text-yellow-500 font-semibold mb-4">
                  Na tej stronie
                </p>
                <ul className="space-y-2 text-sm border-l border-yellow-500/30">
                  {tocItems.map((it) => (
                    <li key={it.id}>
                      <a
                        href={`#${it.id}`}
                        className="block pl-4 py-1 text-neutral-400 hover:text-yellow-500 hover:border-yellow-500 border-l-2 border-transparent -ml-px transition-colors"
                      >
                        {it.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          )}
        </div>

      </div>
    </div>
  );
}
