"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createCustomPage,
  deleteCustomPage,
  saveCustomPage,
  type CustomPageInput,
} from "@/actions/customPageActions";
import type { CustomPage } from "@/lib/customPages";
import type { NewsBlock } from "@/lib/newsTypes";
import BlockEditor from "./BlockEditor";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ż/g, "z").replace(/ź/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function CustomPageEditor({
  page,
  initialInMenu,
}: {
  page: CustomPage | null;
  initialInMenu: boolean;
}) {
  const router = useRouter();
  const isNew = page === null;

  const [title, setTitle] = useState(page?.title ?? "");
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [intro, setIntro] = useState(page?.intro ?? "");
  const [published, setPublished] = useState(page?.published ?? true);
  const [inMenu, setInMenu] = useState(initialInMenu);
  const [blocks, setBlocks] = useState<NewsBlock[]>(page?.blocks ?? []);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function buildInput(): CustomPageInput {
    return {
      slug: slug || slugify(title),
      title,
      intro: intro.trim() || null,
      blocks,
      published,
      inMenu,
    };
  }

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const input = buildInput();
    if (isNew) {
      const res = await createCustomPage(input);
      setBusy(false);
      if (res.ok) {
        router.replace(`/admin/wlasne/${res.id}`);
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    } else {
      const res = await saveCustomPage(page.id, input);
      setBusy(false);
      setMsg(
        res.ok
          ? { ok: true, text: "Zapisano. Zmiany są już widoczne na stronie." }
          : { ok: false, text: res.error }
      );
    }
  }

  async function handleDelete() {
    if (!page) return;
    if (
      !confirm(
        `Na pewno usunąć podstronę „${page.title}"? Zniknie ze strony i z menu. Tej operacji nie można cofnąć.`
      )
    )
      return;
    const res = await deleteCustomPage(page.id);
    if (res.ok) {
      router.replace("/admin/strony");
      router.refresh();
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/strony"
            className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
          >
            ← Wszystkie podstrony
          </Link>
          <h1 className="text-2xl font-bold mt-1">
            {isNew ? "Nowa podstrona" : "Edycja podstrony"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {!isNew && (
            <>
              <a
                href={`/${slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Podgląd ↗
              </a>
              <button
                onClick={handleDelete}
                className="rounded-lg border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors"
              >
                Usuń
              </button>
            </>
          )}
          <button
            onClick={handleSave}
            disabled={busy}
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2 text-sm font-semibold transition-colors"
          >
            {busy ? "Zapisywanie..." : isNew ? "Utwórz podstronę" : "Zapisz zmiany"}
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
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Tytuł
          </label>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (!slugTouched) setSlug(slugify(e.target.value));
            }}
            placeholder="Tytuł podstrony"
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Adres (slug)
            </label>
            <input
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(slugify(e.target.value));
              }}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-xs text-slate-400 mt-1">/{slug || "..."}</p>
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              Opublikowana (widoczna na stronie)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={inMenu}
                onChange={(e) => setInMenu(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              Pokaż w menu górnym (pozycję zmienisz w zakładce Nawigacja)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Wstęp (krótki opis pod tytułem, opcjonalnie)
          </label>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Treść podstrony
        </h2>
        <BlockEditor value={blocks} onChange={setBlocks} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={busy}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-6 py-2.5 text-sm font-semibold transition-colors"
        >
          {busy ? "Zapisywanie..." : isNew ? "Utwórz podstronę" : "Zapisz zmiany"}
        </button>
      </div>
    </div>
  );
}
