/**
 * nadaj-role-admin.mjs — nadaje istniejącym kontom rolę uprawniającą do panelu.
 *
 * PO CO
 * -----
 * Panel sprawdzał dotąd wyłącznie to, czy ktokolwiek jest zalogowany. Po
 * wprowadzeniu allowlisty (`app_metadata.rola = 'admin'`) konta założone
 * WCZEŚNIEJ nie mają tej roli i po wdrożeniu nie weszłyby do panelu — łącznie
 * z kontem właściciela. Ten skrypt jest tym jednorazowym krokiem, który trzeba
 * wykonać RAZEM z wdrożeniem, nie po nim.
 *
 * Dlaczego skryptem, a nie automatem „pierwsze zalogowane konto dostaje rolę":
 * taki automat jest tylną furtką o dokładnie tej samej sile co brak allowlisty —
 * wystarczy zdążyć przed właścicielem.
 *
 * URUCHOMIENIE
 * ------------
 *   node scripts/nadaj-role-admin.mjs                      ← tylko raport, nic nie zapisuje
 *   node scripts/nadaj-role-admin.mjs --wszystkim          ← nadaje rolę wszystkim istniejącym kontom
 *   node scripts/nadaj-role-admin.mjs --email a@b.pl
 *   node scripts/nadaj-role-admin.mjs --email a@b.pl --odbierz
 *
 * Domyślny przebieg NIC nie zapisuje. Zapis wymaga jawnej flagi, bo to jest
 * operacja nadająca władzę nad treścią całego serwisu.
 *
 * Rola siedzi w `app_metadata`, którego nie da się ustawić kluczem anon —
 * wyłącznie Admin API kluczem service-role. Gdyby siedziała w `user_metadata`,
 * każdy zalogowany nadałby ją sobie sam jednym `auth.updateUser()`.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROLA_ADMIN = "admin";

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

function loadEnv() {
  const merged = {};
  for (const name of [".env", ".env.local"]) {
    try {
      Object.assign(merged, parseEnv(readFileSync(join(ROOT, name), "utf8")));
    } catch (e) {
      if (e.code !== "ENOENT") throw e;
    }
  }
  // Środowisko procesu przed plikami — inaczej „uruchomienie na poligonie"
  // po cichu zmieniałoby uprawnienia na produkcji.
  for (const nazwa of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (process.env[nazwa]) merged[nazwa] = process.env[nazwa];
  }
  return merged;
}

const env = loadEnv();
for (const wymagana of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!env[wymagana]) {
    console.error(`ODMOWA: brak zmiennej ${wymagana}.`);
    process.exit(1);
  }
}

const WSZYSTKIM = process.argv.includes("--wszystkim");
const ODBIERZ = process.argv.includes("--odbierz");
const iEmail = process.argv.indexOf("--email");
const EMAIL = iEmail > -1 ? process.argv[iEmail + 1] : null;
const ZAPIS = WSZYSTKIM || Boolean(EMAIL);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/**
 * Cala reszta w funkcji, zeby konczyc `return`-em, a nie `process.exit()`.
 * Zmierzone: `process.exit()` przy otwartym uchwycie klienta Supabase wywala
 * Node na Windows asercja libuv "!(handle->flags & UV_HANDLE_CLOSING)",
 * a kodem wyjscia jest wtedy 127 z padu, nie ten, ktory ustawilismy -
 * czyli `&& echo OK` w powloce klamie. Ten sam wzorzec co w Poligon/sql.mjs.
 */
async function wykonaj() {
const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 });
if (error) {
  console.error(`ODMOWA: nie udało się pobrać listy kont — ${error.message}`);
  process.exitCode = 1;
  return;
}

const konta = data.users;
const maRole = (u) => u.app_metadata?.rola === ROLA_ADMIN;

console.log(`Baza: ${env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`Kont w Supabase Auth: ${konta.length}\n`);
for (const u of konta) {
  console.log(`  ${maRole(u) ? "MA DOSTĘP " : "bez roli  "} ${u.email ?? "(bez adresu)"}`);
}

if (!ZAPIS) {
  const bezRoli = konta.filter((u) => !maRole(u)).length;
  console.log(
    `\nTo był przebieg tylko-czytający. Bez roli: ${bezRoli} z ${konta.length}.\n` +
      (bezRoli
        ? "Żeby nadać rolę wszystkim istniejącym kontom: node scripts/nadaj-role-admin.mjs --wszystkim"
        : "Nie ma czego nadawać."),
  );
  return;
}

const doZmiany = EMAIL
  ? konta.filter((u) => (u.email ?? "").toLowerCase() === EMAIL.toLowerCase())
  : konta.filter((u) => !maRole(u));

if (EMAIL && !doZmiany.length) {
  console.error(`\nODMOWA: nie ma konta o adresie ${EMAIL}.`);
  process.exitCode = 1;
  return;
}

// Odebranie roli ostatniemu uprawnionemu kontu zamyka panel przed wszystkimi
// i nie zostawia nikogo, kto mógłby ją nadać z powrotem.
if (ODBIERZ) {
  const zostanie = konta.filter((u) => maRole(u) && !doZmiany.some((d) => d.id === u.id)).length;
  if (zostanie === 0) {
    console.error("\nODMOWA: po tej zmianie nie zostałoby ani jedno konto z dostępem do panelu.");
    process.exitCode = 1;
    return;
  }
}

console.log(`\n${ODBIERZ ? "Odbieram" : "Nadaję"} rolę — kont: ${doZmiany.length}`);
let bledy = 0;
for (const u of doZmiany) {
  const { error: e } = await sb.auth.admin.updateUserById(u.id, {
    app_metadata: { rola: ODBIERZ ? null : ROLA_ADMIN },
  });
  if (e) {
    bledy++;
    console.log(`  BŁĄD  ${u.email}: ${e.message}`);
  } else {
    console.log(`  OK    ${u.email}`);
  }
}

// Kontrola po zapisie: czytamy stan ponownie, zamiast wierzyć, że skoro
// nie było błędu, to się zapisało.
const { data: po, error: bladPo } = await sb.auth.admin.listUsers({ perPage: 200 });
if (bladPo) {
  console.error(`\nNie udało się zweryfikować wyniku: ${bladPo.message}`);
  process.exitCode = 1;
} else {
  const uprawnionych = po.users.filter(maRole).length;
  console.log(`\nKont z dostępem do panelu: ${uprawnionych} z ${po.users.length}.`);
  console.log(bledy ? "WYNIK: BŁĄD — patrz wyżej." : "WYNIK: OK");
  process.exitCode = bledy ? 1 : 0;
}
}

await wykonaj();
