import { getSupabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_NAV, type NavItemRow, type NavLink } from "./navTypes";

const CENNIK_ROUTE = "/zajecia/cennik";

/**
 * CENNIK ląduje jako podpozycja ZAJĘĆ (niezależnie od tego, czy w bazie
 * jest jeszcze starym top-level linkiem /cennik). Ujednolica też adres
 * na nową trasę /zajecia/cennik.
 */
function normalizeNavTree(tree: NavLink[]): NavLink[] {
  const isCennik = (href?: string) => href === "/cennik" || href === CENNIK_ROUTE;
  const cennikIndex = tree.findIndex((item) => isCennik(item.href));
  const zajeciaIndex = tree.findIndex((item) => item.label === "ZAJĘCIA");

  const nextTree = tree.map((item) => ({
    ...item,
    dropdown: item.dropdown
      ? item.dropdown.map((c) => (isCennik(c.href) ? { ...c, href: CENNIK_ROUTE } : c))
      : item.dropdown,
  }));

  if (cennikIndex === -1 || zajeciaIndex === -1) {
    return nextTree;
  }

  const cennik = nextTree[cennikIndex];
  const zajecia = nextTree[zajeciaIndex];

  if (!zajecia.dropdown) {
    zajecia.dropdown = [];
  }
  if (!zajecia.dropdown.some((child) => isCennik(child.href))) {
    zajecia.dropdown.push({ href: CENNIK_ROUTE, label: cennik.label });
  }

  nextTree.splice(cennikIndex, 1);
  return nextTree;
}

/**
 * Nawigacja strony z tabeli nav_items (edytowalna w panelu).
 * Gdy baza nie odpowiada lub tabela jest pusta - menu bazowe z kodu.
 */
export async function getNavTree(): Promise<NavLink[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return normalizeNavTree(DEFAULT_NAV);
  try {
    const { data, error } = await sb
      .from("nav_items")
      .select("id,parent_id,label,href,position,visible")
      .eq("visible", true)
      .order("position", { ascending: true })
      .abortSignal(AbortSignal.timeout(6000));
    if (error) throw error;
    const rows = (data ?? []) as NavItemRow[];
    if (!rows.length) return normalizeNavTree(DEFAULT_NAV);

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
    return normalizeNavTree(tree.length ? tree : DEFAULT_NAV);
  } catch (e) {
    console.warn("[navigation] getNavTree - fallback:", e);
    return normalizeNavTree(DEFAULT_NAV);
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
