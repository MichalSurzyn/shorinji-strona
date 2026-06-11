import Link from "next/link";
import { o_shorinji } from "@/data/articles/o-shorinji";
import { organizacja } from "@/data/articles/organizacja";
import { buddyzm } from "@/data/articles/buddyzm";
import { EDITABLE_PAGES } from "@/lib/editablePages";
import { listCustomPages } from "@/lib/customPages";
import MigrateButton from "@/components/admin/MigrateButton";
import type { ArticleGroup } from "@/data/articles/types";

const GROUPS: ArticleGroup[] = [o_shorinji, organizacja, buddyzm];

export default async function AdminPagesList() {
  const customPages = await listCustomPages();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Podstrony</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Wybierz podstronę, którą chcesz edytować. Wszystkie używają tego
          samego edytora blokowego co aktualności.
        </p>
      </div>

      <MigrateButton />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-indigo-600 font-semibold">
            Własne podstrony
          </h2>
          <Link
            href="/admin/wlasne/nowy"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 text-sm font-semibold transition-colors"
          >
            + Nowa podstrona
          </Link>
        </div>
        {customPages.length === 0 ? (
          <p className="bg-white rounded-2xl border border-slate-200 px-5 py-6 text-sm text-slate-400">
            Brak własnych podstron. Utwórz pierwszą - możesz ją od razu dodać
            do menu górnego.
          </p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {customPages.map((p) => (
              <Link
                key={p.id}
                href={`/admin/wlasne/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {p.title}
                  </div>
                  <div className="text-sm text-slate-400">/{p.slug}</div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {!p.published && (
                    <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2.5 py-1">
                      szkic
                    </span>
                  )}
                  <span className="text-sm text-indigo-600 font-medium">
                    Edytuj →
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-xs uppercase tracking-[0.16em] text-indigo-600 font-semibold mb-3">
          Strony serwisu
        </h2>
        <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {EDITABLE_PAGES.map((p) => (
            <Link
              key={p.slug}
              href={`/admin/strona/${p.slug}`}
              className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
            >
              <div>
                <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {p.label}
                </div>
                <div className="text-sm text-slate-400">{p.route}</div>
              </div>
              <span className="shrink-0 text-sm text-indigo-600 font-medium">
                Edytuj →
              </span>
            </Link>
          ))}
        </div>
      </section>

      {GROUPS.map((group) => (
        <section key={group.topic}>
          <h2 className="text-xs uppercase tracking-[0.16em] text-indigo-600 font-semibold mb-3">
            {group.topicTitle}
          </h2>
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {group.articles.map((a) => (
              <Link
                key={a.slug}
                href={`/admin/edit/${group.topic}/${a.slug}`}
                className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div>
                  <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                    {a.title}
                  </div>
                  <div className="text-sm text-slate-400">
                    /{group.topic}/{a.slug}
                  </div>
                </div>
                <span className="shrink-0 text-sm text-indigo-600 font-medium">
                  Edytuj →
                </span>
              </Link>
            ))}
          </div>
        </section>
      ))}

      <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-500">
        Harmonogram zajęć edytujesz w zakładce{" "}
        <Link href="/admin/harmonogram" className="text-indigo-600 font-medium">
          Harmonogram
        </Link>
        , aktualności w zakładce{" "}
        <Link href="/admin/artykuly" className="text-indigo-600 font-medium">
          Aktualności
        </Link>
        , a zdjęcia w zakładce{" "}
        <Link href="/admin/zdjecia" className="text-indigo-600 font-medium">
          Zdjęcia
        </Link>
        .
      </div>
    </div>
  );
}
