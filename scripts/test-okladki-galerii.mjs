/**
 * Test okladek albumow galerii - pelny cykl na zywym serwerze deweloperskim.
 *
 * Sprawdza, ze wskazanie zdjecia jako okladki faktycznie przestawia je
 * na wierzch stosu w widoku albumow, i ze zdjecie wskazania przywraca
 * uklad domyslny. Stan bazy jest przywracany w finally.
 *
 * Uruchomienie: node scripts/test-okladki-galerii.mjs
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ADRES = process.env.TEST_URL ?? "http://localhost:3000/galeria";
const KLUCZ = "galeria:okladki";

// .env czytamy sami - skrypt biegnie poza Next, wiec nie ma jego ladowarki.
const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const sb = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Okladki albumow w kolejnosci wystepowania na stronie.
 *
 * CldImage generuje srcset, wiec ten sam public_id powtarza sie kilkanascie
 * razy pod rzad - zwijamy powtorzenia sasiadujace, zeby zostala kolejnosc
 * samych zdjec. Tytuly albumow rozdzielaja kafelki.
 */
async function pobierzUklad() {
  const res = await fetch(ADRES, { cache: "no-store" });
  if (!res.ok) throw new Error(`Strona zwrocila ${res.status}`);
  const html = await res.text();

  const albumy = [];
  // Kafelek konczy sie akapitem z nazwa albumu.
  for (const kawalek of html.split(/<p class="mt-4 font-bold/).slice(0, -1)) {
    const ids = [];
    for (const m of kawalek.matchAll(/res\.cloudinary\.com\/[^"?]*?\/([^/"?]+)(?:["?])/g)) {
      if (ids[ids.length - 1] !== m[1]) ids.push(m[1]);
    }
    albumy.push(ids);
  }
  const nazwy = [...html.matchAll(/<p class="mt-4 font-bold[^>]*>([^<]*)/g)].map((m) => m[1]);
  return nazwy.map((nazwa, i) => ({ nazwa, okladki: albumy[i] ?? [] }));
}

let trzebaPrzywrocic = false;
let poprzednia = null;

try {
  const { data: stan } = await sb
    .from("site_settings")
    .select("value")
    .eq("key", KLUCZ)
    .maybeSingle();
  poprzednia = stan?.value ?? null;

  const przed = await pobierzUklad();
  console.log("Albumy na stronie:");
  for (const a of przed) console.log(`  ${a.nazwa}: ${a.okladki.length} okladek`);

  // Bierzemy pierwszy PRAWDZIWY album z co najmniej dwoma zdjeciami.
  // "Wszystkie zdjecia" jest wirtualny i nie ma wlasnego folderu.
  const cel = przed.slice(1).find((a) => a.okladki.length >= 2);
  if (!cel) throw new Error("Brak albumu z dwoma zdjeciami - nie ma czego przestawic.");

  const sciezka = `Galeria/${cel.nazwa}`;
  const bylo = cel.okladki[0];
  const chcemy = cel.okladki[1];
  console.log(`\nAlbum testowy: ${cel.nazwa} (${sciezka})`);
  console.log(`  na wierzchu teraz : ${bylo}`);
  console.log(`  ustawiam okladke  : ${chcemy}`);

  const { error } = await sb.from("site_settings").upsert({
    key: KLUCZ,
    value: { ...(poprzednia ?? {}), [sciezka]: chcemy },
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  trzebaPrzywrocic = true;

  const po = await pobierzUklad();
  const celPo = po.find((a) => a.nazwa === cel.nazwa);
  const naWierzchu = celPo?.okladki[0];
  console.log(`  na wierzchu po    : ${naWierzchu}`);

  if (naWierzchu !== chcemy) {
    console.log("\nWYNIK: BLAD - wskazane zdjecie nie trafilo na wierzch.");
    process.exitCode = 1;
  } else if (bylo === chcemy) {
    console.log("\nWYNIK: NIEROZSTRZYGNIETY - oba zdjecia byly te same.");
    process.exitCode = 1;
  } else {
    console.log("\nWYNIK: OK - wskazane zdjecie jest na wierzchu stosu.");
  }

  // Kontrola przeciwna: bez wpisu wraca uklad domyslny. Bez tego test
  // przechodzilby takze wtedy, gdyby kod ignorowal ustawienie, a zdjecia
  // po prostu mialy taka kolejnosc.
  await sb.from("site_settings").delete().eq("key", KLUCZ);
  trzebaPrzywrocic = poprzednia !== null;
  const wrocone = (await pobierzUklad()).find((a) => a.nazwa === cel.nazwa)?.okladki[0];
  console.log(`Po skasowaniu wpisu na wierzchu: ${wrocone}`);
  if (wrocone !== bylo) {
    console.log("WYNIK KONTROLI: BLAD - uklad domyslny nie wrocil.");
    process.exitCode = 1;
  } else {
    console.log("WYNIK KONTROLI: OK - bez wpisu wraca najnowsze zdjecie.");
  }
} finally {
  if (trzebaPrzywrocic && poprzednia !== null) {
    await sb.from("site_settings").upsert({
      key: KLUCZ,
      value: poprzednia,
      updated_at: new Date().toISOString(),
    });
    console.log("\nPrzywrocono poprzedni stan ustawien.");
  } else {
    await sb.from("site_settings").delete().eq("key", KLUCZ);
    const { data } = await sb.from("site_settings").select("key").eq("key", KLUCZ).maybeSingle();
    console.log(`\nSprzatanie: wpis ${KLUCZ} ${data ? "NADAL ISTNIEJE (!)" : "usuniety"}.`);
  }
}
