import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Klient Supabase tylko po stronie serwera (service role).
// NIE używać w komponentach klienckich – klucz nie ma przedrostka NEXT_PUBLIC,
// więc nigdy nie trafia do przeglądarki.

let client: SupabaseClient | null = null;
let initialized = false;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    // Brak konfiguracji – panel i nadpisania treści są nieaktywne,
    // strona działa na treści z kodu (fallback).
    return null;
  }

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
