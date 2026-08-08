import {
  CONTACT,
  SITE_NAME,
  SITE_URL,
  SITE_DESCRIPTION,
  SOCIAL_LINKS,
} from "../lib/site";
import type { ScheduleSlot } from "../data/schedule";

const LOGO_URL = `${SITE_URL}/SOEN.jpg`;

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
 * `slots` przekazuje layout z getSchedule(), czyli z harmonogramu
 * zapisanego w panelu. Wcześniej komponent importował SCHEDULE wprost
 * z kodu i godziny podawane wyszukiwarkom rozjeżdżały się z tymi,
 * które widział odwiedzający po edycji planu w panelu.
 */
export default function StructuredData({ slots }: { slots: ScheduleSlot[] }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "SportsActivityLocation",
    "@id": `${SITE_URL}/#dojo`,
    name: SITE_NAME,
    alternateName: "Polska Organizacja Shorinji Kempo – filia Kraków",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    telephone: CONTACT.phone,
    email: CONTACT.email,
    logo: LOGO_URL,
    image: LOGO_URL,
    sport: "Shorinji Kempo",
    priceRange: "$$",
    address: {
      "@type": "PostalAddress",
      streetAddress: CONTACT.street,
      addressLocality: CONTACT.city,
      postalCode: CONTACT.postalCode,
      addressRegion: CONTACT.region,
      addressCountry: CONTACT.countryCode,
    },
    areaServed: { "@type": "City", name: "Kraków" },
    sameAs: [
      SOCIAL_LINKS.facebook,
      SOCIAL_LINKS.instagram,
      SOCIAL_LINKS.youtube,
    ],
    openingHoursSpecification: openingHours(slots),
  };

  return (
    <script
      type="application/ld+json"
      // JSON.stringify jest bezpieczne dla danych strukturalnych (brak treści od użytkownika).
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
