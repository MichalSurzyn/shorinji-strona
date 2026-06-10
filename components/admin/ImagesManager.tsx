"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImageFolder,
  deleteImage,
  getUploadSignature,
  listImageFolders,
  listImages,
  type CloudFolder,
  type CloudImage,
} from "@/actions/imageActions";
import { clThumb, clUrl } from "@/lib/cloudinary";

export default function ImagesManager() {
  const [folders, setFolders] = useState<CloudFolder[]>([]);
  const [active, setActive] = useState<string>("all");
  const [images, setImages] = useState<CloudImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadInfo, setUploadInfo] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async (folder: string) => {
    setLoading(true);
    const [fl, imgs] = await Promise.all([
      listImageFolders(),
      listImages(folder),
    ]);
    setFolders(fl);
    setImages(imgs);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh(active);
  }, [active, refresh]);

  async function handleNewFolder() {
    const name = prompt(
      "Nazwa nowego folderu galerii (pojawi się jako zakładka na stronie):"
    );
    if (!name) return;
    const res = await createImageFolder(name);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setMsg(
      `Utworzono folder „${name}". Wgraj do niego zdjęcia, aby zakładka pojawiła się na stronie.`
    );
    refresh(active);
  }

  async function handleDelete(publicId: string) {
    if (!confirm("Usunąć to zdjęcie z Cloudinary? Zniknie też ze strony."))
      return;
    const res = await deleteImage(publicId);
    if (!res.ok) {
      setMsg(res.error);
      return;
    }
    setImages((prev) => prev.filter((i) => i.publicId !== publicId));
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length) return;
    if (active === "all") {
      setMsg("Wybierz najpierw konkretny folder, do którego mam wgrać zdjęcia.");
      return;
    }
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadInfo(`Wysyłanie ${i + 1} z ${files.length}...`);
        const sig = await getUploadSignature(active);
        const fd = new FormData();
        fd.append("file", files[i]);
        fd.append("api_key", sig.apiKey);
        fd.append("timestamp", String(sig.timestamp));
        fd.append("signature", sig.signature);
        fd.append("asset_folder", sig.folder);
        await fetch(
          `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
          { method: "POST", body: fd }
        );
      }
      setMsg(`Wgrano ${files.length} zdjęć.`);
    } finally {
      setUploading(false);
      setUploadInfo(null);
      if (fileRef.current) fileRef.current.value = "";
      refresh(active);
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-center gap-2">
        <button
          onClick={() => setActive("all")}
          className={`text-sm rounded-full px-3.5 py-1.5 transition-colors ${
            active === "all"
              ? "bg-indigo-600 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          Wszystkie
        </button>
        {folders.map((f) => (
          <button
            key={f.path}
            onClick={() => setActive(f.path)}
            className={`text-sm rounded-full px-3.5 py-1.5 transition-colors ${
              active === f.path
                ? "bg-indigo-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f.name}
          </button>
        ))}
        <button
          onClick={handleNewFolder}
          className="text-sm rounded-full px-3.5 py-1.5 border border-dashed border-slate-300 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          + Nowy folder galerii
        </button>

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
            disabled={uploading || active === "all"}
            title={
              active === "all"
                ? "Wybierz folder, żeby wgrać zdjęcia"
                : `Wgraj zdjęcia do: ${active}`
            }
            className="text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium px-4 py-2 transition-colors"
          >
            {uploading ? uploadInfo ?? "Wysyłanie..." : "⬆ Wgraj zdjęcia"}
          </button>
        </div>
      </div>

      {msg && (
        <div className="rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 px-4 py-3 text-sm flex justify-between items-center">
          <span>{msg}</span>
          <button onClick={() => setMsg(null)} className="font-bold ml-4">
            ×
          </button>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-4">
        {loading ? (
          <p className="text-center text-slate-400 py-16">Ładowanie...</p>
        ) : images.length === 0 ? (
          <p className="text-center text-slate-400 py-16">
            Brak zdjęć w tym folderze.
          </p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {images.map((img) => (
              <div key={img.publicId} className="group relative aspect-square">
                <a
                  href={clUrl(img.publicId, 2000)}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clThumb(img.publicId, 300)}
                    alt=""
                    className="w-full h-full object-cover rounded-xl border border-slate-200"
                    loading="lazy"
                  />
                </a>
                <button
                  onClick={() => handleDelete(img.publicId)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm opacity-0 group-hover:opacity-100 transition-all"
                  title="Usuń zdjęcie"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
