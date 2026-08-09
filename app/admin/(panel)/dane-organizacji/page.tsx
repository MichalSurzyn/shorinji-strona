import OrganizationEditor from "@/components/admin/OrganizationEditor";
import { getOrganization } from "@/lib/organization";

export const dynamic = "force-dynamic";

export default async function DaneOrganizacjiPage() {
  const dane = await getOrganization();
  return <OrganizationEditor initial={dane} />;
}
