import type { Metadata } from "next";
import { PageHeader, PageBody } from "@/components/PageContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Cennik",
  description:
    "Lista opłat obowiązująca do 31 marca 2030 – składki, egzaminy na stopnie Kyu i Dan, opłaty organizacyjne.",
  alternates: { canonical: "/zajecia/cennik" },
};

export default function CennikPage() {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        {/* Całość z bazy (panel → Strony → Cennik) */}
        <PageHeader slug="cennik" className="mb-12" />
        <PageBody slug="cennik" />
      </div>
    </div>
  );
}
