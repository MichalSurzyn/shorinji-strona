import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { KUBELEK } from "@/lib/pliki";

/**
 * Serwuje pliki do pobrania z magazynu Supabase pod adresem
 * /downloads/<nazwa>.
 *
 * DLACZEGO WŁASNA TRASA, A NIE ADRES MAGAZYNU:
 * odnośniki /downloads/statut-posk.pdf są już wpisane w stopce, a część
 * mogła zostać komuś podana albo trafić do wyszukiwarek. Ta trasa zachowuje
 * je niezależnie od tego, gdzie pliki fizycznie leżą - zmiana magazynu nie
 * zerwie ani jednego odnośnika.
 *
 * Do 09.08.2026 te same adresy obsługiwały pliki z katalogu public/downloads.
 * Nazwy zostały zachowane 1:1, więc dla odwiedzającego nic się nie zmieniło.
 */

// Pliki zmieniają się rzadko, ale po podmianie w panelu nowa wersja ma być
// widoczna bez czekania - stąd krótka rewalidacja zamiast wieczności.
export const revalidate = 300;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nazwa: string }> }
) {
  const { nazwa } = await params;

  // Nazwa z adresu nigdy nie może wyjść poza kubełek.
  if (!nazwa || nazwa.includes("/") || nazwa.includes("..")) {
    return new NextResponse("Nieprawidłowa nazwa pliku", { status: 400 });
  }

  const sb = getSupabaseAdmin();
  if (!sb) return new NextResponse("Magazyn plików jest niedostępny", { status: 503 });

  const { data, error } = await sb.storage.from(KUBELEK).download(nazwa);
  if (error || !data) {
    return new NextResponse("Nie znaleziono pliku", { status: 404 });
  }

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      // inline: PDF otwiera się w przeglądarce, ale zapisuje pod właściwą
      // nazwą. Wymuszanie pobrania byłoby uciążliwe przy statutach, które
      // ludzie chcą po prostu przeczytać.
      "Content-Disposition": `inline; filename="${nazwa}"`,
      "Cache-Control": "public, max-age=300, s-maxage=300, stale-while-revalidate=86400",
    },
  });
}
