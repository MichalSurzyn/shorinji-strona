import Link from "next/link";
import { getNews } from "@/lib/news";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pl-PL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default async function NewsSidebar() {
  const articles = await getNews(3);

  return (
    <div className="sticky top-40 bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
      <h2 className="text-xl font-bold text-white mb-6 uppercase tracking-wider border-b border-neutral-800 pb-4">
        Ostatnie Aktualności
      </h2>

      <div className="space-y-6">
        {articles.length === 0 && (
          <p className="text-neutral-500 text-sm">Brak aktualności.</p>
        )}
        {articles.map((item) => (
          <Link
            key={item.slug}
            href={`/aktualnosci/${item.slug}`}
            className="group block"
          >
            <span className="text-xs text-yellow-500 font-bold mb-1 block">
              {formatDate(item.published_at)}
            </span>
            <h3 className="text-neutral-200 group-hover:text-yellow-500 transition-colors leading-tight">
              {item.title}
            </h3>
          </Link>
        ))}
      </div>

      <Link
        href="/aktualnosci"
        className="mt-6 block text-sm text-yellow-500 hover:text-yellow-400 transition-colors"
      >
        Wszystkie aktualności →
      </Link>
    </div>
  );
}
