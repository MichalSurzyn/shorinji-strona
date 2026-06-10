import { notFound } from "next/navigation";
import { o_shorinji } from "@/data/articles/o-shorinji";
import { organizacja } from "@/data/articles/organizacja";
import { buddyzm } from "@/data/articles/buddyzm";
import type { ArticleGroup } from "@/data/articles/types";
import { getArticleOverride, overrideToBlocks } from "@/lib/articleContent";
import { sectionsToBlocks } from "@/lib/blockConvert";
import EditorForm from "./EditorForm";

const GROUPS: Record<string, ArticleGroup> = {
  "o-shorinji": o_shorinji,
  organizacja,
  buddyzm,
};

type Props = {
  params: Promise<{ topic: string; slug: string }>;
};

export default async function EditPage({ params }: Props) {
  const { topic, slug } = await params;

  const group = GROUPS[topic];
  if (!group) notFound();
  const base = group.articles.find((a) => a.slug === slug);
  if (!base) notFound();

  const ov = await getArticleOverride(topic, slug);
  const baseBlocks = sectionsToBlocks(base.sections);

  return (
    <EditorForm
      topic={topic}
      slug={slug}
      topicTitle={group.topicTitle}
      initialTitle={ov?.title?.trim() || base.title}
      initialIntro={ov?.intro?.trim() || base.intro}
      initialBlocks={overrideToBlocks(ov) ?? baseBlocks}
      baseBlocks={baseBlocks}
    />
  );
}
