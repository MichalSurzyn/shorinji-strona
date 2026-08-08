import { getSupabaseAdmin } from "./supabaseAdmin";
import { DEFAULT_NAV, type NavItemRow, type NavLink } from "./navTypes";

const CENNIK_ROUTE = "/zajecia/cennik";

/**
 * Migracja starego adresu cennika w menu (cennik przeniesiony pod ZAJĘCIA
 * w 07.2026):
 *  - adres /cennik jest ujednolicany na /zajecia/cennik,
 *  - link, który został na najwyższym poziomie, wędruje do dropdownu ZAJĘĆ.
 *
 * UWAGA: ta funkcja NICZEGO do menu nie dodaje. Wcześniej dokładała CENNIK
 * przy każdym renderze, gdy go nie znalazła - przez co usunięcie cennika
 * w panelu nie działało: kod cofał tę decyzję. Menu pochodzi z panelu
 * (nav_items) i to panel rozstrzyga, co jest widoczne.
 */
function normalizeNavTree(tree: NavLink[]): NavLink[] {
  const isCennik = (href?: string) => href === "/cennik" || href === CENNIK_ROUTE;

  const nextTree = tree.map((item) => ({
    ...item,
    dropdown: item.dropdown
      ? item.dropdown.map((c) => (isCennik(c.href) ? { ...c, href: CENNIK_ROUTE } : c))
      : item.dropdown,
  }));

  // Bez cennika na najwyższym poziomie nie ma czego migrować.
  const cennikIndex = nextTree.findIndex((item) => isCennik(item.href));
  if (cennikIndex === -1) return nextTree;

  // Bez pozycji ZAJĘCIA nie ma dokąd go przenieść - zostaje, gdzie jest.
  const zajecia = nextTree.find((item) => item.label.trim().toUpperCase() === "ZAJĘCIA");
  if (!zajecia) return nextTree;

  if (!zajecia.dropdown) zajecia.dropdown = [];
  if (!zajecia.dropdown.some((child) => isCennik(child.href))) {
    zajecia.dropdown.push({ href: CENNIK_ROUTE, label: nextTree[cennikIndex].label });
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
