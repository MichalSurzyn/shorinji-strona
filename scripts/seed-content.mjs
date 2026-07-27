/**
 * Seed treści do Supabase po przebudowie „wszystko w bazie" (2026-07-27).
 *
 * Zasady bezpieczeństwa:
 *  - NIE nadpisuje istniejących bloków ani wypełnionych pól nagłówka
 *    (title/lead/kicker ustawia tylko tam, gdzie są puste),
 *  - jedyny wyjątek: strona główna dostaje blok "video", jeśli go nie ma,
 *  - linki stopki dopisuje tylko po pozytywnej weryfikacji (HTTP < 400),
 *  - jest idempotentny - można uruchamiać wielokrotnie.
 *
 * Uruchomienie:  node scripts/seed-content.mjs
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

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

const env = parseEnv(readFileSync(join(ROOT, ".env.local"), "utf8"));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const H = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
};

async function getRow(key) {
  const r = await fetch(
    `${URL_}/rest/v1/site_settings?key=eq.${encodeURIComponent(key)}&select=key,value`,
    { headers: H }
  );
  const rows = await r.json();
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function upsertRow(key, value) {
  const r = await fetch(`${URL_}/rest/v1/site_settings?on_conflict=key`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates" },
    body: JSON.stringify([{ key, value, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(`${key}: HTTP ${r.status} ${await r.text()}`);
}

const P = (text) => ({ type: "paragraph", text });
const HH = (text) => ({ type: "heading", text });
const SH = (text) => ({ type: "subheading", text });

/* ------------------------- Dane nagłówków i stron ------------------------- */

const HEADERS = {
  home: {
    title: "Witamy w naszym Dōjō Shorinji Kempo",
    lead: null,
    kicker: null,
  },
  cennik: {
    title: "Cennik",
    // Wg uwag: bez "od 1 kwietnia 2026", bez "kategoria B" i bez zdania o PLN.
    lead: "Lista opłat obowiązująca do 31 marca 2030.",
    kicker: "Zajęcia · Opłaty",
  },
  "program-nauczania": {
    title: "Program nauczania",
    lead:
      "Nagrania, z których korzystamy podczas treningów – od pierwszych technik i przewrotów, przez formy wykonywane pojedynczo, po pracę w parach. Filmy pomagają utrwalić materiał między zajęciami, nie zastępują jednak treningu z instruktorem.",
    kicker: "Materiały szkoleniowe",
  },
  kontakt: {
    title: "Kontakt",
    lead:
      "Treningi odbywają się w Szkole Podstawowej nr 114 przy ul. Łąkowej 31 w Krakowie. Aby uczestniczyć w treningu należy wcześniej napisać lub zadzwonić.",
    kicker: "Napisz, zadzwoń",
  },
  "zajecia-dorosli": {
    title: "Grupa dorosła",
    lead:
      "Zajęcia dla młodzieży i dorosłych. Pełny program techniczny – od podstaw kihon, przez pracę w parach, formy embu, aż po randori.",
    kicker: "Zajęcia · Filia Kraków",
  },
  "zajecia-dzieci": {
    title: "Grupa dziecięca",
    lead:
      "Zajęcia dla dzieci i młodzieży w wieku 5–13 lat. Bezpieczne, zabawne i wymagające – początek przygody, która może trwać całe życie.",
    kicker: "Zajęcia · Filia Wawel",
  },
};

// Pełne bloki dla stron, które NIE mają jeszcze wpisu w bazie.
const NEW_PAGE_BLOCKS = {
  kontakt: [
    HH("Godziny treningów"),
    P("[Grupa dziecięca](/zajecia/dzieci) trenuje we wtorki i czwartki w godzinach 18:00–19:30."),
    P("[Grupa dorosła](/zajecia/dorosli) trenuje we wtorki i czwartki 19:30–21:30 oraz w niedziele 18:00–21:00."),
    P("Pełny plan tygodnia znajdziesz na podstronach obu grup."),
    HH("Dane kontaktowe"),
    P("**Telefon:** [+48 792 99 55 10](tel:+48792995510)"),
    P("**E-mail:** [pl.shorinjikempo@gmail.com](mailto:pl.shorinjikempo@gmail.com)"),
    P(
      "**Znajdź nas w sieci:** [Facebook](https://www.facebook.com/shorinjikempopolska) · [Instagram](https://www.instagram.com/shorinjikempopolska/) · [YouTube](https://www.youtube.com/@Dominik_Chowanski)"
    ),
  ],
  "zajecia-dorosli": [
    {
      type: "person",
      name: "Dominik Chowański",
      role: "Shibucho – mistrz kierujący filią",
      subtitle: "Egzaminator oraz Sędzia 2 kategorii",
      imageId: "Howanski-Hoi-1_p5hbws",
      facts: [
        { label: "Bukai (stopień techniczny)", value: "6 Dan" },
        { label: "Hokai (poziom duchowy)", value: "Daikenshi" },
        { label: "Rok urodzenia", value: "1974" },
        { label: "Kisei (numer kenshi)", value: "512" },
        { label: "Trenuje od", value: "1991 roku" },
      ],
      note: "==Lokalizacja:== ul. Łąkowa 31, Kraków · Szkoła Podstawowa nr 114. *Zapisy do grupy dorosłej są obecnie zamknięte.*",
    },
    HH("Zajęcia dla dorosłych"),
    P(
      "Zajęcia w filii ==Kraków== są przeznaczone dla młodzieży i dorosłych. To początek przygody młodego *kenshi* (ucznia szkoły Shorinji Kempo), która będzie mu towarzyszyć przez całe życie. Po okresie próbnym Mistrz kierujący filią kwalifikuje ucznia do szkoły Shorinji Kempo – każdy uczeń otrzymuje indywidualną legitymację wraz ze swoim numerem prosto z centrali *Hombu* w Japonii. Numer kenshi zostaje z uczniem przez całe życie – bez względu na to, gdzie jest na świecie, zawsze może trenować w każdym Dōjō."
    ),
    SH("Jak wyglądają treningi"),
    P(
      "Zajęcia składają się z ceremonii wstępnej wraz z medytacją oraz odczytaniem tekstów naszej szkoły, następnie przeprowadzona jest krótka rozgrzewka. Kolejnym etapem treningu jest praca indywidualna bez partnera nad podstawowymi ruchami i technikami (==kihon==). Następnie przechodzimy do pracy w parach – to, co przećwiczyliśmy indywidualnie, trenujemy z partnerem. Kładziemy duży nacisk na pracę w parach, ćwiczymy każdy z każdym."
    ),
    P(
      "Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające oraz korygujące postawę. Dodatkowo adepci ćwiczą formy pojedynczo i w parach. Kolejny element to ==embu== oraz ==randori==: embu to wyjątkowy układ technik wykonywany w parach z pełną szybkością i precyzją, a randori to realistyczna walka z wykorzystaniem wcześniej poznanych technik. Zajęcia prowadzą doświadczeni instruktorzy z wieloletnim stażem, finaliści mistrzostw Europy w Shorinji Kempo."
    ),
  ],
  "zajecia-dzieci": [
    {
      type: "person",
      name: "Krzysztof Kmiecik",
      role: "Shibucho – mistrz kierujący filią",
      subtitle: null,
      imageId:
        "20220918_112600_edited_edited_edited_edited_edited_edited_edited_edited_edited_edited_edited_idlhxz",
      facts: [
        { label: "Bukai (stopień techniczny)", value: "4 Dan" },
        { label: "Hokai (poziom duchowy)", value: "Seikenshi" },
        { label: "Rok urodzenia", value: "1981" },
        { label: "Kisei (numer kenshi)", value: "766" },
        { label: "Trenuje od", value: "2013 roku" },
      ],
      note: "==Lokalizacja:== ul. Łąkowa 31, Kraków · Szkoła Podstawowa nr 114 · ==Tel:== [792 99 55 10](tel:+48792995510) · ==E-mail:== [pl.shorinjikempo@gmail.com](mailto:pl.shorinjikempo@gmail.com)",
    },
    HH("Zajęcia dla dzieci"),
    P(
      "Zajęcia w filii ==Wawel== są przeznaczone dla dzieci i młodzieży w wieku ==5–13 lat==. To początek przygody młodego *kenshi* (ucznia szkoły Shorinji Kempo), która będzie mu towarzyszyć przez całe życie. Po okresie próbnym Mistrz kierujący filią kwalifikuje ucznia do szkoły Shorinji Kempo – każdy uczeń otrzymuje indywidualną legitymację wraz ze swoim numerem prosto z centrali *Hombu* w Japonii. To pierwsze, jakże ważne wydarzenie dla każdego kenshi! Numer kenshi zostaje z uczniem przez całe życie – bez względu na to, gdzie jest na świecie, zawsze może trenować w każdym Dōjō."
    ),
    SH("Jak wyglądają treningi"),
    P(
      "Zajęcia składają się z krótkiej ceremonii wstępnej, potem medytacji, następnie przeprowadzona jest krótka rozgrzewka. Kolejnym etapem jest praca indywidualna bez partnera nad podstawowymi ruchami i technikami (==kihon==), a następnie praca w parach – to, co przećwiczyliśmy indywidualnie, trenujemy z partnerem. Kładziemy duży nacisk na pracę w parach: ćwiczymy każdy z każdym."
    ),
    P(
      "Podczas zajęć wykonujemy ćwiczenia wzmacniające, rozciągające i korygujące dla prawidłowej postawy. Dodatkowo młodzi adepci ćwiczą formy pojedynczo i w parach. Zajęcia prowadzą bardzo doświadczeni instruktorzy z wieloletnim stażem, finaliści mistrzostw Europy w Shorinji Kempo."
    ),
  ],
};

const HOME_VIDEO = {
  type: "video",
  url: "https://www.youtube.com/watch?v=aXz0wXgKTTk",
  caption: null,
  aspect: "16:9",
};

// Kandydaci do stopki (stara podstrona „Linki") - wejdą tylko działające.
const FOOTER_LINK_CANDIDATES = [
  { label: "Światowa Organizacja Shorinji Kempo (WSKO)", href: "http://www.shorinjikempo.or.jp/wsko/" },
  { label: "Shorinji Kempo w Polsce (YouTube)", href: "https://www.youtube.com/channel/UCfuIH0CIQBqrHsDIUkQpH1A" },
  { label: "Kongo Zen Sohonzan Shorinji", href: "http://www.shorinjikempo.or.jp/religious/" },
  { label: "Shorinji Kempo Remmei", href: "http://www.shorinjikempo.or.jp/federation/" },
  { label: "Sklep „Ozaki”", href: "https://www.ozaki-sk.co.jp/top/index_e.html" },
  { label: "Sklep „Maekawa”", href: "https://maekawashouten.co.jp/en/html/user_data/products.php" },
  { label: "Sklep w Hombu", href: "https://www.shorinjikempo.or.jp/wsko/activity/product" },
  { label: "WSKO (YouTube)", href: "https://www.youtube.com/channel/UC-5Kk6qFxO7rIqX1rSNPCyA" },
  { label: "Shorinji Kempo Group (YouTube)", href: "https://www.youtube.com/channel/UC_0igNO-mH0yy4iWVOYFe8A" },
  { label: "Kongo Zen Sohonzan Shorinji (YouTube)", href: "https://www.youtube.com/channel/UCDOzU4wOIV9HLXHMA6ehTFQ" },
  { label: "Kenri Tankyu – Shorinji Kempo Online", href: "https://www.youtube.com/channel/UCfwWkGDClmQAvWizRyKzZ-g" },
  { label: "Ambasada Japonii w Polsce", href: "https://www.pl.emb-japan.go.jp/itprtop_pl/index.html" },
];

async function linkWorks(href) {
  try {
    const ctrl = AbortSignal.timeout(8000);
    let r = await fetch(href, { method: "HEAD", redirect: "follow", signal: ctrl });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(href, { method: "GET", redirect: "follow", signal: AbortSignal.timeout(8000) });
    }
    return r.status < 400;
  } catch {
    return false;
  }
}

/* --------------------------------- Seed --------------------------------- */

const changes = [];

// 1. Nagłówki i brakujące strony
for (const [slug, header] of Object.entries(HEADERS)) {
  const row = await getRow(`page:${slug}`);
  const prev = row?.value && typeof row.value === "object" ? row.value : null;

  if (!prev) {
    const blocks = NEW_PAGE_BLOCKS[slug];
    if (!blocks) {
      changes.push(`page:${slug} — POMINIĘTO (brak wpisu i brak danych seedowych)`);
      continue;
    }
    await upsertRow(`page:${slug}`, { ...header, blocks });
    changes.push(`page:${slug} — UTWORZONO (nagłówek + ${blocks.length} bloków)`);
    continue;
  }

  const next = { ...prev };
  const set = [];
  for (const field of ["title", "lead", "kicker"]) {
    const empty = !next[field] || String(next[field]).trim() === "";
    if (empty && header[field]) {
      next[field] = header[field];
      set.push(field);
    }
  }

  // Strona główna: dołóż film, jeśli w blokach nie ma żadnego video.
  if (slug === "home" && Array.isArray(next.blocks) && !next.blocks.some((b) => b?.type === "video")) {
    next.blocks = [...next.blocks, HOME_VIDEO];
    set.push("blocks+video");
  }

  if (set.length) {
    await upsertRow(`page:${slug}`, next);
    changes.push(`page:${slug} — uzupełniono: ${set.join(", ")}`);
  } else {
    changes.push(`page:${slug} — bez zmian (wszystko już ustawione)`);
  }
}

// 2. Stopka: linki (tylko działające) + ujednolicone nazwy dokumentów
{
  const row = await getRow("footer");
  const prev = row?.value && typeof row.value === "object" ? row.value : {};
  const next = { ...prev };
  const set = [];

  if (!Array.isArray(next.links) || next.links.length === 0) {
    const verified = [];
    for (const l of FOOTER_LINK_CANDIDATES) {
      const ok = await linkWorks(l.href);
      console.log(`  link ${ok ? "OK  " : "PADŁ"}: ${l.label}`);
      if (ok) verified.push(l);
    }
    next.links = verified;
    set.push(`links (${verified.length}/${FOOTER_LINK_CANDIDATES.length} działających)`);
  }

  // Ujednolicenie nazw dokumentów - tylko jeśli nadal mają stare domyślne etykiety.
  const RENAME = {
    "WSKO – Statutes (kiyaku)": "Statut WSKO (kiyaku)",
    "WSKO – Bylaws": "Regulamin WSKO (bylaws)",
    "WSKO – Regulations": "Przepisy WSKO (regulations)",
  };
  if (Array.isArray(next.documents)) {
    let renamed = 0;
    next.documents = next.documents.map((d) =>
      RENAME[d.label] ? (renamed++, { ...d, label: RENAME[d.label] }) : d
    );
    if (renamed) set.push(`documents (ujednolicono ${renamed} nazw)`);
  }

  if (set.length) {
    await upsertRow("footer", next);
    changes.push(`footer — uzupełniono: ${set.join("; ")}`);
  } else {
    changes.push("footer — bez zmian");
  }
}

console.log("\n=== PODSUMOWANIE SEEDA ===");
for (const c of changes) console.log("• " + c);
