import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ArticlePage from "../../../components/ArticlePage";
import { buddyzm } from "../../../data/articles/buddyzm";
import {
  getArticleOverride,
  resolveArticleBlocks,
  resolveArticleGroup,
} from "../../../lib/articleContent";

type Params = { params: Promise<{ slug: string }> };

// ISR: refresh hourly so new Cloudinary images appear without a full rebuild.
export const revalidate = 3600;

export async function generateStaticParams() {
  return buddyzm.articles.map((a) => ({ slug: a.slug }));
}

// Tytuł i opis dla wyszukiwarek biorą pod uwagę nadpisanie z panelu -
// wcześniej szły wyłącznie z kodu, więc zmiana tytułu w panelu nie
// zmieniała <title> ani opisu w wynikach wyszukiwania.
export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const base = buddyzm.articles.find((a) => a.slug === slug);
  if (!base) return { title: "Nie znaleziono" };
  const override = await getArticleOverride("buddyzm", slug);
  return {
    title: override?.title?.trim() || base.title,
    description: override?.intro?.trim() || base.intro,
    alternates: { canonical: `/buddyzm/${slug}` },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  // Grupa z nadpisaniami - żeby linki poprzedni/następny pokazywały
  // tytuły zmienione w panelu, a nie bazowe z kodu.
  const group = await resolveArticleGroup(buddyzm);
  const idx = group.articles.findIndex((a) => a.slug === slug);
  if (idx === -1) notFound();
  const article = await resolveArticleBlocks("buddyzm", slug, buddyzm.articles[idx]);
  const prev = idx > 0 ? group.articles[idx - 1] : undefined;
  const next = idx < group.articles.length - 1 ? group.articles[idx + 1] : undefined;
  return (
    <ArticlePage
      topicTitle={buddyzm.topicTitle}
      topicHref="/buddyzm"
      title={article.title}
      intro={article.intro}
      blocks={article.blocks}
      prev={prev ? { slug: prev.slug, title: prev.title } : undefined}
      next={next ? { slug: next.slug, title: next.title } : undefined}
    />
  );
}
