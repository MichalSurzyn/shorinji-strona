import type { MetadataRoute } from "next";
import { SITE_URL } from "../lib/site";

/**
 * Do tej pory ten plik nie wykluczał NICZEGO (`allow: "/"`, zero `disallow`),
 * a `app/layout.tsx` deklaruje `index: true` dla całego serwisu.
 *
 * Po wprowadzeniu trasy catch-all zbiór obsługiwanych ścieżek przestał być
 * skończoną listą plików, więc panel trzeba wykluczyć jawnie. `/admin/*`
 * przekierowuje niezalogowanych na logowanie, ale samo przekierowanie nie jest
 * instrukcją dla robota - bez tego wpisu ekran logowania nadaje się do indeksu.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
