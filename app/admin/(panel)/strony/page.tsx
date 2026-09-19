import Link from "next/link";
import { EDITABLE_PAGES } from "@/lib/editablePages";

/**
 * „Strony" po etapie 8 — już tylko OSIEM tras o stałym układzie.
 *
 * Zniknęły stąd dwie sekcje, bo obie zastąpiła zakładka „Strony i menu":
 *   * własne podstrony (`custom_pages` → `/admin/wlasne/[id]`),
 *   * podstrony tematyczne (`article_overrides` → `/admin/edit/[topic]/[slug]`).
 *
 * Zostało to, czego drzewo nie obsłuży: strony, których UKŁAD siedzi w pliku
 * trasy — formularz kontaktowy między nagłówkiem a treścią, grafik zajęć, mapa,
 * pasek aktualności w siatce 3/4+1/4. Ich treść dalej mieszka w `site_settings`
 * i dalej edytuje się ją tutaj. Przeniesienie ich do bloków to osobna praca
 * (etap 9), a nie skutek uboczny scalania tabel.
 */
export default function AdminPagesList() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Strony o stałym układzie</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Te strony mają na sobie rzeczy, których nie da się złożyć z bloków:
          formularz, mapę, grafik zajęć, pasek aktualności. Stąd zmieniasz ich
          teksty; sam układ jest częścią serwisu.
        </p>
      </div>

      <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-4 text-sm text-indigo-900">
        Wszystkie pozostałe strony – i to, co widać w menu na górze – są w zakładce{" "}
        <Link href="/admin/drzewo" className="font-semibold underline">
          Strony i menu
        </Link>
        . Tam dodasz nową podstronę, przestawisz ją albo przywrócisz z kosza.
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
              <span className="shrink-0 text-sm text-indigo-600 font-medium">Edytuj →</span>
            </Link>
          ))}
        </div>
      </section>

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
