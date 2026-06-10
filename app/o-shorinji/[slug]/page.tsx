import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticlePage from "../../../components/ArticlePage";
import { o_shorinji } from "../../../data/articles/o-shorinji";
import { resolveArticleBlocks } from "../../../lib/articleContent";

type Params = { params: Promise<{ slug: string }> };

// ISR: refresh hourly so new Cloudinary images appear without a full rebuild.
export const revalidate = 3600;

export async function generateStaticParams() {
  return o_shorinji.articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const article = o_shorinji.articles.find((a) => a.slug === slug);
  if (!article) return { title: "Nie znaleziono" };
  return {
    title: article.title,
    description: article.intro,
    alternates: { canonical: `/o-shorinji/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const idx = o_shorinji.articles.findIndex((a) => a.slug === slug);
  if (idx === -1) notFound();
  const article = await resolveArticleBlocks("o-shorinji", slug, o_shorinji.articles[idx]);
  const prev = idx > 0 ? o_shorinji.articles[idx - 1] : undefined;
  const next = idx < o_shorinji.articles.length - 1 ? o_shorinji.articles[idx + 1] : undefined;
  return (
    <ArticlePage
      topic="o-shorinji"
      topicTitle={o_shorinji.topicTitle}
      topicHref="/o-shorinji"
      slug={slug}
      title={article.title}
      intro={article.intro}
      blocks={article.blocks}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
