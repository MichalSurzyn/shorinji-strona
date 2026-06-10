import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticlePage from "../../../components/ArticlePage";
import { buddyzm } from "../../../data/articles/buddyzm";
import { resolveArticle } from "../../../lib/articleContent";

type Params = { params: Promise<{ slug: string }> };

// ISR: refresh hourly so new Cloudinary images appear without a full rebuild.
export const revalidate = 3600;

export async function generateStaticParams() {
  return buddyzm.articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = buddyzm.articles.find((a) => a.slug === slug);
  if (!article) return { title: "Nie znaleziono" };
  return {
    title: article.title,
    description: article.intro,
    alternates: { canonical: `/buddyzm/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const idx = buddyzm.articles.findIndex((a) => a.slug === slug);
  if (idx === -1) notFound();
  const article = await resolveArticle("buddyzm", slug, buddyzm.articles[idx]);
  const prev = idx > 0 ? buddyzm.articles[idx - 1] : undefined;
  const next = idx < buddyzm.articles.length - 1 ? buddyzm.articles[idx + 1] : undefined;
  return (
    <ArticlePage
      topic="buddyzm"
      topicTitle={buddyzm.topicTitle}
      topicHref="/buddyzm"
      article={article}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
