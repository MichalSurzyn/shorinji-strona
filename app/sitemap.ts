import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { o_shorinji } from "../data/articles/o-shorinji";
import { organizacja } from "../data/articles/organizacja";
import { buddyzm } from "../data/articles/buddyzm";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const staticPaths = [
    "",
    "/aktualnosci",
    "/cennik",
    "/program-nauczania",
    "/galeria",
    "/kontakt",
    "/zajecia/dorosli",
    "/zajecia/dzieci",
    "/o-shorinji",
    "/organizacja",
    "/buddyzm",
  ];

  const articlePaths = [
    ...o_shorinji.articles.map((a) => `/o-shorinji/${a.slug}`),
    ...organizacja.articles.map((a) => `/organizacja/${a.slug}`),
    ...buddyzm.articles.map((a) => `/buddyzm/${a.slug}`),
  ];

  return [...staticPaths, ...articlePaths].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: path === "" ? 1 : 0.7,
  }));
}
