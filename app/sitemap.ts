import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { o_shorinji } from "../data/articles/o-shorinji";
import { organizacja } from "../data/articles/organizacja";
import { buddyzm } from "../data/articles/buddyzm";
import { getNews } from "../lib/news";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
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

  const entries: MetadataRoute.Sitemap = [...staticPaths, ...articlePaths].map(
    (path) => ({
      url: `${SITE_URL}${path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: path === "" ? 1 : 0.7,
    }),
  );

  // Aktualnosci z bazy (z fallbackiem) - nowe artykuly trafiaja do sitemapy.
  const news = await getNews();
  for (const a of news) {
    entries.push({
      url: `${SITE_URL}/aktualnosci/${a.slug}`,
      lastModified: new Date(a.published_at),
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }

  return entries;
}
