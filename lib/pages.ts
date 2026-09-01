import { getSupabaseAdmin } from "./supabaseAdmin";
import type { NewsBlock } from "./newsTypes";

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
 *                 dziś daje 404 i ma dawać dalej,
 *   zajecia     - „ZAJĘCIA" to nagłówek grupujący: ma `full_path` NULL, więc
 *                 węzła pod tym adresem nie ma i nigdy nie będzie.
 *
 * Adresy z kropką (`/robots.txt`, `/.env`, `/wp-login.php`) i z wielkimi literami
 * (`/Kontakt`) odsiewa wzorzec segmentu niżej — nie trzeba ich tu wymieniać.
 */
export const SEGMENTY_BEZ_TRESCI = new Set(["admin", "api", "downloads", "zajecia"]);

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

/** Strona pod adresem — wyłącznie opublikowana i poza koszem. */
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
  return (data as WezelStrony | null) ?? null;
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
  const { data, error } = await sb
    .from("pages")
    .select("full_path")
    .eq("kind", "page")
    .eq("source", "db")
    .eq("published", true)
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    console.warn(`[pages] getSciezkiZBazy: ${error.message} - zero stron prerenderowanych.`);
    return [];
  }
  return (data ?? []).map((w) => w.full_path as string).filter(Boolean);
}

/** Wszystkie żywe strony — do sitemapy. */
export async function getStronyDoSitemapy(): Promise<WezelStrony[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pages")
    .select(KOLUMNY)
    .eq("kind", "page")
    .eq("published", true)
    .is("deleted_at", null)
    .abortSignal(AbortSignal.timeout(15000));
  if (error) {
    console.warn(`[pages] getStronyDoSitemapy: ${error.message}`);
    return [];
  }
  return (data ?? []) as unknown as WezelStrony[];
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
