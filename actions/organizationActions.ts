"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";
import {
  czyPoprawnyIban,
  czyPoprawnyNip,
  normalizujIban,
  type OrganizationData,
} from "@/lib/organizationTypes";

const KLUCZ = "organization";

/**
 * Zapis danych podmiotu.
 *
 * Kontrola po stronie serwera jest niezbędna: akcje serwerowe da się wywołać
 * z pominięciem formularza, a numer konta bankowego to pole, w którym pomyłka
 * o jeden znak kosztuje realne pieniądze.
 */
export async function saveOrganization(dane: OrganizationData) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  if (!dane.nazwy.serwis.trim())
    return { ok: false as const, error: "Nazwa strony nie może być pusta." };

  if (!dane.kontakt.email.trim())
    return { ok: false as const, error: "Adres e-mail klubu nie może być pusty." };

  if (dane.kontakt.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dane.kontakt.email.trim()))
    return { ok: false as const, error: "Adres e-mail klubu wygląda na niepoprawny." };

  if (dane.emailDaneOsobowe.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dane.emailDaneOsobowe.trim()))
    return { ok: false as const, error: "Adres e-mail do spraw danych osobowych wygląda na niepoprawny." };

  const iban = normalizujIban(dane.bank.iban);
  if (iban && !czyPoprawnyIban(iban))
    return {
      ok: false as const,
      error:
        "Numer konta jest niepoprawny - suma kontrolna się nie zgadza. Sprawdź, czy nie ma literówki.",
    };

  if (!czyPoprawnyNip(dane.rejestr.nip))
    return { ok: false as const, error: "Numer NIP jest niepoprawny - suma kontrolna się nie zgadza." };

  const krs = dane.rejestr.krs.replace(/\s/g, "");
  if (krs && !/^\d{10}$/.test(krs))
    return { ok: false as const, error: "Numer KRS musi mieć dokładnie 10 cyfr." };

  const regon = dane.rejestr.regon.replace(/\s/g, "");
  if (regon && !/^(\d{9}|\d{14})$/.test(regon))
    return { ok: false as const, error: "Numer REGON musi mieć 9 albo 14 cyfr." };

  const doZapisu: OrganizationData = {
    ...dane,
    bank: { ...dane.bank, iban },
    rejestr: { krs, nip: dane.rejestr.nip.replace(/[\s-]/g, ""), regon },
  };

  const { error } = await sb.from("site_settings").upsert({
    key: KLUCZ,
    value: doZapisu,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  // Dane podmiotu są w layoucie (stopka, dane strukturalne), więc
  // odświeżamy cały serwis, nie pojedynczą trasę.
  revalidatePath("/", "layout");
  return { ok: true as const };
}
