"use client";

import { useState } from "react";
import { migrateAllContent } from "@/actions/migrateActions";

/** Jednorazowe przeniesienie treści bazowych z kodu do Supabase. */
export default function MigrateButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleClick() {
    if (
      !confirm(
        "Przenieść wszystkie treści bazowe do Supabase? Strony już zapisane w bazie zostaną pominięte (nic nie zostanie nadpisane)."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    const res = await migrateAllContent();
    setBusy(false);
    setMsg(
      res.ok
        ? {
            ok: true,
            text: `Gotowe: przeniesiono ${res.inserted}, pominięto ${res.skipped} (już były w bazie). Od teraz baza jest źródłem treści.`,
          }
        : { ok: false, text: res.error }
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600 max-w-xl">
          <span className="font-semibold text-slate-900">
            Treści w bazie danych:
          </span>{" "}
          kliknij, aby jednorazowo przenieść wszystkie treści bazowe z kodu do
          Supabase. Wersja w kodzie zostaje jako awaryjny fallback, gdyby baza
          nie odpowiadała.
        </div>
        <button
          onClick={handleClick}
          disabled={busy}
          className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 text-sm font-semibold transition-colors shrink-0"
        >
          {busy ? "Przenoszenie..." : "Przenieś treści do bazy"}
        </button>
      </div>
      {msg && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
