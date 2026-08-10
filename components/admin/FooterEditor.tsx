"use client";

import Link from "next/link";
import { useState } from "react";
import { saveFooter } from "@/actions/footerActions";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import type { FooterData, FooterKolumna, FooterLink } from "@/lib/footerTypes";
import PasekAkcji from "./PasekAkcji";
import FilePicker from "./FilePicker";

const inputCls =
  "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";

/** Lista odnośników wewnątrz jednej kolumny. */
function ListaOdnosnikow({
  pozycje,
  onChange,
}: {
  pozycje: FooterLink[];
  onChange: (l: FooterLink[]) => void;
}) {
  const [wybor, setWybor] = useState<number | null>(null);
  const ustaw = (i: number, patch: Partial<FooterLink>) =>
    onChange(pozycje.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  return (
    <div className="space-y-2">
      {pozycje.map((l, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-center">
          <input
            value={l.label}
            onChange={(e) => ustaw(i, { label: e.target.value })}
            placeholder="Nazwa widoczna na stronie"
            className={`${inputCls} flex-1 min-w-[10rem]`}
          />
          <input
            value={l.href}
            onChange={(e) => ustaw(i, { href: e.target.value })}
            placeholder="/downloads/plik.pdf albo https://..."
            className={`${inputCls} flex-1 min-w-[12rem] font-mono text-xs`}
          />
          <button
            onClick={() => setWybor(i)}
            className="shrink-0 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
            title="Wybierz plik z listy zamiast wpisywać adres"
          >
            Wybierz plik
          </button>
          <button
            onClick={() => onChange(pozycje.filter((_, idx) => idx !== i))}
            className="shrink-0 rounded-lg border border-red-300 text-red-600 px-3 py-2 text-sm hover:bg-red-50 transition-colors"
            aria-label="Usuń odnośnik"
          >
            ✕
          </button>
        </div>
      ))}
      <FilePicker
        open={wybor !== null}
        onClose={() => setWybor(null)}
        onSelect={(adres, nazwa) => {
          if (wybor === null) return;
          // Pusta etykieta dostaje nazwę pliku - redaktor i tak ją zwykle
          // poprawia, ale nie zostaje z pustym wierszem.
          const biezaca = pozycje[wybor];
          ustaw(wybor, { href: adres, label: biezaca.label || nazwa });
        }}
      />
      <button
        onClick={() => onChange([...pozycje, { label: "", href: "" }])}
        className="w-full rounded-lg border border-dashed border-slate-300 py-2 text-sm text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj odnośnik
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

  const ustawKolumne = (i: number, patch: Partial<FooterKolumna>) =>
    setData((p) => ({
      ...p,
      kolumny: p.kolumny.map((k, idx) => (idx === i ? { ...k, ...patch } : k)),
    }));

  function przesun(i: number, kierunek: -1 | 1) {
    const cel = i + kierunek;
    if (cel < 0 || cel >= data.kolumny.length) return;
    setData((p) => {
      const next = [...p.kolumny];
      [next[i], next[cel]] = [next[cel], next[i]];
      return { ...p, kolumny: next };
    });
  }

  function dodajKolumne() {
    setData((p) => ({
      ...p,
      kolumny: [
        ...p.kolumny,
        {
          // Identyfikator z licznika, nie z czasu - musi być stabilny
          // i przewidywalny, a kolumn są jednostki.
          id: `kolumna-${p.kolumny.length + 1}`,
          tytul: "NOWA KOLUMNA",
          rodzaj: "linki",
          widoczna: true,
          pokazProfile: false,
          pozycje: [],
        },
      ],
    }));
  }

  function usunKolumne(i: number) {
    const k = data.kolumny[i];
    if (
      !confirm(
        `Usunąć kolumnę „${k.tytul}" razem z ${k.pozycje.length} odnośnikami?\n\n` +
          "Jeśli chcesz ją tylko tymczasowo schować, wyłącz przełącznik Widoczna na stronie zamiast usuwać."
      )
    )
      return;
    setData((p) => ({ ...p, kolumny: p.kolumny.filter((_, idx) => idx !== i) }));
  }

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

  const widocznych = data.kolumny.filter((k) => k.widoczna).length;

  return (
    <div className="space-y-5">
      <PasekAkcji
        tytul="Stopka strony"
        opis="Kolumny widoczne na dole każdej strony. Kolejność tutaj = kolejność na stronie."
        zmieniono={zmieniono}
        busy={busy}
        podglad="/"
        onZapisz={handleSave}
      />

      {msg && (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm ${
            msg.ok
              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
              : "bg-red-50 text-red-700 border border-red-200"
          }`}
        >
          {msg.text}
        </div>
      )}

      <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3">
        Na szerokim ekranie kolumny stoją obok siebie (teraz widocznych: {widocznych}), na tablecie
        po dwie, a na telefonie jedna pod drugą. Nie trzeba nic ustawiać - układ dopasowuje się sam.
      </p>

      {data.kolumny.map((k, i) => (
        <div
          key={k.id}
          className={`rounded-2xl border p-5 space-y-4 ${
            k.widoczna ? "bg-white border-slate-200" : "bg-slate-50 border-slate-200 opacity-75"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-slate-400 shrink-0">{i + 1}.</span>
              <input
                value={k.tytul}
                onChange={(e) => ustawKolumne(i, { tytul: e.target.value })}
                placeholder="Nagłówek kolumny"
                className="rounded-lg border border-slate-300 px-3 py-2 font-semibold text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => przesun(i, -1)}
                disabled={i === 0}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-30 hover:bg-slate-50 transition-colors"
                aria-label="Przesuń w lewo"
                title="Przesuń w lewo"
              >
                ←
              </button>
              <button
                onClick={() => przesun(i, 1)}
                disabled={i === data.kolumny.length - 1}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm disabled:opacity-30 hover:bg-slate-50 transition-colors"
                aria-label="Przesuń w prawo"
                title="Przesuń w prawo"
              >
                →
              </button>
              <button
                onClick={() => usunKolumne(i)}
                className="rounded-lg border border-red-300 text-red-600 px-3 py-1.5 text-sm hover:bg-red-50 transition-colors"
              >
                Usuń kolumnę
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-5">
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={k.widoczna}
                onChange={(e) => ustawKolumne(i, { widoczna: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              Widoczna na stronie
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={k.pokazProfile}
                onChange={(e) => ustawKolumne(i, { pokazProfile: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300"
              />
              Ikony Facebooka, Instagrama i YouTube pod spodem
            </label>
          </div>

          {k.rodzaj === "kontakt" ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm text-slate-700">
                Ta kolumna pokazuje adres sali, telefon i e-mail z zakładki{" "}
                <Link
                  href="/admin/dane-organizacji"
                  className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
                >
                  Dane organizacji
                </Link>
                . Nagłówek i położenie zmieniasz tutaj, samą treść tam.
              </p>
            </div>
          ) : (
            <ListaOdnosnikow
              pozycje={k.pozycje}
              onChange={(pozycje) => ustawKolumne(i, { pozycje })}
            />
          )}
        </div>
      ))}

      <button
        onClick={dodajKolumne}
        className="w-full rounded-xl border border-dashed border-slate-300 py-3 text-sm font-medium text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
      >
        + Dodaj kolumnę
      </button>
    </div>
  );
}
