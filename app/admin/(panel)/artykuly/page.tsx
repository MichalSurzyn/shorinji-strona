import Link from "next/link";
import { clThumb } from "@/lib/cloudinary";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function AdminArticlesList() {
  const supabase = await createSupabaseServer();
  const { data: articles } = await supabase
    .from("articles")
    .select("id,slug,title,excerpt,cover_image,published,published_at")
    .order("published_at", { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Aktualności</h1>
          <p className="text-slate-500 mt-1">
            Artykuły widoczne na stronie głównej i w zakładce Aktualności.
          </p>
        </div>
        <Link
          href="/admin/artykuly/nowy"
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          + Nowy artykuł
        </Link>
      </div>

      {!articles?.length ? (
        <p className="text-slate-400 bg-white border border-slate-200 rounded-2xl p-10 text-center">
          Brak artykułów. Utwórz pierwszy!
        </p>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/admin/artykuly/${a.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
            >
              {a.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={clThumb(a.cover_image, 200)}
                  alt=""
                  className="w-16 h-16 rounded-lg object-cover border border-slate-200 shrink-0"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-slate-100 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
                  {a.title}
                </div>
                <div className="text-sm text-slate-400">
                  {new Date(a.published_at).toLocaleDateString("pl-PL", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </div>
              </div>
              <span
                className={`shrink-0 text-xs rounded-full px-2.5 py-1 ${
                  a.published
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {a.published ? "opublikowany" : "szkic"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
