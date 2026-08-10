import type { Metadata } from "next";
import Link from "next/link";
import { clUrl } from "@/lib/cloudinary";
import { getNews } from "@/lib/news";
import { PageHeader } from "@/components/PageContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Aktualności",
  description:
    "Ogłoszenia i wydarzenia krakowskich filii Shorinji Kempo: seminaria, pokazy, zmiany w harmonogramie, obozy i egzaminy.",
  alternates: { canonical: "/aktualnosci" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function AktualnosciPage() {
  const articles = await getNews();

  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        {/* Nagłówek z bazy (Strony → Aktualności). Dotąd był zaszyty tutaj,
            więc jedyna strona, na której klub najczęściej coś zmienia, miała
            nieedytowalny tekst wstępny. */}
        <PageHeader slug="aktualnosci" />

        {articles.length === 0 ? (
          <p className="text-neutral-500 py-16">
            Brak opublikowanych aktualności.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {articles.map((a) => (
              <Link
                key={a.slug}
                href={`/aktualnosci/${a.slug}`}
                className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-yellow-500/60 transition-colors flex flex-col"
              >
                {a.cover_image && (
                  <div className="aspect-video overflow-hidden bg-neutral-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clUrl(a.cover_image, 900)}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                )}
                <div className="p-6 flex flex-col gap-3 flex-grow">
                  <time
                    dateTime={a.published_at}
                    className="text-xs text-yellow-500 font-bold uppercase tracking-wider"
                  >
                    {formatDate(a.published_at)}
                  </time>
                  <h2 className="text-xl font-bold text-white group-hover:text-yellow-500 transition-colors leading-snug">
                    {a.title}
                  </h2>
                  {a.excerpt && (
                    <p className="text-neutral-400 text-sm leading-relaxed">
                      {a.excerpt}
                    </p>
                  )}
                  <span className="mt-auto pt-2 text-sm text-neutral-500 group-hover:text-yellow-500 transition-colors">
                    Czytaj dalej →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
