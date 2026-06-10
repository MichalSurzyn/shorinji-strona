import { notFound } from "next/navigation";
import PageBlocksEditor from "@/components/admin/PageBlocksEditor";
import { getEditablePage } from "@/lib/editablePages";
import { getPageBlocks } from "@/lib/pageOverrides";

export default async function AdminStaticPageEdit({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = getEditablePage(slug);
  if (!page) notFound();

  const override = await getPageBlocks(slug);

  return (
    <PageBlocksEditor
      slug={page.slug}
      label={page.label}
      route={page.route}
      scope={page.scope}
      initialBlocks={override ?? page.prefill}
      baseBlocks={page.prefill}
    />
  );
}
