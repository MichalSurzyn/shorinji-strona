import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import NewsBlocks from "@/components/NewsBlocks";
import {
  getDzieci,
  getSciezkiZBazy,
  getStrona,
  sciezkaMozeBycStrona,
  type WezelStrony,
} from "@/lib/pages";
import { przekierujAlboNotFound } from "@/lib/przekierowania";

/**
 * Trasa catch-all dla stron z drzewa `public.pages`. Zastępuje `app/[slug]`.
 *
 * DLACZEGO `[...sciezka]`, A NIE `[[...sciezka]]`
 * ----------------------------------------------
 * Wariant opcjonalny dopasowałby też adres pusty, czyli kolidowałby
 * z `app/page.tsx` - Next odmówiłby zbudowania projektu.
 *
 * CO MA PIERWSZEŃSTWO
 * -------------------
 * Trasy statyczne (`app/kontakt`, `app/zajecia/cennik`, `app/o-shorinji/[slug]`)
 * dopasowują się PRZED tą trasą i działają bez zmian. Catch-all dostaje resztę:
 * strony trzymane w bazie (dziś `/faq`, `/istota-budo`, `/symbole-shorinji-kempo`)
 * oraz trzeci poziom drzewa, którego żaden plik trasy nie obsługuje
 * (`/program-nauczania/uczniowskie/6-kyu` - flagowa funkcja tej migracji).
 *
 * KOLEJNOŚĆ KROKÓW JEST CZĘŚCIĄ SPECYFIKACJI, nie stylem:
 *   0. guard PRZED zapytaniem do bazy,
 *   1. strona po `full_path`,
 *   2. znaleziona z `source='route'` → 404 (obsługuje ją plik trasy),
 *   3. nie znaleziona → przekierowania → 404,
 *   4. błąd odczytu → wyjątek (500), nigdy `notFound()`.
 */

export const revalidate = 300;

type Props = { params: Promise<{ sciezka: string[] }> };

/**
 * Prerender stron z bazy. Bez tego trasa jest `ƒ Dynamic` i pierwsze żądanie po
 * każdym wdrożeniu to zimny SSR do uśpionego Supabase - czyli powtarzalny
 * mechanizm odpalania incydentu PGRST303, nie raz na rok, a po każdym deployu.
 */
export async function generateStaticParams() {
  const sciezki = await getSciezkiZBazy();
  return sciezki.map((s) => ({ sciezka: s.replace(/^\//, "").split("/") }));
}

/** Adres z segmentów. Dekodowanie, bo w URL-u mogą siedzieć znaki procentowe. */
function adresZSegmentow(segmenty: string[]): string {
  return "/" + segmenty.map((s) => decodeURIComponent(s)).join("/");
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { sciezka } = await params;
  const segmenty = sciezka.map((s) => decodeURIComponent(s));
  if (!sciezkaMozeBycStrona(segmenty)) return { title: "Nie znaleziono" };

  const adres = adresZSegmentow(sciezka);
  const strona = await getStrona(adres);
  if (!strona || strona.source === "route") return { title: "Nie znaleziono" };

  return {
    title: strona.title,
    description: strona.intro ?? undefined,
    alternates: { canonical: adres },
  };
}

export default async function StronaZDrzewa({ params }: Props) {
  const { sciezka } = await params;
  const segmenty = sciezka.map((s) => decodeURIComponent(s));

  // KROK 0 - guard. Musi stać przed jakimkolwiek zapytaniem: bez niego każda
  // literówka w adresie panelu (`/admin/typo`) i każde żądanie skanera
  // (`/wp-login.php`, `/.env`) renderowałoby publiczny layout i odpalało dwa
  // zapytania do bazy, na nieograniczonym zbiorze ścieżek, z revalidate=300
  // na każdym śmieciu. Dziś oba dają 404 i mają dawać dalej.
  if (!sciezkaMozeBycStrona(segmenty)) notFound();

  const adres = adresZSegmentow(sciezka);
  const strona = await getStrona(adres);

  // Węzeł `source='route'` opisuje stronę renderowaną przez plik trasy w kodzie.
  // Skoro żądanie doszło tutaj, plik się nie dopasował - a wtedy udawanie, że
  // strona istnieje, pokazałoby inną treść pod znanym adresem. 404 jest uczciwsze.
  //
  // `return`, a nie samo `await`: TypeScript zawęża typ dopiero po instrukcji
  // powrotu. Przy `await f()` na funkcji zwracającej `Promise<never>` analiza
  // przepływu nie wie, że dalszy kod jest nieosiągalny, i wymuszałaby `strona!`
  // w każdym kolejnym wierszu - czyli wyciszanie kompilatora zamiast korzystania
  // z niego.
  if (!strona || strona.source === "route") return przekierujAlboNotFound(adres);

  const dzieci = await getDzieci(strona.id);
  return <WidokStrony strona={strona} dzieci={dzieci} />;
}

/**
 * Układ: nagłówek (kicker + H1 + wstęp) → własne bloki → kafelki dzieci.
 *
 * Kafelki rysuje węzeł, który MA opublikowane dzieci - listingiem jest się przez
 * posiadanie dzieci, a nie przez osobny typ strony (§3). Dlatego `layout` z bazy
 * nie jest tu jeszcze czytany: domyślne `auto` opisuje 100% dzisiejszych
 * przypadków, a wymuszanie `article`/`listing` wchodzi razem z ekranem panelu,
 * który pozwoli to ustawić.
 */
function WidokStrony({ strona, dzieci }: { strona: WezelStrony; dzieci: WezelStrony[] }) {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        <header className="mb-10">
          {strona.kicker && (
            <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
              {strona.kicker}
            </p>
          )}
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">{strona.title}</h1>
          {strona.intro && (
            <p className="text-neutral-300 text-lg max-w-3xl">{strona.intro}</p>
          )}
        </header>

        {strona.blocks.length > 0 && (
          <div className="max-w-4xl">
            <NewsBlocks blocks={strona.blocks} />
          </div>
        )}

        {dzieci.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            {dzieci.map((d, idx) => (
              <Link
                key={d.id}
                href={d.full_path ?? "#"}
                className="group flex flex-col rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors p-6"
              >
                <div className="text-xs uppercase tracking-[0.14em] text-yellow-500/80 group-hover:text-yellow-500 font-semibold mb-3">
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 tracking-wide">
                  {d.title}
                </h2>
                {d.intro && (
                  <p className="text-sm text-neutral-400 leading-relaxed flex-1">{d.intro}</p>
                )}
                <div className="mt-5 text-xs uppercase tracking-wider text-yellow-500 group-hover:text-yellow-400 transition-colors">
                  Czytaj →
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
