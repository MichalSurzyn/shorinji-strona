import type { Metadata } from "next";
import { notFound } from "next/navigation";
import NewsBlocks from "@/components/NewsBlocks";
import { getCustomPage } from "@/lib/customPages";

/**
 * Własne podstrony tworzone w panelu admina (tabela custom_pages).
 * Trasy statyczne (cennik, kontakt itd.) mają pierwszeństwo przed tą
 * trasą dynamiczną - tu trafiają tylko slugi spoza nich.
 */

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = await getCustomPage(slug);
  if (!page) return { title: "Nie znaleziono" };
  return {
    title: page.title,
    description: page.intro ?? undefined,
    alternates: { canonical: `/${slug}` },
  };
}

export default async function CustomPageRoute({ params }: Props) {
  const { slug } = await params;
  const page = await getCustomPage(slug);
  if (!page) notFound();

  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {page.title}
          </h1>
          {page.intro && (
            <p className="text-neutral-300 text-lg max-w-3xl">{page.intro}</p>
          )}
        </header>

        <div className="max-w-4xl">
          <NewsBlocks blocks={page.blocks} />
        </div>
      </div>
    </div>
  );
}
