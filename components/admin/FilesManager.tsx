"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { deleteFile, listFiles, uploadFile } from "@/actions/fileActions";
import { opiszBlad } from "@/lib/adminErrors";
import { formatRozmiar, MAX_ROZMIAR, type PlikDoPobrania } from "@/lib/pliki";

/**
 * Pliki do pobrania: deklaracje, statuty, regulaminy.
 *
 * Dotąd leżały w repozytorium i dodanie nowego wymagało programisty
 * i wdrożenia. Podpowiedź w edytorze stopki mówiła wprost: „Pliki PDF wgraj
 * do folderu public/downloads w projekcie" - czyli instruowała redaktora,
 * żeby zrobił coś, czego zrobić nie może.
 */
export default function FilesManager() {
  const [pliki, setPliki] = useState<PlikDoPobrania[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [przeciaganie, setPrzeciaganie] = useState(false);
  const [skopiowany, setSkopiowany] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const odswiez = useCallback(async () => {
    try {
      const res = await listFiles();
      if (res.ok) setPliki(res.pliki);
      else {
        setPliki([]);
        setMsg({ ok: false, text: opiszBlad(res.error, "wczytać listy plików") });
      }
    } catch (e) {
      setPliki([]);
      setMsg({ ok: false, text: opiszBlad(e, "wczytać listy plików") });
    }
  }, []);

  useEffect(() => {
    odswiez();
  }, [odswiez]);

  async function wgraj(files: FileList | File[] | null) {
    if (!files) return;
    const lista = Array.from(files);
    if (!lista.length) return;

    setBusy(true);
    setMsg(null);
    const udane: string[] = [];
    const nieudane: { nazwa: string; powod: string }[] = [];

    try {
      for (const plik of lista) {
        if (plik.size > MAX_ROZMIAR) {
          nieudane.push({
            nazwa: plik.name,
            powod: `waży ${formatRozmiar(plik.size)}, limit to ${formatRozmiar(MAX_ROZMIAR)}`,
          });
          continue;
        }
        const fd = new FormData();
        fd.append("plik", plik);
        try {
          const res = await uploadFile(fd);
          if (res.ok) udane.push(res.nazwa);
          else nieudane.push({ nazwa: plik.name, powod: res.error });
        } catch (e) {
          nieudane.push({ nazwa: plik.name, powod: opiszBlad(e, "wgrać pliku") });
        }
      }
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
      await odswiez();
      setMsg({
        ok: nieudane.length === 0,
        text:
          nieudane.length === 0
            ? `Wgrano ${udane.length} ${udane.length === 1 ? "plik" : "pliki"}. Możesz je teraz wstawić w stopce albo w treści strony.`
            : `Wgrano ${udane.length} z ${lista.length}. Nie udało się: ${nieudane
                .map((n) => `${n.nazwa} (${n.powod})`)
                .join("; ")}`,
      });
    }
  }

  async function usun(p: PlikDoPobrania) {
    if (
      !confirm(
        `Usunąć plik ${p.nazwa} na stałe?\n\n` +
          "Przestanie się otwierać wszędzie, gdzie jest do niego odnośnik - w stopce, " +
          "w treści stron i u osób, którym podano bezpośredni adres.\n\n" +
          "Tej operacji nie da się cofnąć."
      )
    )
      return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await deleteFile(p.nazwa);
      if (res.ok) {
        setMsg({ ok: true, text: `Usunięto ${p.nazwa}.` });
        await odswiez();
      } else {
        setMsg({ ok: false, text: opiszBlad(res.error, "usunąć pliku") });
      }
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "usunąć pliku") });
    } finally {
      setBusy(false);
    }
  }

  async function kopiujAdres(p: PlikDoPobrania) {
    try {
      await navigator.clipboard.writeText(p.adres);
      setSkopiowany(p.nazwa);
      setTimeout(() => setSkopiowany(null), 2500);
    } catch {
      setMsg({ ok: false, text: `Nie udało się skopiować. Adres to: ${p.adres}` });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pliki do pobrania</h1>
          <p className="text-slate-500 mt-1 max-w-2xl">
            Deklaracje, statuty i regulaminy. Po wgraniu wstawisz je w stopce
            albo w treści strony, wybierając z listy.
          </p>
        </div>
        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,image/*"
            multiple
            className="hidden"
            onChange={(e) => wgraj(e.target.files)}
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 text-sm transition-colors"
          >
            {busy ? "Wysyłanie..." : "⬆ Wgraj pliki"}
          </button>
        </div>
      </div>

      {msg && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm flex justify-between items-start gap-4 ${
            msg.ok
              ? "bg-emerald-50 border border-emerald-200 text-emerald-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          <span>{msg.text}</span>
          <button onClick={() => setMsg(null)} aria-label="Zamknij" className="font-bold">
            ×
          </button>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setPrzeciaganie(true);
        }}
        onDragLeave={() => setPrzeciaganie(false)}
        onDrop={(e) => {
          e.preventDefault();
          setPrzeciaganie(false);
          wgraj(e.dataTransfer.files);
        }}
        className={`rounded-2xl border-2 transition-colors ${
          przeciaganie ? "border-dashed border-emerald-500 bg-emerald-50" : "border-slate-200 bg-white"
        }`}
      >
        {pliki === null ? (
          <p className="text-center text-slate-400 py-16">Wczytywanie plików...</p>
        ) : pliki.length === 0 ? (
          <div className="text-center py-16">
            <p className="font-medium text-slate-600">Nie ma jeszcze żadnego pliku.</p>
            <p className="text-sm text-slate-400 mt-1">
              Przeciągnij tu pliki albo kliknij &bdquo;Wgraj pliki&rdquo; powyżej.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pliki.map((p) => (
              <li key={p.nazwa} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.nazwa}</p>
                  <p className="text-xs text-slate-400">
                    {formatRozmiar(p.rozmiar)}
                    {p.zmieniony && ` · ${new Date(p.zmieniony).toLocaleDateString("pl-PL")}`}
                    {" · "}
                    <span className="font-mono">{p.adres}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => kopiujAdres(p)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    {skopiowany === p.nazwa ? "Skopiowano ✓" : "Kopiuj odnośnik"}
                  </button>
                  <a
                    href={p.adres}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium hover:bg-slate-50 transition-colors"
                  >
                    Otwórz ↗
                  </a>
                  <button
                    onClick={() => usun(p)}
                    disabled={busy}
                    className="rounded-lg border border-red-300 text-red-600 px-3 py-1.5 text-sm font-medium hover:bg-red-50 disabled:opacity-60 transition-colors"
                  >
                    Usuń
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-slate-500">
        Największy plik: {formatRozmiar(MAX_ROZMIAR)}. Nazwa jest przepisywana na
        bezpieczną w adresie (bez spacji i polskich znaków), bo staje się częścią
        odnośnika. Plik o istniejącej nazwie nie zostanie podmieniony po cichu -
        najpierw usuń stary.
      </p>
    </div>
  );
}
