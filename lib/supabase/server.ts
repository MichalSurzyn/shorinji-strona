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

/** Zalogowany uzytkownik panelu albo null. */
export async function getSessionUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Rzuca bledem, jesli nikt nie jest zalogowany. Zwraca klienta i usera. */
export async function requireUser() {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Brak autoryzacji");
  return { supabase, user };
}
