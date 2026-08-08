import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { o_shorinji } from "../../data/articles/o-shorinji";
import { resolveArticleGroup } from "../../lib/articleContent";

// ISR - kafelki biorą tytuł i wstęp z nadpisań w panelu, więc strona
// musi się odświeżać. Bez tego zbudowałaby się raz i edycja z panelu
// nigdy by tu nie dotarła.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: o_shorinji.topicTitle,
  description: o_shorinji.topicIntro,
};

export default async function O_shorinjiPage() {
  const group = await resolveArticleGroup(o_shorinji);
  return <ArticleListing group={group} baseHref="/o-shorinji" />;
}
