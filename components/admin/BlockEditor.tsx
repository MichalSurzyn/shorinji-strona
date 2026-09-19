"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { NewsBlock } from "@/lib/newsTypes";
import { clThumb } from "@/lib/cloudinary";
import ImagePicker from "./ImagePicker";
import FilePicker from "./FilePicker";
import { KLASY_KONTROLKI, Pole, PoleTekst, PoleWieloliniowe } from "./Pole";

/**
 * Tryby edytora:
 * - "news"    – aktualności (wszystkie bloki, żółte wyróżnienie)
 * - "page"    – strony statyczne (jak news)
 * - "article" – podstrony tematyczne (zapis do markdown: bez galerii,
 *               tabel, linków-kafelków i wyróżnienia ==żółtego==)
 */
export type EditorMode = "news" | "page" | "article";

interface Props {
  value: NewsBlock[];
  onChange: (blocks: NewsBlock[]) => void;
  mode?: EditorMode;
  /** Folder Cloudinary podpowiadany w wyborze zdjęć. */
  defaultFolder?: string;
}

/**
 * Nazwy elementów strony widziane przez redaktora.
 *
 * Świadomie unikamy słowa „blok" i skrótów z kodu (H1, H2, callout).
 * Nazwa ma mówić, CO Z TEGO WYJDZIE na stronie, a nie jak się to nazywa
 * w formacie zapisu.
 */
const BLOCK_LABELS: Record<NewsBlock["type"], string> = {
  heading: "Nagłówek sekcji",
  subheading: "Podtytuł",
  paragraph: "Tekst",
  callout: "Wyróżniona ramka",
  quote: "Cytat",
  list: "Lista wypunktowana",
  ordered: "Lista numerowana",
  image: "Zdjęcie",
  gallery: "Kilka zdjęć obok siebie",
  table: "Tabela",
  links: "Lista odnośników",
  video: "Film z YouTube",
  download: "Dokument do pobrania",
  person: "Karta osoby",
  bank: "Numer konta do wpłat",
  kontakt: "Telefon, e-mail i profile",
};

/** Podpowiedź pod nazwą w menu dodawania - co ten element robi. */
const BLOCK_HINTS: Partial<Record<NewsBlock["type"], string>> = {
  paragraph: "Zwykły akapit tekstu",
  heading: "Dzieli długi tekst na części",
  subheading: "Mniejszy nagłówek wewnątrz sekcji",
  callout: "Tekst na kolorowym tle, do rzeczy najważniejszych",
  table: "Wiersze i kolumny, na przykład cennik",
  links: "Odnośniki jeden pod drugim, na przykład nagrania",
  download: "Nazwa dokumentu i przycisk pobierania",
  person: "Zdjęcie, imię i opis - na przykład instruktor",
  gallery: "Siatka zdjęć",
  bank: "Numer konta pobierany z zakładki Dane organizacji",
  kontakt: "Dane kontaktowe pobierane z zakładki Dane organizacji",
};

const ALL_ADD_OPTIONS: { type: NewsBlock["type"]; label: string; icon: string }[] = [
  { type: "paragraph", label: "Tekst", icon: "¶" },
  { type: "heading", label: "Nagłówek sekcji", icon: "H" },
  { type: "subheading", label: "Podtytuł", icon: "h" },
  { type: "list", label: "Lista wypunktowana", icon: "≡" },
  { type: "ordered", label: "Lista numerowana", icon: "①" },
  { type: "quote", label: "Cytat", icon: "❝" },
  { type: "callout", label: "Wyróżniona ramka", icon: "▢" },
  { type: "image", label: "Zdjęcie", icon: "▣" },
  { type: "gallery", label: "Kilka zdjęć", icon: "▦" },
  { type: "table", label: "Tabela", icon: "𝄜" },
  { type: "links", label: "Lista odnośników", icon: "▶" },
  { type: "video", label: "Film z YouTube", icon: "🎬" },
  { type: "download", label: "Dokument do pobrania", icon: "⬇" },
  { type: "person", label: "Karta osoby", icon: "👤" },
  { type: "bank", label: "Numer konta", icon: "🏦" },
  { type: "kontakt", label: "Dane kontaktowe", icon: "✆" },
];

const MODE_BLOCKS: Record<EditorMode, NewsBlock["type"][]> = {
  news: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "callout", "image", "gallery", "table", "links", "video", "download", "person"],
  page: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "callout", "image", "gallery", "table", "links", "video", "download", "person", "bank", "kontakt"],
  article: ["paragraph", "heading", "subheading", "list", "ordered", "quote", "image", "video", "person"],
};

function newBlock(type: NewsBlock["type"]): NewsBlock {
  switch (type) {
    case "list":
    case "ordered":
      return { type, items: [""] } as NewsBlock;
    case "image":
      return { type: "image", publicId: "", caption: "", variant: "wide" };
    case "gallery":
      return { type: "gallery", publicIds: [] };
    case "table":
      return { type: "table", headers: ["Rodzaj opłaty", "Kwota"], rows: [{ label: "", price: "" }] };
    case "links":
      return { type: "links", items: [{ label: "", url: "" }] };
    case "video":
      return { type: "video", url: "", caption: "", aspect: "16:9" };
    case "download":
      return { type: "download", label: "", url: "", imageId: null, note: "" };
    case "person":
      return { type: "person", name: "", role: "", subtitle: "", imageId: null, facts: [], note: "" };
    default:
      return { type, text: "" } as NewsBlock;
  }
}

/**
 * Paleta elementów do wstawienia. Ten sam zestaw przycisków obsługuje
 * dodawanie na końcu treści i wstawianie pod konkretnym elementem — jedna
 * definicja, więc oba miejsca nie mogą się rozjechać zestawem.
 */
function PaletaElementow({
  opcje,
  onWybierz,
}: {
  opcje: { type: NewsBlock["type"]; label: string; icon: string }[];
  onWybierz: (typ: NewsBlock["type"]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcje.map((opt) => (
        <button
          key={opt.type}
          onClick={() => onWybierz(opt.type)}
          type="button"
          title={BLOCK_HINTS[opt.type] ?? opt.label}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
        >
          <span className="text-indigo-500 font-bold">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Edytor blokowy - bez markdownu, zdjęcia wybierasz wizualnie. */
export default function BlockEditor({
  value,
  onChange,
  mode = "news",
  defaultFolder,
}: Props) {
  const [picker, setPicker] = useState<{ index: number; multi: boolean } | null>(
    null
  );

  /**
   * Pod którym elementem jest teraz otwarta paleta „dodaj tutaj".
   * `null` = zamknięta. Stan w Reakcie, a nie `<details>`: paleta ma się
   * zamknąć SAMA po wybraniu elementu, a stanu otwarcia trzymanego w DOM
   * nie da się zamknąć bez sięgania do `ref`.
   */
  const [dodajPod, setDodajPod] = useState<number | null>(null);

  /**
   * Historia stanów treści - do cofania. Trzymamy ostatnie dziesięć,
   * bo to wystarcza na pomyłkę, a nie rośnie w nieskończoność.
   *
   * Cofanie zamiast pytania „na pewno?" przy każdym usunięciu: modal
   * przy każdej operacji uczy odruchowego klikania „tak" i podnosi liczbę
   * przypadkowych skasowań zamiast ją obniżać.
   */
  const historia = useRef<NewsBlock[][]>([]);
  const [glebokosc, setGlebokosc] = useState(0);
  const [ostatniaAkcja, setOstatniaAkcja] = useState<string | null>(null);

  function zmien(next: NewsBlock[], opisAkcji?: string) {
    historia.current = [...historia.current, value].slice(-10);
    setGlebokosc(historia.current.length);
    setOstatniaAkcja(opisAkcji ?? null);
    onChange(next);
  }

  function cofnij() {
    const poprzedni = historia.current[historia.current.length - 1];
    if (!poprzedni) return;
    historia.current = historia.current.slice(0, -1);
    setGlebokosc(historia.current.length);
    setOstatniaAkcja(null);
    onChange(poprzedni);
  }

  function update(index: number, block: NewsBlock) {
    const next = [...value];
    next[index] = block;
    // Edycja treści pola nie trafia do historii - inaczej każde naciśnięcie
    // klawisza byłoby osobnym krokiem i cofanie stałoby się bezużyteczne.
    onChange(next);
  }

  function remove(index: number) {
    const usuwany = value[index];
    zmien(
      value.filter((_, i) => i !== index),
      `Usunięto element: ${BLOCK_LABELS[usuwany.type]}`
    );
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.length) return;
    const next = [...value];
    [next[index], next[target]] = [next[target], next[index]];
    zmien(next, "Przesunięto element");
  }

  /**
   * Wstawienie elementu. `poIndeksie` to pozycja, PO której ma stanąć nowy
   * element; `undefined` znaczy „na samym końcu".
   *
   * Dotąd dodawało się wyłącznie na koniec, więc żeby wstawić akapit w środku
   * dłuższej strony, redaktor dodawał go na dole i przeklikiwał strzałkami
   * w górę przez całą treść. Zgłoszone dosłownie: „jak chcę coś dodać, to muszę
   * dodawać na dole i przeklikiwać na górę".
   *
   * Indeks dla wybieraka zdjęć MUSI być liczony z pozycji wstawienia, nie
   * z `value.length` — przy wstawianiu w środku ten drugi wskazywałby obcy
   * blok i zdjęcie wjechałoby w niewłaściwy element.
   */
  function add(type: NewsBlock["type"], poIndeksie?: number) {
    const pozycja = poIndeksie === undefined ? value.length : poIndeksie + 1;
    const next = [...value.slice(0, pozycja), newBlock(type), ...value.slice(pozycja)];
    zmien(next, `Dodano element: ${BLOCK_LABELS[type]}`);
    if (type === "image") setPicker({ index: pozycja, multi: false });
    if (type === "gallery") setPicker({ index: pozycja, multi: true });
  }

  function handlePicked(publicIds: string[]) {
    if (!picker) return;
    const block = value[picker.index];
    if (!block) return;
    if (block.type === "image") {
      update(picker.index, { ...block, publicId: publicIds[0] });
    } else if (block.type === "gallery") {
      update(picker.index, {
        ...block,
        publicIds: [...block.publicIds, ...publicIds],
      });
    } else if (block.type === "download" || block.type === "person") {
      update(picker.index, { ...block, imageId: publicIds[0] });
    }
  }

  const addOptions = ALL_ADD_OPTIONS.filter((o) =>
    MODE_BLOCKS[mode].includes(o.type)
  );

  return (
    // `space-y-5`, nie `space-y-3`: po powiększeniu pól i dołożeniu opisów pod
    // nimi sąsiednie elementy zlewały się w jedną ścianę i nie było widać,
    // gdzie kończy się jeden, a zaczyna drugi.
    <div className="space-y-5">
      {/* Cofanie jako plywajace powiadomienie w prawym dolnym rogu.
          W przeplywie strony ladowalo nad trescia i przy dluzszej stronie
          bylo poza ekranem dokladnie wtedy, gdy bylo potrzebne - zaraz po
          usunieciu elementu, ktory redaktor wlasnie oglada. */}
      {glebokosc > 0 && (
        <div
          role="status"
          // `bottom-24`, nie `bottom-6`: wspólny `Komunikat` stoi na
          // `fixed bottom-5 right-5 z-50`, czyli dokładnie tutaj i wyżej
          // w stosie. Przy poprzednim ustawieniu toast po zapisie zakrywał
          // przycisk „Cofnij" — i to na te cztery sekundy, w których redaktor
          // najczęściej chce go kliknąć.
          className="fixed bottom-24 right-6 z-40 flex items-center gap-3 rounded-xl border border-slate-300
                     bg-white px-4 py-3 shadow-xl max-w-[calc(100vw-3rem)]"
        >
          <span className="text-sm text-slate-700 truncate">
            {ostatniaAkcja ?? "Ostatnia zmiana w treści"}
          </span>
          <button
            type="button"
            onClick={cofnij}
            className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm font-medium text-slate-700 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
          >
            ↶ Cofnij
          </button>
        </div>
      )}

      {/* Pomoc - formatowanie (prawy rog) */}
      <div className="flex justify-end">
        <details className="group relative z-10 text-sm">
          <summary className="cursor-pointer select-none rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 px-3.5 py-1.5 font-medium hover:bg-indigo-100 transition-colors list-none">
            ⓘ Pomoc – formatowanie
          </summary>
          <div className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white shadow-xl p-4 text-slate-600 space-y-2">
            <p className="font-semibold text-slate-900">W tekście możesz użyć:</p>
            <p>
              <code className="bg-slate-100 px-1 rounded">**pogrubienie**</code>{" "}
              → <strong>pogrubienie</strong>
            </p>
            <p>
              <code className="bg-slate-100 px-1 rounded">*kursywa*</code>{" "}
              → <em>kursywa</em>
            </p>
            {mode !== "article" && (
              <p>
                <code className="bg-slate-100 px-1 rounded">==wyróżnienie==</code>{" "}
                → <span className="text-yellow-600">żółty kolor strony</span>
              </p>
            )}
            <p>
              <code className="bg-slate-100 px-1 rounded">[tekst](/adres)</code>{" "}
              → <span className="text-indigo-600 underline">link</span> (np.{" "}
              <code className="bg-slate-100 px-1 rounded">[cennik](/cennik)</code>)
            </p>
            <p className="pt-1 border-t border-slate-100">
              Najszybciej: <strong>zaznacz tekst</strong> i kliknij przycisk{" "}
              <strong>B</strong>{mode !== "article" && ", Żółty"} albo{" "}
              <strong>Link</strong> nad polem.
            </p>
            <p>
              <strong>Zdjęcia</strong> dodajesz blokiem „Zdjęcie&rdquo; – wybierasz
              z Cloudinary albo wgrywasz z dysku, zero kodu.
            </p>
          </div>
        </details>
      </div>

      {value.length === 0 && (
        <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center">
          <p className="text-sm font-medium text-slate-600">Ta strona jest jeszcze pusta.</p>
          <p className="text-sm text-slate-400 mt-1">
            Zacznij od elementu „Tekst&rdquo; poniżej - resztę dołożysz później.
          </p>
        </div>
      )}

      {value.map((block, i) => (
        <div key={i}>
        {/* `data-blok` to zaczep dla testów odbioru: pozwala sprawdzić
            KOLEJNOŚĆ typów elementów po wstawieniu, bez dopasowywania po
            klasach Tailwinda, które zmienią się przy pierwszym liftingu. */}
        <div data-blok={block.type} className="bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-slate-100">
            <span className="text-sm font-bold uppercase tracking-wider text-indigo-600">
              {BLOCK_LABELS[block.type]}
            </span>
            <div className="flex items-center gap-1 text-slate-400">
              <button
                onClick={() => setDodajPod(dodajPod === i ? null : i)}
                className="mr-1 rounded px-2 py-1 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 transition-colors"
                title="Wstaw nowy element pod tym"
                type="button"
              >
                + Wstaw tutaj
              </button>
              <button
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Przenieś wyżej"
                type="button"
              >
                ↑
              </button>
              <button
                onClick={() => move(i, 1)}
                disabled={i === value.length - 1}
                className="p-1.5 hover:text-indigo-600 disabled:opacity-30 transition-colors"
                title="Przenieś niżej"
                type="button"
              >
                ↓
              </button>
              <button
                onClick={() => remove(i)}
                className="p-1.5 hover:text-red-600 transition-colors"
                title="Usuń blok"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="p-5 sm:p-6">
            <BlockBody
              block={block}
              mode={mode}
              onChange={(b) => update(i, b)}
              openPicker={(multi) => setPicker({ index: i, multi })}
            />
          </div>
        </div>

        {/* Paleta wstawiania — POD tym elementem, nie na końcu listy. Warunek
            jest prawdziwy dla dokładnie jednego `i`, więc renderuje się raz. */}
        {dodajPod === i && (
          <div data-paleta="wstaw" className="mt-3 rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-base font-semibold text-slate-900">
                Nowy element stanie pod „{BLOCK_LABELS[block.type]}”
              </p>
              <button
                type="button"
                onClick={() => setDodajPod(null)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm text-slate-600 hover:text-slate-900"
              >
                Anuluj
              </button>
            </div>
            <PaletaElementow
              opcje={addOptions}
              onWybierz={(typ) => {
                add(typ, i);
                setDodajPod(null);
              }}
            />
          </div>
        )}
        </div>
      ))}

      <div className="border border-dashed border-slate-300 rounded-xl p-5">
        <p className="mb-1.5 text-base font-semibold text-slate-900">Dodaj element</p>
        <p className="mb-3 text-sm leading-snug text-slate-500">
          Nowy element pojawi się na dole strony. Żeby wstawić go w środku
          treści, użyj „+ Wstaw tutaj” w nagłówku elementu, pod którym ma stanąć.
        </p>
        <PaletaElementow opcje={addOptions} onWybierz={(typ) => add(typ)} />
      </div>

      <ImagePicker
        open={picker !== null}
        multi={picker?.multi ?? false}
        defaultFolder={defaultFolder}
        onClose={() => setPicker(null)}
        onSelect={handlePicked}
      />
    </div>
  );
}

/* --------------- Powtarzalne wiersze: tabela, linki, fakty --------------- */

/**
 * Układy siatki dla wierszy powtarzalnych. Stała, a nie wklejony w dwóch
 * miejscach string: pasek nazw kolumn musi stać dokładnie nad kolumnami
 * wierszy, a przy dwóch kopiach rozjeżdżają się po pierwszej poprawce.
 *
 * Do `sm` wiersz jest jednokolumnowy i pola układają się jedno pod drugim —
 * po zwiększeniu paddingów trzy pola obok siebie nie mieszczą się na telefonie.
 */
const UKLAD_WIERSZA_TABELI = "sm:grid-cols-[1fr_10rem_9rem_2rem]";
const UKLAD_WIERSZA_LINKU = "sm:grid-cols-[1fr_1.4fr_2rem]";
const UKLAD_WIERSZA_FAKTU = "sm:grid-cols-[1fr_1fr_2rem]";

/** Wspólne klasy jednego wiersza — ta sama siatka co pasek nazw kolumn. */
function klasyWiersza(uklad: string) {
  return `grid gap-3 sm:items-center ${uklad}`;
}

/**
 * Pasek nazw kolumn nad powtarzalnymi wierszami.
 *
 * Wierszy bywa kilkanaście, więc etykieta przy każdym polu z osobna dałaby
 * ścianę napisów zamiast tabeli. Nazwa kolumny stoi raz, na górze, a samo pole
 * dostaje `aria-label`, żeby czytnik ekranu przeczytał je tak samo.
 * Poniżej `sm` wiersz się zawija i pasek przestałby opisywać cokolwiek —
 * dlatego wtedy znika, a rolę podpisu przejmują placeholdery.
 */
function PasekKolumn({ uklad, nazwy }: { uklad: string; nazwy: string[] }) {
  return (
    <div
      aria-hidden="true"
      className={`mb-1.5 hidden gap-3 text-sm font-semibold text-slate-500 sm:grid ${uklad}`}
    >
      {nazwy.map((nazwa, i) => (
        <span key={i}>{nazwa}</span>
      ))}
    </div>
  );
}

/* ----------------------------- Bloki ----------------------------- */

function BlockBody({
  block,
  mode,
  onChange,
  openPicker,
}: {
  block: NewsBlock;
  mode: EditorMode;
  onChange: (b: NewsBlock) => void;
  openPicker: (multi: boolean) => void;
}) {
  // Okno wyboru pliku dla bloku „Dokument do pobrania". Stan trzymamy tutaj,
  // bo dotyczy jednego bloku, a nie całego edytora.
  const [wyborPliku, setWyborPliku] = useState(false);

  // Id dla selectów: `Pole` tylko wystawia id opisu, samą kontrolkę podpinamy
  // ręcznie. Hooki muszą stać przed `switch`, więc id powstają dla każdego
  // bloku, a używa ich ten, który akurat ma select.
  const idWariantuZdjecia = useId();
  const idProporcjiFilmu = useId();
  const idAdresuPliku = useId();

  switch (block.type) {
    case "heading":
    case "subheading":
      return (
        <PoleTekst
          etykieta={block.type === "heading" ? "Tytuł sekcji" : "Podtytuł"}
          opis={
            block.type === "heading"
              ? "Duży napis otwierający nową część strony."
              : "Mniejszy napis wewnątrz sekcji, dzieli ją na kawałki."
          }
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Treść nagłówka..."
          className={block.type === "heading" ? "font-bold" : "font-semibold"}
        />
      );
    case "paragraph":
    case "callout":
    case "quote":
      return <TextAreaWithFormat block={block} mode={mode} onChange={onChange} />;
    case "list":
    case "ordered":
      return (
        <PoleWieloliniowe
          etykieta="Punkty listy"
          opis={
            block.type === "list"
              ? "Każda linia to jeden punkt z kropką na stronie."
              : "Każda linia to jeden punkt. Numery 1, 2, 3 dopisują się same."
          }
          value={block.items.join("\n")}
          onChange={(e) =>
            onChange({ ...block, items: e.target.value.split("\n") })
          }
          rows={Math.max(3, block.items.length + 1)}
          placeholder={"Pierwszy punkt\nDrugi punkt\nTrzeci punkt"}
          className="leading-relaxed"
        />
      );
    case "image":
      return (
        <div className="flex flex-col sm:flex-row gap-5">
          {block.publicId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clThumb(block.publicId, 300)}
              alt=""
              className="w-full sm:w-40 h-40 object-cover rounded-lg border border-slate-200"
            />
          ) : (
            <div className="w-full sm:w-40 h-40 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm">
              Brak zdjęcia
            </div>
          )}
          <div className="flex-1 space-y-5">
            <Pole
              etykieta="Plik zdjęcia"
              opis="Wybierasz z biblioteki klubu albo wgrywasz z dysku – bez wklejania adresów."
            >
              <button
                onClick={() => openPicker(false)}
                type="button"
                className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium px-4 py-2.5 transition-colors"
              >
                {block.publicId ? "Zmień zdjęcie" : "Wybierz zdjęcie"}
              </button>
            </Pole>
            <Pole
              etykieta="Szerokość na stronie"
              htmlFor={idWariantuZdjecia}
              opis="Szerokie wypełnia kolumnę tekstu, pionowe jest węższe."
            >
              <select
                id={idWariantuZdjecia}
                aria-describedby={`${idWariantuZdjecia}-opis`}
                value={block.variant ?? "wide"}
                onChange={(e) =>
                  onChange({
                    ...block,
                    variant: e.target.value as "wide" | "portrait",
                  })
                }
                className={`${KLASY_KONTROLKI} bg-white sm:max-w-xs`}
                title="Układ zdjęcia na stronie"
              >
                <option value="wide">Szerokie</option>
                <option value="portrait">Pionowe (węższe)</option>
              </select>
            </Pole>
            <PoleTekst
              etykieta="Podpis pod zdjęciem"
              opis="Drobny druk pod zdjęciem. Puste pole = zdjęcie bez podpisu."
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value })}
              placeholder="Podpis pod zdjęciem (opcjonalnie)"
            />
          </div>
        </div>
      );
    case "gallery":
      return (
        <Pole
          etykieta="Zdjęcia w galerii"
          opis="Na stronie układają się w siatkę, w tej samej kolejności co tutaj. Krzyżyk na miniaturce wyjmuje zdjęcie z galerii."
        >
          {block.publicIds.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-3">
              {block.publicIds.map((pid) => (
                <div key={pid} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clThumb(pid, 200)}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-slate-200"
                  />
                  <button
                    onClick={() =>
                      onChange({
                        ...block,
                        publicIds: block.publicIds.filter((p) => p !== pid),
                      })
                    }
                    type="button"
                    className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Usuń z galerii"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => openPicker(true)}
            type="button"
            className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium px-4 py-2.5 transition-colors"
          >
            + Dodaj zdjęcia
          </button>
        </Pole>
      );
    case "table":
      return <TableEditor block={block} onChange={onChange} />;
    case "links":
      return <LinksEditor block={block} onChange={onChange} />;
    case "video":
      return (
        <div className="space-y-5">
          <PoleTekst
            etykieta="Adres filmu na YouTube"
            opis="Wklej zwykły adres z paska przeglądarki. Na stronie stanie w tym miejscu odtwarzacz."
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=..."
            className="font-mono"
          />
          <Pole
            etykieta="Proporcje obrazu"
            htmlFor={idProporcjiFilmu}
            opis="16:9 pasuje do wszystkiego, co nagrane telefonem czy kamerą. 4:3 wybierz do starych nagrań, żeby nie miały czarnych pasów po bokach."
          >
            <select
              id={idProporcjiFilmu}
              aria-describedby={`${idProporcjiFilmu}-opis`}
              value={block.aspect ?? "16:9"}
              onChange={(e) => onChange({ ...block, aspect: e.target.value as "16:9" | "4:3" })}
              className={`${KLASY_KONTROLKI} bg-white sm:max-w-xs`}
              title="Proporcje playera"
            >
              <option value="16:9">16:9 (standard YouTube)</option>
              <option value="4:3">4:3 (stare nagrania)</option>
            </select>
          </Pole>
          <PoleTekst
            etykieta="Podpis pod filmem"
            opis="Drobny druk pod odtwarzaczem. Puste pole = film bez podpisu."
            value={block.caption ?? ""}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Podpis pod filmem (opcjonalnie)"
          />
        </div>
      );
    case "kontakt":
    case "bank":
      // Bloki celowo nie mają pól - dane mają jedno miejsce edycji.
      return (
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3.5">
          <p className="text-base text-slate-700">
            Ten element pokazuje dane wpisane w zakładce{" "}
            <Link
              href="/admin/dane-organizacji"
              className="text-indigo-600 underline underline-offset-2 hover:text-indigo-800"
            >
              Dane organizacji
            </Link>
            . Zmiana tam poprawia je od razu wszędzie na stronie.
          </p>
          <p className="mt-1.5 text-sm leading-snug text-slate-500">
            Nie da się ich zmienić tutaj celowo - inaczej te same dane byłyby
            w dwóch miejscach i rozjechałyby się przy pierwszej zmianie.
          </p>
        </div>
      );
    case "download":
      return (
        <div className="flex flex-col sm:flex-row gap-5">
          {block.imageId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clThumb(block.imageId, 200)}
              alt=""
              className="w-full sm:w-28 h-28 object-cover rounded-lg border border-slate-200"
            />
          ) : (
            <div className="w-full sm:w-28 h-28 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs text-center px-2">
              Miniaturka (opcjonalna)
            </div>
          )}
          <div className="flex-1 space-y-5">
            <PoleTekst
              etykieta="Nazwa dokumentu"
              opis="Ten napis widzi odwiedzający na przycisku pobierania."
              value={block.label}
              onChange={(e) => onChange({ ...block, label: e.target.value })}
              placeholder="Nazwa pliku, np. Deklaracja członkowska"
              className="font-medium"
            />
            <Pole
              etykieta="Adres pliku"
              htmlFor={idAdresuPliku}
              opis="Najprościej: „Wybierz plik” i wskaż go z listy wgranych. Adres z internetu też zadziała."
            >
              <div className="flex flex-wrap gap-2">
                <input
                  id={idAdresuPliku}
                  aria-describedby={`${idAdresuPliku}-opis`}
                  value={block.url}
                  onChange={(e) => onChange({ ...block, url: e.target.value })}
                  placeholder="/downloads/plik.pdf albo https://..."
                  // `flex-1` ustawia bazę 0, więc `w-full` z klas kontrolki nie
                  // rozpycha rzędu — przycisk „Wybierz plik" zostaje obok.
                  className={`${KLASY_KONTROLKI} flex-1 min-w-[12rem] font-mono`}
                />
                <button
                  onClick={() => setWyborPliku(true)}
                  type="button"
                  className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
                  title="Wybierz plik z listy zamiast wpisywać adres"
                >
                  Wybierz plik
                </button>
              </div>
            </Pole>
            <FilePicker
              open={wyborPliku}
              onClose={() => setWyborPliku(false)}
              onSelect={(adres, nazwa) =>
                onChange({ ...block, url: adres, label: block.label || nazwa })
              }
            />
            <PoleTekst
              etykieta="Dopisek przy przycisku"
              opis="Drobny druk obok nazwy – zwykle format i waga pliku."
              value={block.note ?? ""}
              onChange={(e) => onChange({ ...block, note: e.target.value })}
              placeholder="Dopisek (np. PDF, 2 MB)"
            />
            <Pole
              etykieta="Miniaturka"
              opis="Mała okładka obok przycisku, np. pierwsza strona dokumentu. Bez niej zostaje sam przycisk."
            >
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => openPicker(false)}
                  type="button"
                  className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-base font-medium px-4 py-2.5 transition-colors"
                >
                  {block.imageId ? "Zmień miniaturkę" : "Wybierz miniaturkę"}
                </button>
                {block.imageId && (
                  <button
                    onClick={() => onChange({ ...block, imageId: null })}
                    type="button"
                    className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-base text-slate-500 hover:text-red-600 transition-colors"
                  >
                    Usuń miniaturkę
                  </button>
                )}
              </div>
            </Pole>
          </div>
        </div>
      );
    case "person":
      return <PersonEditor block={block} onChange={onChange} openPicker={openPicker} />;
    default:
      return null;
  }
}

/* ------------------------ Karta osoby ------------------------ */

function PersonEditor({
  block,
  onChange,
  openPicker,
}: {
  block: Extract<NewsBlock, { type: "person" }>;
  onChange: (b: NewsBlock) => void;
  openPicker: (multi: boolean) => void;
}) {
  // Guard na dane spoza panelu (ręczny zapis do bazy może pominąć facts) -
  // bez niego edytor wywalałby się przy otwarciu takiego bloku.
  const blockFacts = block.facts ?? [];

  function setFact(i: number, patch: Partial<(typeof blockFacts)[number]>) {
    const facts = blockFacts.map((f, idx) => (idx === i ? { ...f, ...patch } : f));
    onChange({ ...block, facts });
  }

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      <div className="sm:w-44">
        <Pole etykieta="Zdjęcie osoby" opis="Portret na karcie osoby.">
          <div className="space-y-2">
            {block.imageId ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={clThumb(block.imageId, 300)}
                alt=""
                className="w-full h-44 object-cover rounded-lg border border-slate-200"
              />
            ) : (
              <div className="w-full h-44 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-sm text-center px-2">
                Zdjęcie osoby
              </div>
            )}
            <button
              onClick={() => openPicker(false)}
              type="button"
              className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-3 py-2.5 transition-colors"
            >
              {block.imageId ? "Zmień zdjęcie" : "Wybierz zdjęcie"}
            </button>
          </div>
        </Pole>
      </div>

      <div className="flex-1 space-y-5">
        <PoleTekst
          etykieta="Imię i nazwisko"
          opis="Największy napis na karcie."
          value={block.name}
          onChange={(e) => onChange({ ...block, name: e.target.value })}
          placeholder="Imię i nazwisko"
          className="font-semibold"
        />
        <PoleTekst
          etykieta="Rola w klubie"
          opis="Wiersz zaraz pod nazwiskiem – funkcja albo stopień."
          value={block.role ?? ""}
          onChange={(e) => onChange({ ...block, role: e.target.value })}
          placeholder="Rola (np. Shibucho – mistrz kierujący filią)"
        />
        <PoleTekst
          etykieta="Dopisek pod nazwiskiem"
          opis="Drobniejszy wiersz na uprawnienia i tytuły. Można zostawić pusty."
          value={block.subtitle ?? ""}
          onChange={(e) => onChange({ ...block, subtitle: e.target.value })}
          placeholder="Dopisek pod nazwiskiem (np. Egzaminator oraz Sędzia 2 kategorii)"
          className="italic"
        />

        <Pole
          etykieta="Fakty o osobie"
          opis="Każdy wiersz to jedna linia na karcie: nazwa po lewej, wartość po prawej."
        >
          <PasekKolumn uklad={UKLAD_WIERSZA_FAKTU} nazwy={["Nazwa", "Wartość", ""]} />
          <div className="space-y-3">
            {blockFacts.map((f, i) => (
              <div key={i} className={klasyWiersza(UKLAD_WIERSZA_FAKTU)}>
                <input
                  value={f.label}
                  onChange={(e) => setFact(i, { label: e.target.value })}
                  placeholder="np. Bukai (stopień techniczny)"
                  aria-label={`Nazwa faktu ${i + 1}`}
                  className={KLASY_KONTROLKI}
                />
                <input
                  value={f.value}
                  onChange={(e) => setFact(i, { value: e.target.value })}
                  placeholder="np. 6 Dan"
                  aria-label={`Wartość faktu ${i + 1}`}
                  className={`${KLASY_KONTROLKI} font-medium`}
                />
                <button
                  type="button"
                  onClick={() => onChange({ ...block, facts: blockFacts.filter((_, idx) => idx !== i) })}
                  className="justify-self-end sm:justify-self-center text-slate-400 hover:text-red-600 transition-colors"
                  title="Usuń fakt"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => onChange({ ...block, facts: [...blockFacts, { label: "", value: "" }] })}
            className={`${blockFacts.length > 0 ? "mt-3" : ""} rounded-lg border border-dashed border-slate-300 px-3.5 py-2 text-base text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors`}
          >
            + Dodaj fakt
          </button>
        </Pole>

        <PoleWieloliniowe
          etykieta="Notka na dole karty"
          opis="Zdanie na koniec, np. gdzie prowadzi zajęcia albo jak się zapisać."
          value={block.note ?? ""}
          onChange={(e) => onChange({ ...block, note: e.target.value })}
          rows={2}
          placeholder="Notka na dole karty (np. lokalizacja, informacja o zapisach)"
        />
      </div>
    </div>
  );
}

/* ------------------------ Tabela opłat ------------------------ */

function TableEditor({
  block,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "table" }>;
  onChange: (b: NewsBlock) => void;
}) {
  const headers = block.headers ?? ["Rodzaj opłaty", "Kwota"];

  function setRow(i: number, patch: Partial<(typeof block.rows)[number]>) {
    const rows = block.rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    onChange({ ...block, rows });
  }

  return (
    <div className="space-y-5">
      <Pole
        etykieta="Nagłówki kolumn"
        opis="Pierwszy, wyróżniony wiersz tabeli na stronie."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
          <input
            value={headers[0]}
            onChange={(e) =>
              onChange({ ...block, headers: [e.target.value, headers[1]] })
            }
            aria-label="Nagłówek lewej kolumny"
            className={`${KLASY_KONTROLKI} font-semibold`}
            placeholder="Nagłówek kolumny"
          />
          <input
            value={headers[1]}
            onChange={(e) =>
              onChange({ ...block, headers: [headers[0], e.target.value] })
            }
            aria-label="Nagłówek prawej kolumny"
            className={`${KLASY_KONTROLKI} text-right font-semibold`}
            placeholder="Nagłówek"
          />
        </div>
      </Pole>

      <Pole
        etykieta="Wiersze tabeli"
        opis="Jeden wiersz = jedna linia w tabeli. Dopisek stoi drobnym drukiem przy pozycji, kwota trzyma się prawej krawędzi."
      >
        <PasekKolumn
          uklad={UKLAD_WIERSZA_TABELI}
          nazwy={["Pozycja", "Dopisek", "Kwota", ""]}
        />
        <div className="space-y-3">
          {block.rows.map((row, i) => (
            <div key={i} className={klasyWiersza(UKLAD_WIERSZA_TABELI)}>
              <input
                value={row.label}
                onChange={(e) => setRow(i, { label: e.target.value })}
                placeholder="Pozycja (np. 5 Kyu)"
                aria-label={`Pozycja w wierszu ${i + 1}`}
                className={KLASY_KONTROLKI}
              />
              <input
                value={row.note ?? ""}
                onChange={(e) => setRow(i, { note: e.target.value })}
                placeholder="dopisek (opcjonalnie)"
                aria-label={`Dopisek w wierszu ${i + 1}`}
                className={`${KLASY_KONTROLKI} italic`}
              />
              <input
                value={row.price}
                onChange={(e) => setRow(i, { price: e.target.value })}
                placeholder="np. 80 zł"
                aria-label={`Kwota w wierszu ${i + 1}`}
                className={`${KLASY_KONTROLKI} text-right font-medium`}
              />
              <button
                type="button"
                onClick={() =>
                  onChange({ ...block, rows: block.rows.filter((_, idx) => idx !== i) })
                }
                className="justify-self-end sm:justify-self-center text-slate-400 hover:text-red-600 transition-colors"
                title="Usuń wiersz"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({ ...block, rows: [...block.rows, { label: "", price: "" }] })
          }
          className={`${block.rows.length > 0 ? "mt-3" : ""} rounded-lg border border-dashed border-slate-300 px-3.5 py-2 text-base text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors`}
        >
          + Dodaj wiersz
        </button>
      </Pole>
    </div>
  );
}

/* ------------------------ Linki / nagrania ------------------------ */

function LinksEditor({
  block,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "links" }>;
  onChange: (b: NewsBlock) => void;
}) {
  function setItem(i: number, patch: Partial<(typeof block.items)[number]>) {
    const items = block.items.map((r, idx) =>
      idx === i ? { ...r, ...patch } : r
    );
    onChange({ ...block, items });
  }

  return (
    <Pole
      etykieta="Odnośniki"
      opis="Na stronie staną jeden pod drugim. Widać nazwę – adres otwiera się po kliknięciu."
    >
      <PasekKolumn uklad={UKLAD_WIERSZA_LINKU} nazwy={["Nazwa", "Adres", ""]} />
      <div className="space-y-3">
        {block.items.map((item, i) => (
          <div key={i} className={klasyWiersza(UKLAD_WIERSZA_LINKU)}>
            <input
              value={item.label}
              onChange={(e) => setItem(i, { label: e.target.value })}
              placeholder="Nazwa (np. Mae Ukemi 1)"
              aria-label={`Nazwa odnośnika ${i + 1}`}
              className={KLASY_KONTROLKI}
            />
            <input
              value={item.url}
              onChange={(e) => setItem(i, { url: e.target.value })}
              placeholder="https://www.youtube.com/watch?v=..."
              aria-label={`Adres odnośnika ${i + 1}`}
              className={`${KLASY_KONTROLKI} font-mono`}
            />
            <button
              type="button"
              onClick={() =>
                onChange({
                  ...block,
                  items: block.items.filter((_, idx) => idx !== i),
                })
              }
              className="text-slate-400 hover:text-red-600 transition-colors justify-self-end sm:justify-self-center"
              title="Usuń link"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() =>
          onChange({ ...block, items: [...block.items, { label: "", url: "" }] })
        }
        className={`${block.items.length > 0 ? "mt-3" : ""} rounded-lg border border-dashed border-slate-300 px-3.5 py-2 text-base text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors`}
      >
        + Dodaj link
      </button>
    </Pole>
  );
}

/* ---------------- Pole tekstowe z formatowaniem ---------------- */

/**
 * Nazwa i opis pola dla trzech bloków tekstowych. Dotąd stał tu sam
 * placeholder „Wpisz treść..." — znikał po pierwszej literze i redaktor
 * patrzył na trzy nierozróżnialne prostokąty.
 */
const OPISY_TEKSTU: Record<
  "paragraph" | "callout" | "quote",
  { etykieta: string; opis: string }
> = {
  paragraph: {
    etykieta: "Tekst akapitu",
    opis: "Zwykły akapit treści. Pogrubienie i linki wstawiasz przyciskami nad polem.",
  },
  callout: {
    etykieta: "Treść wyróżnionej ramki",
    opis: "Na stronie stoi na kolorowym tle – na jedną rzecz, której nie można przeoczyć.",
  },
  quote: {
    etykieta: "Treść cytatu",
    opis: "Na stronie wygląda jak wypowiedź: wcięta, z kreską z boku.",
  },
};

function TextAreaWithFormat({
  block,
  mode,
  onChange,
}: {
  block: Extract<NewsBlock, { type: "paragraph" | "callout" | "quote" }>;
  mode: EditorMode;
  onChange: (b: NewsBlock) => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const idPola = useId();
  const { etykieta, opis } = OPISY_TEKSTU[block.type];

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const selected = s === e ? "tekst" : v.slice(s, e);
    const next = v.slice(0, s) + before + selected + after + v.slice(e);
    onChange({ ...block, text: next });
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  }

  function makeLink() {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e, value: v } = el;
    const selected = s === e ? "tekst linku" : v.slice(s, e);
    const snippet = `[${selected}](/adres)`;
    const next = v.slice(0, s) + snippet + v.slice(e);
    onChange({ ...block, text: next });
    requestAnimationFrame(() => {
      el.focus();
      const addrStart = s + selected.length + 3;
      el.setSelectionRange(addrStart, addrStart + 6);
    });
  }

  return (
    // Pasek formatowania stoi MIĘDZY nazwą pola a samym polem: dotyczy tego,
    // co się w polu zaznaczy, więc przy polu, a nie nad nazwą sekcji.
    <Pole etykieta={etykieta} opis={opis} htmlFor={idPola}>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <button
          onClick={() => wrap("**")}
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-bold hover:bg-slate-100 transition-colors"
          title="Pogrub zaznaczony tekst"
        >
          B
        </button>
        <button
          onClick={() => wrap("*")}
          type="button"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm italic font-semibold hover:bg-slate-100 transition-colors"
          title="Kursywa (zaznaczony tekst)"
        >
          I
        </button>
        {mode !== "article" && (
          <button
            onClick={() => wrap("==")}
            type="button"
            className="rounded-md border border-yellow-400 bg-yellow-50 px-3 py-1.5 text-sm font-bold text-yellow-700 hover:bg-yellow-100 transition-colors"
            title="Żółte wyróżnienie (kolor strony)"
          >
            Żółty
          </button>
        )}
        <button
          onClick={makeLink}
          type="button"
          className="rounded-md border border-indigo-300 bg-indigo-50 px-3 py-1.5 text-sm font-bold text-indigo-700 hover:bg-indigo-100 transition-colors"
          title="Zamień zaznaczenie w link"
        >
          Link
        </button>
        <span className="text-sm text-slate-500 self-center ml-1">
          zaznacz tekst i kliknij
        </span>
      </div>
      <textarea
        ref={ref}
        id={idPola}
        aria-describedby={`${idPola}-opis`}
        value={block.text}
        onChange={(e) => onChange({ ...block, text: e.target.value })}
        rows={Math.max(3, Math.ceil(block.text.length / 90))}
        placeholder="Wpisz treść..."
        className={`${KLASY_KONTROLKI} leading-relaxed`}
      />
    </Pole>
  );
}
