/**
 * migrate-tresc.mjs — etap 7: treść podstron tematycznych do `pages.blocks`.
 *
 * CO ROBI
 * -------
 * Dla dziesięciu podstron tematycznych (`/o-shorinji/*`, `/organizacja/*`,
 * `/buddyzm/*`) przenosi treść do drzewa i przełącza węzeł z `source='route'`
 * na `source='db'`. Od tej chwili renderuje je trasa catch-all, a nie
 * `app/{topic}/[slug]`.
 *
 * PRZEZ `resolveArticleBlocks`, NIGDY PRZEZ `wiersz.blocks`
 * ---------------------------------------------------------
 * To nie jest ostrożność, tylko jeden konkretny wiersz: `buddyzm/medytacja` ma
 * `body_md` długości 13 131 znaków przy `blocks = NULL`. Kod czytający
 * `wiersz.blocks` zapisałby dla niego pustą treść i nikt by tego nie zauważył
 * do czasu, aż `drop table` z etapu 8 zabierze źródło.
 *
 * `resolveArticleBlocks` (lib/articleContent.ts) robi to poprawnie i jest tą
 * SAMĄ funkcją, której używa dziś strona — więc wynik migracji jest z definicji
 * tym, co odwiedzający widzi teraz:
 *   1. `blocks` z nadpisania, jeśli niepuste,
 *   2. inaczej `body_md` przepuszczone przez parser markdownu,
 *   3. inaczej treść bazowa z `data/articles`.
 *
 * Kierunek konwersji jest wyłącznie `sections → blocks`. `blocksToSections`
 * NIE jest tu wołane i nie może być: zwija `callout` w `quote` i WYRZUCA
 * `gallery`, `table`, `links`, `video`, `download`, `person`, `bank`
 * i `kontakt` przez `default: break`.
 *
 * URUCHOMIENIE
 * ------------
 *   node scripts/migrate-tresc.mjs --na-sucho
 *   node scripts/migrate-tresc.mjs
 *
 * Idempotentny: drugi przebieg nadpisuje tą samą treścią. Adresy się nie
 * zmieniają — po przełączeniu na `source='db'` trigger liczy adres z łańcucha
 * slugów, a ten daje dokładnie `/{temat}/{slug}`, czyli to samo, co było
 * w kolumnie `route`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, zKodu } from "./wczytaj-ts.mjs";

const NA_SUCHO = process.argv.includes("--na-sucho");

function parseEnv(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = {};
for (const name of [".env", ".env.local"]) {
  try {
    Object.assign(env, parseEnv(readFileSync(join(ROOT, name), "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
for (const n of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (process.env[n]) env[n] = process.env[n];
}
for (const n of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[n]) {
    console.error(`ODMOWA: brak zmiennej ${n}.`);
    process.exit(1);
  }
}

// `resolveArticleBlocks` czyta bazę przez getSupabaseAdmin(), który bierze
// zmienne z process.env — podstawiamy je, zanim moduł zostanie wczytany.
process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
process.env.SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const URL_BAZY = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const NAGLOWKI = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function czytaj(sciezka) {
  const r = await fetch(`${URL_BAZY}/rest/v1/${sciezka}`, { headers: NAGLOWKI, signal: AbortSignal.timeout(30_000) });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`GET ${sciezka}: HTTP ${r.status} ${tekst.slice(0, 300)}`);
  return JSON.parse(tekst);
}

const { resolveArticleBlocks } = await zKodu("lib/articleContent.ts");
const GRUPY = [
  (await zKodu("data/articles/o-shorinji.ts")).o_shorinji,
  (await zKodu("data/articles/organizacja.ts")).organizacja,
  (await zKodu("data/articles/buddyzm.ts")).buddyzm,
];

console.log(`=== ETAP 7: treść podstron tematycznych${NA_SUCHO ? " (NA SUCHO)" : ""} ===`);
console.log(`Baza docelowa: ${URL_BAZY}\n`);

const wezly = await czytaj("pages?select=id,full_path,source,title,blocks&kind=eq.page&deleted_at=is.null");
const poAdresie = new Map(wezly.map((w) => [w.full_path, w]));

const raport = [];
const problemy = [];

for (const grupa of GRUPY) {
  for (const artykul of grupa.articles) {
    const adres = `/${grupa.topic}/${artykul.slug}`;
    const wezel = poAdresie.get(adres);
    if (!wezel) {
      problemy.push(`${adres} — brak węzła w drzewie. Uruchom najpierw scripts/migrate-pages.mjs.`);
      continue;
    }

    const rozwiazany = await resolveArticleBlocks(grupa.topic, artykul.slug, artykul);
    const bloki = rozwiazany.blocks ?? [];
    if (!bloki.length) {
      problemy.push(`${adres} — treść wyszła PUSTA. Nie zapisuję: pusta strona jest gorsza od starej.`);
      continue;
    }

    if (!NA_SUCHO) {
      // `route: null` jest wymogiem CHECK-a `pages_source_chk` (source='db'
      // wyklucza wypełnione `route`), a nie porządkowaniem.
      const r = await fetch(`${URL_BAZY}/rest/v1/pages?id=eq.${wezel.id}`, {
        method: "PATCH",
        headers: { ...NAGLOWKI, Prefer: "return=representation" },
        body: JSON.stringify({ blocks: bloki, source: "db", route: null, title: rozwiazany.title, intro: rozwiazany.intro }),
        signal: AbortSignal.timeout(30_000),
      });
      const tekst = await r.text();
      if (!r.ok) {
        problemy.push(`${adres} — zapis nieudany: HTTP ${r.status} ${tekst.slice(0, 200)}`);
        continue;
      }
      const [zapisany] = JSON.parse(tekst);
      if (zapisany.full_path !== adres) {
        problemy.push(
          `${adres} — po przełączeniu na source='db' adres zmienił się na ${zapisany.full_path}. ` +
            "To łamie zasadę „migracja nie zmienia adresu”.",
        );
        continue;
      }
    }

    raport.push({ adres, blokow: bloki.length, tytul: rozwiazany.title });
  }
}

console.log(`Podstron tematycznych: ${raport.length}`);
for (const r of raport) {
  console.log(`  ${String(r.blokow).padStart(3)} bloków  ${r.adres.padEnd(36)} ${r.tytul}`);
}

// ── Kontrole ─────────────────────────────────────────────────────────────────

console.log("\n=== KONTROLA ===");
let padly = 0;
const kontrola = (ok, opis) => {
  console.log(`  ${ok ? "OK   " : "BŁĄD "} ${opis}`);
  if (!ok) padly++;
};

kontrola(raport.length === 10, `dziesięć podstron tematycznych przeniesionych (jest ${raport.length})`);

// Wiersz, o który w tym etapie chodzi najbardziej.
const medytacja = raport.find((r) => r.adres === "/buddyzm/medytacja");
kontrola(
  Boolean(medytacja) && medytacja.blokow > 5,
  `/buddyzm/medytacja ma treść z body_md (${medytacja?.blokow ?? 0} bloków, nie zero)`,
);

if (!NA_SUCHO) {
  const poZapisie = await czytaj(
    "pages?select=full_path,source,route,blocks&kind=eq.page&source=eq.route&deleted_at=is.null",
  );
  const tematyczneNadalRoute = poZapisie.filter((w) => /^\/(o-shorinji|organizacja|buddyzm)\/[^/]+$/.test(w.full_path));
  kontrola(tematyczneNadalRoute.length === 0, `zero podstron tematycznych zostało na source='route'`);

  const puste = await czytaj("pages?select=full_path,blocks&kind=eq.page&source=eq.db&deleted_at=is.null");
  const bezTresci = puste.filter((w) => !Array.isArray(w.blocks) || w.blocks.length === 0).map((w) => w.full_path);
  kontrola(
    bezTresci.length === 0,
    `każda strona z bazy ma treść${bezTresci.length ? ` — puste: ${bezTresci.join(", ")}` : ""}`,
  );
}

if (problemy.length) {
  console.log(`\n— PROBLEMY (${problemy.length}) —`);
  for (const p of problemy) console.log("  " + p);
}

console.log(
  padly || problemy.length
    ? "\nWYNIK: BŁĄD — przeczytaj powyższe."
    : `\nWYNIK: OK${NA_SUCHO ? " (na sucho — nic nie zapisano)" : ""}`,
);
process.exitCode = padly || problemy.length ? 1 : 0;
