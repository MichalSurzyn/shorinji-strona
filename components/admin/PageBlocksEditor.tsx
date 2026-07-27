"use client";

import Link from "next/link";
import { useState } from "react";
import { savePageContent } from "@/actions/pageActions";
import type { NewsBlock, PageContent } from "@/lib/newsTypes";
import BlockEditor from "./BlockEditor";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

/**
 * Edytor całej strony: nagłówek (etykietka, H1, lead) + bloki treści.
 * Wszystko trafia do bazy - strona renderuje wyłącznie to, co tu zapiszesz.
 */
export default function PageBlocksEditor({
  slug,
  label,
  route,
  scope,
  initialContent,
}: {
  slug: string;
  label: string;
  route: string;
  scope: string;
  initialContent: PageContent;
}) {
  const [kicker, setKicker] = useState(initialContent.kicker ?? "");
  const [title, setTitle] = useState(initialContent.title ?? "");
  const [lead, setLead] = useState(initialContent.lead ?? "");
  const [blocks, setBlocks] = useState<NewsBlock[]>(initialContent.blocks);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const res = await savePageContent(slug, { kicker, title, lead, blocks });
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Zapisano. Zmiany są już widoczne na stronie." }
        : { ok: false, text: res.error }
    );
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

      {/* Nagłówek strony */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold">Nagłówek strony</h2>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Etykietka nad tytułem (żółta, opcjonalna - np. „Materiały szkoleniowe")
          </label>
          <input value={kicker} onChange={(e) => setKicker(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Tytuł (H1)
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} text-lg font-bold`}
          />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Akapit wprowadzający (pod tytułem, opcjonalny)
          </label>
          <textarea
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>
      </div>

      <BlockEditor value={blocks} onChange={setBlocks} mode="page" />

      <div className="flex justify-end">
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
