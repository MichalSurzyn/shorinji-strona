/**
 * migrate-pages.mjs — etap 2 migracji drzewa stron (backfill tabeli public.pages).
 *
 * CO ROBI
 * -------
 * Wypełnia pustą tabelę `pages` węzłami odpowiadającymi dzisiejszej strukturze
 * serwisu, z pięciu źródeł (docs/menu-architektura.md §5.4):
 *
 *   1. nav_items          — pozycje menu: kolejność, etykiety, widoczność, drzewo
 *   2. lib/editablePages.ts — 8 tras edytowalnych (w tym „/" i „/kontakt",
 *                             których w nav_items NIE MA)
 *   3. data/articles/*.ts — tytuły i wstępy 10 podstron tematycznych + 3 listingi
 *   4. article_overrides  — tytuł/wstęp nadpisany przez redaktora (ma pierwszeństwo)
 *   5. custom_pages       — własne podstrony, RAZEM z `deleted_at` (kosz zostaje koszem)
 *
 * CZEGO NIE ROBI
 * --------------
 * Nie zmienia ani jednego istniejącego adresu (§5.1). Nie przenosi TREŚCI:
 * bloki podstron tematycznych to etap 7, a treść ośmiu tras edytowalnych zostaje
 * w `site_settings` — węzeł dostaje tylko wskaźnik `content_key`. Nie pisze do
 * żadnej tabeli poza `pages`. Nie kasuje niczego.
 *
 * URUCHOMIENIE
 * ------------
 *   node scripts/migrate-pages.mjs --na-sucho     ← plan bez zapisu, zawsze najpierw
 *   node scripts/migrate-pages.mjs
 *
 * Wymaga Node 22.18+ / 23.6+ (wczytuje pliki .ts wprost — patrz „ŹRÓDŁA W TS").
 *
 * IDEMPOTENCJA — ŚWIADOMIE INACZEJ NIŻ W §5.4
 * -------------------------------------------
 * §5.4 zapisuje idempotencję jako `insert ... on conflict (full_path) where
 * kind = 'page' and deleted_at is null do nothing`. Ta forma jest poprawna
 * w SQL Editorze i NIE DA SIĘ jej wysłać przez PostgREST: parametr `on_conflict=`
 * generuje `ON CONFLICT (kolumny) DO ...` bez predykatu, a bez powtórzonego
 * predykatu Postgres nie potrafi wskazać indeksu częściowego. Zmierzone na
 * poligonie, nie wywnioskowane:
 *
 *   on conflict (full_path) do nothing
 *     → 42P10 there is no unique or exclusion constraint matching the
 *       ON CONFLICT specification
 *   on conflict (full_path) where kind='page' and deleted_at is null do nothing
 *     → przechodzi
 *
 * Dlatego skrypt robi to samo o jeden krok wcześniej: NAJPIERW czyta, co już
 * jest w `pages`, potem wysyła wyłącznie brakujące wiersze. Efekt jest ten sam
 * (drugie uruchomienie niczego nie dubluje), a dodatkowo widać w raporcie, co
 * zostało pominięte i dlaczego. Indeksy unikalne z etapu 1 zostają drugim
 * zamkiem — gdyby dopasowanie tu zawiodło, baza odrzuci wiersz, zamiast wpuścić
 * duplikat adresu.
 *
 * DOPASOWANIE ISTNIEJĄCYCH WIERSZY — DWA KLUCZE, NIE JEDEN
 * --------------------------------------------------------
 * `migrated_from` jest kluczem głównym dopasowania, ale dla węzłów z nav_items
 * ma postać `nav_items:<uuid>`, a `saveNavTree` generuje wszystkie nav_items.id
 * OD NOWA przy każdym zapisie menu (actions/navActions.ts:57-121). Zapis menu
 * w panelu między jednym a drugim uruchomieniem tego skryptu unieważniłby więc
 * cały klucz i drugi przebieg wstawiłby komplet duplikatów. Dlatego jest drugi
 * klucz, odporny na tę zmianę:
 *   * kind='page'            → full_path (adres jest stabilny z definicji §5.1)
 *   * kind='header'/'link'   → para (rodzic, menu_label) — te wiersze nie mają
 *                              adresu, więc żaden indeks unikalny ich nie broni
 * Rozjazd między kluczami (wiersz pod tym samym adresem, ale z innym
 * `migrated_from`) jest RAPORTOWANY, a nie naprawiany po cichu.
 *
 * ŹRÓDŁA W TS
 * -----------
 * `lib/editablePages.ts` i `data/articles/*.ts` to jedyne miejsca, w których
 * żyją prefille nagłówków, tytuły i wstępy. Skrypt wczytuje je WPROST, a nie
 * przez wyrażenia regularne (tak robi snapshot-tree.mjs dla par slug→route).
 * Powód: tu chodzi o pełne teksty wstępów z apostrofami, myślnikami i cudzysłowami
 * w środku — regexp na takim wejściu myli się cicho, a cicha pomyłka w tytule
 * wychodzi dopiero po `drop table` w etapie 8. Node od 22.18/23.6 usuwa typy
 * z .ts sam; brakuje mu tylko rozwijania specyfikatorów bez rozszerzenia
 * (`./site`) i aliasu `@/` — to dokłada hak niżej.
 *
 * KOLEJNOŚĆ WSTAWIANIA — RODZIC I DZIECKO NIE MOGĄ IŚĆ RAZEM
 * -----------------------------------------------------------
 * Trigger `pages_before_write` czyta rodzica zapytaniem do tabeli, a wiersze
 * wstawione przez TO SAMO polecenie nie są jeszcze dla niego widoczne. PostgREST
 * wysyła tablicę obiektów jako JEDEN insert, więc drzewo idzie poziomami:
 * najpierw komplet poziomu 0, potem poziom 1. Ostrzeżenie stoi wprost
 * w supabase/03-drzewo-stron.sql, w sekcji 7.
 */

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve as sciezkaBezwzgledna } from "node:path";
import { registerHooks } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const NA_SUCHO = process.argv.includes("--na-sucho");

// ─────────────────────────────────────────────────────────────────────────────
// Środowisko — wzorzec z scripts/seed-content.mjs
// ─────────────────────────────────────────────────────────────────────────────

function parseEnv(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

// Next.js czyta .env.local ORAZ .env (pierwszy ma pierwszeństwo). Skrypt robi
// tak samo — wymaganie samego .env.local wywalało seed w projekcie, w którym
// zmienne siedzą w .env.
//
// PIERWSZEŃSTWO MA ŚRODOWISKO PROCESU, nie pliki. To jedyny sposób, żeby
// puścić ten skrypt na bazie-poligonie: pliki .env* w repo wskazują PRODUKCJĘ,
// a backfill jest operacją zapisu. Odwrotna kolejność oznaczałaby, że
// uruchomienie „na poligonie" po cichu pisze na produkcji.
function loadEnv() {
  const merged = {};
  for (const name of [".env", ".env.local"]) {
    try {
      Object.assign(merged, parseEnv(readFileSync(join(ROOT, name), "utf8")));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  for (const nazwa of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[nazwa]) merged[nazwa] = process.env[nazwa];
  }
  return merged;
}

const env = loadEnv();

// Odmowa zamiast pracy na połowie danych. Backfill bez klucza service-role nie
// jest „mniejszym backfillem" — jest zapisem, który nie doszedł do skutku,
// a raport i tak wyglądałby jak sukces.
for (const wymagana of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[wymagana]) {
    console.error(
      `ODMOWA: brak zmiennej ${wymagana} w .env / .env.local.\n` +
        "Backfill musi widzieć bazę — bez niej nie ma czego wypełnić ani z czym porównać.",
    );
    process.exit(1);
  }
}

const URL_BAZY = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KLUCZ = env.SUPABASE_SERVICE_ROLE_KEY;
const NAGLOWKI = {
  apikey: KLUCZ,
  Authorization: `Bearer ${KLUCZ}`,
  "Content-Type": "application/json",
};

// ─────────────────────────────────────────────────────────────────────────────
// PostgREST
// ─────────────────────────────────────────────────────────────────────────────

async function czytaj(sciezka) {
  const r = await fetch(`${URL_BAZY}/rest/v1/${sciezka}`, {
    headers: NAGLOWKI,
    signal: AbortSignal.timeout(30_000),
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`GET ${sciezka}: HTTP ${r.status} ${tekst.slice(0, 500)}`);
  return JSON.parse(tekst);
}

/**
 * Zwraca wstawione wiersze (Prefer: return=representation), bo dopiero baza zna
 * `id` i policzony triggerem `full_path` — jedno i drugie jest potrzebne
 * natychmiast: id jako parent_id następnego poziomu, full_path do kontroli.
 */
async function wstaw(wiersze) {
  const r = await fetch(`${URL_BAZY}/rest/v1/pages`, {
    method: "POST",
    headers: { ...NAGLOWKI, Prefer: "return=representation" },
    body: JSON.stringify(wiersze),
    signal: AbortSignal.timeout(60_000),
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`INSERT pages: HTTP ${r.status} ${tekst.slice(0, 1000)}`);
  return JSON.parse(tekst);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wczytanie źródeł zapisanych w TypeScripcie
// ─────────────────────────────────────────────────────────────────────────────

const [duza, mala] = process.versions.node.split(".").map(Number);
if (duza < 22 || (duza === 22 && mala < 18)) {
  console.error(
    `ODMOWA: Node ${process.versions.node} nie wczyta plików .ts bez dodatkowych narzędzi.\n` +
      "Potrzebny Node 22.18+ albo 23.6+ (samodzielne usuwanie typów).",
  );
  process.exit(1);
}

// Node usuwa typy z .ts, ale nie zna dwóch konwencji tego projektu: importu bez
// rozszerzenia („./site") i aliasu „@/" z tsconfig. Hak dokłada jedno i drugie.
registerHooks({
  resolve(specyfikator, kontekst, dalej) {
    let cel = null;
    if (specyfikator.startsWith("@/")) {
      cel = sciezkaBezwzgledna(ROOT, specyfikator.slice(2));
    } else if (specyfikator.startsWith(".") && kontekst.parentURL?.startsWith("file:")) {
      cel = sciezkaBezwzgledna(dirname(fileURLToPath(kontekst.parentURL)), specyfikator);
    }
    if (cel) {
      for (const koncowka of [".ts", ".tsx", "/index.ts"]) {
        if (existsSync(cel + koncowka)) {
          return { url: pathToFileURL(cel + koncowka).href, shortCircuit: true };
        }
      }
    }
    return dalej(specyfikator, kontekst);
  },
});

const zKodu = (wzgledna) => import(pathToFileURL(join(ROOT, wzgledna)).href);

const { EDITABLE_PAGES } = await zKodu("lib/editablePages.ts");
// Trzy pliki tematów wprost, a NIE data/articles/index.ts: index re-eksportuje
// „./types", moduł bez ani jednego eksportu wykonywalnego — Node nie rozpozna
// go jako ESM i wciągnie jako CommonJS, dokładając do przestrzeni nazw sztuczny
// klucz `module.exports`. Nic tu po nim, a trzy importy są równie czytelne.
const GRUPY = [
  (await zKodu("data/articles/o-shorinji.ts")).o_shorinji,
  (await zKodu("data/articles/organizacja.ts")).organizacja,
  (await zKodu("data/articles/buddyzm.ts")).buddyzm,
];

// ─────────────────────────────────────────────────────────────────────────────
// Stan bazy
// ─────────────────────────────────────────────────────────────────────────────

const nawigacja = await czytaj("nav_items?select=id,parent_id,label,href,position,visible");
const wlasne = await czytaj(
  "custom_pages?select=id,slug,title,intro,blocks,published,created_at,updated_at,deleted_at",
);
const nadpisania = await czytaj("article_overrides?select=topic,slug,title,intro");
const istniejace = await czytaj(
  'pages?select=id,kind,source,slug,full_path,menu_label,parent_id,"position",migrated_from,deleted_at',
);

// ─────────────────────────────────────────────────────────────────────────────
// Indeksy pomocnicze
// ─────────────────────────────────────────────────────────────────────────────

const edytowalnaPoTrasie = new Map(EDITABLE_PAGES.map((p) => [p.route, p]));
const listingPoAdresie = new Map(GRUPY.map((g) => [`/${g.topic}`, g]));
const artykulPoAdresie = new Map(
  GRUPY.flatMap((g) => g.articles.map((a) => [`/${g.topic}/${a.slug}`, { grupa: g, artykul: a }])),
);
const nadpisaniePoAdresie = new Map(nadpisania.map((n) => [`/${n.topic}/${n.slug}`, n]));
/**
 * Żywe podstrony własne, kluczowane adresem, pod którym stoją DZIŚ.
 *
 * `app/[slug]/page.tsx` serwuje je z korzenia, więc adres to zawsze `/<slug>` —
 * niezależnie od tego, gdzie w menu wisi ich pozycja. To jest źródło, o którym
 * §5.4 mówi „dziś 3 wiersze, wszystkie w koszu, żywych ZERO": zdanie prawdziwe
 * 18.08 i nieprawdziwe od 19.08, kiedy redaktor dodał `/symbole-shorinji-kempo`
 * i `/faq` razem z pozycjami w menu (pomiar 21.08). Bez tej mapy oba hrefy
 * wpadają w gałąź „adres nieznany żadnemu źródłu" i strony nie dostają węzła.
 */
const wlasnaPoAdresie = new Map(
  wlasne.filter((w) => !w.deleted_at).map((w) => [`/${w.slug}`, w]),
);
const uzyteWlasne = new Set();

const ostrzezenia = [];
const doDecyzji = [];

// ─────────────────────────────────────────────────────────────────────────────
// Budowa węzłów
//
// Każdy węzeł ma pola tabeli `pages` plus dwa pomocnicze, zdejmowane przed
// wysłaniem: `_poziom` (kolejność wstawiania) i `_adres` (przewidywany
// full_path, do dopasowania z tym, co już jest w bazie).
//
// `layout` NIE jest tu ustawiany. §3 rozstrzyga, że „bycie listingiem wynika
// z posiadania dzieci", a domyślne 'auto' wystarcza w 100% dzisiejszych
// przypadków; to, że stronę renderuje plik trasy, mówi już `source='route'`.
// Wpisywanie tu 'route'/'listing'/'article' byłoby wymyślaniem semantyki,
// której żaden czytelnik jeszcze nie ma — etapy 6 i 7 ustawią ją wtedy, gdy
// powstanie kod, który to czyta.
//
// `blocks` zostaje puste wszędzie poza custom_pages: treść tras edytowalnych
// siedzi w site_settings (wskaźnik `content_key`), a treść podstron
// tematycznych przenosi etap 7 — przez `overrideToBlocks`, nigdy przez
// `wiersz.blocks` (§8).
// ─────────────────────────────────────────────────────────────────────────────

function wezelPusty() {
  return {
    parent_id: null,
    kind: "page",
    source: "db",
    route: null,
    slug: null,
    external_url: null,
    kicker: null,
    title: null,
    intro: null,
    blocks: [],
    content_key: null,
    cloudinary_folder: null,
    menu_label: null,
    in_menu: true,
    published: true,
    position: 0,
    migrated_from: null,
    deleted_at: null,
  };
}

/** Adres, jaki policzy trigger — powtórzony w JS, żeby dało się dopasować wiersz przed zapisem. */
function przewidzianyAdres(w, adresRodzica) {
  if (w.kind !== "page") return null;
  if (w.source === "route") return w.route;
  if (!adresRodzica) return `/${w.slug}`;
  return `${adresRodzica === "/" ? "" : adresRodzica}/${w.slug}`;
}

/**
 * Węzeł dla adresu obsługiwanego przez plik trasy w kodzie. Cztery rozłączne
 * przypadki, w tej kolejności — kolejność ma znaczenie, bo /aktualnosci
 * i /galeria są JEDNOCZEŚNIE trasami edytowalnymi i listingami czegoś innego
 * (aktualności, albumów), a rozstrzyga o nich EDITABLE_PAGES.
 */
function wezelDlaTrasy(href) {
  const edytowalna = edytowalnaPoTrasie.get(href);
  if (edytowalna) {
    const naglowek = edytowalna.prefillHeader ?? {};
    if (!naglowek.title) {
      ostrzezenia.push(
        `EDITABLE_PAGES „${edytowalna.slug}" nie ma prefillHeader.title — tytuł wzięty z etykiety panelu.`,
      );
    }
    return {
      ...wezelPusty(),
      source: "route",
      route: edytowalna.route,
      // Strona główna nie ma i nie może mieć sluga: slug='' odpada na
      // pages_slug_format_chk, a slug='home' dałoby adres /home (§2.2).
      slug: edytowalna.route === "/" ? null : edytowalna.route.split("/").filter(Boolean).pop(),
      kicker: naglowek.kicker ?? null,
      title: naglowek.title ?? edytowalna.label,
      intro: naglowek.lead ?? null,
      // Slug wpisu NIE jest tu tożsamy ze slugiem adresu — rozjazd dotyczy
      // 4 z 8 wpisów (home→/, cennik→/zajecia/cennik, zajecia-dorosli→…).
      // Bez tej kolumny etap 7 nie trafiłby w klucz treści.
      content_key: `page:${edytowalna.slug}`,
    };
  }

  const listing = listingPoAdresie.get(href);
  if (listing) {
    return {
      ...wezelPusty(),
      source: "route",
      route: href,
      slug: listing.topic,
      title: listing.topicTitle,
      intro: listing.topicIntro,
    };
  }

  const tematyczna = artykulPoAdresie.get(href);
  if (tematyczna) {
    const nadpisanie = nadpisaniePoAdresie.get(href);
    return {
      ...wezelPusty(),
      source: "route",
      route: href,
      slug: tematyczna.artykul.slug,
      // Ta sama kolejność pierwszeństwa co w resolveArticleBlocks
      // (lib/articleContent.ts): nadpisanie redaktora wygrywa z treścią z kodu,
      // ale puste albo samo-białe-znaki nadpisanie NIE wygrywa.
      title: nadpisanie?.title?.trim() || tematyczna.artykul.title,
      intro: nadpisanie?.intro?.trim() || tematyczna.artykul.intro,
      // Folder ze zdjęciami jest dziś kluczowany KSZTAŁTEM ADRESU
      // (app/admin/(panel)/edit/[topic]/[slug]/EditorForm.tsx:119). Zmiana sluga
      // — czyli cała pointa tej migracji — osieroci go i nic tego nie zgłosi.
      cloudinary_folder: `Strona/${tematyczna.grupa.topic}/${tematyczna.artykul.slug}`,
    };
  }

  // Czwarty przypadek: żywa podstrona własna. `source='db'`, bo jej treść JEST
  // treścią tego wiersza — `app/[slug]` tylko ją wyświetla, w odróżnieniu od
  // ośmiu tras edytowalnych, których układ siedzi w pliku trasy.
  // migrated_from bierze się z custom_pages.id, a nie z nav_items.id: ten
  // pierwszy przeżywa zapis menu w panelu, drugi nie.
  const wlasnaStrona = wlasnaPoAdresie.get(href);
  if (wlasnaStrona) {
    uzyteWlasne.add(wlasnaStrona.id);
    return {
      ...wezelPusty(),
      source: "db",
      slug: wlasnaStrona.slug,
      title: wlasnaStrona.title,
      intro: wlasnaStrona.intro,
      blocks: wlasnaStrona.blocks ?? [],
      published: wlasnaStrona.published,
      migrated_from: `custom_pages:${wlasnaStrona.id}`,
      _wlasna: true,
    };
  }

  return null;
}

const wezly = [];

// ── Źródło 1: nav_items ──────────────────────────────────────────────────────
// `position` bierzemy WYŁĄCZNIE stąd, nigdy z DEFAULT_NAV: kolejność w bazie
// (AKTUALNOŚCI, O SHORINJI, ZAJĘCIA, …) różni się od kodu (ZAJĘCIA pierwsze),
// a to jest decyzja redaktora, nie przypadek.

const naviPoId = new Map(nawigacja.map((n) => [n.id, n]));
const gora = nawigacja.filter((n) => !n.parent_id).sort((a, b) => a.position - b.position);

function zNawigacji(wiersz) {
  let wezel;

  if (!wiersz.href) {
    // Pozycja bez celu to jawny nagłówek grupujący, nigdy strona-placeholder
    // (§8). Dziś taki wiersz jest dokładnie jeden: „ZAJĘCIA".
    wezel = {
      ...wezelPusty(),
      kind: "header",
      // title jest NOT NULL i nie może być puste; nagłówek nie ma innego tekstu
      // niż etykieta menu, więc trafia w oba pola.
      title: wiersz.label,
    };
  } else if (/^https?:\/\//.test(wiersz.href)) {
    // Czwarta reguła mapowania (§5.4): href spoza serwisu to odnośnik, nigdy
    // source='route' — CHECK by go odrzucił. Dziś ten zbiór jest pusty.
    wezel = { ...wezelPusty(), kind: "link", external_url: wiersz.href, title: wiersz.label };
  } else {
    wezel = wezelDlaTrasy(wiersz.href);
    if (!wezel) {
      // Nigdy ciche pominięcie: adres, którego nie zna żadne źródło, idzie do
      // raportu i wymaga decyzji człowieka.
      doDecyzji.push(
        `nav_items „${wiersz.label}" → ${wiersz.href} — adres nieznany żadnemu źródłu, węzeł NIE powstał.`,
      );
      return null;
    }
  }

  wezel.menu_label = wiersz.label;
  // visible → in_menu, NIGDY visible → published. Dziś visible=false ukrywa
  // pozycję MENU, nie stronę; pomyłka w tę stronę dałaby 404 na zaindeksowanym
  // adresie.
  wezel.in_menu = wiersz.visible;

  // pages_header_visible_chk zabrania nagłówka z in_menu=false: nagłówek bez
  // menu nie ma po co istnieć. Ukryty nagłówek w nav_items jest dziś stanem
  // nieosiągalnym (jeden wiersz bez href, visible=true), ale gdyby powstał,
  // PostgREST odrzuciłby CAŁĄ paczkę poziomu 0 błędem 400 i backfill nie
  // zapisałby ani jednego wiersza — z komunikatem o ograniczeniu bazy zamiast
  // o przyczynie. Lepiej: wstawić widoczny, powiedzieć o tym wprost i zażądać
  // decyzji (kod wyjścia 1). Nikt z tej tabeli jeszcze nie czyta, więc nic
  // się przez to publicznie nie zmienia.
  if (wezel.kind === "header" && !wiersz.visible) {
    wezel.in_menu = true;
    doDecyzji.push(
      `nav_items „${wiersz.label}" to UKRYTY nagłówek (visible=false), a model tego nie dopuszcza ` +
        `(pages_header_visible_chk). Węzeł powstał jako WIDOCZNY. Rozstrzygnij: ukryć całą grupę ` +
        `(in_menu=false na dzieciach) czy zostawić widoczną.`,
    );
  }
  wezel.position = wiersz.position;
  // Podstrona własna przynosi własny, trwalszy klucz (custom_pages.id) — nie
  // nadpisujemy go identyfikatorem z nav_items, który ginie przy zapisie menu.
  wezel.migrated_from ??= `nav_items:${wiersz.id}`;
  return wezel;
}

let najwyzszaPozycjaGora = -1;

for (const wiersz of gora) {
  const wezel = zNawigacji(wiersz);
  if (!wezel) continue;
  wezel._poziom = 0;
  wezel._zrodloId = wiersz.id;
  wezly.push(wezel);
  najwyzszaPozycjaGora = Math.max(najwyzszaPozycjaGora, wiersz.position);
}

for (const wiersz of nawigacja.filter((n) => n.parent_id).sort((a, b) => a.position - b.position)) {
  if (!naviPoId.has(wiersz.parent_id)) {
    doDecyzji.push(`nav_items „${wiersz.label}" ma parent_id spoza tabeli — sierota, węzeł NIE powstał.`);
    continue;
  }
  const wezel = zNawigacji(wiersz);
  if (!wezel) continue;
  wezel._poziom = 1;
  wezel._rodzicZrodloId = wiersz.parent_id;
  wezly.push(wezel);
}

// ── Źródło 2: EDITABLE_PAGES bez wiersza w menu ──────────────────────────────
// Bez tego „/" i „/kontakt" nie dostają węzła, a własne kryterium odbioru
// etapu 2 (każdy adres z golden mastera ma węzeł) nigdy nie byłoby puste.

const trasyZMenu = new Set(nawigacja.map((n) => n.href).filter(Boolean));
let kolejnaPozycja = najwyzszaPozycjaGora + 1;

for (const strona of EDITABLE_PAGES) {
  if (trasyZMenu.has(strona.route)) continue;
  const wezel = wezelDlaTrasy(strona.route);
  // Węzeł dostaje in_menu = false TYLKO dlatego, że nie ma dla niego wiersza
  // w nav_items — a nie dlatego, że „jest spoza menu". Reguła w drugą stronę
  // usunęłaby z menu 10 podstron tematycznych, które w nav_items są (§5.4).
  wezel.in_menu = false;
  wezel.position = kolejnaPozycja++;
  wezel.migrated_from = `editable_pages:${strona.slug}`;
  wezel._poziom = 0;
  wezly.push(wezel);
}

// ── Źródło 5: custom_pages ───────────────────────────────────────────────────
// Wiersze z kosza idą RAZEM z `deleted_at`. Przeniesienie ich jako żywych
// ożywiłoby /test, /ee, /eee — czyli DODAŁO adresy, wbrew §5.1.

for (const strona of wlasne.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
  // Podstrony, które mają pozycję w menu, weszły już wyżej razem z nią —
  // z rodzicem, etykietą i kolejnością. Tu zostają wyłącznie te bez pozycji
  // (w tym cały kosz) i one idą na górę, poza menu.
  if (uzyteWlasne.has(strona.id)) continue;
  wezly.push({
    ...wezelPusty(),
    source: "db",
    slug: strona.slug,
    title: strona.title,
    intro: strona.intro,
    blocks: strona.blocks ?? [],
    published: strona.published,
    deleted_at: strona.deleted_at,
    in_menu: false,
    position: kolejnaPozycja++,
    migrated_from: `custom_pages:${strona.id}`,
    _poziom: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Dopasowanie do tego, co już jest w bazie
// ─────────────────────────────────────────────────────────────────────────────

const poMigratedFrom = new Map(
  istniejace.filter((w) => w.migrated_from).map((w) => [w.migrated_from, w]),
);
const poAdresie = new Map(
  istniejace.filter((w) => w.kind === "page" && !w.deleted_at && w.full_path).map((w) => [w.full_path, w]),
);
const poEtykiecie = new Map(
  istniejace
    .filter((w) => w.kind === "header" || w.kind === "link")
    .map((w) => [`${w.parent_id ?? "korzen"}|${w.menu_label}`, w]),
);
/**
 * Trzeci klucz, wyłącznie dla nagłówków i odnośników: (rodzic, rodzaj, pozycja).
 *
 * Bez niego zmiana etykiety w panelu wyłącza OBA pozostałe klucze naraz, bo
 * `saveNavTree` przy każdym zapisie menu wystawia nowe nav_items.id — a zmiana
 * etykiety jest najczęstszym powodem zapisu menu. Wynik: drugi przebieg dokłada
 * drugi, pusty nagłówek („ZAJĘCIA" z dziećmi + „TRENINGI" bez niczego), którego
 * nie widzi ani jeden indeks unikalny (full_path jest NULL, migrated_from inne)
 * ani kontrola 2 (liczy duplikaty identycznych par). Pozycja i rodzic zmiany
 * nazwy nie zauważają, więc wiersz zostaje ROZPOZNANY, a rozjazd etykiety idzie
 * do raportu jako rzecz do rozstrzygnięcia przez człowieka.
 */
const poPozycji = new Map(
  istniejace
    .filter((w) => w.kind === "header" || w.kind === "link")
    .map((w) => [`${w.parent_id ?? "korzen"}|${w.kind}|${w.position}`, w]),
);

// Adresy węzłów poziomu 0 są potrzebne, żeby policzyć przewidywany adres dzieci
// z source='db'. Dzieci z source='route' biorą adres wprost z `route`.
const adresGory = new Map();
for (const w of wezly.filter((w) => w._poziom === 0)) {
  adresGory.set(w._zrodloId ?? w.migrated_from, przewidzianyAdres(w, null));
}

for (const w of wezly) {
  const adresRodzica = w._rodzicZrodloId ? adresGory.get(w._rodzicZrodloId) : null;
  w._adres = przewidzianyAdres(w, adresRodzica);

  /**
   * Podstrona własna stoi dziś pod `/<slug>` — z korzenia, bo serwuje ją
   * `app/[slug]`. W menu jej pozycja bywa jednak zagnieżdżona, a wtedy trigger
   * policzyłby adres z łańcucha slugów rodzica i URL by się ZMIENIŁ:
   * `/symbole-shorinji-kempo` pod „O SHORINJI" wyszłoby jako
   * `/o-shorinji/symbole-shorinji-kempo`. To łamie §5.1 („migracja nie zmienia
   * ani jednego istniejącego adresu") na adresie, który Google już widział.
   *
   * Zagnieżdżenie pod NAGŁÓWKIEM problemu nie robi: nagłówek nie ma adresu,
   * więc trigger schodzi do najbliższego przodka typu 'page', nie znajduje go
   * i zostawia adres jednosegmentowy. Dlatego `/faq` pod „ZAJĘCIA" jest w
   * porządku, a „SYMBOLE SK" pod „O SHORINJI" nie.
   *
   * Wybór: ratujemy ADRES, poświęcamy zagnieżdżenie w menu. Zmiana adresu jest
   * nieodwracalna dla wyszukiwarki, przesunięcie pozycji w menu redaktor cofa
   * jednym ruchem w etapie 5. Obie rzeczy trafiają do decyzji, bo to jest
   * wybór produktowy, a nie techniczny — kod wyjścia 1.
   */
  if (w._wlasna && w._adres !== `/${w.slug}`) {
    doDecyzji.push(
      `Podstrona własna „${w.title}" stoi pod ${`/${w.slug}`}, a jej pozycja w menu ` +
        `(pod „${adresRodzica}") dałaby adres ${w._adres}. Węzeł wstawiony na GÓRNYM poziomie, ` +
        `żeby adres się nie zmienił — zagnieżdżenie w menu przywróć w etapie 5 albo zdecyduj ` +
        `o świadomej zmianie adresu (wtedy trigger sam zapisze przekierowanie).`,
    );
    w._rodzicZrodloId = undefined;
    w._poziom = 0;
    w.position = kolejnaPozycja++;
    w._adres = przewidzianyAdres(w, null);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Zapis — poziomami, bo trigger nie zobaczy rodzica z tej samej paczki
// ─────────────────────────────────────────────────────────────────────────────

const KOLUMNY_POMOCNICZE = ["_poziom", "_zrodloId", "_rodzicZrodloId", "_adres", "_wlasna"];
const doWyslania = (w) => Object.fromEntries(Object.entries(w).filter(([k]) => !KOLUMNY_POMOCNICZE.includes(k)));

const raport = { wstawione: [], pominiete: [], rozjazdy: [] };
const idZrodlowe = new Map(); // _zrodloId → id wiersza w pages

function juzJest(wezel, parentId) {
  const poKluczu = poMigratedFrom.get(wezel.migrated_from);
  if (poKluczu) return { wiersz: poKluczu, jak: "migrated_from" };

  if (wezel.kind === "page" && !wezel.deleted_at) {
    const poAdr = poAdresie.get(wezel._adres);
    if (poAdr) return { wiersz: poAdr, jak: "adres" };
  } else {
    const poEtyk = poEtykiecie.get(`${parentId ?? "korzen"}|${wezel.menu_label}`);
    if (poEtyk) return { wiersz: poEtyk, jak: "etykieta" };
    const poPoz = poPozycji.get(`${parentId ?? "korzen"}|${wezel.kind}|${wezel.position}`);
    if (poPoz) return { wiersz: poPoz, jak: "pozycja" };
  }
  return null;
}

/**
 * Zapis w try/catch, a nie „na wierzchu" modułu. Wyjątek z `wstaw()` przerwałby
 * skrypt PRZED raportem i przed kontrolami — czyli dokładnie wtedy, gdy tabela
 * jest w połowie zapełniona, a człowiek najbardziej potrzebuje wiedzieć, co
 * zdążyło wejść. Awaria ma być głośna i OPISANA, nie tylko głośna.
 *
 * `wezly` mają najwyżej dwa poziomy, bo nav_items jest dwupoziomowe z budowy
 * (panel nie umie dodać wnuka). Trzeci obieg pętli jest tu pod przyszłe dane —
 * gdyby wnuk kiedyś powstał, dostałby `_poziom = 1` z rodzicem, który nie ma
 * jeszcze id, i wypadłby GŁOŚNO na „rodzic nie powstał", a nie po cichu.
 */
let bladZapisu = null;
try {
for (const poziom of [0, 1, 2]) {
  const naPoziomie = wezly.filter((w) => w._poziom === poziom);
  if (!naPoziomie.length) continue;

  const doWstawienia = [];

  for (const wezel of naPoziomie) {
    const parentId = wezel._rodzicZrodloId ? idZrodlowe.get(wezel._rodzicZrodloId) : null;
    if (wezel._rodzicZrodloId && !parentId) {
      raport.rozjazdy.push(
        `„${wezel.menu_label ?? wezel.title}" — rodzic nie powstał, dziecko pominięte.`,
      );
      continue;
    }
    wezel.parent_id = parentId;

    const dopasowany = juzJest(wezel, parentId);
    if (dopasowany) {
      raport.pominiete.push(
        `${wezel._adres ?? wezel.menu_label} — już jest (dopasowane po: ${dopasowany.jak})`,
      );
      if (dopasowany.jak !== "migrated_from" && dopasowany.wiersz.migrated_from !== wezel.migrated_from) {
        raport.rozjazdy.push(
          `${wezel._adres ?? wezel.menu_label}: w bazie migrated_from=${dopasowany.wiersz.migrated_from}, ` +
            `skrypt wyliczył ${wezel.migrated_from}. Wiersz ZOSTAWIONY bez zmian — najpewniej menu ` +
            `zapisano w panelu po poprzednim przebiegu (nav_items.id są generowane od nowa).`,
        );
      }
      if (dopasowany.jak === "pozycja" && dopasowany.wiersz.menu_label !== wezel.menu_label) {
        // Dopasowanie po pozycji zadziałało tam, gdzie etykieta się rozjechała.
        // To nie jest awaria — to jest miejsce, w którym skrypt ŚWIADOMIE nie
        // wstawia drugiego nagłówka. Zmianę nazwy przeniesie etap 3a albo
        // człowiek jednym UPDATE; backfill nie nadpisuje niczego, co już jest.
        raport.rozjazdy.push(
          `Nagłówek na pozycji ${wezel.position}: w bazie menu_label="${dopasowany.wiersz.menu_label}", ` +
            `w nav_items "${wezel.menu_label}". Wiersz ROZPOZNANY po pozycji i NIE zdublowany; ` +
            `etykietę zmień ręcznie albo poczekaj na etap 3a.`,
        );
      }
      if (wezel._zrodloId) idZrodlowe.set(wezel._zrodloId, dopasowany.wiersz.id);
      continue;
    }

    doWstawienia.push(wezel);
  }

  if (!doWstawienia.length) continue;

  if (NA_SUCHO) {
    for (const w of doWstawienia) {
      raport.wstawione.push(
        `[na sucho] poziom ${poziom}: ${w.kind.padEnd(6)} ${(w._adres ?? "(bez adresu)").padEnd(38)} ${w.title}`,
      );
      // Na sucho nie ma id z bazy, a dzieci go potrzebują. Podstawiamy znacznik,
      // żeby poziom 1 dał się zaplanować, a nie zniknął z raportu jako „rodzic
      // nie powstał".
      if (w._zrodloId) idZrodlowe.set(w._zrodloId, `na-sucho:${w._zrodloId}`);
    }
    continue;
  }

  const wstawione = await wstaw(doWstawienia.map(doWyslania));

  // Dopasowanie zwrotne po migrated_from — kolejność odpowiedzi PostgREST nie
  // jest niczym zagwarantowana, a pomyłka tutaj podpięłaby dzieci pod cudzego
  // rodzica.
  const poKluczu = new Map(wstawione.map((w) => [w.migrated_from, w]));
  for (const w of doWstawienia) {
    const zapisany = poKluczu.get(w.migrated_from);
    if (!zapisany) {
      raport.rozjazdy.push(`${w.migrated_from} — baza nie zwróciła wstawionego wiersza.`);
      continue;
    }
    if (w._zrodloId) idZrodlowe.set(w._zrodloId, zapisany.id);
    raport.wstawione.push(
      `poziom ${poziom}: ${w.kind.padEnd(6)} ${(zapisany.full_path ?? "(bez adresu)").padEnd(38)} ${zapisany.title}`,
    );
    if (w._adres !== zapisany.full_path) {
      raport.rozjazdy.push(
        `${w.migrated_from}: skrypt przewidział adres ${w._adres}, trigger policzył ${zapisany.full_path}.`,
      );
    }
  }
}
} catch (e) {
  bladZapisu = e;
  raport.rozjazdy.push(
    `ZAPIS PRZERWANY: ${e.message}. Poniższa lista „wstawione" mówi, co zdążyło wejść do bazy ` +
      `PRZED tym błędem; reszta nie weszła. Skrypt jest idempotentny — po usunięciu przyczyny ` +
      `uruchom go ponownie, dokończy pracę.`,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Kontrola — trzy zapytania obowiązkowe z §5.4, liczone po stronie skryptu
//
// Po stronie skryptu, a nie w SQL, bo PostgREST nie porównuje dwóch kolumn ze
// sobą (`full_path is distinct from route`) i nie ma `except`. Tabela ma
// kilkadziesiąt wierszy, więc pobranie całości i porównanie w pamięci jest
// dokładnie tym samym testem — i działa też na produkcji, gdzie nie ma exec_sql.
// ─────────────────────────────────────────────────────────────────────────────

const poZapisie = await czytaj(
  "pages?select=id,kind,source,route,full_path,menu_label,parent_id,deleted_at,title,published",
);

const kontrole = [];

kontrole.push({
  nazwa: "1. Adres węzła 'route' jest DOSŁOWNIE trasą z kodu",
  winne: poZapisie
    .filter((w) => w.source === "route" && w.full_path !== w.route)
    .map((w) => `${w.title}: full_path=${w.full_path}, route=${w.route}`),
});

const parki = new Map();
for (const w of poZapisie.filter((w) => w.kind === "header" || w.kind === "link")) {
  const k = `${w.parent_id ?? "korzen"}|${w.menu_label}`;
  parki.set(k, (parki.get(k) ?? 0) + 1);
}
kontrole.push({
  nazwa: "2. Duplikaty nagłówków i odnośników (żaden indeks ich nie broni)",
  winne: [...parki].filter(([, ile]) => ile > 1).map(([k, ile]) => `${k} — ${ile} wierszy`),
});

// `published` w warunku, nie tylko `deleted_at`: węzeł nieopublikowany nie
// wyprodukuje po etapie 4 strony pod tym adresem, więc „ma węzeł" bez tego
// warunku przepuściłoby regresję 200 → 404 na adresie z golden mastera.
const zywe = new Set(
  poZapisie
    .filter((w) => w.kind === "page" && !w.deleted_at && w.published)
    .map((w) => w.full_path),
);
// Na sucho tabela jest taka, jaka była — dokładamy adresy ZAPLANOWANE, bo
// inaczej kontrola 3 zgłasza komplet braków przy każdym przebiegu próbnym
// i przestaje cokolwiek znaczyć („zawsze czerwone" czyta się jak „zepsute").
if (NA_SUCHO) {
  for (const w of wezly) {
    if (w.kind === "page" && !w.deleted_at && w.published && w._adres) zywe.add(w._adres);
  }
}

/**
 * Golden master jest JEDYNYM kryterium odbioru etapu 2, które sprawdza
 * kompletność drzewa — reszta kontrol patrzy tylko na spójność tego, co jest.
 * Dlatego jego brak NIE może być ostrzeżeniem: pusta lista oczekiwań daje
 * `winne = []`, czyli zielone „OK 3. (0 adresów)", i skrypt kończy się kodem 0.
 * Kontrola, którą da się wyłączyć przez skasowanie pliku, nie jest kontrolą.
 */
let oczekiwane = [];
let bladGolden = null;
try {
  const golden = JSON.parse(readFileSync(join(ROOT, "docs/golden-master-przed.json"), "utf8"));
  oczekiwane = Object.entries(golden.adresy)
    .filter(([adres, w]) => {
      if (w.status !== 200 || !String(w.typ ?? "").startsWith("text/html")) return false;
      // Aktualności zostają POZA drzewem pages (§2.8) — bez tego wykluczenia
      // kryterium nigdy nie byłoby puste. /admin to panel, nie treść.
      return !adres.startsWith("/aktualnosci/") && !adres.startsWith("/admin");
    })
    .map(([adres]) => adres);
  if (!oczekiwane.length) bladGolden = "plik wczytany, ale nie ma w nim ani jednego adresu 200 text/html";
} catch (e) {
  bladGolden = `nie wczytano pliku (${e.code ?? e.message})`;
}
kontrole.push({
  nazwa: `3. Każdy adres z golden mastera ma węzeł (${oczekiwane.length} adresów)`,
  winne: bladGolden
    ? [`docs/golden-master-przed.json — ${bladGolden}. KRYTERIUM NIEZWERYFIKOWANE, nie „spełnione".`]
    : oczekiwane.filter((a) => !zywe.has(a)),
});

const adresy = new Map();
for (const w of poZapisie.filter((w) => w.kind === "page" && !w.deleted_at)) {
  adresy.set(w.full_path, (adresy.get(w.full_path) ?? 0) + 1);
}
kontrole.push({
  nazwa: "4. Duplikaty adresów wśród żywych stron",
  winne: [...adresy].filter(([, ile]) => ile > 1).map(([a, ile]) => `${a} — ${ile} wierszy`),
});

/**
 * Piąta kontrola, poza §5.4 — liczbowa, nie nazwowa.
 *
 * Kontrola 2 łapie tylko duplikat o IDENTYCZNEJ etykiecie, więc nadmiarowy
 * nagłówek pod inną nazwą („ZAJĘCIA" + „TRENINGI") przechodzi jej przez palce.
 * Ta liczy sztuki: nagłówków w `pages` ma być dokładnie tyle, ile w nav_items
 * jest wierszy bez href, a odnośników tyle, ile hrefów zewnętrznych. Nie da się
 * jej oszukać zmianą nazwy, bo nazw w ogóle nie czyta.
 */
const naglowkowWNav = nawigacja.filter((n) => !n.href).length;
const odnosnikowWNav = nawigacja.filter((n) => n.href && /^https?:\/\//.test(n.href)).length;
const naglowkowWPages = poZapisie.filter((w) => w.kind === "header").length;
const odnosnikowWPages = poZapisie.filter((w) => w.kind === "link").length;
kontrole.push({
  nazwa: "5. Liczba nagłówków i odnośników zgadza się z nav_items",
  winne: [
    ...(NA_SUCHO || naglowkowWPages === naglowkowWNav
      ? []
      : [`nagłówki: nav_items ${naglowkowWNav}, pages ${naglowkowWPages}`]),
    ...(NA_SUCHO || odnosnikowWPages === odnosnikowWNav
      ? []
      : [`odnośniki: nav_items ${odnosnikowWNav}, pages ${odnosnikowWPages}`]),
  ],
});

/**
 * Szósta kontrola — kierunek odwrotny do kontroli 3.
 *
 * Kontrola 3 pyta „czy adres z golden mastera ma węzeł", a golden master jest
 * zrzutem z konkretnego dnia i starzeje się z każdą podstroną dodaną w panelu.
 * Zrzut z 18.08 nie znał `/symbole-shorinji-kempo`, `/faq` ani `/istota-budo`,
 * bo powstały po nim — a to właśnie one były najbliżej cichej utraty, bo backfill
 * czytał wtedy tylko nav_items i nie umiał ich rozwiązać. Ta kontrola nie ma
 * daty ważności: bierze żywe wiersze wprost z `custom_pages`.
 */
kontrole.push({
  nazwa: "6. Każda żywa podstrona własna ma węzeł pod swoim adresem",
  winne: wlasne
    .filter((w) => !w.deleted_at && w.published)
    .filter((w) => !zywe.has(`/${w.slug}`))
    .map((w) => `/${w.slug} („${w.title}") — brak węzła`),
});

// ─────────────────────────────────────────────────────────────────────────────
// Raport
// ─────────────────────────────────────────────────────────────────────────────

console.log(`\n=== BACKFILL pages — etap 2${NA_SUCHO ? " (NA SUCHO, nic nie zapisano)" : ""} ===`);
// Adres bazy w raporcie, nie w komentarzu: to jedyna rzecz, która odróżnia
// przebieg na poligonie od przebiegu na produkcji, a raport bez niej wygląda
// identycznie w obu przypadkach.
console.log(`Baza docelowa: ${URL_BAZY}`);
console.log(`Źródła: nav_items ${nawigacja.length}, custom_pages ${wlasne.length}, ` +
  `article_overrides ${nadpisania.length}, EDITABLE_PAGES ${EDITABLE_PAGES.length}, ` +
  `data/articles ${GRUPY.reduce((s, g) => s + g.articles.length, 0)} w ${GRUPY.length} tematach`);
console.log(`Zaplanowanych węzłów: ${wezly.length}`);

console.log(`\n— wstawione (${raport.wstawione.length}) —`);
for (const l of raport.wstawione) console.log("  " + l);

if (raport.pominiete.length) {
  console.log(`\n— pominięte, bo już są (${raport.pominiete.length}) —`);
  for (const l of raport.pominiete) console.log("  " + l);
}

if (doDecyzji.length) {
  console.log(`\n— DO DECYZJI REDAKTORA (${doDecyzji.length}) —`);
  for (const l of doDecyzji) console.log("  " + l);
}

if (ostrzezenia.length) {
  console.log(`\n— ostrzeżenia (${ostrzezenia.length}) —`);
  for (const l of ostrzezenia) console.log("  " + l);
}

if (raport.rozjazdy.length) {
  console.log(`\n— ROZJAZDY (${raport.rozjazdy.length}) —`);
  for (const l of raport.rozjazdy) console.log("  " + l);
}

console.log("\n=== KONTROLA (każda pozycja musi być pusta) ===");
let padly = 0;
for (const k of kontrole) {
  if (k.winne.length === 0) {
    console.log(`  OK    ${k.nazwa}`);
  } else {
    padly++;
    console.log(`  BŁĄD  ${k.nazwa} — ${k.winne.length}:`);
    for (const w of k.winne) console.log(`          ${w}`);
  }
}

const zywych = poZapisie.filter((w) => w.kind === "page" && !w.deleted_at).length;
const wKoszu = poZapisie.filter((w) => w.deleted_at).length;
console.log(
  `\nW tabeli pages: ${poZapisie.length} wierszy — ${zywych} żywych stron, ` +
    `${wKoszu} w koszu, ${poZapisie.filter((w) => w.kind === "header").length} nagłówków, ` +
    `${poZapisie.filter((w) => w.kind === "link").length} odnośników.`,
);

if (padly || raport.rozjazdy.length || doDecyzji.length || bladZapisu) {
  console.log("\nWYNIK: BŁĄD — przeczytaj powyższe przed przejściem do etapu 3a.");
  process.exitCode = 1;
} else {
  console.log("\nWYNIK: OK — etap 2 zamknięty, nikt jeszcze z tej tabeli nie czyta.");
}
