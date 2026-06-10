import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsBlocks from "@/components/NewsBlocks";
import { clUrl } from "@/lib/cloudinary";
import { getNewsBySlug } from "@/lib/news";

export const revalidate = 300;

type Props = { params: Promise<{ slug: string }> };

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) return { title: "Nie znaleziono" };
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    alternates: { canonical: `/aktualnosci/${slug}` },
  };
}

export default async function NewsArticlePage({ params }: Props) {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) notFound();

  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">
        <header className="mb-10 max-w-4xl">
          <Link
            href="/aktualnosci"
            className="text-sm text-neutral-500 hover:text-yellow-500 transition-colors uppercase tracking-wider"
          >
            ← Aktualności
          </Link>
          <h1 className="text-3xl md:text-5xl font-bold text-white mt-4 leading-tight">
            {article.title}
          </h1>
          <time
            dateTime={article.published_at}
            className="block text-yellow-500 font-bold text-sm mt-4 uppercase tracking-wider"
          >
            {formatDate(article.published_at)}
          </time>
        </header>

        <div className="max-w-4xl">
          {article.cover_image && (
            <div className="rounded-2xl overflow-hidden border border-neutral-700 shadow-2xl mb-10 bg-neutral-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={clUrl(article.cover_image, 1600)}
                alt=""
                className="w-full h-auto"
              />
            </div>
          )}
          <NewsBlocks blocks={article.content} />
        </div>
      </div>
    </div>
  );
}
