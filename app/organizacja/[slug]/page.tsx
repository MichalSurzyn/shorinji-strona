import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticlePage from "../../../components/ArticlePage";
import { organizacja } from "../../../data/articles/organizacja";
import {
  getArticleOverride,
  resolveArticleBlocks,
  resolveArticleGroup,
} from "../../../lib/articleContent";

type Params = { params: Promise<{ slug: string }> };

// ISR: refresh hourly so new Cloudinary images appear without a full rebuild.
export const revalidate = 3600;

export async function generateStaticParams() {
  return organizacja.articles.map((a) => ({ slug: a.slug }));
}

// Tytuł i opis dla wyszukiwarek biorą pod uwagę nadpisanie z panelu -
// wcześniej szły wyłącznie z kodu, więc zmiana tytułu w panelu nie
// zmieniała <title> ani opisu w wynikach wyszukiwania.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const base = organizacja.articles.find((a) => a.slug === slug);
  if (!base) return { title: "Nie znaleziono" };
  const override = await getArticleOverride("organizacja", slug);
  return {
    title: override?.title?.trim() || base.title,
    description: override?.intro?.trim() || base.intro,
    alternates: { canonical: `/organizacja/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  // Grupa z nadpisaniami - żeby linki poprzedni/następny pokazywały
  // tytuły zmienione w panelu, a nie bazowe z kodu.
  const group = await resolveArticleGroup(organizacja);
  const idx = group.articles.findIndex((a) => a.slug === slug);
  if (idx === -1) notFound();
  const article = await resolveArticleBlocks("organizacja", slug, organizacja.articles[idx]);
  const prev = idx > 0 ? group.articles[idx - 1] : undefined;
  const next = idx < group.articles.length - 1 ? group.articles[idx + 1] : undefined;
  return (
    <ArticlePage
      topicTitle={organizacja.topicTitle}
      topicHref="/organizacja"
      title={article.title}
      intro={article.intro}
      blocks={article.blocks}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
