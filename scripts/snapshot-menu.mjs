/**
 * snapshot-menu.mjs — zapasowy zrzut menu do repozytorium.
 *
 * PO CO
 * -----
 * Po przejściu odczytu na `pages` z bazy pochodzą nie tylko etykiety, ale CAŁE
 * drzewo adresów. Jedna brakująca zmienna środowiskowa albo jeden timeout gasi
 * wtedy menu w layoucie — na wszystkich trasach naraz. To nie jest hipoteza:
 * `PGRST303 "JWT issued at future"` przy zimnym starcie zrzucił 2026-08-12
 * `getNavTree`, `getSchedule` i `getNews` na zapas z kodu.
 *
 * Zapasem NIE może być `DEFAULT_NAV` (§5.5): po migracji przestaje odpowiadać
 * drzewu i kłamie tym goręcej, im więcej redaktor zmieni. Zapasem jest ten
 * zrzut — generowany z tego samego źródła, co menu na stronie, tą samą funkcją
 * `buildNavTree`.
 *
 * URUCHOMIENIE
 * ------------
 *   node scripts/snapshot-menu.mjs                     (baza z .env*)
 *   node Poligon/na-poligonie.mjs scripts/snapshot-menu.mjs
 *   node scripts/snapshot-menu.mjs --sprawdz           (nie zapisuje; kod 1, gdy zrzut nieaktualny)
 *
 * `--sprawdz` jest po to, żeby dało się to wpiąć w kontrolę przed wdrożeniem:
 * zrzut, który rozjechał się z bazą, jest gorszy od jego braku, bo w awarii
 * podstawia nieistniejące adresy.
 *
 * GDZIE LĄDUJE PLIK
 * -----------------
 * `data/menuFallback.ts` — świadomie NIE pod `app/` ani `components/`.
 * `app/globals.css` ma `source(none)` z jawnymi `@source`, a ten plik jest pełen
 * ścieżek; położenie go w skanowanym katalogu to powrót awarii `\1608be`
 * opisanej w CLAUDE.md.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, zKodu } from "./wczytaj-ts.mjs";

const { buildNavTree } = await zKodu("lib/navTree.ts");

const SPRAWDZ = process.argv.includes("--sprawdz");
const PLIK = join(ROOT, "data", "menuFallback.ts");

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
  // Środowisko procesu przed plikami — inaczej „zrzut z poligonu" po cichu
  // czytałby produkcję.
  for (const nazwa of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[nazwa]) merged[nazwa] = process.env[nazwa];
  }
  return merged;
}

const env = loadEnv();
for (const wymagana of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[wymagana]) {
    console.error(
      `ODMOWA: brak zmiennej ${wymagana}.\n` +
        "Zrzut zrobiony bez bazy byłby pusty, a pusty zapas menu to menu, które w awarii znika.",
    );
    process.exit(1);
  }
}

const URL_BAZY = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");

// Ten sam filtr co w getNavTree: widoczne, opublikowane, poza koszem, dwa
// poziomy. Trzeci poziom istnieje w drzewie, ale nie w rozwijanym menu (§3).
const ZAPYTANIE =
  "pages?select=id,parent_id,kind,full_path,external_url,title,menu_label,depth,position" +
  "&in_menu=is.true&published=is.true&deleted_at=is.null&depth=lte.1&order=position.asc";

const r = await fetch(`${URL_BAZY}/rest/v1/${ZAPYTANIE}`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  },
  signal: AbortSignal.timeout(30_000),
});
const tekst = await r.text();
if (!r.ok) {
  console.error(`ODMOWA: HTTP ${r.status} z bazy — ${tekst.slice(0, 300)}`);
  process.exit(1);
}

const drzewo = buildNavTree(JSON.parse(tekst));

if (!drzewo.length) {
  console.error(
    "ODMOWA: z bazy wyszło PUSTE menu. Zapisanie pustego zapasu zamieniłoby awarię bazy\n" +
      "w trwały brak menu. Sprawdź, czy backfill (etap 2) się wykonał.",
  );
  process.exit(1);
}

const dzis = new Date();
const stempel = [
  dzis.getFullYear(),
  String(dzis.getMonth() + 1).padStart(2, "0"),
  String(dzis.getDate()).padStart(2, "0"),
].join("-");

const tresc =
  `import type { NavLink } from "@/lib/navTypes";\n` +
  `\n` +
  `/**\n` +
  ` * PLIK GENEROWANY — nie edytować ręcznie.\n` +
  ` * Wytworzony przez scripts/snapshot-menu.mjs, ${stempel}.\n` +
  ` *\n` +
  ` * Zapasowe menu na wypadek, gdy tabela \`pages\` jest nieosiągalna: brak\n` +
  ` * konfiguracji Supabase, timeout, błąd zapytania albo pusty wynik. Bez niego\n` +
  ` * pojedyncza awaria bazy gasi nawigację na wszystkich trasach naraz.\n` +
  ` *\n` +
  ` * Po każdej większej zmianie struktury menu uruchom ponownie:\n` +
  ` *   node scripts/snapshot-menu.mjs\n` +
  ` * Kontrola aktualności (kod 1, gdy się rozjechało):\n` +
  ` *   node scripts/snapshot-menu.mjs --sprawdz\n` +
  ` */\n` +
  `export const MENU_FALLBACK: NavLink[] = ${JSON.stringify(drzewo, null, 2)};\n`;

const pozycji = drzewo.length;
const dzieci = drzewo.reduce((s, w) => s + (w.dropdown?.length ?? 0), 0);

if (SPRAWDZ) {
  let obecna = null;
  try {
    obecna = readFileSync(PLIK, "utf8");
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
  // Porównanie z pominięciem linii ze stemplem daty: sama data nie jest
  // rozjazdem menu, a bez tego wyjątku kontrola byłaby czerwona codziennie.
  const bezDaty = (s) => (s ?? "").replace(/ \* Wytworzony przez [^\n]*\n/, "");
  if (bezDaty(obecna) === bezDaty(tresc)) {
    console.log(`OK — data/menuFallback.ts zgadza się z bazą (${pozycji} pozycji, ${dzieci} podpozycji).`);
  } else {
    console.error(
      "ROZJAZD: data/menuFallback.ts nie odpowiada drzewu w bazie.\n" +
        "Uruchom: node scripts/snapshot-menu.mjs",
    );
    process.exitCode = 1;
  }
} else {
  writeFileSync(PLIK, tresc, "utf8");
  console.log(`Zapisano data/menuFallback.ts — ${pozycji} pozycji, ${dzieci} podpozycji.`);
  console.log(`Źródło: ${URL_BAZY}`);
  for (const w of drzewo) {
    console.log(`  ${w.label}${w.href ? " → " + w.href : " (bez adresu)"}`);
    for (const d of w.dropdown ?? []) console.log(`      ${d.label} → ${d.href}`);
  }
}
