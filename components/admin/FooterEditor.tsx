"use client";

import { useState } from "react";
import { resetFooter, saveFooter } from "@/actions/footerActions";
import type { FooterData, FooterLink } from "@/lib/footerTypes";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

function LinkListEditor({
  title,
  hint,
  links,
  onChange,
}: {
  title: string;
  hint: string;
  links: FooterLink[];
  onChange: (links: FooterLink[]) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-xs text-slate-400 mt-0.5">{hint}</p>
      </div>
      {links.map((l, i) => (
        <div key={i} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
          <input
            value={l.label}
            onChange={(e) =>
              onChange(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
            }
            placeholder="Nazwa"
            className={inputCls}
          />
          <input
            value={l.href}
            onChange={(e) =>
              onChange(links.map((x, j) => (j === i ? { ...x, href: e.target.value } : x)))
            }
            placeholder="/downloads/plik.pdf lub https://..."
            className={`${inputCls} font-mono`}
          />
          <button
            type="button"
            onClick={() => onChange(links.filter((_, j) => j !== i))}
            className="text-slate-400 hover:text-red-600 transition-colors justify-self-end p-1.5"
            title="Usuń"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...links, { label: "", href: "" }])}
        className="rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj link
      </button>
    </div>
  );
}

export default function FooterEditor({ initialData }: { initialData: FooterData }) {
  const [data, setData] = useState<FooterData>(initialData);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    const res = await saveFooter(data);
    setBusy(false);
    setMsg(
      res.ok
        ? { ok: true, text: "Zapisano. Stopka na stronie jest już zaktualizowana." }
        : { ok: false, text: res.error }
    );
  }

  async function handleReset() {
    if (!confirm("Przywrócić stopkę bazową z kodu strony?")) return;
    setBusy(true);
    setMsg(null);
    const res = await resetFooter();
    setBusy(false);
    if (res.ok) {
      setMsg({ ok: true, text: "Przywrócono wartości bazowe." });
    } else {
      setMsg({ ok: false, text: res.error });
    }
  }

  return (
    <div className="space-y-5">
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
        <h2 className="font-bold">O nas</h2>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Krótki opis (pierwsza kolumna stopki)
          </label>
          <textarea
            value={data.about}
            onChange={(e) => setData({ ...data, about: e.target.value })}
            rows={3}
            className={inputCls}
          />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          {(["facebook", "instagram", "youtube"] as const).map((key) => (
            <div key={key}>
              <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
                {key}
              </label>
              <input
                value={data.social[key]}
                onChange={(e) =>
                  setData({ ...data, social: { ...data.social, [key]: e.target.value } })
                }
                placeholder="https://..."
                className={`${inputCls} font-mono`}
              />
            </div>
          ))}
        </div>
      </div>

      <LinkListEditor
        title="Do pobrania"
        hint="Pliki PDF wgraj do folderu public/downloads w projekcie albo podaj pełny adres URL."
        links={data.downloads}
        onChange={(downloads) => setData({ ...data, downloads })}
      />

      <LinkListEditor
        title="Dokumenty"
        hint="Statuty i regulaminy - jak wyżej."
        links={data.documents}
        onChange={(documents) => setData({ ...data, documents })}
      />

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold">Kontakt</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              Adres - linia 1
            </label>
            <input
              value={data.contact.addressLine1}
              onChange={(e) =>
                setData({ ...data, contact: { ...data.contact, addressLine1: e.target.value } })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              Adres - linia 2
            </label>
            <input
              value={data.contact.addressLine2}
              onChange={(e) =>
                setData({ ...data, contact: { ...data.contact, addressLine2: e.target.value } })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              Telefon (wyświetlany)
            </label>
            <input
              value={data.contact.phoneDisplay}
              onChange={(e) =>
                setData({ ...data, contact: { ...data.contact, phoneDisplay: e.target.value } })
              }
              className={inputCls}
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              Telefon (do połączenia, format +48...)
            </label>
            <input
              value={data.contact.phone}
              onChange={(e) =>
                setData({ ...data, contact: { ...data.contact, phone: e.target.value } })
              }
              className={`${inputCls} font-mono`}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
              E-mail
            </label>
            <input
              value={data.contact.email}
              onChange={(e) =>
                setData({ ...data, contact: { ...data.contact, email: e.target.value } })
              }
              className={`${inputCls} font-mono`}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-slate-500 mb-1.5">
            Stopka praw autorskich (po znaku ©)
          </label>
          <input
            value={data.copyright}
            onChange={(e) => setData({ ...data, copyright: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

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
          {busy ? "Zapisywanie..." : "Zapisz stopkę"}
        </button>
      </div>
    </div>
  );
}
