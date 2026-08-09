# Specyfikacja wdrożeniowa: zakładka „Dane organizacji"

Dokument opisuje jedno źródło prawdy dla danych podmiotu w serwisie Shorinji Kempo Kraków. Zakres obejmuje nowy klucz `site_settings.organization`, warstwę odczytu, przepięcie wszystkich zmapowanych konsumentów, migrację treści w bazie oraz edytor w panelu.

Trzy założenia, od których zależy reszta dokumentu:

1. Puste pole daje pustkę. Nigdzie nie wraca po cichu wartość zaszyta w kodzie. Wzorzec scalania pole po polu z `lib/footerData.ts:19-27` nie jest powielany.
2. Adresy są dwa i nigdy się nie mieszają. Sala treningowa mieszka pod `miejsceZajec`, siedziba stowarzyszenia pod `siedziba`. Żadne pole nie zasila obu grup konsumentów.
3. Samo dodanie zakładki nie zmienia na stronie ani jednej litery. Bez migracji wierszy `page:cennik`, `page:kontakt`, `page:zajecia-dzieci` i `page:zajecia-dorosli` redaktor zapisze dane i zobaczy stare wartości.

---

## 1. Kształt danych

Nowy plik `lib/organizationTypes.ts`. Wartość zapisywana do `site_settings` pod kluczem `organization` odpowiada dokładnie interfejsowi `OrganizationData`.

```ts
/**
 * Dane podmiotu – jedno źródło prawdy dla całego serwisu.
 * Zapis: site_settings.key = "organization", kolumna value (jsonb).
 * Edycja: panel → Dane organizacji (components/admin/OrganizationEditor.tsx).
 *
 * ZASADA: pusty string oznacza „redaktor tego nie podał" i konsument ma
 * pominąć element, a nie podstawić wartość z kodu. Jedyne dane trzymane
 * poza tym plikiem to ustawienia techniczne (patrz lib/siteTechnical.ts).
 */

/** Adres w rozbiciu wymaganym przez JSON-LD PostalAddress. */
export interface OrgAdres {
  /** Ulica razem z numerem, np. "ul. Łąkowa 31". */
  ulica: string;
  /** Wzorzec 00-000, np. "31-443". */
  kodPocztowy: string;
  /** Miejscowość, np. "Kraków". */
  miasto: string;
  /** Województwo – trafia wyłącznie do JSON-LD (addressRegion). */
  wojewodztwo: string;
  /** Dwuliterowy kod kraju wg ISO 3166-1, np. "PL". */
  kodKraju: string;
}

/** Miejsce, w którym odbywają się treningi. To NIE jest siedziba stowarzyszenia. */
export interface OrgMiejsceZajec {
  /** Pełna nazwa obiektu, np. "Szkoła Podstawowa nr 114 im. Arkadego Fiedlera". */
  nazwaPelna: string;
  /** Krótsza wersja do wąskiej kolumny stopki. Puste = używana nazwa pełna. */
  nazwaSkrocona: string;
  adres: OrgAdres;
  /**
   * Ręcznie wklejony link z map Google. Puste = mapa i przycisk „Wyznacz trasę"
   * budowane z adresu przez lib/organizationFormat.ts.
   */
  linkMapy: string;
}

/**
 * Filia klubu. Dziś obie trenują pod tym samym adresem, ale nazwa filii jest
 * daną tożsamościową (kicker stron zajęć, tytuły, JSON-LD alternateName),
 * a cennik ma pozycję „Ustanowienie nowej filii", więc lista jest otwarta.
 */
export interface OrgFilia {
  /** Stabilny identyfikator techniczny, np. "wawel". Nie zmieniać po zapisie. */
  id: string;
  /** Nazwa widoczna, np. "Wawel". */
  nazwa: string;
  /** Grupa prowadzona przez filię – wiąże filię ze stroną zajęć. */
  grupa: "dzieci" | "dorosli" | null;
  /** Adres własny, gdy filia trenuje gdzie indziej. null = adres główny. */
  wlasneMiejsce: OrgMiejsceZajec | null;
}

/** Logo i obraz podglądu. Wariant "plik" to zasób z repozytorium (public/). */
export type OrgObraz =
  | { rodzaj: "plik"; sciezka: string; szerokosc: number; wysokosc: number }
  | { rodzaj: "cloudinary"; publicId: string; szerokosc: number; wysokosc: number };

export interface OrgKontakt {
  /**
   * Numer w formacie E.164, zawsze z prefiksem kraju: "+48792995510".
   * Postać do wyświetlenia generuje formatTelefon(), nie ma osobnego pola.
   */
  telefon: string;
  /** Sposób prezentacji numeru na stronie. */
  telefonFormat: "z-prefiksem" | "bez-prefiksu";
  /** Główna skrzynka klubu. Pole wymagane (art. 5 ust. 2 ustawy o ŚUDE). */
  email: string;
}

export interface OrgNazwy {
  /** Krótka nazwa serwisu: tytuły kart, Open Graph, JSON-LD name, .ics. */
  serwis: string;
  /** Tytuł strony głównej, dziś inny niż nazwa serwisu (app/layout.tsx:14). */
  tytulDomyslny: string;
  /** Pełna nazwa z KRS, razem z cudzysłowami drukarskimi. */
  prawna: string;
  /** Skrót, np. "POSK". Używany w etykietach dokumentów i w treściach. */
  skrocona: string;
  /** Wersja po znaku © w stopce. Bez roku – rok dokleja Footer.tsx:143. */
  wStopce: string;
  /** JSON-LD alternateName. Puste = pole pomijane w danych strukturalnych. */
  dlaGoogle: string;
  /** Opis serwisu: meta description, Open Graph, Twitter, JSON-LD. */
  opis: string;
}

export interface OrgOrganizacjaNadrzedna {
  /** Np. "World Shorinji Kempo Organization (WSKO)". Puste = pomijane. */
  nazwa: string;
  /** Adres strony organizacji nadrzędnej. Puste = JSON-LD bez url. */
  url: string;
}

export interface OrgSocial {
  /** Pusty string ukrywa ikonę w stopce i wypada z JSON-LD sameAs. */
  facebook: string;
  instagram: string;
  youtube: string;
}

export interface OrgGrafika {
  logo: OrgObraz;
  /** Opis logo dla czytników ekranu. Puste = używana nazwa serwisu. */
  logoAlt: string;
  /** Obraz podglądu linku. null = w podglądzie użyte logo. */
  obrazUdostepniania: OrgObraz | null;
}

export interface OrgBank {
  /** Nazwa wpisywana w polu odbiorcy przelewu, maks. 70 znaków. */
  odbiorca: string;
  /**
   * IBAN znormalizowany: wielkie litery, bez spacji, ZAWSZE z kodem kraju,
   * np. "PL53114020040000350274971466". Postać do wyświetlenia generuje
   * formatIban() – zdejmuje "PL" i grupuje po cztery znaki.
   */
  iban: string;
  /** Np. "mBank". Puste = w ramce pokazany sam numer. */
  nazwaBanku: string;
  /** Kod SWIFT/BIC dla wpłat z zagranicy. Puste = wiersz się nie pokazuje. */
  swift: string;
  /** Zdanie o tytule przelewu. Obsługuje formatowanie inline (** == []()). */
  wzorTytulu: string;
}

export interface OrgSiedziba {
  adres: OrgAdres;
  /** true = listy przychodzą pod adres siedziby, pola poniżej są ignorowane. */
  korespondencjaTakaJakSiedziba: boolean;
  /** Adres do korespondencji. Wymagany, gdy flaga powyżej jest false. */
  korespondencja: OrgAdres;
  /** Adres z odpisu KRS, gdy różni się od siedziby. Puste = taki sam. */
  adresWpisanyDoKrs: string;
}

export type OrgFormaPrawna =
  | "stowarzyszenie-rejestrowe"
  | "stowarzyszenie-zwykle"
  | "fundacja"
  | "inna";

export interface OrgRejestr {
  formaPrawna: OrgFormaPrawna;
  /** 10 cyfr jako tekst – wiodące zera są istotne ("0000123456"). */
  krs: string;
  /** 10 cyfr, bez myślników, po kontroli sumy. */
  nip: string;
  /** 9 albo 14 cyfr, po kontroli sumy właściwej dla długości. */
  regon: string;
  sadRejestrowy: string;
  /** Data znormalizowana do RRRR-MM-DD. */
  dataWpisu: string;
  /** Status organizacji pożytku publicznego. true wymaga niepustego krs. */
  statusOpp: boolean;
  organNadzoru: string;
  /** Np. "Zarząd Stowarzyszenia". Odradzamy wpisywanie nazwiska. */
  reprezentacja: string;
}

export interface OrgRodo {
  /** Skrzynka do spraw danych osobowych. Puste = używany kontakt.email. */
  emailDaneOsobowe: string;
  iodWyznaczony: boolean;
  /** Wymagany, gdy iodWyznaczony === true. */
  emailIod: string;
  /** RRRR-MM-DD. Puste = data ostatniego zapisu polityki. */
  dataAktualizacjiPolityki: string;
}

export interface OrgSeo {
  /** JSON-LD sport, np. "Shorinji Kempo". */
  dyscyplina: string;
  /** JSON-LD priceRange, np. "$$". Puste = pole pomijane. */
  przedzialCenowy: string;
}

/**
 * Kopie treści nadpisanych przez migrację. Służą wyłącznie do wycofania
 * zmiany jednym UPDATE-em. Nie renderowane nigdzie, nieedytowalne w panelu.
 */
export interface OrgKopieMigracyjne {
  /** Oryginalny tekst callouta z page:cennik blocks[16]. */
  cennikCalloutOryginal?: string;
  /** Cały wiersz footer sprzed odchudzenia (JSON jako tekst). */
  footerPrzedMigracja?: string;
}

export interface OrganizationData {
  /** Wersja schematu. Podbijać przy każdej zmianie kształtu. */
  schemaVersion: 1;
  kontakt: OrgKontakt;
  miejsceZajec: OrgMiejsceZajec;
  filie: OrgFilia[];
  nazwy: OrgNazwy;
  organizacjaNadrzedna: OrgOrganizacjaNadrzedna;
  social: OrgSocial;
  grafika: OrgGrafika;
  bank: OrgBank;
  siedziba: OrgSiedziba;
  rejestr: OrgRejestr;
  rodo: OrgRodo;
  seo: OrgSeo;
  /** ISO 8601, ustawiane przez akcję zapisu. */
  zaktualizowano: string;
  /** E-mail konta, które zapisało. Ustawiane serwerowo z requireUser(). */
  zaktualizowalPrzez: string;
  _kopie?: OrgKopieMigracyjne;
}
```

W tym samym pliku szkielet pustych wartości, używany przez formularz i przez normalizację. Nie zawiera żadnych prawdziwych danych klubu.

```ts
export const PUSTY_ADRES: OrgAdres = {
  ulica: "", kodPocztowy: "", miasto: "", wojewodztwo: "", kodKraju: "PL",
};

export const PUSTA_ORGANIZACJA: OrganizationData = {
  schemaVersion: 1,
  kontakt: { telefon: "", telefonFormat: "z-prefiksem", email: "" },
  miejsceZajec: { nazwaPelna: "", nazwaSkrocona: "", adres: { ...PUSTY_ADRES }, linkMapy: "" },
  filie: [],
  nazwy: { serwis: "", tytulDomyslny: "", prawna: "", skrocona: "", wStopce: "", dlaGoogle: "", opis: "" },
  organizacjaNadrzedna: { nazwa: "", url: "" },
  social: { facebook: "", instagram: "", youtube: "" },
  grafika: {
    logo: { rodzaj: "plik", sciezka: "/SOEN.jpg", szerokosc: 1022, wysokosc: 202 },
    logoAlt: "",
    obrazUdostepniania: null,
  },
  bank: { odbiorca: "", iban: "", nazwaBanku: "", swift: "", wzorTytulu: "" },
  siedziba: {
    adres: { ...PUSTY_ADRES },
    korespondencjaTakaJakSiedziba: true,
    korespondencja: { ...PUSTY_ADRES },
    adresWpisanyDoKrs: "",
  },
  rejestr: {
    formaPrawna: "stowarzyszenie-rejestrowe",
    krs: "", nip: "", regon: "", sadRejestrowy: "", dataWpisu: "",
    statusOpp: false, organNadzoru: "", reprezentacja: "",
  },
  rodo: { emailDaneOsobowe: "", iodWyznaczony: false, emailIod: "", dataAktualizacjiPolityki: "" },
  seo: { dyscyplina: "", przedzialCenowy: "" },
  zaktualizowano: "",
  zaktualizowalPrzez: "",
};
```

Tabela zmian w bazie, potrzebna do wykrycia podmiany numeru konta. Do `supabase/setup.sql`:

```sql
create table if not exists organization_audit (
  id uuid primary key default gen_random_uuid(),
  changed_at timestamptz not null default now(),
  changed_by text not null,
  field_path text not null,      -- np. "bank.iban"
  old_value text,
  new_value text
);
create index if not exists organization_audit_changed_at_idx
  on organization_audit (changed_at desc);
```

Log wypełnia akcja zapisu, porównując stary i nowy obiekt polami. Wystarczy objąć nim ścieżki finansowe i rejestrowe: `bank.*`, `rejestr.*`, `siedziba.*`, `kontakt.telefon`, `kontakt.email`.

---

## 2. Wartości startowe

Wartości odczytane z dzisiejszego kodu i z produkcyjnej bazy. Reguła rozstrzygania rozjazdów: wygrywa baza, bo jest nowsza. Trzy decyzje, które podjąłem za klub, oznaczyłem komentarzem i trzeba je z nim potwierdzić.

Plik `scripts/migrate-organization.mjs` (uruchamiany raz, nie importowany przez aplikację):

```js
const WARTOSCI_STARTOWE = {
  schemaVersion: 1,

  kontakt: {
    telefon: "+48792995510",              // lib/site.ts:26, footer.contact.phone
    telefonFormat: "z-prefiksem",         // DECYZJA: wygrywa "+48 792 99 55 10"
    email: "pl.shorinjikempo@gmail.com",  // lib/site.ts:28
  },

  miejsceZajec: {
    // DECYZJA: wygrywa wersja pełna z lib/site.ts:19, stopka dostaje skrót
    nazwaPelna: "Szkoła Podstawowa nr 114 im. Arkadego Fiedlera",
    nazwaSkrocona: "Szkoła Podstawowa nr 114",   // footer.contact.addressLine2
    adres: {
      ulica: "ul. Łąkowa 31",
      kodPocztowy: "31-443",
      miasto: "Kraków",
      wojewodztwo: "małopolskie",
      kodKraju: "PL",
    },
    linkMapy: "",
  },

  filie: [
    { id: "wawel",  nazwa: "Wawel",  grupa: "dzieci",  wlasneMiejsce: null },
    { id: "krakow", nazwa: "Kraków", grupa: "dorosli", wlasneMiejsce: null },
  ],

  nazwy: {
    serwis: "Shorinji Kempo Kraków",                              // lib/site.ts:13
    tytulDomyslny: "Shorinji Kempo Kraków: japońska sztuka walki", // app/layout.tsx:14
    prawna: "Stowarzyszenie „Polska Organizacja Shorinji Kempo”",  // page:cennik blocks[16]
    skrocona: "POSK",                                             // data/articles/organizacja.ts:6
    wStopce: "POLSKA ORGANIZACJA SHORINJI KEMPO.",                // footer.copyright
    dlaGoogle: "Polska Organizacja Shorinji Kempo – filia Kraków", // StructuredData.tsx:65
    opis: "Krakowskie dōjō Shorinji Kempo. Japońska sztuka walki łącząca skuteczną samoobronę, rozwój duchowy i zdrowie. Zajęcia dla dzieci i dorosłych na Prądniku Czerwonym.",
  },

  organizacjaNadrzedna: {
    nazwa: "World Shorinji Kempo Organization (WSKO)",
    url: "",                              // DO UZUPEŁNIENIA przez klub
  },

  social: {
    facebook:  "https://www.facebook.com/shorinjikempopolska",
    instagram: "https://www.instagram.com/shorinjikempopolska/",
    youtube:   "https://www.youtube.com/@Dominik_Chowanski",
  },

  grafika: {
    logo: { rodzaj: "plik", sciezka: "/SOEN.jpg", szerokosc: 1022, wysokosc: 202 },
    logoAlt: "",
    obrazUdostepniania: { rodzaj: "plik", sciezka: "/og.png", szerokosc: 1200, wysokosc: 630 },
  },

  bank: {
    odbiorca: "Stowarzyszenie „Polska Organizacja Shorinji Kempo”",
    iban: "PL53114020040000350274971466",  // page:cennik blocks[16], 26 cyfr
    nazwaBanku: "mBank",
    swift: "",                             // DO UZUPEŁNIENIA, jeśli klub przyjmuje wpłaty z zagranicy
    // Wersja z bazy (blocks[17]), nowsza niż prefill w lib/editablePages.ts:123.
    // DO DECYZJI: „kwiecień 2026" starzeje się samo, warto zamienić na
    // „składka za bieżący miesiąc".
    wzorTytulu: "**Uwaga!** W tytule przelewu prosimy podać imię, nazwisko oraz cel wpłaty (np. składka – kwiecień 2026, egzamin 5 Kyu)",
  },

  siedziba: {
    adres: {
      ulica: "ul. Wysłouchów 33/5",
      kodPocztowy: "30-611",
      miasto: "Kraków",
      wojewodztwo: "małopolskie",
      kodKraju: "PL",
    },
    korespondencjaTakaJakSiedziba: true,
    korespondencja: { ulica: "", kodPocztowy: "", miasto: "", wojewodztwo: "", kodKraju: "PL" },
    adresWpisanyDoKrs: "",                 // DO UZUPEŁNIENIA – nie zakładać, że to Wysłouchów
  },

  rejestr: {
    formaPrawna: "stowarzyszenie-rejestrowe",
    krs: "",            // DO UZUPEŁNIENIA przez klub, odpis z KRS. Nie zgadywać.
    nip: "",            // DO UZUPEŁNIENIA przez klub
    regon: "",          // DO UZUPEŁNIENIA przez klub
    sadRejestrowy: "",  // DO UZUPEŁNIENIA
    dataWpisu: "",      // DO UZUPEŁNIENIA
    statusOpp: false,   // DO POTWIERDZENIA – „true" włącza sekcję 1,5% i obowiązek sprawozdań
    organNadzoru: "",   // DO UZUPEŁNIENIA, dla Krakowa zwykle Prezydent Miasta Krakowa
    reprezentacja: "",  // DO UZUPEŁNIENIA, np. „Zarząd Stowarzyszenia"
  },

  rodo: {
    emailDaneOsobowe: "",           // puste = używany kontakt.email
    iodWyznaczony: false,
    emailIod: "",
    dataAktualizacjiPolityki: "",
  },

  seo: {
    dyscyplina: "Shorinji Kempo",   // StructuredData.tsx:72
    przedzialCenowy: "$$",          // StructuredData.tsx:73
  },

  zaktualizowano: new Date().toISOString(),
  zaktualizowalPrzez: "migracja",
};
```

Trzy rozjazdy, które migracja utrwala i o których klub musi wiedzieć:

| Dana | Warianty dzisiaj | Co zapisuje migracja |
|---|---|---|
| Nazwa obiektu | „Szkoła Podstawowa nr 114 im. Arkadego Fiedlera" (kod) oraz „Szkoła Podstawowa nr 114" (stopka) | Pełna do mapy i JSON-LD, skrócona do stopki. Oba warianty zostają, ale w jednym miejscu |
| Telefon | „+48 792 99 55 10", „792 99 55 10", „+48 792 995 510" | Jedna postać kanoniczna i jeden przełącznik formatu. Trzeci wariant z projektu polityki znika |
| Nazwa podmiotu | pełna z cennika, wersalikami ze stopki, z dopiskiem „filia Kraków" z JSON-LD | Trzy osobne pola o jasnym przeznaczeniu, żadne nie zgaduje pozostałych |

Osobno do rozstrzygnięcia przez klub, poza zakresem migracji: sprzeczność „Sędzia 2 kategorii" (`page:zajecia-dorosli` blocks[0]) kontra „Sędzia 1 kategorii" (`article_overrides` organizacja/egzaminatorzy) oraz „Członkostwo w Światowej" kontra „w Polskiej" Organizacji Shorinji Kempo przy wpisowym 50 zł.

---

## 3. Warstwa odczytu

### `lib/organization.ts`

```ts
import { cache } from "react";
import { getSupabaseAdmin } from "./supabaseAdmin";
import { PUSTA_ORGANIZACJA, type OrganizationData } from "./organizationTypes";

export type OrgStatus = "baza" | "brak-wiersza" | "brak-konfiguracji" | "blad";

export interface OrganizationRead {
  status: OrgStatus;
  /** Dane wyłącznie ze statusem "baza". W pozostałych przypadkach null. */
  data: OrganizationData | null;
}

/**
 * Dane organizacji z site_settings (klucz "organization").
 *
 * Celowo NIE scala z żadnym obiektem domyślnym zawierającym prawdziwe dane.
 * Brak wiersza albo błąd bazy zwraca data === null, a konsumenci warunkują
 * render. Ukrycie braku pod wartością z kodu jest tym, co doprowadziło do
 * pięciu niezależnych kopii tego samego numeru telefonu.
 *
 * cache() deduplikuje odczyt w obrębie jednego renderu, więc wywołanie
 * w layoucie, w Footer i w StructuredData kosztuje jedno zapytanie.
 */
export const getOrganization = cache(async (): Promise<OrganizationRead> => {
  const sb = getSupabaseAdmin();
  if (!sb) return { status: "brak-konfiguracji", data: null };
  try {
    const { data, error } = await sb
      .from("site_settings")
      .select("value")
      .eq("key", "organization")
      .abortSignal(AbortSignal.timeout(6000))
      .maybeSingle();
    if (error) throw error;
    if (!data?.value || typeof data.value !== "object") {
      return { status: "brak-wiersza", data: null };
    }
    return { status: "baza", data: normalizuj(data.value) };
  } catch (e) {
    console.warn("[organization] getOrganization:", e);
    return { status: "blad", data: null };
  }
});

/** Skrót dla konsumentów, których nie interesuje powód braku danych. */
export async function getOrg(): Promise<OrganizationData | null> {
  return (await getOrganization()).data;
}
```

Funkcja `normalizuj(raw)` uzupełnia brakujące podobiekty szkieletem `PUSTA_ORGANIZACJA`, żeby starszy wiersz po podbiciu schematu nie wywracał renderu. Uzupełnia wyłącznie pustymi stringami, nigdy danymi klubu. Dodatkowo przycina białe znaki, wymusza wielkie litery w `bank.iban` i `bank.swift` oraz odrzuca wartości innego typu niż oczekiwany.

### Zachowanie przy braku bazy

Trzy klasy pól, trzy różne reakcje:

| Klasa | Pola | Zachowanie przy `data === null` |
|---|---|---|
| A – tożsamość techniczna | `SITE_URL`, ikona serwisu, znacznik UID kalendarza, e-mail awaryjny formularza | Nie dotyczy, te wartości nigdy nie idą z bazy |
| B – prezentacja | telefon, e-mail, adres sali, social, nazwy, logo | Element się nie renderuje. Wzorzec już istnieje w `components/Footer.tsx:36,47,58` |
| C – finanse i rejestry | `bank.iban`, `rejestr.krs`, `rejestr.nip` | Widoczny komunikat „Dane w trakcie aktualizacji". Nigdy stara wartość z kodu |

Nazwa serwisu w metadanych jest jedynym wyjątkiem w klasie B, w którym pustka szkodzi bardziej niż wartość zastępcza. `title.template` z pustą nazwą daje `"Cennik | "` na każdej podstronie. Rozwiązanie: gdy `data === null`, `generateMetadata` w `app/layout.tsx` nie ustawia `title.template` w ogóle, a `title.default` bierze z `lib/siteTechnical.ts` stałą `TYTUL_AWARYJNY = "Shorinji Kempo"`. Zaraz obok, w klasie A, zostaje wpis w README, że to wartość na wypadek awarii i nie jest edytowalna.

### Kontrola przed buildem

Serwis z pustą stopką i pustym JSON-LD jest gorszy niż nieudany deploy, bo nikt nie zgłosi braku, którego nie widać. Nowy skrypt `scripts/check-organization.mjs`, podpięty jako `prebuild` w `package.json`:

1. Łączy się z Supabase kluczem service-role.
2. Pobiera wiersz `organization`.
3. Przerywa build kodem wyjścia 1, gdy wiersza nie ma albo gdy puste jest którekolwiek z pól: `kontakt.telefon`, `kontakt.email`, `nazwy.serwis`, `nazwy.opis`, `miejsceZajec.adres.ulica`, `miejsceZajec.adres.miasto`.
4. Wypisuje ostrzeżenie bez przerywania builda, gdy puste są `rejestr.krs`, `rejestr.nip`, `bank.iban`.

Gdy w środowisku nie ma zmiennych Supabase, skrypt kończy się kodem 0 z ostrzeżeniem. Build lokalny bez bazy ma dalej działać.

### `lib/organizationFormat.ts`

Wszystkie wartości pochodne liczone funkcjami, nie stałymi modułowymi. To jest naprawa `FULL_ADDRESS`, `MAPS_EMBED_URL` i `MAPS_LINK_URL`, które dzisiaj zamarzają przy imporcie modułu.

```ts
export function formatTelefon(k: OrgKontakt): string   // "+48 792 99 55 10" albo "792 99 55 10"
export function telefonHref(k: OrgKontakt): string     // "tel:+48792995510"
export function pelnyAdres(m: OrgMiejsceZajec): string // "Nazwa, ul. …, 31-443 Kraków"
export function mapaEmbedUrl(m: OrgMiejsceZajec): string  // honoruje linkMapy, inaczej encodeURIComponent(pelnyAdres)
export function mapaLinkUrl(m: OrgMiejsceZajec): string
export function formatIban(iban: string): string       // "53 1140 2004 0000 3502 7497 1466"
export function miejsceDlaGrupy(org, grupa): OrgMiejsceZajec  // filia z wlasneMiejsce albo adres główny
export function listaSocial(s: OrgSocial): string[]     // tylko niepuste, do JSON-LD sameAs
```

`formatTelefon` przy formacie `bez-prefiksu` zdejmuje `+48` i grupuje jako `792 99 55 10`. Link `tel:` zawsze zostaje w E.164, niezależnie od wybranego formatu wyświetlania.

`formatIban` zdejmuje `PL` i dzieli pozostałe 26 znaków po cztery, co daje dokładnie dzisiejszy zapis w ramce cennika. Enkodowanie adresu w URL map zostaje przy `encodeURIComponent`, inaczej „Łąkowa" rozwali zapytanie.

### `lib/organizationTokens.ts`

Bez mechanizmu podstawień cała operacja jest jednorazowym sprzątnięciem. Redaktor pierwszą edycją akapitu wklei konkretny numer i zamrożenie wróci.

```ts
/** Znaczniki rozwijane w treściach stron przed renderem. */
const ZNACZNIKI = {
  "{{telefon}}":      (o) => formatTelefon(o.kontakt),
  "{{telefonLink}}":  (o) => o.kontakt.telefon,
  "{{email}}":        (o) => o.kontakt.email,
  "{{adresSali}}":    (o) => `${o.miejsceZajec.adres.ulica}, ${o.miejsceZajec.adres.miasto}`,
  "{{nazwaSali}}":    (o) => o.miejsceZajec.nazwaPelna,
  "{{adresSiedziby}}":(o) => `${o.siedziba.adres.ulica}, ${o.siedziba.adres.kodPocztowy} ${o.siedziba.adres.miasto}`,
  "{{nazwaPrawna}}":  (o) => o.nazwy.prawna,
  "{{numerKonta}}":   (o) => formatIban(o.bank.iban),
  "{{facebook}}":     (o) => o.social.facebook,
  "{{instagram}}":    (o) => o.social.instagram,
  "{{youtube}}":      (o) => o.social.youtube,
};

/** Rozwija znaczniki we wszystkich polach tekstowych bloków. */
export function rozwinZnaczniki(bloki: NewsBlock[], org: OrganizationData | null): NewsBlock[]
```

Gdy `org === null`, funkcja zwraca bloki bez zmian, a nierozwinięte znaczniki są usuwane razem z otaczającym je fragmentem tekstu do najbliższego separatora `·`. Prościej i bezpieczniej: przy `org === null` zamieniamy znacznik na pusty string. Redaktor zobaczy zdanie z luką, a nie surowy `{{telefon}}` na produkcji.

Panel musi pokazywać listę dostępnych znaczników w edytorze bloków, inaczej nikt ich nie użyje.

---

## 4. Lista zmian plik po pliku

Legenda ryzyka: **[R1]** zmiana bezpieczna, **[R2]** zmiana wymagająca weryfikacji na podglądzie, **[R3]** zmiana, która przy błędzie kładzie cały serwis albo kasuje dane.

### Pliki nowe

| Plik | Zawartość |
|---|---|
| `lib/organizationTypes.ts` | Interfejsy z sekcji 1 oraz `PUSTA_ORGANIZACJA` |
| `lib/organization.ts` | `getOrganization()`, `getOrg()`, `normalizuj()` |
| `lib/organizationFormat.ts` | Funkcje pochodne, w tym następcy `FULL_ADDRESS` i `MAPS_*` |
| `lib/organizationValidation.ts` | Walidatory wspólne dla klienta i serwera, w tym IBAN mod 97, NIP, REGON |
| `lib/organizationTokens.ts` | Rozwijanie znaczników w treściach |
| `lib/siteTechnical.ts` | Stałe klasy A: `TYTUL_AWARYJNY`, `EMAIL_AWARYJNY`, `UID_DOMENA_KALENDARZA`, `NAZWA_PLIKU_ICS` |
| `actions/organizationActions.ts` | `saveOrganization()` z walidacją serwerową, logiem zmian i rewalidacją |
| `app/admin/(panel)/dane-organizacji/page.tsx` | Strona zakładki |
| `components/admin/OrganizationEditor.tsx` | Formularz |
| `scripts/migrate-organization.mjs` | Zasilenie klucza `organization` |
| `scripts/migrate-content-tokens.mjs` | Przepisanie treści stron na znaczniki i blok bankowy |
| `scripts/check-organization.mjs` | Kontrola przed buildem |

### `lib/site.ts` **[R3]**

Zostaje wyłącznie `SITE_URL`, dodatkowo utwardzony. Literówka w zmiennej środowiskowej nie może zabijać builda przez `new URL()` w `metadataBase`.

```ts
function bezpiecznyUrl(kandydat: string | undefined, awaryjny: string): string {
  const v = kandydat?.replace(/\/$/, "").trim();
  if (!v) return awaryjny;
  try { new URL(v); return v; } catch {
    console.error(`[site] NEXT_PUBLIC_SITE_URL="${v}" nie jest adresem URL, używam ${awaryjny}`);
    return awaryjny;
  }
}
export const SITE_URL = bezpiecznyUrl(
  process.env.NEXT_PUBLIC_SITE_URL,
  "https://shorinji-kempo.netlify.app",
);
```

Do usunięcia w ostatnim commicie: `SITE_NAME`, `SITE_DESCRIPTION`, `CONTACT`, `FULL_ADDRESS`, `SOCIAL_LINKS`, `MAPS_EMBED_URL`, `MAPS_LINK_URL`. Do czasu usunięcia zostawić z komentarzem `@deprecated`, żeby nowy kod ich nie importował.

### `app/layout.tsx` **[R3]**

Najbardziej ryzykowny plik całej zmiany. Błąd tutaj psuje każdą trasę, łącznie z `/admin`, więc redaktor nie ma jak wycofać zmiany z panelu.

1. Usunąć `export const metadata` w całości. Next nie pozwala eksportować `metadata` i `generateMetadata` z jednego segmentu.
2. Dodać `export async function generateMetadata(): Promise<Metadata>`, wewnątrz `const org = await getOrg()`.
3. `metadataBase: new URL(SITE_URL)` zostaje bez zmian, poza `try/catch` już załatwionym w `lib/site.ts`.
4. `title.default` z `org?.nazwy.tytulDomyslny`, przy braku danych z `TYTUL_AWARYJNY`.
5. `title.template` ustawiać wyłącznie, gdy `org?.nazwy.serwis` jest niepuste. Wtedy `` `%s | ${org.nazwy.serwis}` ``.
6. `description`, `applicationName`, `openGraph.siteName`, `openGraph.title`, `openGraph.description`, `twitter.title`, `twitter.description` z `org`.
7. `keywords` przebudować: stała lista rdzeni („Shorinji Kempo", „Kongo Zen", „sztuki walki", „samoobrona", „dōjō", „zajęcia dla dzieci") plus miasto z `org.miejsceZajec.adres.miasto` doklejane do czterech z nich. Dzisiejsze literały z linii 26 do 30 znikają.
8. `openGraph.images` i `twitter.images` z `org.grafika.obrazUdostepniania`. Dla wariantu `plik` adres to `sciezka`, dla `cloudinary` pełny URL z `clUrl()`. Gdy pole jest `null`, użyć logo. `alt` z `org.nazwy.serwis`.
9. W `RootLayout` dołożyć odczyt do istniejącego `Promise.all` z linii 69: `Promise.all([getNavTree(), getSchedule(), getOrganization()])`. Osobny `await` przed nimi dodałby opóźnienie do każdej podstrony.
10. Przekazać dane w dół: `<StructuredData slots={scheduleSlots} org={org} />`, `<Navbar links={navLinks} org={org} />`, `<Footer org={org} />`.

Weryfikacja po zmianie: jeden `next build` i sprawdzenie, czy tytuł podstrony `/cennik` ma sufiks. Teza, że `title.template` wymaga przepisania jedenastu podstron, jest nieprawdziwa. `generateMetadata` działa w layoutach, a `template` propaguje się do dzieci tak samo jak w statycznym obiekcie. Zakres to cztery pliki, nie trzynaście.

### `components/Footer.tsx` **[R2]**

Przyjmuje `org: OrganizationData | null` propsem, dalej czyta `getFooterData()` po listy linków, plików i dokumentów.

| Linia dzisiaj | Zmiana |
|---|---|
| 36, 47, 58 | `data.social.*` → `org?.social.*` |
| 111 | `data.contact.addressLine1` → `` `${org.miejsceZajec.adres.ulica}, ${org.miejsceZajec.adres.miasto}` ``, cała pozycja pod warunkiem `org` |
| 115 | `data.contact.addressLine2` → `org.miejsceZajec.nazwaSkrocona || org.miejsceZajec.nazwaPelna` |
| 119-123 | `phoneDisplay` → `formatTelefon(org.kontakt)`, `href` → `telefonHref(org.kontakt)` |
| 126-133 | `data.contact.email` → `org.kontakt.email` |
| 143 | `data.copyright` → `org?.nazwy.wStopce ?? ""` |

Cała kolumna „Kontakt" opakowana warunkiem `{org && (...)}`. Pusta kolumna jest lepsza niż kolumna z numerem sprzed trzech lat.

Osobno, do rozważenia razem z klubem: dołożyć w stopce czwartą pozycję z pełną nazwą prawną i adresem siedziby. Bez tego art. 5 ust. 2 ustawy o świadczeniu usług drogą elektroniczną dalej nie jest spełniony, bo dane podmiotu są dostępne wyłącznie w środku ramki o koncie bankowym na cenniku.

### `lib/footerTypes.ts` **[R3]**

Usunąć z `FooterData` pola `about`, `social`, `contact`, `copyright` oraz odpowiadające im gałęzie `DEFAULT_FOOTER` (linie 25-31 i 45-52). Zostają `links`, `downloads`, `documents`.

Ryzyko polega na kolejności. Usunięcie kodu przed migracją danych daje pustą stopkę na kilka minut, co widać i co da się cofnąć. Migracja przed usunięciem kodu sprawia, że `lib/footerData.ts:25` odtworzy `contact` z `DEFAULT_FOOTER` i stopka pokaże stary telefon jako aktualny. Tego nikt nie zauważy.

### `lib/footerData.ts` **[R2]**

Usunąć linie 20, 21, 25 i 26 ze scalania. Reszta bez zmian. Fallback list do `DEFAULT_FOOTER` zostaje, bo listy plików są danymi technicznymi i pusta stopka bez linku do statutu jest gorsza niż lista z kodu.

### `actions/footerActions.ts` **[R3]**

`saveFooter` bez zmian poza typem. `resetFooter` (linie 25-35) przestaje kasować wiersz. Zamiast `delete` robi `upsert` z samymi listami z `DEFAULT_FOOTER`, więc nie ma jak przywrócić starego telefonu ani starego numeru konta jednym kliknięciem. Tekst potwierdzenia w `components/admin/FooterEditor.tsx:84` zmienić na „Przywrócić bazową listę linków, plików i dokumentów? Dane kontaktowe nie zostaną ruszone."

### `components/admin/FooterEditor.tsx` **[R1]**

Usunąć sekcję Social media (linie 117-136), całą sekcję Kontakt (152-215) i pole copyright (217-224). W miejscu usuniętych sekcji wstawić notkę z odnośnikiem: „Telefon, e-mail, adres i nazwa w stopce przeniosły się do zakładki Dane organizacji." Poprawić podpowiedź kolumny linków w linii 112.

Zostawienie dwóch formularzy na tę samą daną jest gorsze niż stan dzisiejszy.

### `components/StructuredData.tsx` **[R2]**

Komponent przestaje importować cokolwiek z `lib/site` poza `SITE_URL`. Przyjmuje `org` propsem, tak jak dziś przyjmuje `slots`.

| Pole JSON-LD | Zmiana |
|---|---|
| `@id` (63) | Bez zmian, `${SITE_URL}/#dojo`. To identyfikator encji i musi być stabilny |
| `name` (64) | `org.nazwy.serwis` |
| `alternateName` (65) | `org.nazwy.dlaGoogle`, pole pomijane gdy puste |
| `description` (66) | `org.nazwy.opis` |
| `url` (67) | Bez zmian |
| `telephone` (68) | `org.kontakt.telefon` |
| `email` (69) | `org.kontakt.email` |
| `logo`, `image` (70-71) | Z `org.grafika.logo`. Dla wariantu `plik` dalej `${SITE_URL}${sciezka}`, dla `cloudinary` adres bezwzględny |
| `sport` (72) | `org.seo.dyscyplina`, pomijane gdy puste |
| `priceRange` (73) | `org.seo.przedzialCenowy`, pomijane gdy puste |
| `address` (74-81) | Wszystkie pięć pól z `org.miejsceZajec.adres` |
| `areaServed` (82) | `org.miejsceZajec.adres.miasto` zamiast literału „Kraków" |
| `sameAs` (83-87) | `listaSocial(org.social)`, klucz pomijany gdy tablica pusta |
| nowe `parentOrganization` | Z `org.organizacjaNadrzedna`, gdy nazwa niepusta |

Cały komponent zwraca `null`, gdy `org === null`. Pusty JSON-LD nie jest wart wysyłania.

Budowanie obiektu przez `Object.fromEntries(Object.entries(data).filter(([, v]) => v !== "" && v != null))` załatwia pomijanie pustych naraz.

### `components/LocationMap.tsx` **[R2]**

Dziś komponent jest synchroniczny i importuje wprost z `lib/site`. Zamiast robić go `async`, dokładamy props, bo wszystkie trzy strony, które go używają, są komponentami serwerowymi i i tak muszą pobrać dane.

```ts
type Props = {
  heading?: string;
  showContact?: boolean;
  className?: string;
  miejsce: OrgMiejsceZajec;
  kontakt: OrgKontakt | null;   // null ukrywa blok telefonu i e-maila
};
```

Zmiany: linia 37 `title` z `miejsce.nazwaPelna`, linia 38 `src` z `mapaEmbedUrl(miejsce)`, linie 52-56 z `miejsce`, linie 62-65 z `formatTelefon` i `telefonHref`, linia 68-71 z `kontakt.email`, linia 77 `href` z `mapaLinkUrl(miejsce)`, linia 81 `aria-label` z `pelnyAdres(miejsce)`.

### `app/kontakt/page.tsx` **[R2]**

`export const metadata` (linia 8) zamienić na `generateMetadata`. Opis w linii 11 zawiera adres wpisany literalnie. Rekomendacja: wyjąć adres z opisu i zostawić zdanie ogólne z miastem z `org.miejsceZajec.adres.miasto`. Wersja z pełnym adresem wymaga odmiany przez przypadki i przy zmianie ulicy da niepoprawną polszczyznę.

W treści strony przekazać `miejsce` i `kontakt` do `LocationMap`. Do `PageBody` przekazać `org`, żeby zadziałały znaczniki w blokach.

`revalidate = 300` w linii 6 zostaje, ale akcja zapisu musi jawnie rewalidować tę ścieżkę.

### `app/zajecia/dorosli/page.tsx` i `app/zajecia/dzieci/page.tsx` **[R2]**

1. `export const metadata` (linia 9) na `generateMetadata`. Tytuł zawiera nazwę filii, więc bierze ją z `org.filie`. Nazwiska instruktorów w opisie (linia 12) zostają literałami, są odmienione przez przypadki i nie należą do danych organizacji. Odnotować to w komentarzu jako świadomą kopię.
2. Linia 51, linki do deklaracji: dziś zaszyte w kodzie i niezależne od stopki. Zmiana ścieżki w panelu daje tu 404. Poprawka: czytać `getFooterData().downloads` i dopasować po fragmencie ścieżki albo po pozycji. To osobna, drobna naprawa, ale wchodzi w to samo okno.
3. Linia 62, przycisk „Napisz do nas": `mailto:` z `org.kontakt.email`, zachowując dzisiejsze zakodowane `subject`.
4. `LocationMap` dostaje `miejsceDlaGrupy(org, "dorosli")` albo `"dzieci"`.

### `app/zajecia/cennik/page.tsx` **[R2]**

Przekazać `org` do `PageBody`, żeby zadziałał nowy blok bankowy i znaczniki. `generateMetadata` opcjonalnie, opis zawiera datę „do 31 marca 2030", która jest treścią cennika, nie danymi organizacji.

### `lib/newsTypes.ts` i `components/NewsBlocks.tsx` **[R2]**

Nowy typ bloku:

```ts
/** Ramka z danymi do przelewu. Treść w całości z danych organizacji. */
| { type: "bank" }
```

W `BlockRenderer` nowy `case "bank"` obok linii 93-98. Musi odtworzyć dzisiejszy wygląd co do klasy: kontener `rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-6 py-5 text-neutral-200 backdrop-blur-sm`, nazwa odbiorcy w `font-semibold text-white`, numer konta w `text-yellow-500`. Znacznik `==...==` daje żółty **tekst**, nie żółte tło (`NewsBlocks.tsx:28-33`). Odtwarzamy kolor, nie znacznik.

Układ bloku: pierwszy wiersz to `odbiorca`, drugi to adres siedziby, trzeci to `nazwaBanku` i sformatowany IBAN, czwarty wiersz z kodem SWIFT tylko gdy pole niepuste, na końcu `wzorTytulu` renderowany przez `InlineText`. Gdy `org === null` albo `bank.iban` puste, blok renderuje ramkę z tekstem „Dane do przelewu w trakcie aktualizacji. Prosimy o kontakt: [e-mail]". Nigdy nie pokazuje starego numeru.

`BlockRenderer` przyjmuje opcjonalny props `org`, przekazywany z `PageContent`. Pozostałe typy bloków go ignorują.

### `components/PageContent.tsx` **[R1]**

Przyjmuje `org` propsem. Przed renderem przepuszcza bloki przez `rozwinZnaczniki(bloki, org)` i przekazuje `org` do `BlockRenderer`. Ta sama zmiana dotyczy renderu aktualności, jeśli korzysta z tego samego komponentu.

### `components/Navbar.tsx` **[R2]**

Komponent kliencki, więc dane przychodzą propsem z layoutu, tak samo jak dziś przychodzą `links`.

Linia 78: `src` z `org.grafika.logo`. Dla wariantu `plik` bez zmian, dla `cloudinary` przez `clUrl()`. Linia 79: `alt` z `org.grafika.logoAlt || org.nazwy.serwis`. Linie 80-81: `width` i `height` z pól obrazu zamiast zaszytych 1022 i 202.

`next.config.ts:16-22` dopuszcza wyłącznie `res.cloudinary.com`, więc pole w panelu musi być wybierakiem z biblioteki, nie polem tekstowym.

### `app/api/schedule/[group]/calendar.ics/route.ts` **[R2]**

Route Handler jest asynchroniczny, więc czyta bazę bez przeszkód.

| Linia | Zmiana |
|---|---|
| 66, UID | **Bez zmian.** Domena `shorinjikempo.pl` zostaje literałem w `lib/siteTechnical.ts`. Zmiana zduplikuje treningi w kalendarzach wszystkich, którzy już pobrali plan |
| 67, SUMMARY | `` `${org.nazwy.serwis} – ${groupLabel}` `` albo krótsza forma z nazwą skróconą |
| 69-70, DESCRIPTION | Nazwa z `org.nazwy.serwis` |
| 80, LOCATION | Bez zmian w kodzie, ale wartość `slot.location` zmienia źródło, patrz `ScheduleEditor` |
| 125, PRODID | `` `-//${org.nazwy.serwis}//Plan zajęć//PL` `` |
| 128, X-WR-CALNAME | Z `org.nazwy.serwis` |
| 139, filename | Literał przenieść do `lib/siteTechnical.ts` jako `NAZWA_PLIKU_ICS(group)` i użyć tej samej funkcji w `components/ScheduleWeek.tsx:106` |

Nagłówek `Cache-Control: public, max-age=300` w linii 140 sprawia, że kopia pliku na CDN potrzyma stary adres przez pięć minut mimo rewalidacji. Zmiana adresu sali wymaga osobnego komunikatu do klubu, bo do osób, które już pobrały plan, nie dotrze w ogóle.

### `components/admin/ScheduleEditor.tsx` **[R2]**

Pole „Miejsce" (linie 159-164) jest wymagane przez walidator w `lib/schedule.ts:26` i przy pierwszym zapisie harmonogramu kopiuje napis z `data/schedule.ts:25` do bazy per slot. Klucza `schedule` w bazie jeszcze nie ma, więc okno na naprawę jest otwarte tylko do pierwszego zapisu.

Zmiana: pole startuje pustą wartością, a placeholder brzmi „Domyślnie: [adres z Danych organizacji]". Puste pole oznacza „użyj adresu z Danych organizacji", a `lib/schedule.ts` podstawia go przy odczycie. Wypełnić trzeba wyłącznie dla zajęć w innym miejscu. Walidator przestaje wymagać niepustej wartości.

### `data/schedule.ts` i `lib/schedule.ts` **[R1]**

Usunąć `CONTACT_EMAIL_FOR_SCHEDULE` (linia 40), martwy kod bez żadnego konsumenta. Literał `LOCATION` (linia 25) zostaje jako ostatnia deska ratunku dla lokalnego builda bez bazy, ale przestaje być kopiowany do slotów, bo `lib/schedule.ts` podstawia adres z organizacji przy odczycie.

### `actions/contactActions.ts` **[R1]**

Linie 50 i 63 pokazują e-mail wtedy, gdy baza nie odpowiada, więc adres musi zostać poza bazą. Przenieść do `lib/siteTechnical.ts` jako `EMAIL_AWARYJNY` i zaimportować w obu miejscach. Panel pokazuje tę wartość jako pole tylko do odczytu i porównuje z `kontakt.email`, ostrzegając przy rozjeździe.

### `lib/editablePages.ts` **[R3]**

Cztery zmiany, z których trzecia jest krytyczna.

1. Linia 121, prefill cennika: usunąć IBAN, adres siedziby i nazwę prawną. W ich miejsce blok `{ type: "bank" }`. Usunięcie literału musi nastąpić w tym samym wydaniu, w którym blok bankowy czyta z bazy, inaczej skasowanie wiersza `page:cennik` przywróci stary numer w edytorze i redaktor zapisze go z powrotem.
2. Linie 127-131 oraz 210-214: interpolacje `CONTACT.email`, `CONTACT.phoneDisplay` i `SOCIAL_LINKS.*` zamienić na znaczniki `{{email}}`, `{{telefon}}`, `{{facebook}}` i pozostałe. Prefill przestaje kopiować dane do treści.
3. Rozszerzyć `interface EditablePage` (linie 11-18) o `prefillHeader?: { title?: string; lead?: string; kicker?: string }` i wypełnić go dla wszystkich stron. Dzisiaj lead strony Kontakt z adresem nie ma żadnej kopii w kodzie, jedyny egzemplarz to wiersz w bazie. To samo dotyczy etykietek „Zajęcia · Filia Wawel" i „Zajęcia · Filia Kraków".
4. Prefill stron `zajecia-dzieci` i `zajecia-dorosli` uzupełnić o blok `person` skopiowany z bazy. Dzisiaj prefill go nie zawiera, więc otwarcie edytora po skasowaniu wiersza kasuje kartę instruktora razem z rokiem urodzenia i numerem kenshi. Ten rozjazd naprawiamy **przed** migracją, bo migracja dotyka tych wierszy.

Poprawić też podpowiedzi, które w dniu wdrożenia stają się nieprawdziwe: linia 29 („Witamy w krakowskim dōjō", w bazie tytuł brzmi inaczej i podpowiedź jest błędna już dziś), linia 199 („mapa zostaje"), linie 221-222 i 241-242.

### `actions/pageActions.ts` i `actions/migrateActions.ts` **[R1]**

`resetPageBlocks(slug)` (pageActions, linie 74-87) nie ma konsumenta w interfejsie, ale jako wyeksportowana funkcja `"use server"` jest działającym endpointem dla każdego zalogowanego administratora. Usunięcie wiersza `page:cennik` po migracji to bezpowrotna utrata bloku bankowego, bo seed tego wiersza nie odtwarza. Do usunięcia.

`migrateAllContent()` (migrateActions, linie 19-66) też nie ma konsumenta, a wstrzykuje z powrotem telefon, e-mail, linki społecznościowe i IBAN z prefillu, przy okazji gubiąc `title`, `lead` i `kicker`. Do usunięcia.

### `scripts/seed-content.mjs` **[R2]**

Skrypt tworzy wiersz tylko wtedy, gdy go nie ma (linia 244), więc nie cofa migracji przy każdym uruchomieniu. Ryzyko jest węższe: gdy wiersz `page:kontakt` albo `page:zajecia-*` zniknie, następne uruchomienie odtworzy go z danymi z linii 106, 131-132, 151 i 180.

Zmiana: wszystkie dane kontaktowe w tych liniach zamienić na znaczniki. Wiersza `page:cennik` skrypt nie odtwarza w ogóle, co warto opisać komentarzem, bo to znaczy, że snapshot przed migracją jest jedyną kopią zapasową bloku bankowego.

### `app/galeria/page.tsx` **[R1]**

Jedyna publiczna podstrona bez `export const revalidate`, więc jej stopka z telefonem zamarza na wartości z builda. Dodać `export const revalidate = 300`. Opis w linii 8 przenieść do `generateMetadata` albo zostawić bez nazwy własnej.

### `app/galeria/_components/GalleryClient.tsx` **[R1]**

Linia 104, `alt="Galeria Shorinji Kempo"` przy każdym zdjęciu. Nazwa serwisu propsem ze strony serwerowej.

### `app/aktualnosci/page.tsx` **[R2]**

Linia 11, opis z nazwami filii i miastem. Linie 37-40 to widoczny akapit obiecujący Facebooka i Instagram bez linku. Wyczyszczenie pola `instagram` w panelu ukryje ikonę w stopce, a to zdanie dalej będzie obiecywać profil. Zamienić na render warunkowy z linkami z `org.social`.

### `components/ArticleListing.tsx` **[R1]**

Linia 17, widoczna żółta etykietka „Shorinji Kempo" nad nagłówkiem na `/o-shorinji`, `/organizacja` i `/buddyzm`. Nazwa propsem.

### `components/admin/AdminShell.tsx` **[R1]**

Dodać pozycję menu między „Menu na górze strony" a „Stopka strony":

```ts
{ href: "/admin/dane-organizacji", label: "Dane organizacji", icon: "◈" },
```

Literał „Shorinji Kempo Kraków" w linii 66 zostaje. Komponent jest kliencki, a to obszar wewnętrzny.

### `app/admin/(panel)/layout.tsx` **[R2]**

Po zmianie roota szablon `%s | …` dokleiłby sufiks drugi raz do „Panel admina | Shorinji Kempo Kraków". Ustawić `title: { absolute: "Panel admina" }`.

### `app/admin/login/page.tsx` i `app/admin/(panel)/page.tsx` **[R1]**

Ekran logowania jest komponentem klienckim poza layoutem panelu i nie ma skąd wziąć danych bez osobnego zapytania. Literał zostaje, świadomie. Pulpit panelu jest stroną serwerową, więc nazwę można podać z bazy, ale to najniższy priorytet.

W zakładce trzeba napisać wprost, gdzie nazwa się nie zmieni. Redaktor, który zmieni nazwę i zobaczy starą na ekranie logowania, uzna, że panel kłamie.

### `README.md` **[R1]**

Sekcja „Zmienne środowiskowe" (linie 106-115) wymienia sześć zmiennych i nie zawiera `NEXT_PUBLIC_SITE_URL`. W `.env` też jej nie ma, czyli produkcyjny adres to fallback `https://shorinji-kempo.netlify.app` z `lib/site.ts:11`. Panel obiecuje pole tylko do odczytu ustawiane przez administratora technicznego, więc README musi opisać, gdzie to zrobić.

### Pozostałe zmapowane pliki bez zmian

`app/robots.ts`, `app/sitemap.ts`, `app/icon.jpg`, `next.config.ts`, `supabase/setup.sql` poza nową tabelą audytu, `components/ContactForm.tsx`.

`data/articles/organizacja.ts:6` z nazwami POSK i WSKO oraz `docs/polityka-prywatnosci-DRAFT.md` zostają na razie poza zakresem. Pierwszy to treść artykułu, drugi nie jest publikowany.

---

## 5. Migracja

### Zasada porządku

Kolejność jest asymetryczna w skutkach. Kod przed danymi daje krótką przerwę z pustą stopką, którą widać i którą da się cofnąć rollbackiem. Dane przed kodem sprawiają, że `lib/footerData.ts:25` odtworzy `contact` z `DEFAULT_FOOTER`, a stopka pokaże **stary** telefon jako aktualny. Tego nie widać, więc to najgorszy z możliwych wariantów.

Dlatego przez jedno wydanie kod czyta organizację, a przy jej braku sięga do `footer.contact`. Ten most usuwamy w następnym commicie.

### Kroki na działającej produkcji

**Krok 0. Snapshot.** Zrzucić do pliku wiersze `footer`, `page:cennik`, `page:kontakt`, `page:zajecia-dzieci`, `page:zajecia-dorosli`, `page:home`. Wiersz `page:cennik` to jedyny egzemplarz danych finansowych poza literałem w `lib/editablePages.ts:121`, a seed go nie odtwarza. Bez snapshotu nie ma jak wrócić.

**Krok 1. Deploy commita 1** (typy, warstwa odczytu, tabela audytu, zakładka w trybie podglądu). Żaden konsument nie zmienia zachowania. Strona wygląda identycznie.

**Krok 2. Uruchomić `scripts/migrate-organization.mjs`.** Skrypt składa wiersz `organization` z: `footer.contact`, `footer.social`, `footer.copyright`, wartości z `lib/site.ts:17-38` oraz z bloku `page:cennik` blocks[16]. Czyta z bazy, nie z prefillu. Zapisuje do `_kopie.footerPrzedMigracja` i `_kopie.cennikCalloutOryginal`.

**Krok 3. Weryfikacja w panelu.** Otworzyć zakładkę i sprawdzić każdą wartość. Uzupełnić KRS, NIP i REGON, jeśli klub już je podał. Nic na stronie się jeszcze nie zmieniło.

**Krok 4. Deploy commita 2** (nowy typ bloku `bank` w rendererze). Zmiana wstecznie zgodna, stary callout renderuje się bez różnicy dla odwiedzającego.

**Krok 5. Deploy commita 3** (przepięcie konsumentów, z mostem do `footer.contact`). Po deployu obejrzeć: stopkę na dowolnej podstronie, mapę na `/kontakt`, źródło strony pod kątem JSON-LD, pobrany plik `.ics`.

**Krok 6. Uruchomić `scripts/migrate-content-tokens.mjs`.** Skrypt w jednym przebiegu:

- podmienia w `page:cennik` blok callout na `{ type: "bank" }`,
- w `page:cennik` blocks[18] zamienia adres e-mail na `{{email}}` w obu wystąpieniach, w etykiecie linku i w celu `mailto:`,
- w `page:kontakt` blocks[5], [6] i [7] wstawia znaczniki telefonu, e-maila i profili,
- w `page:zajecia-dzieci` blocks[0].note wstawia `{{adresSali}}`, `{{nazwaSali}}`, `{{telefon}}`, `{{telefonLink}}`, `{{email}}`,
- w `page:zajecia-dorosli` blocks[0].note wstawia `{{adresSali}}` i `{{nazwaSali}}`,
- usuwa z wiersza `footer` klucze `contact`, `social`, `copyright`, `about`.

Lead strony Kontakt zostawia bez zmian. Adres jest tam w miejscowniku („przy ul. Łąkowej 31"), a w panelu w mianowniku, więc podstawienie da niepoprawną polszczyznę. Do rozstrzygnięcia z klubem: przebudować zdanie na konstrukcję z mianownikiem („Adres: ul. Łąkowa 31") albo zaakceptować tę jedną kopię i opisać ją w podpowiedzi zakładki.

**Krok 7. Deploy commita 4** (usunięcie pól ze stopki, usunięcie mostu, usunięcie literału IBAN z prefillu).

**Krok 8. Deploy commita 5** (sprzątanie: `lib/site.ts`, seed, martwy kod, domyślna wartość miejsca w harmonogramie).

Na żadnym z tych kroków strona nie pokazuje pustych danych, bo od kroku 5 do 7 działa most, a od kroku 6 dane są już w nowym kluczu.

### Wyjęcie numeru konta z treści cennika

Struktura zweryfikowana na produkcji: 19 bloków, `blocks[15]` to nagłówek „Konto bankowe", `blocks[16]` to callout z nazwą, adresem i numerem, `blocks[17]` to akapit o tytule przelewu, `blocks[18]` to akapit z e-mailem.

Blok znajdujemy **po treści, nie po indeksie**. Redaktor może przestawić bloki między napisaniem skryptu a jego uruchomieniem.

```js
const jestBlokiemBankowym = (b) =>
  b.type === "callout" && /\d{2}(\s?\d{4}){6}/.test(b.text ?? "");
```

Parsowanie stringa `"**Stowarzyszenie „Polska Organizacja Shorinji Kempo\"** · ul. Wysłouchów 33/5, 30-611 Kraków · mBank: ==53 1140 2004 0000 3502 7497 1466=="`:

1. Rozbić po ` · ` na trzy człony.
2. Człon pierwszy: zdjąć `**`, to nazwa odbiorcy.
3. Człon drugi: rozbić po przecinku, lewa strona to ulica, prawa to kod pocztowy i miasto rozdzielone spacją.
4. Człon trzeci: rozbić po `: `, lewa strona to nazwa banku, prawa po zdjęciu `==` to numer konta.
5. Numer znormalizować: usunąć spacje, dodać przedrostek `PL`, sprawdzić sumę kontrolną mod 97. Niezgodność przerywa skrypt.

Skrypt porównuje wynik parsowania z wartościami startowymi z sekcji 2 i przerywa, gdy się nie zgadzają. Blok w bazie zastępuje przez `{ type: "bank" }`, a oryginalny tekst zapisuje do `_kopie.cennikCalloutOryginal`.

Weryfikacja po podmianie: pobrać `/zajecia/cennik`, porównać wyrenderowany numer ze snapshotem znak po znaku i sprawdzić, czy numer jest dalej żółty. Dopiero po tej kontroli usunąć literał z `lib/editablePages.ts:121`.

Wycofanie: jeden UPDATE wstawiający z powrotem callout z `_kopie.cennikCalloutOryginal`.

Blok `blocks[17]` z instrukcją tytułu przelewu przenosi się do pola `bank.wzorTytulu`, a sam akapit z treści znika, bo renderuje go blok bankowy. Blok `blocks[18]` zostaje w treści, zamieniony na znacznik `{{email}}`.

### Rewalidacja po zapisie

Akcja `saveOrganization` woła po udanym zapisie:

```ts
revalidatePath("/", "layout");
revalidatePath("/kontakt");
revalidatePath("/zajecia/cennik");
revalidatePath("/zajecia/dzieci");
revalidatePath("/zajecia/dorosli");
revalidatePath("/galeria");
revalidatePath("/aktualnosci");
revalidatePath("/api/schedule/dzieci/calendar.ics");
revalidatePath("/api/schedule/dorosli/calendar.ics");
```

Wszystkie wymienione podstrony mają `revalidate = 300`, więc bez jawnej rewalidacji redaktor zapisze zmianę, odświeży `/kontakt` i przez pięć minut albo dłużej zobaczy stary adres.

---

## 6. Edytor w panelu

Strona `/admin/dane-organizacji`. Formularz z jednym przyciskiem zapisu na dole i paskiem, który przykleja się do dolnej krawędzi po pierwszej zmianie. Bez przycisku „przywróć wartości bazowe". Kasowanie danych organizacji jednym kliknięciem nie może istnieć.

Nawigacja po sekcjach: spis po lewej stronie na dużych ekranach, zwijane karty na telefonie. Sekcje w kolejności od najczęściej zmienianych.

### Nagłówek strony

Nad formularzem trzy zdania, których redaktor nie może przeoczyć:

> Wszystko, co strona wie o klubie, jest na tej jednej stronie. Zmiana tutaj przechodzi na całą stronę naraz, więc nie trzeba jej powtarzać w innych zakładkach. Kilka rzeczy celowo nie da się tu zmienić, są opisane na samym dole.

Pod spodem data ostatniego zapisu i osoba, która zapisała.

### Sekcja 1. Kontakt

*Dwie dane, które zmieniają się najczęściej i widać je w największej liczbie miejsc.*

| Pole | Etykieta | Podpowiedź pod polem | Walidacja i komunikat |
|---|---|---|---|
| `kontakt.telefon` | Telefon klubu | Jeden numer dla całej strony. Zobaczysz go w stopce pod każdą podstroną, na stronie Kontakt, przy mapie dojazdu na stronach zajęć oraz w wizytówce Google. Wersję do kliknięcia strona zbuduje sama, nie wpisujesz jej osobno. | Dziewięć cyfr numeru krajowego albo numer z prefiksem +48. Spacje, myślniki i nawiasy usuwane przy zapisie, w bazie zawsze `+48792995510`. Błąd: „Podaj numer w postaci 792 99 55 10 albo +48 792 99 55 10" |
| `kontakt.telefonFormat` | Sposób wyświetlania numeru | Decyduje, jak numer wygląda dla czytającego. Klikalny link do dzwonienia działa identycznie w obu wariantach. | Dwie opcje: „+48 792 99 55 10" (domyślna) oraz „792 99 55 10". Pod polem podgląd na żywo |
| `kontakt.email` | E-mail klubu | Główna skrzynka klubu. Zobaczysz ją w stopce, na stronie Kontakt, przy mapie, w przyciskach „Napisz do nas" na stronach zajęć, w informacji o płatnościach na cenniku i w wizytówce Google. | Znak @ i domena z kropką. Błąd formatu: „To nie wygląda na adres e-mail". Puste blokuje zapis: „E-mail jest wymagany, bez niego strona nie spełnia obowiązku informacyjnego" |

### Sekcja 2. Miejsce zajęć

*Adres, pod który mają przyjść ćwiczący. To nie jest adres stowarzyszenia, ten wpisujesz niżej.*

Na górze sekcji ramka ostrzegawcza w kolorze bursztynowym z tym zdaniem, bo pomylenie dwóch adresów jest najbardziej prawdopodobnym błędem całej zmiany.

| Pole | Etykieta | Walidacja i komunikat |
|---|---|---|
| `miejsceZajec.nazwaPelna` | Nazwa obiektu (pełna) | Minimum 3 znaki. Błąd: „Podaj nazwę obiektu, np. Szkoła Podstawowa nr 114" |
| `miejsceZajec.nazwaSkrocona` | Nazwa obiektu, wersja skrócona do stopki | Bez walidacji. Puste oznacza użycie nazwy pełnej |
| `miejsceZajec.adres.ulica` | Ulica i numer sali | Minimum 3 znaki, musi zawierać cyfrę. Błąd: „Podaj ulicę razem z numerem, np. ul. Łąkowa 31" |
| `miejsceZajec.adres.kodPocztowy` | Kod pocztowy sali | Wzorzec 00-000, myślnik dopisywany automatycznie po drugiej cyfrze. Błąd: „Kod pocztowy ma postać 31-443" |
| `miejsceZajec.adres.miasto` | Miejscowość sali | Minimum 2 znaki. Błąd: „Podaj miejscowość" |
| `miejsceZajec.adres.wojewodztwo` | Województwo | Minimum 3 znaki, domyślnie „małopolskie". Błąd: „Wpisz województwo, np. małopolskie" |
| `miejsceZajec.adres.kodKraju` | Kraj | Lista, domyślnie Polska (PL). Nie da się wpisać wartości spoza listy |
| `miejsceZajec.linkMapy` | Własny link do mapy Google | Musi zaczynać się od https:// i wskazywać google.com/maps albo maps.app.goo.gl. Błąd: „Wklej link skopiowany z map Google" |

Pod sekcją podgląd mapy na żywo, przeładowywany po wyjściu z pola adresu. Redaktor od razu widzi, czy pinezka stoi we właściwym miejscu.

Przy polach województwa i kraju dopisek, że nie widać ich nigdzie na stronie i trafiają wyłącznie do danych, które czyta Google. Bez tego nikt nie zauważy, że je popsuł.

### Sekcja 3. Filie

*Nazwy filii pojawiają się w tytułach stron zajęć i w etykietkach nad nagłówkami.*

Lista wpisów z polami: nazwa filii, prowadzona grupa (dzieci, dorośli, brak) oraz przełącznik „ta filia trenuje pod innym adresem", który rozwija komplet pól adresowych.

Identyfikator techniczny nie jest widoczny w formularzu. Powstaje przy dodaniu filii i nigdy się nie zmienia, bo wiąże filię ze stroną zajęć.

### Sekcja 4. Nazwy i opis

*Jak klub nazywa się w tytule karty przeglądarki, w stopce, w Google i w dokumentach formalnych.*

| Pole | Etykieta | Walidacja i komunikat |
|---|---|---|
| `nazwy.serwis` | Nazwa strony | Od 3 do 60 znaków. Błąd: „Nazwa strony jest wymagana (3–60 znaków)". Ostrzeżenie powyżej 40 znaków: „Dłuższa nazwa zostanie przycięta w wynikach wyszukiwania". Zapis przez okienko potwierdzenia, bo pusta wartość psuje tytuł każdej podstrony |
| `nazwy.tytulDomyslny` | Tytuł strony głównej | Od 10 do 65 znaków. Obok przycisk „Zbuduj z nazwy strony". Podpowiedź wyjaśnia, że to tytuł widoczny wyłącznie na stronie głównej, pozostałe podstrony mają własne |
| `nazwy.opis` | Krótki opis strony | Od 70 do 160 znaków, licznik pod polem. Poniżej 70 ostrzeżenie „Opis jest bardzo krótki", powyżej 160 błąd „Google przytnie opis, skróć do 160 znaków (teraz X)" |
| `nazwy.prawna` | Pełna nazwa stowarzyszenia | Minimum 5 znaków. Ostrzeżenie nieblokujące, gdy brakuje słowa „Stowarzyszenie": „Sprawdź, czy to pełna nazwa z KRS". Polskie cudzysłowy drukarskie zapisywane bez zmian |
| `nazwy.skrocona` | Skrót nazwy | Bez walidacji. Podpowiedź: dziś POSK |
| `nazwy.wStopce` | Nazwa w stopce (po znaku ©) | Minimum 3 znaki. Ostrzeżenie przy czterocyfrowym roku w treści: „Rok dopisuje się automatycznie, usuń go z tego pola" |
| `nazwy.dlaGoogle` | Nazwa dodatkowa dla Google | Bez walidacji, puste dopuszczalne. Pusta wartość pomijana w danych strukturalnych, nie wysyłana jako pusty tekst |
| `organizacjaNadrzedna.nazwa` | Organizacja nadrzędna | Bez walidacji. Podpowiedź o WSKO |
| `organizacjaNadrzedna.url` | Strona organizacji nadrzędnej | https:// albo puste |

Pod sekcją ramka informacyjna wymieniająca miejsca, w których nazwa nie zmieni się mimo zapisu: ekran logowania do panelu oraz pasek boczny panelu. Redaktor musi to wiedzieć, zanim zacznie szukać błędu.

### Sekcja 5. Media społecznościowe

*Puste pole oznacza, że ikona po prostu się nie pojawi.*

Trzy pola z walidacją domeny: `facebook.com`, `instagram.com`, `youtube.com` albo `youtu.be`. Komunikaty w rodzaju „To nie wygląda na adres profilu na Facebooku". Wszystkie opcjonalne.

Przy polu YouTube dopisek: dziś podany jest kanał imienny instruktora (@Dominik_Chowanski) jako oficjalny kanał organizacji, więc po zmianie prowadzącego trzeba go świadomie podmienić.

### Sekcja 6. Logo i obrazek podglądu

`grafika.logo` przez `components/admin/ImagePicker.tsx` z ograniczeniem do biblioteki Cloudinary. Wymiary pobierane z biblioteki, nie wpisywane ręcznie. Ostrzeżenie, gdy proporcje odbiegają od 5:1 o więcej niż 20 procent: „To logo ma inne proporcje niż obecne, sprawdź podgląd nagłówka". Pod polem podgląd nagłówka w rzeczywistej szerokości.

`grafika.logoAlt`, maksimum 120 znaków, puste oznacza użycie nazwy strony.

`grafika.obrazUdostepniania` z ostrzeżeniem przy proporcjach innych niż 1,91:1 oraz z notką, że Facebook pamięta stary obrazek nawet kilka tygodni, więc lepiej wgrać nowy plik niż podmieniać istniejący pod tą samą nazwą.

Obecne logo i obraz podglądu są plikami z repozytorium. Dopóki nikt nie wgra zamiennika z biblioteki, pola pokazują dzisiejsze pliki jako podgląd z adnotacją „plik w projekcie, wymienia administrator techniczny".

### Sekcja 7. Wpłaty i konto bankowe

*Najbardziej kosztowne pole w całym panelu.*

| Pole | Etykieta | Walidacja i komunikat |
|---|---|---|
| `bank.odbiorca` | Odbiorca przelewu | Od 3 do 70 znaków, to limit pola odbiorcy w przelewie krajowym. Błąd powyżej: „Nazwa odbiorcy nie zmieści się w formularzu przelewu, skróć do 70 znaków". Obok przycisk „Skopiuj z pełnej nazwy" |
| `bank.iban` | Numer konta (IBAN) | Opisana niżej kontrola mod 97. Pole formatuje wpisywany numer na żywo, grupując po cztery znaki |
| `bank.nazwaBanku` | Nazwa banku | Bez walidacji formatu. Po wpisaniu numeru panel rozpoznaje bank z cyfr numeru rozliczeniowego i pyta: „Ten numer należy do banku X, wpisać?". Podpowiedź nigdy nie nadpisuje wartości wpisanej ręcznie |
| `bank.swift` | Kod SWIFT/BIC | Osiem albo jedenaście znaków, tylko litery i cyfry, zapisywane wielkimi literami. Błąd: „Kod SWIFT ma 8 albo 11 znaków, np. BREXPLPWMBK" |
| `bank.wzorTytulu` | Podpowiedź do tytułu przelewu | Maksimum 300 znaków. Ostrzeżenie przy czterocyfrowym roku: „W przykładzie jest konkretny rok, za kilka miesięcy będzie mylący" |

**Algorytm kontroli IBAN (mod 97, norma ISO 7064).**

```ts
export function normalizujIban(wejscie: string): string {
  const czysty = wejscie.replace(/[\s\-]/g, "").toUpperCase();
  // Numer krajowy podany bez kodu kraju traktujemy jako polski.
  return /^[A-Z]{2}/.test(czysty) ? czysty : "PL" + czysty;
}

export type WynikIban =
  | { ok: true; iban: string }
  | { ok: false; powod: "znaki" | "dlugosc" | "suma"; komunikat: string };

export function sprawdzIban(wejscie: string): WynikIban {
  const iban = normalizujIban(wejscie);

  // Krok 1: dozwolone są wyłącznie wielkie litery i cyfry.
  if (!/^[A-Z0-9]+$/.test(iban)) {
    return { ok: false, powod: "znaki",
      komunikat: "Numer konta może zawierać tylko cyfry i litery." };
  }

  // Krok 2: polski IBAN ma 28 znaków, czyli PL plus 26 cyfr.
  if (iban.startsWith("PL") && iban.length !== 28) {
    const cyfry = iban.length - 2;
    return { ok: false, powod: "dlugosc",
      komunikat: `Polski numer konta ma 26 cyfr, wpisano ${cyfry}.` };
  }
  if (iban.length < 15 || iban.length > 34) {
    return { ok: false, powod: "dlugosc",
      komunikat: "Ten numer ma nietypową długość, sprawdź, czy nic nie zginęło." };
  }

  // Krok 3: przenieś cztery pierwsze znaki na koniec.
  const przestawiony = iban.slice(4) + iban.slice(0, 4);

  // Krok 4: zamień litery na liczby, A = 10, B = 11, ... Z = 35.
  //         Krok 5: licz resztę z dzielenia przez 97 znak po znaku,
  //         bo pełna liczba ma ponad trzydzieści cyfr i nie mieści się
  //         w typie number.
  let reszta = 0;
  for (const znak of przestawiony) {
    const fragment = /[0-9]/.test(znak)
      ? znak
      : String(znak.charCodeAt(0) - 55);   // "A".charCodeAt(0) === 65, 65 - 55 = 10
    for (const cyfra of fragment) {
      reszta = (reszta * 10 + Number(cyfra)) % 97;
    }
  }

  // Krok 6: poprawny numer daje resztę równą 1.
  if (reszta !== 1) {
    return { ok: false, powod: "suma",
      komunikat: "Ten numer nie przechodzi kontroli poprawności. Sprawdź, czy nie zgubiła się albo nie przestawiła cyfra." };
  }
  return { ok: true, iban };
}
```

Rozpoznanie banku bierze osiem pierwszych cyfr numeru krajowego, czyli znaki od trzeciego do dziesiątego pełnego IBAN. Tablica minimalna, do rozszerzenia w razie potrzeby:

```ts
const BANKI: Record<string, string> = {
  "11402004": "mBank",
  "10201026": "PKO Bank Polski",
  "12401431": "Pekao SA",
  "10500086": "ING Bank Śląski",
  "16001462": "BNP Paribas",
  "19402887": "Credit Agricole",
  "21600003": "Millennium",
  "10901043": "Santander Bank Polska",
  "15602860": "Getin Noble",
  "13201016": "Bank Pocztowy",
};
```

**Okienko potwierdzenia zapisu numeru konta.** Kontrola mod 97 wyłapie zgubioną i przestawioną cyfrę, ale nie wyłapie numeru poprawnego, tylko nie waszego. Kto przejmie dostęp do panelu, podmieni IBAN i nikt nie zauważy tego przez miesiąc. Dlatego przy zmianie tego pola pojawia się osobne okno:

- stary i nowy numer jeden pod drugim, w tej samej siatce znaków,
- cyfry, które się różnią, na czerwono i pogrubione,
- pod spodem nazwa banku rozpoznana ze starego i z nowego numeru, a gdy się różnią, dodatkowe zdanie „Zmieniasz bank z X na Y",
- dwa przyciski: „Tak, zmieniam numer konta" oraz „Anuluj".

Każda zmiana pól finansowych i rejestrowych trafia do `organization_audit`. Bez logu podmiana numeru konta jest niewykrywalna po fakcie.

Pod sekcją podgląd ramki tak, jak zobaczy ją odwiedzający na cenniku, razem z żółtym kolorem numeru.

### Sekcja 8. Siedziba i korespondencja

Na górze ta sama bursztynowa ramka co przy miejscu zajęć, tylko odwrócona: to nie jest adres sali treningowej.

Pola adresu siedziby z taką samą walidacją jak przy sali. Dodatkowo ostrzeżenie nieblokujące, gdy ulica i miasto siedziby są identyczne z salą: „Wpisałeś adres sali treningowej. Czy na pewno tu mieści się siedziba?".

Przełącznik „Listy przychodzą pod adres siedziby" z wartością domyślną „Tak". Wybór „Nie" rozwija trzy pola korespondencyjne i czyni je wymaganymi. Podpowiedź wyjaśnia, że adres do korespondencji trafi do polityki prywatności jako droga pisemnego zgłoszenia żądań dotyczących danych osobowych, więc musi być prawdziwy.

Pole „Adres wpisany do KRS (jeśli inny)", opcjonalne, jedna linia. Puste oznacza, że w rejestrze figuruje adres siedziby.

### Sekcja 9. Dane rejestrowe

Na górze zdanie, którego nie wolno pominąć: tych numerów nie ma dzisiaj w serwisie ani razu, trzeba je przepisać z odpisu z KRS, a fałszywy numer rejestrowy jest gorszy niż jego brak. Pola KRS, NIP i REGON mają puste podpowiedzi w miejscu wpisywania, bez przykładowych numerów. Przykład w polu bywa zapisywany jako wartość.

| Pole | Walidacja i komunikat |
|---|---|
| `rejestr.formaPrawna` | Lista: stowarzyszenie rejestrowe (KRS) domyślnie, stowarzyszenie zwykłe (ewidencja starosty), fundacja, inna. Wybór stowarzyszenia zwykłego zamienia etykietę pola KRS na „Numer w ewidencji starosty" i wyłącza kontrolę dziesięciu cyfr |
| `rejestr.krs` | Dokładnie 10 cyfr, przechowywane jako tekst, wiodące zera istotne. Spacje i myślniki usuwane. Błąd: „Numer KRS ma 10 cyfr". Puste nie blokuje zapisu zakładki, ale blokuje publikację polityki prywatności komunikatem „Uzupełnij numer KRS w zakładce Dane organizacji" |
| `rejestr.nip` | 10 cyfr plus kontrola sumy. Błędy: „NIP ma 10 cyfr" oraz „Ten NIP nie przechodzi kontroli poprawności, sprawdź cyfry" |
| `rejestr.regon` | 9 albo 14 cyfr plus kontrola sumy właściwa dla długości. Błąd: „REGON ma 9 albo 14 cyfr" |
| `rejestr.sadRejestrowy` | Bez walidacji, maksimum 200 znaków |
| `rejestr.dataWpisu` | Format RRRR-MM-DD albo DD.MM.RRRR, sprowadzany do pierwszego. Błąd: „Podaj datę w postaci 12.03.2011" |
| `rejestr.statusOpp` | Tak/Nie, domyślnie Nie. „Tak" przy pustym KRS blokuje zapis: „Status OPP wymaga numeru KRS" |
| `rejestr.organNadzoru` | Bez walidacji, maksimum 200 znaków |
| `rejestr.reprezentacja` | Ostrzeżenie, gdy wartość wygląda na imię i nazwisko (dwa słowa z wielkiej litery, drugie zakończone typową końcówką nazwiska): „To wygląda na nazwisko, rozważ wpisanie samej funkcji, np. Zarząd Stowarzyszenia" |

Przy przełączniku statusu OPP zdanie o konsekwencjach: włączenie dodaje sekcję z numerem KRS do przekazania 1,5 procent podatku oraz miejsce na roczne sprawozdania, których publikacja staje się obowiązkiem z terminem 15 lipca. Błędne „Tak" obiecuje odwiedzającym coś, czego klub nie może przyjąć.

**Kontrola sumy NIP.** Dziesięć cyfr, wagi 6, 5, 7, 2, 3, 4, 5, 6, 7 dla dziewięciu pierwszych cyfr. Suma iloczynów modulo 11 musi równać się dziesiątej cyfrze. Reszta równa 10 oznacza numer niepoprawny.

**Kontrola sumy REGON.** Dla dziewięciu cyfr wagi 8, 9, 2, 3, 4, 5, 6, 7, suma iloczynów modulo 11, wynik 10 zamieniany na 0, porównanie z cyfrą dziewiątą. Dla czternastu cyfr wagi 2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8, ta sama procedura, porównanie z cyfrą czternastą. Oba formaty są poprawne i walidator musi przyjąć oba.

### Sekcja 10. Ochrona danych osobowych

| Pole | Walidacja i komunikat |
|---|---|
| `rodo.emailDaneOsobowe` | Poprawny adres e-mail albo puste. Podpowiedź: puste oznacza użycie ogólnego e-maila klubu i to jest w porządku |
| `rodo.iodWyznaczony` | Tak/Nie, domyślnie Nie. Podpowiedź wyjaśnia, że kluby sportowe zwykle nie mają obowiązku wyznaczania inspektora, a powołanie trzeba zgłosić Prezesowi UODO w ciągu 14 dni |
| `rodo.emailIod` | Wymagane, gdy inspektor wyznaczony. Błąd: „Skoro inspektor został wyznaczony, kontakt do niego musi być publiczny" |
| `rodo.dataAktualizacjiPolityki` | RRRR-MM-DD albo DD.MM.RRRR. Ostrzeżenie przy dacie z przyszłości: „Ta data jeszcze nie nastąpiła" |

### Sekcja 11. Dane dla wyszukiwarek

Dwa pola, `seo.dyscyplina` i `seo.przedzialCenowy`, oba opcjonalne, oba niewidoczne na stronie. Przy przedziale cenowym lista czterech wartości od `$` do `$$$$` z opisem, jaki poziom cen oznacza każda, plus przypomnienie, że dziś strona deklaruje `$$` bez związku z cennikiem.

### Sekcja 12. Ustawienia techniczne (tylko do odczytu)

Cztery pola zablokowane do edycji, każde z komunikatem, kto je zmienia. Pokazujemy je, żeby redaktor wiedział, że istnieją, i wiedział, kogo prosić.

| Pole | Wartość i komunikat |
|---|---|
| Adres strony w internecie | Z `NEXT_PUBLIC_SITE_URL`. „Ustawia administrator techniczny. Literówka tutaj zepsułaby naraz mapę strony dla Google, adresy kanoniczne wszystkich podstron i podglądy linków" |
| E-mail pokazywany przy awarii formularza | Z `EMAIL_AWARYJNY`. Panel porównuje z polem „E-mail klubu" i przy różnicy pokazuje ostrzeżenie: „Awaryjny adres różni się od e-maila klubu, zgłoś to administratorowi" |
| Ikonka w karcie przeglądarki | Podgląd pliku `app/icon.jpg`. „Wymienia administrator techniczny" |
| Stały znacznik plików kalendarza | `shorinjikempo.pl`. „Nie zmieniać nigdy. Zmiana sprawiłaby, że wszystkim, którzy już dodali plan do telefonu, treningi zdublują się jako nowe wydarzenia" |

### Walidacja po stronie serwera

`actions/organizationActions.ts` powtarza pełną walidację z `lib/organizationValidation.ts` przed zapisem. Walidacja w przeglądarce jest wygodą, nie zabezpieczeniem. Akcja odrzuca zapis z listą błędów i nie dotyka bazy, gdy którykolwiek warunek blokujący nie jest spełniony.

---

## 7. Czego nie wystawiamy w panelu

**Adres strony w internecie.** `metadataBase` w `app/layout.tsx:17` musi być znany przy budowaniu, bo Next prerenderuje strony. Wartość z bazy zadziałałaby dopiero po rewalidacji, więc to, co redaktor widzi w panelu, i to, co faktycznie działa, rozjeżdżałoby się w czasie. Do tego `new URL()` przy wartości bez schematu wywraca generowanie metadanych każdej trasy razem z `/admin`, a `alternates.canonical` na wszystkich podstronach są względne i rozwijają się po `metadataBase`, więc jedna literówka przepisuje adresy kanoniczne całego serwisu naraz. Pole pokazujemy do odczytu.

**Ikona serwisu.** `app/icon.jpg` to konwencja plikowa Next rozstrzygana przy budowaniu. Nie da się jej zasilić z bazy w żaden sposób. Pole, które nic nie robi, byłoby gorsze niż brak pola, więc pokazujemy je wyłącznie jako informację.

**Znacznik UID w plikach kalendarza.** Musi być stabilny na zawsze. Zmiana sprawi, że wszystkie kalendarze potraktują wydarzenia jako nowe i zduplikują treningi u każdego, kto pobrał plan.

**Identyfikator `@id` w danych strukturalnych.** To identyfikator encji dla Google, wyliczany z adresu strony. Zmiana kasuje ciągłość rozpoznania podmiotu. W ogóle nie jest polem.

**E-mail pokazywany przy awarii formularza.** Pojawia się dokładnie wtedy, gdy baza nie odpowiada, więc nie może z niej pochodzić. Fallback nie może zależeć od źródła, którego awarię obsługuje. Pokazujemy do odczytu z porównaniem do e-maila klubu, bo ukrycie tej kopii jest gorsze niż jej pokazanie.

**Nazwa serwisu na ekranie logowania i w pasku bocznym panelu.** Ekran logowania jest komponentem klienckim poza layoutem panelu i nie ma skąd wziąć danych bez osobnego zapytania. Zostawiamy literały świadomie i piszemy o tym w zakładce, zamiast obiecywać, że nazwa zmienia się wszędzie.

**Nazwa pliku kalendarza.** Widnieje w dwóch miejscach, w nagłówku `Content-Disposition` i w atrybucie `download`. Z tego samego powodu co UID zostaje literałem, ale przenosimy ją do jednej stałej, bo dziś nic nie pilnuje zgodności obu wystąpień.

**Wgrywanie plików PDF.** Zakładka tego nie rozwiązuje i nie udaje, że rozwiązuje. Redaktor może zmienić nazwę i ścieżkę w zakładce Stopka, ale pliku nie wgra, co podpowiedź w `components/admin/FooterEditor.tsx:140` mówi wprost.

**Kwoty w cenniku, dane instruktorów, listy plików i dokumentów.** Granica zakładki musi być świadoma, inaczej urośnie w nieskończoność. Kwoty i data „obowiązuje do 31 marca 2030" to treść strony, nie tożsamość podmiotu. Dane instruktorów są danymi osobowymi i mają własne miejsce edycji, choć dane organizacji trzeba z nich wyciąć.

---

## 8. Kolejność wdrożenia

Pięć commitów, każdy wdrażalny osobno i odwracalny przez `git revert` bez utraty danych. Między commitem 1 a 2 oraz między 3 a 4 uruchamiane są skrypty migracyjne.

### Commit 1. Fundament, bez zmiany zachowania

- `lib/organizationTypes.ts`, `lib/organization.ts`, `lib/organizationFormat.ts`, `lib/organizationValidation.ts`, `lib/siteTechnical.ts`
- `actions/organizationActions.ts`
- `app/admin/(panel)/dane-organizacji/page.tsx`, `components/admin/OrganizationEditor.tsx`
- Pozycja w menu w `components/admin/AdminShell.tsx`
- Tabela `organization_audit` w `supabase/setup.sql`
- `scripts/check-organization.mjs` w trybie samego ostrzegania, jeszcze bez przerywania builda
- Utwardzenie `SITE_URL` w `lib/site.ts`
- `NEXT_PUBLIC_SITE_URL` dopisane do README

Żaden konsument nie zmienia zachowania. Zakładka działa i zapisuje, ale nic z niej jeszcze nie czyta. Wycofanie: revert, nowy klucz w bazie zostaje i nikomu nie przeszkadza.

**Po deployu: uruchomić `scripts/migrate-organization.mjs` i sprawdzić wszystkie wartości w panelu.**

### Commit 2. Renderer bloku bankowego

- `{ type: "bank" }` w `lib/newsTypes.ts`
- `case "bank"` w `components/NewsBlocks.tsx` odtwarzający dzisiejsze klasy
- `lib/organizationTokens.ts` z rozwijaniem znaczników
- `components/PageContent.tsx` przyjmuje `org`, rozwija znaczniki i przekazuje `org` do renderera
- Naprawa prefillu w `lib/editablePages.ts`: pola nagłówka i blok `person` dla stron zajęć

Zmiana wstecznie zgodna. Stary callout renderuje się identycznie, żaden istniejący blok nie ma jeszcze typu `bank`, żadna treść nie ma jeszcze znaczników. Dla odwiedzającego zero różnicy.

Wycofanie: revert. Bezpieczne, bo nic w bazie jeszcze nie korzysta z nowego typu.

### Commit 3. Przepięcie konsumentów, z mostem

- `app/layout.tsx` na `generateMetadata`, odczyt w istniejącym `Promise.all`, przekazanie `org` w dół
- `components/Footer.tsx`, `components/StructuredData.tsx`, `components/LocationMap.tsx`, `components/Navbar.tsx`
- `app/kontakt/page.tsx`, `app/zajecia/dorosli/page.tsx`, `app/zajecia/dzieci/page.tsx`, `app/zajecia/cennik/page.tsx`
- `app/galeria/page.tsx` z `revalidate`, `app/galeria/_components/GalleryClient.tsx`, `app/aktualnosci/page.tsx`, `components/ArticleListing.tsx`
- `app/api/schedule/[group]/calendar.ics/route.ts` i `components/ScheduleWeek.tsx`
- `app/admin/(panel)/layout.tsx` z tytułem bezwzględnym
- `actions/contactActions.ts` na `EMAIL_AWARYJNY`
- **Most:** `lib/organization.ts` przy `status !== "baza"` sięga do `footer.contact`, `footer.social` i `footer.copyright` i buduje z nich obiekt częściowy. Kod mostu w osobnej funkcji `mostZeStopki()` z komentarzem `USUNĄĆ W COMMICIE 4`

To jest ten commit, przy którym trzeba obejrzeć stronę własnymi oczami. Kontrola po deployu: stopka na dowolnej podstronie, mapa i przycisk „Wyznacz trasę" na `/kontakt`, źródło strony pod kątem JSON-LD, tytuł karty na `/zajecia/cennik`, pobrany plik `.ics`, podgląd linku w debuggerze Facebooka.

Wycofanie: revert. Dane w bazie zostają nietknięte.

**Po deployu i po kontroli: uruchomić `scripts/migrate-content-tokens.mjs`.** Skrypt podmienia blok bankowy, wstawia znaczniki w treściach i odchudza wiersz `footer`.

### Commit 4. Zamknięcie starych źródeł

- `lib/footerTypes.ts` bez `about`, `social`, `contact`, `copyright`
- `lib/footerData.ts` bez tych gałęzi scalania
- `components/admin/FooterEditor.tsx` bez trzech sekcji, z notką odsyłającą do nowej zakładki
- `actions/footerActions.ts`, `resetFooter` przestaje kasować wiersz
- Usunięcie mostu `mostZeStopki()` z `lib/organization.ts`
- Usunięcie literału IBAN i interpolacji danych kontaktowych z `lib/editablePages.ts`
- `scripts/check-organization.mjs` przechodzi w tryb przerywania builda

Od tego momentu nie ma już drugiego formularza na te same dane i nie ma jak przywrócić starego numeru konta przyciskiem.

Wycofanie jest tu najtrudniejsze, bo skrypt z kroku poprzedniego usunął już klucze z wiersza `footer`. Revert samego commita przywróci pola w formularzu, ale będą puste. Dlatego przed uruchomieniem skryptu obowiązuje snapshot, a kopia całego wiersza siedzi w `_kopie.footerPrzedMigracja`.

### Commit 5. Sprzątanie

- `lib/site.ts` bez `SITE_NAME`, `SITE_DESCRIPTION`, `CONTACT`, `FULL_ADDRESS`, `SOCIAL_LINKS`, `MAPS_EMBED_URL`, `MAPS_LINK_URL`
- `data/schedule.ts` bez `CONTACT_EMAIL_FOR_SCHEDULE`
- `actions/pageActions.ts` bez `resetPageBlocks`
- `actions/migrateActions.ts` usunięty w całości
- `scripts/seed-content.mjs` bez danych kontaktowych, ze znacznikami zamiast wartości
- `components/admin/ScheduleEditor.tsx` z pustym polem „Miejsce" i wartością domyślną z danych organizacji, `lib/schedule.ts` podstawia adres przy odczycie, walidator w `lib/schedule.ts:26` przestaje wymagać niepustej wartości
- Poprawione podpowiedzi w `lib/editablePages.ts`

Ten commit trzeba wdrożyć, zanim redaktor pierwszy raz otworzy zakładkę Grafik zajęć. Klucza `schedule` w bazie jeszcze nie ma, więc pierwszy zapis zamroziłby adres z `data/schedule.ts:25` w bazie per slot, a stamtąd trafia on do plików kalendarza i żyje dalej w telefonach ćwiczących.

Wycofanie: revert. Wszystkie usunięte rzeczy były martwe albo zastąpione, więc powrót nie psuje danych.

### Kontrola końcowa

Po piątym commicie przejść listę: telefon zmieniony w panelu zmienia się w stopce, na mapie, w JSON-LD i w treści strony Kontakt. E-mail zmienia się dodatkowo w przyciskach na stronach zajęć i w akapicie o płatnościach na cenniku. Numer konta zmienia się w ramce na cenniku i tylko tam. Nazwa strony zmienia się w tytule karty przeglądarki na każdej podstronie, w podglądzie linku i w pliku kalendarza, ale nie na ekranie logowania do panelu, co jest opisane w zakładce.

Osobno, do zaplanowania po tej zmianie i poza jej zakresem: strona z polityką prywatności czytająca dane rejestrowe z tej zakładki oraz widoczne miejsce z pełną nazwą prawną i adresem siedziby, bez którego art. 5 ust. 2 ustawy o świadczeniu usług drogą elektroniczną pozostaje niespełniony.

---

# Aneks A: pominieci konsumenci

Sprawdziłem projekt niezależnie: cały kod (`app/`, `components/`, `lib/`, `actions/`, `data/`, `scripts/`), pliki statyczne, `supabase/setup.sql`, `next.config.ts`, `README.md` oraz **żywą bazę** (odczyt przez service-role: `site_settings` 7 kluczy, `nav_items` 20, `article_overrides` 4, `custom_pages` 0, `articles` 1). Poniżej wyłącznie to, czego NIE MA na liście i czego NIE POKRYWA żadne z zaprojektowanych pól.

---

## A. POMINIĘTE DANE — brakuje pola

### A1. NAZWA FILII („Wawel" / „Kraków") — największe pominięcie
Klub ma **dwie filie**, a projekt zakłada jedną salę i jeden adres. Nazwa filii to dana tożsamościowa, dziś zamrożona w ośmiu niezależnych miejscach:

| miejsce | wartość |
|---|---|
| `app/zajecia/dzieci/page.tsx:10` | title „Grupa dziecięca **(Filia Wawel)**" |
| `app/zajecia/dzieci/page.tsx:12` | description „w krakowskiej **filii Wawel** Shorinji Kempo" |
| `app/zajecia/dorosli/page.tsx:10` | title „Grupa dorosła **(Filia Kraków)**" |
| `app/zajecia/dorosli/page.tsx:12` | description „w krakowskiej filii Shorinji Kempo" |
| baza `site_settings page:zajecia-dzieci` → `value.kicker` | „Zajęcia · **Filia Wawel**" (żółta etykietka nad H1) |
| baza `site_settings page:zajecia-dzieci` → `blocks[2].text` | „Zajęcia w filii `==Wawel==`…" |
| baza `site_settings page:zajecia-dorosli` → `value.kicker` | „Zajęcia · **Filia Kraków**" |
| baza `site_settings page:zajecia-dorosli` → `blocks[2].text` | „Zajęcia w filii `==Kraków==`…" |
| baza `site_settings page:home` → `blocks[3].text` | „Ćwiczymy w dwóch filiach. …działa w **filii Wawel**, a …w **filii Kraków**." |
| baza `article_overrides` (organizacja/egzaminatorzy) `blocks[0].role`, `blocks[1].role` | „Shibuchō / Mistrz kierujący filią \"Kraków\"" / „…\"Wawel\"" |
| `data/articles/organizacja.ts:40` i `:50` | te same nazwy w fallbacku w kodzie |
| `lib/editablePages.ts:41`, `:226`, `:246` | prefill |
| `scripts/seed-content.mjs:113`, `:119`, `:155`, `:184` | piąta kopia |
| `components/StructuredData.tsx:65` | alternateName „…**– filia Kraków**" (na liście, ale jako „nazwa", nie jako filia) |

**Pole do dołożenia:** `filie` — lista wpisów (nazwa filii + grupa + opcjonalnie własny adres sali), a pola `sala*` powinny należeć DO FILII, nie do organizacji. Dowód, że to nie jest stan jednorazowy: w cenniku istnieje pozycja **„Ustanowienie nowej filii – 200 zł"** (baza `page:cennik blocks[5]`, kod `lib/editablePages.ts:71`) oraz „Przeniesienie z jednej filii do drugiej" (`:70`). Model z jednym `salaNazwa`/`salaUlica` przy trzeciej filii się rozpadnie.

### A2. ORGANIZACJA NADRZĘDNA (WSKO) I SKRÓT NAZWY (POSK) — brak pól, do tego SPRZECZNOŚĆ
- `data/articles/organizacja.ts:6` — „Polska Organizacja Shorinji Kempo **(POSK)** jest oficjalnym przedstawicielem **World Shorinji Kempo Organization (WSKO)** w Polsce". Trafia jednocześnie do `app/organizacja/page.tsx:13` (meta description) i do widocznego nagłówka przez `components/ArticleListing.tsx:22`.
- `lib/footerTypes.ts:40` — „Statut **POSK**" (skrót jako etykieta dokumentu).
- baza `site_settings page:home blocks[3]` — „Należymy do **Światowej Organizacji Shorinji Kempo (WSKO)**".
- **Sprzeczność kod vs baza:** baza `page:cennik blocks[4]` = „Członkostwo w **Światowej** Organizacji Shorinji Kempo (WSKO)", a `lib/editablePages.ts:62` = „Członkostwo w **Polskiej** Organizacji Shorinji Kempo." Chodzi o tę samą opłatę wpisową 50 zł. Jedna z wersji jest błędna już dziś i migracja tego nie rozstrzygnie.

**Pola do dołożenia:** `nazwaSkrocona` (POSK — czwarty wariant nazwy własnej, dziś nieujęty obok pełnej/stopkowej/dla Google) oraz `organizacjaNadrzedna` (nazwa + adres strony). To drugie ma bezpośredniego konsumenta w SEO: JSON-LD powinno mieć `parentOrganization`/`memberOf`, dziś nie ma ich wcale.

### A3. PLIK KALENDARZA .ics — cztery miejsca poza wskazanymi :125 i :128
- `app/api/schedule/[group]/calendar.ics/route.ts:67` — `SUMMARY` **każdego wydarzenia**: „Shorinji Kempo – ${groupLabel}". To ta nazwa ląduje w kalendarzu ćwiczącego, nie PRODID.
- `:69` i `:70` — `DESCRIPTION`: „Trening Shorinji Kempo (…)".
- `:139` — `Content-Disposition: filename="shorinji-kempo-${group}.ics"`.
- `components/ScheduleWeek.tsx:106` — atrybut `download="shorinji-kempo-${group}.ics"`, niezależna kopia tej samej nazwy pliku.

**Do decyzji:** `nazwaSerwisu` pokrywa :67/:69/:70 (Route Handler jest async, wykonalne od ręki), ale nazwa pliku w dwóch miejscach powinna zostać literałem — z tego samego powodu co UID — i wtedy trzeba je **zsynchronizować ręcznie**, bo dziś nic ich nie pilnuje.

### A4. JSON-LD: `sport` i `priceRange` — brak pól
- `components/StructuredData.tsx:72` — `sport: "Shorinji Kempo"`.
- `components/StructuredData.tsx:73` — `priceRange: "$$"`.

Oba to twierdzenia o podmiocie wysyłane do Google, oba są literałami, żadne pole ich nie obejmuje. `priceRange` jest szczególnie niezręczny: cennik mówi 150–160 zł/mies., a strona deklaruje Google'owi „$$" bez związku z cennikiem. **Pola:** `dyscyplina`, `przedzialCenowy` — albo świadoma decyzja „zostaje w kodzie", ale wtedy tak jak `emailAwaryjny`: widoczna w zakładce jako pole tylko do odczytu.

### A5. NAZWA MARKI I MIASTO W MIEJSCACH NIEUJĘTYCH
- `components/ArticleListing.tsx:17` — **widoczna** żółta etykietka „Shorinji Kempo" nad nagłówkiem na `/o-shorinji`, `/organizacja`, `/buddyzm` (trzy podstrony). → `nazwaSerwisu`.
- `app/galeria/_components/GalleryClient.tsx:104` — `alt="Galeria Shorinji Kempo"` przy **każdym** zdjęciu w galerii. → `nazwaSerwisu` (zadanie wprost prosiło o alt-y — to jedyny alt z nazwą podmiotu poza logo).
- `app/galeria/page.tsx:8` — meta description „krakowskiego dōjō Shorinji Kempo". → `nazwaSerwisu` + `salaMiasto`.
- `app/aktualnosci/page.tsx:11` — meta description „krakowskich **filii** Shorinji Kempo". → A1 + `salaMiasto`.
- `app/aktualnosci/page.tsx:37-40` — **widoczny akapit**: „Ogłoszenia i wydarzenia z życia krakowskich filii… Bieżące informacje znajdziesz też na naszym **Facebooku i Instagramie**." To jedyne miejsce, gdzie tekst *obiecuje konkretne kanały społecznościowe bez linku*. Wyczyszczenie pola `instagram` w panelu ukryje ikonę w stopce, a to zdanie nadal będzie obiecywać Instagram. → wymaga albo znacznika, albo warunkowego renderu.
- `app/layout.tsx:27`, `:28`, `:29`, `:30` — słowa kluczowe „sztuki walki Kraków", „samoobrona Kraków", „dōjō Kraków", „zajęcia dla dzieci Kraków". Lista wskazuje tylko `:26`. → `salaMiasto`.
- `components/admin/AdminShell.tsx:66` — **numer linii na liście jest błędny (podano :57)**; literał „Shorinji Kempo Kraków" jest w linii 66.

### A6. GODZINY TRENINGÓW ZAMROŻONE W TREŚCI STRONY KONTAKT
Baza `site_settings page:kontakt` → `blocks[1]` i `blocks[2]`: „Grupa dziecięca trenuje we wtorki i czwartki w godzinach 18:00–19:30", „Grupa dorosła… 19:30–21:30 oraz w niedziele 18:00–21:00" (prefill: `lib/editablePages.ts:200-206`). To ta sama dana, którą redaktor edytuje w zakładce Grafik zajęć i z której `components/StructuredData.tsx:88` generuje `openingHoursSpecification`. Zmiana godzin w panelu **nie ruszy strony Kontakt** — dokładnie ta sama patologia co z telefonem, tylko z godzinami. Nie należy do „Danych organizacji", ale dotyczy tego samego wiersza w bazie, który i tak migrujecie.

---

## B. MIEJSCA, KTÓRE **ZAPISUJĄ** DANE ORGANIZACJI — nie ma ich na liście, a cofną migrację

### B1. Przycisk „Przywróć wersję bazową" w zakładce Stopka
`components/admin/FooterEditor.tsx:83-94` i `:229-235` → `actions/footerActions.ts:25-35` (`resetFooter`). **Kasuje wiersz `footer` z bazy.** Potwierdzenie brzmi tylko: „Przywrócić stopkę bazową z kodu strony?" — po kliknięciu adres, telefon i e-mail wracają do literałów z `lib/footerTypes.ts:45-51`, a redaktor dostaje komunikat „Przywrócono wartości bazowe" bez informacji, że przywrócił dane sprzed lat. Lista opisuje cichy fallback w `lib/footerData.ts:19-27`, ale **nie ten przycisk**. Jeśli „Dane organizacji" powstaną na wzór Stopki, ten przycisk przywróci stary IBAN i stary KRS jednym kliknięciem.

### B2. `resetPageBlocks(slug)` — martwa akcja serwerowa, która kasuje wiersz cennika
`actions/pageActions.ts:74-87`. Sprawdziłem: **nie ma żadnego konsumenta w UI** (`grep resetPageBlocks` → tylko definicja). Ale to wyeksportowana funkcja `"use server"`, czyli działający endpoint POST dostępny dla każdego zalogowanego admina. Usunięcie `page:cennik` = zniknięcie zmigrowanego bloku konta, a panel wystartuje z prefillu `lib/editablePages.ts:121` z zaszytym IBAN-em. Do usunięcia razem z resztą sprzątania.

### B3. `migrateAllContent()` — DRUGI seed, obok `scripts/seed-content.mjs`
`actions/migrateActions.ts:19-66`, również **bez konsumenta w UI**. Wpisuje do bazy `value: { blocks: page.prefill }` dla każdej strony, której nie ma w bazie. Dwa niezależne problemy:
1. Wstrzykuje z powrotem telefon, e-mail i linki społecznościowe z `lib/editablePages.ts:210-214` oraz IBAN z `:121`.
2. Zapisuje **wyłącznie `blocks`** — gubi `title`, `lead` i `kicker`. Czyli po takim „odtworzeniu" strona Kontakt straciłaby lead z adresem, a strony zajęć — etykietki „Zajęcia · Filia Wawel/Kraków". Lista wymienia tylko `scripts/seed-content.mjs` jako ścieżkę cofnięcia migracji; ta jest druga i jest w aplikacji, nie w skrypcie.

### B4. `resetSchedule()` — przywraca adres sali z kodu
`components/admin/ScheduleEditor.tsx:58-74` i `:196` → `actions/scheduleActions.ts:41`. Kasuje klucz `schedule`, więc `lib/schedule.ts:34,50` wraca do `data/schedule.ts:25` — literału z adresem. To domyka opisany na liście problem „czwartej kopii adresu": po wprowadzeniu zakładki adres da się nie tylko skopiować do harmonogramu, ale i **przywrócić stary** jednym przyciskiem.

---

## C. USTALENIA, KTÓRE KORYGUJĄ ZAŁOŻENIA PROJEKTU

**C1. `==...==` daje żółty TEKST, nie żółte tło.** `components/NewsBlocks.tsx:28-31` renderuje to jako `<span className="text-yellow-500">`. Notatka projektowa („żółte wyróżnienie", „po cichu zabierze żółte tło") opisuje efekt, którego nie ma. Nowy blok „Konto bankowe" musi odtworzyć **żółty kolor tekstu**, inaczej wyjdzie rozjazd w drugą stronę.

**C2. `NEXT_PUBLIC_SITE_URL` nie jest ustawiony ani udokumentowany.** W `.env` go nie ma, a `README.md:106-115` (sekcja „Zmienne środowiskowe") wymienia sześć zmiennych i **tej nie zawiera**. Czyli produkcyjny `SITE_URL` to fallback `https://shorinji-kempo.netlify.app` z `lib/site.ts:11` — a to on zasila `metadataBase`, kanoniczne adresy, sitemap, robots, JSON-LD `@id`/`url` i `LOGO_URL`. Projekt przewiduje pole `adresStrony` „tylko do odczytu, ustawia administrator techniczny", ale nie ma udokumentowanego sposobu, żeby administrator to zrobił. Do uzupełnienia w README razem z zakładką.

**C3. Prefill nie ma pól nagłówka w ogóle.** `interface EditablePage` (`lib/editablePages.ts:11-18`) zna tylko `prefill: NewsBlock[]` — bez `title`/`lead`/`kicker`. Skutek: **lead strony Kontakt z adresem („…w Szkole Podstawowej nr 114 przy ul. Łąkowej 31 w Krakowie") nie ma żadnej kopii w kodzie.** Jedyny egzemplarz to wiersz w bazie. To poważniejszy przypadek niż opisany na liście brak karty instruktora w prefillu.

**C4. Kolejne rozjazdy prefill vs baza (poza cennikiem blocks[17], który już odnotowano):**
- `page:home blocks[3]` (baza): „Należymy do **Światowej Organizacji Shorinji Kempo (WSKO)**" vs `lib/editablePages.ts:41`: „Należymy do **światowej organizacji Shorinji Kempo**" — bez WSKO, małą literą.
- `page:cennik blocks[4]` vs `lib/editablePages.ts:62` — opisane w A2.
Potwierdza regułę z listy: migracja musi czytać z bazy.

**C5. Podpowiedzi w panelu staną się nieprawdziwe w dniu wdrożenia.** Do zmiany razem z zakładką:
- `lib/editablePages.ts:29` — „Akapity pod nagłówkiem „**Witamy w krakowskim dōjō**"", podczas gdy w bazie tytuł brzmi „Witamy w naszym Dōjō Shorinji Kempo". Podpowiedź jest błędna **już dziś**.
- `lib/editablePages.ts:199` — „Sekcje „Godziny treningów" i „Dane kontaktowe" (**mapa zostaje**)" — sugeruje redaktorowi, że adresu nie da się zmienić.
- `lib/editablePages.ts:221-222` i `:241-242` — „karta instruktora, plan tygodnia i mapa zostają".
- `components/admin/FooterEditor.tsx:112` — hint kolumny Linki.

---

## Miejsca sprawdzone, w których NIC nie pominięto

`app/robots.ts` (tylko `SITE_URL`), `app/sitemap.ts` (tylko `SITE_URL`), `supabase/setup.sql` (sam schemat, zero danych podmiotu), `content-fallback/articles.json` (brak danych organizacji), `next.config.ts` (tylko `res.cloudinary.com` — już odnotowane), `components/ContactForm.tsx` (brak zaszytego e-maila; placeholdery to `jan@przyklad.pl` i `twoj@email.pl`, nie dane klubu), `components/Navbar.tsx` (tylko logo i `alt` — oba pokryte), `nav_items` (20 pozycji, żadna do polityki/regulaminu — zgodnie z listą), `custom_pages` (0 wierszy), `articles` (1 wiersz, bez danych podmiotu), `public/` (brak dodatkowych plików marki poza `SOEN.jpg`, `og.png`, `app/icon.jpg`). Pełny przemiał regexem po e-mailach, numerach telefonu i IBAN-ach w całym repo (bez `node_modules`/`.next`) nie dał ani jednego trafienia poza już zmapowanymi.

Zrzut bazy do dalszej weryfikacji: `C:\Users\Michal\AppData\Local\Temp\claude\G--Workspace-Kempo\1608beca-87b5-4706-af56-90d0ec01865f\scratchpad\db.json`

---

# Aneks B: ryzyka wdrozeniowe

## 1. Statyczne metadane — gdzie dane organizacji zamarzają przy buildzie

**Pliki z `export const metadata` (13):** `app/layout.tsx:16`, `app/page.tsx:7`, `app/kontakt/page.tsx:8`, `app/aktualnosci/page.tsx:8`, `app/galeria/page.tsx:5`, `app/program-nauczania/page.tsx:6`, `app/zajecia/cennik/page.tsx:6`, `app/zajecia/dzieci/page.tsx:9`, `app/zajecia/dorosli/page.tsx:9`, `app/buddyzm/page.tsx:11`, `app/organizacja/page.tsx:11`, `app/o-shorinji/page.tsx:11`, `app/admin/(panel)/layout.tsx:6`.

**Dane organizacji siedzą tylko w czterech z nich:**

| Plik | Co trzeba zmienić |
|---|---|
| `app/layout.tsx:16-58` | Jedyne miejsce z `SITE_NAME`/`SITE_DESCRIPTION`/`SITE_URL`. Zamienić na `export async function generateMetadata()` — **i usunąć `export const metadata`**, bo Next nie pozwala eksportować obu z jednego segmentu. Uwaga na `DEFAULT_TITLE` (`:14`, „Shorinji Kempo Kraków: japońska sztuka walki") — to **czwarty** wariant nazwy, którego projekt pól nie przewiduje; potrzebne osobne pole `tytulDomyslnyStrony`. Dalej: `:23 applicationName`, `:26-33 keywords` (literały „Shorinji Kempo Kraków", „sztuki walki Kraków"), `:37 siteName`, `:45 alt`, `:22/:39/:52 description`. |
| `app/kontakt/page.tsx:8-13` | `description` zawiera adres sali wpisany literalnie („ul. Łąkowa 31, Kraków"). Albo `generateMetadata` czytające `salaUlica`/`salaMiasto`, albo wyjąć adres z opisu. |
| `app/zajecia/dzieci/page.tsx:9-14`, `app/zajecia/dorosli/page.tsx:9-14` | Tytuł z nazwą filii + opis z nazwiskiem instruktora w dopełniaczu. Dane instruktorów są poza zakładką — zostawić, ale odnotować jako świadomą kopię. |
| `app/admin/(panel)/layout.tsx:6-9` | Literał „Panel admina \| Shorinji Kempo Kraków". Dodatkowo po zmianie roota szablon `%s \| …` dołoży sufiks drugi raz. Ustawić `title: { absolute: "Panel admina" }`. |

**Korekta założenia z projektu:** teza „`title.template` działa wyłącznie w statycznym `metadata` roota, więc trzeba przepisać 11 podstron" jest nieprawdziwa. `generateMetadata` jest wspierane w layoutach, a `title.template` to zwykłe pole zwracanego obiektu `Metadata` i propaguje się do dzieci tak samo. **Przepisanie samego `app/layout.tsx` wystarczy, żeby sufiks tytułu poszedł z bazy na wszystkich podstronach.** To zmienia wycenę z „11 plików" na „4 pliki" — warto potwierdzić jednym buildem przed planowaniem.

**Ważniejsze niż `export const metadata`:** decyduje nie forma metadanych, tylko czy trasa się w ogóle przerendersuje. `app/galeria/page.tsx` **nie ma `export const revalidate`** (jedyna taka podstrona publiczna — sprawdzone grepem) → jest prerenderowana raz przy buildzie i jej stopka z telefonem zamarza do następnego deployu, chyba że złapie ją `revalidatePath('/', 'layout')`. `components/StructuredData.tsx` nie jest metadaną, ale renderuje się z roota (`app/layout.tsx:79`) i podlega tej samej regule zamrożenia.

`app/icon.jpg` to konwencja plikowa Next rozstrzygana przy buildzie — pola „ikonka" nie da się podpiąć w ogóle.

## 2. Baza nie odpowiada / brak klucza `organization`

**Strona się nie wysypie — dziś wszystkie czytniki mają cichy fallback:** `lib/supabaseAdmin.ts:17-21` zwraca `null` przy braku ENV, `lib/pageOverrides.ts:54-57` łyka wyjątek i zwraca `null`, a `components/PageContent.tsx:19,42` renderują wtedy **nic** (Kontakt i Cennik stają się pustą skorupą — to już dzisiejsze zachowanie). `lib/footerData.ts:28-31` wraca do `DEFAULT_FOOTER`.

**Jedyna ścieżka twardej awarii:** `app/layout.tsx:17` `metadataBase: new URL(SITE_URL)`. Wartość pusta albo bez schematu → `TypeError [ERR_INVALID_URL]` przy generowaniu metadanych **każdej** trasy, łącznie z `/admin`. Redaktor nie ma wtedy jak cofnąć zmiany.

**Strategia fallbacku — trzy klasy pól, nie jedna reguła:**

- **Klasa A (tożsamość techniczna):** `adresStrony`, `ikonaStrony`, `identyfikatorKalendarza`, `emailAwaryjny` — zostają w kodzie/ENV, w panelu tylko do odczytu.
- **Klasa B (prezentacja: telefon, e-mail, adres sali, social, nazwy):** **żadnego scalania pole-po-polu.** `getOrganization()` zwraca cały obiekt albo `null`; konsumenci warunkują render (`{org?.telefon && …}`) — dokładnie tak, jak `components/Footer.tsx:36,47,58` robi już dziś z linkami social. Puste = puste.
- **Klasa C (finanse i rejestry: `numerKonta`, `numerKrs`, `nip`):** brak wiersza → widoczny komunikat „Dane w trakcie aktualizacji", **nigdy** wartość z kodu. Warunek konieczny: w tym samym commicie usunąć literał IBAN z `lib/editablePages.ts:121`, inaczej skasowanie wiersza w bazie podstawi stary numer w edytorze panelu, a redaktor zapisze go z powrotem.

**Implementacja odczytu:** `getOrganization()` owinięte w `cache()` (wzorzec z `lib/pageOverrides.ts:32`) + `AbortSignal.timeout(6000)` jak wszędzie. Zwracać `{ ok: boolean, data }`, żeby odróżnić martwą bazę od pustej zakładki. **Przy buildzie produkcyjnym z `ok === false` lepiej przerwać build niż wdrożyć serwis z pustą stopką, telefonem i JSON-LD** — cicho pusty kontakt jest gorszy niż nieudany deploy.

**Koszt odczytu:** dołożyć do istniejącego `Promise.all` w `app/layout.tsx:67`. Dzięki `cache()` wywołanie w `Footer` i w `StructuredData` deduplikuje się w obrębie renderu, więc propsy są konieczne wyłącznie dla `components/Navbar.tsx:1` (komponent kliencki) i `components/LocationMap.tsx:20` (synchroniczny).

## 3. Konflikt `footer` × `organization`

**Stan produkcji (odczytane z bazy):** wiersz `footer` zawiera `contact {addressLine1: "ul. Łąkowa 31, Kraków", addressLine2: "Szkoła Podstawowa nr 114", phone, phoneDisplay, email}`, `social {facebook, instagram, youtube}`, `copyright: "POLSKA ORGANIZACJA SHORINJI KEMPO."`, martwe `about`, 10 linków, 2 pliki, 4 dokumenty. W `site_settings` jest **7 wierszy**: `footer` + 6 × `page:*`. **Klucza `schedule` nie ma** (istotne dla punktu 6).

Tak, konflikt powstanie — i groźniejszy niż „dwa formularze". `lib/footerData.ts:19-27` scala z `DEFAULT_FOOTER` pole-po-polu, a `app/admin/(panel)/stopka/page.tsx:5` czyta **przez tę samą funkcję**, więc panel pokazuje wartość z kodu jako zapisaną.

**Migracja bez okna, w którym redaktor widzi dwa telefony:**

1. Snapshot `footer` i `page:cennik` do pliku (jedyne egzemplarze — patrz punkt 6).
2. Skrypt buduje `key='organization'` z: `footer.contact` + `footer.social` + `footer.copyright` → `nazwaWStopce`, z `lib/site.ts:17-31` (venue, region, countryCode) i z `page:cennik` blocks[16] (nazwa prawna, siedziba, IBAN). **Czytać z bazy, nie z prefillu.**
3. **Ten sam przebieg** usuwa z wiersza `footer` klucze `contact`, `social`, `copyright`, `about`. Zostają `links`, `downloads`, `documents`.
4. Deploy w tym samym oknie: `lib/footerTypes.ts:13-20` traci `contact`, `:8 social`, `:20 copyright`, `:7 about`; `lib/footerData.ts:19-27` traci te gałęzie scalania; z `components/admin/FooterEditor.tsx` znikają linie 117-136 (social) i 152-224 (kontakt + copyright); `components/Footer.tsx:35-69`, `:106-137`, `:143` biorą dane z propsa.

**Kolejność jest asymetryczna w skutkach:** kod przed migracją → stopka pusta przez chwilę (widoczne, odwracalne). Migracja przed kodem → `lib/footerData.ts:25` odtworzy `contact` z `DEFAULT_FOOTER` i stopka pokaże **stary** telefon jako aktualny (niewidoczne, najgorszy wariant). Na czas przejścia kod ma czytać `organization`, a przy jego braku `footer.contact` — i ten fallback usunąć w kolejnym wydaniu.

Osobno: `resetFooter()` (`actions/footerActions.ts:25-34`) kasuje cały wiersz `footer` jednym kliknięciem. Po zmianie nie może być ścieżką odzyskiwania danych organizacji.

Literały nazwy w samym panelu: `components/admin/AdminShell.tsx:63` i `app/admin/login/page.tsx:53`. Login jest poza layoutem panelu i jest komponentem klienckim — podpięcie wymaga osobnego serwerowego opakowania. Rekomendacja: zostawić literały świadomie i nie obiecywać w zakładce, że nazwa zmienia się „wszędzie".

## 4. Wyjęcie numeru konta z `page:cennik`

**Zweryfikowana struktura w produkcji:** 19 bloków. `blocks[15]` heading „Konto bankowe", `blocks[16]` callout z nazwą prawną + „ul. Wysłouchów 33/5, 30-611 Kraków" + „mBank: ==IBAN==", `blocks[17]` paragraph „**Uwaga!** W tytule przelewu…", `blocks[18]` paragraph z e-mailem. Treść `blocks[17]` w bazie **różni się** od prefillu w `lib/editablePages.ts:123-125` — potwierdza regułę „baza jest nowsza".

**Kolejność, przy której cennik ani przez chwilę nie traci informacji:**

1. Dodać typ `bank` do `lib/newsTypes.ts` i `case` w `components/NewsBlocks.tsx` obok linii 93-98, odtwarzając klasy `rounded-xl border border-yellow-500/40 bg-yellow-500/5 px-6 py-5` i numer w `text-yellow-500`. Znacznik `==…==` to wyłącznie styl (`components/NewsBlocks.tsx:28-33`) — odtwarzać klasę, nie znacznik.
2. **Wdrożyć sam renderer.** Jest wstecznie zgodny, stary callout renderuje się bez zmian. Dla odwiedzającego zero różnicy.
3. Dopiero potem skrypt migracyjny: znaleźć blok **po treści**, nie po indeksie — `b.type === 'callout' && /\d{2}(\s?\d{4}){6}/.test(b.text)` — bo redaktor może przestawić bloki między napisaniem a uruchomieniem skryptu. Rozparsowane części do `organization`, blok podmieniony na `{ type: 'bank' }` bez danych.
4. Weryfikacja: pobrać `/zajecia/cennik` i porównać wyrenderowany numer ze snapshotem. Dopiero wtedy usunąć literał z `lib/editablePages.ts:121`.
5. `blocks[17]` i `blocks[18]` zostawić na razie w spokoju — e-mail z `blocks[18]` zamienić na `{{email}}` osobnym krokiem, po powstaniu mechanizmu podstawień.
6. Rollback: oryginalny tekst callouta zapisać w `organization` pod `_migracja.cennikCalloutOryginal` — powrót to jeden UPDATE.

## 5. SITE_URL z panelu — pułapka, kategorycznie

- `app/layout.tsx:17` `new URL(SITE_URL)` — literówka bez schematu albo spacja na końcu wywala `TypeError` przy metadanych **każdej** trasy → 500 na całym serwisie razem z `/admin`. To jedyne pole w całym projekcie, którym redaktor kładzie stronę tak, że nie ma jak tego cofnąć.
- `app/robots.ts:10-11` i `app/sitemap.ts:34,45,57` to osobne wpisy tras — `revalidatePath('/', 'layout')` ich nie odświeży w oczywisty sposób. Efekt: robots.txt i sitemap.xml z jednym hostem, kanoniczne z drugim.
- Wszystkie `alternates.canonical` są względne (`app/kontakt/page.tsx:12`, `app/page.tsx:8`, `app/zajecia/cennik/page.tsx:10`, itd.) i rozwijają się po `metadataBase`. Zła wartość przepisuje kanoniczne całego serwisu naraz — podręcznikowy sposób na deindeksację.
- Wartość i tak musi być znana przy buildzie, bo `next build` prerenderuje. Wartość z bazy zadziałałaby dopiero po rewalidacji — czyli to, co redaktor widzi w panelu, i to, co faktycznie działa, rozjeżdżałoby się w czasie.

**Rekomendacja:** zostawić `process.env.NEXT_PUBLIC_SITE_URL` (`lib/site.ts:9-11`), w zakładce pokazać jako pole tylko do odczytu z adnotacją kto to zmienia. Przy okazji utwardzić `lib/site.ts`: `try { new URL(x) } catch { fallback + console.error }`, żeby literówka w ENV też nie zabijała builda.

## 6. Pola, których nie powinno być w panelu

1. **`adresStrony` / SITE_URL** — jak wyżej. Tylko do odczytu.
2. **`ikonaStrony`** — `app/icon.jpg` to konwencja plikowa; wartości nie da się zastosować bez commita. Pole, które nic nie robi, jest gorsze niż brak pola.
3. **`identyfikatorKalendarza`** — `app/api/schedule/[group]/calendar.ics/route.ts:66`. Zmiana duplikuje treningi u wszystkich, którzy pobrali plan. Tylko do odczytu.
4. **JSON-LD `@id`** — `components/StructuredData.tsx:63`. W ogóle nie pole; wyliczane z SITE_URL.
5. **`emailAwaryjny`** — `actions/contactActions.ts:50,63`. Musi zostać literałem, bo pokazuje się dokładnie wtedy, gdy baza nie żyje. Pokazać do odczytu z porównaniem do e-maila klubu i ostrzeżeniem przy rozjeździe — to mocny punkt projektu, zostawić.
6. **`logo` i `obrazUdostepniania`** — `components/Navbar.tsx:78-81` używa `next/image`, a `next.config.ts:20-27` dopuszcza **wyłącznie** `res.cloudinary.com`. Wolne pole tekstowe pozwoli wskazać nieistniejący plik albo zablokowany host → zepsuty obrazek w nagłówku każdej podstrony. Zamiast pola tekstowego: `components/admin/ImagePicker.tsx` (już istnieje) ograniczony do Cloudinary. Dodatkowo redaktor **nie może wgrywać plików** — `components/admin/FooterEditor.tsx:140` mówi to wprost.
7. **`nazwaSerwisu`** — dopuszczalne, ale z okienkiem potwierdzenia i twardą walidacją na niepustość: pusta wartość daje `"%s | "` w tytule każdej podstrony.
8. **`numerKonta`, `numerKrs`, `nip`, `regon`** — dopuszczalne wyłącznie z logiem zmian. W `supabase/setup.sql` `site_settings` nie ma kolumny `updated_by` — log wymaga nowej tabeli, `revalidatePath` go nie zastąpi.

## Ryzyka spoza pytań, które trafią w to wdrożenie

**Korekta projektu — `scripts/seed-content.mjs` nie cofa migracji.** Linie 241-273: skrypt uzupełnia tylko puste `title`/`lead`/`kicker` i tworzy wiersz wyłącznie gdy `!prev`. Realne ryzyko jest węższe, ale prawdziwe: gdy wiersz `page:kontakt` albo `page:zajecia-*` zniknie (`resetPageBlocks()` w `actions/pageActions.ts:74-87` jest wystawione w panelu), następne uruchomienie seeda **odtworzy go** z zaszytymi danymi z linii 131-132, 151, 180 — z pominięciem `organization`. Osobno: `page:cennik` **nie jest** w `NEW_PAGE_BLOCKS`, więc seed go nie odtworzy (linia 244, „POMINIĘTO") — skasowanie tego wiersza to bezpowrotna utrata bloku z kontem. Snapshot przed migracją obowiązkowy.

**Rozjazd prefillu i bazy jest potwierdzony.** `page:zajecia-dzieci` blocks[0] to blok `person` z rokiem urodzenia, numerem kenshi, telefonem i e-mailem; prefill w `lib/editablePages.ts:223-235` zaczyna się od `H("Zajęcia dla dorosłych")` i karty nie zawiera. `resetPageBlocks()` + otwarcie edytora = bezpowrotna utrata karty instruktora. Naprawić **przed** migracją, bo migracja dotyka tych wierszy.

**Zakres rewalidacji.** Akcja zapisu musi wołać `revalidatePath('/', 'layout')` **oraz** jawnie `/kontakt` (`app/kontakt/page.tsx:6`), `/zajecia/cennik` (`:4`), `/zajecia/dzieci` (`:16`), `/zajecia/dorosli` (`:16`) — wszystkie mają `revalidate = 300`. Niezależnie od tego `route.ts:140` ustawia `Cache-Control: public, max-age=300`, więc kopia .ics na CDN potrzyma stary adres przez 5 minut mimo rewalidacji.

**Harmonogram — okno zamyka się teraz.** W bazie **nie ma** klucza `schedule`, więc plan idzie z `data/schedule.ts:28-38`, gdzie `LOCATION` (`:25`) to **trzeci** zapis adresu sali: „ul. Łąkowa 31, Kraków – Szkoła Podstawowa nr 114". Pierwszy zapis w `components/admin/ScheduleEditor.tsx:159-164` zamrozi ten napis w bazie per slot, a stamtąd trafia do `.ics` (`route.ts:80`) i żyje w kalendarzach ćwiczących. Przerobić pole `Miejsce` na wartość domyślną z „Miejsca zajęć" **zanim** redaktor pierwszy raz otworzy zakładkę Harmonogram.

**Drobne, ale prawdziwe:** `components/StructuredData.tsx:83-87` zawsze wstawia 3 elementy do `sameAs` — przy danych z bazy filtrować puste; `:82 areaServed` ma literał „Kraków" obok `salaMiasto`; `app/zajecia/dorosli/page.tsx:62` i `app/zajecia/dzieci/page.tsx:62` mają zaszyty `mailto:` z zakodowanym `subject` (przy podmianie e-maila zachować kodowanie); `data/schedule.ts:40 CONTACT_EMAIL_FOR_SCHEDULE` nie ma żadnego konsumenta (potwierdzone grepem) — do usunięcia; `lib/footerTypes.ts:6-7 about` jest w bazie, ale nieużywane w `components/Footer.tsx`.
