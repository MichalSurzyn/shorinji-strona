import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { organizacja } from "../../data/articles/organizacja";

export const metadata: Metadata = {
  title: organizacja.topicTitle,
  description: organizacja.topicIntro,
};

export default function OrganizacjaPage() {
  return <ArticleListing group={organizacja} baseHref="/organizacja" />;
}
