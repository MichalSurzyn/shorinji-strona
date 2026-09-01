import TreeManager from "@/components/admin/TreeManager";
import { pobierzDrzewo, pobierzKosz } from "@/actions/pagesActions";

/**
 * Zakładka „Strony i menu" — drzewo z tabeli `pages`.
 *
 * Stoi OBOK starych zakładek („Menu na górze strony", „Strony"), a nie zamiast
 * nich: przez pierwszy okres pracy właściciela obie ścieżki mają być dostępne,
 * żeby dało się wrócić bez wdrożenia. Usunięcie starych to etap 8.
 */
export default async function DrzewoStronPage() {
  const [drzewo, kosz] = await Promise.all([pobierzDrzewo(), pobierzKosz()]);
  return <TreeManager drzewo={drzewo} kosz={kosz} />;
}
