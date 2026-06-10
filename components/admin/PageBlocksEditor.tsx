"use client";

import Link from "next/link";
import { useState } from "react";
import { resetPageBlocks, savePageBlocks } from "@/actions/pageActions";
import type { NewsBlock } from "@/lib/newsTypes";
import BlockEditor from "./BlockEditor";

export default function PageBlocksEditor({
  slug,
  label,
  route,
  scope,
  initialBlocks,
  baseBlocks,
  overridden,
}: {
  slug: string;
  label: string;
  route: string;
  scope: string;
  initialBlocks: NewsBlock[];
  baseBlocks: NewsBlock[];
  overridden: boolean;
}) {
  const [blocks, setBlocks] = useState<NewsBlock[]>(initialBlocks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const res = await savePageBlocks(slug, blocks);
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Zapisano. Zmiany są już widoczne na stronie." }
        : { ok: false, text: res.error }
    );
  }

  async function handleReset() {
    if (
      !confirm(
        "Przywrócić oryginalną wersję z kodu strony? Zmiany zapisane w panelu zostaną usunięte."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    const res = await resetPageBlocks(slug);
    setBusy(false);
    if (res.ok) {
      setBlocks(baseBlocks);
      setMsg({
        ok: true,
        text: "Przywrócono wersję bazową - strona znów pokazuje oryginalny wygląd z kodu.",
      });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin/strony"
            className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
          >
            ← Wszystkie podstrony
          </Link>
          <h1 className="text-2xl font-bold mt-1">{label}</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">{scope}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={route}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Podgląd ↗
          </a>
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold transition-colors"
          >
            {busy ? "Zapisywanie..." : "Zapisz zmiany"}
          </button>
        </div>
      </div>

      {overridden && !msg && (
        <p className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2.5 text-sm">
          Ta strona ma zmiany zapisane w panelu (nadpisują wersję z kodu).
        </p>
      )}
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

      <BlockEditor value={blocks} onChange={setBlocks} mode="page" />

      <div className="flex flex-wrap justify-between gap-3">
        <button
          onClick={handleReset}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
        >
          Przywróć wersję bazową
        </button>
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Zapisywanie..." : "Zapisz zmiany"}
        </button>
      </div>
    </div>
  );
}
