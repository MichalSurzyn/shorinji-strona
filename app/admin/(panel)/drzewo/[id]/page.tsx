import { notFound } from "next/navigation";
import TreeNodeEditor from "@/components/admin/TreeNodeEditor";
import { pobierzWezel } from "@/actions/pagesActions";

export default async function EdycjaWezlaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const wezel = await pobierzWezel(id);
  if (!wezel) notFound();
  return <TreeNodeEditor wezel={wezel} />;
}
