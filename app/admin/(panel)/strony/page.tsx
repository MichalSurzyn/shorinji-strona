import Link from "next/link";
import { o_shorinji } from "@/data/articles/o-shorinji";
import { organizacja } from "@/data/articles/organizacja";
import { buddyzm } from "@/data/articles/buddyzm";
import { listOverrideKeys } from "@/lib/articleContent";
import { EDITABLE_PAGES } from "@/lib/editablePages";
import { listPageOverrideSlugs } from "@/lib/pageOverrides";
import type { ArticleGroup } from "@/data/articles/types";

const GROUPS: ArticleGroup[] = [o_shorinji, organizacja, buddyzm];

function EditedBadge() {
  return (
    <span className="rounded-full bg-amber-100 text-amber-700 text-xs px-2.5 py-1">
      edytowano
    </span>
  );
}

export default async function AdminPagesList() {
  const [overridden, pageOverrides] = await Promise.all([
    listOverrideKeys(),
    listPageOverrideSlugs(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Podstrony</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Wybierz podstronę, którą chcesz zmienić. Dopóki czegoś nie zapiszesz,
          na stronie widać treść bazową z kodu. Plakietka „edytowano" oznacza
          zapisane zmiany z panelu.
        </p>
      </div>

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
              <div className="flex items-center gap-3 shrink-0">
                {pageOverrides.has(p.slug) && <EditedBadge />}
                <span className="text-sm text-indigo-600 font-medium">
                  Edytuj →
                </span>
              </div>
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
            {group.articles.map((a) => {
              const edited = overridden.has(`${group.topic}/${a.slug}`);
              return (
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
                  <div className="flex items-center gap-3 shrink-0">
                    {edited && <EditedBadge />}
                    <span className="text-sm text-indigo-600 font-medium">
                      Edytuj →
                    </span>
                  </div>
                </Link>
              );
            })}
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
