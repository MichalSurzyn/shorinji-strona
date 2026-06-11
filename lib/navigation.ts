import { getSupabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_NAV, type NavItemRow, type NavLink } from "./navTypes";

/**
 * Nawigacja strony z tabeli nav_items (edytowalna w panelu).
 * Gdy baza nie odpowiada lub tabela jest pusta - menu bazowe z kodu.
 */
export async function getNavTree(): Promise<NavLink[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return DEFAULT_NAV;
  try {
    const { data, error } = await sb
      .from("nav_items")
      .select("id,parent_id,label,href,position,visible")
      .eq("visible", true)
      .order("position", { ascending: true })
      .abortSignal(AbortSignal.timeout(6000));
    if (error) throw error;
    const rows = (data ?? []) as NavItemRow[];
    if (!rows.length) return DEFAULT_NAV;

    const tops = rows.filter((r) => !r.parent_id);
    const tree: NavLink[] = tops.map((t) => {
      const children = rows
        .filter((r) => r.parent_id === t.id && r.href)
        .map((r) => ({ href: r.href as string, label: r.label }));
      return {
        label: t.label,
        ...(t.href ? { href: t.href } : {}),
        ...(children.length ? { dropdown: children } : {}),
      };
    });
    return tree.length ? tree : DEFAULT_NAV;
  } catch (e) {
    console.warn("[navigation] getNavTree - fallback:", e);
    return DEFAULT_NAV;
  }
}

/** Surowe wiersze do edytora w panelu. */
export async function getNavRows(): Promise<NavItemRow[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("nav_items")
      .select("id,parent_id,label,href,position,visible")
      .order("position", { ascending: true });
    if (error) throw error;
    return (data ?? []) as NavItemRow[];
  } catch {
    return [];
  }
}
