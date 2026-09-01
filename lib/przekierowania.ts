import { notFound, permanentRedirect, redirect } from "next/navigation";
import { getPrzekierowanie } from "./pages";

/**
 * „Nie ma takiej strony" — ale najpierw sprawdź, czy adres nie został
 * przeniesiony.
 *
 * Wołane z pięciu miejsc: trasy catch-all i CZTERECH tras `[slug]`
 * (`o-shorinji`, `organizacja`, `buddyzm`, `aktualnosci`). Te cztery są jedynymi
 * adresami, których catch-all nie przechwyci: dynamiczne dziecko `[slug]`
 * dopasowuje się przed nim, więc bez tego wywołania zmiana sluga podstrony
 * tematycznej albo aktualności dawałaby twarde 404 na adresie, który Google ma
 * w indeksie. Statyczne prefiksy (`/zajecia/*`, `/program-nauczania/*`)
 * przechwytuje catch-all i dostają przekierowania za darmo.
 *
 * Funkcja NIGDY nie wraca - kończy się `redirect` albo `notFound`, a oba
 * działają przez rzucenie wyjątku obsługiwanego przez Next. Dlatego typ `never`
 * i dlatego nie wolno jej wołać wewnątrz `try/catch`, który połyka wszystko.
 */
export async function przekierujAlboNotFound(sciezka: string): Promise<never> {
  const cel = await getPrzekierowanie(sciezka);
  if (!cel) notFound();

  // Next udostępnia dwa kody: 307 (`redirect`) i 308 (`permanentRedirect`).
  // Tabela dopuszcza jeszcze 301 i 302 - mapujemy je na odpowiedniki trwały
  // i tymczasowy. W praktyce mapowanie nie ma dziś czego zmieniać: trigger
  // zapisuje wyłącznie 308, a jedyny wiersz ręczny (/cennik) ma 307.
  if (cel.status === 308 || cel.status === 301) permanentRedirect(cel.new_path);
  redirect(cel.new_path);
}
