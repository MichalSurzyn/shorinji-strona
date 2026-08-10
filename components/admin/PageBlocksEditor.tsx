"use client";

import { useMemo, useState } from "react";
import { savePageContent } from "@/actions/pageActions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import type { NewsBlock, PageContent } from "@/lib/newsTypes";
import BlockEditor from "./BlockEditor";
import PasekAkcji from "./PasekAkcji";

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
  // Ostatni stan potwierdzony zapisem - punkt odniesienia dla ostrzeżenia
  // o niezapisanych zmianach.
  const [zapisany, setZapisany] = useState(initialContent);

  const biezacy = useMemo(
    () => ({ kicker, title, lead, blocks }),
    [kicker, title, lead, blocks]
  );
  const zmieniono = czyZmieniono(biezacy, {
    kicker: zapisany.kicker ?? "",
    title: zapisany.title ?? "",
    lead: zapisany.lead ?? "",
    blocks: zapisany.blocks,
  });
  useUnsavedChanges(zmieniono, label);

  async function handleSave() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await savePageContent(slug, { kicker, title, lead, blocks });
      if (res.ok) {
        setZapisany({ kicker, title, lead, blocks });
        setMsg({ ok: true, text: "Zapisano. Zmiany są już widoczne na stronie." });
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error) });
      }
    } catch (e) {
      // Bez tego wyjątek (wygasła sesja, brak sieci) zostawiał przycisk
      // w stanie „Zapisywanie..." na zawsze i redaktor nie wiedział,
      // czy tekst się zapisał.
      setMsg({ ok: false, text: opiszBlad(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PasekAkcji
        powrotHref="/admin/strony"
        tytul={label}
        opis={scope}
        zmieniono={zmieniono}
        busy={busy}
        podglad={route}
        onZapisz={handleSave}
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

      {/* Nagłówek strony */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold">Góra strony</h2>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Nadtytuł <span className="font-normal text-slate-400">(opcjonalny)</span>
          </label>
          <p className="text-xs text-slate-500 mb-1.5">
            Krótkie słowo nad tytułem, żółtymi literami. Na przykład: Zawody,
            Egzaminy, Materiały szkoleniowe.
          </p>
          <input value={kicker} onChange={(e) => setKicker(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Tytuł strony</label>
          <p className="text-xs text-slate-500 mb-1.5">
            Duży napis na samej górze strony.
          </p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={`${inputCls} text-lg font-bold`}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Wprowadzenie <span className="font-normal text-slate-400">(opcjonalne)</span>
          </label>
          <p className="text-xs text-slate-500 mb-1.5">
            Dwa, trzy zdania pod tytułem, wyróżnione większą czcionką.
          </p>
          <textarea
            value={lead}
            onChange={(e) => setLead(e.target.value)}
            rows={3}
            className={inputCls}
          />
        </div>
      </div>

      <BlockEditor value={blocks} onChange={setBlocks} mode="page" />

    </div>
  );
}
