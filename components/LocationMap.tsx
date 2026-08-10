import { getOrganization } from "../lib/organization";
import { formatTelefon, pelnyAdres } from "../lib/organizationTypes";

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
 *
 * Adres i kontakt pochodzą z danych organizacji (panel → Dane organizacji).
 * Wcześniej komponent importował je z lib/site.ts, czyli z kodu - zmiana
 * numeru w panelu poprawiała stopkę, a mapa i adres obok niej pokazywały
 * dalej stary. Adresu sali nie dało się zmienić z panelu w ogóle.
 */
export default async function LocationMap({
  heading,
  showContact = true,
  className = "",
}: Props) {
  const org = await getOrganization();
  const { nazwaPelna, adres } = org.miejsceZajec;
  const adresJednymCiagiem = [nazwaPelna, pelnyAdres(adres)].filter(Boolean).join(", ");
  const zapytanie = encodeURIComponent(adresJednymCiagiem);

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
            title={`Mapa dojazdu – ${nazwaPelna || adresJednymCiagiem}`}
            src={`https://www.google.com/maps?q=${zapytanie}&output=embed`}
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
            {nazwaPelna && (
              <span className="block font-medium text-white">{nazwaPelna}</span>
            )}
            {adres.ulica && <span className="block">{adres.ulica}</span>}
            {(adres.kodPocztowy || adres.miasto) && (
              <span className="block">
                {adres.kodPocztowy} {adres.miasto}
              </span>
            )}
          </address>

          {showContact && (
            <div className="mt-4 space-y-1 text-sm">
              {/* Puste pole w panelu = odnośnik się nie pokazuje. */}
              {org.kontakt.telefon && (
                <a
                  href={`tel:${org.kontakt.telefon}`}
                  className="block text-neutral-300 hover:text-yellow-500 transition-colors"
                >
                  {formatTelefon(org.kontakt.telefon)}
                </a>
              )}
              {org.kontakt.email && (
                <a
                  href={`mailto:${org.kontakt.email}`}
                  className="block text-neutral-300 hover:text-yellow-500 transition-colors break-all"
                >
                  {org.kontakt.email}
                </a>
              )}
            </div>
          )}

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${zapytanie}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-auto pt-5 inline-flex items-center gap-2 text-sm font-semibold text-yellow-500 hover:text-yellow-400 transition-colors"
            aria-label={`Wyznacz trasę do ${adresJednymCiagiem}`}
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
