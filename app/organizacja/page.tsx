import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { organizacja } from "../../data/articles/organizacja";

export const metadata: Metadata = {
  title: `${organizacja.topicTitle} – Shorinji Kempo Kraków`,
  description: organizacja.topicIntro,
};

export default function OrganizacjaPage() {
  return <ArticleListing group={organizacja} baseHref="/organizacja" />;
}
