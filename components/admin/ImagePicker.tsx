"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUploadSignature,
  listFolderPreviews,
  listImages,
  odswiezGalerie,
  type CloudFolderPodglad,
  type CloudImage,
} from "@/actions/imageActions";
import { clThumb } from "@/lib/cloudinary";
import { zmniejszZdjecie } from "@/lib/obrazy";

interface Props {
  open: boolean;
  multi?: boolean;
  /** Folder podpowiadany jako pierwszy (np. Strona/buddyzm/podstawy). */
  defaultFolder?: string;
  onClose: () => void;
  onSelect: (publicIds: string[]) => void;
}

/**
 * Wybór zdjęć: najpierw foldery jako kafelki z okładkami, potem zdjęcia
 * w środku. Zero wpisywania identyfikatorów - klikasz miniaturę, gotowe.
 *
 * Wcześniej foldery były rzędem pigułek z surowymi ścieżkami
 * („Strona / buddyzm / podstawy"). Nie było widać, ile zdjęć jest w środku
 * ani co to za miejsce, a ukośnik w nazwie to pojęcie techniczne.
 * Ten sam układ kafelków co w zakładce Zdjęcia i w galerii na stronie.
 */
export default function ImagePicker({
  open,
  multi = false,
  defaultFolder,
  onClose,
  onSelect,
}: Props) {
  const [foldery, setFoldery] = useState<CloudFolderPodglad[]>([]);
  /** null = widok folderów; wartość = otwarty folder. */
  const [otwarty, setOtwarty] = useState<CloudFolderPodglad | null>(null);
  const [images, setImages] = useState<CloudImage[]>([]);
  const [ladowanieFolderow, setLadowanieFolderow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cacheRef = useRef<Record<string, CloudImage[]>>({});

  const loadImages = useCallback(async (folder: string, force = false) => {
    if (!force && cacheRef.current[folder]) {
      setImages(cacheRef.current[folder]);
      return;
    }
    setLoading(true);
    const imgs = await listImages(folder);
    cacheRef.current[folder] = imgs;
    setImages(imgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setLadowanieFolderow(true);
    listFolderPreviews()
      .then((lista) => {
        setFoldery(lista);
        // Folder tej podstrony otwieramy od razu - najczęściej to o niego chodzi.
        const domyslny = lista.find((f) => f.path === defaultFolder);
        if (domyslny) {
          setOtwarty(domyslny);
          loadImages(domyslny.path);
        } else {
          setOtwarty(null);
        }
      })
      .finally(() => setLadowanieFolderow(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function otworz(f: CloudFolderPodglad) {
    setOtwarty(f);
    loadImages(f.path);
  }

  function toggle(publicId: string) {
    if (multi) {
      setSelected((prev) =>
        prev.includes(publicId) ? prev.filter((p) => p !== publicId) : [...prev, publicId]
      );
    } else {
      onSelect([publicId]);
      onClose();
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    const targetFolder = otwarty?.path ?? defaultFolder;
    if (!targetFolder) return;
    setUploading(true);
    const uploaded: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadInfo(`Wysyłanie ${i + 1} z ${files.length}...`);
        const sig = await getUploadSignature(targetFolder);
        const fd = new FormData();
        // Zmniejszamy tak samo jak w zakładce Zdjęcia - inaczej ta droga
        // omijałaby zmniejszanie i usuwanie współrzędnych GPS.
        const plikDoWyslania = await zmniejszZdjecie(files[i]);
        fd.append("file", plikDoWyslania);
        fd.append("api_key", sig.apiKey);
        fd.append("timestamp", String(sig.timestamp));
        fd.append("signature", sig.signature);
        fd.append("asset_folder", sig.folder);
        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body: fd }
        );
        const json = await res.json();
        if (json.public_id) uploaded.push(json.public_id);
      }
    } finally {
      setUploading(false);
      setUploadInfo(null);
      if (fileRef.current) fileRef.current.value = "";
    }

    if (uploaded.length) {
      // Druga droga uploadu, obok zakładki „Zdjęcia". Dla folderów podstron
      // tematycznych galeria pod treścią listuje Cloudinary wprost, więc te
      // zdjęcia pojawiają się bez zapisu strony - i bez tego wywołania czekały
      // na wygaśnięcie okna ISR.
      void odswiezGalerie(targetFolder);
      await loadImages(targetFolder, true);
      if (multi) setSelected((prev) => [...prev, ...uploaded]);
      else {
        onSelect([uploaded[0]]);
        onClose();
      }
    }
  }

  if (!open) return null;

  const galerie = foldery.filter((f) => f.rodzaj === "galeria");
  const strony = foldery.filter((f) => f.rodzaj === "strona");

  const Kafelek = ({ f }: { f: CloudFolderPodglad }) => (
    <button
      onClick={() => otworz(f)}
      className={`group text-left rounded-xl border overflow-hidden transition-all ${
        f.path === defaultFolder
          ? "border-indigo-400 ring-1 ring-indigo-200 hover:border-indigo-600"
          : "border-slate-200 hover:border-indigo-400"
      }`}
    >
      <span className="flex aspect-[4/3] bg-slate-100 items-center justify-center overflow-hidden">
        {f.okladka ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={clThumb(f.okladka, 300)}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span aria-hidden className="text-3xl text-slate-300">
            ▢
          </span>
        )}
      </span>
      <span className="block px-3 py-2">
        <span className="block text-sm font-medium text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
          {f.path === defaultFolder ? `★ ${f.nazwaKrotka}` : f.nazwaKrotka}
        </span>
        <span className="block text-xs text-slate-500">
          {f.liczba === 0 ? "pusty" : `${f.liczba} ${f.liczba === 1 ? "zdjęcie" : "zdjęć"}`}
        </span>
      </span>
    </button>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-slate-200">
          <div className="min-w-0">
            {otwarty && (
              <button
                onClick={() => setOtwarty(null)}
                className="text-sm text-slate-400 hover:text-indigo-600 transition-colors"
              >
                ← Wszystkie foldery
              </button>
            )}
            <h3 className="font-bold text-lg truncate">
              {otwarty
                ? otwarty.rodzaj === "galeria"
                  ? `Galeria: ${otwarty.nazwaKrotka}`
                  : `Zdjęcia strony: ${otwarty.nazwaKrotka}`
                : multi
                  ? "Wybierz zdjęcia"
                  : "Wybierz zdjęcie"}
            </h3>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {otwarty && (
              <>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                />
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium px-3.5 py-1.5 transition-colors whitespace-nowrap"
                >
                  {uploading ? (uploadInfo ?? "Wysyłanie...") : "⬆ Wgraj z dysku"}
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
              aria-label="Zamknij"
            >
              ×
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* --- Widok folderów --- */}
          {!otwarty ? (
            ladowanieFolderow ? (
              <p className="text-center text-slate-400 py-16">Wczytywanie folderów...</p>
            ) : (
              <div className="space-y-6">
                {galerie.length > 0 && (
                  <section>
                    <h4 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold mb-2">
                      Galeria na stronie
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {galerie.map((f) => (
                        <Kafelek key={f.path} f={f} />
                      ))}
                    </div>
                  </section>
                )}
                {strony.length > 0 && (
                  <section>
                    <h4 className="text-xs uppercase tracking-[0.16em] text-slate-400 font-semibold mb-2">
                      Zdjęcia podstron
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {strony.map((f) => (
                        <Kafelek key={f.path} f={f} />
                      ))}
                    </div>
                  </section>
                )}
                {foldery.length === 0 && (
                  <p className="text-center text-slate-400 py-16">
                    Nie ma jeszcze żadnego folderu ze zdjęciami.
                  </p>
                )}
              </div>
            )
          ) : /* --- Widok zdjęć w folderze --- */ loading ? (
            <p className="text-center text-slate-400 py-16">Wczytywanie zdjęć...</p>
          ) : images.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-medium text-slate-600">Ten folder jest pusty.</p>
              <p className="text-sm text-slate-400 mt-1">
                Wgraj zdjęcia przyciskiem &bdquo;Wgraj z dysku&rdquo; powyżej.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
              {images.map((img) => {
                const isSel = selected.includes(img.publicId);
                return (
                  <button
                    key={img.publicId}
                    onClick={() => toggle(img.publicId)}
                    className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                      isSel
                        ? "border-indigo-600 ring-2 ring-indigo-300"
                        : "border-transparent hover:border-indigo-300"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={clThumb(img.publicId, 300)}
                      alt=""
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {isSel && (
                      <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-indigo-600 text-white text-sm flex items-center justify-center">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {multi && (
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <span className="text-sm text-slate-500">Zaznaczono: {selected.length}</span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Anuluj
              </button>
              <button
                disabled={selected.length === 0}
                onClick={() => {
                  onSelect(selected);
                  onClose();
                }}
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 text-sm font-semibold transition-colors"
              >
                Wstaw ({selected.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
