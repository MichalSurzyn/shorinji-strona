"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Klient Supabase dla komponentow klienckich (logowanie, wylogowanie).
 *
 * flowType: "implicit" (zamiast domyslnego w @supabase/ssr "pkce") - PKCE
 * wymaga otwarcia linku z maila w TEJ SAMEJ przegladarce, w ktorej poproszono
 * o reset hasla (code verifier siedzi w jej localStorage). Redaktorzy czesto
 * czytaja maila na telefonie, a haslo resetuja z komputera - PKCE dawalo
 * wtedy falszywe "link stracil waznosc". Nie ma tu OAuth ani serwerowej
 * wymiany kodu, wiec PKCE i tak nie chronil niczego wiecej niz implicit.
 */
export function createSupabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}
