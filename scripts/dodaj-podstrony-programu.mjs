/**
 * dodaj-podstrony-programu.mjs — osiem podstron „Programu nauczania".
 *
 * PO CO
 * -----
 * Uwagi klienta z 2026-09-07, punkt trzeci. Podał gotową listę i dopisał do niej
 * jedną pozycję („Teoria i filozofia"), więc lista końcowa ma osiem podstron.
 *
 * CZEGO TU NIE MA
 * ---------------
 * Klient napisał: „Dla każdej podstrony napisałem już krótki opis, więc nie
 * trzeba już nic wymyślać". W pliku z uwagami tych opisów NIE MA. Podstrony
 * powstają więc z PUSTYM wstępem — świadomie, bo wymyślony opis na stronie
 * klubu jest gorszy od pustego pola. Wstępy trzeba wkleić z tego drugiego
 * miejsca, w którym klient je trzyma.
 *
 * Skrypt jest IDEMPOTENTNY: podstronę o istniejącym slugu pomija, więc da się
 * go puścić drugi raz po dorzuceniu kolejnej pozycji do listy.
 *
 * URUCHOMIENIE (z katalogu shorinji-strona):
 *   node scripts/dodaj-podstrony-programu.mjs            → raport, ZERO zapisów
 *   node scripts/dodaj-podstrony-programu.mjs --zapisz   → dodaje brakujące
 *
 * Na poligonie: node Poligon/na-poligonie.mjs scripts/dodaj-podstrony-programu.mjs --zapisz
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ZAPISZ = process.argv.includes("--zapisz");

/** Kolejność jest kolejnością z uwag klienta — nie alfabetyczna. */
const PODSTRONY = [
  { title: "Stopnie i wymagania", slug: "stopnie-i-wymagania" },
  { title: "Podstawowe formy", slug: "podstawowe-formy" },
  { title: "Filozofia Kaiso", slug: "filozofia-kaiso" },
  { title: "Teoria i filozofia", slug: "teoria-i-filozofia" },
  { title: "Biblioteka", slug: "biblioteka" },
  { title: "Seminaria i szkolenia", slug: "seminaria-i-szkolenia" },
  { title: "Kursy specjalistyczne", slug: "kursy-specjalistyczne" },
  { title: "Trening z przyrządami", slug: "trening-z-przyrzadami" },
];

const ADRES_RODZICA = "/program-nauczania";

function parseEnv(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = {};
for (const nazwa of [".env", ".env.local"]) {
  try {
    Object.assign(env, parseEnv(readFileSync(join(ROOT, nazwa), "utf8")));
  } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}
// Zmienne środowiskowe mają pierwszeństwo — bez tego „uruchomienie na poligonie"
// po cichu pisałoby na produkcji, bo pliki .env* w repo wskazują produkcję.
for (const n of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (process.env[n]) env[n] = process.env[n];
  if (!env[n]) {
    console.error(`ODMOWA: brak zmiennej ${n}.`);
    process.exit(1);
  }
}

const URL_BAZY = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KLUCZ = env.SUPABASE_SERVICE_ROLE_KEY;
const H = { apikey: KLUCZ, Authorization: `Bearer ${KLUCZ}` };

console.log(`Baza: ${URL_BAZY}`);
console.log(ZAPISZ ? "Tryb: ZAPIS\n" : "Tryb: tylko raport (dodaj --zapisz, żeby wykonać)\n");

async function get(sciezka) {
  const r = await fetch(`${URL_BAZY}/rest/v1/${sciezka}`, { headers: H });
  if (!r.ok) throw new Error(`GET ${sciezka} → ${r.status} ${await r.text()}`);
  return r.json();
}

async function main() {
  const [rodzic] = await get(
    `pages?select=id,title,full_path&full_path=eq.${encodeURIComponent(ADRES_RODZICA)}&deleted_at=is.null`,
  );
  if (!rodzic) {
    console.error(`ODMOWA: nie ma węzła o adresie ${ADRES_RODZICA}.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Rodzic: „${rodzic.title}" (${rodzic.full_path})\n`);

  const istniejace = await get(
    `pages?select=id,slug,title,position&parent_id=eq.${rodzic.id}&deleted_at=is.null&order=position.asc`,
  );
  const mam = new Set(istniejace.map((w) => w.slug));
  console.log(`Podstron już jest: ${istniejace.length}`);
  istniejace.forEach((w) => console.log(`   ${w.position}. ${w.title} (${w.slug})`));

  const brakuje = PODSTRONY.filter((p) => !mam.has(p.slug));
  console.log(`\nDo dodania: ${brakuje.length}`);
  brakuje.forEach((p) => console.log(`   ${p.title}  →  ${ADRES_RODZICA}/${p.slug}`));

  if (!brakuje.length) {
    console.log("\nNic do zrobienia.");
    return;
  }
  if (!ZAPISZ) {
    console.log("\nNic nie zapisano. Powtórz z --zapisz, żeby wykonać.");
    return;
  }

  // Pozycje doklejamy na końcu, gęsto — ta sama reguła co w panelu
  // (`przenumeruj` w actions/pagesActions.ts).
  let pozycja = istniejace.length;
  let dodane = 0;
  for (const p of brakuje) {
    const wiersz = {
      parent_id: rodzic.id,
      kind: "page",
      source: "db",
      slug: p.slug,
      title: p.title,
      // Wstęp PUSTY — patrz nagłówek pliku. Opisy klienta nie były w uwagach.
      intro: null,
      blocks: [],
      in_menu: true,
      published: true,
      position: pozycja++,
    };
    const r = await fetch(`${URL_BAZY}/rest/v1/pages`, {
      method: "POST",
      headers: { ...H, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(wiersz),
    });
    if (!r.ok) {
      console.error(`  BŁĄD ${p.slug}: ${r.status} ${await r.text()}`);
      continue;
    }
    const [zapisany] = await r.json();
    console.log(`  dodane: ${zapisany.full_path}`);
    dodane++;
  }

  // ── Kontrola: czytamy bazę PONOWNIE ────────────────────────────────────────
  const po = await get(
    `pages?select=slug,title,full_path,position,published,in_menu&parent_id=eq.${rodzic.id}&deleted_at=is.null&order=position.asc`,
  );
  console.log(`\nDodanych: ${dodane}/${brakuje.length}. Podstron razem: ${po.length}`);
  po.forEach((w) =>
    console.log(
      `   ${String(w.position).padStart(2)}. ${w.title.padEnd(24)} ${w.full_path}` +
        `${w.published ? "" : "  UKRYTA"}${w.in_menu ? "" : "  POZA MENU"}`,
    ),
  );

  const brakujaceNadal = PODSTRONY.filter((p) => !po.some((w) => w.slug === p.slug));
  const bezAdresu = po.filter((w) => !w.full_path);
  const ok = !brakujaceNadal.length && !bezAdresu.length;
  if (brakujaceNadal.length) console.error(`\nNADAL BRAKUJE: ${brakujaceNadal.map((p) => p.slug).join(", ")}`);
  if (bezAdresu.length) console.error(`\nBEZ ADRESU: ${bezAdresu.map((w) => w.slug).join(", ")}`);
  console.log(`\nWYNIK: ${ok ? "OK" : "NIE OK"}`);
  console.log(
    "\nDO UZUPEŁNIENIA PRZEZ WŁAŚCICIELA: wstępy (krótkie opisy) ośmiu podstron.\n" +
      "Klient pisze, że je napisał, ale w pliku uwag ich nie ma — nie zostały wymyślone.",
  );
  if (!ok) process.exitCode = 1;
}

try {
  await main();
} catch (e) {
  console.error(`WYNIK: NIE OK — ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
}
