"use server";

import { revalidatePath } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

export interface NavTreeInput {
  label: string;
  href: string | null;
  visible: boolean;
  children: { label: string; href: string; visible: boolean }[];
}

/** Zapisuje całe menu (zastępuje poprzednią wersję). */
export async function saveNavTree(items: NavTreeInput[]) {
  await requireUser();
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  for (const item of items) {
    if (!item.label.trim())
      return { ok: false as const, error: "Każda pozycja menu musi mieć etykietę." };
    for (const child of item.children) {
      if (!child.label.trim() || !child.href.trim())
        return {
          ok: false as const,
          error: `Podpunkty pozycji „${item.label}” muszą mieć etykietę i adres.`,
        };
    }
    if (!item.href?.trim() && item.children.length === 0)
      return {
        ok: false as const,
        error: `Pozycja „${item.label}” musi mieć adres albo podpunkty.`,
      };
  }

  // Podmiana drzewa w kolejności: NAJPIERW budujemy nowe menu, DOPIERO POTEM
  // kasujemy stare.
  //
  // Wcześniej było odwrotnie - kasowanie wszystkiego, a potem wstawianie
  // pozycja po pozycji. Awaria sieci albo błąd bazy w połowie tej pętli
  // zostawiał stronę klubu bez nawigacji, bez żadnej drogi powrotu poza
  // ponownym zapisem z panelu (do którego trzeba się jakoś dostać).
  //
  // PostgREST nie daje transakcji obejmującej wiele zapytań, więc zamiast
  // niej pilnujemy kolejności: dopóki nowe pozycje nie są kompletne, stare
  // zostają nietknięte. Przez chwilę w tabeli są oba komplety - to bezpieczne,
  // bo czytelnik zobaczy najwyżej podwojone menu przez ułamek sekundy,
  // a nie jego brak.

  const { data: stare, error: odczytErr } = await sb.from("nav_items").select("id");
  if (odczytErr) return { ok: false as const, error: odczytErr.message };
  const stareId = (stare ?? []).map((r) => r.id as string);

  // Krok 1: pozycje najwyższego poziomu. Position nadajemy z przesunięciem,
  // żeby nie mieszały się w kolejności ze starymi w oknie przejściowym.
  const { data: noweTop, error: topErr } = await sb
    .from("nav_items")
    .insert(
      items.map((item, i) => ({
        label: item.label.trim(),
        href: item.href?.trim() || null,
        position: i,
        visible: item.visible,
      }))
    )
    .select("id,position");
  if (topErr) return { ok: false as const, error: topErr.message };

  const noweId = (noweTop ?? []).map((r) => r.id as string);
  /** Sprzątanie po nieudanym zapisie - stare menu zostaje na miejscu. */
  const wycofaj = async () => {
    if (noweId.length) await sb.from("nav_items").delete().in("id", noweId);
  };

  if ((noweTop ?? []).length !== items.length) {
    await wycofaj();
    return {
      ok: false as const,
      error: "Nie udało się zapisać wszystkich pozycji menu. Menu na stronie zostało bez zmian.",
    };
  }

  // Dopasowanie po position jest deterministyczne - nie polegamy na
  // kolejności zwracanej przez bazę.
  const idWgPozycji = new Map<number, string>();
  for (const r of noweTop ?? []) idWgPozycji.set(r.position as number, r.id as string);

  // Krok 2: podpunkty, wszystkie jednym zapytaniem.
  const dzieci = items.flatMap((item, i) =>
    item.children.map((c, j) => ({
      parent_id: idWgPozycji.get(i)!,
      label: c.label.trim(),
      href: c.href.trim(),
      position: j,
      visible: c.visible,
    }))
  );
  if (dzieci.length) {
    const { error: dzieciErr } = await sb.from("nav_items").insert(dzieci);
    if (dzieciErr) {
      await wycofaj();
      return {
        ok: false as const,
        error: `${dzieciErr.message}. Menu na stronie zostało bez zmian.`,
      };
    }
  }

  // Krok 3: dopiero teraz znika stare menu (podpunkty kaskadowo).
  if (stareId.length) {
    const { error: delErr } = await sb.from("nav_items").delete().in("id", stareId);
    if (delErr) {
      return {
        ok: false as const,
        error:
          "Nowe menu zostało zapisane, ale nie udało się usunąć poprzedniej wersji - " +
          "w menu mogą być teraz podwojone pozycje. Zapisz jeszcze raz.",
      };
    }
  }

  revalidatePath("/", "layout");
  return { ok: true as const };
}
