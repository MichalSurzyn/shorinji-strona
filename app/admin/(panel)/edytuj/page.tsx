import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/**
 * „Edytuj tę stronę" — cel ołówka z menu publicznego (components/OlowekAdmina.tsx).
 *
 * Ołówek zna wyłącznie ADRES oglądanej strony, a edytory w panelu pracują na
 * identyfikatorach. Ta trasa tłumaczy jedno na drugie i od razu przekierowuje:
 *   /aktualnosci/<slug>  → edytor wpisu (/admin/artykuly/<id>),
 *   adres z drzewa stron → edytor węzła (/admin/drzewo/<id>) — także strona
 *                          główna i strony o stałym układzie (kontakt, cennik,
 *                          zajęcia), bo mają węzeł z `source='route'`,
 *   cokolwiek innego     → lista stron (/admin/drzewo).
 *
 * Logowania pilnuje layout panelu: bez sesji kończy się na /admin/login.
 * Strona jest dynamiczna, ale wchodzą na nią tylko admini — koszt pomijalny.
 */
export default async function EdytujStrone({
  searchParams,
}: {
  searchParams: Promise<{ adres?: string }>;
}) {
  const { adres } = await searchParams;
  // Tylko ścieżka w obrębie serwisu: bez domeny, bez `//`, bez końcowego ukośnika.
  const sciezka =
    typeof adres === "string" && adres.startsWith("/") && !adres.startsWith("//")
      ? adres.split(/[?#]/)[0].replace(/(.)\/+$/, "$1")
      : "/";

  const sb = getSupabaseAdmin();
  if (!sb) redirect("/admin/drzewo");

  const wpis = sciezka.match(/^\/aktualnosci\/([a-z0-9-]+)$/);
  if (wpis) {
    const { data } = await sb
      .from("articles")
      .select("id")
      .eq("slug", wpis[1])
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (data) redirect(`/admin/artykuly/${data.id}`);
  }

  const { data: wezel } = await sb
    .from("pages")
    .select("id")
    .eq("full_path", sciezka)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (wezel) redirect(`/admin/drzewo/${wezel.id}`);

  redirect("/admin/drzewo");
}
