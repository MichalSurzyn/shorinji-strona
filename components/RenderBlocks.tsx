import NewsBlocks from "@/components/NewsBlocks";
import { getOrganization } from "@/lib/organization";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Bloki treści RAZEM z danymi, których same bloki nie noszą.
 *
 * PO CO TO ISTNIEJE
 * -----------------
 * Dwa typy bloków nie mają w sobie własnych danych, tylko wskazują na zakładkę
 * „Dane organizacji": `bank` (numer konta) i `kontakt` (telefon, e-mail,
 * profile). `NewsBlocks` dostaje je propsami, a gdy ich nie dostanie, oba
 * kończą się `return null` — w `NewsBlocks.tsx`, gałęzie `case "kontakt"`
 * i `case "bank"`. Bez numerów linii świadomie: rozjeżdżają się przy każdej
 * edycji tamtego pliku. Nie błędem, nie ostrzeżeniem w konsoli: NICZYM.
 *
 * Do tej pory jedynym miejscem, które te propsy podawało, był `PageContent`
 * (osiem tras o stałym układzie). Trzy pozostałe miejsca renderujące bloki —
 * `app/[...sciezka]` (strony z drzewa), `ArticlePage` (podstrony tematyczne)
 * i `app/aktualnosci/[slug]` (wpisy) — wołały `NewsBlocks` bez nich. Redaktor
 * mógł więc wstawić na stronie z drzewa blok „numer konta", zapisać, dostać
 * „Zapisane." i zobaczyć stronę bez tej sekcji, bez żadnej wskazówki dlaczego.
 *
 * Dlatego dociąganie danych siedzi TUTAJ, w jednym miejscu, a nie w czterech
 * plikach tras. Każdy następny blok tego rodzaju (etap 9 dokłada m.in. mapę
 * i grafik) wpadałby dokładnie w tę samą dziurę osobno w każdym z nich.
 *
 * `getOrganization()` jest owinięte w `cache()`, więc powtórzenie w obrębie
 * jednego renderu nic nie kosztuje — a pytamy tylko wtedy, gdy strona
 * faktycznie ma blok, który tych danych potrzebuje.
 */
export default async function RenderBlocks({ blocks }: { blocks: NewsBlock[] }) {
  const potrzebneDane = blocks.some((b) => b.type === "bank" || b.type === "kontakt");
  const org = potrzebneDane ? await getOrganization() : null;

  // DRUGA POŁOWA tej samej cichej dziury: props już lecą, ale blok „bank"
  // nadal renderuje pustkę, gdy numer konta w „Danych organizacji" jest pusty
  // (renderer sprawdza `!bank.iban`). Dla redaktora wygląda to identycznie jak
  // przed poprawką — sekcji nie ma i nie wiadomo dlaczego. Ślad w logu serwera
  // jest jedyną wskazówką, jaką da się tu zostawić: strony nie chcemy wywalać,
  // a wypisanie ramki „brak numeru konta" pokazałoby brak danych odwiedzającym.
  if (blocks.some((b) => b.type === "bank") && !org?.bank?.iban) {
    console.warn(
      "[RenderBlocks] Strona ma blok „numer konta”, ale w Danych organizacji nie ma IBAN-u — " +
        "sekcja nie zostanie wyrenderowana.",
    );
  }

  return (
    <NewsBlocks
      blocks={blocks}
      bank={org?.bank}
      kontakt={org ? { kontakt: org.kontakt, social: org.social } : undefined}
    />
  );
}
