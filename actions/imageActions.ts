"use server";

import { revalidatePath } from "next/cache";
import { v2 as cloudinary } from "cloudinary";
import { KLUCZ_OKLADEK, pobierzOkladki } from "@/lib/galeriaOkladki";
import { pobierzDatyDodania, wgDatyDodania, zapiszDateDodania } from "@/lib/galeriaKolejnosc";
import { folderSekcjiZdjec } from "@/lib/pages";
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
 * Sekcje zdjęć podstron — JEDNA na sekcję menu najwyższego poziomu.
 *
 * DLACZEGO Z DRZEWA, A NIE Z CLOUDINARY
 * -------------------------------------
 * Wcześniej ta lista powstawała ze `sub_folders("Strona")` i schodziła o poziom
 * niżej, do slugów. Przy dzisiejszym drzewie dawało to DZIESIĘĆ kafelków
 * (`buddyzm` × 4 podstrony, `o-shorinji` × 4, `organizacja` × 2), a klient
 * poprosił o sześć i napisał wprost: „nie ma potrzeby rozbudowywania tej
 * galerii osobno dla każdej podstrony w zakładce Buddyzm".
 *
 * Zgłosił też, że „nie widzi możliwości zmiany ich nazw" — i słusznie, bo
 * nazwa brała się z nazwy folderu w Cloudinary. Teraz bierze się z etykiety
 * w menu, więc zmienia się tam, gdzie redaktor i tak ją zmienia.
 *
 * Sekcje liczymy z drzewa, a nie z listy folderów, także dlatego, że sekcja
 * może jeszcze NIE MIEĆ folderu w Cloudinary — dziś nie mają go Aktualności,
 * Zajęcia i Program nauczania. Kafelek i tak się pokaże (pusty), więc redaktor
 * ma gdzie wrzucić pierwsze zdjęcie. To była jego ostatnia uwaga: „jak dodawać
 * zdjęcia na podstrony, dla których jeszcze nie ma folderu, np. Aktualności".
 */
async function sekcjeZdjec(): Promise<CloudFolder[]> {
  const sb = getSupabaseAdmin();
  if (!sb) return [];
  const { data, error } = await sb
    .from("pages")
    .select("id,parent_id,title,menu_label,full_path,depth,in_menu")
    .is("deleted_at", null)
    .eq("in_menu", true)
    .order("position", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    console.warn("sekcjeZdjec:", error.message);
    return [];
  }
  const wiersze = (data ?? []) as {
    id: string;
    parent_id: string | null;
    title: string;
    menu_label: string | null;
    full_path: string | null;
    depth: number;
  }[];

  const out: CloudFolder[] = [];
  const juz = new Set<string>();
  for (const w of wiersze.filter((x) => x.depth === 0)) {
    // Nagłówek („ZAJĘCIA") nie ma adresu, więc segment bierzemy z pierwszego
    // dziecka, które go ma — inaczej sekcja z podstronami wypadłaby z listy.
    const adres =
      w.full_path ?? wiersze.find((d) => d.parent_id === w.id && d.full_path)?.full_path ?? null;
    const folder = folderSekcjiZdjec(adres);
    if (!folder) continue;
    // Galeria ma własną strefę w tej samej zakładce — nie dublujemy jej tutaj.
    if (folder === "Strona/galeria") continue;
    if (juz.has(folder)) continue;
    juz.add(folder);
    out.push({ name: `Strona / ${w.menu_label ?? w.title}`, path: folder });
  }
  return out;
}

/**
 * Foldery dostępne w panelu: podfoldery "Galeria" (zakładki publicznej
 * galerii) oraz sekcje zdjęć podstron (patrz `sekcjeZdjec`).
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
  folders.push(...(await sekcjeZdjec()));
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
  // Zasoby trzymamy jako listę, nie jako licznik po dokładnej ścieżce: kafelek
  // SEKCJI musi zsumować zdjęcia z CAŁEGO poddrzewa (`Strona/buddyzm` zbiera
  // też `Strona/buddyzm/medytacja`). Zdjęcia już wgrane pod adresy podstron
  // zostają w Cloudinary tam, gdzie są — konto jest wspólne z produkcją, więc
  // niczego nie przenosimy; zmienia się tylko to, jak panel je grupuje.
  const zasoby: { publicId: string; folder: string }[] = [];
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
      if (r.asset_folder) zasoby.push({ publicId: r.public_id, folder: r.asset_folder });
    }
  } catch (e) {
    // Bez liczników widok nadal działa - pokaże foldery bez okładek.
    console.warn("listFolderPreviews:", e);
  }

  const podglady = foldery.map((f) => {
    const galeria = f.path.startsWith("Galeria");
    // Album galerii to dokładnie jeden folder; sekcja to folder z poddrzewem.
    const nasze = zasoby.filter((z) =>
      galeria ? z.folder === f.path : z.folder === f.path || z.folder.startsWith(`${f.path}/`),
    );
    // `zasoby` przyszły posortowane malejąco po dacie, więc pierwsze pasujące
    // zdjęcie jest najnowsze.
    const pierwsza = nasze[0]?.publicId ?? null;
    const wybrana = nasze.find((z) => z.publicId === okladki[f.path])?.publicId ?? null;
    // "Galeria / Pokazy" -> "Pokazy"; "Strona / Buddyzm" -> "Buddyzm"
    const nazwaKrotka = f.name.replace(/^(Galeria|Strona)\s*\/\s*/, "");
    return {
      ...f,
      rodzaj: galeria ? ("galeria" as const) : ("strona" as const),
      nazwaKrotka,
      okladka: wybrana ?? pierwsza,
      okladkaWybrana: wybrana !== null,
      liczba: nasze.length,
    };
  });

  // Albumy galerii: najnowszy dodany na początku — o to poprosił klient.
  // Sekcje zdjęć podstron zostają w kolejności MENU: tam porządek ma
  // odpowiadać drzewu, a nie temu, kiedy przypadkiem wgrano pierwsze zdjęcie.
  const daty = await pobierzDatyDodania();
  return [
    ...wgDatyDodania(
      podglady.filter((p) => p.rodzaj === "galeria"),
      daty,
    ),
    ...podglady.filter((p) => p.rodzaj === "strona"),
  ];
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

/**
 * Unieważnia publiczną galerię.
 *
 * `app/galeria/page.tsx` nie ma eksportu `revalidate`, więc albumy powstają
 * RAZ, na buildzie. Bez tego wywołania redaktor tworzy zakładkę albo kasuje
 * zdjęcie w panelu, a na stronie nie widzi tego do następnego wdrożenia —
 * i wygląda to jak „panel nie zapisał". Wyszło w teście odbioru: nowy album
 * był w panelu pierwszy, a na `/galeria` nie było go wcale.
 *
 * Świadomie na żądanie, a nie okresowo: każde odświeżenie tej trasy to dwa
 * zapytania do Cloudinary (lista podfolderów plus wyszukanie zasobów), więc
 * `revalidate` liczone w sekundach płaciłoby za nie także wtedy, gdy nikt
 * niczego nie zmienił.
 */
function odswiezGalerie() {
  // Unieważnienie cache'u NIE MOŻE wywrócić operacji, która już się udała.
  // Wywołanie stało wcześniej wewnątrz `try` w `deleteImageFolder`, więc gdy
  // rzuciło, katalog był SKASOWANY, a redaktor dostawał „Nie udało się usunąć
  // zakładki" — po odświeżeniu zakładki nie było. Komunikat kłamał.
  try {
    revalidatePath("/galeria");
  } catch (e) {
    console.warn("[galeria] nie udało się unieważnić cache:", e);
  }
}

export async function createImageFolder(name: string) {
  await requireUser();
  const clean = name.trim().replace(/[^\p{L}\p{N} _-]/gu, "");
  if (!clean) return { ok: false as const, error: "Nieprawidłowa nazwa folderu" };
  try {
    await cloudinary.api.create_folder(`Galeria/${clean}`);
    // Data dodania — bez niej nowy, jeszcze PUSTY album nie miałby czym trafić
    // na początek listy: Cloudinary nie zwraca daty folderu, a zdjęć w nim
    // jeszcze nie ma. O to poprosił klient: „przy dodawaniu kolejnego folderu
    // automatycznie pojawiał się on na samym początku listy".
    await zapiszDateDodania(`Galeria/${clean}`);
    odswiezGalerie();
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
    odswiezGalerie();
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

export async function deleteImage(publicId: string) {
  await requireUser();
  try {
    const res = await cloudinary.uploader.destroy(publicId);
    if (res.result !== "ok")
      return { ok: false as const, error: `Cloudinary: ${res.result}` };
    odswiezGalerie();
    return { ok: true as const };
  } catch (e) {
    console.warn("deleteImage:", e);
    return { ok: false as const, error: "Nie udało się usunąć zdjęcia" };
  }
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
