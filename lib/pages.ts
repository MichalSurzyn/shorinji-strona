import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsBlock } from "./newsTypes";
import { widoczneGalezie, type WierszWidocznosci } from "./widocznosc";

/**
 * Odczyt drzewa stron (`public.pages`) i przekierowań (`public.redirects`).
 *
 * ZASADA NACZELNA TEGO PLIKU: błąd odczytu leci wyjątkiem, nigdy nie zamienia
 * się w „strony nie ma".
 *
 * Dzisiejszy wzorzec z `lib/customPages.ts:47-52` łapie każdy wyjątek i zwraca
 * `null`, a trasa robi z tego `notFound()`. Skutek: timeout Supabase zamienia
 * się w 404, który ISR cache'uje na 300 sekund - i który Google może
 * zaindeksować. Po tym etapie ta ścieżka obsługuje CAŁE drzewo treści, więc
 * jeden timeout przy zimnym starcie (zdarzył się naprawdę: PGRST303
 * „JWT issued at future", 2026-08-12) wygaszałby cały serwis na pięć minut.
 *
 * Przy 500 Google trzyma w indeksie poprzednią wersję i wraca później.
 * 200 albo 404 to komunikat „ta strona teraz tak wygląda".
 */

export interface WezelStrony {
  id: string;
  parent_id: string | null;
  kind: "page" | "link" | "header";
  source: "db" | "route";
  route: string | null;
  slug: string | null;
  full_path: string | null;
  kicker: string | null;
  title: string;
  intro: string | null;
  blocks: NewsBlock[];
  cloudinary_folder: string | null;
  layout: string;
  menu_label: string | null;
  in_menu: boolean;
  published: boolean;
  depth: number;
  position: number;
}

const KOLUMNY =
  "id,parent_id,kind,source,route,slug,full_path,kicker,title,intro,blocks," +
  "cloudinary_folder,layout,menu_label,in_menu,published,depth,position";

/**
 * Segmenty, które NIGDY nie mają trafić do bazy — sprawdzane przed zapytaniem.
 *
 * To NIE jest `RESERVED_SLUGS` z `lib/customPages.ts`. Tamta lista broni panelu
 * przed utworzeniem podstrony kolidującej z trasą i zawiera m.in.
 * `program-nauczania`, `o-shorinji` i `buddyzm`. Użyta tutaj zabiłaby flagową
 * funkcję tej migracji: `/program-nauczania/uczniowskie/6-kyu` ma się renderować
 * z drzewa, a jego pierwszy segment jest na tamtej liście.
 *
 * Zostaje więc część wspólna „zarezerwowane ORAZ bez węzła w `pages`":
 *   admin, api  - literówka w adresie panelu albo żądanie skanera nie może
 *                 renderować publicznego layoutu ani odpalać dwóch zapytań
 *                 do uśpionego Supabase, z revalidate=300 na każdym śmieciu,
 *   downloads   - `/downloads/<plik>` obsługuje route handler; samo `/downloads`
 *                 dziś daje 404 i ma dawać dalej.
 *
 * `zajecia` BYŁO tu z uzasadnieniem „«ZAJĘCIA» to nagłówek grupujący: ma
 * `full_path` NULL, więc węzła pod tym adresem nie ma i nigdy nie będzie".
 * Etap E to założenie łamie: panel pozwala teraz zamienić nagłówek w stronę,
 * a wtedy węzeł pod `/zajecia` istnieje. Przy starym wpisie ta strona byłaby
 * WIDMEM — wiersz w bazie, plakietka „opublikowana" w panelu i 404 publicznie,
 * bo guard odrzucał żądanie PRZED zapytaniem do bazy.
 *
 * Koszt zdjęcia: `/zajecia` i nieistniejące `/zajecia/cokolwiek` odpytują teraz
 * bazę, zamiast dawać 404 od progu. Adresy `/zajecia/dorosli`, `/zajecia/dzieci`
 * i `/zajecia/cennik` to bez zmian pliki tras, a te mają pierwszeństwo przed
 * trasą catch-all — więc dla nich nie zmienia się nic.
 *
 * Adresy z kropką (`/robots.txt`, `/.env`, `/wp-login.php`) i z wielkimi literami
 * (`/Kontakt`) odsiewa wzorzec segmentu niżej — nie trzeba ich tu wymieniać.
 */
export const SEGMENTY_BEZ_TRESCI = new Set(["admin", "api", "downloads"]);

/**
 * Slugi zajęte przez stałe części serwisu — walidacja przy zakładaniu strony
 * w panelu.
 *
 * Przeniesione tutaj z `lib/customPages.ts`, który znika razem z tabelą
 * `custom_pages`. Lista jest dalej potrzebna: indeks unikalny na adres broni
 * przed kolizją z INNĄ STRONĄ, ale nie przed kolizją z trasą w kodzie
 * (`/admin`, `/api`, `sitemap.xml`).
 *
 * To NIE jest to samo co `SEGMENTY_BEZ_TRESCI` wyżej — tamta lista jest węższa
 * i służy do czego innego (guard przed zapytaniem w trasie catch-all). Użycie
 * tej listy w guardzie zabiłoby trzeci poziom drzewa; użycie tamtej w walidacji
 * pozwoliłoby utworzyć stronę pod `/galeria`.
 *
 * Dołożone wobec wersji z `customPages.ts`: `icon` i `favicon.ico` — trasa
 * metadanych `/icon.jpg` istnieje, a na tamtej liście jej nie było, więc dało
 * się utworzyć kolidującą podstronę.
 */
export const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "aktualnosci",
  "buddyzm",
  "cennik",
  "galeria",
  "kontakt",
  "o-shorinji",
  "organizacja",
  "program-nauczania",
  // `zajecia` zdjęte w etapie E. Ta lista broni przed kolizją z trasą W KODZIE,
  // a `app/zajecia/page.tsx` NIE ISTNIEJE — są tylko `app/zajecia/dorosli`,
  // `/dzieci` i `/cennik`. Adres `/zajecia` był więc wolny, a wpis tutaj
  // blokował jedyną rzecz, o którą właściciel poprosił: zamianę nagłówka
  // „ZAJĘCIA" w prawdziwą stronę. Zagnieżdżone pliki tras mają pierwszeństwo
  // przed trasą catch-all, więc `/zajecia/dorosli` dalej serwuje kod.
  "downloads",
  "sitemap.xml",
  "robots.txt",
  "icon",
  "favicon.ico",
]);

/** Dozwolony kształt segmentu adresu — ten sam wzorzec co `pages_slug_format_chk`. */
const WZORZEC_SEGMENTU = /^[a-z0-9-]+$/;

/**
 * Czy ścieżka w ogóle może opisywać stronę z drzewa. Wywoływane PRZED
 * jakimkolwiek zapytaniem — to jest cały sens tego guarda.
 */
export function sciezkaMozeBycStrona(segmenty: string[]): boolean {
  if (!segmenty.length || segmenty.length > 3) return false;
  if (SEGMENTY_BEZ_TRESCI.has(segmenty[0])) return false;
  return segmenty.every((s) => WZORZEC_SEGMENTU.test(s));
}

/** Klient albo wyjątek. Brak konfiguracji to awaria wdrożenia, nie „brak strony". */
function klient() {
  const sb = getSupabaseAdmin();
  if (!sb) {
    throw new Error(
      "[pages] Brak konfiguracji Supabase (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY). " +
        "Świadomie rzucamy wyjątek zamiast oddać 404: pusty serwis z kodem 200/404 zostałby " +
        "zaindeksowany, a 500 Google traktuje jako awarię przejściową.",
    );
  }
  return sb;
}

/**
 * Szkielet drzewa do liczenia widoczności — wszystkie żywe wiersze, cztery pola.
 *
 * `cache()` z Reacta trzyma wynik przez JEDNO żądanie. To nie jest optymalizacja
 * „na wszelki wypadek”: na trasie catch-all `getStrona` woła się dwa razy — raz
 * w `generateMetadata`, raz w komponencie — a bez memoizacji ukrycie po gałęzi
 * kosztowałoby dwa dodatkowe okrążenia do Supabase na każde żądanie.
 *
 * Świadomie BEZ filtrów `kind` i `source`: łańcuch przodków prowadzi przez
 * nagłówki i przez wiersze z plików tras. `/faq` stoi dziś pod nagłówkiem
 * „ZAJĘCIA”, a `/program-nauczania/*` pod stroną `source='route'` — zawężone
 * zapytanie urwałoby im łańcuch.
 */
const wierszeWidocznosci = cache(async (): Promise<WierszWidocznosci[]> => {
  const { data, error } = await klient()
    .from("pages")
    .select("id,parent_id,published,in_menu")
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(6000));
  if (error) throw new Error(`[pages] wierszeWidocznosci: ${error.message}`);
  return (data ?? []) as unknown as WierszWidocznosci[];
});

/** Zbiór id, których cały łańcuch przodków jest opublikowany. */
async function opublikowaneGalezie(): Promise<Set<string>> {
  return widoczneGalezie(await wierszeWidocznosci()).opublikowane;
}

/**
 * Strona pod adresem — opublikowana, poza koszem I w opublikowanej gałęzi.
 *
 * Ostatni warunek to punkt A6. Sam `published` na wierszu nie wystarczy:
 * strona trzeciego poziomu pod ukrytym rodzicem miała własne `published = true`
 * i oddawała 200, choć w menu nie było już do niej żadnej drogi.
 *
 * Ukrycie daje `null`, czyli 404 przez `przekierujAlboNotFound` — a błąd
 * odczytu dalej leci wyjątkiem, zgodnie z zasadą naczelną tego pliku.
 */
export async function getStrona(sciezka: string): Promise<WezelStrony | null> {
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .eq("full_path", sciezka)
    .eq("kind", "page")
    .eq("published", true)
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(6000))
    .maybeSingle();
  // `error` sprawdzane osobno od `data`: przy dwóch wierszach PostgREST oddaje
  // PGRST116, a kod czytający samo `data` uznałby to za „nie ma strony".
  // Ten sam błąd, popełniony w `syncNavItem`, dokładał trzeci duplikat menu.
  if (error) throw new Error(`[pages] getStrona(${sciezka}): ${error.message}`);
  const wezel = (data as WezelStrony | null) ?? null;
  if (!wezel) return null;
  // Węzeł poziomu 0 nie ma przodków — oszczędzamy zapytanie na najczęstszym
  // przypadku (wszystkie osiem sekcji menu głównego).
  if (wezel.parent_id === null) return wezel;
  return (await opublikowaneGalezie()).has(wezel.id) ? wezel : null;
}

/** Opublikowane dzieci węzła — kafelki na stronie-hubie. */
export async function getDzieci(parentId: string): Promise<WezelStrony[]> {
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .eq("parent_id", parentId)
    .eq("kind", "page")
    .eq("published", true)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .abortSignal(AbortSignal.timeout(6000));
  if (error) throw new Error(`[pages] getDzieci(${parentId}): ${error.message}`);
  return (data ?? []) as unknown as WezelStrony[];
}

export interface Przekierowanie {
  new_path: string;
  status: number;
}

/** Przekierowanie spod starego adresu. Pytane WYŁĄCZNIE wtedy, gdy strony nie ma. */
export async function getPrzekierowanie(stary: string): Promise<Przekierowanie | null> {
  const { data, error } = await klient()
    .from("redirects")
    .select("new_path,status")
    .eq("old_path", stary)
    .abortSignal(AbortSignal.timeout(6000))
    .maybeSingle();
  if (error) throw new Error(`[pages] getPrzekierowanie(${stary}): ${error.message}`);
  return (data as Przekierowanie | null) ?? null;
}

/**
 * Adresy stron trzymanych w bazie — do `generateStaticParams` trasy catch-all.
 *
 * Bez tego catch-all jest `ƒ Dynamic` i PIERWSZE żądanie po KAŻDYM wdrożeniu to
 * zimny SSR do uśpionego Supabase. Z nim trasa jest `● SSG`: HTML leży
 * w artefakcie deployu, więc przy awarii bazy Netlify poda kompletną, choć
 * przestarzałą stronę — dokładnie tak, jak dziś zachowują się `/buddyzm/[slug]`
 * i pozostałe trasy tematyczne.
 *
 * Tylko `source='db'`: strony `source='route'` renderują własne pliki tras
 * i catch-all nie ma ich obsługiwać.
 */
export async function getSciezkiZBazy(): Promise<string[]> {
  const sb = getSupabaseAdmin();
  // Tu wyjątkowo BEZ rzucania: `generateStaticParams` biegnie na buildzie.
  // Build bez konfiguracji ma się udać i wyprodukować serwis bez stron z bazy
  // (tak działa dziś każda inna trasa), a nie wywalić całe wdrożenie.
  if (!sb) {
    console.warn("[pages] getSciezkiZBazy: brak konfiguracji Supabase - zero stron prerenderowanych.");
    return [];
  }
  // Bez `.eq("published", true)`: gałąź trzeba policzyć na komplecie wierszy,
  // inaczej ukryty rodzic wypada z zestawu i jego dziecko wygląda na żywe.
  // Filtry `kind`/`source` też muszą zejść z zapytania — łańcuch przodków
  // prowadzi przez nagłówki i przez wiersze z plików tras.
  const { data, error } = await sb
    .from("pages")
    .select("id,parent_id,published,in_menu,kind,source,full_path")
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    console.warn(`[pages] getSciezkiZBazy: ${error.message} - zero stron prerenderowanych.`);
    return [];
  }
  const wiersze = (data ?? []) as unknown as (WierszWidocznosci & {
    kind: string;
    source: string;
    full_path: string | null;
  })[];
  const { opublikowane } = widoczneGalezie(wiersze);
  return wiersze
    .filter((w) => w.kind === "page" && w.source === "db" && opublikowane.has(w.id))
    .map((w) => w.full_path as string)
    .filter(Boolean);
}

/** Wszystkie żywe strony — do sitemapy. */
export async function getStronyDoSitemapy(): Promise<WezelStrony[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  // Jak w `getSciezkiZBazy`: komplet żywych wierszy, filtr po policzeniu gałęzi.
  // Sitemapa ogłaszająca stronę spod ukrytego rodzica zapraszałaby Google pod
  // adres, który od tej zmiany oddaje 404.
  const { data, error } = await sb
    .from("pages")
    .select(KOLUMNY)
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    console.warn(`[pages] getStronyDoSitemapy: ${error.message}`);
    return [];
  }
  const wiersze = (data ?? []) as unknown as WezelStrony[];
  const { opublikowane } = widoczneGalezie(wiersze);
  return wiersze.filter((w) => w.kind === "page" && w.published && opublikowane.has(w.id));
}

/** Węzeł po identyfikatorze — do okruszka i rodzeństwa w trasie catch-all. */
export async function getStronaPoId(id: string): Promise<WezelStrony | null> {
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .eq("id", id)
    .abortSignal(AbortSignal.timeout(6000))
    .maybeSingle();
  if (error) throw new Error(`[pages] getStronaPoId(${id}): ${error.message}`);
  return (data as WezelStrony | null) ?? null;
}

/**
 * Folder zdjęć SEKCJI dla danego adresu, np. `/buddyzm/medytacja`
 * → `Strona/buddyzm`.
 *
 * DLACZEGO SEKCJA, A NIE PODSTRONA
 * --------------------------------
 * Do etapu F zdjęcia szły do folderu per PODSTRONA (`Strona/buddyzm/medytacja`),
 * więc w panelu rosła osobna kafelka na każdą podstronę — przy dzisiejszym
 * drzewie dziesięć. Klient poprosił wprost: „nie ma potrzeby rozbudowywania
 * tej galerii osobno dla każdej podstrony w zakładce Buddyzm", i chciał sześciu
 * kafelków, po jednym na sekcję menu.
 *
 * Ta funkcja jest jednym miejscem, w którym ta reguła żyje — panel liczy z niej
 * kafelki, a edytory treści podpowiadają z niej folder przy wgrywaniu. Gdyby
 * każde z tych miejsc liczyło po swojemu, zdjęcia wgrane z edytora przestałyby
 * być widoczne w kafelku sekcji, bez żadnego błędu.
 *
 * Zwraca `null` dla adresu, którego nie da się przypisać do sekcji (brak
 * adresu — nagłówek albo odnośnik).
 */
export function folderSekcjiZdjec(fullPath: string | null | undefined): string | null {
  if (!fullPath) return null;
  const segment = fullPath.split("/").filter(Boolean)[0];
  if (!segment) return null;
  return `Strona/${segment}`;
}

/**
 * Adres z nazwy: „Coś Tam” → „cos-tam”.
 *
 * Polskie znaki rozkładamy przez normalizację NFD i zdejmujemy znaki
 * diakrytyczne, ale „ł" trzeba obsłużyć osobno — to NIE jest „l" ze znakiem
 * diakrytycznym, tylko oddzielny znak Unicode, więc NFD go nie rozłoży
 * i wypadłby z adresu razem z resztą niedozwolonych znaków.
 *
 * Wynik zawsze pasuje do `pages_slug_format_chk` (`^[a-z0-9-]+$`) albo jest
 * pusty — pustego nie podpowiadamy, redaktor wpisze własny.
 */
export function slugZNazwy(nazwa: string): string {
  return nazwa
    .normalize("NFD")
    // UWAGA: w nawiasie stoją DOSŁOWNE znaki łączące Unicode (U+0300–U+036F),
    // niewidoczne w edytorze. Nie „porządkuj" tego wiersza ręcznie — sprawdź
    // najpierw testem, bo skasowanie ich cicho wyłącza zdejmowanie ogonków
    // i „Coś Tam" przestanie dawać „cos-tam".
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/Ł/g, "L")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
