import Link from "next/link";
import { getArticleImages } from "../actions/articleActions";
import ArticleGallery from "./ArticleGallery";
import type {
  Article,
  ArticleParagraph,
  ArticleSection,
  ArticleTopic,
} from "../data/articles/types";

type Props = {
  topic: ArticleTopic;
  topicTitle: string;
  topicHref: string; // np. /buddyzm
  article: Article;
  /** Prev/Next w obrębie tej samej sekcji. */
  prev?: { slug: string; title: string };
  next?: { slug: string; title: string };
};

/** Tworzy bezpieczny anchor z polskiego tekstu. */
function slugifyAnchor(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (c) =>
      ({ ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" })[c] ?? c,
    )
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function renderParagraph(p: ArticleParagraph, key: number) {
  if (typeof p === "string") {
    return (
      <p key={key} className="text-neutral-300 leading-relaxed">
        {p}
      </p>
    );
  }
  if (p.type === "list") {
    return (
      <ul key={key} className="list-disc list-outside ml-6 space-y-2 text-neutral-300 leading-relaxed">
        {p.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ul>
    );
  }
  if (p.type === "ordered") {
    return (
      <ol key={key} className="list-decimal list-outside ml-6 space-y-3 text-neutral-300 leading-relaxed">
        {p.items.map((it, i) => (
          <li key={i}>{it}</li>
        ))}
      </ol>
    );
  }
  if (p.type === "quote") {
    return (
      <blockquote
        key={key}
        className="border-l-4 border-yellow-500/60 pl-5 py-1 text-neutral-200 italic"
      >
        {p.text}
      </blockquote>
    );
  }
  return null;
}

function renderSection(section: ArticleSection, idx: number) {
  const id = section.id ?? slugifyAnchor(section.heading);
  return (
    <section key={idx} id={id} className="scroll-mt-32 mb-12">
      <h2 className="text-2xl md:text-3xl font-semibold text-white tracking-wide mb-5">
        {section.heading}
      </h2>
      <div className="space-y-5">
        {section.paragraphs.map((p, i) => renderParagraph(p, i))}
      </div>
    </section>
  );
}

export default async function ArticlePage({
  topic,
  topicTitle,
  topicHref,
  article,
  prev,
  next,
}: Props) {
  // Zdjęcia z Cloudinary z folderu Strona/<topic>/<slug>
  const images = await getArticleImages(topic, article.slug);

  // Anchory dla TOC
  const tocItems = article.sections.map((s) => ({
    id: s.id ?? slugifyAnchor(s.heading),
    label: s.heading,
  }));

  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        {/* Breadcrumb */}
        <nav className="mb-4 text-xs uppercase tracking-[0.16em] text-neutral-500" aria-label="Breadcrumb">
          <Link href={topicHref} className="hover:text-yellow-500 transition-colors">
            {topicTitle}
          </Link>
          <span className="mx-2 text-neutral-700">/</span>
          <span className="text-yellow-500">{article.title}</span>
        </nav>

        {/* Nagłówek strony */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {article.title}
          </h1>
          <p className="text-neutral-300 text-lg max-w-3xl">{article.intro}</p>
        </header>

        {/* Główny layout: tekst + sticky TOC po prawej (lg+) */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-10">
          <main>
            {article.sections.map((s, i) => renderSection(s, i))}

            {/* Galeria zdjęć z Cloudinary (jeśli są) */}
            <ArticleGallery publicIds={images} alt={article.title} />

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
