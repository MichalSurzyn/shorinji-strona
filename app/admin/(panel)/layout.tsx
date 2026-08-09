import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { getSessionUser } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Panel strony | Shorinji Kempo Kraków",
  robots: { index: false, follow: false },
};

export default async function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();

  if (!user) {
    // Zabieramy ze sobą powód i miejsce, z którego użytkownik wypadł.
    // Bez tego wygaśnięcie sesji wyrzucało na logowanie bez wyjaśnienia,
    // a po zalogowaniu lądowało się na pulpicie zamiast tam, gdzie się było.
    const naglowki = await headers();
    const sciezka =
      naglowki.get("x-invoke-path") ??
      naglowki.get("next-url") ??
      naglowki.get("x-matched-path") ??
      "";
    const wroc = sciezka.startsWith("/admin") ? `&wroc=${encodeURIComponent(sciezka)}` : "";
    redirect(`/admin/login?powod=wygaslo${wroc}`);
  }

  return (
    <AdminShell
      email={user.email ?? ""}
      name={(user.user_metadata?.name as string) ?? null}
    >
      {children}
    </AdminShell>
  );
}
