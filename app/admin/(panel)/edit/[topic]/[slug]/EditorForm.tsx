"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Article } from "@/data/articles/types";
import { saveArticleAction } from "@/app/admin/actions";
import { blocksToSections, sectionsToBlocks } from "@/lib/blockConvert";
import { parseMarkdownToSections, serializeArticleToMarkdown } from "@/lib/markdown";
import type { NewsBlock } from "@/lib/newsTypes";
import BlockEditor from "@/components/admin/BlockEditor";

type Props = {
  topic: string;
  slug: string;
  topicTitle: string;
  initialTitle: string;
  initialIntro: string;
  initialBody: string;
  baseMarkdown: string;
  saved?: boolean;
  error?: string;
};

function markdownToBlocks(md: string): NewsBlock[] {
  return sectionsToBlocks(parseMarkdownToSections(md));
}

function blocksToMarkdown(blocks: NewsBlock[]): string {
  const article = { sections: blocksToSections(blocks) } as Article;
  return serializeArticleToMarkdown(article);
}

export default function EditorForm({
  topic,
  slug,
  topicTitle,
  initialTitle,
  initialIntro,
  initialBody,
  baseMarkdown,
  saved,
  error,
}: Props) {
  const [title, setTitle] = useState(initialTitle);
  const [intro, setIntro] = useState(initialIntro);
  const [blocks, setBlocks] = useState<NewsBlock[]>(() =>
    markdownToBlocks(initialBody)
  );

  // Markdown liczony na bieżąco - trafia do ukrytego pola formularza,
  // więc zapis (server action) działa dokładnie jak dotychczas.
  const bodyMd = useMemo(() => blocksToMarkdown(blocks), [blocks]);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
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
        <a
          href={`/${topic}/${slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
        >
          Podgląd ↗
        </a>
      </div>

      {saved && (
        <p className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Zapisano. Zmiana jest już widoczna na stronie.
        </p>
      )}
      {error && (
        <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Nie udało się zapisać: {error}
        </p>
      )}

      <form action={saveArticleAction} className="space-y-6">
        <input type="hidden" name="topic" value={topic} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="body_md" value={bodyMd} />

        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-2">
              Tytuł podstrony
            </label>
            <input
              name="title"
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
              name="intro"
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
            <button
              type="button"
              onClick={() => {
                if (
                  confirm(
                    "Wczytać oryginalną treść z kodu strony? Zastąpi obecną zawartość edytora."
                  )
                ) {
                  setBlocks(markdownToBlocks(baseMarkdown));
                }
              }}
              className="text-xs text-slate-400 hover:text-indigo-600 transition-colors"
            >
              Przywróć treść bazową
            </button>
          </div>
          <BlockEditor
            value={blocks}
            onChange={setBlocks}
            mode="article"
            defaultFolder={`Strona/${topic}/${slug}`}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 transition-colors px-6 py-3 font-semibold text-white"
          >
            Zapisz zmiany
          </button>
        </div>
      </form>
    </div>
  );
}
