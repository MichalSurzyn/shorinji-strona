"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getUploadSignature,
  listImageFolders,
  listImages,
  type CloudFolder,
  type CloudImage,
} from "@/actions/imageActions";
import { clThumb } from "@/lib/cloudinary";

interface Props {
  open: boolean;
  multi?: boolean;
  /** Folder podpowiadany jako pierwszy (np. Strona/buddyzm/podstawy). */
  defaultFolder?: string;
  onClose: () => void;
  onSelect: (publicIds: string[]) => void;
}

/**
 * Modal wyboru zdjęć: przeglądanie folderów Cloudinary + upload z dysku.
 * Zero wpisywania ID ręcznie - klikasz miniaturę, gotowe.
 */
export default function ImagePicker({
  open,
  multi = false,
  defaultFolder,
  onClose,
  onSelect,
}: Props) {
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [activeFolder, setActiveFolder] = useState<string>(defaultFolder ?? "all");
  const [images, setImages] = useState<CloudImage[]>([]);
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
    const start = defaultFolder ?? "all";
    setActiveFolder(start);
    listImageFolders().then(setFolders);
    loadImages(start);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) loadImages(activeFolder);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFolder]);

  function toggle(publicId: string) {
    if (multi) {
      setSelected((prev) =>
        prev.includes(publicId)
          ? prev.filter((p) => p !== publicId)
          : [...prev, publicId]
      );
    } else {
      onSelect([publicId]);
      onClose();
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const targetFolder =
      activeFolder === "all" ? defaultFolder ?? "Galeria/Pokazy" : activeFolder;
    const uploaded: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadInfo(`Wysyłanie ${i + 1} z ${files.length}...`);
        const sig = await getUploadSignature(targetFolder);
        const fd = new FormData();
        fd.append("file", files[i]);
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
      await loadImages(targetFolder, true);
      if (multi) setSelected((prev) => [...prev, ...uploaded]);
      else {
        onSelect([uploaded[0]]);
        onClose();
      }
    }
  }

  if (!open) return null;

  const isDefault = (path: string) => path === defaultFolder;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white text-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="font-bold text-lg">
            {multi ? "Wybierz zdjęcia" : "Wybierz zdjęcie"}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-2xl leading-none"
            aria-label="Zamknij"
          >
            ×
          </button>
        </div>

        <div className="px-6 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2">
          {defaultFolder && !folders.some((f) => f.path === defaultFolder) && (
            <button
              onClick={() => setActiveFolder(defaultFolder)}
              className={`text-sm rounded-full px-3 py-1.5 transition-colors ${
                activeFolder === defaultFolder
                  ? "bg-indigo-600 text-white"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              }`}
            >
              ★ Folder podstrony
            </button>
          )}
          <button
            onClick={() => setActiveFolder("all")}
            className={`text-sm rounded-full px-3 py-1.5 transition-colors ${
              activeFolder === "all"
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Wszystkie
          </button>
          {folders.map((f) => (
            <button
              key={f.path}
              onClick={() => setActiveFolder(f.path)}
              className={`text-sm rounded-full px-3 py-1.5 transition-colors ${
                activeFolder === f.path
                  ? "bg-indigo-600 text-white"
                  : isDefault(f.path)
                    ? "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {isDefault(f.path) ? `★ ${f.name}` : f.name}
            </button>
          ))}

          <div className="ml-auto">
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
              className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium px-3.5 py-1.5 transition-colors"
              title={
                activeFolder === "all"
                  ? "Zdjęcia trafią do folderu podstrony"
                  : `Zdjęcia trafią do: ${activeFolder}`
              }
            >
              {uploading ? uploadInfo ?? "Wysyłanie..." : "⬆ Wgraj z dysku"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <p className="text-center text-slate-400 py-16">Ładowanie zdjęć...</p>
          ) : images.length === 0 ? (
            <p className="text-center text-slate-400 py-16">
              Brak zdjęć w tym folderze. Możesz wgrać nowe przyciskiem powyżej.
            </p>
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
                    title={img.publicId}
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
            <span className="text-sm text-slate-500">
              Zaznaczono: {selected.length}
            </span>
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
