import NewsBlocks from "@/components/NewsBlocks";
import { getPageContent } from "@/lib/pageOverrides";

/**
 * Treść edytowalnej strony — W CAŁOŚCI z bazy (site_settings, klucz "page:<slug>").
 * Nagłówek (kicker/H1/lead) i bloki edytuje się w panelu: Strony → dana podstrona.
 * Brak wpisu w bazie = pusta sekcja (treść seeduje skrypt scripts/seed-content.mjs).
 */

/** Nagłówek strony: żółta etykietka, H1 i akapit wprowadzający. */
export async function PageHeader({
  slug,
  className = "mb-10",
}: {
  slug: string;
  className?: string;
}) {
  const content = await getPageContent(slug);
  if (!content?.title && !content?.lead && !content?.kicker) return null;
  return (
    <header className={className}>
      {content.kicker && (
        <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
          {content.kicker}
        </p>
      )}
      {content.title && (
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
          {content.title}
        </h1>
      )}
      {content.lead && (
        <p className="text-neutral-300 text-lg max-w-3xl">{content.lead}</p>
      )}
    </header>
  );
}

/** Bloki treści strony (bez nagłówka). */
export async function PageBody({ slug }: { slug: string }) {
  const content = await getPageContent(slug);
  if (!content || content.blocks.length === 0) return null;
  return <NewsBlocks blocks={content.blocks} />;
}
