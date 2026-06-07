// Wspólne dane strony używane przez metadane, dane strukturalne (JSON-LD),
// stopkę, mapę i podstronę kontakt. Jedno źródło prawdy.

/**
 * Adres produkcyjny strony. Po przeniesieniu na docelowy hosting ustaw
 * NEXT_PUBLIC_SITE_URL w zmiennych środowiskowych (np. https://shorinjikempo.pl),
 * a wszystkie kanoniczne adresy, sitemap i Open Graph zaktualizują się same.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
  "https://shorinji-kempo.netlify.app";

export const SITE_NAME = "Shorinji Kempo Kraków";
export const SITE_DESCRIPTION =
  "Krakowskie dōjō Shorinji Kempo. Japońska sztuka walki łącząca skuteczną samoobronę, rozwój duchowy i zdrowie. Zajęcia dla dzieci i dorosłych na Prądniku Czerwonym.";

export const CONTACT = {
  /** Nazwa miejsca, w którym odbywają się treningi. */
  venue: "Szkoła Podstawowa nr 114 im. Arkadego Fiedlera",
  street: "ul. Łąkowa 31",
  postalCode: "31-443",
  city: "Kraków",
  region: "małopolskie",
  countryCode: "PL",
  /** Telefon w formacie międzynarodowym (E.164) do linków tel:. */
  phone: "+48792995510",
  phoneDisplay: "+48 792 99 55 10",
  email: "pl.shorinjikempo@gmail.com",
} as const;

/** Pełny adres jednolinijkowy (np. do zapytania o mapę). */
export const FULL_ADDRESS = `${CONTACT.venue}, ${CONTACT.street}, ${CONTACT.postalCode} ${CONTACT.city}`;

export const SOCIAL_LINKS = {
  facebook: "https://www.facebook.com/shorinjikempopolska",
  instagram: "https://www.instagram.com/shorinjikempopolska/",
  youtube: "https://www.youtube.com/@Dominik_Chowanski",
} as const;

/** Mapa Google osadzana w iframe – nie wymaga klucza API. */
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(
  FULL_ADDRESS,
)}&output=embed`;

/** Link otwierający mapę / nawigację w nowej karcie. */
export const MAPS_LINK_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  FULL_ADDRESS,
)}`;
