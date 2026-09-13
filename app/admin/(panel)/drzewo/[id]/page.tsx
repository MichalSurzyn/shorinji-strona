import { notFound } from "next/navigation";
import TreeNodeEditor from "@/components/admin/TreeNodeEditor";
import { pobierzWezel } from "@/actions/pagesActions";
import { getPageContent } from "@/lib/pageOverrides";
import { basePageContent } from "@/lib/editablePages";

export default async function EdycjaWezlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wezel = await pobierzWezel(id);
  if (!wezel) notFound();

  /**
   * Treść stron o STAŁYM UKŁADZIE nie siedzi w wierszu drzewa, tylko
   * w `site_settings` pod kluczem `page:<slug>`. Który to klucz — mówi kolumna
   * `content_key`, wypełniona przez backfill etapu 2 i do tej pory nieczytana
   * przez ani jeden plik w repo.
   *
   * Dzięki temu pomostowi TEN jeden ekran edytuje i pozycję w drzewie, i treść
   * strony. Wcześniej redaktor musiał się przełączać między dwiema zakładkami
   * nad jedną stroną — zgłoszone jako „są 2 zakładki Strony i Strony i menu,
   * bez sensu".
   */
  const slugTresci = wezel.content_key?.startsWith("page:")
    ? wezel.content_key.slice("page:".length)
    : null;

  // `basePageContent` to treść bazowa z kodu — wchodzi, gdy wpisu w bazie
  // jeszcze nie ma. Bez niej ekran pokazywałby pusty formularz nad stroną,
  // która publicznie ma treść, i pierwszy zapis by ją wyczyścił.
  const tresc = slugTresci
    ? ((await getPageContent(slugTresci)) ?? basePageContent(slugTresci) ?? null)
    : null;

  return <TreeNodeEditor wezel={wezel} slugTresci={slugTresci} tresc={tresc} />;
}
