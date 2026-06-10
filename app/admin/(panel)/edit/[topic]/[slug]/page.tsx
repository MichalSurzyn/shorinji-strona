import { notFound } from "next/navigation";
import { o_shorinji } from "@/data/articles/o-shorinji";
import { organizacja } from "@/data/articles/organizacja";
import { buddyzm } from "@/data/articles/buddyzm";
import type { ArticleGroup } from "@/data/articles/types";
import { getArticleOverride } from "@/lib/articleContent";
import { serializeArticleToMarkdown } from "@/lib/markdown";
import EditorForm from "./EditorForm";

const GROUPS: Record<string, ArticleGroup> = {
  "o-shorinji": o_shorinji,
  organizacja,
  buddyzm,
};

type Props = {
  params: Promise<{ topic: string; slug: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
};

export default async function EditPage({ params, searchParams }: Props) {
  const { topic, slug } = await params;
  const sp = await searchParams;

  const group = GROUPS[topic];
  if (!group) notFound();
  const base = group.articles.find((a) => a.slug === slug);
  if (!base) notFound();

  const ov = await getArticleOverride(topic, slug);
  const baseMarkdown = serializeArticleToMarkdown(base);

  return (
    <EditorForm
      topic={topic}
      slug={slug}
      topicTitle={group.topicTitle}
      initialTitle={ov?.title ?? base.title}
      initialIntro={ov?.intro ?? base.intro}
      initialBody={ov?.body_md && ov.body_md.trim() ? ov.body_md : baseMarkdown}
      baseMarkdown={baseMarkdown}
      saved={sp?.saved === "1"}
      error={sp?.error}
    />
  );
}
