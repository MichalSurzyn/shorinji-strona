import type { Metadata } from "next";
import { getDzieci, getStrona, kafelkiWidoczne } from "./pages";
import type { ArticleGroup } from "../data/articles/types";
import type { KafelekListingu } from "../components/ArticleListing";

/**
 * Wspólna warstwa dla trzech stron-hubów: /o-shorinji, /organizacja, /buddyzm.
 *
 * Wszystkie trzy były identyczne co do znaku poza nazwą grupy, więc trzy kopie
 * tej samej logiki znaczyłyby trzy miejsca do poprawienia przy każdej zmianie —
 * i pewność, że któreś zostanie pominięte.
 *
 * ŹRÓDŁEM SĄ DZIECI WĘZŁA W `pages`, NIE `data/articles`
 * ------------------------------------------------------
 * Dzięki temu podstrona dołożona w panelu pokazuje się na kafelkach od razu.
 * Przy `data/articles` trzeba by ją dopisać w kodzie i wdrożyć — czyli dokładnie
 * to, czego ta migracja ma się pozbyć. Widać to już dziś: pod „O SHORINJI KEMPO"
 * wiszą dwie podstrony własne, których treść bazowa w kodzie nie zna.
 *
 * ZAPAS Z KODU — ŚWIADOMY WYJĄTEK OD ZASADY „BŁĄD ODCZYTU TO 500"
 * ---------------------------------------------------------------
 * `lib/pages.ts` rzuca wyjątkiem, bo trasa catch-all nie ma czym zastąpić
 * strony, której nie odczytała — 404 udawałoby, że strony nie ma. Te trzy trasy
 * mają czym: pełną treść bazową w `data/articles`. Oddanie 500 na stronie,
 * której kompletna wersja leży w artefakcie deployu, byłoby gorsze od pokazania
 * jej wersji sprzed edycji w panelu. Ten wyjątek znika w etapie 7, razem
 * z przeniesieniem treści.
 */

export interface DaneListingu {
  title: string;
  intro: string | null;
  kicker: string | null;
  items: KafelekListingu[];
}

export async function daneListingu(adres: string, grupa: ArticleGroup): Promise<DaneListingu> {
  try {
    const wezel = await getStrona(adres);
    if (wezel) {
      // Przełącznik „kafelki podstron" z panelu działa też na hubach. Na nich
      // kafelki są zwykle całą treścią strony, więc wyłączenie zostawi sam
      // nagłówek — to jest świadomy wybór redaktora, a nie skutek uboczny:
      // pole w panelu stoi obok reszty ustawień tej samej strony.
      const dzieci = kafelkiWidoczne(wezel.layout) ? await getDzieci(wezel.id) : [];
      return {
        title: wezel.title,
        intro: wezel.intro,
        kicker: wezel.kicker,
        items: dzieci
          .filter((d) => d.full_path)
          .map((d) => ({ href: d.full_path as string, title: d.title, intro: d.intro })),
      };
    }
    /**
     * UWAGA, ZNANA LUKA (nieobjęta punktem A6, świadomie nie ruszona):
     * ta gałąź nie odróżnia „węzła nie ma w drzewie" od „redaktor go ukrył".
     * Ukrycie huba (`/o-shorinji`, `/organizacja`, `/buddyzm`) zdejmuje go
     * z menu i wygasza jego PODSTRONY — bo te idą przez `getStrona`, które od
     * A6 liczy widoczność po gałęzi — ale sam adres huba dalej oddaje 200
     * z treścią bazową z kodu.
     *
     * Rozdzielenie tych dwóch przypadków jest wykonalne (`getStrona` rzuca przy
     * błędzie odczytu, więc `null` znaczy „zapytanie się udało, żywej strony
     * nie ma"), ale zmienia kontrakt zapasu opisany w nagłówku tego pliku
     * i dotyka czterech miejsc wywołania. Do decyzji właściciela osobno —
     * A6 dotyczyło podstrony pod ukrytym rodzicem, nie samego huba.
     */
    console.warn(`[listingi] Brak węzła dla ${adres} — treść z kodu.`);
  } catch (e) {
    console.warn(`[listingi] ${adres}: odczyt drzewa nieudany, treść z kodu:`, e);
  }

  // Zapas: treść bazowa z kodu, bez zaglądania do `article_overrides`.
  // Po etapie 7 nadpisania nie są już źródłem treści — jest nim drzewo — a ta
  // gałąź odpala się właśnie wtedy, gdy drzewa nie da się odczytać. Sięganie
  // wtedy do drugiej tabeli w tej samej bazie nie ma szans zadziałać i tylko
  // dokłada zapytanie do i tak niedostępnej bazy.
  return {
    title: grupa.topicTitle,
    intro: grupa.topicIntro,
    kicker: null,
    items: grupa.articles.map((a) => ({
      href: `${adres}/${a.slug}`,
      title: a.title,
      intro: a.intro,
    })),
  };
}

/**
 * Metadane listingu.
 *
 * Do etapu 6 te trzy pliki miały statyczny `export const metadata` liczony
 * z `data/articles` — czyli zmiana tytułu w panelu NIE trafiała do `<title>`
 * ani do opisu w wynikach wyszukiwania. Statycznego `metadata` nie da się
 * uzależnić od odczytu z bazy; stąd `generateMetadata`.
 *
 * `alternates.canonical` brakowało na wszystkich trzech (potwierdzone pomiarem
 * w golden masterze) — dokładane tutaj, przy okazji, bo to ten sam obiekt.
 */
export async function metadaneListingu(adres: string, grupa: ArticleGroup): Promise<Metadata> {
  const dane = await daneListingu(adres, grupa);
  return {
    title: dane.title,
    description: dane.intro ?? undefined,
    alternates: { canonical: adres },
  };
}
