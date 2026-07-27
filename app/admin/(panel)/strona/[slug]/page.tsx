import { notFound } from "next/navigation";
import PageBlocksEditor from "@/components/admin/PageBlocksEditor";
import { getEditablePage } from "@/lib/editablePages";
import { getPageContent } from "@/lib/pageOverrides";

export default async function AdminStaticPageEdit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getEditablePage(slug);
  if (!page) notFound();

  // Treść w całości z bazy; gdy wpisu jeszcze nie ma (świeży projekt),
  // edytor startuje z prefillu z kodu (dane seedowe).
  const content = await getPageContent(slug);

  return (
    <PageBlocksEditor
      slug={page.slug}
      label={page.label}
      route={page.route}
      scope={page.scope}
      initialContent={content ?? { title: null, lead: null, kicker: null, blocks: page.prefill }}
    />
  );
}
