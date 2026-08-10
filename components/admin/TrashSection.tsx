"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { opiszBlad } from "@/lib/adminErrors";

export interface PozycjaKosza {
  id: string;
  title: string;
  slug: string;
  deleted_at: string;
  updated_by: string | null;
}

/**
 * Kosz: rzeczy usunięte, z możliwością przywrócenia.
 *
 * Sekcja pokazuje się tylko wtedy, gdy coś w koszu jest - pusty kosz
 * na każdym ekranie byłby szumem.
 *
 * „Usuń na stałe" jest jedyną operacją w panelu bez odwrotu, dlatego jako
 * jedyna prosi o potwierdzenie. Przywracanie potwierdzenia nie wymaga:
 * pomyłka przy przywróceniu kosztuje jedno kliknięcie.
 */
export default function TrashSection({
  tytul,
  pobierz,
  przywroc,
  usunNaStale,
  dniPrzechowywania = 30,
}: {
  tytul: string;
  pobierz: () => Promise<{ ok: true; items: PozycjaKosza[] } | { ok: false; error: string }>;
  przywroc: (id: string) => Promise<{ ok: boolean; error?: string }>;
  usunNaStale: (id: string) => Promise<{ ok: boolean; error?: string }>;
  dniPrzechowywania?: number;
}) {
  const router = useRouter();
  const [items, setItems] = useState<PozycjaKosza[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    let aktualne = true;
    pobierz()
      .then((res) => {
        if (!aktualne) return;
        setItems(res.ok ? res.items : []);
        if (!res.ok) setMsg({ ok: false, text: res.error });
      })
      .catch(() => aktualne && setItems([]));
    return () => {
      aktualne = false;
    };
  }, [pobierz]);

  async function obsluz(
    id: string,
    tytulPozycji: string,
    akcja: (id: string) => Promise<{ ok: boolean; error?: string }>,
    naStale: boolean
  ) {
    if (
      naStale &&
      !confirm(
        `Usunąć „${tytulPozycji}" na stałe?\n\nTo jedyna operacja w panelu, której nie da się cofnąć.`
      )
    )
      return;
    setBusy(id);
    setMsg(null);
    try {
      const res = await akcja(id);
      if (res.ok) {
        setItems((p) => (p ?? []).filter((i) => i.id !== id));
        setMsg({
          ok: true,
          text: naStale ? `Usunięto „${tytulPozycji}" na stałe.` : `Przywrócono „${tytulPozycji}".`,
        });
        router.refresh();
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error, naStale ? "usunąć" : "przywrócić") });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setBusy(null);
    }
  }

  // Pusty kosz nie zajmuje miejsca na ekranie.
  if (!items || items.length === 0) {
    return msg && !msg.ok ? (
      <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
        {msg.text}
      </p>
    ) : null;
  }

  return (
    <section>
      <h2 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold mb-1">
        {tytul}
      </h2>
      <p className="text-sm text-slate-500 mb-3">
        Rzeczy usunięte w ciągu ostatnich {dniPrzechowywania} dni. Później znikają same.
      </p>

      {msg && (
        <div
          role="status"
          className={`mb-3 rounded-lg px-4 py-2.5 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
        {items.map((i) => (
          <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
            <div className="min-w-0">
              <p className="text-sm text-slate-700 truncate">{i.title}</p>
              <p className="text-xs text-slate-400">
                usunięte {new Date(i.deleted_at).toLocaleDateString("pl-PL")}
                {i.updated_by ? ` · ${i.updated_by}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => obsluz(i.id, i.title, przywroc, false)}
                disabled={busy === i.id}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors"
              >
                ↶ Przywróć
              </button>
              <button
                onClick={() => obsluz(i.id, i.title, usunNaStale, true)}
                disabled={busy === i.id}
                className="rounded-lg border border-red-300 text-red-600 px-3.5 py-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
              >
                Usuń na stałe
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
