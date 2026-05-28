import Link from "next/link";
import type { ArticleGroup } from "../data/articles/types";

type Props = {
  group: ArticleGroup;
  baseHref: string; // np. /buddyzm
};

export default function ArticleListing({ group, baseHref }: Props) {
  return (
    <div className="relative pt-50 pb-20 min-h-screen">
      <div className="w-[80%] mx-auto z-10 relative">

        {/* Nagłówek sekcji */}
        <header className="mb-12">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
            Shorinji Kempo
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">
            {group.topicTitle}
          </h1>
          <p className="text-neutral-300 text-lg max-w-3xl">{group.topicIntro}</p>
        </header>

        {/* Kafelki */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {group.articles.map((a, idx) => (
            <Link
              key={a.slug}
              href={`${baseHref}/${a.slug}`}
              className="group flex flex-col rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors p-6"
            >
              <div className="text-xs uppercase tracking-[0.14em] text-yellow-500/80 group-hover:text-yellow-500 font-semibold mb-3">
                {String(idx + 1).padStart(2, "0")}
              </div>
              <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 tracking-wide">
                {a.title}
              </h2>
              <p className="text-sm text-neutral-400 leading-relaxed flex-1">
                {a.intro}
              </p>
              <div className="mt-5 text-xs uppercase tracking-wider text-yellow-500 group-hover:text-yellow-400 transition-colors">
                Czytaj →
              </div>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
