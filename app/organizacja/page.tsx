import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { organizacja } from "../../data/articles/organizacja";
import { resolveArticleGroup } from "../../lib/articleContent";

// ISR - kafelki biorą tytuł i wstęp z nadpisań w panelu, więc strona
// musi się odświeżać. Bez tego zbudowałaby się raz i edycja z panelu
// nigdy by tu nie dotarła.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: organizacja.topicTitle,
  description: organizacja.topicIntro,
};

export default async function OrganizacjaPage() {
  const group = await resolveArticleGroup(organizacja);
  return <ArticleListing group={group} baseHref="/organizacja" />;
}
