"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
  lastSignInAt: string | null;
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

export async function changeOwnPassword(newPassword: string) {
  const { supabase } = await requireUser();
  if (newPassword.length < 8)
    return { ok: false as const, error: "Hasło musi mieć min. 8 znaków" };
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
