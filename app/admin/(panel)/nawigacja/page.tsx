import NavEditor from "@/components/admin/NavEditor";
import { getNavRows, getNavTree } from "@/lib/navigation";

export default async function AdminNavPage() {
  // Drzewo budujemy z surowych wierszy; gdy tabela pusta - z fallbacku.
  const rows = await getNavRows();
  let items;
  if (rows.length) {
    const tops = rows.filter((r) => !r.parent_id);
    items = tops.map((t) => ({
      label: t.label,
      href: t.href ?? "",
      visible: t.visible,
      children: rows
        .filter((r) => r.parent_id === t.id)
        .map((c) => ({ label: c.label, href: c.href ?? "", visible: c.visible })),
    }));
  } else {
    const tree = await getNavTree();
    items = tree.map((t) => ({
      label: t.label,
      href: t.href ?? "",
      visible: true,
      children: (t.dropdown ?? []).map((c) => ({
        label: c.label,
        href: c.href,
        visible: true,
      })),
    }));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Nawigacja</h1>
        <p className="text-slate-500 mt-1 max-w-2xl">
          Menu górne strony. Pozycja z podpunktami działa jak rozwijana lista;
          adres pozycji nadrzędnej jest opcjonalny. Własne podstrony dodasz do
          menu też z poziomu ich edytora (checkbox „pokaż w menu”).
        </p>
      </div>
      <NavEditor initialItems={items} />
    </div>
  );
}
