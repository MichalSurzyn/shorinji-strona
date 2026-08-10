"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  createNewsArticle,
  deleteNewsArticle,
  saveNewsArticle,
  type NewsInput,
} from "@/actions/newsActions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { clThumb } from "@/lib/cloudinary";
import type { NewsArticle, NewsBlock } from "@/lib/newsTypes";
import BlockEditor from "./BlockEditor";
import ImagePicker from "./ImagePicker";
import PasekAkcji from "./PasekAkcji";

function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ż/g, "z").replace(/ź/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function ArticleEditor({
  article,
}: {
  article: NewsArticle | null;
}) {
  const router = useRouter();
  const isNew = article === null;

  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [cover, setCover] = useState(article?.cover_image ?? "");
  const [published, setPublished] = useState(article?.published ?? true);
  const [publishedAt, setPublishedAt] = useState(
    toLocalInput(article?.published_at ?? new Date().toISOString())
  );
  const [blocks, setBlocks] = useState<NewsBlock[]>(article?.content ?? []);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  function buildInput(): NewsInput {
    return {
      slug: slug || slugify(title),
      title,
      excerpt: excerpt.trim() || null,
      cover_image: cover || null,
      content: blocks,
      published,
      published_at: new Date(publishedAt).toISOString(),
    };
  }

  // Stan potwierdzony zapisem - punkt odniesienia dla ostrzeżenia
  // o niezapisanych zmianach.
  const [zapisany, setZapisany] = useState<NewsInput>({
    slug: article?.slug ?? "",
    title: article?.title ?? "",
    excerpt: (article?.excerpt ?? "").trim() || null,
    cover_image: article?.cover_image || null,
    content: article?.content ?? [],
    published: article?.published ?? true,
    published_at: new Date(
      toLocalInput(article?.published_at ?? new Date().toISOString())
    ).toISOString(),
  });

  const biezacy = useMemo(
    () => ({
      slug: slug || slugify(title),
      title,
      excerpt: excerpt.trim() || null,
      cover_image: cover || null,
      content: blocks,
      published,
      published_at: new Date(publishedAt).toISOString(),
    }),
    [slug, title, excerpt, cover, blocks, published, publishedAt]
  );
  const zmieniono = czyZmieniono(biezacy, zapisany);
  useUnsavedChanges(zmieniono, title || "nowy artykuł");

  async function handleSave() {
    if (!title.trim()) {
      setMsg({ ok: false, text: "Artykuł musi mieć tytuł. Wpisz go i zapisz jeszcze raz." });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      const input = buildInput();
      if (isNew) {
        const res = await createNewsArticle(input);
        if (res.ok) {
          setZapisany(input);
          router.replace(`/admin/artykuly/${res.id}`);
          router.refresh();
        } else {
          setMsg({ ok: false, text: opiszBlad(res.error, "utworzyć artykułu") });
        }
      } else {
        const res = await saveNewsArticle(article.id, input);
        if (res.ok) {
          setZapisany(input);
          setMsg({ ok: true, text: "Zapisano. Zmiany są już widoczne na stronie." });
        } else {
          setMsg({ ok: false, text: opiszBlad(res.error) });
        }
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!article) return;
    if (
      !confirm(
        `Na pewno usunąć artykuł „${article.title}"? Tej operacji nie można cofnąć.`
      )
    )
      return;
    try {
      const res = await deleteNewsArticle(article.id);
      if (res.ok) {
        // Artykuł już nie istnieje - zdejmujemy ostrzeżenie, żeby nie
        // blokowało powrotu na listę.
        setZapisany(biezacy);
        router.replace("/admin/artykuly");
        router.refresh();
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error, "usunąć artykułu") });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "usunąć artykułu") });
    }
  }

  return (
    <div className="space-y-6">
      <PasekAkcji
        powrotHref="/admin/artykuly"
        powrotEtykieta="← Aktualności"
        tytul={isNew ? "Nowy artykuł" : title || "Edycja artykułu"}
        zmieniono={zmieniono}
        busy={saving}
        podglad={isNew ? undefined : `/aktualnosci/${slug}`}
        onZapisz={handleSave}
        etykietaZapisu={isNew ? "Utwórz artykuł" : "Zapisz zmiany"}
        dodatkowe={
          isNew ? undefined : (
            <button
              onClick={handleDelete}
              className="rounded-lg border border-red-300 bg-white text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 transition-colors whitespace-nowrap"
            >
              Usuń
            </button>
          )
        }
      />

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
            placeholder="Tytuł artykułu"
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
            <p className="text-xs text-slate-400 mt-1">
              /aktualnosci/{slug || "..."}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Data publikacji
            </label>
            <input
              type="datetime-local"
              value={publishedAt}
              onChange={(e) => setPublishedAt(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <label className="flex items-center gap-2 mt-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
                className="w-4 h-4 accent-indigo-600"
              />
              Opublikowany (widoczny na stronie)
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Zajawka (krótki opis na liście aktualności)
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Zdjęcie okładkowe
          </label>
          <div className="flex items-center gap-4">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clThumb(cover, 300)}
                alt=""
                className="w-32 h-20 object-cover rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-32 h-20 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs">
                Brak
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => setPickerOpen(true)}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {cover ? "Zmień" : "Wybierz"}
              </button>
              {cover && (
                <button
                  onClick={() => setCover("")}
                  className="rounded-lg border border-slate-300 text-sm px-4 py-2 hover:bg-slate-50 transition-colors"
                >
                  Usuń
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Treść artykułu
        </h2>
        <BlockEditor value={blocks} onChange={setBlocks} />
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          {saving ? "Zapisywanie..." : isNew ? "Utwórz artykuł" : "Zapisz zmiany"}
        </button>
      </div>

      <ImagePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(ids) => setCover(ids[0] ?? "")}
      />
    </div>
  );
}
