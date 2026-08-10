import { SITE_URL } from "../lib/site";
import { getOrganization } from "../lib/organization";
import { pelnyAdres } from "../lib/organizationTypes";
import type { ScheduleSlot } from "../data/schedule";

const ISO_DAY_TO_SCHEMA: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

/**
 * Buduje listę godzin otwarcia (treningów) na podstawie planu zajęć.
 * Dla każdego dnia bierze najwcześniejszy start i najpóźniejszy koniec.
 */
function openingHours(slots: ScheduleSlot[]) {
  const byDay = new Map<number, { start: string; end: string }>();
  for (const slot of slots) {
    const current = byDay.get(slot.day);
    if (!current) {
      byDay.set(slot.day, { start: slot.start, end: slot.end });
    } else {
      byDay.set(slot.day, {
        start: slot.start < current.start ? slot.start : current.start,
        end: slot.end > current.end ? slot.end : current.end,
      });
    }
  }
  return [...byDay.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([day, { start, end }]) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${ISO_DAY_TO_SCHEMA[day]}`,
      opens: start,
      closes: end,
    }));
}

/**
 * Dane strukturalne JSON-LD dla wyszukiwarek (lokalne SEO).
 * Renderowane site-wide w layout, opisuje krakowskie dōjō jako
 * SportsActivityLocation (podtyp LocalBusiness).
 *
 * Nazwa, opis, kontakt, adres sali i profile społecznościowe pochodzą
 * z danych organizacji (panel). `slots` przekazuje layout z getSchedule().
 *
 * Adres strony (SITE_URL) zostaje zmienną środowiskową - musi być znany
 * przy budowaniu, a błędna wartość wpisana w panelu przepisałaby adresy
 * kanoniczne całego serwisu.
 */
export default async function StructuredData({ slots }: { slots: ScheduleSlot[] }) {
  const org = await getOrganization();
  const { adres } = org.miejsceZajec;
  const logo = `${SITE_URL}/SOEN.jpg`;

  // Puste pole w panelu znaczy „nie podano" - takie klucze pomijamy,
  // zamiast wysyłać wyszukiwarkom pustą wartość.
  const sameAs = [org.social.facebook, org.social.instagram, org.social.youtube].filter(Boolean);

  const data = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${SITE_URL}/#dojo`,
    name: org.nazwy.serwis,
    ...(org.nazwy.prawna ? { legalName: org.nazwy.prawna } : {}),
    ...(org.nazwy.opis ? { description: org.nazwy.opis } : {}),
    url: SITE_URL,
    ...(org.kontakt.telefon ? { telephone: org.kontakt.telefon } : {}),
    ...(org.kontakt.email ? { email: org.kontakt.email } : {}),
    logo,
    image: logo,
    sport: "Shorinji Kempo",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      ...(org.miejsceZajec.nazwaPelna ? { name: org.miejsceZajec.nazwaPelna } : {}),
      streetAddress: adres.ulica,
      addressLocality: adres.miasto,
      postalCode: adres.kodPocztowy,
      addressRegion: adres.wojewodztwo,
      addressCountry: adres.kodKraju,
    },
    ...(adres.miasto ? { areaServed: { "@type": "City", name: adres.miasto } } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    openingHoursSpecification: openingHours(slots),
    ...(pelnyAdres(adres) ? { hasMap: `https://www.google.com/maps?q=${encodeURIComponent(pelnyAdres(adres))}` } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify jest bezpieczne dla danych strukturalnych (brak treści od użytkownika).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
