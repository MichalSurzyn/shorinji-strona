"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { listFiles, uploadFile } from "@/actions/fileActions";
import { opiszBlad } from "@/lib/adminErrors";
import { formatRozmiar, type PlikDoPobrania } from "@/lib/pliki";

/**
 * Wybór pliku do pobrania - ta sama rola co ImagePicker przy zdjęciach.
 *
 * Redaktor nie wpisuje ścieżki ręcznie: wybiera z listy albo wgrywa nowy
 * plik i od razu go wstawia. Wcześniej pole odnośnika w stopce wymagało
 * wklepania „/downloads/statut-posk.pdf" z pamięci.
 */
export default function FilePicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  /** Zwraca adres pliku i jego nazwę - nazwa bywa dobrą etykietą startową. */
  onSelect: (adres: string, nazwa: string) => void;
}) {
  const [pliki, setPliki] = useState<PlikDoPobrania[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const odswiez = useCallback(async () => {
    try {
      const res = await listFiles();
      setPliki(res.ok ? res.pliki : []);
      if (!res.ok) setBlad(res.error);
    } catch (e) {
      setPliki([]);
      setBlad(opiszBlad(e, "wczytać listy plików"));
    }
  }, []);

  useEffect(() => {
    if (open) {
      setBlad(null);
      odswiez();
    }
  }, [open, odswiez]);

  async function wgrajIWstaw(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setBlad(null);
    try {
      const fd = new FormData();
      fd.append("plik", files[0]);
      const res = await uploadFile(fd);
      if (res.ok) {
        onSelect(res.adres, res.nazwa);
        onClose();
      } else {
        setBlad(res.error);
        await odswiez();
      }
    } catch (e) {
      setBlad(opiszBlad(e, "wgrać pliku"));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-lg">Wybierz plik</h3>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={(e) => wgrajIWstaw(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium px-3.5 py-1.5 transition-colors whitespace-nowrap"
            >
              {busy ? "Wysyłanie..." : "⬆ Wgraj nowy"}
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
        </div>

        {blad && (
          <p role="alert" className="mx-6 mt-4 rounded-lg bg-red-50 border border-red-200 text-red-800 px-4 py-2.5 text-sm">
            {blad}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-6">
          {pliki === null ? (
            <p className="text-center text-slate-400 py-12">Wczytywanie plików...</p>
          ) : pliki.length === 0 ? (
            <div className="text-center py-12">
              <p className="font-medium text-slate-600">Nie ma jeszcze żadnego pliku.</p>
              <p className="text-sm text-slate-400 mt-1">
                Wgraj pierwszy przyciskiem &bdquo;Wgraj nowy&rdquo; powyżej.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
              {pliki.map((p) => (
                <li key={p.nazwa}>
                  <button
                    onClick={() => {
                      onSelect(p.adres, p.nazwa);
                      onClose();
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                  >
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-slate-800 truncate">
                        {p.nazwa}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {formatRozmiar(p.rozmiar)} · {p.adres}
                      </span>
                    </span>
                    <span className="text-sm text-indigo-600 shrink-0">Wstaw →</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
