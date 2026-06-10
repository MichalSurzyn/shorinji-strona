import Link from "next/link";
import { createSupabaseServer } from "@/lib/supabase/server";
import { listOverrideKeys } from "@/lib/articleContent";

export default async function AdminDashboard() {
  const supabase = await createSupabaseServer();

  const [{ count: articlesCount }, { data: recent }, overridden] =
    await Promise.all([
      supabase.from("articles").select("*", { count: "exact", head: true }),
      supabase
        .from("articles")
        .select("id,title,published,published_at")
        .order("published_at", { ascending: false })
        .limit(5),
      listOverrideKeys(),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Pulpit</h1>
        <p className="text-slate-500 mt-1">
          Zarządzaj treściami strony Shorinji Kempo Kraków.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/admin/artykuly"
          className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="text-3xl font-bold text-indigo-600">{articlesCount ?? 0}</div>
          <div className="text-slate-600 mt-1">Aktualności</div>
        </Link>
        <Link
          href="/admin/strony"
          className="bg-white rounded-2xl border border-slate-200 p-6 hover:border-indigo-400 hover:shadow-md transition-all"
        >
          <div className="text-3xl font-bold text-indigo-600">{overridden.size}</div>
          <div className="text-slate-600 mt-1">Podstrony ze zmianami</div>
        </Link>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold mb-4">Szybkie akcje</h2>
          <div className="space-y-2">
            <Link
              href="/admin/artykuly/nowy"
              className="block rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-center font-semibold py-2.5 transition-colors"
            >
              + Nowy artykuł (aktualności)
            </Link>
            <Link
              href="/admin/strony"
              className="block rounded-lg border border-slate-300 hover:bg-slate-50 text-center font-medium py-2.5 transition-colors"
            >
              Edytuj podstrony
            </Link>
            <Link
              href="/admin/zdjecia"
              className="block rounded-lg border border-slate-300 hover:bg-slate-50 text-center font-medium py-2.5 transition-colors"
            >
              Dodaj zdjęcia
            </Link>
            <Link
              href="/admin/harmonogram"
              className="block rounded-lg border border-slate-300 hover:bg-slate-50 text-center font-medium py-2.5 transition-colors"
            >
              Zmień godziny zajęć
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h2 className="font-bold mb-4">Ostatnie aktualności</h2>
          {!recent?.length ? (
            <p className="text-slate-500 text-sm">
              Brak artykułów. Utwórz pierwszy przyciskiem obok.
            </p>
          ) : (
            <ul className="space-y-3">
              {recent.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/admin/artykuly/${a.id}`}
                    className="group flex items-start justify-between gap-3"
                  >
                    <span className="text-sm text-slate-700 group-hover:text-indigo-600 transition-colors leading-snug">
                      {a.title}
                    </span>
                    <span
                      className={`shrink-0 text-xs rounded-full px-2 py-0.5 ${
                        a.published
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {a.published ? "opublikowany" : "szkic"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
