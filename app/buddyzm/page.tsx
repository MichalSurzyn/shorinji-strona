import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { buddyzm } from "../../data/articles/buddyzm";

export const metadata: Metadata = {
  title: `${buddyzm.topicTitle} – Shorinji Kempo Kraków`,
  description: buddyzm.topicIntro,
};

export default function BuddyzmPage() {
  return <ArticleListing group={buddyzm} baseHref="/buddyzm" />;
}
