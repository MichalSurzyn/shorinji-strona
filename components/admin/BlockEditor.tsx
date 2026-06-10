"use client";

import { useRef, useState } from "react";
import type { NewsBlock } from "@/lib/newsTypes";
import { clThumb } from "@/lib/cloudinary";
import ImagePicker from "./ImagePicker";

/**
 * Tryby edytora:
 * - "news"    – aktualności (wszystkie bloki, żółte wyróżnienie)
 * - "page"    – strony statyczne (jak news)
 * - "article" – podstrony tematyczne (zapis do markdown: bez galerii,
 *               tabel, linków-kafelków i wyróżnienia ==żółtego==)
 */
export type EditorMode = "news" | "page" | "article";

interface Props {
  value: NewsBlock[];
  onChange: (blocks: NewsBlock[]) => void;
  mode?: EditorMode;
  /** Folder Cloudinary podpowiadany w wyborze zdjęć. */
  defaultFolder?: string;
}

const BLOCK_LABELS: Record<NewsBlock["type"], string> = {
  heading: "Nagłówek",
  subheading: "Podtytuł",
  paragraph: "Akapit",
  callout: "Wyróżnienie (ramka)",
  quote: "Cytat",
  list: "Lista",
  ordered: "Lista numerowana",
  image: "Zdjęcie",
  gallery: "Galeria",
  table: "Tabela opłat",
  links: "Linki / nagrania",
};

const ALL_ADD_OPTIONS: { type: NewsBlock["type"]; label: string; icon: string }[] = [
  { type: "paragraph", label: "Akapit", icon: "¶" },
  { type: "heading", label: "Nagłówek", icon: "H" },
  { type: "subheading", label: "Podtytuł", icon: "h" },
  { type: "list", label: "Lista", icon: "≡" },
  { type: "ordered", label: "Lista 1-2-3", icon: "①" },
  { type: "quote", label: "Cytat", icon: "❝" },
  { type: "callout", label: "Wyróżnienie", icon: "▢" },
  { type: "image", label: "Zdjęcie", icon: "▣" },
  { type: "gallery", label: "Galeria", icon: "▦" },
  { type: "table", label: "Tabela opłat", icon: "𝄜" },
  { type: "links", label: "Linki / nagrania", icon: "▶" },
];

const MODE_BLOCKS: Record<EditorMode, NewsBlock["type"][]> = {
  news: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "callout", "image", "gallery", "table", "links"],
  page: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "callout", "image", "gallery", "table", "links"],
  article: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "image"],
};

function newBlock(type: NewsBlock["type"]): NewsBlock {
  switch (type) {
    case "list":
    case "ordered":
      return { type, items: [""] } as NewsBlock;
    case "image":
      return { type: "image", publicId: "", caption: "", variant: "wide" };
    case "gallery":
      return { type: "gallery", publicIds: [] };
    case "table":
      return { type: "table", headers: ["Rodzaj opłaty", "Kwota"], rows: [{ label: "", price: "" }] };
    case "links":
      return { type: "links", items: [{ label: "", url: "" }] };
    default:
      return { type, text: "" } as NewsBlock;
  }
}

/** Edytor blokowy - bez markdownu, zdjęcia wybierasz wizualnie. */
export default function BlockEditor({
  value,
  onChange,
  mode = "news",
  defaultFolder,
}: Props) {
  const [picker, setPicker] = useState<{ index: number; multi: boolean } | null>(
    null
  );

  function update(index: number, block: NewsBlock) {
    const next = [...value];
    next[index] = block;
    onChange(next);
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  }

  function add(type: NewsBlock["type"]) {
    onChange([...value, newBlock(type)]);
    if (type === "image") setPicker({ index: value.length, multi: false });
    if (type === "gallery") setPicker({ index: value.length, multi: true });
  }

  function handlePicked(publicIds: string[]) {
    if (!picker) return;
    const block = value[picker.index];
    if (!block) return;
    if (block.type === "image") {
      update(picker.index, { ...block, publicId: publicIds[0] });
    } else if (block.type === "gallery") {
      update(picker.index, {
        ...block,
        publicIds: [...block.publicIds, ...publicIds],
      });
    }
  }

  const addOptions = ALL_ADD_OPTIONS.filter((o) =>
    MODE_BLOCKS[mode].includes(o.type)
  );

  return (
    <div className="space-y-3">
      {/* Pomoc - formatowanie (prawy rog) */}
      <div className="flex justify-end">
        <details className="group relative z-10 text-sm">
          <summary className="cursor-pointer select-none rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 px-3.5 py-1.5 font-medium hover:bg-indigo-100 transition-colors list-none">
            ⓘ Pomoc – formatowanie
          </summary>
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl p-4 text-slate-600 space-y-2">
            <p className="font-semibold text-slate-900">W tekście możesz użyć:</p>
            <p>
              <code className="bg-slate-100 px-1 rounded">**pogrubienie**</code>{" "}
              → <strong>pogrubienie</strong>
            </p>
            {mode !== "article" && (
              <p>
                <code className="bg-slate-100 px-1 rounded">==wyróżnienie==</code>{" "}
                → <span className="text-yellow-600">żółty kolor strony</span>
              </p>
            )}
            <p>
              <code className="bg-slate-100 px-1 rounded">[tekst](/adres)</code>{" "}
              → <span className="text-indigo-600 underline">link</span> (np.{" "}
              <code className="bg-slate-100 px-1 rounded">[cennik](/cennik)</code>)
            </p>
            <p className="pt-1 border-t border-slate-100">
              Najszybciej: <strong>zaznacz tekst</strong> i kliknij przycisk{" "}
              <strong>B</strong>{mode !== "article" && ", Żółty"} albo{" "}
              <strong>Link</strong> nad polem.
            </p>
            <p>
              <strong>Zdjęcia</strong> dodajesz blokiem „Zdjęcie" – wybierasz
              z Cloudinary albo wgrywasz z dysku, zero kodu.
            </p>
          </div>
        </details>
      </div>

      {value.length === 0 && (
        <p className="text-sm text-slate-400 border border-dashed border-slate-300 rounded-xl p-6 text-center">
          Brak treści - dodaj pierwszy blok poniżej.
        </p>
      )}

      {value.map((block, i) => (
        <div key={i} className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Przenieś wyżej"
                type="button"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Przenieś niżej"
                type="button"
              >
                ↓
              </button>
              <button
                onClick={() => remove(i)}
                className="p-1.5 hover:text-red-600 transition-colors"
                title="Usuń blok"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-4">
            <BlockBody
              block={block}
              mode={mode}
              onChange={(b) => update(i, b)}
              openPicker={(multi) => setPicker({ index: i, multi })}
            />
          </div>
        </div>
      ))}

      <div className="border border-dashed border-slate-300 rounded-xl p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Dodaj blok
        </p>
        <div className="flex flex-wrap gap-2">
          {addOptions.map((opt) => (
            <button
              key={opt.type}
              onClick={() => add(opt.type)}
              type="button"
              className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
            >
              <span className="text-indigo-500 font-bold">{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <ImagePicker
        open={picker !== null}
        multi={picker?.multi ?? false}
        defaultFolder={defaultFolder}
        onClose={() => setPicker(null)}
        onSelect={handlePicked}
      />
    </div>
  );
}

/* ----------------------------- Bloki ----------------------------- */

function BlockBody({
  block,
  mode,
  onChange,
  openPicker,
}: {
  block: NewsBlock;
  mode: EditorMode;
  onChange: (b: NewsBlock) => void;
  openPicker: (multi: boolean) => void;
}) {
  switch (block.type) {
    case "heading":
    case "subheading":
      return (
        <input
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Treść nagłówka..."
          className={`w-full rounded-lg border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            block.type === "heading" ? "text-lg font-bold" : "font-semibold"
          }`}
        />
      );
    case "paragraph":
    case "callout":
    case "quote":
      return <TextAreaWithFormat block={block} mode={mode} onChange={onChange} />;
    case "list":
    case "ordered":
      return (
        <div>
          <textarea
            value={block.items.join("\n")}
            onChange={(e) =>
              onChange({ ...block, items: e.target.value.split("\n") })
            }
            rows={Math.max(3, block.items.length + 1)}
            placeholder={"Pierwszy punkt\nDrugi punkt\nTrzeci punkt"}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Każda linia = jeden punkt listy.
          </p>
        </div>
      );
    case "image":
      return (
        <div className="flex flex-col sm:flex-row gap-4">
          {block.publicId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clThumb(block.publicId, 300)}
              alt=""
              className="w-full sm:w-40 h-40 object-cover rounded-lg border border-slate-200"
            />
          ) : (
            <div className="w-full sm:w-40 h-40 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">
              Brak zdjęcia
            </div>
          )}
          <div className="flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => openPicker(false)}
                type="button"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
              >
                {block.publicId ? "Zmień zdjęcie" : "Wybierz zdjęcie"}
              </button>
              <select
                value={block.variant ?? "wide"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    variant: e.target.value as "wide" | "portrait",
                  })
                }
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                title="Układ zdjęcia na stronie"
              >
                <option value="wide">Szerokie</option>
                <option value="portrait">Pionowe (węższe)</option>
              </select>
            </div>
            <input
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder="Podpis pod zdjęciem (opcjonalnie)"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      );
    case "gallery":
      return (
        <div>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 mb-3">
            {block.publicIds.map((pid) => (
              <div key={pid} className="relative group aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clThumb(pid, 200)}
                  alt=""
                  className="w-full h-full object-cover rounded-lg border border-slate-200"
                />
                <button
                  onClick={() =>
                    onChange({
                      ...block,
                      publicIds: block.publicIds.filter((p) => p !== pid),
                    })
                  }
                  type="button"
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Usuń z galerii"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => openPicker(true)}
            type="button"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 transition-colors"
          >
            + Dodaj zdjęcia
          </button>
        </div>
      );
    case "table":
      return <TableEditor block={block} onChange={onChange} />;
    case "links":
      return <LinksEditor block={block} onChange={onChange} />;
    default:
      return null;
  }
}

/* ------------------------ Tabela opłat ------------------------ */

function TableEditor({
  block,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "table" }>;
  onChange: (b: NewsBlock) => void;
}) {
  const headers = block.headers ?? ["Rodzaj opłaty", "Kwota"];

  function setRow(i: number, patch: Partial<(typeof block.rows)[number]>) {
    const rows = block.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange({ ...block, rows });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_8rem_2rem] gap-2">
        <input
          value={headers[0]}
          onChange={(e) =>
            onChange({ ...block, headers: [e.target.value, headers[1]] })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Nagłówek kolumny"
        />
        <input
          value={headers[1]}
          onChange={(e) =>
            onChange({ ...block, headers: [headers[0], e.target.value] })
          }
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs uppercase tracking-wider font-semibold text-slate-500 text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="Nagłówek"
        />
        <span />
      </div>
      {block.rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_8rem_2rem] gap-2 items-center">
          <div className="flex gap-2">
            <input
              value={row.label}
              onChange={(e) => setRow(i, { label: e.target.value })}
              placeholder="Pozycja (np. 5 Kyu)"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              value={row.note ?? ""}
              onChange={(e) => setRow(i, { note: e.target.value })}
              placeholder="dopisek (opcjonalnie)"
              className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-xs italic text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <input
            value={row.price}
            onChange={(e) => setRow(i, { price: e.target.value })}
            placeholder="np. 80 zł"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-right font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() =>
              onChange({ ...block, rows: block.rows.filter((_, idx) => idx !== i) })
            }
            className="text-slate-400 hover:text-red-600 transition-colors"
            title="Usuń wiersz"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({ ...block, rows: [...block.rows, { label: "", price: "" }] })
        }
        className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj wiersz
      </button>
    </div>
  );
}

/* ------------------------ Linki / nagrania ------------------------ */

function LinksEditor({
  block,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "links" }>;
  onChange: (b: NewsBlock) => void;
}) {
  function setItem(i: number, patch: Partial<(typeof block.items)[number]>) {
    const items = block.items.map((r, idx) =>
      idx === i ? { ...r, ...patch } : r
    );
    onChange({ ...block, items });
  }

  return (
    <div className="space-y-2">
      {block.items.map((item, i) => (
        <div
          key={i}
          className="grid grid-cols-1 sm:grid-cols-[1fr_1.4fr_2rem] gap-2 items-center"
        >
          <input
            value={item.label}
            onChange={(e) => setItem(i, { label: e.target.value })}
            placeholder="Nazwa (np. Mae Ukemi 1)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            value={item.url}
            onChange={(e) => setItem(i, { url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...block,
                items: block.items.filter((_, idx) => idx !== i),
              })
            }
            className="text-slate-400 hover:text-red-600 transition-colors justify-self-center"
            title="Usuń link"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() =>
          onChange({ ...block, items: [...block.items, { label: "", url: "" }] })
        }
        className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj link
      </button>
    </div>
  );
}

/* ---------------- Pole tekstowe z formatowaniem ---------------- */

function TextAreaWithFormat({
  block,
  mode,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "paragraph" | "callout" | "quote" }>;
  mode: EditorMode;
  onChange: (b: NewsBlock) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const selected = s === e ? "tekst" : v.slice(s, e);
    const next = v.slice(0, s) + before + selected + after + v.slice(e);
    onChange({ ...block, text: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function makeLink() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const selected = s === e ? "tekst linku" : v.slice(s, e);
    const snippet = `[${selected}](/adres)`;
    const next = v.slice(0, s) + snippet + v.slice(e);
    onChange({ ...block, text: next });
    requestAnimationFrame(() => {
      el.focus();
      const addrStart = s + selected.length + 3;
      el.setSelectionRange(addrStart, addrStart + 6);
    });
  }

  return (
    <div>
      <div className="flex gap-1.5 mb-2">
        <button
          onClick={() => wrap("**")}
          type="button"
          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-bold hover:bg-slate-100 transition-colors"
          title="Pogrub zaznaczony tekst"
        >
          B
        </button>
        {mode !== "article" && (
          <button
            onClick={() => wrap("==")}
            type="button"
            className="rounded-md border border-yellow-400 bg-yellow-50 px-2.5 py-1 text-xs font-bold text-yellow-700 hover:bg-yellow-100 transition-colors"
            title="Żółte wyróżnienie (kolor strony)"
          >
            Żółty
          </button>
        )}
        <button
          onClick={makeLink}
          type="button"
          className="rounded-md border border-indigo-300 bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
          title="Zamień zaznaczenie w link"
        >
          Link
        </button>
        <span className="text-xs text-slate-400 self-center ml-1">
          zaznacz tekst i kliknij
        </span>
      </div>
      <textarea
        ref={ref}
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        rows={Math.max(3, Math.ceil(block.text.length / 90))}
        placeholder="Wpisz treść..."
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500"
      />
    </div>
  );
}
