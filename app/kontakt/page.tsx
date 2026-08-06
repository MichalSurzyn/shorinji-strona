import type { Metadata } from "next";
import { PageHeader, PageBody } from "@/components/PageContent";
import ContactForm from "@/components/ContactForm";
import LocationMap from "../../components/LocationMap";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Kontakt",
  description:
    "Skontaktuj się z krakowskim dōjō Shorinji Kempo. Adres treningów (ul. Łąkowa 31, Kraków), telefon, e-mail i mapa dojazdu.",
  alternates: { canonical: "/kontakt" },
};

export default function KontaktPage() {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">

        {/* Nagłówek i treść z bazy (panel → Strony → Kontakt) */}
        <PageHeader slug="kontakt" />

        {/* Formularz jako pierwszy - najczęstszy cel wejścia na tę stronę */}
        <ContactForm source="kontakt" className="mb-14" />

        <LocationMap heading="Jak do nas trafić" className="mb-14" />

        <PageBody slug="kontakt" />
      </div>
    </div>
  );
}
