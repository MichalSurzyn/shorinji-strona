import { notFound } from "next/navigation";
import CustomPageEditor from "@/components/admin/CustomPageEditor";
import type { CustomPage } from "@/lib/customPages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export default async function EditCustomPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sb = getSupabaseAdmin();
  if (!sb) notFound();

  const { data: page } = await sb
    .from("custom_pages")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!page) notFound();

  const { data: navItem } = await sb
    .from("nav_items")
    .select("id")
    .eq("href", `/${page.slug}`)
    .is("parent_id", null)
    .maybeSingle();

  return (
    <CustomPageEditor
      page={page as CustomPage}
      initialInMenu={!!navItem}
    />
  );
}
