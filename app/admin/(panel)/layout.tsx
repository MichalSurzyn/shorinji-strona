import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel admina | Shorinji Kempo Kraków",
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");

  return (
    <AdminShell
      email={user.email ?? ""}
      name={(user.user_metadata?.name as string) ?? null}
    >
      {children}
    </AdminShell>
  );
}
