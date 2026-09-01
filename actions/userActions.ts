"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { ROLA_ADMIN, requireUser } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  /** Czy konto jest na allowliscie panelu (app_metadata.rola). */
  uprawniony: boolean;
}

export async function listAdmins(): Promise<AdminUser[]> {
  await requireUser();
  const admin = getSupabaseAdmin();
  if (!admin) return [];
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) {
    console.warn("listAdmins:", error);
    return [];
  }
  return data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    name: (u.user_metadata?.name as string) ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    uprawniony: (u.app_metadata as Record<string, unknown> | undefined)?.rola === ROLA_ADMIN,
  }));
}

export async function addAdmin(email: string, password: string, name: string) {
  await requireUser();
  if (!email.includes("@"))
    return { ok: false as const, error: "Nieprawidłowy email" };
  if (password.length < 8)
    return { ok: false as const, error: "Hasło musi mieć min. 8 znaków" };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "Brak konfiguracji Supabase" };
  const { error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: name || email.split("@")[0] },
    // Rola w app_metadata, nie w user_metadata: tego drugiego uzytkownik
    // nadpisuje sam z przegladarki, wiec rola trzymana tam nie byla by
    // zabezpieczeniem, tylko jego pozorem.
    app_metadata: { rola: ROLA_ADMIN },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function removeAdmin(id: string) {
  const { user } = await requireUser();
  if (user.id === id)
    return { ok: false as const, error: "Nie możesz usunąć własnego konta" };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "Brak konfiguracji Supabase" };
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

/**
 * Nadanie albo odebranie uprawnien do panelu.
 *
 * Potrzebne, bo konta zalozone PRZED wprowadzeniem allowlisty nie maja roli
 * i bez tego dalo by sie je odblokowac wylacznie skryptem z linii polecen -
 * czyli wlasciciel musialby po kazde takie odblokowanie wolac programiste.
 *
 * Odebrania roli samemu sobie pilnujemy tak samo jak usuniecia wlasnego konta:
 * inaczej jedno kliknieciem zamyka sie panel przed wszystkimi.
 */
export async function setAdminRole(id: string, nadaj: boolean) {
  const { user } = await requireUser();
  if (user.id === id && !nadaj)
    return { ok: false as const, error: "Nie możesz odebrać uprawnień samemu sobie" };

  const admin = getSupabaseAdmin();
  if (!admin) return { ok: false as const, error: "Brak konfiguracji Supabase" };

  if (!nadaj) {
    // Ostatnie uprawnione konto nie moze zniknac - to jest ten sam rodzaj
    // pomylki co skasowanie wlasnego konta, tylko trudniejszy do cofniecia,
    // bo nie zostaje nikt, kto moglby nadac role z powrotem.
    const { data, error } = await admin.auth.admin.listUsers();
    if (error) return { ok: false as const, error: error.message };
    const uprawnieni = data.users.filter(
      (u) => (u.app_metadata as Record<string, unknown> | undefined)?.rola === ROLA_ADMIN,
    );
    if (uprawnieni.length <= 1)
      return { ok: false as const, error: "To ostatnie konto z uprawnieniami — nie da się go odebrać" };
  }

  const { error } = await admin.auth.admin.updateUserById(id, {
    app_metadata: { rola: nadaj ? ROLA_ADMIN : null },
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function changeOwnPassword(newPassword: string) {
  const { supabase } = await requireUser();
  if (newPassword.length < 8)
    return { ok: false as const, error: "Hasło musi mieć min. 8 znaków" };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
