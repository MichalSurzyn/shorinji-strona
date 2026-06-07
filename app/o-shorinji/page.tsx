import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { o_shorinji } from "../../data/articles/o-shorinji";

export const metadata: Metadata = {
  title: o_shorinji.topicTitle,
  description: o_shorinji.topicIntro,
};

export default function O_shorinjiPage() {
  return <ArticleListing group={o_shorinji} baseHref="/o-shorinji" />;
}
