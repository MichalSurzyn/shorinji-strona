import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { buddyzm } from "../../data/articles/buddyzm";
import { resolveArticleGroup } from "../../lib/articleContent";

// ISR - kafelki biorą tytuł i wstęp z nadpisań w panelu, więc strona
// musi się odświeżać. Bez tego zbudowałaby się raz i edycja z panelu
// nigdy by tu nie dotarła.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: buddyzm.topicTitle,
  description: buddyzm.topicIntro,
};

export default async function BuddyzmPage() {
  const group = await resolveArticleGroup(buddyzm);
  return <ArticleListing group={group} baseHref="/buddyzm" />;
}
