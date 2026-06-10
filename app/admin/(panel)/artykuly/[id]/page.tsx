import { notFound } from "next/navigation";
import ArticleEditor from "@/components/admin/ArticleEditor";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { NewsArticle } from "@/lib/newsTypes";

export default async function AdminArticleEdit({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServer();
  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!article) notFound();

  return <ArticleEditor article={article as unknown as NewsArticle} />;
}
