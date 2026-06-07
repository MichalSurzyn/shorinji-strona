import type { Metadata } from "next";
import { news } from "../../data/news";

export const metadata: Metadata = {
  title: "Aktualności",
  description:
    "Ogłoszenia i wydarzenia krakowskich filii Shorinji Kempo: seminaria, zmiany w harmonogramie, obozy i egzaminy.",
};

export default function AktualnosciPage() {
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        <header className="mb-10">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            Co słychać w dōjō
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            Aktualności
          </h1>
          <p className="text-neutral-300 text-lg max-w-3xl">
            Ogłoszenia i wydarzenia z życia krakowskich filii: seminaria,
            zmiany w harmonogramie, obozy i egzaminy. Bieżące informacje
            znajdziesz też na naszym Facebooku i Instagramie.
          </p>
        </header>

        <div className="max-w-3xl space-y-4">
          {news.map((item) => (
            <article
              key={item.date + item.title}
              className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 px-6 py-5"
            >
              <time
                dateTime={item.date}
                className="text-xs text-yellow-500 font-bold uppercase tracking-wider"
              >
                {item.dateLabel}
              </time>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {item.title}
              </h2>
              {item.body && (
                <p className="mt-2 text-neutral-300 leading-relaxed">
                  {item.body}
                </p>
              )}
            </article>
          ))}
        </div>

      </div>
    </div>
  );
}
