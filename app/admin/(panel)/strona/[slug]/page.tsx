import { notFound } from "next/navigation";
import PageBlocksEditor from "@/components/admin/PageBlocksEditor";
import { basePageContentFor, getEditablePage } from "@/lib/editablePages";
import { getPageContent } from "@/lib/pageOverrides";

export default async function AdminStaticPageEdit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getEditablePage(slug);
  if (!page) notFound();

  // Treść z bazy; gdy wpisu jeszcze nie ma (świeży projekt), edytor startuje
  // z treści bazowej z kodu — tej samej, którą pokazuje wtedy publiczna strona.
  const content = await getPageContent(slug);

  return (
    <PageBlocksEditor
      slug={page.slug}
      label={page.label}
      route={page.route}
      scope={page.scope}
      initialContent={content ?? basePageContentFor(page)}
    />
  );
}
