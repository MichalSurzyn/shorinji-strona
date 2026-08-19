"use server";

import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { KLUCZ_OKLADEK, pobierzOkladki } from "@/lib/galeriaOkladki";
import { getEditablePage } from "@/lib/editablePages";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { requireUser } from "@/lib/supabase/server";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME?.replace(/"/g, ""),
  api_key: process.env.CLOUDINARY_API_KEY?.replace(/"/g, ""),
  api_secret: process.env.CLOUDINARY_API_SECRET?.replace(/"/g, ""),
});

export interface CloudImage {
  publicId: string;
  width: number;
  height: number;
  createdAt: string;
}

export interface CloudFolder {
  name: string;
  path: string;
}

/** Folder w widoku kafelków: z okładką i liczbą zdjęć. */
export interface CloudFolderPodglad extends CloudFolder {
  /** Rodzaj folderu - decyduje o opisie w panelu. */
  rodzaj: "galeria" | "strona";
  /** Nazwa bez przedrostka technicznego, np. „Pokazy". */
  nazwaKrotka: string;
  /** publicId okładki albo null dla pustego folderu. */
  okladka: string | null;
  /** Czy okładkę wskazał redaktor (false = automatycznie najnowsze zdjęcie). */
  okladkaWybrana: boolean;
  liczba: number;
}

/**
 * Foldery dostępne w panelu: podfoldery "Galeria" (zakładki publicznej
 * galerii) oraz drzewo "Strona/<temat>/<slug>" (zdjęcia podstron).
 */
export async function listImageFolders(): Promise<CloudFolder[]> {
  await requireUser();
  const folders: CloudFolder[] = [];
  try {
    const { folders: gal } = await cloudinary.api.sub_folders("Galeria");
    for (const f of gal as { name: string; path: string }[]) {
      folders.push({ name: `Galeria / ${f.name}`, path: f.path });
    }
  } catch (e) {
    console.warn("listImageFolders Galeria:", e);
  }
  try {
    const { folders: topics } = await cloudinary.api.sub_folders("Strona");
    for (const t of topics as { name: string; path: string }[]) {
      try {
        const { folders: slugs } = await cloudinary.api.sub_folders(t.path);
        for (const s of slugs as { name: string; path: string }[]) {
          folders.push({ name: `Strona / ${t.name} / ${s.name}`, path: s.path });
        }
        if (!(slugs as unknown[]).length) {
          folders.push({ name: `Strona / ${t.name}`, path: t.path });
        }
      } catch {
        folders.push({ name: `Strona / ${t.name}`, path: t.path });
      }
    }
  } catch (e) {
    console.warn("listImageFolders Strona:", e);
  }
  return folders;
}

type CloudResource = {
  public_id: string;
  width: number;
  height: number;
  created_at: string;
};

function mapResources(resources: CloudResource[] | undefined): CloudImage[] {
  return (resources ?? []).map((r) => ({
    publicId: r.public_id,
    width: r.width,
    height: r.height,
    createdAt: r.created_at,
  }));
}

/**
 * Listuje zdjęcia przez Admin API (bez opóźnień indeksowania Search API) -
 * świeżo wgrane pliki są widoczne od razu.
 */
export async function listImages(folderPath: string): Promise<CloudImage[]> {
  await requireUser();
  try {
    if (folderPath === "all") {
      const result = await cloudinary.api.resources({
        resource_type: "image",
        type: "upload",
        max_results: 100,
        direction: "desc",
      });
      return mapResources(result.resources);
    }
    const result = await cloudinary.api.resources_by_asset_folder(folderPath, {
      max_results: 100,
    });
    return mapResources(result.resources);
  } catch (e) {
    console.warn("listImages:", e);
    return [];
  }
}

/**
 * Foldery razem z okładką i liczbą zdjęć - do widoku kafelków w panelu.
 *
 * Zamiast jednego zapytania na folder pobieramy zasoby hurtem i grupujemy
 * po `asset_folder`. Przy kilkunastu folderach to różnica między jednym
 * a kilkunastoma wywołaniami Cloudinary.
 */
export async function listFolderPreviews(): Promise<CloudFolderPodglad[]> {
  await requireUser();
  const foldery = await listImageFolders();

  const okladki = await pobierzOkladki();

  // `pierwsza` to najnowsze zdjęcie folderu, `wybrana` to wskazanie redaktora.
  // Trzymamy oba, bo wskazane zdjęcie mogło zostać w międzyczasie skasowane -
  // wtedy wracamy do najnowszego zamiast pokazywać pustą ramkę.
  const licznik = new Map<
    string,
    { liczba: number; pierwsza: string | null; wybrana: string | null }
  >();
  try {
    const result = await cloudinary.api.resources({
      resource_type: "image",
      type: "upload",
      max_results: 500,
      direction: "desc",
    });
    for (const r of (result.resources ?? []) as (CloudResource & {
      asset_folder?: string;
    })[]) {
      const f = r.asset_folder;
      if (!f) continue;
      const biezace = licznik.get(f) ?? { liczba: 0, pierwsza: null, wybrana: null };
      biezace.liczba += 1;
      if (!biezace.pierwsza) biezace.pierwsza = r.public_id;
      if (okladki[f] === r.public_id) biezace.wybrana = r.public_id;
      licznik.set(f, biezace);
    }
  } catch (e) {
    // Bez liczników widok nadal działa - pokaże foldery bez okładek.
    console.warn("listFolderPreviews:", e);
  }

  return foldery.map((f) => {
    const dane = licznik.get(f.path) ?? { liczba: 0, pierwsza: null, wybrana: null };
    const galeria = f.path.startsWith("Galeria");
    // "Galeria / Pokazy" -> "Pokazy"; "Strona / buddyzm / podstawy" -> "buddyzm / podstawy"
    const nazwaKrotka = f.name.replace(/^(Galeria|Strona)\s*\/\s*/, "");
    return {
      ...f,
      rodzaj: galeria ? ("galeria" as const) : ("strona" as const),
      nazwaKrotka,
      okladka: dane.wybrana ?? dane.pierwsza,
      okladkaWybrana: dane.wybrana !== null,
      liczba: dane.liczba,
    };
  });
}

/**
 * Wskazuje zdjęcie, które ma być okładką albumu w galerii.
 *
 * `publicId = null` kasuje wskazanie - album wraca do okładki domyślnej,
 * czyli najnowszego zdjęcia.
 *
 * Zapis idzie do jednego wiersza `site_settings` z mapą wszystkich albumów,
 * więc odczytujemy ją, podmieniamy jeden wpis i zapisujemy całość. Przy
 * jednym redaktorze klikającym w panelu to bezpieczne, a oszczędza osobnej
 * tabeli (której i tak nie dałoby się założyć bez ręcznego SQL-a).
 */
export async function setFolderCover(folderPath: string, publicId: string | null) {
  await requireUser();

  if (!folderPath.startsWith("Galeria/")) {
    return {
      ok: false as const,
      error:
        "Okładkę można ustawić tylko dla zakładki galerii. Zdjęcia podstron nie mają widoku albumu.",
    };
  }

  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false as const, error: "Brak konfiguracji Supabase." };

  const okladki = await pobierzOkladki();
  if (publicId) okladki[folderPath] = publicId;
  else delete okladki[folderPath];

  const { error } = await sb.from("site_settings").upsert({
    key: KLUCZ_OKLADEK,
    value: okladki,
    updated_at: new Date().toISOString(),
  });
  if (error) return { ok: false as const, error: error.message };

  revalidatePath("/galeria");
  return { ok: true as const };
}

export async function createImageFolder(name: string) {
  await requireUser();
  const clean = name.trim().replace(/[^\p{L}\p{N} _-]/gu, "");
  if (!clean) return { ok: false as const, error: "Nieprawidłowa nazwa folderu" };
  try {
    await cloudinary.api.create_folder(`Galeria/${clean}`);
    revalidatePath("/galeria");
    return { ok: true as const, path: `Galeria/${clean}` };
  } catch (e) {
    console.warn("createImageFolder:", e);
    return { ok: false as const, error: "Nie udało się utworzyć folderu" };
  }
}

/**
 * Usuwa folder galerii razem z zawartością.
 *
 * Dwa kroki, bo Cloudinary nie skasuje folderu, w którym cokolwiek jest.
 * Cloud działa w trybie dynamic folders - public_id nie zawiera ścieżki,
 * więc kasowanie „po prefiksie" tu nie zadziała i trzeba wskazać zasoby
 * po identyfikatorach.
 *
 * Pierwsze wywołanie bez `potwierdzone` niczego nie usuwa - zwraca liczbę
 * zdjęć, żeby panel mógł zapytać wprost: „usuniesz 28 zdjęć".
 */
export async function deleteImageFolder(
  path: string,
  potwierdzone = false
): Promise<
  | { ok: true; usunieto: number }
  | { ok: false; error: string }
  | { ok: false; wymagaPotwierdzenia: true; liczba: number }
> {
  await requireUser();

  // Foldery podstron odpowiadają treści serwisu - ich usunięcie zostawiłoby
  // strony z odnośnikami do nieistniejących zdjęć.
  if (!path.startsWith("Galeria/")) {
    return {
      ok: false as const,
      error:
        "Usuwać można tylko zakładki galerii. Foldery zdjęć podstron są powiązane z treścią strony.",
    };
  }

  try {
    const zasoby = await cloudinary.api.resources_by_asset_folder(path, {
      max_results: 500,
    });
    const publicIds = ((zasoby.resources ?? []) as CloudResource[]).map((r) => r.public_id);

    if (publicIds.length && !potwierdzone) {
      return { ok: false as const, wymagaPotwierdzenia: true as const, liczba: publicIds.length };
    }

    // delete_resources przyjmuje najwyżej 100 identyfikatorów naraz.
    for (let i = 0; i < publicIds.length; i += 100) {
      await cloudinary.api.delete_resources(publicIds.slice(i, i + 100));
    }
    await cloudinary.api.delete_folder(path);
    // Identyfikatory skasowanych zdjęć mogą siedzieć w blokach treści dowolnej
    // strony, a stąd nie da się ustalić których - unieważniamy całe drzewo.
    revalidatePath("/", "layout");
    return { ok: true as const, usunieto: publicIds.length };
  } catch (e) {
    console.warn("deleteImageFolder:", e);
    return {
      ok: false as const,
      error:
        "Nie udało się usunąć zakładki. Jeśli błąd się powtórzy, przekaż to osobie technicznej.",
    };
  }
}

/** Czy gdziekolwiek w tej strukturze siedzi dokładnie ten identyfikator. */
function zawieraId(wartosc: unknown, publicId: string): boolean {
  if (typeof wartosc === "string") return wartosc === publicId;
  if (Array.isArray(wartosc)) return wartosc.some((v) => zawieraId(v, publicId));
  if (wartosc && typeof wartosc === "object")
    return Object.values(wartosc).some((v) => zawieraId(v, publicId));
  return false;
}

/**
 * Nazwy stron, na których to zdjęcie jest wstawione w treść.
 *
 * Bez tego kasowanie było ślepe: panel obiecywał „Zniknie ze strony wszędzie,
 * gdzie było użyte", a w rzeczywistości zostawał rozbity kadr i nie było jak
 * ustalić, której strony to dotyczy — identyfikator zostaje w blokach treści,
 * a Cloudinary oddaje 404. Przechodzimy cztery miejsca, w których bloki mogą
 * siedzieć. Przy awarii bazy zwracamy pustą listę: lepiej nie zablokować
 * kasowania niż zablokować je bez powodu.
 */
async function znajdzUzycia(publicId: string): Promise<string[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const strony: string[] = [];
  try {
    const [ustawienia, podstrony, artykuly, wlasne] = await Promise.all([
      sb.from("site_settings").select("key,value").like("key", "page:%"),
      sb.from("article_overrides").select("topic,slug,title,blocks"),
      sb.from("articles").select("title,content,cover_image").is("deleted_at", null),
      sb.from("custom_pages").select("title,blocks").is("deleted_at", null),
    ]);

    for (const r of ustawienia.data ?? []) {
      if (!zawieraId(r.value, publicId)) continue;
      const slug = String(r.key).slice(5);
      strony.push(getEditablePage(slug)?.label ?? slug);
    }
    for (const r of podstrony.data ?? [])
      if (zawieraId(r.blocks, publicId)) strony.push(String(r.title ?? `${r.topic}/${r.slug}`));
    for (const r of artykuly.data ?? [])
      if (r.cover_image === publicId || zawieraId(r.content, publicId))
        strony.push(`Aktualność: ${r.title}`);
    for (const r of wlasne.data ?? [])
      if (zawieraId(r.blocks, publicId)) strony.push(String(r.title));
  } catch (e) {
    console.warn("znajdzUzycia:", e);
    return [];
  }
  return strony;
}

/**
 * Lista stron, na których zdjęcie jest wstawione w treść - do pytania w panelu.
 *
 * Osobno od `deleteImage`, żeby panel mógł zadać JEDNO pytanie z konkretami
 * zamiast dwóch pod rząd. `potwierdzone` w `deleteImage` zostaje mimo to jako
 * bezpiecznik na wypadek innego wołającego.
 */
export async function sprawdzUzyciaZdjecia(publicId: string) {
  await requireUser();
  return { ok: true as const, strony: await znajdzUzycia(publicId) };
}

export async function deleteImage(publicId: string, potwierdzone = false) {
  await requireUser();

  if (!potwierdzone) {
    const strony = await znajdzUzycia(publicId);
    if (strony.length)
      return { ok: false as const, wymagaPotwierdzenia: true as const, strony };
  }

  try {
    const res = await cloudinary.uploader.destroy(publicId);
    if (res.result !== "ok")
      return { ok: false as const, error: `Cloudinary: ${res.result}` };
    // Jak wyżej: to zdjęcie mogło być wstawione w treść dowolnej podstrony.
    revalidatePath("/", "layout");
    return { ok: true as const };
  } catch (e) {
    console.warn("deleteImage:", e);
    return { ok: false as const, error: "Nie udało się usunąć zdjęcia" };
  }
}

/**
 * Trasy publiczne pokazujące zdjęcia z danego folderu Cloudinary.
 *
 * Zakładka „Zdjęcia" obsługuje dwa rodzaje folderów: `Galeria/<album>` zasila
 * /galeria, a `Strona/<temat>/<slug>` gromadzi zdjęcia wstawione w treść danej
 * podstrony. Puste wyjście znaczy „nie wiem", nie „nigdzie" — wołający ma
 * wtedy unieważnić całe drzewo.
 */
function trasyDlaFolderu(folderPath: string): string[] {
  if (/^Galeria\/[^/]+$/.test(folderPath)) return ["/galeria"];
  const m = /^Strona\/([a-z0-9-]+)(?:\/([a-z0-9-]+))?$/.exec(folderPath);
  if (!m) return [];
  const [, temat, slug] = m;
  return slug ? [`/${temat}/${slug}`, `/${temat}`] : [`/${temat}`];
}

/**
 * Zrzuca cache tras, na których widać zdjęcia z danego folderu.
 *
 * Pliki idą z przeglądarki prosto do Cloudinary, z pominięciem serwera, więc
 * po uploadzie nie wykonuje się żadna akcja, która mogłaby unieważnić stronę.
 * Bez tego panel pisał „Wgrano 8 zdjęć. Są już widoczne na stronie", a strona
 * dalej oddawała wersję z cache.
 *
 * Ścieżkę mapujemy tutaj, a nie w panelu: pierwsza wersja tej funkcji
 * unieważniała /galeria niezależnie od folderu, więc redaktor wgrywający
 * zdjęcia do podstrony tematycznej dostawał zapewnienie o widoczności,
 * a odświeżała się trasa, na której tych zdjęć w ogóle nie ma.
 */
export async function odswiezGalerie(folderPath: string) {
  await requireUser();

  const trasy = trasyDlaFolderu(folderPath);
  if (!trasy.length) {
    // Nieznany kształt ścieżki - taniej unieważnić za dużo niż skłamać.
    revalidatePath("/", "layout");
    return { ok: true as const, trasy: ["/"] };
  }
  for (const trasa of trasy) revalidatePath(trasa);
  return { ok: true as const, trasy };
}

/**
 * Podpis do bezpośredniego uploadu z przeglądarki do Cloudinary
 * (plik nie przechodzi przez serwer Next - brak limitów rozmiaru).
 * Cloud działa w trybie dynamic folders, więc używamy asset_folder -
 * public_id pozostaje krótkie, bez ścieżki folderu.
 */
export async function getUploadSignature(folder: string) {
  await requireUser();
  const timestamp = Math.round(Date.now() / 1000);
  const paramsToSign: Record<string, string | number> = {
    asset_folder: folder,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET!.replace(/"/g, "")
  );
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY!.replace(/"/g, ""),
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!.replace(/"/g, ""),
    folder,
  };
}
