"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createImageFolder,
  deleteImage,
  deleteImageFolder,
  getUploadSignature,
  listFolderPreviews,
  listImages,
  type CloudFolderPodglad,
  type CloudImage,
} from "@/actions/imageActions";
import { clThumb, clUrl } from "@/lib/cloudinary";
import { opiszBlad } from "@/lib/adminErrors";
import { zmniejszZdjecie } from "@/lib/obrazy";

type Wynik = { nazwa: string; ok: boolean; powod?: string };

export default function ImagesManager() {
  const [foldery, setFoldery] = useState<CloudFolderPodglad[]>([]);
  const [otwarty, setOtwarty] = useState<CloudFolderPodglad | null>(null);
  const [images, setImages] = useState<CloudImage[]>([]);
  const [ladowanieFolderow, setLadowanieFolderow] = useState(true);
  const [ladowanieZdjec, setLadowanieZdjec] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [postep, setPostep] = useState<{ ile: number; z: number } | null>(null);
  const [wyniki, setWyniki] = useState<Wynik[] | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [przeciaganie, setPrzeciaganie] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const odswiezFoldery = useCallback(async () => {
    setLadowanieFolderow(true);
    try {
      setFoldery(await listFolderPreviews());
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "wczytać folderów") });
    } finally {
      setLadowanieFolderow(false);
    }
  }, []);

  const odswiezZdjecia = useCallback(async (sciezka: string) => {
    setLadowanieZdjec(true);
    try {
      setImages(await listImages(sciezka));
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "wczytać zdjęć") });
    } finally {
      setLadowanieZdjec(false);
    }
  }, []);

  useEffect(() => {
    odswiezFoldery();
  }, [odswiezFoldery]);

  useEffect(() => {
    if (otwarty) odswiezZdjecia(otwarty.path);
  }, [otwarty, odswiezZdjecia]);

  async function handleNewFolder() {
    const name = prompt(
      "Jak ma się nazywać nowa zakładka galerii?\n\nNazwę zobaczą odwiedzający stronę, np. Pokazy, Obóz letni, Egzaminy."
    );
    if (!name) return;
    const res = await createImageFolder(name);
    if (!res.ok) {
      setMsg({ ok: false, text: res.error });
      return;
    }
    setMsg({
      ok: true,
      text: `Utworzono zakładkę „${name}". Wgraj do niej zdjęcia - pusta zakładka nie pokaże się na stronie.`,
    });
    odswiezFoldery();
  }

  /**
   * Usuwa zakładkę galerii. Pierwsze wywołanie serwera niczego nie kasuje -
   * zwraca liczbę zdjęć, żeby pytanie mówiło o realnym skutku, a nie
   * o abstrakcyjnym „folderze".
   */
  async function handleDeleteFolder(f: CloudFolderPodglad) {
    setMsg(null);
    try {
      const wstepny = await deleteImageFolder(f.path, false);

      if (!wstepny.ok && "error" in wstepny) {
        setMsg({ ok: false, text: wstepny.error });
        return;
      }

      if (!wstepny.ok && "wymagaPotwierdzenia" in wstepny) {
        const ile = wstepny.liczba;
        if (
          !confirm(
            `Usunąć zakładkę „${f.nazwaKrotka}" razem z ${ile} ${ile === 1 ? "zdjęciem" : "zdjęciami"}?\n\n` +
              "Zdjęcia znikną ze strony wszędzie, gdzie były użyte.\n\n" +
              "Tej operacji nie da się cofnąć."
          )
        )
          return;
      } else if (
        !confirm(`Usunąć pustą zakładkę „${f.nazwaKrotka}"?\n\nZniknie z galerii na stronie.`)
      ) {
        return;
      }

      const res = await deleteImageFolder(f.path, true);
      if (!res.ok) {
        setMsg({ ok: false, text: "error" in res ? res.error : "Nie udało się usunąć zakładki." });
        return;
      }
      setMsg({
        ok: true,
        text:
          res.usunieto > 0
            ? `Usunięto zakładkę „${f.nazwaKrotka}" i ${res.usunieto} ${res.usunieto === 1 ? "zdjęcie" : "zdjęć"}.`
            : `Usunięto pustą zakładkę „${f.nazwaKrotka}".`,
      });
      if (otwarty?.path === f.path) setOtwarty(null);
      odswiezFoldery();
    } catch (e) {
      setMsg({ ok: false, text: opiszBlad(e, "usunąć zakładki") });
    }
  }

  async function handleDelete(publicId: string) {
    if (
      !confirm(
        "Usunąć to zdjęcie na stałe?\n\nZniknie ze strony wszędzie, gdzie było użyte. Tej operacji nie da się cofnąć."
      )
    )
      return;
    const res = await deleteImage(publicId);
    if (!res.ok) {
      setMsg({ ok: false, text: opiszBlad(res.error, "usunąć zdjęcia") });
      return;
    }
    setImages((prev) => prev.filter((i) => i.publicId !== publicId));
    setMsg({ ok: true, text: "Zdjęcie usunięte." });
  }

  async function handleUpload(files: FileList | File[] | null) {
    if (!files || !otwarty) return;
    const lista = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (!lista.length) {
      setMsg({ ok: false, text: "To nie są pliki ze zdjęciami. Wybierz zdjęcia (JPG, PNG, HEIC)." });
      return;
    }

    setUploading(true);
    setWyniki(null);
    setMsg(null);
    const rezultaty: Wynik[] = [];

    try {
      for (let i = 0; i < lista.length; i++) {
        setPostep({ ile: i + 1, z: lista.length });
        const plik = await zmniejszZdjecie(lista[i]);
        try {
          const sig = await getUploadSignature(otwarty.path);
          const fd = new FormData();
          fd.append("file", plik);
          fd.append("api_key", sig.apiKey);
          fd.append("timestamp", String(sig.timestamp));
          fd.append("signature", sig.signature);
          fd.append("asset_folder", sig.folder);
          const r = await fetch(
            `https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`,
            { method: "POST", body: fd }
          );
          // Wcześniej wynik tego zapytania był ignorowany, więc panel mówił
          // „Wgrano 8 zdjęć" nawet wtedy, gdy nie wgrał ani jednego.
          if (!r.ok) {
            let powod = `serwer odrzucił plik (${r.status})`;
            try {
              const body = await r.json();
              if (body?.error?.message) powod = String(body.error.message);
            } catch {
              /* odpowiedź bez treści - zostaje kod stanu */
            }
            rezultaty.push({ nazwa: lista[i].name, ok: false, powod });
          } else {
            rezultaty.push({ nazwa: lista[i].name, ok: true });
          }
        } catch {
          rezultaty.push({
            nazwa: lista[i].name,
            ok: false,
            powod: "przerwane połączenie",
          });
        }
      }
    } finally {
      setUploading(false);
      setPostep(null);
      if (fileRef.current) fileRef.current.value = "";
      setWyniki(rezultaty);
      const udane = rezultaty.filter((r) => r.ok).length;
      const nieudane = rezultaty.length - udane;
      setMsg({
        ok: nieudane === 0,
        text:
          nieudane === 0
            ? `Wgrano ${udane} ${udane === 1 ? "zdjęcie" : "zdjęć"}. Są już widoczne na stronie.`
            : `Wgrano ${udane} z ${rezultaty.length}. ${nieudane} ${nieudane === 1 ? "zdjęcie się nie wgrało" : "zdjęć się nie wgrało"} - szczegóły poniżej.`,
      });
      odswiezZdjecia(otwarty.path);
      odswiezFoldery();
    }
  }

  const galerie = foldery.filter((f) => f.rodzaj === "galeria");
  const strony = foldery.filter((f) => f.rodzaj === "strona");

  /* ---------------- Widok pojedynczego folderu ---------------- */
  if (otwarty) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              onClick={() => {
                setOtwarty(null);
                setWyniki(null);
                setMsg(null);
              }}
              className="text-sm text-slate-500 hover:text-indigo-600 transition-colors"
            >
              ← Wszystkie foldery
            </button>
            <h2 className="text-xl font-bold mt-1">
              {otwarty.rodzaj === "galeria"
                ? `Galeria: ${otwarty.nazwaKrotka}`
                : `Zdjęcia strony: ${otwarty.nazwaKrotka}`}
            </h2>
            <p className="text-sm text-slate-500">
              {otwarty.rodzaj === "galeria"
                ? "Te zdjęcia odwiedzający zobaczą w galerii, w zakładce o tej nazwie."
                : "Te zdjęcia są używane tylko na tej podstronie."}
            </p>
          </div>
          <div>
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
              className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-medium px-5 py-2.5 text-sm transition-colors"
            >
              {uploading && postep
                ? `Wysyłanie ${postep.ile} z ${postep.z}...`
                : "⬆ Wgraj zdjęcia"}
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

        {wyniki && wyniki.some((w) => !w.ok) && (
          <ul className="rounded-xl border border-red-200 bg-white divide-y divide-slate-100 text-sm">
            {wyniki
              .filter((w) => !w.ok)
              .map((w, i) => (
                <li key={i} className="px-4 py-2.5 flex justify-between gap-4">
                  <span className="text-slate-700 truncate">{w.nazwa}</span>
                  <span className="text-red-700 shrink-0">{w.powod}</span>
                </li>
              ))}
          </ul>
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
            handleUpload(e.dataTransfer.files);
          }}
          className={`bg-white rounded-2xl border-2 p-4 transition-colors ${
            przeciaganie ? "border-dashed border-emerald-500 bg-emerald-50" : "border-slate-200"
          }`}
        >
          {ladowanieZdjec ? (
            <p className="text-center text-slate-400 py-16">Wczytywanie zdjęć...</p>
          ) : images.length === 0 ? (
            <div className="text-center py-16">
              <p className="font-medium text-slate-600">Ten folder jest jeszcze pusty.</p>
              <p className="text-sm text-slate-400 mt-1">
                Przeciągnij tu zdjęcia albo kliknij &bdquo;Wgraj zdjęcia&rdquo; powyżej.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-400 mb-3">
                {images.length} {images.length === 1 ? "zdjęcie" : "zdjęć"} · przeciągnij
                tu pliki, żeby dodać kolejne
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {images.map((img) => (
                  <div key={img.publicId} className="relative aspect-square">
                    <a href={clUrl(img.publicId, 2000)} target="_blank" rel="noopener noreferrer">
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
                      /* Widoczny zawsze - ukrycie pod hover czyni go
                         nieosiągalnym na tablecie i telefonie. */
                      className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm transition-colors"
                      aria-label="Usuń to zdjęcie"
                      title="Usuń to zdjęcie"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ---------------- Widok listy folderów ---------------- */
  /** Kafelek folderu. Usuwanie tylko dla zakladek galerii - foldery zdjec
   *  podstron sa powiazane z trescia stron. */
  const Kafelek = ({ f }: { f: CloudFolderPodglad }) => (
    <div className="group relative rounded-2xl border border-slate-200 bg-white overflow-hidden hover:border-indigo-400 hover:shadow-md transition-all">
      <button onClick={() => setOtwarty(f)} className="block w-full text-left">
        <span className="flex aspect-[4/3] bg-slate-100 items-center justify-center overflow-hidden">
          {f.okladka ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={clThumb(f.okladka, 400)} alt="" className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <span aria-hidden className="text-4xl text-slate-300">▢</span>
          )}
        </span>
        <span className="block px-4 py-3">
          <span className="block font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors truncate">
            {f.nazwaKrotka}
          </span>
          <span className="block text-sm text-slate-500">
            {f.liczba === 0 ? "pusta" : `${f.liczba} ${f.liczba === 1 ? "zdjęcie" : "zdjęć"}`}
          </span>
        </span>
      </button>
      {f.rodzaj === "galeria" && (
        <button
          onClick={() => handleDeleteFolder(f)}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 hover:bg-red-600 text-white text-sm transition-colors"
          aria-label={`Usuń zakładkę ${f.nazwaKrotka}`}
          title="Usuń tę zakładkę galerii"
        >
          ✕
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-8">
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

      {ladowanieFolderow ? (
        <p className="text-center text-slate-400 py-16">Wczytywanie folderów...</p>
      ) : (
        <>
          <section>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-bold">Galeria na stronie</h2>
                <p className="text-sm text-slate-500">
                  Każdy folder to osobna zakładka w galerii, którą widzą odwiedzający.
                </p>
              </div>
              <button
                onClick={handleNewFolder}
                className="shrink-0 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                + Nowa zakładka
              </button>
            </div>
            {galerie.length === 0 ? (
              <p className="bg-white rounded-2xl border border-slate-200 px-5 py-6 text-sm text-slate-400">
                Nie ma jeszcze żadnej zakładki galerii.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {galerie.map((f) => (
                  <Kafelek key={f.path} f={f} />
                ))}
              </div>
            )}
          </section>

          {strony.length > 0 && (
            <section>
              <h2 className="font-bold">Zdjęcia użyte na podstronach</h2>
              <p className="text-sm text-slate-500 mb-3">
                Te zdjęcia nie trafiają do galerii - są wstawione w treść konkretnych stron.
              </p>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {strony.map((f) => (
                  <Kafelek key={f.path} f={f} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
