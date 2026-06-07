import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { getArticleImages } from "../actions/articleActions";
import ArticleGallery from "./ArticleGallery";
import type {
  Article,
  ArticleParagraph,
  ArticleSection,
  ArticleTopic,
} from "../data/articles/types";

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? "dyn3apjzb";

/** URL zdjęcia z Cloudinary z kadrowaniem do zadanych wymiarów. */
function cldUrl(publicId: string, w: number, h: number) {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/c_fill,g_auto,w_${w},h_${h},q_auto,f_auto/${publicId}`;
}

/**
 * Renderuje proste znaczniki w tekście: **pogrubienie** oraz [etykieta](url).
 * Linki zewnętrzne otwierają się w nowej karcie.
 */
function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return (
        <strong key={i} className="font-semibold text-white">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link;
      const external = href.startsWith("http");
      return (
        <a
          key={i}
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="text-yellow-500 underline underline-offset-4 decoration-yellow-500/50 hover:text-yellow-400 transition-colors"
        >
          {label}
        </a>
      );
    }
    return part;
  });
}

/**
 * Krótkie linie pisane wersalikami traktujemy jako śródtytuły
 * (tak były oznaczane nagłówki na starej stronie).
 */
function isCapsHeading(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (t.includes("**") || t.includes("](")) return false;
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(t)) return false;
  return t === t.toUpperCase();
}

function Subheading({ text }: { text: string }) {
  return (
    <h3 className="pt-3 text-lg md:text-xl font-semibold tracking-wide text-yellow-500/90">
      {renderInline(text)}
    </h3>
  );
}

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
    // Legacy: linie zaczynające się od "#####" oraz krótkie linie wersalikami
    // renderujemy jako śródtytuły.
    const hashHeading = p.match(/^#{2,6}\s+(.*)$/);
    if (hashHeading) return <Subheading key={key} text={hashHeading[1]} />;
    if (isCapsHeading(p)) return <Subheading key={key} text={p.trim()} />;
    return (
      <p key={key} className="text-neutral-300 leading-relaxed">
        {renderInline(p)}
      </p>
    );
  }
  if (p.type === "subheading") {
    return <Subheading key={key} text={p.text} />;
  }
  if (p.type === "image") {
    const portrait = p.variant === "portrait";
    return (
      <figure key={key} className={portrait ? "my-8 max-w-sm" : "my-8"}>
        <div
          className={`relative overflow-hidden rounded-xl border border-yellow-500/30 ${
            portrait ? "aspect-[4/5]" : "aspect-[14/9]"
          }`}
        >
          <Image
            src={cldUrl(p.publicId, portrait ? 800 : 1400, portrait ? 1000 : 900)}
            alt={p.caption ?? "Shorinji Kempo – zdjęcie archiwalne"}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
          />
        </div>
        {p.caption && (
          <figcaption className="mt-2 text-sm text-neutral-500 italic">
            {p.caption}
          </figcaption>
        )}
      </figure>
    );
  }
  if (p.type === "list") {
    return (
      <ul key={key} className="list-disc list-outside ml-6 space-y-2 text-neutral-300 leading-relaxed">
        {p.items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
        ))}
      </ul>
    );
  }
  if (p.type === "ordered") {
    return (
      <ol key={key} className="list-decimal list-outside ml-6 space-y-3 text-neutral-300 leading-relaxed">
        {p.items.map((it, i) => (
          <li key={i}>{renderInline(it)}</li>
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
        {renderInline(p.text)}
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
