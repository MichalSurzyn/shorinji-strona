"use client";

import Link from "next/link";
import { useState } from "react";
import { resetFooter, saveFooter } from "@/actions/footerActions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import type { FooterData, FooterLink } from "@/lib/footerTypes";
import PasekAkcji from "./PasekAkcji";

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
  const [zapisany, setZapisany] = useState<FooterData>(initialData);

  const zmieniono = czyZmieniono(data, zapisany);
  useUnsavedChanges(zmieniono, "Stopka strony");

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await saveFooter(data);
      if (res.ok) {
        setZapisany(data);
        setMsg({ ok: true, text: "Zapisano. Stopka na stronie jest już zaktualizowana." });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error) });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset() {
    if (
      !confirm(
        "Przywrócić startową wersję stopki?\n\nWróci układ z dnia uruchomienia strony. Wszystkie Twoje zmiany w stopce zostaną skasowane."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await resetFooter();
      if (res.ok) {
        setMsg({
          ok: true,
          text: "Przywrócono startową wersję stopki. Odśwież stronę, żeby zobaczyć wczytane wartości.",
        });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error, "przywrócić stopki") });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "przywrócić stopki") });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <PasekAkcji
        tytul="Stopka strony"
        opis="Odnośniki, dokumenty i pliki do pobrania widoczne na dole każdej strony."
        zmieniono={zmieniono}
        busy={busy}
        podglad="/"
        onZapisz={handleSave}
        dodatkowe={
          <button
            onClick={handleReset}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap"
          >
            Przywróć startową stopkę
          </button>
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

      <LinkListEditor
        title="Linki (pierwsza kolumna stopki)"
        hint="Przydatne odnośniki - np. organizacje Shorinji Kempo, kanały YouTube."
        links={data.links}
        onChange={(links) => setData({ ...data, links })}
      />

      {/* Kontakt, profile spolecznosciowe i nazwa po znaku (c) przeniesione
          do zakladki "Dane organizacji". Trzymanie ich w dwoch miejscach
          znaczylo, ze redaktor mogl wpisac jeden numer tutaj, a inny widnial
          na mapie i w danych dla Google - i nic tego nie pilnowalo. */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="font-bold text-slate-900">Telefon, e-mail, adres i profile</h2>
        <p className="text-sm text-slate-600 mt-1">
          Te dane ustawia się w jednym miejscu, w zakładce{" "}
          <Link href="/admin/dane-organizacji" className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800">
            Dane organizacji
          </Link>
          . Zmiana tam poprawia je od razu w stopce, na stronie Kontakt, na mapie
          i w wizytówce Google.
        </p>
      </div>

    </div>
  );
}
