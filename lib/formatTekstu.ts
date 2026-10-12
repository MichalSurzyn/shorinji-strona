/**
 * Format tekstu w blokach „Tekst", „Lista", „Wyróżniona ramka" i „Cytat" — w JEDNYM miejscu.
 *
 * W bazie tekst leży ze znacznikami: `**pogrubienie**`, `*kursywa*`,
 * `==żółte wyróżnienie==`, `[tekst](adres)`, a Enter to `\n`. Od 2026-10 znaczniki
 * wolno zagnieżdżać (`***pogrubiona kursywa***`, `[**pogrubiony link**](/adres)`),
 * a link, który ma być żółty dopiero po najechaniu, zapisuje się jako
 * `[tekst](adres "bez-koloru")`. Czytają go dwie strony: `InlineText` na stronie
 * publicznej i edytor w panelu. Gdyby każda miała własny podział na kawałki,
 * edytor potrafiłby pokazać pogrubienie, którego strona nie narysuje — a cały
 * sens edytora „widzisz to, co wyjdzie" polega na tym, że to niemożliwe.
 *
 * MODEL: ZNAK Z FORMATEM
 * ----------------------
 * Edytor nie przestawia HTML-a. Tekst to tablica znaków, każdy z własnym
 * zestawem formatów, a pogrubienie zaznaczenia to ustawienie `b` na znakach
 * od–do. Dopiero zapis składa z tego znaczniki, w stałej kolejności zagnieżdżeń
 * (link > żółty > pogrubienie > kursywa). Dotychczasowe łatanie drzewa DOM
 * nie umiało dwóch formatów naraz, bo każde połączenie było osobnym przypadkiem.
 *
 * Link to OBIEKT, a znaki jednego linku dzielą tę samą referencję. Dwa linki
 * stojące obok siebie z tym samym adresem zostają dwoma linkami — porównanie po
 * wartości skleiłoby je przy pierwszym otwarciu w edytorze i zapaliło
 * „Niezapisane zmiany" bez żadnej edycji.
 *
 * ZGODNOŚĆ WSTECZ
 * ---------------
 * Stare, płaskie teksty parser czyta dokładnie tak jak dawny wzorzec
 * (sprawdzone na 2736 tekstach z produkcji, 2026-10-12): kursywa nie przechodzi
 * przez Enter, a dosłowna gwiazdka w pogrubieniu albo znak `=` w wyróżnieniu
 * unieważniają znacznik.
 *
 * Funkcje operujące na DOM wołamy wyłącznie w przeglądarce. Sam moduł nie
 * dotyka `document` przy imporcie, bo `InlineText` renderuje się na serwerze.
 */

export type Link = { adres: string; bezKoloru?: boolean };
export type Format = { b?: boolean; i?: boolean; z?: boolean; link?: Link };
export type Kawalek = Format & { tekst: string };
export type Znak = { c: string; f: Format };
export type Znacznik = "b" | "i" | "z";

const ZNACZNIK: Record<Znacznik, string> = { b: "**", i: "*", z: "==" };
/** Kolejność prób jak w dawnym wzorcu: pogrubienie przed kursywą, inaczej `**` czytałoby się jako dwie kursywy. */
const PROBY: Znacznik[] = ["b", "i", "z"];
const BEZ_KOLORU = "bez-koloru";
/**
 * Tekst linku bez `[` (dawny wzorzec dopuszczał): zapis i tak zdejmuje nawiasy z tekstu
 * linku, a dopuszczony `[` sprawiał, że dosłowny nawias stojący PRZED linkiem
 * („[uwaga: [link](/a)") wciągał się do niego przy następnym odczycie.
 * Żaden z 193 linków na produkcji (2026-10-12) nie ma `[` w tekście.
 */
const WZOR_LINKU = /\[([^[\]]+)\]\(([^)\s]+)( "bez-koloru")?\)/y;
/** Głębiej niż link > żółty > pogrubienie > kursywa nikt nie zagnieździ; limit chroni przed patologicznym tekstem. */
const MAKS_ZAGNIEZDZEN = 8;

/* ------------------------------ tekst → kawałki ------------------------------ */

/** Zmiana jednego znacznika — bez klucza liczonego z unii, którego TypeScript nie zawęża. */
function znacznik(typ: Znacznik, wartosc: boolean): Partial<Record<Znacznik, boolean>> {
  const zmiana: Partial<Record<Znacznik, boolean>> = {};
  zmiana[typ] = wartosc;
  return zmiana;
}

type Odczyt = { kawalki: Kawalek[]; koniec: number };

/**
 * Czyta od `od` do zamknięcia znacznika `typ` (albo do końca, gdy `typ` to `null`).
 * `null` w wyniku znaczy: tu nie ma poprawnego znacznika, otwarcie jest zwykłym tekstem.
 */
function czytaj(s: string, od: number, typ: Znacznik | null, f: Format, poziom: number): Odczyt | null {
  const zamkniecie = typ ? ZNACZNIK[typ] : null;
  const kawalki: Kawalek[] = [];
  let tekst = "";
  const odloz = () => {
    if (tekst) kawalki.push({ ...f, tekst });
    tekst = "";
  };

  let i = od;
  while (i < s.length) {
    // Zamknięcie bieżącego znacznika ma pierwszeństwo przed otwarciem nowego:
    // w `***x***` (pogrubiona kursywa) końcowe `***` to najpierw koniec kursywy.
    if (zamkniecie && s.startsWith(zamkniecie, i)) {
      if (i === od) return null;
      odloz();
      return { kawalki, koniec: i + zamkniecie.length };
    }
    const znak = s[i];
    if (f.i && znak === "\n") return null;

    const zagniezdzony = poziom < MAKS_ZAGNIEZDZEN ? otworz(s, i, f, poziom) : null;
    if (zagniezdzony) {
      odloz();
      kawalki.push(...zagniezdzony.kawalki);
      i = zagniezdzony.koniec;
      continue;
    }
    // Dawny wzorzec: `\*\*[^*]+\*\*`, `\*[^*\n]+\*` i `==[^=]+==`. Gwiazdka, która
    // nie otwiera kursywy, unieważnia pogrubienie — tak jak dotąd. Reguła patrzy
    // na WSZYSTKIE aktywne formaty, nie tylko na bieżący znacznik: zapis zdejmuje
    // pogrubienie i kursywę z każdego kawałka z gwiazdką (`bezpiecznyKawalek`),
    // więc parser dopuszczający `*` w wyróżnieniu wewnątrz kursywy czytałby inaczej,
    // niż zapis pisze — tekst przeskakiwałby między dwiema postaciami przy każdym zapisie.
    if (((f.b || f.i) && znak === "*") || (f.z && znak === "=")) return null;
    tekst += znak;
    i++;
  }
  if (zamkniecie) return null;
  odloz();
  return { kawalki, koniec: i };
}

function otworz(s: string, i: number, f: Format, poziom: number): Odczyt | null {
  for (const typ of PROBY) {
    const znak = ZNACZNIK[typ];
    if (f[typ] || !s.startsWith(znak, i)) continue;
    const odczyt = czytaj(s, i + znak.length, typ, zFormatem(f, znacznik(typ, true)), poziom + 1);
    if (odczyt) return odczyt;
  }
  if (!f.link && s[i] === "[") {
    WZOR_LINKU.lastIndex = i;
    const m = WZOR_LINKU.exec(s);
    if (m) {
      const link: Link = m[3] ? { adres: m[2], bezKoloru: true } : { adres: m[2] };
      // Tekst linku czytamy osobno: znacznik zaczęty w środku linku nie może
      // wyjść poza nawias kwadratowy.
      const odczyt = czytaj(m[1], 0, null, { ...f, link }, poziom + 1);
      if (odczyt) return { kawalki: odczyt.kawalki, koniec: i + m[0].length };
    }
  }
  return null;
}

/**
 * Tekst ze znacznikami → kawałki z formatem. Kawałki NIE są sklejane: dwa
 * pogrubienia obok siebie dają dwa `<strong>`, tak jak przez dawny wzorzec.
 */
export function rozbijTekst(text: string): Kawalek[] {
  return czytaj(text, 0, null, {}, 0)?.kawalki ?? [];
}

export function tekstNaZnaki(text: string): Znak[] {
  const znaki: Znak[] = [];
  for (const { tekst, ...f } of rozbijTekst(text)) {
    for (let k = 0; k < tekst.length; k++) znaki.push({ c: tekst[k], f });
  }
  return znaki;
}

/**
 * Enter na brzegach tekstu. Strona pokazuje Entery od 2026-10 (`whitespace-pre-line`),
 * a sześć bloków w bazie zaczyna się albo kończy Enterem — bez przycięcia
 * dostałyby pustą linię nad albo pod akapitem, której nikt nie wpisywał świadomie.
 */
export function przytnijEntery(text: string): string {
  return text.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
}

/* ------------------------------ znaki → tekst ------------------------------ */

function takiSamFormat(a: Format, b: Format): boolean {
  return !!a.b === !!b.b && !!a.i === !!b.i && !!a.z === !!b.z && a.link === b.link;
}

/** Sąsiednie znaki o tym samym formacie → kawałki. */
function naKawalki(znaki: Znak[]): Kawalek[] {
  const kawalki: Kawalek[] = [];
  for (const { c, f } of znaki) {
    const ostatni = kawalki[kawalki.length - 1];
    if (ostatni && takiSamFormat(ostatni, f)) ostatni.tekst += c;
    else kawalki.push({ ...f, tekst: c });
  }
  return kawalki;
}

function podzielNaLinie(znaki: Znak[]): Znak[][] {
  const linie: Znak[][] = [[]];
  for (const z of znaki) {
    if (z.c === "\n") linie.push([]);
    else linie[linie.length - 1].push(z);
  }
  return linie;
}

/**
 * Kawałek, którego strona nie przeczytałaby z powrotem tak samo, traci format
 * zamiast rozsypać się w gołe znaczki: gwiazdka w pogrubieniu albo kursywie
 * zamknęłaby znacznik za wcześnie, `=` w wyróżnieniu — tak samo. Nawias
 * kwadratowy w tekście linku przerwałby link.
 */
function bezpiecznyKawalek(k: Kawalek): Kawalek {
  const wynik: Kawalek = { ...k };
  if (wynik.link) wynik.tekst = wynik.tekst.replace(/[[\]]/g, "");
  if ((wynik.b || wynik.i) && wynik.tekst.includes("*")) {
    delete wynik.b;
    delete wynik.i;
  }
  if (wynik.z && (wynik.tekst.includes("=") || (wynik.link && !wynik.link.bezKoloru))) delete wynik.z;
  return wynik;
}

const POZIOMY = ["link", "z", "b", "i"] as const;

function zlozPoziom(kawalki: Kawalek[], poziom: number): string {
  if (poziom === POZIOMY.length) return kawalki.map((k) => k.tekst).join("");
  const cecha = POZIOMY[poziom];
  const wartosc = (k: Kawalek) => (cecha === "link" ? k.link : !!k[cecha]);

  let wynik = "";
  for (let i = 0; i < kawalki.length; ) {
    const w = wartosc(kawalki[i]);
    let j = i + 1;
    while (j < kawalki.length && wartosc(kawalki[j]) === w) j++;
    const srodek = zlozPoziom(kawalki.slice(i, j), poziom + 1);
    if (!w) wynik += srodek;
    else if (cecha === "link") {
      const link = w as Link;
      // Spacja w adresie albo nawias okrągły rozbiłyby wzorzec linku.
      const adres = link.adres.trim().replace(/ /g, "%20").replace(/\)/g, "%29");
      const dopisek = link.bezKoloru ? ` "${BEZ_KOLORU}"` : "";
      wynik += obejmij(srodek, (t) => `[${t}](${adres}${dopisek})`);
    } else {
      const znak = ZNACZNIK[cecha];
      wynik += obejmij(srodek, (t) => `${znak}${t}${znak}`);
    }
    i = j;
  }
  return wynik;
}

/**
 * Znaki → tekst ze znacznikami. Każda linia osobno: znacznik nigdy nie
 * przechodzi przez Enter — kursywa ze strony by go nie przeżyła, a w liście
 * każda linia to osobny punkt czytany niezależnie.
 */
export function zlozZnaki(znaki: Znak[]): string {
  return podzielNaLinie(znaki)
    .map((linia) => zlozPoziom(naKawalki(linia).map(bezpiecznyKawalek).filter((k) => k.tekst), 0))
    .join("\n");
}

/**
 * Spacje z brzegów wychodzą POZA znacznik: „pogrubione " z Worda dałoby
 * `**pogrubione **` — strona to zniesie, ale następna edycja już niekoniecznie.
 */
function obejmij(tekst: string, owin: (t: string) => string): string {
  const m = tekst.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || !m[2]) return tekst;
  return `${m[1]}${owin(m[2])}${m[3]}`;
}

/* --------------------------- operacje na zaznaczeniu --------------------------- */

/** Żółty NA STRONIE: link jest żółty, chyba że ma „bez koloru"; reszta — gdy ma `==`. */
export function jestZolty(f: Format): boolean {
  return f.link ? !f.link.bezKoloru : !!f.z;
}

type Cecha = Znacznik | "zolty";

function ma(f: Format, cecha: Cecha): boolean {
  return cecha === "zolty" ? jestZolty(f) : !!f[cecha];
}

function zFormatem(f: Format, zmiana: Partial<Record<Znacznik, boolean>> & { link?: Link | null }): Format {
  const wynik: Format = { ...f };
  for (const typ of PROBY) {
    if (zmiana[typ] === true) wynik[typ] = true;
    else if (zmiana[typ] === false) delete wynik[typ];
  }
  if (zmiana.link === null) delete wynik.link;
  else if (zmiana.link) wynik.link = zmiana.link;
  return wynik;
}

/** Znak, na którym stoi kursor: ten przed nim (jak w Wordzie), a na początku linii — ten za nim. */
function znakPrzyKursorze(znaki: Znak[], poz: number): Znak | null {
  const przed = znaki[poz - 1];
  if (przed && przed.c !== "\n") return przed;
  const za = znaki[poz];
  return za && za.c !== "\n" ? za : null;
}

/** Ciągły odcinek wokół kursora, którego znaki spełniają warunek — bez przechodzenia przez Enter. */
function odcinekWokol(znaki: Znak[], poz: number, warunek: (z: Znak) => boolean): [number, number] | null {
  let start: number;
  if (poz > 0 && znaki[poz - 1].c !== "\n" && warunek(znaki[poz - 1])) start = poz - 1;
  else if (poz < znaki.length && znaki[poz].c !== "\n" && warunek(znaki[poz])) start = poz;
  else return null;
  let a = start;
  let b = start + 1;
  while (a > 0 && znaki[a - 1].c !== "\n" && warunek(znaki[a - 1])) a--;
  while (b < znaki.length && znaki[b].c !== "\n" && warunek(znaki[b])) b++;
  return [a, b];
}

/** Stan przycisków paska dla zaznaczenia (albo samego kursora). */
export function formatyZaznaczenia(
  znaki: Znak[],
  od: number,
  doo: number,
): { b: boolean; i: boolean; zolty: boolean; link: Link | null } {
  if (od === doo) {
    const z = znakPrzyKursorze(znaki, od);
    return { b: !!z?.f.b, i: !!z?.f.i, zolty: z ? jestZolty(z.f) : false, link: z?.f.link ?? null };
  }
  const w = znaki.slice(od, doo).filter((z) => z.c !== "\n");
  if (!w.length) return { b: false, i: false, zolty: false, link: null };
  const link = w[0].f.link;
  return {
    b: w.every((z) => z.f.b),
    i: w.every((z) => z.f.i),
    zolty: w.every((z) => jestZolty(z.f)),
    link: link && w.every((z) => z.f.link === link) ? link : null,
  };
}

/**
 * B / I / Żółty jak na wstążce Worda: zaznaczenie, które w całości ma format,
 * traci go; w przeciwnym razie całe dostaje. Sam kursor w sformatowanym słowie
 * zdejmuje format z całego odcinka. `null` = nie ma czego zmienić.
 *
 * Żółty na linku przestawia CAŁY link (żółty od razu ↔ dopiero po najechaniu):
 * kolor jest cechą linku, a nie pojedynczych liter.
 */
export function przelaczFormat(znaki: Znak[], od: number, doo: number, cecha: Cecha): Znak[] | null {
  let a = od;
  let b = doo;
  let wlacz: boolean;
  if (od === doo) {
    const z = znakPrzyKursorze(znaki, od);
    if (cecha === "zolty" && z?.f.link) return zmienKolorLinku(znaki, [z.f.link], !jestZolty(z.f));
    // Żółty tekst obok żółtego linku: kursor zdejmuje kolor tylko z tekstu.
    // Link przestawia się wyłącznie wtedy, gdy kursor stoi w nim (wyżej).
    const odcinek = odcinekWokol(znaki, od, (x) => (cecha === "zolty" ? !x.f.link && !!x.f.z : ma(x.f, cecha)));
    if (!odcinek) return null;
    [a, b] = odcinek;
    wlacz = false;
  } else {
    const w = znaki.slice(od, doo).filter((z) => z.c !== "\n");
    if (!w.length) return null;
    wlacz = !w.every((z) => ma(z.f, cecha));
  }

  const linki = new Set<Link>();
  const wynik = znaki.map((z, k) => {
    if (k < a || k >= b || z.c === "\n") return z;
    if (cecha !== "zolty") return { c: z.c, f: zFormatem(z.f, znacznik(cecha, wlacz)) };
    if (z.f.link) {
      linki.add(z.f.link);
      return z;
    }
    return { c: z.c, f: zFormatem(z.f, { z: wlacz }) };
  });
  return linki.size ? zmienKolorLinku(wynik, [...linki], wlacz) : wynik;
}

function zmienKolorLinku(znaki: Znak[], linki: Link[], zolty: boolean): Znak[] {
  const nowe = new Map(linki.map((l) => [l, zolty ? { adres: l.adres } : { adres: l.adres, bezKoloru: true }]));
  return znaki.map((z) => {
    const nowy = z.f.link && nowe.get(z.f.link);
    return nowy ? { c: z.c, f: zFormatem(z.f, { link: nowy, z: false }) } : z;
  });
}

/** Odcinek jednego linku pod kursorem albo zaznaczeniem — `null`, gdy to nie link. */
export function odcinekLinku(znaki: Znak[], od: number, doo: number): { od: number; doo: number; link: Link } | null {
  const link = formatyZaznaczenia(znaki, od, doo).link;
  if (!link) return null;
  // Przy zaznaczeniu szukamy od pierwszego zaznaczonego znaku — ma ten link na pewno.
  const odcinek = odcinekWokol(znaki, od === doo ? od : od + 1, (z) => z.f.link === link);
  return odcinek ? { od: odcinek[0], doo: odcinek[1], link } : null;
}

export function ustawLink(znaki: Znak[], od: number, doo: number, link: Link | null): Znak[] {
  return znaki.map((z, k) =>
    k < od || k >= doo || z.c === "\n" ? z : { c: z.c, f: zFormatem(z.f, link ? { link, z: false } : { link: null }) },
  );
}

/** „Wyczyść": zaznaczenie traci wszystkie formaty; sam kursor — cały sformatowany odcinek wokół. */
export function wyczyscFormat(znaki: Znak[], od: number, doo: number): Znak[] | null {
  let a = od;
  let b = doo;
  if (od === doo) {
    const odcinek = odcinekWokol(znaki, od, (z) => !!(z.f.b || z.f.i || z.f.z || z.f.link));
    if (!odcinek) return null;
    [a, b] = odcinek;
  }
  return znaki.map((z, k) => (k < a || k >= b ? z : { c: z.c, f: {} }));
}

export function zamienZakres(znaki: Znak[], od: number, doo: number, nowe: Znak[]): Znak[] {
  return [...znaki.slice(0, od), ...nowe, ...znaki.slice(doo)];
}

export function tekstZakresu(znaki: Znak[], od: number, doo: number): string {
  return znaki
    .slice(od, doo)
    .map((z) => z.c)
    .join("");
}

/** Czy dwie tablice znaków wyglądają tak samo (link porównany po wartości, nie referencji). */
export function wygladajaTakSamo(a: Znak[], b: Znak[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((x, k) => {
    const y = b[k];
    return (
      x.c === y.c &&
      !!x.f.b === !!y.f.b &&
      !!x.f.i === !!y.f.i &&
      !!x.f.z === !!y.f.z &&
      x.f.link?.adres === y.f.link?.adres &&
      !!x.f.link?.bezKoloru === !!y.f.link?.bezKoloru
    );
  });
}

/* ------------------------------ znaki → HTML edytora ------------------------------ */

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Tekst bez znaczników do wstawienia w edytor — Enter jako `<br>`. */
function zwyklyNaHtml(s: string): string {
  return esc(s).replace(/\n/g, "<br>");
}

function kawalekNaHtml(k: Kawalek): string {
  let html = zwyklyNaHtml(k.tekst);
  if (k.i) html = `<em>${html}</em>`;
  if (k.b) html = `<strong>${html}</strong>`;
  if (k.z) html = `<mark>${html}</mark>`;
  return html;
}

/**
 * HTML dla edytora. Kończący Enter dostaje drugi `<br>`: przeglądarka nie
 * rysuje pustej linii po ostatnim `<br>`, więc bez niego kursor po Enterze na
 * końcu tekstu zostawałby w starej linii. `domNaZnaki` zdejmuje ten nadmiar.
 */
export function znakiNaHtml(znaki: Znak[]): string {
  const kawalki = naKawalki(znaki);
  let html = "";
  for (let i = 0; i < kawalki.length; ) {
    const link = kawalki[i].link;
    let j = i + 1;
    if (link) while (j < kawalki.length && kawalki[j].link === link) j++;
    const srodek = kawalki.slice(i, j).map(kawalekNaHtml).join("");
    html += link
      ? `<a href="${esc(link.adres)}" title="${esc(link.adres)}"${link.bezKoloru ? ' data-bez-koloru=""' : ""}>${srodek}</a>`
      : srodek;
    i = j;
  }
  return znaki.length && znaki[znaki.length - 1].c === "\n" ? `${html}<br>` : html;
}

/* ------------------------------ DOM → znaki ------------------------------- */

/**
 * Elementy, które zaczynają nową linię. Przeglądarka sama wstawia `<div>`
 * i `<p>` przy edycji, a wklejka z Worda składa się wyłącznie z nich.
 */
const BLOKOWE = new Set([
  "P", "DIV", "LI", "H1", "H2", "H3", "H4", "H5", "H6", "TR", "BLOCKQUOTE",
  "UL", "OL", "TABLE", "SECTION", "ARTICLE", "HEADER", "FOOTER", "PRE",
]);

/** Elementy, z których nic nie wolno przenieść do tekstu. */
const POMIJANE = new Set(["STYLE", "SCRIPT", "HEAD", "TITLE", "META", "LINK", "IMG", "SVG", "TEMPLATE"]);

/**
 * Jak element zmienia format tekstu w środku. `false` jest jawne: Google Docs
 * owija CAŁĄ wklejkę w `<b style="font-weight:normal">`, a Word potrafi
 * zdjąć pogrubienie spanem z `font-weight:normal` w środku pogrubionego akapitu.
 */
function formatElementu(el: Element): { b?: boolean; i?: boolean; z?: boolean; link?: Link } | null {
  const tag = el.tagName.toUpperCase();
  if (tag === "A") {
    const adres = el.getAttribute("href");
    // Word wstawia kotwice spisu treści `<a name="_Toc…">` bez adresu.
    if (!adres || adres.startsWith("#")) return null;
    return { link: el.hasAttribute("data-bez-koloru") ? { adres, bezKoloru: true } : { adres } };
  }
  const styl = (el as HTMLElement).style;
  const waga = styl?.fontWeight ?? "";
  const wynik: { b?: boolean; i?: boolean; z?: boolean } = {};
  if (tag === "STRONG" || tag === "B") wynik.b = true;
  if (tag === "EM" || tag === "I") wynik.i = true;
  if (tag === "MARK") wynik.z = true;
  if (waga === "bold" || waga === "bolder" || Number(waga) >= 600) wynik.b = true;
  if (waga === "normal" || waga === "lighter" || (waga !== "" && Number(waga) < 600)) wynik.b = false;
  if (styl?.fontStyle === "italic") wynik.i = true;
  if (styl?.fontStyle === "normal") wynik.i = false;
  return Object.keys(wynik).length ? wynik : null;
}

type Punkt = { wezel: Node; offset: number };

/**
 * Jedno przejście po drzewie: znaki (bez przycinania) i — opcjonalnie — numery
 * znaków odpowiadające punktom zaznaczenia. Liczenie pozycji tym samym
 * przejściem, którym zbieramy tekst, gwarantuje, że kursor i znaki się nie rozjadą.
 */
function przejdz(korzen: Node, zrodlo: "edytor" | "wklejka", punkty: Punkt[] = []): { znaki: Znak[]; pozycje: (number | null)[] } {
  const znaki: Znak[] = [];
  const pozycje: (number | null)[] = punkty.map(() => null);
  const oznacz = (wezel: Node, offset: number, ile: number) => {
    punkty.forEach((p, k) => {
      if (pozycje[k] === null && p.wezel === wezel && p.offset === offset) pozycje[k] = ile;
    });
  };
  const dopisz = (tekst: string, f: Format) => {
    for (let k = 0; k < tekst.length; k++) znaki.push({ c: tekst[k], f });
  };
  const nowaLinia = () => {
    if (znaki.length && znaki[znaki.length - 1].c !== "\n") znaki.push({ c: "\n", f: {} });
  };

  const idz = (wezel: Node, f: Format, korzenWezla: boolean) => {
    if (wezel.nodeType === 3) {
      let t = wezel.nodeValue ?? "";
      if (zrodlo === "wklejka") {
        t = t.replace(/[ \t\r\n]+/g, " ");
        // Odstęp z kodu źródłowego między `</p>` a `<p>` — nie jest tekstem.
        // Bez tego każdy akapit z Worda dostawał pustą linię pod spodem.
        if (t === " " && (!znaki.length || znaki[znaki.length - 1].c === "\n")) return;
      } else {
        punkty.forEach((p, k) => {
          if (pozycje[k] === null && p.wezel === wezel) pozycje[k] = znaki.length + Math.min(p.offset, t.length);
        });
      }
      dopisz(t, f);
      return;
    }
    if (wezel.nodeType !== 1 && wezel.nodeType !== 11) return; // komentarze Worda itp.

    const el = wezel as Element;
    const tag = wezel.nodeType === 1 ? el.tagName.toUpperCase() : "";
    if (POMIJANE.has(tag)) return;
    if (tag === "BR") {
      znaki.push({ c: "\n", f: {} });
      return;
    }
    // Numer albo kropka listy w Wordzie to zwykły tekst w `mso-list:Ignore`.
    // Kropka Worda to często znak z czcionki Symbol, czyli „·" albo „§" —
    // podmieniamy na jedną kropkę, którą da się przeczytać.
    if (tag && (el.getAttribute("style") ?? "").includes("mso-list:Ignore")) {
      const znak = (el.textContent ?? "").replace(/\s+/g, "").trim();
      dopisz(/^\d+[.)]$|^[a-z][.)]$/i.test(znak) ? `${znak} ` : "• ", {});
      return;
    }

    const blokowy = !korzenWezla && BLOKOWE.has(tag);
    if (blokowy) nowaLinia();
    let wlasny = f;
    const zmiana = tag ? formatElementu(el) : null;
    if (zmiana) {
      // Link w linku (wklejka z cudzej strony): zewnętrzny wygrywa.
      wlasny = zFormatem(f, f.link ? { ...zmiana, link: undefined } : zmiana);
    }
    wezel.childNodes.forEach((d, k) => {
      oznacz(wezel, k, znaki.length);
      idz(d, wlasny, false);
    });
    oznacz(wezel, wezel.childNodes.length, znaki.length);
    if (blokowy) nowaLinia();
  };

  idz(korzen, {}, true);
  return { znaki, pozycje };
}

/** Pusta linia z kodu źródłowego, spacje na brzegach linii, wielokrotne Entery. */
function oczyscWklejke(znaki: Znak[]): Znak[] {
  const wynik: Znak[] = [];
  podzielNaLinie(znaki).forEach((linia, n) => {
    let a = 0;
    let b = linia.length;
    // Spacja i twarda spacja — Word robi pusty akapit z `<o:p>&nbsp;</o:p>`.
    while (a < b && /[  ]/.test(linia[a].c)) a++;
    while (b > a && /[  ]/.test(linia[b - 1].c)) b--;
    if (n > 0) wynik.push({ c: "\n", f: {} });
    wynik.push(...linia.slice(a, b));
  });
  const zwiniete: Znak[] = [];
  let entery = 0;
  for (const z of wynik) {
    entery = z.c === "\n" ? entery + 1 : 0;
    if (entery <= 2) zwiniete.push(z);
  }
  let a = 0;
  let b = zwiniete.length;
  while (a < b && zwiniete[a].c === "\n") a++;
  while (b > a && zwiniete[b - 1].c === "\n") b--;
  return zwiniete.slice(a, b);
}

/**
 * Drzewo DOM → znaki z formatem.
 *
 * `"wklejka"` — HTML z Worda, Docs albo innej strony. Białe znaki w węzłach
 * tekstowych to tam formatowanie kodu źródłowego (Word łamie linie w środku
 * zdań), więc zwijamy je jak przeglądarka. W edytorze (`"edytor"`) pole ma
 * `white-space: pre-wrap` i każdy znak jest tym, co wpisał redaktor.
 */
export function domNaZnaki(korzen: Node, zrodlo: "edytor" | "wklejka" = "edytor"): Znak[] {
  const { znaki } = przejdz(korzen, zrodlo);
  if (zrodlo === "wklejka") return oczyscWklejke(znaki);
  // Nadmiarowy `<br>` ze `znakiNaHtml` (albo ten, który przeglądarka sama
  // trzyma na końcu pola) — patrz komentarz tam.
  return znaki.length && znaki[znaki.length - 1].c === "\n" ? znaki.slice(0, -1) : znaki;
}

/** Zaznaczenie w polu → numery znaków [od, do). */
export function offsetyZaznaczenia(pole: Node, r: Range): [number, number] {
  const { znaki, pozycje } = przejdz(pole, "edytor", [
    { wezel: r.startContainer, offset: r.startOffset },
    { wezel: r.endContainer, offset: r.endOffset },
  ]);
  const dlugosc = znaki.length && znaki[znaki.length - 1].c === "\n" ? znaki.length - 1 : znaki.length;
  const od = Math.min(pozycje[0] ?? dlugosc, dlugosc);
  const doo = Math.min(pozycje[1] ?? dlugosc, dlugosc);
  return od <= doo ? [od, doo] : [doo, od];
}

/** Numer znaku → punkt w DOM pola. Pole musi być świeżo wyrenderowane przez `znakiNaHtml`. */
export function punktDlaOffsetu(pole: Node, n: number): Punkt {
  let zostalo = n;
  let wynik: Punkt | null = null;
  const idz = (wezel: Node): boolean => {
    for (let k = 0; k < wezel.childNodes.length; k++) {
      const d = wezel.childNodes[k];
      if (d.nodeType === 3) {
        const dl = (d.nodeValue ?? "").length;
        if (zostalo <= dl) {
          wynik = { wezel: d, offset: zostalo };
          return true;
        }
        zostalo -= dl;
      } else if (d.nodeName === "BR") {
        if (zostalo === 0) {
          wynik = { wezel, offset: k };
          return true;
        }
        zostalo -= 1;
      } else if (d.nodeType === 1 && idz(d)) {
        return true;
      }
    }
    return false;
  };
  if (!idz(pole)) wynik = { wezel: pole, offset: pole.childNodes.length };
  return wynik as unknown as Punkt;
}

/**
 * Kropki i numery z początku linii wklejanych do listy. Lista dopisuje własne
 * (▸ albo 1., 2., 3.), więc „• punkt" z Worda dałby na stronie dwie kropki.
 */
export function bezKropekList(znaki: Znak[]): Znak[] {
  const wynik: Znak[] = [];
  for (const linia of podzielNaLinie(znaki)) {
    const tekst = linia.map((z) => z.c).join("");
    const m = tekst.match(/^\s*(?:[•·▪◦‣–-]|\d+[.)]|[a-z][.)])\s+/i);
    const reszta = linia.slice(m ? m[0].length : 0);
    if (!reszta.some((z) => z.c.trim())) continue; // pusty punkt nic nie znaczy
    if (wynik.length) wynik.push({ c: "\n", f: {} });
    wynik.push(...reszta);
  }
  return wynik;
}

/* ------------------------------ adres linku ------------------------------- */

/**
 * Adres wpisany przez redaktora → adres do zapisu, albo `null`, gdy się nie da.
 *
 * Przepuszczamy tylko adresy wewnętrzne, http(s), mail i telefon. Strona
 * wkleja adres prosto w `href`, więc `javascript:` byłby wykonywany po
 * kliknięciu (`gotchas-security.md`, punkt o `InlineText`).
 */
export function poprawAdres(wpisany: string): string | null {
  const a = wpisany.trim();
  if (!a) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(a)) return a;
  if (a.startsWith("/")) return a;
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(a)) return `mailto:${a}`;
  if (/^www\./i.test(a) || /^[\w-]+(\.[\w-]+)+(\/.*)?$/.test(a)) return `https://${a}`;
  if (/^[a-z]+:/i.test(a)) return null;
  return `/${a}`;
}
