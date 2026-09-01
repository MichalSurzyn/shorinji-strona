import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";
import { getNews } from "../lib/news";
import { getStronyDoSitemapy } from "../lib/pages";

/**
 * Sitemapa liczona z drzewa `public.pages` plus aktualności.
 *
 * Przedtem adresy stały w trzech miejscach: lista jedenastu ścieżek wpisanych
 * na stałe, `data/articles/*.ts` i `listCustomPages()`. Nowa podstrona dodana
 * przez redaktora trafiała tam wyłącznie dzięki temu trzeciemu wywołaniu,
 * a strona trzeciego poziomu nie trafiłaby w ogóle - żadne z tych źródeł jej
 * nie zna. Teraz źródłem jest to samo drzewo, które rozstrzyga adresy.
 *
 * PRIORYTETY I CZĘSTOTLIWOŚCI ZACHOWANE 1:1 wobec poprzedniej wersji, żeby
 * różnica w golden masterze pokazała zmianę ZBIORU adresów, a nie szum
 * z przenumerowanych wag:
 *   /                     1.0  monthly   (było: path === "")
 *   strona z pliku trasy  0.7  monthly   (było: staticPaths + articlePaths)
 *   strona z bazy         0.6  monthly   (było: listCustomPages)
 *   aktualność            0.6  yearly
 *
 * `revalidate = 300` zamiast prerenderu raz na build: przedtem nowa podstrona
 * nie pojawiała się w sitemapie bez przebudowy projektu, mimo że komentarz
 * przy `getNews()` sugerował coś przeciwnego.
 */

export const revalidate = 300;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const strona of await getStronyDoSitemapy()) {
    if (!strona.full_path) continue;
    entries.push({
      url: `${SITE_URL}${strona.full_path === "/" ? "" : strona.full_path}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: strona.full_path === "/" ? 1 : strona.source === "route" ? 0.7 : 0.6,
    });
  }

  // Aktualności zostają POZA drzewem pages (§2.8) - mają własną tabelę i własne
  // trasy, więc do sitemapy trafiają osobno, tak jak dotąd.
  for (const a of await getNews()) {
    entries.push({
      url: `${SITE_URL}/aktualnosci/${a.slug}`,
      lastModified: new Date(a.published_at),
      changeFrequency: "yearly",
      priority: 0.6,
    });
  }

  return entries;
}
