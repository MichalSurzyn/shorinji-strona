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
  "id,parent_id,kind,source,route,slug,full_path,external_url,kicker,title,intro," +
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
    .order("position", { ascending: true });
  if (error) throw new Error(`Nie udało się wczytać drzewa: ${error.message}`);
  return (data ?? []) as unknown as WezelPanelu[];
}

export async function pobierzKosz(): Promise<WezelPanelu[]> {
  await requireUser();
  const { data, error } = await klient()
    .from("pages")
    .select(KOLUMNY)
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
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
  wykluczId?: string,
): Promise<string | null> {
  if (!WZORZEC_SLUGA.test(slug)) {
    return "Adres może zawierać tylko małe litery, cyfry i myślniki (np. „program-zajec”).";
  }
  // Zarezerwowane wyłącznie na poziomie zerowym: `/admin` koliduje z panelem,
  // ale `/program-nauczania/admin` już z niczym nie koliduje.
  if (!parentId && RESERVED_SLUGS.has(slug)) {
    return `Adres „/${slug}” jest zajęty przez stałą część serwisu. Wybierz inny.`;
  }

  const sb = klient();

  const { data: rodzenstwo, error: bladRodzenstwa } = await sb
    .from("pages")
    .select("id")
    .eq("slug", slug)
    .is("deleted_at", null)
    .eq("kind", "page")
    .filter("parent_id", parentId ? "eq" : "is", parentId ?? null);
  if (bladRodzenstwa) return `Nie udało się sprawdzić adresu: ${bladRodzenstwa.message}`;
  if ((rodzenstwo ?? []).some((w) => w.id !== wykluczId)) {
    return "W tym samym miejscu jest już strona o takim adresie.";
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
  if (wezel.in_menu && wezel.depth >= 2) {
    return (
      "Ta strona jest na trzecim poziomie. W menu na górze mieszczą się dwa poziomy — " +
      "trzeci pokazuje się jako kafelek na stronie rodzica."
    );
  }
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

  if (input.kind === "page") {
    const slug = (input.slug ?? "").trim().toLowerCase();
    if (!slug) return blad("Podaj adres strony (fragment po ukośniku).");
    const bladSluga = await sprawdzSlug(slug, input.parentId);
    if (bladSluga) return blad(bladSluga);

    // Przewidywany adres liczymy tak samo jak trigger, żeby móc sprawdzić
    // kolizję z przekierowaniem PRZED zapisem, a nie po nim.
    let adresRodzica = "";
    if (input.parentId) {
      const { data: r } = await sb.from("pages").select("full_path").eq("id", input.parentId).maybeSingle();
      adresRodzica = (r?.full_path as string) ?? "";
    }
    const przewidywany = `${adresRodzica === "/" ? "" : adresRodzica}/${slug}`;
    const bladPrzekierowania = await sprawdzPrzekierowanie(przewidywany);
    if (bladPrzekierowania) return blad(bladPrzekierowania);

    wiersz.slug = slug;
  } else if (input.kind === "link") {
    const url = (input.externalUrl ?? "").trim();
    if (!/^https?:\/\//.test(url)) return blad("Odnośnik musi zaczynać się od http:// albo https://");
    wiersz.external_url = url;
  }

  // Pozycja na końcu rodzeństwa — nowa pozycja nie może przestawiać istniejących.
  const { data: rodzenstwo } = await sb
    .from("pages")
    .select("position")
    .filter("parent_id", input.parentId ? "eq" : "is", input.parentId ?? null)
    .is("deleted_at", null);
  wiersz.position = Math.max(-1, ...(rodzenstwo ?? []).map((w) => w.position as number)) + 1;

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
  const zmianaSluga =
    zmiana.slug !== undefined && stary.kind === "page" && zmiana.slug.trim().toLowerCase() !== stary.slug;
  let sciezkiPrzed: string[] = [];
  if (zmianaSluga) {
    if (stary.source === "route")
      return blad("Tej strony nie da się przenieść pod inny adres — obsługuje ją stała część serwisu.");
    const slug = zmiana.slug!.trim().toLowerCase();
    const bladSluga = await sprawdzSlug(slug, stary.parent_id, id);
    if (bladSluga) return blad(bladSluga);
    sciezkiPrzed = await sciezkiPoddrzewa(id);
    aktualizacja.slug = slug;
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

export type Kierunek = "gora" | "dol" | "wsun" | "wysun";

export async function przesun(id: string, kierunek: Kierunek): Promise<Wynik> {
  await requireUser();
  const sb = klient();

  const { data: wezel } = await sb.from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (!wezel) return blad("Ta pozycja już nie istnieje.");
  const w = wezel as unknown as WezelPanelu;

  const { data: rodzenstwoRaw } = await sb
    .from("pages")
    .select("id,position,kind,depth")
    .filter("parent_id", w.parent_id ? "eq" : "is", w.parent_id ?? null)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  const rodzenstwo = rodzenstwoRaw ?? [];
  const i = rodzenstwo.findIndex((r) => r.id === id);

  if (kierunek === "gora" || kierunek === "dol") {
    const j = kierunek === "gora" ? i - 1 : i + 1;
    if (j < 0 || j >= rodzenstwo.length) return blad("Ta pozycja jest już na skraju.");
    // Zamiana pozycji dwóch wierszy, nie przepisanie całej listy.
    const a = rodzenstwo[i];
    const b = rodzenstwo[j];
    const e1 = await sb.from("pages").update({ position: b.position }).eq("id", a.id);
    if (e1.error) return blad(czytelnyBlad(e1.error.message));
    const e2 = await sb.from("pages").update({ position: a.position }).eq("id", b.id);
    if (e2.error) return blad(czytelnyBlad(e2.error.message));
    odswiez([]);
    return { ok: true };
  }

  const sciezkiPrzed = await sciezkiPoddrzewa(id);

  if (kierunek === "wsun") {
    // Nowym rodzicem zostaje poprzednie rodzeństwo — tak jak w edytorach list.
    if (i <= 0) return blad("Nie ma nad czym wsunąć — nad tą pozycją nie ma innej.");
    const nowyRodzic = rodzenstwo[i - 1];
    if (nowyRodzic.kind === "link") return blad("Odnośnik zewnętrzny nie może mieć podstron.");
    if ((nowyRodzic.depth as number) >= 2) return blad("Drzewo ma najwyżej trzy poziomy.");
    const bladW = sprawdzWidocznosc({
      kind: w.kind,
      depth: (nowyRodzic.depth as number) + 1,
      in_menu: w.in_menu,
      published: w.published,
    });
    if (bladW) return blad(bladW);
    const { error } = await sb.from("pages").update({ parent_id: nowyRodzic.id }).eq("id", id);
    if (error) return blad(czytelnyBlad(error.message));
  } else {
    if (!w.parent_id) return blad("Ta pozycja jest już na najwyższym poziomie.");
    const { data: rodzic } = await sb.from("pages").select("parent_id").eq("id", w.parent_id).maybeSingle();
    const { error } = await sb
      .from("pages")
      .update({ parent_id: (rodzic?.parent_id as string) ?? null })
      .eq("id", id);
    if (error) return blad(czytelnyBlad(error.message));
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
  if (w.kind === "page" && w.full_path) {
    const { data: kolizja } = await sb
      .from("pages")
      .select("id,title")
      .eq("full_path", w.full_path)
      .eq("kind", "page")
      .is("deleted_at", null)
      .maybeSingle();
    if (kolizja) {
      return blad(
        `Pod adresem „${w.full_path}” jest teraz inna strona („${kolizja.title}”). ` +
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

  odswiez(await sciezkiPoddrzewa(id));
  return { ok: true };
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
  return komunikat;
}

/** Jedna pozycja drzewa — do ekranu edycji. */
export async function pobierzWezel(id: string): Promise<WezelPanelu | null> {
  await requireUser();
  const { data, error } = await klient().from("pages").select(KOLUMNY).eq("id", id).maybeSingle();
  if (error) throw new Error(`Nie udało się wczytać strony: ${error.message}`);
  return (data as unknown as WezelPanelu) ?? null;
}
