import type { Metadata } from "next";
import ArticleListing from "../../components/ArticleListing";
import { o_shorinji } from "../../data/articles/o-shorinji";
import { daneListingu, metadaneListingu } from "../../lib/listingi";

// ISR - kafelki biorą tytuł i wstęp z drzewa stron, więc strona musi się
// odświeżać. Bez tego zbudowałaby się raz i zmiana z panelu nigdy by tu
// nie dotarła.
export const revalidate = 3600;

// generateMetadata, a NIE statyczny `export const metadata`: statycznego nie da
// się uzależnić od odczytu z bazy, więc zmiana tytułu w panelu nie trafiałaby
// do <title> ani do opisu w wynikach wyszukiwania. Przy okazji dochodzi
// brakujący canonical - pomiar w golden masterze pokazał, że nie ma go
// na żadnym z trzech listingów.
export async function generateMetadata(): Promise<Metadata> {
  return metadaneListingu("/o-shorinji", o_shorinji);
}

export default async function OShorinjiPage() {
  const dane = await daneListingu("/o-shorinji", o_shorinji);
  return <ArticleListing {...dane} />;
}
