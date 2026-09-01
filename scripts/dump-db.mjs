/**
 * dump-db.mjs — zrzut wszystkich tabel treści do plików JSON.
 *
 * PO CO
 * -----
 * Dwa zastosowania, oba wynikają wprost z §7 i §8 specyfikacji migracji:
 *   1. Kopia zapasowa przed pierwszym zapisem do bazy. To JEDYNA realna droga
 *      odwrotu — kosz podstron i `content_versions` nią nie są (`content_versions`
 *      ma zero wierszy mimo edycji redaktora, a akcje kosza nie mają w repo
 *      ani jednego wywołania).
 *   2. Zasilenie bazy-poligonu kopią produkcji. Poligon pusty jest bezużyteczny:
 *      pułapki tej migracji siedzą w KSZTAŁCIE danych (np. `blocks NULL` przy
 *      13 131 znakach `body_md`), a nie w kodzie.
 *
 * Skrypt jest TYLKO-CZYTAJĄCY: same GET-y, ani jednego zapisu.
 *
 * URUCHOMIENIE
 * ------------
 *   node scripts/dump-db.mjs                        → ../shorinji-notes/db-backup-<RRRR-MM-DD>/
 *   node scripts/dump-db.mjs --katalog <sciezka>
 *
 * Zmienne środowiskowe mają pierwszeństwo nad .env* — dzięki temu tym samym
 * skryptem da się zrzucić poligon (przez Poligon/na-poligonie.mjs).
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const TABELE = [
  "site_settings",
  "articles",
  "article_overrides",
  "custom_pages",
  "nav_items",
  "contact_messages",
  "content_versions",
];

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
for (const wymagana of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[wymagana]) {
    console.error(
      `ODMOWA: brak zmiennej ${wymagana}. Zrzut zrobiony bez klucza service-role byłby pusty,\n` +
        "a pusty plik kopii zapasowej jest gorszy od jej braku — wygląda jak kopia.",
    );
    process.exit(1);
  }
}

const URL_BAZY = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KLUCZ = env.SUPABASE_SERVICE_ROLE_KEY;

const arg = (nazwa, domyslnie) => {
  const i = process.argv.indexOf(nazwa);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : domyslnie;
};

// Data w nazwie katalogu z zegara systemowego, w strefie lokalnej — nie z UTC,
// żeby katalog zgadzał się z dniem, w którym człowiek pamięta, że robił zrzut.
const dzis = new Date();
const stempel = [
  dzis.getFullYear(),
  String(dzis.getMonth() + 1).padStart(2, "0"),
  String(dzis.getDate()).padStart(2, "0"),
].join("-");

const KATALOG = arg("--katalog", join(ROOT, "..", "shorinji-notes", `db-backup-${stempel}`));

/**
 * Stronicowanie po 1000: tyle wynosi domyślny sufit PostgREST (`db-max-rows`).
 * Bez tego zrzut dużej tabeli urwałby się w ciszy na tysiącu wierszy i wyglądał
 * na kompletny — kopia zapasowa gubiąca dane bez słowa jest gorsza od błędu.
 */
async function pobierzWszystko(tabela) {
  const wiersze = [];
  const KROK = 1000;
  for (let od = 0; ; od += KROK) {
    const r = await fetch(`${URL_BAZY}/rest/v1/${tabela}?select=*`, {
      headers: {
        apikey: KLUCZ,
        Authorization: `Bearer ${KLUCZ}`,
        Range: `${od}-${od + KROK - 1}`,
        "Range-Unit": "items",
      },
      signal: AbortSignal.timeout(60_000),
    });
    const tekst = await r.text();
    if (!r.ok) throw new Error(`${tabela}: HTTP ${r.status} ${tekst.slice(0, 300)}`);
    const paczka = JSON.parse(tekst);
    wiersze.push(...paczka);
    if (paczka.length < KROK) return wiersze;
  }
}

mkdirSync(KATALOG, { recursive: true });

console.log(`Zrzut z ${URL_BAZY}`);
console.log(`Katalog: ${KATALOG}\n`);

let bledy = 0;
const podsumowanie = [];

for (const tabela of TABELE) {
  try {
    const wiersze = await pobierzWszystko(tabela);
    writeFileSync(join(KATALOG, `${tabela}.json`), JSON.stringify(wiersze, null, 1) + "\n", "utf8");
    podsumowanie.push({ tabela, wierszy: wiersze.length });
    console.log(`  ${String(wiersze.length).padStart(5)} wierszy  ${tabela}.json`);
  } catch (e) {
    bledy++;
    console.error(`  BŁĄD  ${tabela}: ${e.message}`);
  }
}

writeFileSync(
  join(KATALOG, "_o_zrzucie.json"),
  JSON.stringify(
    {
      zrodlo: URL_BAZY,
      wykonano: dzis.toISOString(),
      tabele: podsumowanie,
      uwaga:
        "Zrzut tylko-czytający, przez PostgREST. Nie obejmuje Supabase Auth (konta admina) " +
        "ani obrazów w Cloudinary — te żyją poza tą bazą. contact_messages zawiera dane " +
        "osobowe z formularza kontaktowego.",
    },
    null,
    1,
  ) + "\n",
  "utf8",
);

console.log(`\nZapisano ${podsumowanie.length} z ${TABELE.length} tabel.`);
if (bledy) {
  console.log("WYNIK: BŁĄD — zrzut NIEKOMPLETNY, nie używać jako kopii zapasowej.");
  process.exitCode = 1;
} else {
  console.log("WYNIK: OK");
}
