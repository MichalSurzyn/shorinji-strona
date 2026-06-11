"use client";

import { useState } from "react";
import { saveNavTree, type NavTreeInput } from "@/actions/navActions";

type Child = { label: string; href: string; visible: boolean };
type Item = { label: string; href: string; visible: boolean; children: Child[] };

export default function NavEditor({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    setItems(next);
  }

  function updateChild(i: number, ci: number, patch: Partial<Child>) {
    setItems((prev) =>
      prev.map((it, idx) =>
        idx === i
          ? {
              ...it,
              children: it.children.map((c, cj) =>
                cj === ci ? { ...c, ...patch } : c
              ),
            }
          : it
      )
    );
  }

  function moveChild(i: number, ci: number, dir: -1 | 1) {
    const item = items[i];
    const cj = ci + dir;
    if (cj < 0 || cj >= item.children.length) return;
    const children = [...item.children];
    [children[ci], children[cj]] = [children[cj], children[ci]];
    update(i, { children });
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const payload: NavTreeInput[] = items.map((it) => ({
      label: it.label,
      href: it.href.trim() || null,
      visible: it.visible,
      children: it.children.map((c) => ({
        label: c.label,
        href: c.href,
        visible: c.visible,
      })),
    }));
    const res = await saveNavTree(payload);
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Zapisano. Menu na stronie jest już zaktualizowane." }
        : { ok: false, text: res.error }
    );
  }

  const inputCls =
    "rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

  return (
    <div className="space-y-4">
      {msg && (
        <div
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      {items.map((item, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="p-4 grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
            <input
              value={item.label}
              onChange={(e) => update(i, { label: e.target.value })}
              placeholder="Etykieta (np. CENNIK)"
              className={`${inputCls} font-semibold uppercase`}
            />
            <input
              value={item.href}
              onChange={(e) => update(i, { href: e.target.value })}
              placeholder="Adres (np. /cennik) - puste gdy tylko rozwijane"
              className={`${inputCls} font-mono`}
            />
            <div className="flex items-center gap-1 text-slate-400 justify-end">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Wyżej"
                type="button"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === items.length - 1}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Niżej"
                type="button"
              >
                ↓
              </button>
              <button
                onClick={() => {
                  if (confirm(`Usunąć pozycję „${item.label}" z menu (wraz z podpunktami)?`))
                    setItems((prev) => prev.filter((_, idx) => idx !== i));
                }}
                className="p-1.5 hover:text-red-600 transition-colors"
                title="Usuń pozycję"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Podpunkty (dropdown) */}
          <div className="px-4 pb-4 pl-8 space-y-2">
            {item.children.map((child, ci) => (
              <div
                key={ci}
                className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center"
              >
                <input
                  value={child.label}
                  onChange={(e) => updateChild(i, ci, { label: e.target.value })}
                  placeholder="Etykieta podpunktu"
                  className={inputCls}
                />
                <input
                  value={child.href}
                  onChange={(e) => updateChild(i, ci, { href: e.target.value })}
                  placeholder="/adres"
                  className={`${inputCls} font-mono`}
                />
                <div className="flex items-center gap-1 text-slate-400 justify-end">
                  <button
                    onClick={() => moveChild(i, ci, -1)}
                    disabled={ci === 0}
                    className="p-1 hover:text-indigo-600 disabled:opacity-30"
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    onClick={() => moveChild(i, ci, 1)}
                    disabled={ci === item.children.length - 1}
                    className="p-1 hover:text-indigo-600 disabled:opacity-30"
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() =>
                      update(i, { children: item.children.filter((_, cj) => cj !== ci) })
                    }
                    className="p-1 hover:text-red-600"
                    title="Usuń podpunkt"
                    type="button"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                update(i, {
                  children: [...item.children, { label: "", href: "", visible: true }],
                })
              }
              type="button"
              className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              + Dodaj podpunkt (rozwijane menu)
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() =>
          setItems((prev) => [
            ...prev,
            { label: "", href: "", visible: true, children: [] },
          ])
        }
        type="button"
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj pozycję menu
      </button>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Zapisywanie..." : "Zapisz menu"}
        </button>
      </div>
    </div>
  );
}
