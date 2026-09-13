import Link from "next/link";

/**
 * Kafelki podstron — jeden renderer dla wszystkich stron-hubów.
 *
 * PO CO OSOBNY KOMPONENT
 * ----------------------
 * Ten sam markup istniał w DWÓCH kopiach: w `ArticleListing` (listingi
 * tematyczne `/o-shorinji`, `/organizacja`, `/buddyzm`) i w `WidokStrony`
 * w trasie catch-all (strony z drzewa). Identyczne klasy, identyczna numeracja,
 * dwa miejsca do poprawienia przy każdej zmianie wyglądu — a rozjazd między
 * nimi byłby widoczny dopiero wtedy, gdy ktoś porówna dwie strony obok siebie.
 *
 * Trzecim odbiorcą jest `/program-nauczania`. Ta trasa renderuje treść
 * z `site_settings` (`PageHeader`/`PageBody`) i do etapu F nie pokazywała
 * podstron WCALE — kafelki rysowała wyłącznie trasa catch-all, a `/program-nauczania`
 * obsługuje własny plik. Klient dodał tam osiem podstron i nie zobaczyłby
 * z nich ani jednej.
 */

export interface KafelekPodstrony {
  href: string;
  title: string;
  intro?: string | null;
}

export default function KafelkiPodstron({
  items,
  className = "",
}: {
  items: KafelekPodstrony[];
  className?: string;
}) {
  if (!items.length) return null;
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 ${className}`}>
      {items.map((a, idx) => (
        <Link
          key={a.href}
          href={a.href}
          className="group flex flex-col rounded-xl border border-yellow-500/40 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500 transition-colors p-6"
        >
          <div className="text-xs uppercase tracking-[0.14em] text-yellow-500/80 group-hover:text-yellow-500 font-semibold mb-3">
            {String(idx + 1).padStart(2, "0")}
          </div>
          <h2 className="text-xl md:text-2xl font-semibold text-white mb-3 tracking-wide">
            {a.title}
          </h2>
          {a.intro && (
            <p className="text-sm text-neutral-400 leading-relaxed flex-1">{a.intro}</p>
          )}
          <div className="mt-5 text-xs uppercase tracking-wider text-yellow-500 group-hover:text-yellow-400 transition-colors">
            Czytaj →
          </div>
        </Link>
      ))}
    </div>
  );
}
