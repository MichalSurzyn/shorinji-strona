import type { Metadata } from "next";
import { PageHeader, PageBody } from "@/components/PageContent";
import KafelkiPodstron from "@/components/KafelkiPodstron";
import { getDzieci, getStrona } from "@/lib/pages";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Program nauczania",
  description:
    "Materiały wideo Shorinji Kempo: kihon, kata, embu, randori. Tan'en Kihon Hokei – jednoosobowe i parami.",
  alternates: { canonical: "/program-nauczania" },
};

/**
 * Podstrony tej strony jako kafelki.
 *
 * Ta trasa ma własny plik (układ z kodu), a kafelki podstron rysowała dotąd
 * WYŁĄCZNIE trasa catch-all — czyli strony z drzewa. Skutek: klient dodał
 * osiem podstron Programu nauczania i na `/program-nauczania` nie było
 * z nich ani jednej. Kafelki są tu więc dołożone jawnie.
 *
 * Błąd odczytu drzewa NIE może wywrócić strony: treść z `PageBody` jest
 * najważniejszą częścią tej trasy i ma się pokazać nawet wtedy, gdy lista
 * podstron się nie wczyta. Dlatego pusta tablica zamiast wyjątku.
 */
async function podstrony() {
  try {
    const wezel = await getStrona("/program-nauczania");
    if (!wezel) return [];
    const dzieci = await getDzieci(wezel.id);
    return dzieci
      .filter((d) => d.full_path)
      .map((d) => ({ href: d.full_path as string, title: d.title, intro: d.intro }));
  } catch (e) {
    console.warn("[program-nauczania] lista podstron:", e);
    return [];
  }
}

export default async function ProgramNauczaniaPage() {
  const items = await podstrony();
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative">
        {/* Nagłówek i treść z bazy (panel → Strony i menu → Program nauczania) */}
        <PageHeader slug="program-nauczania" />
        <PageBody slug="program-nauczania" />
        <KafelkiPodstron className="mt-12" items={items} />
      </div>
    </div>
  );
}
