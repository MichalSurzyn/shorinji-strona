/**
 * Dane podmiotu - jedno źródło prawdy dla całego serwisu.
 *
 * Zapis: site_settings.key = "organization", kolumna value (jsonb).
 * Edycja: panel → Dane organizacji.
 *
 * Dotąd te same informacje żyły w trzech niezależnych miejscach: lib/site.ts
 * (kod, nieedytowalne), site_settings.footer (baza) i w treści strony Kontakt
 * jako bloki. Zmiana telefonu w panelu poprawiała stopkę, a mapa, dane
 * strukturalne dla Google i metadane pokazywały dalej stary numer.
 *
 * ZASADA: puste pole oznacza „redaktor tego nie podał" i konsument ma pominąć
 * element, a nie podstawić wartość z kodu. Wartości z DEFAULT_ORGANIZATION
 * służą wyłącznie jako punkt startowy przy pierwszym zapisie i jako awaryjny
 * komplet, gdy baza nie odpowiada.
 */

export interface OrgAdres {
  /** Ulica z numerem, np. „ul. Łąkowa 31". */
  ulica: string;
  /** Wzorzec 00-000. */
  kodPocztowy: string;
  miasto: string;
  /** Województwo - trafia do danych strukturalnych (addressRegion). */
  wojewodztwo: string;
  /** Kod kraju wg ISO 3166-1, dwie litery. */
  kodKraju: string;
}

export interface OrgNazwy {
  /** Krótka nazwa serwisu: tytuły kart, Open Graph, dane strukturalne. */
  serwis: string;
  /** Pełna nazwa z rejestru, razem z cudzysłowami. */
  prawna: string;
  /** Skrót, np. „POSK". */
  skrocona: string;
  /** Wersja po znaku © w stopce. Bez roku - rok dokleja stopka. */
  wStopce: string;
  /** Opis serwisu: metadane, Open Graph, dane strukturalne. */
  opis: string;
}

export interface OrgKontakt {
  /** Numer w formacie E.164, np. „+48792995510". Postać do wyświetlenia
   *  generuje formatTelefon() - nie ma osobnego pola, żeby nie rozjechały się
   *  dwie wersje tego samego numeru. */
  telefon: string;
  email: string;
}

export interface OrgMiejsceZajec {
  /** Pełna nazwa obiektu, np. „Szkoła Podstawowa nr 114 im. Arkadego Fiedlera". */
  nazwaPelna: string;
  adres: OrgAdres;
}

export interface OrgSiedziba {
  adres: OrgAdres;
  /** Nazwa sądu rejestrowego, wymagana w informacji dla stowarzyszeń. */
  sadRejestrowy: string;
}

export interface OrgRejestr {
  /** 10 cyfr jako tekst - wiodące zera są istotne. */
  krs: string;
  /** 10 cyfr, bez myślników. */
  nip: string;
  /** 9 albo 14 cyfr. */
  regon: string;
}

export interface OrgSocial {
  /** Puste pole ukrywa ikonę w stopce i wypada z danych strukturalnych. */
  facebook: string;
  instagram: string;
  youtube: string;
}

export interface OrgBank {
  /** Nazwa wpisywana w polu odbiorcy przelewu. */
  odbiorca: string;
  /** IBAN znormalizowany: wielkie litery, bez spacji, z kodem kraju. */
  iban: string;
  nazwaBanku: string;
  /** Zdanie o tytule przelewu. Obsługuje formatowanie inline. */
  wzorTytulu: string;
}

export interface OrganizationData {
  nazwy: OrgNazwy;
  kontakt: OrgKontakt;
  miejsceZajec: OrgMiejsceZajec;
  siedziba: OrgSiedziba;
  rejestr: OrgRejestr;
  social: OrgSocial;
  bank: OrgBank;
  /** Skrzynka do spraw danych osobowych. Puste = używany kontakt.email. */
  emailDaneOsobowe: string;
}

/**
 * Wartości startowe przepisane 1:1 z dzisiejszego kodu i treści w bazie.
 * Dane rejestrowe są puste - nie ma ich nigdzie w projekcie i musi je podać klub.
 */
export const DEFAULT_ORGANIZATION: OrganizationData = {
  nazwy: {
    serwis: "Shorinji Kempo Kraków",
    prawna: 'Stowarzyszenie „Polska Organizacja Shorinji Kempo"',
    skrocona: "POSK",
    wStopce: "POLSKA ORGANIZACJA SHORINJI KEMPO.",
    opis:
      "Krakowskie dōjō Shorinji Kempo. Japońska sztuka walki łącząca skuteczną samoobronę, rozwój duchowy i zdrowie. Zajęcia dla dzieci i dorosłych na Prądniku Czerwonym.",
  },
  kontakt: {
    telefon: "+48792995510",
    email: "pl.shorinjikempo@gmail.com",
  },
  miejsceZajec: {
    nazwaPelna: "Szkoła Podstawowa nr 114 im. Arkadego Fiedlera",
    adres: {
      ulica: "ul. Łąkowa 31",
      kodPocztowy: "31-443",
      miasto: "Kraków",
      wojewodztwo: "małopolskie",
      kodKraju: "PL",
    },
  },
  siedziba: {
    adres: {
      ulica: "ul. Wysłouchów 33/5",
      kodPocztowy: "30-611",
      miasto: "Kraków",
      wojewodztwo: "małopolskie",
      kodKraju: "PL",
    },
    sadRejestrowy: "",
  },
  rejestr: { krs: "", nip: "", regon: "" },
  social: {
    facebook: "https://www.facebook.com/shorinjikempopolska",
    instagram: "https://www.instagram.com/shorinjikempopolska/",
    youtube: "https://www.youtube.com/@Dominik_Chowanski",
  },
  bank: {
    odbiorca: 'Stowarzyszenie „Polska Organizacja Shorinji Kempo"',
    iban: "PL53114020040000350274971466",
    nazwaBanku: "mBank",
    wzorTytulu:
      "W tytule przelewu prosimy podać imię, nazwisko oraz cel wpłaty (np. składka – kwiecień 2026, egzamin 5 Kyu).",
  },
  emailDaneOsobowe: "",
};

/* ---------------------------------------------------------------- */
/*  Pomocnicze formatowanie i kontrola poprawności                   */
/* ---------------------------------------------------------------- */

/**
 * Usuwa spacje i znaki rozdzielające, podnosi litery.
 *
 * Polski numer rachunku (NRB) ma 26 cyfr i tak właśnie widnieje na
 * dokumentach oraz w bankowości - bez przedrostka „PL". Redaktor przepisze
 * go dokładnie w tej postaci, więc sami dokładamy kod kraju. Bez tego
 * poprawny numer byłby odrzucany jako błędny, co jest gorsze niż brak
 * kontroli: uczy ignorowania ostrzeżeń.
 */
export function normalizujIban(wejscie: string): string {
  const czysty = wejscie.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{26}$/.test(czysty)) return `PL${czysty}`;
  return czysty;
}

/**
 * Kontrola sumy kontrolnej IBAN (ISO 13616, reszta modulo 97).
 *
 * Numer konta to najdroższy w skutkach ciąg znaków na całej stronie -
 * literówka oznacza pieniądze przelane na cudze konto. Dotąd siedział
 * w treści cennika jako zwykły akapit, bez żadnej kontroli.
 *
 * Algorytm: przenosimy cztery pierwsze znaki na koniec, zamieniamy litery
 * na liczby (A=10 … Z=35) i sprawdzamy, czy reszta z dzielenia przez 97
 * wynosi 1. Dzielimy fragmentami, bo liczba nie mieści się w typie number.
 */
export function czyPoprawnyIban(wejscie: string): boolean {
  const iban = normalizujIban(wejscie);
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(iban)) return false;
  const przestawiony = iban.slice(4) + iban.slice(0, 4);
  let reszta = 0;
  for (const znak of przestawiony) {
    const wartosc = /\d/.test(znak) ? znak : String(znak.charCodeAt(0) - 55);
    for (const cyfra of wartosc) reszta = (reszta * 10 + Number(cyfra)) % 97;
  }
  return reszta === 1;
}

/**
 * Numer konta do wyświetlenia.
 *
 * Dla rachunku polskiego zdejmujemy przedrostek „PL" i grupujemy w układzie
 * 2-4-4-4-4-4-4, czyli tak, jak numer widnieje na przelewach i jak go
 * rozpoznaje wpłacający. Uniwersalne grupowanie po cztery dałoby
 * 4-4-4-4-4-4-2 - te same cyfry, ale obcy kształt, przy którym łatwiej
 * o pomyłkę przy przepisywaniu.
 *
 * Rachunki zagraniczne zostają w zapisie międzynarodowym: kod kraju
 * i grupy po cztery znaki.
 */
export function formatIban(iban: string): string {
  const czysty = normalizujIban(iban);
  if (/^PL\d{26}$/.test(czysty)) {
    const cyfry = czysty.slice(2);
    return `${cyfry.slice(0, 2)} ${cyfry.slice(2).replace(/(.{4})/g, "$1 ")}`.trim();
  }
  return czysty.replace(/(.{4})/g, "$1 ").trim();
}

/** Telefon do wyświetlenia: „+48 792 99 55 10". */
export function formatTelefon(telefon: string): string {
  const czysty = telefon.replace(/[\s-]/g, "");
  const m = czysty.match(/^\+48(\d{3})(\d{2})(\d{2})(\d{2})$/);
  return m ? `+48 ${m[1]} ${m[2]} ${m[3]} ${m[4]}` : telefon;
}

/** Pełny adres w jednej linii - do map i danych strukturalnych. */
export function pelnyAdres(a: OrgAdres): string {
  return [a.ulica, `${a.kodPocztowy} ${a.miasto}`.trim()].filter(Boolean).join(", ");
}

/** Kontrola sumy dla NIP (10 cyfr). Puste pole jest dozwolone. */
export function czyPoprawnyNip(nip: string): boolean {
  const c = nip.replace(/[\s-]/g, "");
  if (!c) return true;
  if (!/^\d{10}$/.test(c)) return false;
  const wagi = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  const suma = wagi.reduce((s, w, i) => s + w * Number(c[i]), 0);
  return suma % 11 === Number(c[9]);
}
