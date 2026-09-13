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
          /**
           * Jedna aktualność = JEDEN WIERSZ na całą szerokość, nowe na górze.
           *
           * Wcześniej stała tu siatka 1/2/3 kolumn. Właściciel: „lepiej zrobić
           * nie jako kwadraciki je a tak jak wiadomości, że jedna aktualność
           * 1 wiersz dłuższy(szerszy) i nowe na samą górę". W trzech kolumnach
           * zapowiedź (`excerpt`) łamała się po 3-4 słowach i kafelek mówił
           * tyle samo co sam tytuł; w wierszu mieści się całe zdanie.
           *
           * Kolejność bierze się z `getNews()` — `order("published_at",
           * ascending: false)`, z tym samym porządkiem w zapasie z pamięci.
           * Sortowania NIE ma tutaj: dwa miejsca sortujące tę samą listę to
           * dwa miejsca, które mogą się rozjechać.
           */
          <div className="flex flex-col gap-6">
            {articles.map((a, i) => (
              <Link
                key={a.slug}
                href={`/aktualnosci/${a.slug}`}
                className={`group grid bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-yellow-500/60 transition-colors ${
                  a.cover_image ? "md:grid-cols-[20rem_1fr]" : "grid-cols-1"
                }`}
              >
                {a.cover_image && (
                  <div className="aspect-video md:aspect-auto md:min-h-[13rem] overflow-hidden bg-neutral-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clUrl(a.cover_image, 900)}
                      alt=""
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      // Dwie pierwsze pozycje są nad zgięciem na telefonie —
                      // `lazy` na nich opóźnia największy element widoku.
                      loading={i < 2 ? "eager" : "lazy"}
                    />
                  </div>
                )}
                <div className="p-6 md:p-8 flex flex-col gap-3">
                  <time
                    dateTime={a.published_at}
                    className="text-xs text-yellow-500 font-bold uppercase tracking-wider"
                  >
                    {formatDate(a.published_at)}
                  </time>
                  <h2 className="text-xl md:text-2xl font-bold text-white group-hover:text-yellow-500 transition-colors leading-snug">
                    {a.title}
                  </h2>
                  {a.excerpt && (
                    <p className="text-neutral-400 leading-relaxed max-w-3xl">
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
