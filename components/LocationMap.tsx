import {
  CONTACT,
  FULL_ADDRESS,
  MAPS_EMBED_URL,
  MAPS_LINK_URL,
} from "../lib/site";

type Props = {
  /** Nagłówek nad mapą. Gdy pominięty, sekcja nie ma tytułu. */
  heading?: string;
  /** Pokaż telefon i e-mail obok mapy (domyślnie tak). */
  showContact?: boolean;
  className?: string;
};

/**
 * Sekcja z osadzoną mapą Google (bez klucza API) oraz adresem i linkiem
 * do nawigacji. Używana na podstronie kontakt i na stronach zajęć.
 */
export default function LocationMap({
  heading,
  showContact = true,
  className = "",
}: Props) {
  return (
    <section className={className}>
      {heading && (
        <h2 className="mb-5 text-2xl md:text-3xl font-semibold text-white tracking-wide">
          {heading}
        </h2>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-stretch">
        {/* Mapa */}
        <div className="relative aspect-[16/10] lg:aspect-auto lg:min-h-[320px] overflow-hidden rounded-xl border border-yellow-500/30">
          <iframe
            title={`Mapa dojazdu – ${CONTACT.venue}`}
            src={MAPS_EMBED_URL}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>

        {/* Adres i kontakt */}
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 p-6 flex flex-col">
          <p className="text-yellow-500 text-xs uppercase tracking-[0.16em] font-semibold mb-3">
            Gdzie trenujemy
          </p>
          <address className="not-italic text-neutral-200 leading-relaxed">
            <span className="block font-medium text-white">{CONTACT.venue}</span>
            <span className="block">{CONTACT.street}</span>
            <span className="block">
              {CONTACT.postalCode} {CONTACT.city}
            </span>
          </address>

          {showContact && (
            <div className="mt-4 space-y-1 text-sm">
              <a
                href={`tel:${CONTACT.phone}`}
                className="block text-neutral-300 hover:text-yellow-500 transition-colors"
              >
                {CONTACT.phoneDisplay}
              </a>
              <a
                href={`mailto:${CONTACT.email}`}
                className="block text-neutral-300 hover:text-yellow-500 transition-colors break-all"
              >
                {CONTACT.email}
              </a>
            </div>
          )}

          <a
            href={MAPS_LINK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-semibold text-yellow-500 hover:text-yellow-400 transition-colors"
            aria-label={`Wyznacz trasę do ${FULL_ADDRESS}`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            Wyznacz trasę →
          </a>
        </div>
      </div>
    </section>
  );
}
