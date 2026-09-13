"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";
import { RESERVED_SLUGS } from "@/lib/pages";
import { zapiszWersje } from "@/lib/versions";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Zapis drzewa stron i menu (tabela `public.pages`) — etap 5.
 *
 * TRZY ZASADY, KTÓRE ODRÓŻNIAJĄ TE AKCJE OD STARYCH
 * --------------------------------------------------
 * 1. **Punktowe UPDATE, nigdy zapis hurtem.** `saveNavTree` wstawia komplet
 *    nowych wierszy i dopiero potem kasuje stare, więc przez chwilę w tabeli
 *    istnieją DWA komplety — wzorzec niekompatybilny z unikalnym indeksem na
 *    adres (`pages_full_path_key`), który wywali drugi komplet w połowie zapisu.
 *    Przy scalonej tabeli taka pomyłka dotyczy treści stron, nie tylko etykiet.
 * 2. **System nie robi po cichu czegoś innego, niż redaktor ustawił.** Zamiast
 *    filtrować niemożliwe kombinacje przy ODCZYCIE (jak dziś `depth <= 1`
 *    w menu), odrzucamy je przy ZAPISIE, z wyjaśnieniem. Ciche ignorowanie
 *    odtwarzałoby dzisiejszą asymetrię: redaktor coś ustawia, a system tego
 *    nie robi i nic nie mówi.
 * 3. **Walidacja sluga pyta też `redirects`.** Sama lista zarezerwowanych
 *    i indeks unikalny nie bronią przed utworzeniem strony pod STARYM,
 *    zaindeksowanym przekierowaniem: adres jest wolny w `pages`, a wpis
 *    w `redirects` przestaje działać po cichu i Google dostaje inną treść,
 *    niż spodziewa się zobaczyć.
 */

export type RodzajWezla = "page" | "link" | "header";

export interface WezelPanelu {
  id: string;
  parent_id: string | null;
  kind: RodzajWezla;
  source: "db" | "route";
  route: string | null;
  slug: string | null;
  full_path: string | null;
  /**
   * Klucz treści w `site_settings` dla stron o stałym układzie (`page:<slug>`).
   * Wypełniony przez backfill etapu 2 i do etapu F NIE CZYTANY przez nikogo —
   * a to właśnie on jest pomostem między węzłem drzewa a treścią jego strony.
   * Bez niego panel miał dwie zakładki nad jedną stroną.
   */
  content_key: string | null;
  external_url: string | null;
  kicker: string | null;
  title: string;
  intro: string | null;
  blocks: NewsBlock[];
  menu_label: string | null;
  in_menu: boolean;
  published: boolean;
  depth: number;
  position: number;
  deleted_at: string | null;
}

const KOLUMNY =
  "id,parent_id,kind,source,route,slug,full_path,content_key,external_url,kicker,title,intro," +
  "blocks,menu_label,in_menu,published,depth,position,deleted_at";

/**
 * Dwa osobne typy zamiast jednego warunkowego. Wariant generyczny
 * (`{ok:true} & (T extends undefined ? ...)`) wygląda elegancko, a w praktyce
 * zmusza kompilator do przecinania `{ok:true}` z `Record<string, never>` —
 * czyli do wniosku, że `ok` musi być typu `never`. Prostsze jest tu poprawne.
 */
type Wynik = { ok: true } | { ok: false; error: string };
type WynikZ<T> = { ok: true; dane: T } | { ok: false; error: string };

const blad = (error: string): { ok: false; error: string } => ({ ok: false, error });

function klient() {
  const sb = getSupabaseAdmin();
  if (!sb) throw new Error("Brak konfiguracji Supabase.");
  return sb;
}

// ─────────────────────────────────────────────────────────────────────────────
// Odczyt
// ─────────────────────────────────────────────────────────────────────────────

export async function pobierzDrzewo(): Promise<WezelPanelu[]> {
  await requireUser();
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .is("deleted_at", null)
    // Drugie kryterium jest warunkiem POPRAWNOŚCI, nie kosmetyką. `position`
    // ma sens wyłącznie wewnątrz jednego rodzica, a `pages_parent_position_idx`
    // (03-drzewo-stron.sql:644) NIE jest indeksem unikalnym — duplikaty są w tej
    // tabeli legalne. Sortowanie po samej pozycji zwraca przy remisie kolejność
    // nieokreśloną, więc ekran i akcja przestawiania widziałyby INNE drzewo:
    // „Przesunięte niżej." bez żadnego skutku.
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`Nie udało się wczytać drzewa: ${error.message}`);
  return (data ?? []) as unknown as WezelPanelu[];
}

export async function pobierzKosz(): Promise<WezelPanelu[]> {
  await requireUser();
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false })
    .order("id", { ascending: true });
  if (error) throw new Error(`Nie udało się wczytać kosza: ${error.message}`);
  return (data ?? []) as unknown as WezelPanelu[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Walidacja
// ─────────────────────────────────────────────────────────────────────────────

const WZORZEC_SLUGA = /^[a-z0-9-]+$/;

/**
 * Slug wolny? Sprawdzamy TRZY rzeczy, nie jedną.
 *
 * Indeks unikalny w bazie obroni przed kolizją z inną stroną, ale nie przed
 * kolizją z trasą w kodzie (`/admin`, `/api`, `sitemap.xml`) ani przed
 * zajęciem adresu, spod którego prowadzi dziś przekierowanie.
 */
async function sprawdzSlug(
  slug: string,
  parentId: string | null,
  adresRodzica: string | null,
  wykluczId?: string,
): Promise<string | null> {
  if (!WZORZEC_SLUGA.test(slug)) {
    return "Adres może zawierać tylko małe litery, cyfry i myślniki (np. „program-zajec”).";
  }
  /**
   * Zarezerwowane sprawdzamy dla adresów JEDNOSEGMENTOWYCH, a nie dla „braku
   * rodzica". To nie to samo: NAGŁÓWEK nie ma adresu (`full_path` jest NULL),
   * więc jego dziecko dostaje adres jednosegmentowy mimo istniejącego rodzica —
   * tak powstało dzisiejsze `/faq` pod nagłówkiem „ZAJĘCIA".
   *
   * Przy warunku `!parentId` dało się więc dodać pod nagłówkiem stronę o adresie
   * `kontakt` albo `galeria`: wiersz legalny w bazie, w panelu „opublikowany",
   * a publicznie NIGDY nierenderowany, bo plik trasy ma pierwszeństwo przed
   * trasą catch-all. Strona-widmo, której redaktor nie ma jak zdiagnozować.
   */
  const jednosegmentowy = !adresRodzica || adresRodzica === "/";
  if (jednosegmentowy && RESERVED_SLUGS.has(slug)) {
    return `Adres „/${slug}” jest zajęty przez stałą część serwisu. Wybierz inny.`;
  }

  const sb = klient();

  // `neq("kind","link")`, a nie `eq("kind","page")`: od wariantu A nagłówek też
  // ma slug i też zajmuje adres wśród rodzeństwa. Z poprzednim filtrem kolizja
  // strony z nagłówkiem-rodzeństwem przechodziła walidację i odbijała się
  // dopiero od indeksu `pages_parent_slug_key` — czyli redaktor dostawał
  // surowy błąd bazy zamiast zdania po polsku.
  const { data: rodzenstwo, error: bladRodzenstwa } = await sb
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .neq("kind", "link")
    .filter("parent_id", parentId ? "eq" : "is", parentId ?? null);
  if (bladRodzenstwa) return `Nie udało się sprawdzić adresu: ${bladRodzenstwa.message}`;
  if ((rodzenstwo ?? []).some((w) => w.id !== wykluczId)) {
    return "W tym samym miejscu jest już pozycja o takim adresie.";
  }
  return null;
}

/** Czy pod tym adresem prowadzi dziś przekierowanie — patrz zasada 3 w nagłówku. */
async function sprawdzPrzekierowanie(adres: string): Promise<string | null> {
  const { data, error } = await klient()
    .from("redirects")
    .select("old_path,new_path")
    .eq("old_path", adres)
    .maybeSingle();
  if (error) return null; // brak tabeli albo błąd odczytu nie może blokować zapisu treści
  if (data) {
    return (
      `Adres „${adres}” jest dziś przekierowaniem na „${data.new_path}”. ` +
      "Utworzenie tu strony wyłączyłoby to przekierowanie po cichu — najpierw usuń je z listy przekierowań."
    );
  }
  return null;
}

/**
 * Kombinacje, które model dopuszcza, a interfejs nie powinien.
 * Odrzucamy z wyjaśnieniem — patrz zasada 2 w nagłówku.
 */
function sprawdzWidocznosc(wezel: {
  kind: RodzajWezla;
  depth: number;
  in_menu: boolean;
  published: boolean;
}): string | null {
  if (wezel.in_menu && !wezel.published) {
    return (
      "Strona jest ukryta (nieopublikowana), więc nie może być w menu — odnośnik prowadziłby do 404. " +
      "Najpierw ją opublikuj albo odznacz „pokaż w menu”."
    );
  }
  // Reguły „trzeci poziom nie może być w menu" TU JUŻ NIE MA, świadomie.
  // Stała do 2026-09-07 i wynikała z założenia, że rozwijane menu renderuje
  // dwa poziomy. Właściciel je odwołał („nigdy nie ustalałem, że ma być
  // ukryty, to tylko mniejsza kreska i czcionka w menu"), a `buildNavTree`
  // renderuje teraz trzy. Skutek uboczny starej reguły był gorszy niż ona
  // sama: żeby PRZENIEŚĆ stronę na trzeci poziom, trzeba ją było wpierw ukryć,
  // bo `przesun("wsun")` przechodziło przez tę walidację z niezmienionym
  // `in_menu` — zgłoszone jako „żeby przenieść ją na 3 poziom musiałem
  // najpierw ukryć".
  if (wezel.kind === "header" && !wezel.in_menu) {
    return "Nagłówek grupujący istnieje tylko po to, żeby był w menu — nie da się go ukryć.";
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Rewalidacja
//
// W repo jest ZERO `revalidateTag` i zero `unstable_cache` — całe unieważnianie
// stoi na `revalidatePath` z literałami. „Rewalidacja poddrzewa" nie ma więc na
// czym stanąć jako pojęcie: akcja musi SAMA wyliczyć listę ścieżek (starych
// i nowych, węzła i każdego potomka) i zawołać `revalidatePath` dla każdej.
// Bez tego strony z `revalidate = 300/3600` trzymają stary adres do pięciu
// minut albo godziny.
// ─────────────────────────────────────────────────────────────────────────────

async function sciezkiPoddrzewa(id: string): Promise<string[]> {
  const sb = klient();
  const sciezki: string[] = [];
  let poziom = [id];
  for (let i = 0; i < 3 && poziom.length; i++) {
    const { data } = await sb.from("pages").select("id,full_path").in("parent_id", poziom);
    const wiersze = data ?? [];
    for (const w of wiersze) if (w.full_path) sciezki.push(w.full_path as string);
    poziom = wiersze.map((w) => w.id as string);
  }
  const { data: sam } = await sb.from("pages").select("full_path").eq("id", id).maybeSingle();
  if (sam?.full_path) sciezki.push(sam.full_path as string);
  return sciezki;
}

function odswiez(sciezki: string[]) {
  for (const s of new Set(sciezki)) revalidatePath(s);
  // Menu siedzi w layoucie, więc zmiana etykiety albo widoczności dotyczy
  // KAŻDEJ trasy, nie tylko tej jednej.
  revalidatePath("/", "layout");
}

// ─────────────────────────────────────────────────────────────────────────────
// Zapis
// ─────────────────────────────────────────────────────────────────────────────

export interface NowyWezel {
  parentId: string | null;
  kind: RodzajWezla;
  title: string;
  slug?: string;
  externalUrl?: string;
  menuLabel?: string;
  inMenu: boolean;
  published: boolean;
}

export async function dodajWezel(input: NowyWezel): Promise<WynikZ<{ id: string }>> {
  await requireUser();
  const sb = klient();

  const title = input.title.trim();
  if (!title) return blad("Podaj nazwę — bez niej pozycja nie ma czego pokazać w menu.");

  let depth = 0;
  // Adres rodzica czytamy RAZ i przekazujemy dalej. Wcześniej to samo pytanie
  // szło do bazy drugi raz przy liczeniu przewidywanego adresu, a walidacja
  // sluga nie znała go wcale — i dlatego nie umiała rozpoznać, że dziecko
  // nagłówka dostanie adres jednosegmentowy.
  let adresRodzica: string | null = null;
  if (input.parentId) {
    const { data: rodzic, error } = await sb
      .from("pages")
      .select("id,kind,depth,full_path")
      .eq("id", input.parentId)
      .maybeSingle();
    if (error) return blad(`Nie udało się sprawdzić miejsca w drzewie: ${error.message}`);
    if (!rodzic) return blad("Miejsce, w którym chcesz dodać stronę, już nie istnieje.");
    if (rodzic.kind === "link") return blad("Odnośnik zewnętrzny nie może mieć podstron.");
    if ((rodzic.depth as number) >= 2) return blad("Drzewo ma najwyżej trzy poziomy.");
    depth = (rodzic.depth as number) + 1;
    adresRodzica = (rodzic.full_path as string) ?? null;
  }

  const bladWidocznosci = sprawdzWidocznosc({
    kind: input.kind,
    depth,
    in_menu: input.inMenu,
    published: input.published,
  });
  if (bladWidocznosci) return blad(bladWidocznosci);

  const wiersz: Record<string, unknown> = {
    parent_id: input.parentId,
    kind: input.kind,
    source: "db",
    title,
    menu_label: input.menuLabel?.trim() || null,
    in_menu: input.inMenu,
    published: input.published,
    blocks: [],
  };

  if (input.kind === "page" || input.kind === "header") {
    const slug = (input.slug ?? "").trim().toLowerCase();

    /**
     * NAGŁÓWEK MOŻE MIEĆ ADRES, ale nie musi (decyzja D1, wariant A).
     *
     * Nagłówek ze slugiem wnosi swój segment do adresów podstron i działa jak
     * folder: `/program-nauczania/ucz/ww`. Nagłówek bez sluga jest dla ścieżki
     * przezroczysty, czyli zachowuje się dokładnie tak, jak wszystkie nagłówki
     * przed tą zmianą — i dlatego dzisiejsze `/faq` pod „ZAJĘCIA” zostaje
     * jednosegmentowe.
     *
     * Dla strony slug dalej jest OBOWIĄZKOWY: strona bez adresu nie istnieje.
     */
    if (!slug) {
      if (input.kind === "page") return blad("Podaj adres strony (fragment po ukośniku).");
    } else {
      const bladSluga = await sprawdzSlug(slug, input.parentId, adresRodzica);
      if (bladSluga) return blad(bladSluga);

      // Przewidywany adres liczymy tak samo jak trigger, żeby móc sprawdzić
      // kolizję z przekierowaniem PRZED zapisem, a nie po nim.
      const baza = adresRodzica && adresRodzica !== "/" ? adresRodzica : "";
      const przewidywany = `${baza}/${slug}`;
      const bladPrzekierowania = await sprawdzPrzekierowanie(przewidywany);
      if (bladPrzekierowania) return blad(bladPrzekierowania);

      wiersz.slug = slug;
    }
  } else if (input.kind === "link") {
    const url = (input.externalUrl ?? "").trim();
    if (!/^https?:\/\//.test(url)) return blad("Odnośnik musi zaczynać się od http:// albo https://");
    wiersz.external_url = url;
  }

  // Pozycja na końcu rodzeństwa — nowa pozycja nie może przestawiać istniejących.
  // Przez `przenumeruj`, a nie przez `max(position) + 1`: po skasowaniu pozycji
  // ze środka listy numery mają dziury, a wtedy „max + 1" rozjeżdża się z liczbą
  // wierszy i pierwsze przesunięcie znów zderza dwa węzły na jednym numerze.
  try {
    wiersz.position = (await przenumeruj(input.parentId)).length;
  } catch (e) {
    return blad(e instanceof Error ? e.message : "Nie udało się ustalić kolejności.");
  }

  const { data, error } = await sb.from("pages").insert(wiersz).select("id,full_path").maybeSingle();
  if (error) return blad(czytelnyBlad(error.message));

  odswiez(data?.full_path ? [data.full_path as string] : []);
  return { ok: true, dane: { id: data!.id as string } };
}

export interface ZmianaWezla {
  title?: string;
  slug?: string;
  kicker?: string | null;
  intro?: string | null;
  menuLabel?: string | null;
  externalUrl?: string;
  inMenu?: boolean;
  published?: boolean;
  blocks?: NewsBlock[];
}

export async function zapiszWezel(id: string, zmiana: ZmianaWezla): Promise<Wynik> {
  const { user } = await requireUser();
  const sb = klient();

  const { data: przed, error: bladOdczytu } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (bladOdczytu) return blad(`Nie udało się wczytać strony: ${bladOdczytu.message}`);
  if (!przed) return blad("Ta strona już nie istnieje — ktoś mógł ją usunąć w międzyczasie.");
  const stary = przed as unknown as WezelPanelu;

  const docelowy = {
    kind: stary.kind,
    depth: stary.depth,
    in_menu: zmiana.inMenu ?? stary.in_menu,
    published: zmiana.published ?? stary.published,
  };
  const bladWidocznosci = sprawdzWidocznosc(docelowy);
  if (bladWidocznosci) return blad(bladWidocznosci);

  const aktualizacja: Record<string, unknown> = {};
  if (zmiana.title !== undefined) {
    if (!zmiana.title.trim()) return blad("Nazwa nie może być pusta.");
    aktualizacja.title = zmiana.title.trim();
  }
  if (zmiana.kicker !== undefined) aktualizacja.kicker = zmiana.kicker?.trim() || null;
  if (zmiana.intro !== undefined) aktualizacja.intro = zmiana.intro?.trim() || null;
  if (zmiana.menuLabel !== undefined) aktualizacja.menu_label = zmiana.menuLabel?.trim() || null;
  if (zmiana.inMenu !== undefined) aktualizacja.in_menu = zmiana.inMenu;
  if (zmiana.published !== undefined) aktualizacja.published = zmiana.published;
  if (zmiana.blocks !== undefined) aktualizacja.blocks = zmiana.blocks;
  if (zmiana.externalUrl !== undefined && stary.kind === "link") {
    if (!/^https?:\/\//.test(zmiana.externalUrl.trim()))
      return blad("Odnośnik musi zaczynać się od http:// albo https://");
    aktualizacja.external_url = zmiana.externalUrl.trim();
  }

  // Zmiana adresu jest osobną kategorią: dotyka wyszukiwarki i wszystkich
  // potomków, więc wymaga kompletu sprawdzeń i zebrania ścieżek PRZED zapisem.
  // `stary.kind !== "link"`, a nie `=== "page"`: od wariantu A nagłówek też ma
  // adres i redaktor musi mieć jak go zmienić. Bez tego warunku nagłówek dostał
  // slug przy zamianie rodzaju i zostawał z nim na zawsze, bo panel nie miał
  // ścieżki zapisu — cała decyzja D1 byłaby wtedy dostępna tylko z SQL Editora.
  const zmianaSluga =
    zmiana.slug !== undefined &&
    stary.kind !== "link" &&
    zmiana.slug.trim().toLowerCase() !== (stary.slug ?? "");
  let sciezkiPrzed: string[] = [];
  if (zmianaSluga) {
    if (stary.source === "route")
      return blad("Tej strony nie da się przenieść pod inny adres — obsługuje ją stała część serwisu.");
    const slug = zmiana.slug!.trim().toLowerCase();

    /**
     * Pusty adres na NAGŁÓWKU znaczy „wróć do bycia przezroczystym”.
     *
     * To jest jedyny sposób, żeby cofnąć nadanie nagłówkowi segmentu — a cofnąć
     * musi się dać, bo operacja przestawia adresy całej gałęzi pod spodem.
     * Dla strony pusty adres dalej jest błędem: `pages_kind_fields_chk` i tak
     * by go nie przyjął, a komunikat z bazy nie powiedziałby redaktorowi nic.
     */
    if (!slug && stary.kind !== "header") {
      return blad("Podaj adres strony (fragment po ukośniku).");
    }

    // Adres rodzica — ta sama zasada co przy dodawaniu: rodzic-nagłówek bez
    // sluga nie ma ścieżki, więc dziecko trafia na adres jednosegmentowy
    // i musi przejść przez listę zarezerwowanych.
    let adresRodzicaStarego: string | null = null;
    if (stary.parent_id) {
      const { data: r } = await sb
        .from("pages")
        .select("full_path")
        .eq("id", stary.parent_id)
        .maybeSingle();
      adresRodzicaStarego = (r?.full_path as string) ?? null;
    }
    if (slug) {
      const bladSluga = await sprawdzSlug(slug, stary.parent_id, adresRodzicaStarego, id);
      if (bladSluga) return blad(bladSluga);
    }
    sciezkiPrzed = await sciezkiPoddrzewa(id);
    // `null`, a nie `""` — pages_slug_format_chk odrzuca pusty napis, a NULL
    // jest jedyną wartością, którą trigger czyta jako „nagłówek przezroczysty".
    aktualizacja.slug = slug || null;
  }

  if (!Object.keys(aktualizacja).length) return { ok: true };

  aktualizacja.updated_by = user.email ?? null;

  // Migawka PRZED nadpisaniem — historia ma zawierać stany, do których da się
  // wrócić. `entity_type = 'page_node'` nie wymaga zmian w schemacie.
  await zapiszWersje("page", id, stary, user.email ?? null);

  const { error } = await sb.from("pages").update(aktualizacja).eq("id", id);
  if (error) return blad(czytelnyBlad(error.message));

  odswiez([...sciezkiPrzed, ...(await sciezkiPoddrzewa(id))]);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Przestawianie — punktowe UPDATE na przenoszonym węźle i jego rodzeństwie
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pozycje rodzeństwa jako 0, 1, 2, … — bez dziur i bez duplikatów.
 *
 * DLACZEGO KAŻDA ZMIANA UKŁADU MUSI PRZEJŚĆ TĘDY. Kolumna `position` ma sens
 * wyłącznie wewnątrz jednego rodzica, a `pages_parent_position_idx` nie jest
 * unikalny, więc dwoje rodzeństwa może mieć tę samą pozycję. Z duplikatem:
 *   • zamiana pozycji dwóch wierszy zapisuje DWA RAZY tę samą liczbę — akcja
 *     kończy się sukcesem i nic się nie rusza,
 *   • `order("position")` przy remisie zwraca kolejność nieokreśloną, więc
 *     `indexOf` raz wskazuje pierwszy element i „wsuń" odmawia bez powodu.
 * Duplikaty brały się z tego, że zmiana rodzica ustawiała `parent_id`, a węzeł
 * przyjeżdżał do nowego rodzeństwa ze STARYM numerem pozycji.
 *
 * Zwraca uporządkowaną listę id — po tym wywołaniu `position` każdego wiersza
 * jest równa jego indeksowi w zwróconej tablicy, więc wywołujący nie musi
 * czytać bazy po raz drugi ani zgadywać, co tam faktycznie stoi.
 */
async function przenumeruj(parentId: string | null): Promise<string[]> {
  const sb = klient();
  const { data, error } = await sb
    .from("pages")
    .select("id,position")
    .filter("parent_id", parentId ? "eq" : "is", parentId ?? null)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw new Error(`Nie udało się przeliczyć kolejności: ${error.message}`);

  const rodzenstwo = data ?? [];
  for (let i = 0; i < rodzenstwo.length; i++) {
    // Punktowo i tylko to, co się faktycznie rusza — zasada 1 z nagłówka pliku.
    if ((rodzenstwo[i].position as number) === i) continue;
    const { error: bladZapisu } = await sb
      .from("pages")
      .update({ position: i })
      .eq("id", rodzenstwo[i].id);
    if (bladZapisu) throw new Error(`Nie udało się zapisać kolejności: ${bladZapisu.message}`);
  }
  return rodzenstwo.map((r) => r.id as string);
}

export type Kierunek = "gora" | "dol" | "wsun" | "wysun";

export async function przesun(id: string, kierunek: Kierunek): Promise<Wynik> {
  await requireUser();
  const sb = klient();

  const { data: wezel } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (!wezel) return blad("Ta pozycja już nie istnieje.");
  const w = wezel as unknown as WezelPanelu;

  // Kolejność bierzemy z PRZENUMEROWANEGO rodzeństwa. Od tej linii `position`
  // każdego rodzeństwa jest równa jego indeksowi, więc zamiana dwóch pozycji
  // zawsze coś zmienia, a „nad tą pozycją nie ma innej" znaczy to, co mówi.
  let rodzenstwo: string[];
  try {
    rodzenstwo = await przenumeruj(w.parent_id);
  } catch (e) {
    return blad(e instanceof Error ? e.message : "Nie udało się przeliczyć kolejności.");
  }
  const i = rodzenstwo.indexOf(id);
  if (i < 0) return blad("Ta pozycja już nie istnieje.");

  if (kierunek === "gora" || kierunek === "dol") {
    const j = kierunek === "gora" ? i - 1 : i + 1;
    if (j < 0 || j >= rodzenstwo.length) return blad("Ta pozycja jest już na skraju.");
    const e1 = await sb.from("pages").update({ position: j }).eq("id", id);
    if (e1.error) return blad(czytelnyBlad(e1.error.message));
    const e2 = await sb.from("pages").update({ position: i }).eq("id", rodzenstwo[j]);
    if (e2.error) return blad(czytelnyBlad(e2.error.message));
    odswiez([]);
    return { ok: true };
  }

  const sciezkiPrzed = await sciezkiPoddrzewa(id);
  const staryRodzic = w.parent_id;

  if (kierunek === "wsun") {
    // Nowym rodzicem zostaje poprzednie rodzeństwo — tak jak w edytorach list.
    if (i <= 0) return blad("Nie ma nad czym wsunąć — nad tą pozycją nie ma innej.");
    const { data: nowyRodzic } = await sb
      .from("pages")
      .select("id,kind,depth")
      .eq("id", rodzenstwo[i - 1])
      .maybeSingle();
    if (!nowyRodzic) return blad("Pozycja powyżej właśnie zniknęła — odśwież ekran.");
    if (nowyRodzic.kind === "link") return blad("Odnośnik zewnętrzny nie może mieć podstron.");
    if ((nowyRodzic.depth as number) >= 2) return blad("Drzewo ma najwyżej trzy poziomy.");
    const bladW = sprawdzWidocznosc({
      kind: w.kind,
      depth: (nowyRodzic.depth as number) + 1,
      in_menu: w.in_menu,
      published: w.published,
    });
    if (bladW) return blad(bladW);

    // Ląduje jako OSTATNIE dziecko pozycji powyżej — i dostaje własną pozycję.
    // Bez drugiego pola w tym UPDATE węzeł przyjeżdża tu ze starym numerem
    // i tworzy duplikat u nowego rodzica; to był ten błąd.
    const { data: dzieciNowego } = await sb
      .from("pages")
      .select("id")
      .eq("parent_id", nowyRodzic.id)
      .is("deleted_at", null);
    const { error } = await sb
      .from("pages")
      .update({ parent_id: nowyRodzic.id as string, position: (dzieciNowego ?? []).length })
      .eq("id", id);
    if (error) return blad(czytelnyBlad(error.message));

    try {
      await przenumeruj(staryRodzic); // zamknij dziurę po sobie
      await przenumeruj(nowyRodzic.id as string);
    } catch (e) {
      return blad(e instanceof Error ? e.message : "Nie udało się przeliczyć kolejności.");
    }
  } else {
    if (!staryRodzic) return blad("Ta pozycja jest już na najwyższym poziomie.");
    const { data: rodzic } = await sb
      .from("pages")
      .select("id,parent_id")
      .eq("id", staryRodzic)
      .maybeSingle();
    if (!rodzic) return blad("Strona nadrzędna właśnie zniknęła — odśwież ekran.");
    const dziadek = (rodzic.parent_id as string) ?? null;

    /**
     * Wysunięcie SKRACA adres, więc może wepchnąć stronę na adres zarezerwowany
     * dla stałej części serwisu: `/o-shorinji/kontakt` wysunięte na górny
     * poziom to `/kontakt`. Lista zarezerwowanych nie ma odpowiednika w bazie
     * (żaden indeks ani CHECK jej nie pilnuje), a plik trasy ma pierwszeństwo
     * przed trasą catch-all — powstałaby więc strona legalna w bazie i nigdy
     * nierenderowana. Ta sama strona-widmo, co przy dodawaniu, tylko innymi
     * drzwiami: `przesun` nie woła `sprawdzSlug`.
     */
    // `w.kind !== "link"`, a nie `=== "page"`: od wariantu A nagłówek też ma
    // slug i po wysunięciu na poziom 0 też trafiłby na adres jednosegmentowy —
    // czyli mógłby usiąść na `/kontakt` albo `/galeria`.
    if (w.kind !== "link" && w.slug) {
      let adresDziadka: string | null = null;
      if (dziadek) {
        const { data: d } = await sb.from("pages").select("full_path").eq("id", dziadek).maybeSingle();
        adresDziadka = (d?.full_path as string) ?? null;
      }
      if ((!adresDziadka || adresDziadka === "/") && RESERVED_SLUGS.has(w.slug)) {
        return blad(
          `Po wysunięciu ta strona miałaby adres „/${w.slug}”, a on jest zajęty przez stałą ` +
            "część serwisu. Zmień najpierw adres tej strony.",
        );
      }
    }

    // Wysunięta pozycja staje ZARAZ POD swoim byłym rodzicem, nie na końcu
    // listy. Doklejanie na koniec jest łatwiejsze, ale wyrzuca pozycję na drugi
    // koniec ekranu — i wygląda dokładnie jak błąd, którym nie jest.
    let rodzenstwoDziadka: string[];
    try {
      rodzenstwoDziadka = await przenumeruj(dziadek);
    } catch (e) {
      return blad(e instanceof Error ? e.message : "Nie udało się przeliczyć kolejności.");
    }
    const docelowa = rodzenstwoDziadka.indexOf(rodzic.id as string) + 1;

    // Robimy miejsce, od końca — inaczej pierwszy UPDATE nadpisałby pozycję,
    // którą dopiero mamy przeczytać.
    for (let k = rodzenstwoDziadka.length - 1; k >= docelowa; k--) {
      const { error } = await sb
        .from("pages")
        .update({ position: k + 1 })
        .eq("id", rodzenstwoDziadka[k]);
      if (error) return blad(czytelnyBlad(error.message));
    }
    const { error } = await sb
      .from("pages")
      .update({ parent_id: dziadek, position: docelowa })
      .eq("id", id);
    if (error) return blad(czytelnyBlad(error.message));

    try {
      await przenumeruj(staryRodzic);
      await przenumeruj(dziadek);
    } catch (e) {
      return blad(e instanceof Error ? e.message : "Nie udało się przeliczyć kolejności.");
    }
  }

  odswiez([...sciezkiPrzed, ...(await sciezkiPoddrzewa(id))]);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Zamiana rodzaju pozycji — etap E
// ─────────────────────────────────────────────────────────────────────────────

export type KierunekZamiany = "na-naglowek" | "na-strone";

export interface SkutkiZamiany {
  mozliwe: boolean;
  /** Powód odmowy — gotowy komunikat dla redaktora. */
  powod?: string;
  /**
   * Adres, którego dotyczy zamiana.
   *
   * „na nagłówek": `z` to adres, który przestaje oddawać stronę, `na` to adres
   * pierwszej podstrony, na którą zacznie przerzucać.
   * „na stronę": `z` to adres nagłówka, który znów zacznie być stroną (`na`
   * jest wtedy puste).
   */
  adres?: { z: string; na?: string; celTytul?: string };
  /** Podstrony, których adresy zamiana zostawia bez zmian — do wypisania w dialogu. */
  bezZmianAdresu?: string[];
  /**
   * Podstrony, którym adres JEDNAK się zmieni. Po wariancie A zdarza się to
   * w jednym przypadku: nagłówek BEZ własnego adresu (przezroczysty) zamieniany
   * w stronę dopiero ten adres dostaje, więc jego podstrony wjeżdżają o segment
   * głębiej. Dokładnie tak zachowa się dzisiejsze `/faq` pod „ZAJĘCIA”.
   */
  zmianyAdresow?: { title: string; z: string; na: string }[];
  /** Przekierowania, które zamiana usunie, bo adres znów stanie się stroną. */
  usuwanePrzekierowania?: string[];
}

/**
 * Co się stanie po zamianie — do pokazania W DIALOGU, przed zapisem.
 *
 * Ten sam wzorzec co `policzPotomkow` przy usuwaniu: operacja dotykająca
 * adresów, które widziała wyszukiwarka, nie może być jednym kliknięciem
 * bez wyliczenia skutków. Redaktor ma zobaczyć, który adres komu przechodzi,
 * ZANIM się to stanie.
 */
export async function skutkiZamiany(
  id: string,
  kierunek: KierunekZamiany,
  slug?: string,
): Promise<SkutkiZamiany> {
  await requireUser();
  const sb = klient();

  const { data: wezel } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (!wezel) return { mozliwe: false, powod: "Tej pozycji już nie ma." };
  const w = wezel as unknown as WezelPanelu;

  if (w.deleted_at) {
    return { mozliwe: false, powod: "Ta pozycja jest w koszu — przywróć ją najpierw." };
  }
  if (w.kind === "link") {
    return {
      mozliwe: false,
      powod: "Odnośniki zewnętrzne nie mają tej funkcji — dotyczy tylko przejścia strona ↔ nagłówek.",
    };
  }

  const { data: dzieciRaw } = await sb
    .from("pages")
    .select("id,title,kind,source,slug,full_path,position")
    .eq("parent_id", id)
    .is("deleted_at", null)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  const dzieci = dzieciRaw ?? [];

  if (kierunek === "na-naglowek") {
    if (w.kind !== "page") {
      return { mozliwe: false, powod: "Ta pozycja już jest nagłówkiem. Odśwież ekran." };
    }
    if (w.source === "route") {
      return {
        mozliwe: false,
        powod:
          "Tej pozycji nie da się zamienić w nagłówek — jej adres i układ na stałe " +
          "obsługuje kod serwisu, nie panel.",
      };
    }
    if (w.depth >= 2) {
      return {
        mozliwe: false,
        powod:
          "Ta strona jest na trzecim poziomie, a nagłówek istnieje po to, żeby coś " +
          "grupować — czwartego poziomu drzewo nie ma, więc nie miałby czego.",
      };
    }

    /**
     * Ukrytej strony nie zamieniamy w nagłówek — i to jest odmowa DOŁOŻONA
     * razem z wariantem A, a nie odziedziczona.
     *
     * `strona_na_naglowek` ustawia `in_menu = true` (wymaga tego
     * `pages_header_visible_chk`), a `published` zostawia. Dla ukrytej strony
     * dałoby to wiersz `header, in_menu = true, published = false` — czyli
     * dokładnie tę kombinację, którą `sprawdzWidocznosc` odrzuca wszędzie
     * indziej, bo pozycja menu prowadziłaby do strony, której nie ma.
     *
     * Poprzednia wersja funkcji SQL rozwiązywała to wymuszeniem
     * `published = true`. Przy ukrywaniu liczonym po gałęzi (A6) byłoby to
     * gorsze: zamiana rodzaju po cichu odkrywałaby całą gałąź pod spodem.
     * Zamiana rodzaju ma zmieniać rodzaj, nie widoczność — więc pytamy wprost.
     */
    if (!w.published) {
      return {
        mozliwe: false,
        powod:
          "Ta strona jest ukryta, a nagłówek grupujący musi być widoczny w menu. " +
          "Opublikuj ją najpierw, potem zamień na nagłówek.",
      };
    }

    const kandydaci = dzieci.filter((d) => d.kind === "page" && d.source === "db");
    if (kandydaci.length === 0) {
      return {
        mozliwe: false,
        powod:
          "Ta strona nie ma ani jednej zwykłej podstrony, więc po zamianie jej adres „" +
          (w.full_path ?? "") +
          "” nie miałby dokąd przerzucać — zostałby twardym 404. " +
          "Dodaj najpierw podstronę treściową.",
      };
    }

    /**
     * WARIANT A: nagłówek ZATRZYMUJE adres, żadna podstrona się nie rusza.
     *
     * Do 2026-09-08 adres nagłówka przejmowała PIERWSZA podstrona, a pozostałym
     * urywał się jeden segment. Właściciel po trzeciej rundzie: „imo powinno
     * zostać w takim przypadku `ucz` w adresie, czemu nie, czytelniej”.
     *
     * Dlatego nie ma tu już ani liczenia nowych adresów, ani pętli po
     * `kolizjaAdresu`: skoro żaden adres się nie zmienia, nie ma z czym
     * kolidować. Jedyny skutek to ten, że pod adresem nagłówka przestaje być
     * strona — i on jeden dostaje przekierowanie na pierwszą podstronę.
     *
     * Kolejność `position, id` musi być ta sama, co w `strona_na_naglowek`
     * w SQL-u, inaczej dialog zapowiadałby inny cel niż ten, który powstanie.
     */
    const cel = kandydaci[0];

    return {
      mozliwe: true,
      adres: {
        z: w.full_path ?? "",
        na: (cel.full_path as string) ?? "",
        celTytul: cel.title as string,
      },
      bezZmianAdresu: dzieci
        .filter((d) => d.full_path)
        .map((d) => `${d.title} (${d.full_path})`),
    };
  }

  // ── kierunek „na stronę" ──────────────────────────────────────────────────
  if (w.kind !== "header") {
    return { mozliwe: false, powod: "Ta pozycja już jest stroną. Odśwież ekran." };
  }
  /**
   * ADRES JUŻ JEST — w wariancie A nagłówek go nigdy nie oddał.
   *
   * Do 2026-09-08 panel PYTAŁ redaktora o adres (`prompt` w TreeManagerze),
   * bo nagłówek żadnego nie miał. Teraz pytanie byłoby wręcz szkodliwe:
   * nagłówek trzyma swój `full_path`, jego podstrony liczą swoje adresy
   * względem niego i podanie innego sluga przestawiłoby całą gałąź przy
   * operacji, którą redaktor rozumie jako „przywróć stronę”.
   *
   * `slug` jest w sygnaturze dalej — wołający mogą go podać, gdy nagłówek
   * adresu NIE ma (był założony jako nagłówek, więc jest przezroczysty).
   */
  const czysty = (slug ?? w.slug ?? "").trim().toLowerCase();
  if (!czysty) {
    return {
      mozliwe: false,
      powod:
        "Ten nagłówek nie ma własnego adresu, więc nie ma czego przywrócić. " +
        "Nadaj mu najpierw adres w edycji pozycji, potem zamień na stronę.",
    };
  }

  let adresRodzica: string | null = null;
  if (w.parent_id) {
    const { data: r } = await sb.from("pages").select("full_path").eq("id", w.parent_id).maybeSingle();
    adresRodzica = (r?.full_path as string) ?? null;
  }
  const bladSluga = await sprawdzSlug(czysty, w.parent_id, adresRodzica, id);
  if (bladSluga) return { mozliwe: false, powod: bladSluga };

  const baza = adresRodzica && adresRodzica !== "/" ? adresRodzica : "";
  const nowyAdres = `${baza}/${czysty}`;

  /**
   * Przekierowanie pod nowym adresem — z jednym wyjątkiem: ZWROTNYM.
   *
   * Zamiana strony w nagłówek zostawia 308 ze starego adresu na podstronę,
   * która ten adres przejęła (`/zajecia` → `/faq`). Gdy redaktor chce wrócić —
   * zamienić nagłówek z powrotem w stronę pod tym samym adresem — ogólna
   * zasada 3 („nie zakładaj strony pod istniejącym przekierowaniem") kazała mu
   * najpierw usunąć wpis z listy przekierowań. Tylko że TAKIEJ LISTY W PANELU
   * NIE MA: komunikat kazał zrobić rzecz, której nie da się zrobić, a operacja
   * była nieodwracalna jednym kliknięciem.
   *
   * Wyjątek jest wąski: cel przekierowania musi leżeć w podstronach TEGO
   * nagłówka. Wtedy wpis jest naszą własną pozostałością, a nie cudzym,
   * zaindeksowanym adresem — po zamianie i tak przestałby cokolwiek robić,
   * bo przekierowania czyta `przekierujAlboNotFound`, czyli dopiero PO
   * nieudanym odczycie strony. Zostawiony w tabeli byłby po prostu nieprawdą.
   * Usuwamy go razem z zamianą i wypisujemy w dialogu.
   */
  const { data: przek } = await sb
    .from("redirects")
    .select("old_path,new_path")
    .eq("old_path", nowyAdres)
    .maybeSingle();

  let doUsunieciaPrzekierowanie: string | null = null;
  if (przek) {
    const adresyPodstron = dzieci
      .map((d) => d.full_path as string | null)
      .filter((p): p is string => Boolean(p));
    const wlasne = adresyPodstron.some(
      (p) => p === przek.new_path || (przek.new_path as string).startsWith(p + "/"),
    );
    if (!wlasne) {
      return {
        mozliwe: false,
        powod:
          `Adres „${nowyAdres}" jest dziś przekierowaniem na „${przek.new_path}", ` +
          "które nie należy do tej gałęzi. Strona pod tym adresem wyłączyłaby je po cichu — " +
          "wybierz inny adres.",
      };
    }
    doUsunieciaPrzekierowanie = przek.old_path as string;
  }

  /**
   * DWA RÓŻNE PRZYPADKI, których nie wolno pomylić.
   *
   * (a) Nagłówek MA już własny adres — powstał z zamiany strony w wariancie A.
   *     Powrót to czysta zmiana rodzaju: `full_path` się nie rusza, więc żadna
   *     podstrona nie zmienia adresu.
   *
   * (b) Nagłówek NIE MA adresu — był założony jako nagłówek i dla ścieżki jest
   *     przezroczysty. Nadanie mu adresu wsuwa jego podstrony o segment głębiej.
   *     Tak zachowa się dzisiejsze „ZAJĘCIA": `/faq` wyszłoby na `/zajecia/faq`.
   *     To są adresy, które zna wyszukiwarka, więc dialog MUSI o tym uprzedzić.
   *
   * Napisanie tego bez rozróżnienia było moim błędem przy wdrażaniu D1 —
   * wyłapała go dopiero kontrola przeciwna w teście odbioru, na prawdziwym
   * nagłówku „ZAJĘCIA".
   */
  const mialWlasnyAdres = Boolean(w.slug);
  const zmiany = mialWlasnyAdres
    ? []
    : dzieci
        .filter((d) => d.kind === "page" && d.source === "db")
        .map((d) => ({
          title: d.title as string,
          z: (d.full_path as string) ?? "",
          na: `${nowyAdres}/${d.slug as string}`,
        }));

  return {
    mozliwe: true,
    adres: { z: nowyAdres },
    ...(zmiany.length ? { zmianyAdresow: zmiany } : {}),
    bezZmianAdresu: dzieci
      .filter((d) => d.full_path && !zmiany.some((z) => z.z === d.full_path))
      .map((d) => `${d.title} (${d.full_path})`),
    ...(doUsunieciaPrzekierowanie
      ? { usuwanePrzekierowania: [`${doUsunieciaPrzekierowanie} → ${przek?.new_path}`] }
      : {}),
  };
}

/** Komunikaty dla tokenów, którymi odzywa się funkcja `strona_na_naglowek`. */
function bladZamiany(komunikat: string): string | null {
  if (komunikat.includes("ZAMIANA_BRAK_WEZLA")) return "Tej pozycji już nie ma.";
  if (komunikat.includes("ZAMIANA_NIE_STRONA")) return "Ta pozycja przestała być stroną. Odśwież ekran.";
  if (komunikat.includes("ZAMIANA_ROUTE"))
    return "Tej pozycji nie da się zamienić w nagłówek — jej adres obsługuje kod serwisu.";
  if (komunikat.includes("ZAMIANA_GLEBOKOSC")) return "Na trzecim poziomie nagłówek się nie zmieści.";
  if (komunikat.includes("ZAMIANA_BRAK_DZIECKA"))
    return "Ta strona nie ma już podstrony, która mogłaby przejąć jej adres. Odśwież ekran.";
  // ZAMIANA_WIELE_DZIECI zostaje w tłumaczeniu, choć nowa wersja funkcji tego
  // już nie podnosi: na produkcji może stać jeszcze STARA wersja
  // `strona_na_naglowek` (05-zamiana-rodzaju.sql wkleja się ręcznie w SQL
  // Editorze). Bez tego wpisu redaktor zobaczyłby surowy tekst wyjątku.
  if (komunikat.includes("ZAMIANA_WIELE_DZIECI"))
    return (
      "Baza odmawia zamiany przy kilku podstronach — najpewniej stoi na niej starsza " +
      "wersja funkcji strona_na_naglowek. Do wklejenia: supabase/05-zamiana-rodzaju.sql."
    );
  return null;
}

export async function zamienRodzaj(
  id: string,
  kierunek: KierunekZamiany,
  slug?: string,
): Promise<Wynik> {
  const { user } = await requireUser();
  const sb = klient();

  // Walidacja przechodzi tą samą drogą, którą liczony jest podgląd skutków —
  // dzięki temu dialog i zapis nie mogą się rozjechać oceną „da się / nie da".
  const skutki = await skutkiZamiany(id, kierunek, slug);
  if (!skutki.mozliwe) return blad(skutki.powod ?? "Nie da się zamienić rodzaju tej pozycji.");

  const sciezkiPrzed = await sciezkiPoddrzewa(id);

  // Migawka PRZED zamianą — ten sam mechanizm co przy zapisie węzła. Zamiana
  // rodzaju przestawia adresy, więc stan sprzed niej jest tym, do którego
  // najczęściej trzeba będzie wrócić.
  const { data: stary } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  await zapiszWersje("page", id, stary, user.email ?? null);

  if (kierunek === "na-naglowek") {
    // Jedno wywołanie funkcji w bazie = jedna transakcja. Dwa osobne UPDATE-y
    // z panelu zostawiłyby przy awarii w połowie adres bez strony i bez
    // przekierowania — patrz nagłówek supabase/05-zamiana-rodzaju.sql.
    const { error } = await sb.rpc("strona_na_naglowek", { p_id: id });
    if (error) {
      return blad(bladZamiany(error.message) ?? czytelnyBlad(error.message));
    }
  } else {
    /**
     * Slug zapisujemy TYLKO wtedy, gdy nagłówek go nie miał.
     *
     * W wariancie A nagłówek zachowuje własny adres, więc powrót na stronę to
     * czysta zmiana rodzaju — `full_path` nie zmienia się ani o znak i trigger
     * nie ma nawet powodu dotykać poddrzewa. Bezwarunkowe
     * `slug: (slug ?? "").trim()` wysyłałoby tu pusty napis i wywracało zapis
     * na `pages_slug_format_chk`; a gdyby slug był podany mimo istniejącego
     * adresu, przestawiłoby adresy całej gałęzi przy operacji, którą redaktor
     * rozumie jako „przywróć stronę".
     */
    const nowySlug = (slug ?? "").trim().toLowerCase();
    const aktualizacja: Record<string, unknown> = { kind: "page" };
    if (nowySlug) aktualizacja.slug = nowySlug;

    const { error } = await sb.from("pages").update(aktualizacja).eq("id", id);
    if (error) return blad(czytelnyBlad(error.message));

    /**
     * Zwrotne przekierowanie sprzątamy PO udanym UPDATE, nie przed.
     *
     * Kolejność jest tu jedyną ochroną: gdyby wpis poleciał pierwszy, a UPDATE
     * padł, adres zostałby bez strony I bez przekierowania — twarde 404 na
     * adresie, który wyszukiwarka zna. Odwrotnie najgorsze, co zostaje, to
     * nieaktualny wiersz w `redirects`, którego nikt nie czyta (przekierowania
     * działają dopiero po nieudanym odczycie strony).
     */
    const usuwane = skutki.usuwanePrzekierowania?.[0]?.split(" → ")[0];
    if (usuwane) {
      const { error: bladUsuwania } = await sb.from("redirects").delete().eq("old_path", usuwane);
      if (bladUsuwania) {
        console.warn("[pages] nie udalo sie usunac przekierowania", usuwane, bladUsuwania.message);
      }
    }
  }

  odswiez([...sciezkiPrzed, ...(await sciezkiPoddrzewa(id))]);
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Kosz
// ─────────────────────────────────────────────────────────────────────────────

/** Potomkowie węzła — do pokazania W DIALOGU, zanim cokolwiek zniknie. */
export async function policzPotomkow(id: string): Promise<{ id: string; title: string; full_path: string | null }[]> {
  await requireUser();
  const sb = klient();
  const wynik: { id: string; title: string; full_path: string | null }[] = [];
  let poziom = [id];
  for (let i = 0; i < 3 && poziom.length; i++) {
    const { data } = await sb
      .from("pages")
      .select("id,title,full_path")
      .in("parent_id", poziom)
      .is("deleted_at", null);
    const wiersze = data ?? [];
    for (const r of wiersze)
      wynik.push({ id: r.id as string, title: r.title as string, full_path: (r.full_path as string) ?? null });
    poziom = wiersze.map((r) => r.id as string);
  }
  return wynik;
}

export async function doKosza(id: string): Promise<Wynik> {
  await requireUser();
  const sb = klient();

  const potomkowie = await policzPotomkow(id);
  const sciezki = await sciezkiPoddrzewa(id);
  const kiedy = new Date().toISOString();

  // Całe poddrzewo naraz. `ON DELETE RESTRICT` na kluczu obcym dotyczy
  // twardego kasowania — tu robimy miękkie, więc rodzic i dzieci muszą
  // trafić do kosza jednym ruchem, inaczej dzieci zostają bez rodzica w drzewie.
  const idki = [id, ...potomkowie.map((p) => p.id)];
  const { error } = await sb.from("pages").update({ deleted_at: kiedy }).in("id", idki);
  if (error) return blad(czytelnyBlad(error.message));

  odswiez(sciezki);
  return { ok: true };
}

export async function przywroc(id: string): Promise<Wynik> {
  await requireUser();
  const sb = klient();

  const { data: wezel } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (!wezel) return blad("Tej pozycji nie ma już w koszu.");
  const w = wezel as unknown as WezelPanelu;

  // Kolizję adresu trzeba sprawdzić SAMEMU: `pages_full_path_key` jest indeksem
  // CZĘŚCIOWYM (`where deleted_at is null`), więc strona w koszu nie blokuje
  // adresu — i w czasie, gdy tam leżała, ktoś mógł utworzyć inną pod tym samym.
  // Bez tego sprawdzenia przywracanie wywala się dopiero na UPDATE albo, gorzej,
  // przechodzi pod innym adresem.
  // `w.kind !== "link"` i `neq("kind","link")` zamiast dwóch razy `page`:
  // od wariantu A nagłówek też ma adres, więc też może przywrócić się na
  // adres zajęty w międzyczasie — i też może ten adres komuś zająć.
  if (w.kind !== "link" && w.full_path) {
    const { data: kolizja } = await sb
      .from("pages")
      .select("id,title")
      .eq("full_path", w.full_path)
      .neq("kind", "link")
      .is("deleted_at", null)
      .maybeSingle();
    if (kolizja) {
      return blad(
        `Pod adresem „${w.full_path}” jest teraz inna pozycja („${kolizja.title}”). ` +
          "Zmień jej adres albo adres przywracanej strony.",
      );
    }
  }

  // Rodzic mógł w międzyczasie trafić do kosza — przywrócone dziecko bez
  // żywego rodzica wisiałoby w drzewie w miejscu, którego nie ma.
  if (w.parent_id) {
    const { data: rodzic } = await sb
      .from("pages")
      .select("id,deleted_at,title")
      .eq("id", w.parent_id)
      .maybeSingle();
    if (!rodzic || rodzic.deleted_at) {
      return blad(
        "Strona nadrzędna też jest w koszu. Przywróć najpierw ją — inaczej ta pozycja nie miałaby gdzie wisieć.",
      );
    }
  }

  const { error } = await sb.from("pages").update({ deleted_at: null }).eq("id", id);
  if (error) return blad(czytelnyBlad(error.message));

  // Przywrócony węzeł wraca ze swoją starą pozycją, a rodzeństwo w tym czasie
  // zostało przenumerowane — czyli wraca prosto na cudzy numer.
  //
  // Nieudanego przenumerowania NIE przemilczamy. Samo przywrócenie już się
  // udało, więc nie jest to błąd całej operacji, ale cicha próba zostawiałaby
  // w bazie duplikat pozycji bez jednego słowa — a to jest dokładnie ten stan,
  // po którym „Przesunięte niżej." przestaje cokolwiek robić.
  let ostrzezenie = "";
  try {
    await przenumeruj(w.parent_id);
  } catch (e) {
    ostrzezenie =
      " Uwaga: nie udało się przeliczyć kolejności rodzeństwa" +
      `${e instanceof Error ? ` (${e.message})` : ""} — sprawdź kolejność i przestaw ręcznie.`;
  }

  odswiez(await sciezkiPoddrzewa(id));
  return ostrzezenie ? blad(`Przywrócone.${ostrzezenie}`) : { ok: true };
}

export async function usunTrwale(id: string): Promise<Wynik> {
  await requireUser();
  const sb = klient();
  const { data: dzieci } = await sb.from("pages").select("id").eq("parent_id", id);
  if ((dzieci ?? []).length) {
    return blad("Ta pozycja ma podstrony — usuń najpierw je, żeby nie zniknęły niezauważone.");
  }
  const { error } = await sb.from("pages").delete().eq("id", id);
  if (error) return blad(czytelnyBlad(error.message));
  return { ok: true };
}

/**
 * Komunikaty bazy przetłumaczone na język redaktora.
 *
 * Bez tego CHECK-i i triggery odzywają się do instruktora tekstem w rodzaju
 * „new row for relation pages violates check constraint pages_kind_fields_chk”,
 * z którym nie ma on co zrobić.
 */
function czytelnyBlad(komunikat: string): string {
  if (komunikat.includes("pages_full_path_key"))
    return "Pod tym adresem jest już inna strona. Wybierz inny adres.";
  if (komunikat.includes("pages_parent_slug_key"))
    return "W tym samym miejscu jest już strona o takim adresie.";
  if (komunikat.includes("pages_header_visible_chk"))
    return "Nagłówek grupujący musi być widoczny w menu.";
  if (komunikat.includes("Drzewo ma najwyżej trzy poziomy"))
    return "Drzewo ma najwyżej trzy poziomy — głębiej strony nie da się wsunąć.";
  if (komunikat.includes("pętlę")) return "Nie da się wsunąć pozycji do jej własnej podstrony.";
  // Dwa ograniczenia, ktore po wariancie A moga realnie dojsc do redaktora:
  // pierwsze przy naglowku ze zlym kompletem pol, drugie przy adresie
  // z polskimi znakami albo spacja. Bez tych wpisow zobaczylby surowy
  // komunikat Postgresa o naruszeniu ograniczenia.
  if (komunikat.includes("pages_kind_fields_chk"))
    return (
      "Ta pozycja ma niepasujący komplet pól — strona musi mieć adres, a odnośnik " +
      "zewnętrzny pełny link. Odśwież ekran i spróbuj jeszcze raz."
    );
  if (komunikat.includes("pages_slug_format_chk"))
    return "Adres może zawierać tylko małe litery, cyfry i myślniki (np. „program-zajec”).";
  return komunikat;
}

/** Jedna pozycja drzewa — do ekranu edycji. */
export async function pobierzWezel(id: string): Promise<WezelPanelu | null> {
  await requireUser();
  const { data, error } = await klient().from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (error) throw new Error(`Nie udało się wczytać strony: ${error.message}`);
  return (data as unknown as WezelPanelu) ?? null;
}
