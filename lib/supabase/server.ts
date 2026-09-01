import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** Klient Supabase dla Server Components / Server Actions (sesja admina z cookies). */
export async function createSupabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Wywolane z Server Component - zapis cookies niedozwolony, ignorujemy.
          }
        },
      },
    }
  );
}

import type { User } from "@supabase/supabase-js";

/**
 * ALLOWLISTA KONT PANELU
 *
 * Do tej pory panel sprawdzal WYLACZNIE to, czy ktokolwiek jest zalogowany.
 * Kazde konto w Supabase Auth tego projektu bylo wiec kontem administratora -
 * a klucz anon, ktorym idzie logowanie i rejestracja, lezy w bundlu
 * przegladarki. Dopoki panel edytowal etykiety menu, byla to nieprzyjemnosc.
 * Po scaleniu tabel ta sama dziura zaczyna dotyczyc TRESCI STRON i STRUKTURY
 * ADRESOW calego serwisu - stad warunek wejscia do etapu 5 (par. 5.7).
 *
 * Rola siedzi w `app_metadata`, a nie w `user_metadata`, i to jest cala istota
 * tego rozwiazania: `user_metadata` uzytkownik nadpisuje sam, zwyklym
 * `auth.updateUser()` z przegladarki - rola trzymana tam nadawalaby uprawnienia
 * kazdemu, kto potrafi otworzyc konsole. `app_metadata` zapisuje wylacznie
 * Admin API kluczem service-role, ktory nigdy nie opuszcza serwera.
 *
 * Konta zalozone przed ta zmiana nie maja roli. Nadaje ja jednorazowo
 * `scripts/nadaj-role-admin.mjs` - swiadomie skryptem, a nie automatycznym
 * "pierwszy zalogowany dostaje admina", bo taki automat jest tylna furtka
 * o dokladnie tej samej sile co brak allowlisty.
 */
export const ROLA_ADMIN = "admin";

export function czyAdmin(user: User | null): boolean {
  return user?.app_metadata?.rola === ROLA_ADMIN;
}

/** Zalogowany uzytkownik panelu albo null. NIE sprawdza uprawnien - patrz getAdminUser. */
export async function getSessionUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Uzytkownik panelu razem z odpowiedzia na pytanie, czy wolno mu tu byc.
 *
 * Layout panelu musi ODROZNIC "nikt nie jest zalogowany" od "zalogowany, ale
 * bez uprawnien" - te dwie sytuacje wymagaja innego komunikatu. Wrzucenie obu
 * do jednego `redirect("/admin/login")` daje petle: uzytkownik loguje sie
 * poprawnie i natychmiast wraca na logowanie bez slowa wyjasnienia.
 */
export async function getAdminUser(): Promise<{ user: User | null; uprawniony: boolean }> {
  const user = await getSessionUser();
  return { user, uprawniony: czyAdmin(user) };
}

/**
 * Rzuca bledem, jesli uzytkownik nie jest zalogowany ALBO nie jest na allowliscie.
 *
 * Sprawdzenie jest tutaj, a nie w kazdej akcji z osobna, bo `requireUser()`
 * wola ponad czterdziesci miejsc - kazde inne rozwiazanie znaczyloby, ze
 * o zabezpieczeniu trzeba pamietac przy dopisywaniu czterdziestej pierwszej akcji.
 */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");
  if (!czyAdmin(user)) {
    throw new Error(
      "To konto nie ma uprawnien do panelu. Uprawnienia nadaje sie w zakladce Admini " +
        "albo skryptem scripts/nadaj-role-admin.mjs.",
    );
  }
  return { supabase, user };
}
