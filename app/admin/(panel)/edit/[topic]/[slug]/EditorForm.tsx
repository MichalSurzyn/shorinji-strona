"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { saveTopicArticle } from "@/app/admin/actions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import type { NewsBlock } from "@/lib/newsTypes";
import BlockEditor from "@/components/admin/BlockEditor";

type Props = {
  topic: string;
  slug: string;
  topicTitle: string;
  initialTitle: string;
  initialIntro: string;
  initialBlocks: NewsBlock[];
};

export default function EditorForm({
  topic,
  slug,
  topicTitle,
  initialTitle,
  initialIntro,
  initialBlocks,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [intro, setIntro] = useState(initialIntro);
  const [blocks, setBlocks] = useState<NewsBlock[]>(initialBlocks);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [zapisany, setZapisany] = useState({
    title: initialTitle,
    intro: initialIntro,
    blocks: initialBlocks,
  });

  const biezacy = useMemo(() => ({ title, intro, blocks }), [title, intro, blocks]);
  const zmieniono = czyZmieniono(biezacy, zapisany);
  useUnsavedChanges(zmieniono, title || slug);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await saveTopicArticle(topic, slug, { title, intro, blocks });
      if (res.ok) {
        setZapisany({ title, intro, blocks });
        setMsg({ ok: true, text: "Zapisano. Zmiana jest już widoczna na stronie." });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error) });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setSaving(false);
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
          <h1 className="mt-2 text-2xl md:text-3xl font-bold text-slate-900">
            {initialTitle}
          </h1>
          <p className="text-sm text-slate-500">
            {topicTitle} · /{topic}/{slug}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={`/${topic}/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
          >
            Zobacz zapisaną wersję ↗
          </a>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold transition-colors"
          >
            {saving ? "Zapisywanie..." : "Zapisz zmiany"}
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

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">
            Tytuł podstrony
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">
            Wstęp (krótki opis pod tytułem)
          </label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          />
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Treść podstrony
          </h2>
        </div>
        <BlockEditor
          value={blocks}
          onChange={setBlocks}
          defaultFolder={`Strona/${topic}/${slug}`}
        />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-3 font-semibold transition-colors"
        >
          {saving ? "Zapisywanie..." : "Zapisz zmiany"}
        </button>
      </div>
    </div>
  );
}
