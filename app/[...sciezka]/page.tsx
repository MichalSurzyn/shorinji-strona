import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RenderBlocks from "@/components/RenderBlocks";
import KafelkiPodstron from "@/components/KafelkiPodstron";
import ArticlePage from "@/components/ArticlePage";
import {
  getDzieci,
  getSciezkiZBazy,
  getStrona,
  getStronaPoId,
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

  /**
   * Podstrona tematyczna renderuje się szablonem `ArticlePage` — z okruszkiem,
   * spisem treści i nawigacją poprzednia/następna. Galerii pod treścią NIE ma:
   * folder Cloudinary był jednocześnie szufladą i wystawą, więc wszystko, co
   * w nim leżało, lądowało na dole podstrony bez decyzji redaktora (zdjęcia
   * wstawione w treść pokazywały się drugi raz). Zdjęcia pokazują się teraz
   * wyłącznie tam, gdzie redaktor je wstawił.
   *
   * Rozpoznajemy ją po `cloudinary_folder`, bo backfill ustawia tę kolumnę
   * DOKŁADNIE dla dziesięciu podstron tematycznych i dla nikogo więcej.
   * Kryterium „ma rodzica typu page" byłoby szersze i zmieniłoby wygląd
   * podstron własnych (`/o-shorinji/istota-budo`), które dziś renderują się
   * prosto — a etap 7 ma przenieść treść, nie przemeblować stron.
   */
  if (strona.cloudinary_folder) {
    const rodzenstwo = strona.parent_id ? await getDzieci(strona.parent_id) : [];
    const i = rodzenstwo.findIndex((r) => r.id === strona.id);
    const rodzic = strona.parent_id ? await getStronaPoId(strona.parent_id) : null;
    const naOdnosnik = (w: WezelStrony | undefined) =>
      w?.full_path ? { href: w.full_path, title: w.title } : undefined;

    return (
      <ArticlePage
        topicTitle={rodzic?.title ?? ""}
        topicHref={rodzic?.full_path ?? "/"}
        title={strona.title}
        intro={strona.intro ?? ""}
        blocks={strona.blocks}
        prev={i > 0 ? naOdnosnik(rodzenstwo[i - 1]) : undefined}
        next={i >= 0 && i < rodzenstwo.length - 1 ? naOdnosnik(rodzenstwo[i + 1]) : undefined}
      />
    );
  }

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
            <RenderBlocks blocks={strona.blocks} />
          </div>
        )}

        {/* Wspólny renderer kafelków — ten sam, którego używają listingi
            tematyczne i `/program-nauczania`. Wcześniej ten markup istniał
            tutaj i w `ArticleListing` w dwóch identycznych kopiach. */}
        <KafelkiPodstron
          className="mt-12"
          items={dzieci
            .filter((d) => d.full_path)
            .map((d) => ({ href: d.full_path as string, title: d.title, intro: d.intro }))}
        />
      </div>
    </div>
  );
}
