import { notFound } from "next/navigation";
import ArticleEditor from "@/components/admin/ArticleEditor";
import { pobierzArtykulDoPanelu } from "@/actions/articleActions";
import type { NewsArticle } from "@/lib/newsTypes";

export default async function AdminArticleEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Kluczem serwisowym — klient sesyjny nie widzi tej tabeli przez RLS
  // i ten ekran dawał 404 na istniejącym artykule.
  const article = await pobierzArtykulDoPanelu(id);

  if (!article) notFound();

  return <ArticleEditor article={article as unknown as NewsArticle} />;
}
