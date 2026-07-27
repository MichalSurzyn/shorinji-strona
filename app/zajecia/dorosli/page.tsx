import type { Metadata } from "next";
import Link from "next/link";
import ScheduleWeek from "../../../components/ScheduleWeek";
import LocationMap from "../../../components/LocationMap";
import ContactForm from "@/components/ContactForm";
import { PageHeader, PageBody } from "@/components/PageContent";
import { getSchedule } from "@/lib/schedule";

export const metadata: Metadata = {
  title: "Grupa dorosła (Filia Kraków)",
  description:
    "Zajęcia dla młodzieży i dorosłych w krakowskiej filii Shorinji Kempo prowadzone przez Shibucho Dominika Chowańskiego.",
  alternates: { canonical: "/zajecia/dorosli" },
};

export const revalidate = 300;

export default async function ZajeciaDorosliPage() {
  const slots = await getSchedule();
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">

        {/* Nagłówek + karta instruktora + opis zajęć - w całości z bazy
            (panel → Strony → Zajęcia dorośli; karta to blok "Osoba"). */}
        <PageHeader slug="zajecia-dorosli" />
        <section className="mb-14">
          <PageBody slug="zajecia-dorosli" />
        </section>

        {/* Tygodniowy plan zajęć */}
        <ScheduleWeek group="dorosli" slots={slots} />

        {/* Formularz kontaktowy między planem a mapą */}
        <ContactForm source="zajecia-dorosli" className="mb-12" />

        <LocationMap heading="Lokalizacja i dojazd" showContact={false} className="mb-12" />

        {/* CTA na dole */}
        <aside className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            href="/zajecia/cennik"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Cennik
            </div>
            <div className="mt-1 font-semibold text-neutral-300">Składki i opłaty →</div>
          </Link>
          <Link
            href="/downloads/deklaracja-dorosli.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Deklaracja członkowska
            </div>
            <div className="mt-1 font-semibold text-neutral-300">Pobierz PDF (dorośli) →</div>
          </Link>
          <a
            href="mailto:pl.shorinjikempo@gmail.com?subject=Zapis%20na%20zaj%C4%99cia%20%E2%80%94%20grupa%20doros%C5%82a"
            className="rounded-xl border border-yellow-500/60 bg-yellow-500/5 hover:bg-yellow-500/10 transition-colors px-5 py-4"
          >
            <div className="text-xs uppercase tracking-wider text-yellow-500">
              Kontakt
            </div>
            <div className="mt-1 font-semibold text-neutral-300">Napisz do nas →</div>
          </a>
        </aside>

      </div>
    </div>
  );
}
