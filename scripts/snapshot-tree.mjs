/**
 * Golden master drzewa stron — etap 0a przebudowy menu (docs/menu-architektura.md §5.2).
 *
 * Zapisuje pełny obraz dzisiejszego zachowania serwisu: każdy adres, jego kod HTTP,
 * przekierowania, metadane i objętość treści. Ten plik jest JEDYNĄ siatką bezpieczeństwa
 * migracji — projekt nie ma frameworka testowego. Po każdym etapie uruchamiamy skrypt
 * ponownie i porównujemy; różnica musi być pusta albo świadomie wyjaśniona.
 *
 * URUCHOMIENIE (dwa terminale):
 *   1) npm run build && npm start          # PRODUKCYJNY build — nie `next dev`!
 *   2) node --env-file=.env.local scripts/snapshot-tree.mjs
 *
 * Domyślnie zapisuje docs/golden-master-przed.json. Kolejne przebiegi:
 *   node --env-file=.env.local scripts/snapshot-tree.mjs --wyjscie docs/golden-master-po-etapie-2.json
 *
 * DLACZEGO produkcyjny build, nie `next dev`: pod produkcją /galeria, /sitemap.xml,
 * /robots.txt i /icon.jpg są prerenderowane RAZ i nigdy nie rewalidują
 * (initialRevalidateSeconds = false), 8 tras ma 300 s, 9 ma 3600 s. Ten sam skrypt pod dev
 * i pod prod daje dwa różne golden mastery, a produkcji odpowiada tylko ten drugi.
 *
 * DLACZEGO bez zalogowanej sesji panelu: /admin/artykuly renderuje kliencki TrashSection,
 * który w useEffect woła listTrashedNews -> oproznijStaryKosz("articles") i TRWALE USUWA
 * aktualności leżące w koszu dłużej niż 30 dni. Pomiar nie może zmieniać danych, dlatego
 * skrypt odmawia zapisu, jeśli wykryje sesję (trasa panelu odpowiada 200 zamiast 307).
 *
 * Skrypt jest tylko-czytający: żadnego zapisu do bazy, żadnego POST-a.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

// ─────────────────────────────────────────────────────────────────────────────
// Konfiguracja
// ─────────────────────────────────────────────────────────────────────────────

const BAZA = (process.env.SNAPSHOT_BASE ?? 'http://localhost:3000').replace(/\/$/, '');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Origin, który wchodzi do canonical/sitemapy. Zastępowany tokenem, żeby zrzuty z różnych
 *  maszyn dały się porównać — decyzja zapisana w nagłówku pliku wynikowego. */
const ORIGIN_PRODUKCJA = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://shorinji-kempo.netlify.app').replace(/\/$/, '');
const TOKEN_ORIGIN = '{ORIGIN}';

const arg = (nazwa, domyslnie) => {
  const i = process.argv.indexOf(nazwa);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : domyslnie;
};
const WYJSCIE = arg('--wyjscie', 'docs/golden-master-przed.json');

/** Osiem kanji z VerticalKanji siedzi WEWNĄTRZ <main> z layoutu (app/layout.tsx:78-79),
 *  więc trafiają do każdej asercji długości. Stąd historyczne „15 znaków" na pustej stronie. */
const KANJI_Z_MARGINESU = ['拳', '禅', '一', '如', '力', '愛', '不', '二'];

// ─────────────────────────────────────────────────────────────────────────────
// Adresy odniesienia — zinwentaryzowane 2026-08-18, 19 źródeł (§5.2)
// Format: [ścieżka, oczekiwany status, źródło, uwaga]
// „Oczekiwany" znaczy: tak jest DZIŚ i tak ma zostać po migracji.
// ─────────────────────────────────────────────────────────────────────────────

const ADRESY_ODNIESIENIA = [
  // 1. Statyczne w sitemapie (app/sitemap.ts:12-24)
  ['/', 200, 1, 'priority 1 w sitemapie'],
  ['/aktualnosci', 200, 1, 'listing z canonical'],
  ['/zajecia/cennik', 200, 1, 'cel przekierowania z /cennik'],
  ['/program-nauczania', 200, 1, 'cała treść z bazy'],
  ['/galeria', 200, 1, 'albumy z Cloudinary NA BUILDZIE'],
  ['/kontakt', 200, 1, 'NIE MA wiersza w nav_items — węzeł powstanie tylko z EDITABLE_PAGES'],
  ['/zajecia/dorosli', 200, 1, 'trigger nie wyprodukuje tego adresu z łańcucha slugów'],
  ['/zajecia/dzieci', 200, 1, 'jak wyżej'],
  ['/o-shorinji', 200, 1, 'BRAK canonical — etap 6'],
  ['/organizacja', 200, 1, 'BRAK canonical — etap 6'],
  ['/buddyzm', 200, 1, 'BRAK canonical — etap 6'],

  // 2. Podstrony tematyczne (data/articles/*.ts)
  ['/o-shorinji/wprowadzenie', 200, 2, 'nadpisanie w bazie'],
  ['/o-shorinji/cele-i-wartosci', 200, 2, 'nadpisanie: 32 bloki'],
  ['/o-shorinji/symbolika-i-medytacja', 200, 2, 'bez nadpisania — treść z kodu'],
  ['/o-shorinji/historia', 200, 2, 'cel odnośnika z treści organizacja.ts:26'],
  ['/organizacja/zalozyciel', 200, 2, 'cel 308 z /organizacja/zalozyciel-i-wsko'],
  ['/organizacja/egzaminatorzy', 200, 2, 'dwa bloki person, bez spisu treści'],
  ['/buddyzm/podstawy', 200, 2, 'nadpisanie: 21 bloków'],
  ['/buddyzm/nauki', 200, 2, 'bez nadpisania'],
  ['/buddyzm/medytacja', 200, 2, 'NAJWAŻNIEJSZA asercja: body_md 13 131 znaków, blocks NULL'],
  ['/buddyzm/etyka-i-swieta', 200, 2, 'ostatni w sekcji — brak „następna"'],

  // 4. Własne podstrony (custom_pages → app/[slug], sitemap.ts:53-62).
  //    18.08 ten zbiór był PUSTY i dlatego nie było go na liście. Redaktor dodał
  //    trzy podstrony 19–31.08, czyli po zrzucie — a to właśnie one przechodzą
  //    w etapie 4 z app/[slug] do trasy catch-all, więc bez nich lista odniesienia
  //    nie pilnowałaby najbardziej narażonych adresów w całej migracji.
  ['/symbole-shorinji-kempo', 200, 4, '17 bloków; w menu pod O SHORINJI, ale adres z korzenia'],
  ['/faq', 200, 4, '34 bloki; w menu pod nagłówkiem ZAJĘCIA — nagłówek nie ma adresu, więc adres zostaje jednosegmentowy'],
  ['/istota-budo', 200, 4, '16 bloków; w menu pod O SHORINJI, adres z korzenia'],

  // 3. Aktualności — poza drzewem pages (§2.8)
  ['/aktualnosci/pokaz-gala-35-lat-hapkido-w-polsce', 200, 3, 'jedyna aktualność w bazie'],
  ['/aktualnosci/nieistniejacy-wpis', 404, 3, 'kontrola negatywna; przekierowania tu NIE zadziałają'],

  // 7. Przekierowania z next.config.ts — realne kody, nie 302 z komentarza
  ['/organizacja/zalozyciel-i-wsko', 308, 7, 'permanent:true; ZOSTAJE w next.config.ts (§5.6)'],
  ['/cennik', 307, 7, 'permanent:false; JEDYNA reguła przenoszona do redirects'],

  // 17. Wewnętrzna reguła ukośnika końcowego
  ['/kontakt/', 308, 17, 'reguła /:path+/ z priority:true'],
  ['/zajecia/cennik/', 308, 17, 'druga próbka, adres dwusegmentowy'],
  ['/Kontakt', 404, 17, 'wielkość liter ma znaczenie i tak ma zostać'],

  // 8. Adresy, które MUSZĄ zostać 404 — migracja nie może ich OŻYWIĆ
  ['/zajecia', 404, 8, 'app/zajecia/ nie ma page.tsx; „zajecia" w RESERVED_SLUGS'],
  ['/test', 404, 8, 'usunięty z kosza 2026-08-18'],
  ['/ee', 404, 8, 'jak wyżej'],
  ['/eee', 404, 8, 'jak wyżej'],
  ['/sens-budo', 404, 8, 'w koszu od 2026-08-20 (deleted_at) — backfill przenosi go RAZEM z deleted_at, więc ma zostać martwy'],
  ['/admin/typo', 404, 8, 'po etapie 4 bez guarda dałoby 200 z catch-alla'],
  ['/api/foo', 404, 8, 'jak wyżej'],
  ['/wp-login.php', 404, 8, 'ruch skanerów — po etapie 4 nie może odpalać zapytań do bazy'],
  ['/.env', 404, 8, 'segment nie pasuje do ^[a-z0-9-]+$'],

  // 15. Kontrole negatywne pod prefiksami tematycznymi — kandydaci na przypadkowe 200
  ['/o-shorinji/nie-ma-takiej-podstrony', 404, 15, 'notFound() w app/o-shorinji/[slug]/page.tsx:41'],
  ['/organizacja/nie-ma-takiej-podstrony', 404, 15, 'jak wyżej'],
  ['/buddyzm/nie-ma-takiej-podstrony', 404, 15, 'jak wyżej'],
  ['/zajecia/cokolwiek', 404, 15, 'drugi segment pod istniejącym prefiksem bez trasy'],
  ['/program-nauczania/uczniowskie/6-kyu', 404, 15, 'trzy segmenty — po etapie 4 ma dawać 200 z drzewa'],

  // 10. Trasy metadanych
  ['/sitemap.xml', 200, 10, '22 wpisy dziś'],
  ['/robots.txt', 200, 10, 'nie wyklucza NICZEGO — etap 4 dokłada disallow /admin'],
  ['/icon.jpg', 200, 10, 'realna trasa ikony (konwencja plikowa app/icon.jpg)'],
  ['/icon', 404, 10, 'BRAKUJE w RESERVED_SLUGS — da się dziś utworzyć kolidującą podstronę'],
  ['/favicon.ico', 404, 10, 'brak pliku; Next nie generuje go z app/icon.jpg'],

  // 13. Pliki statyczne z public/
  ['/og.png', 200, 13, 'og:image i twitter:image (app/layout.tsx:42,53)'],
  ['/SOEN.jpg', 200, 13, 'logo w Navbarze i JSON-LD'],
  ['/file.svg', 200, 13, 'resztka po create-next-app'],
  ['/globe.svg', 200, 13, 'resztka po create-next-app'],
  ['/next.svg', 200, 13, 'resztka po create-next-app'],
  ['/vercel.svg', 200, 13, 'resztka po create-next-app'],
  ['/window.svg', 200, 13, 'resztka po create-next-app'],

  // 9. Route handlery
  ['/downloads/deklaracja-dorosli.pdf', 200, 9, 'w stopce i w CTA na /zajecia/dorosli'],
  ['/downloads/deklaracja-do-18.pdf', 200, 9, 'w stopce i w CTA na /zajecia/dzieci'],
  ['/downloads/statut-posk.pdf', 200, 9, 'kolumna DOKUMENTY w stopce'],
  ['/downloads/wsko-statutes.pdf', 200, 9, 'kolumna DOKUMENTY'],
  ['/downloads/wsko-bylaws.pdf', 200, 9, 'kolumna DOKUMENTY'],
  ['/downloads/wsko-regulations.pdf', 200, 9, 'kolumna DOKUMENTY'],
  ['/downloads/nie-ma-takiego-pliku.pdf', 404, 9, 'kontrola negatywna route.ts:38-40'],
  ['/downloads', 404, 14, 'zarezerwowany slug bez trasy'],
  ['/api', 404, 14, 'zarezerwowany slug bez trasy'],
  ['/api/schedule/dorosli/calendar.ics', 200, 9, 'grafik z site_settings klucz schedule'],
  ['/api/schedule/dzieci/calendar.ics', 200, 9, 'jak wyżej'],
  ['/api/schedule/nieznana/calendar.ics', 404, 9, 'kontrola negatywna route.ts:112-114'],

  // 11. Panel — sprawdzany BEZ sesji; wszystko w grupie (panel) ma dać 307 na login
  ['/admin', 307, 11, 'strażnik layoutu'],
  ['/admin/admini', 307, 11, ''],
  ['/admin/artykuly', 307, 11, 'UWAGA: z sesją ten adres KASUJE stary kosz aktualności'],
  ['/admin/artykuly/nowy', 307, 11, ''],
  ['/admin/dane-organizacji', 307, 11, 'źródło danych kontaktowych i profili w stopce'],
  ['/admin/harmonogram', 307, 11, ''],
  ['/admin/nawigacja', 307, 11, 'zakładka do zniknięcia w etapie 8'],
  ['/admin/pliki', 307, 11, ''],
  ['/admin/stopka', 307, 11, 'drugie miejsce, gdzie redaktor wpisuje adresy z palca'],
  ['/admin/strony', 307, 11, 'lista pokazuje tytuły artykułów Z KODU, nie z nadpisań'],
  ['/admin/wiadomosci', 307, 11, ''],
  ['/admin/wlasne/nowy', 307, 11, 'tu startuje initialInMenu=true — mechanizm martwego linku'],
  ['/admin/zdjecia', 307, 11, ''],
  ['/admin/login', 200, 11, 'POZA grupą (panel) — dostępne bez sesji'],
  ['/admin/nowe-haslo', 200, 11, 'POZA grupą (panel) celowo'],
  ['/admin/strona/nie-ma-takiej', 307, 11, 'strażnik layoutu wyprzedza notFound() ze strony'],
];

// ─────────────────────────────────────────────────────────────────────────────
// Pomocnicze
// ─────────────────────────────────────────────────────────────────────────────

const bez = (s) => s.replace(new RegExp(ORIGIN_PRODUKCJA.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), TOKEN_ORIGIN);
const jedno = (s) => s.replace(/\s+/g, ' ').trim();
const ile = (tekst, igla) => tekst.split(igla).length - 1;

function bezTagow(html) {
  return jedno(html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'"));
}

/**
 * Wycina ZEWNĘTRZNY <main> z layoutu. Uwaga: na 10 podstronach tematycznych <main> jest
 * ZAGNIEŻDŻONY (components/ArticlePage.tsx:74 renderuje drugi w środku pierwszego), więc
 * dopasowanie leniwe urwałoby wycinek na wewnętrznym </main> i zgubiło wszystko po treści
 * artykułu. Dlatego: od pierwszego <main class="flex-grow"> do OSTATNIEGO </main>.
 */
function glownyKontener(html) {
  const start = html.indexOf('<main class="flex-grow"');
  const startAlt = start === -1 ? html.indexOf('<main') : start;
  if (startAlt === -1) return null;
  const koniec = html.lastIndexOf('</main>');
  if (koniec === -1 || koniec < startAlt) return null;
  return html.slice(startAlt, koniec + '</main>'.length);
}

function meta(html, wzor) {
  const m = html.match(wzor);
  return m ? jedno(m[1]) : null;
}

async function pytaj(sciezka) {
  const url = BAZA + sciezka;
  try {
    const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'snapshot-tree/1.0' } });
    const typ = r.headers.get('content-type') ?? '';
    const wynik = {
      status: r.status,
      typ: typ.split(';')[0] || null,
    };
    const loc = r.headers.get('location');
    if (loc) wynik.location = bez(loc);

    if (!typ.includes('text/html')) {
      // Pliki i route handlery: rozmiar wystarcza, treści nie porównujemy.
      const dlugosc = r.headers.get('content-length');
      wynik.dlugosc = dlugosc ? Number(dlugosc) : (await r.arrayBuffer()).byteLength;
      return wynik;
    }

    const html = await r.text();
    wynik.title = meta(html, /<title>([\s\S]*?)<\/title>/i);
    wynik.description = meta(html, /<meta name="description" content="([^"]*)"/i);
    const canonical = meta(html, /<link rel="canonical" href="([^"]*)"/i);
    wynik.canonical = canonical ? bez(canonical) : null;
    wynik.h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/gi) ?? []).length;

    const main = glownyKontener(html);
    if (main === null) {
      wynik.main = null;
    } else {
      let tekst = bezTagow(main);
      for (const k of KANJI_Z_MARGINESU) tekst = tekst.split(k).join('');
      wynik.main = {
        znakow: jedno(tekst).length,
        znakowZKanji: bezTagow(main).length,
        naglowkow: ile(main, '<h2') + ile(main, '<h3'),
        obrazkowCloudinary: ile(main, 'res.cloudinary.com'),
        odnosnikowWewnetrznych: (main.match(/href="\/[^"]*"/g) ?? []).length,
        spisTresci: main.includes('Na tej stronie'),
        okruszek: main.includes('aria-label="Breadcrumb"'),
        poprzedniaNastepna: main.includes('aria-label="Nawigacja w sekcji"'),
        formularz: main.includes('name="honeypot"') || /<form/i.test(main),
        mapa: main.includes('google.com/maps'),
        grafik: main.includes('calendar.ics'),
      };
    }
    return wynik;
  } catch (e) {
    return { status: 'BLAD_POLACZENIA', blad: String(e.message ?? e) };
  }
}

async function postgrest(sciezka) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${sciezka}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (r.status !== 200) throw new Error(`PostgREST ${sciezka}: HTTP ${r.status}`);
  return r.json();
}

// ─────────────────────────────────────────────────────────────────────────────
// Odmowy — lepszy brak zrzutu niż zrzut, który kłamie
// ─────────────────────────────────────────────────────────────────────────────

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'ODMOWA: brak NEXT_PUBLIC_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY.\n' +
    'Zrzut zrobiony na fallbackach z kodu (menu z DEFAULT_NAV, grafik ze SCHEDULE) jest\n' +
    'GORSZY od braku zrzutu, bo wygląda jak stan produkcji, a nim nie jest.\n' +
    'Uruchom: node --env-file=.env.local scripts/snapshot-tree.mjs'
  );
  process.exit(1);
}

const zdrowie = await pytaj('/');
if (zdrowie.status === 'BLAD_POLACZENIA') {
  console.error(`ODMOWA: ${BAZA} nie odpowiada (${zdrowie.blad}).\nNajpierw: npm run build && npm start`);
  process.exit(1);
}

const probaSesji = await pytaj('/admin/artykuly');
if (probaSesji.status === 200) {
  console.error(
    'ODMOWA: /admin/artykuly zwróciło 200, czyli skrypt ma ciasteczka zalogowanej sesji.\n' +
    'Ten adres renderuje TrashSection, który woła oproznijStaryKosz("articles") i TRWALE\n' +
    'USUWA aktualności z kosza starsze niż 30 dni. Pomiar nie może zmieniać danych.\n' +
    'Uruchom skrypt bez sesji (osobny proces, bez przekazywania ciasteczek).'
  );
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Zbieranie
// ─────────────────────────────────────────────────────────────────────────────

console.log(`Zrzut z ${BAZA} (origin w metadanych: ${ORIGIN_PRODUKCJA} -> ${TOKEN_ORIGIN})`);

// Źródło 5: menu z drzewa `pages`.
//
// Do etapu 8 czytaliśmy tu `nav_items`. Ta tabela już nie istnieje — została
// skasowana razem z `custom_pages` i `article_overrides`
// (supabase/04-contract.sql). Narzędzie pomiarowe musi zejść ze skasowanego
// źródła tak samo jak aplikacja; inaczej "kontrola po etapie" wywala się na
// tym, co ten etap miał zrobić.
//
// Kształt zapisu został ten sam (label / href / visible / dzieci), żeby zrzuty
// sprzed i po etapie 8 dały się porównać wprost.
const navSurowe = await postgrest(
  'pages?select=id,parent_id,kind,menu_label,title,full_path,external_url,in_menu,published,depth,position' +
    '&deleted_at=is.null&order=position.asc',
);
const adresWezla = (w) =>
  w.kind === 'link' ? w.external_url : w.kind === 'header' ? null : w.full_path;
const wMenu = (w) => w.in_menu && w.published;
const menuSurowe = navSurowe
  .filter((w) => w.depth === 0 && wMenu(w))
  .sort((a, b) => a.position - b.position)
  .map((w) => ({
    label: w.menu_label ?? w.title,
    href: adresWezla(w),
    visible: w.in_menu,
    dzieci: navSurowe
      .filter((d) => d.parent_id === w.id && wMenu(d))
      .sort((a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id)))
      .map((d) => ({ label: d.menu_label ?? d.title, href: adresWezla(d), visible: d.in_menu })),
  }));

// Źródło 12: stopka — DWA klucze, bo profile społecznościowe idą z 'organization',
// a klucze social/contact z wiersza 'footer' są przez migrujStopke IGNOROWANE.
const ustawienia = await postgrest('site_settings?select=key,value');
const wartosc = (k) => ustawienia.find((w) => w.key === k)?.value ?? null;
const stopka = wartosc('footer');
const organizacja = wartosc('organization');
const adresyStopki = JSON.stringify(stopka ?? {}).match(/"(https?:\/\/[^"]+|\/[^"]*)"/g) ?? [];
const profileOrganizacji = organizacja?.social ?? null;

// Źródło 6: pary (slug, route) z lib/editablePages.ts — jedyne miejsce z tym mapowaniem.
const zrodloEditable = readFileSync('lib/editablePages.ts', 'utf8');
const paryEditable = [...zrodloEditable.matchAll(/slug:\s*"([^"]+)"[\s\S]{0,400}?route:\s*"([^"]+)"/g)]
  .map(([, slug, route]) => ({ slug, route, rozjazd: `/${slug}` !== route }));

// Źródło 7: przekierowania z next.config.ts — kod z flagi permanent, nie z komentarza.
const zrodloConfig = readFileSync('next.config.ts', 'utf8');
const przekierowaniaConfig = [...zrodloConfig.matchAll(/source:\s*'([^']+)'[\s\S]{0,200}?destination:\s*'([^']+)'[\s\S]{0,120}?permanent:\s*(true|false)/g)]
  .map(([, source, destination, permanent]) => ({
    source, destination,
    permanent: permanent === 'true',
    status: permanent === 'true' ? 308 : 307,
  }));

// Źródło 14: RESERVED_SLUGS. Do etapu 8 lista mieszkała w `lib/customPages.ts`;
// ten plik zniknął razem z tabelą `custom_pages`, a lista przeniosła się do
// `lib/pages.ts` — i urosła o `icon` oraz `favicon.ico` (trasa metadanych
// `/icon.jpg` istniała, a na tamtej liście jej nie było, więc dało się utworzyć
// kolidującą podstronę).
const zrodloCustom = readFileSync('lib/pages.ts', 'utf8');
const blokReserved = zrodloCustom.match(/RESERVED_SLUGS = new Set\(\[([\s\S]*?)\]\)/);
const reserved = blokReserved ? [...blokReserved[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]) : [];

// Źródła 1-4: sitemapa — porównujemy zbiór url+priority+changefreq. lastModified pomijamy,
// bo app/sitemap.ts:10,35 wstawia new Date() i różnica nigdy nie byłaby pusta.
const sitemapXml = await (await fetch(`${BAZA}/sitemap.xml`)).text();
const sitemap = [...sitemapXml.matchAll(/<url>([\s\S]*?)<\/url>/g)]
  .map(([, blok]) => ({
    url: bez(meta(blok, /<loc>([^<]*)<\/loc>/) ?? ''),
    changeFrequency: meta(blok, /<changefreq>([^<]*)<\/changefreq>/),
    priority: meta(blok, /<priority>([^<]*)<\/priority>/),
  }))
  .sort((a, b) => a.url.localeCompare(b.url));

// Adresy do zbadania: odniesienie + wszystko, co wyszło z sitemapy, menu i stopki.
const zSitemapy = sitemap.map((w) => w.url.replace(TOKEN_ORIGIN, '') || '/');
const zMenu = navSurowe.filter(wMenu).map(adresWezla).filter(Boolean);
const zStopki = adresyStopki.map((s) => s.slice(1, -1)).filter((s) => s.startsWith('/'));
const znane = new Set(ADRESY_ODNIESIENIA.map(([s]) => s));
const dodatkowe = [...new Set([...zSitemapy, ...zMenu, ...zStopki])].filter((s) => !znane.has(s)).sort();

const adresy = {};
const doZbadania = [
  ...ADRESY_ODNIESIENIA.map(([sciezka, oczekiwany, zrodlo, uwaga]) => ({ sciezka, oczekiwany, zrodlo, uwaga })),
  ...dodatkowe.map((sciezka) => ({ sciezka, oczekiwany: null, zrodlo: 'wykryty', uwaga: 'wyszedł z sitemapy/menu/stopki, nie było go na liście odniesienia' })),
];

let rozjazdy = 0;
for (const { sciezka, oczekiwany, zrodlo, uwaga } of doZbadania) {
  const wynik = await pytaj(sciezka);
  const zgodny = oczekiwany === null ? null : wynik.status === oczekiwany;
  if (zgodny === false) rozjazdy++;
  adresy[sciezka] = { zrodlo, ...(uwaga ? { uwaga } : {}), ...(oczekiwany !== null ? { oczekiwany } : {}), ...wynik, ...(zgodny === false ? { ROZJAZD: true } : {}) };
  process.stdout.write(zgodny === false ? '!' : '.');
}
process.stdout.write('\n');

// ─────────────────────────────────────────────────────────────────────────────
// Dwa testy regresji (§5.2) — dziś oba CZERWONE, po etapie 5 muszą być ZIELONE
// ─────────────────────────────────────────────────────────────────────────────

const hrefyBezTrasy = zMenu.filter((h) => {
  const w = adresy[h];
  return w && typeof w.status === 'number' && w.status >= 400;
});

const testyRegresji = {
  szkic_z_menu_nie_trafia_do_menu: {
    stan: 'CZERWONY (oczekiwany dziś)',
    dlaczego: 'syncNavItem nie zna kolumny published (actions/customPageActions.ts:33-38), a nowa podstrona startuje z initialInMenu=true — szkic z zaznaczonym „Pokaż w menu górnym" pojawia się w menu i prowadzi do 404',
    jak_sprawdzic_po_etapie_5: 'utworzyć niepublikowaną podstronę z zaznaczonym „Pokaż w menu górnym" i sprawdzić, że jej href NIE pojawia się w menuSurowe',
    dzisiejszy_dowod: 'brak żywych wierszy w custom_pages, więc dziś nie da się tego odtworzyć bez utworzenia podstrony — mechanizm potwierdzony w kodzie, nie w danych',
  },
  href_menu_bez_trasy_nie_da_sie_zapisac: {
    stan: hrefyBezTrasy.length > 0 ? 'CZERWONY (są martwe hrefy w menu)' : 'CZERWONY (walidacji nie ma, ale dziś zero martwych hrefów)',
    dlaczego: 'href w NavEditorze to wolne pole tekstowe bez walidacji — jedna literówka i pozycja menu prowadzi w 404',
    martwe_hrefy_dzis: hrefyBezTrasy,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Zapis
// ─────────────────────────────────────────────────────────────────────────────

const zrzut = {
  _o_pliku: {
    co_to_jest: 'Golden master serwisu shorinji-strona — punkt odniesienia dla przebudowy menu i stron (docs/menu-architektura.md §5.2). Różnica między tym plikiem a kolejnym zrzutem musi być pusta albo świadomie wyjaśniona.',
    wygenerowano: new Date().toISOString(),
    baza_pomiaru: BAZA,
    tryb_serwera: process.env.SNAPSHOT_TRYB ?? 'NIEZADEKLAROWANY — ustaw SNAPSHOT_TRYB=produkcyjny albo dev',
    origin_w_metadanych: `${ORIGIN_PRODUKCJA} zastąpiony tokenem ${TOKEN_ORIGIN}`,
    dlaczego_normalizacja_origin: 'NEXT_PUBLIC_SITE_URL nie jest ustawiony w .env.local, więc lib/site.ts:9-11 spada na literał produkcyjny. Bez normalizacji zrzut z innej maszyny różniłby się w KAŻDYM wpisie.',
    lastModified: 'POMINIĘTE świadomie — app/sitemap.ts:10,35 wstawia new Date(), więc różnica nigdy nie byłaby pusta. To samo dotyczy roku w stopce (components/Footer.tsx:147).',
    znane_roznice_wobec_stanu_z_audytu: [
      'custom_pages: trzy wiersze z kosza (/test, /ee, /eee, zero bloków) usunięte trwale 2026-08-18 decyzją właściciela, PRZED tym zrzutem. Zrzut całej bazy sprzed usunięcia: shorinji-notes/db-backup-2026-08-18/. Publicznie zero zmian — te adresy dawały 404 i dają 404.',
      'Kosz podstron NIE opróżnia się sam: oproznijStaryKosz("custom_pages") nigdy się nie wykonuje, bo listTrashedCustomPages/restoreCustomPage/purgeCustomPage nie mają w repo ani jednego wywołania. Dlatego usunięcie było ręczne.',
      'ZRZUT ODŚWIEŻONY 2026-09-01, bo poprzedni (18.08) przestał być punktem odniesienia: redaktor pracował 19–31.08 i dodał TRZY żywe podstrony własne (/symbole-shorinji-kempo, /faq, /istota-budo) plus czwartą do kosza (/sens-budo), nav_items urosło z 20 do 23 wierszy, article_overrides z 5 do 8, a dwie pozycje menu zmieniły etykiety (SYMBOLIKA I MEDYTACJA → MEDYTACJA / ZAZEN, HISTORIA → HISTORIA SZKOŁY). Poprzedni zrzut zarchiwizowany: shorinji-notes/golden-master-2026-08-18.json. Zrzut całej bazy z dnia odświeżenia: shorinji-notes/db-backup-2026-09-01/.',
      'Odświeżenie zrobione z kodu gałęzi master (ten stoi na produkcji), NIE z gałęzi drzewo-stron. Na drzewo-stron menu czyta tabelę pages, której na produkcji nie ma — zrzut z tamtego kodu pokazałby menu zapasowe z repo zamiast produkcyjnego.',
    ],
    uwagi_o_pomiarze: [
      '/admin/login i /admin/nowe-haslo renderują formularz PO STRONIE KLIENTA — serwerowy <main class="flex-grow"> jest pusty (0 znaków, zero <form>). „0 znaków" na tych dwóch trasach to stan dzisiejszy, nie regresja.',
      'Trasy 404 mają dziś 33 znaki i jeden <h1> — to wbudowana strona Next. Etap 4 dokłada app/not-found.tsx, więc ta liczba zmieni się ŚWIADOMIE na wszystkich adresach 404 naraz.',
      'Długość treści liczona po usunięciu 8 kanji z VerticalKanji i po zwinięciu białych znaków — liczby są porównywalne wyłącznie między zrzutami z tego samego skryptu, nie z pomiarami z innych sesji.',
      'Trzy listingi tematyczne (/o-shorinji, /organizacja, /buddyzm) nie mają canonical — to potwierdzony brak do naprawy w etapie 6, nie błąd pomiaru.',
    ],
    zasada: 'W trakcie etapów 0–4 nie edytować treści ani slugów w panelu. Zmiana sluga nie rewaliduje STAREGO adresu (actions/customPageActions.ts:125-126), więc zrzut zrobiony w ciągu 300 s po edycji pokaże dwa żywe adresy dla jednej strony.',
  },
  _podsumowanie: {
    adresow_zbadanych: Object.keys(adresy).length,
    z_listy_odniesienia: ADRESY_ODNIESIENIA.length,
    wykrytych_poza_lista: dodatkowe.length,
    rozjazdow_wobec_oczekiwan: rozjazdy,
    wpisow_w_sitemapie: sitemap.length,
    wezlow_w_drzewie: navSurowe.length,
    hrefow_w_nav_items: zMenu.length,
    par_editable_pages: paryEditable.length,
    rozjazdow_slug_route: paryEditable.filter((p) => p.rozjazd).length,
    reserved_slugs: reserved.length,
  },
  menuSurowe,
  paryEditable,
  przekierowaniaConfig,
  reserved,
  stopka: { adresyZKluczaFooter: zStopki, profileZKluczaOrganization: profileOrganizacji },
  sitemap,
  adresy,
  testyRegresji,
};

mkdirSync(dirname(WYJSCIE), { recursive: true });
writeFileSync(WYJSCIE, JSON.stringify(zrzut, null, 2) + '\n', 'utf8');

console.log(`\nZapisano ${WYJSCIE}`);
console.log(`  adresów: ${Object.keys(adresy).length} (odniesienie ${ADRESY_ODNIESIENIA.length} + wykryte ${dodatkowe.length})`);
console.log(`  sitemapa: ${sitemap.length} wpisów | drzewo: ${navSurowe.length} węzłów, ${zMenu.length} adresów w menu`);
console.log(`  rozjazdów wobec oczekiwanych statusów: ${rozjazdy}`);
if (rozjazdy > 0) {
  console.log('\n  ROZJAZDY (szukaj "ROZJAZD": true w pliku):');
  for (const [s, w] of Object.entries(adresy)) {
    if (w.ROZJAZD) console.log(`    ${s.padEnd(46)} oczekiwano ${w.oczekiwany}, jest ${w.status}`);
  }
  console.log('\n  Rozjazd na PIERWSZYM zrzucie znaczy, że lista odniesienia jest nieaktualna');
  console.log('  albo serwer nie stoi w trybie produkcyjnym. Wyjaśnić PRZED etapem 1.');
}
