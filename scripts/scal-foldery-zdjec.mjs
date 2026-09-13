/**
 * scal-foldery-zdjec.mjs — jednorazowe scalenie folderów zdjęć podstron.
 *
 * PO CO
 * -----
 * Klient (uwagi z 2026-09-07): w panelu, w strefie „Zdjęcia użyte na
 * podstronach", jest DZIESIĘĆ kafelków, a mają być SZEŚĆ — po jednym na sekcję
 * menu. Dosłownie: „nie ma potrzeby rozbudowywania tej galerii osobno dla każdej
 * podstrony w zakładce Buddyzm". Dziś w Cloudinary leży drzewo
 * `Strona/<temat>/<slug>`; ten skrypt zsypuje zdjęcia o poziom wyżej, do
 * `Strona/<temat>`, i kasuje opróżnione podfoldery.
 *
 * DLACZEGO TO BEZPIECZNE DLA TREŚCI
 * ---------------------------------
 * Konto Cloudinary jest WSPÓLNE z produkcją — nie ma osobnego dla poligonu.
 * Ruch jest jednak nieszkodliwy dla odwołań, bo cloud działa w trybie
 * *dynamic folders*: `public_id` NIE zawiera ścieżki folderu. Bloki treści
 * zapisują `publicId`, więc po przeniesieniu zdjęcia wskazują dokładnie to samo.
 * Zmienia się wyłącznie `asset_folder`, czyli to, w której szufladzie panelu
 * zdjęcie się pokazuje.
 *
 * BACKUP JEST OBOWIĄZKOWY. Przed pierwszym zapisem skrypt zrzuca do pliku
 * mapowanie `public_id -> asset_folder` dla WSZYSTKICH zdjęć oraz listę
 * folderów. Bez tego pliku nie ruszy — Cloudinary nie ma „cofnij", a odtworzenie
 * z pamięci nie jest odtworzeniem.
 *
 * URUCHOMIENIE (z katalogu shorinji-strona):
 *   node scripts/scal-foldery-zdjec.mjs              → raport, ZERO zapisów
 *   node scripts/scal-foldery-zdjec.mjs --zapisz     → wykonuje scalenie
 *
 * Kod wyjścia: 0 gdy czysto, 1 gdy kontrola końcowa czegoś nie dopięła.
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(ROOT, "package.json"));
const { v2: cloudinary } = require("cloudinary");

const ZAPISZ = process.argv.includes("--zapisz");

function parseEnv(txt) {
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
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
for (const n of ["NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]) {
  if (process.env[n]) env[n] = process.env[n];
  if (!env[n]) {
    console.error(`ODMOWA: brak zmiennej ${n}.`);
    process.exit(1);
  }
}

cloudinary.config({
  cloud_name: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

console.log(`Cloud: ${env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME}`);
console.log(ZAPISZ ? "Tryb: ZAPIS\n" : "Tryb: tylko raport (dodaj --zapisz, żeby wykonać)\n");

/** Wszystkie zdjęcia, stronicowane — 500 to sufit jednego wywołania. */
async function wszystkieZasoby() {
  const out = [];
  let cursor;
  do {
    const r = await cloudinary.api.resources({
      resource_type: "image",
      type: "upload",
      max_results: 500,
      direction: "desc",
      ...(cursor ? { next_cursor: cursor } : {}),
    });
    out.push(...(r.resources ?? []));
    cursor = r.next_cursor;
  } while (cursor);
  return out;
}

async function podfoldery(sciezka) {
  try {
    const { folders } = await cloudinary.api.sub_folders(sciezka);
    return folders ?? [];
  } catch {
    return [];
  }
}

async function main() {
  const zasoby = await wszystkieZasoby();
  const tematy = await podfoldery("Strona");
  console.log(`Zdjęć w cloudzie: ${zasoby.length}, tematów pod „Strona": ${tematy.length}\n`);

  // Plan: zdjęcie leżące w `Strona/<temat>/<cokolwiek>` idzie do `Strona/<temat>`.
  const doPrzeniesienia = [];
  for (const z of zasoby) {
    const f = z.asset_folder;
    if (!f || !f.startsWith("Strona/")) continue;
    const czesci = f.split("/");
    if (czesci.length <= 2) continue; // już na poziomie sekcji
    doPrzeniesienia.push({ publicId: z.public_id, z: f, na: `${czesci[0]}/${czesci[1]}` });
  }

  const podfolderyDoKasacji = [];
  for (const t of tematy) {
    for (const s of await podfoldery(t.path)) podfolderyDoKasacji.push(s.path);
  }

  console.log(`Zdjęć do przeniesienia: ${doPrzeniesienia.length}`);
  const wgCelu = new Map();
  for (const p of doPrzeniesienia) wgCelu.set(p.na, (wgCelu.get(p.na) ?? 0) + 1);
  for (const [na, ile] of [...wgCelu].sort()) console.log(`   → ${na}: ${ile}`);
  console.log(`\nPodfolderów do skasowania po przeniesieniu: ${podfolderyDoKasacji.length}`);
  podfolderyDoKasacji.forEach((p) => console.log(`   ${p}`));

  if (!ZAPISZ) {
    console.log("\nNic nie zapisano. Powtórz z --zapisz, żeby wykonać.");
    return;
  }

  // ── BACKUP przed pierwszym zapisem ─────────────────────────────────────────
  const stempel = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const katalog = join(ROOT, "..", "shorinji-notes", "cloudinary-backup");
  mkdirSync(katalog, { recursive: true });
  const plik = join(katalog, `foldery-${stempel}.json`);
  writeFileSync(
    plik,
    JSON.stringify(
      {
        kiedy: new Date().toISOString(),
        cloud: env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
        po_co: "Mapowanie public_id -> asset_folder PRZED scaleniem folderów podstron.",
        jak_cofnac:
          "Dla każdego wpisu: cloudinary.api.update(public_id, { asset_folder: <asset_folder> }). " +
          "public_id nie zawiera ścieżki (dynamic folders), więc cofnięcie jest odwracalne.",
        foldery: { Strona: tematy.map((t) => t.path), podfoldery: podfolderyDoKasacji },
        zasoby: zasoby.map((z) => ({ public_id: z.public_id, asset_folder: z.asset_folder ?? null })),
      },
      null,
      2,
    ),
    "utf8",
  );
  console.log(`\nBackup: ${plik} (${zasoby.length} zdjęć)`);

  // ── Przenoszenie ───────────────────────────────────────────────────────────
  let przeniesione = 0;
  const bledy = [];
  for (const p of doPrzeniesienia) {
    try {
      await cloudinary.api.update(p.publicId, { asset_folder: p.na });
      przeniesione++;
    } catch (e) {
      bledy.push(`${p.publicId}: ${e?.error?.message ?? e.message}`);
    }
  }
  console.log(`\nPrzeniesionych: ${przeniesione}/${doPrzeniesienia.length}`);
  bledy.forEach((b) => console.error(`  BŁĄD ${b}`));

  // ── Kasowanie opróżnionych podfolderów ─────────────────────────────────────
  // Dopiero teraz i tylko te, które są PUSTE — Cloudinary i tak odmówi
  // skasowania folderu z zawartością, ale wolimy nie polegać na odmowie.
  let skasowane = 0;
  for (const sciezka of podfolderyDoKasacji) {
    try {
      const r = await cloudinary.api.resources_by_asset_folder(sciezka, { max_results: 1 });
      if ((r.resources ?? []).length) {
        console.warn(`  POMINIĘTE (niepuste): ${sciezka}`);
        continue;
      }
      await cloudinary.api.delete_folder(sciezka);
      skasowane++;
    } catch (e) {
      console.warn(`  nie skasowano ${sciezka}: ${e?.error?.message ?? e.message}`);
    }
  }
  console.log(`Skasowanych podfolderów: ${skasowane}/${podfolderyDoKasacji.length}`);

  // ── Kontrola końcowa: pytamy cloud PONOWNIE ───────────────────────────────
  const poTematy = await podfoldery("Strona");
  let zostaloPodfolderow = 0;
  for (const t of poTematy) zostaloPodfolderow += (await podfoldery(t.path)).length;

  const poZasoby = await wszystkieZasoby();
  const glebokie = poZasoby.filter(
    (z) => z.asset_folder?.startsWith("Strona/") && z.asset_folder.split("/").length > 2,
  );

  console.log("\n── Kontrola ──");
  console.log(`  zdjęć razem: ${poZasoby.length} (przed: ${zasoby.length})`);
  console.log(`  zdjęć nadal głębiej niż sekcja: ${glebokie.length}`);
  console.log(`  podfolderów pod tematami: ${zostaloPodfolderow}`);
  console.log(`  sekcji pod „Strona": ${poTematy.map((t) => t.name).join(", ")}`);

  const ok =
    poZasoby.length === zasoby.length && glebokie.length === 0 && zostaloPodfolderow === 0 && !bledy.length;
  console.log(`\nWYNIK: ${ok ? "OK" : "NIE OK"}`);
  if (!ok) process.exitCode = 1;
}

try {
  await main();
} catch (e) {
  console.error(`WYNIK: NIE OK — ${e instanceof Error ? e.message : e}`);
  process.exitCode = 1;
}
