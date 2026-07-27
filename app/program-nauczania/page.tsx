import type { Metadata } from "next";
import { PageHeader, PageBody } from "@/components/PageContent";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Program nauczania",
  description:
    "Materiały wideo Shorinji Kempo: kihon, kata, embu, randori. Tan'en Kihon Hokei – jednoosobowe i parami.",
  alternates: { canonical: "/program-nauczania" },
};

export default function ProgramNauczaniaPage() {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        {/* Całość z bazy (panel → Strony → Program nauczania) */}
        <PageHeader slug="program-nauczania" />
        <PageBody slug="program-nauczania" />
      </div>
    </div>
  );
}
