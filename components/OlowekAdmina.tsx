"use client";

import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

/**
 * Ołówek „edytuj tę stronę" w rogu menu — tylko dla zalogowanego admina.
 *
 * Zgłoszenie właściciela: admin oglądający stronę publiczną chce jednym
 * kliknięciem przejść do edycji TEJ strony, a ikona ma nie rzucać się w oczy.
 *
 * DLACZEGO W PRZEGLĄDARCE, A NIE NA SERWERZE
 * ------------------------------------------
 * Sprawdzenie sesji na serwerze (`cookies()` w layoucie) zrobiłoby z każdej
 * strony publicznej stronę dynamiczną: każde wejście = wywołanie funkcji
 * Netlify, czyli dokładnie ten problem z limitem, który naprawiał `649d76c`.
 * Tu HTML jest jeden dla wszystkich (cache zostaje), a dopiero przeglądarka
 * patrzy, czy ma ciasteczko sesji panelu `sb-<ref>-auth-token` (bez `httpOnly`,
 * domyślnie w `@supabase/ssr`; przy długiej sesji w kawałkach `.0`, `.1`).
 *
 * To tylko link — niczego nie odsłania. Prawdziwa kontrola jest w panelu
 * (`app/admin/(panel)/layout.tsx`): bez ważnej sesji kończy się na logowaniu.
 * Wygasła sesja z ciasteczkiem w przeglądarce = ołówek widoczny, klik prowadzi
 * na logowanie. Akceptowalne.
 */

/** Ref projektu z adresu bazy (`https://<ref>.supabase.co`). */
function refProjektu(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0] ?? "";
  } catch {
    return "";
  }
}
const REF = refProjektu();
const WZOR_SESJI = REF ? new RegExp(`(?:^|;\\s*)sb-${REF}-auth-token(?:\\.\\d+)?=`) : null;

// Ciasteczka nie emitują zdarzeń, a sesja zmienia się przy logowaniu w panelu,
// czyli przy przejściu na inną stronę — subskrypcja nie ma czego słuchać.
const bezSubskrypcji = () => () => {};

export default function OlowekAdmina() {
  const sciezka = usePathname();
  // `useSyncExternalStore` z migawką serwera `false`: HTML z serwera nie ma
  // ołówka (cache jeden dla wszystkich), a hydracja nie zgłasza rozjazdu.
  const zalogowany = useSyncExternalStore(
    bezSubskrypcji,
    () => !!WZOR_SESJI && WZOR_SESJI.test(document.cookie),
    () => false,
  );
  if (!zalogowany) return null;

  return (
    <a
      href={`/admin/edytuj?adres=${encodeURIComponent(sciezka)}`}
      aria-label="Edytuj tę stronę w panelu"
      title="Edytuj tę stronę w panelu"
      data-olowek-admina
      className="mr-2 p-1 text-neutral-500 transition-colors hover:text-yellow-500"
    >
      <svg className="h-5 w-5 md:h-6 md:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
        />
      </svg>
    </a>
  );
}
