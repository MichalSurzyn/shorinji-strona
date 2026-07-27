"use server";

import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

/**
 * Formularz kontaktowy: publiczny zapis wiadomości do tabeli contact_messages
 * (DDL: supabase/setup.sql). Wysyłka e-mailem dojdzie później - na razie
 * wiadomości czyta się w panelu (zakładka Wiadomości).
 */

export interface ContactMessageRow {
  id: string;
  name: string;
  email: string;
  message: string;
  source: string | null;
  read: boolean;
  created_at: string;
}

const MAX = { name: 120, email: 200, message: 4000 };

export async function sendContactMessage(input: {
  name: string;
  email: string;
  message: string;
  source?: string;
  /** Honeypot antyspamowy - pole niewidoczne dla ludzi; bot je wypełni. */
  website?: string;
}) {
  // Honeypot: udajemy sukces, nic nie zapisujemy.
  if (input.website && input.website.trim() !== "") return { ok: true as const };

  const name = (input.name ?? "").trim();
  const email = (input.email ?? "").trim();
  const message = (input.message ?? "").trim();

  if (!name || !email || !message)
    return { ok: false as const, error: "Wypełnij wszystkie pola." };
  if (name.length > MAX.name || email.length > MAX.email || message.length > MAX.message)
    return { ok: false as const, error: "Wiadomość jest zbyt długa." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { ok: false as const, error: "Podaj poprawny adres e-mail." };

  const sb = getSupabaseAdmin();
  if (!sb)
    return {
      ok: false as const,
      error: "Formularz jest chwilowo niedostępny. Napisz na pl.shorinjikempo@gmail.com.",
    };

  const { error } = await sb.from("contact_messages").insert({
    name,
    email,
    message,
    source: input.source ?? null,
  });
  if (error) {
    console.warn("[contact] insert:", error.message);
    return {
      ok: false as const,
      error: "Nie udało się wysłać. Napisz na pl.shorinjikempo@gmail.com.",
    };
  }
  return { ok: true as const };
}

/** Lista wiadomości do panelu (wymaga zalogowania). */
export async function listContactMessages(): Promise<
  { ok: true; messages: ContactMessageRow[] } | { ok: false; error: string }
> {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Brak konfiguracji Supabase." };
  const { data, error } = await sb
    .from("contact_messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    // Najczęstszy przypadek: tabela jeszcze nie istnieje (trzeba wkleić supabase/setup.sql).
    return { ok: false, error: error.message };
  }
  return { ok: true, messages: (data ?? []) as ContactMessageRow[] };
}

export async function markContactMessageRead(id: string, read: boolean) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  const { error } = await sb.from("contact_messages").update({ read }).eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

export async function deleteContactMessage(id: string) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };
  const { error } = await sb.from("contact_messages").delete().eq("id", id);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
