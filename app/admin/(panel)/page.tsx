import Link from "next/link";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const dynamic = "force-dynamic";

/** Kafelek zadania - duży cel dotykowy, czasownik na początku. */
function Zadanie({
  href,
  tytul,
  opis,
  ikona,
  glowne = false,
}: {
  href: string;
  tytul: string;
  opis: string;
  ikona: string;
  glowne?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-start gap-4 rounded-2xl border p-5 transition-all ${
        glowne
          ? "border-indigo-300 bg-indigo-50 hover:border-indigo-500 hover:shadow-md"
          : "border-slate-200 bg-white hover:border-indigo-400 hover:shadow-md"
      }`}
    >
      <span
        aria-hidden
        className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-xl text-xl ${
          glowne ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"
        }`}
      >
        {ikona}
      </span>
      <span>
        <span className="block font-semibold text-slate-900">{tytul}</span>
        <span className="block text-sm text-slate-500 mt-0.5 leading-snug">{opis}</span>
      </span>
    </Link>
  );
}

/**
 * Pulpit ułożony wokół zadań, nie wokół liczników.
 *
 * Redaktor wchodzi tu z konkretnym zamiarem („wrzucę relację z zawodów",
 * „zmienię godziny"), a nie po to, żeby dowiedzieć się, ile jest podstron.
 * Liczba edytowalnych stron nie mówi mu nic i nie prowadzi do żadnej decyzji.
 */
export default async function AdminDashboard() {
  const sb = getSupabaseAdmin();

  let nieprzeczytane = 0;
  let szkice = 0;
  let ostatnie: { id: string; title: string; published: boolean }[] = [];
  let bazaDziala = true;

  if (!sb) {
    bazaDziala = false;
  } else {
    try {
      const [wiadomosci, szkiceRes, artykuly] = await Promise.all([
        sb.from("contact_messages").select("*", { count: "exact", head: true }).eq("read", false),
        sb
          .from("articles")
          .select("*", { count: "exact", head: true })
          .eq("published", false)
          .is("deleted_at", null),
        sb
          .from("articles")
          .select("id,title,published")
          .is("deleted_at", null)
          .order("published_at", { ascending: false })
          .limit(5),
      ]);
      if (wiadomosci.error || szkiceRes.error || artykuly.error) throw new Error("odczyt");
      nieprzeczytane = wiadomosci.count ?? 0;
      szkice = szkiceRes.count ?? 0;
      ostatnie = (artykuly.data ?? []) as typeof ostatnie;
    } catch {
      // Trzeci stan: nie „brak treści", tylko „nie udało się sprawdzić".
      bazaDziala = false;
    }
  }

  const cosWymagaUwagi = nieprzeczytane > 0 || szkice > 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Co chcesz zrobić?</h1>
        <p className="text-slate-500 mt-1">
          Wszystko, co tu zmienisz, pojawia się na stronie klubu.
        </p>
      </div>

      {!bazaDziala && (
        <div
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        >
          <p className="font-semibold">Nie udało się połączyć z bazą treści.</p>
          <p className="mt-1">
            Strona klubu działa i pokazuje ostatnią zapisaną wersję, ale zmiany
            wprowadzone teraz mogą się nie zapisać. Spróbuj odświeżyć za chwilę.
            Jeśli to nie minie, przekaż tę informację osobie technicznej.
          </p>
        </div>
      )}

      {cosWymagaUwagi && (
        <section>
          <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold mb-3">
            Wymaga uwagi
          </h2>
          <div className="space-y-2">
            {nieprzeczytane > 0 && (
              <Link
                href="/admin/wiadomosci"
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3.5 hover:border-amber-500 transition-colors"
              >
                <span className="text-sm text-amber-900">
                  <strong>
                    {nieprzeczytane === 1
                      ? "1 nowa wiadomość"
                      : `${nieprzeczytane} nowe wiadomości`}
                  </strong>{" "}
                  z formularza kontaktowego
                </span>
                <span className="text-sm font-medium text-amber-900 shrink-0">Przeczytaj →</span>
              </Link>
            )}
            {szkice > 0 && (
              <Link
                href="/admin/artykuly"
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-5 py-3.5 hover:border-indigo-400 transition-colors"
              >
                <span className="text-sm text-slate-700">
                  <strong>
                    {szkice === 1 ? "1 szkic" : `${szkice} szkice`}
                  </strong>{" "}
                  czeka na dokończenie - nikt ich jeszcze nie widzi
                </span>
                <span className="text-sm font-medium text-indigo-600 shrink-0">Zobacz →</span>
              </Link>
            )}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold mb-3">
          Najczęstsze zadania
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <Zadanie
            href="/admin/artykuly/nowy"
            ikona="✎"
            tytul="Napisz aktualność"
            opis="Relacja z zawodów, ogłoszenie, informacja o zmianie"
            glowne
          />
          <Zadanie
            href="/admin/zdjecia"
            ikona="▣"
            tytul="Dodaj zdjęcia"
            opis="Do galerii albo na konkretną stronę"
          />
          <Zadanie
            href="/admin/harmonogram"
            ikona="◷"
            tytul="Zmień godziny zajęć"
            opis="Trafią na strony zajęć i do kalendarza w telefonie"
          />
          <Zadanie
            href="/admin/strony"
            ikona="❏"
            tytul="Popraw treść strony"
            opis="Cennik, kontakt, opisy zajęć i pozostałe strony"
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold">
            Ostatnio dodane aktualności
          </h2>
          <Link
            href="/admin/artykuly"
            className="text-sm text-indigo-600 hover:text-indigo-800 transition-colors"
          >
            Wszystkie →
          </Link>
        </div>
        {!bazaDziala ? (
          <p className="bg-white rounded-2xl border border-slate-200 px-5 py-6 text-sm text-slate-400">
            Nie udało się wczytać listy.
          </p>
        ) : ostatnie.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 px-5 py-6">
            <p className="text-sm font-medium text-slate-600">
              Nie ma jeszcze żadnej aktualności.
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Pierwsza może być krótka - wystarczy tytuł, zdjęcie i dwa zdania.
            </p>
          </div>
        ) : (
          <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
            {ostatnie.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/admin/artykuly/${a.id}`}
                  className="group flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <span className="text-sm text-slate-700 group-hover:text-indigo-600 transition-colors leading-snug">
                    {a.title}
                  </span>
                  <span
                    className={`shrink-0 text-xs rounded-full px-2.5 py-0.5 ${
                      a.published
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {a.published ? "widoczna na stronie" : "szkic, widzisz tylko Ty"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
