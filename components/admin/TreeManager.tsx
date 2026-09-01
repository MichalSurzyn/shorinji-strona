"use client";

import { useState } from "react";
import Link from "next/link";
import {
  dodajWezel,
  doKosza,
  policzPotomkow,
  pobierzDrzewo,
  pobierzKosz,
  przesun,
  przywroc,
  usunTrwale,
  zapiszWezel,
  type Kierunek,
  type RodzajWezla,
  type WezelPanelu,
} from "@/actions/pagesActions";

/**
 * Drzewo stron i menu — jeden ekran zamiast dwóch.
 *
 * Do tej pory pozycja w menu (`nav_items`) i strona (`custom_pages`) były
 * osobnymi bytami w osobnych zakładkach, więc dało się mieć jedno bez drugiego:
 * pozycję menu prowadzącą donikąd albo stronę, do której nie ma jak dojść.
 * Tutaj to jeden wiersz, a kolumna „rodzaj" mówi wprost, czym pozycja jest.
 *
 * Świadomie BEZ przeciągania myszą w pierwszej wersji. Przyciski ↑ ↓ → ←
 * robią to samo, działają z klawiatury i na telefonie, i — co ważniejsze —
 * każdy z nich to jedno punktowe `UPDATE`, które łatwo cofnąć. Przeciąganie
 * kusi do zapisu całego drzewa naraz, a to jest dokładnie ten wzorzec, przez
 * który stary edytor menu trzymał przez chwilę dwa komplety wierszy.
 */

const OPIS_RODZAJU: Record<RodzajWezla, string> = {
  page: "strona",
  link: "odnośnik",
  header: "nagłówek",
};

export default function TreeManager({
  drzewo,
  kosz,
}: {
  drzewo: WezelPanelu[];
  kosz: WezelPanelu[];
}) {
  const [wezly, setWezly] = useState(drzewo);
  const [wKoszu, setWKoszu] = useState(kosz);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [rodzicNowego, setRodzicNowego] = useState<string | null>(null);
  const [rodzaj, setRodzaj] = useState<RodzajWezla>("page");
  const [nazwa, setNazwa] = useState("");
  const [slug, setSlug] = useState("");
  const [adresZewnetrzny, setAdresZewnetrzny] = useState("");

  async function odswiez() {
    const [d, k] = await Promise.all([pobierzDrzewo(), pobierzKosz()]);
    setWezly(d);
    setWKoszu(k);
  }

  async function wykonaj(akcja: () => Promise<{ ok: boolean; error?: string }>, sukces: string) {
    setBusy(true);
    setMsg(null);
    try {
      const res = await akcja();
      if (res.ok) {
        setMsg({ ok: true, text: sukces });
        await odswiez();
      } else {
        setMsg({ ok: false, text: res.error ?? "Nie udało się." });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Nie udało się." });
    } finally {
      setBusy(false);
    }
  }

  /** Dzieci danego węzła w kolejności — drzewo składamy w pamięci, jednym przebiegiem. */
  const dzieci = (id: string | null) =>
    wezly.filter((w) => w.parent_id === id).sort((a, b) => a.position - b.position);

  /**
   * Adres, jaki dostanie nowa strona — pokazywany NA ŻYWO pod polem.
   * Redaktor musi widzieć skutek, zanim kliknie „Dodaj": po zapisie zmiana
   * adresu to już zmiana czegoś, co widziała wyszukiwarka.
   */
  function podgladAdresu(): string {
    if (rodzaj === "header") return "(nagłówek nie ma adresu)";
    if (rodzaj === "link") return adresZewnetrzny || "(wklej adres zewnętrzny)";
    const rodzic = wezly.find((w) => w.id === rodzicNowego);
    const baza = rodzic?.full_path && rodzic.full_path !== "/" ? rodzic.full_path : "";
    return `${baza}/${slug || "…"}`;
  }

  async function handleDodaj(e: React.FormEvent) {
    e.preventDefault();
    await wykonaj(
      () =>
        dodajWezel({
          parentId: rodzicNowego,
          kind: rodzaj,
          title: nazwa,
          slug,
          externalUrl: adresZewnetrzny,
          // Nowa STRONA startuje ukryta i poza menu. Nie z ostrożności — to jest
          // ten sam defekt, przez który szkic z zaznaczonym „pokaż w menu"
          // prowadził do 404: pusta strona pojawiała się w menu w tej samej
          // sekundzie, w której powstała.
          //
          // I nie „ukryta, ale w menu": tej kombinacji akcja zapisu odrzuca
          // (odnośnik prowadziłby donikąd), więc formularz nie ma prawa jej
          // wysyłać. Nagłówek i odnośnik nie mają czego publikować — wchodzą
          // od razu widoczne.
          inMenu: rodzaj !== "page",
          published: rodzaj !== "page",
          menuLabel: undefined,
        }).then((r) => (r.ok ? { ok: true } : r)),
      rodzaj === "page"
        ? "Dodane. Strona jest na razie ukryta i poza menu — opublikuj ją, gdy będzie gotowa."
        : "Dodane.",
    );
    setNazwa("");
    setSlug("");
    setAdresZewnetrzny("");
  }

  async function handleUsun(w: WezelPanelu) {
    const potomkowie = await policzPotomkow(w.id);
    const lista = potomkowie.length
      ? "\n\nRAZEM Z NIĄ do kosza trafią:\n" +
        potomkowie.map((p) => `  • ${p.title}${p.full_path ? ` (${p.full_path})` : ""}`).join("\n")
      : "";
    if (!confirm(`Przenieść „${w.title}" do kosza?${lista}\n\nZ kosza da się to przywrócić.`)) return;
    await wykonaj(() => doKosza(w.id), `„${w.title}" jest w koszu.`);
  }

  function Wiersz({ w, poziom }: { w: WezelPanelu; poziom: number }) {
    const potomstwo = dzieci(w.id);
    const zRoutu = w.source === "route";
    return (
      <>
        <div
          // Znaczniki `data-*` sa tu po to, zeby test odbioru mogl wskazac
          // KONKRETNY wiersz, a nie zgadywac po tresci. Dopasowanie po tekscie
          // trafialo w zagniezdzony <div> z adresem, ktory nie ma przyciskow -
          // i wygladalo to jak "przycisku nie ma", a nie jak "zly selektor".
          data-wezel={w.id}
          data-adres={w.full_path ?? ""}
          className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 last:border-0"
          style={{ paddingLeft: `${1 + poziom * 1.75}rem` }}
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-900 truncate">{w.menu_label ?? w.title}</span>
              <span className="text-[11px] uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
                {OPIS_RODZAJU[w.kind]}
              </span>
              {!w.published && (
                <span className="text-[11px] bg-amber-100 text-amber-800 rounded-full px-2 py-0.5">
                  ukryta
                </span>
              )}
              {!w.in_menu && (
                <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">
                  poza menu
                </span>
              )}
              {zRoutu && (
                <span
                  className="text-[11px] bg-indigo-50 text-indigo-700 rounded-full px-2 py-0.5"
                  title="Układ tej strony jest częścią serwisu — z panelu zmienisz nazwę i widoczność, ale nie adres."
                >
                  stała część serwisu
                </span>
              )}
            </div>
            <div className="text-sm text-slate-400 truncate">
              {w.kind === "link" ? w.external_url : (w.full_path ?? "— bez adresu —")}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              disabled={busy}
              onClick={() => wykonaj(() => przesun(w.id, "gora" as Kierunek), "Przesunięte wyżej.")}
              title="Wyżej"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              ↑
            </button>
            <button
              disabled={busy}
              onClick={() => wykonaj(() => przesun(w.id, "dol" as Kierunek), "Przesunięte niżej.")}
              title="Niżej"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              ↓
            </button>
            <button
              disabled={busy}
              onClick={() => wykonaj(() => przesun(w.id, "wsun" as Kierunek), "Wsunięte pod pozycję wyżej.")}
              title="Wsuń pod pozycję powyżej"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              →
            </button>
            <button
              disabled={busy}
              onClick={() => wykonaj(() => przesun(w.id, "wysun" as Kierunek), "Wysunięte na wyższy poziom.")}
              title="Wysuń na wyższy poziom"
              className="rounded-lg border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              ←
            </button>
            <button
              disabled={busy}
              onClick={() =>
                wykonaj(
                  () => zapiszWezel(w.id, { published: !w.published, inMenu: w.published ? false : w.in_menu }),
                  w.published ? "Ukryte." : "Opublikowane.",
                )
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              {w.published ? "Ukryj" : "Opublikuj"}
            </button>
            <button
              disabled={busy}
              onClick={() =>
                wykonaj(() => zapiszWezel(w.id, { inMenu: !w.in_menu }), w.in_menu ? "Zdjęte z menu." : "Dodane do menu.")
              }
              className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-40"
            >
              {w.in_menu ? "Zdejmij z menu" : "Pokaż w menu"}
            </button>
            {!zRoutu && (
              <button
                disabled={busy}
                onClick={() => handleUsun(w)}
                className="rounded-lg border border-red-300 text-red-600 px-3 py-1 text-sm hover:bg-red-50 disabled:opacity-40"
              >
                Usuń
              </button>
            )}
          </div>
        </div>
        {potomstwo.map((d) => (
          <Wiersz key={d.id} w={d} poziom={poziom + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Strony i menu</h1>
        <p className="text-slate-500 mt-1 max-w-3xl">
          Jedno drzewo: to, co widać w menu na górze, i to, jakie strony istnieją. Pozycja
          może być stroną, samym nagłówkiem grupującym albo odnośnikiem na zewnątrz.
          Trzeci poziom nie mieści się w rozwijanym menu — pokazuje się jako kafelek na
          stronie nadrzędnej.
        </p>
      </div>

      {msg && (
        <p
          className={`text-sm rounded-lg px-3.5 py-2.5 border ${
            msg.ok
              ? "text-emerald-800 bg-emerald-50 border-emerald-200"
              : "text-rose-800 bg-rose-50 border-rose-200"
          }`}
        >
          {msg.text}
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        {dzieci(null).map((w) => (
          <Wiersz key={w.id} w={w} poziom={0} />
        ))}
      </div>

      <form onSubmit={handleDodaj} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
        <h2 className="font-bold">Dodaj pozycję</h2>

        <div className="grid md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Rodzaj</span>
            <select
              value={rodzaj}
              onChange={(e) => setRodzaj(e.target.value as RodzajWezla)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="page">Strona — ma własny adres i treść</option>
              <option value="header">Nagłówek — tylko grupuje w menu, nie ma strony</option>
              <option value="link">Odnośnik — prowadzi poza serwis</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="block text-slate-500 mb-1">Miejsce w drzewie</span>
            <select
              value={rodzicNowego ?? ""}
              onChange={(e) => setRodzicNowego(e.target.value || null)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— najwyższy poziom —</option>
              {wezly
                .filter((w) => w.kind !== "link" && w.depth < 2)
                .map((w) => (
                  <option key={w.id} value={w.id}>
                    {"— ".repeat(w.depth)}
                    {w.menu_label ?? w.title}
                  </option>
                ))}
            </select>
          </label>
        </div>

        <label className="text-sm block">
          <span className="block text-slate-500 mb-1">Nazwa</span>
          <input
            required
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="np. Uczniowskie"
          />
        </label>

        {rodzaj === "page" && (
          <label className="text-sm block">
            <span className="block text-slate-500 mb-1">Adres (fragment po ukośniku)</span>
            <input
              required
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="np. uczniowskie"
            />
          </label>
        )}

        {rodzaj === "link" && (
          <label className="text-sm block">
            <span className="block text-slate-500 mb-1">Adres zewnętrzny</span>
            <input
              required
              value={adresZewnetrzny}
              onChange={(e) => setAdresZewnetrzny(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="https://…"
            />
          </label>
        )}

        <p className="text-sm text-slate-500">
          Adres tej pozycji: <strong className="text-slate-700">{podgladAdresu()}</strong>
        </p>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Dodaj
        </button>
      </form>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h2 className="font-bold mb-1">Kosz</h2>
        <p className="text-sm text-slate-500 mb-4">
          Usunięte strony leżą tu, dopóki ich stąd nie wyrzucisz. Przywrócenie zadziała
          tylko wtedy, gdy w międzyczasie nikt nie zajął ich adresu.
        </p>
        {wKoszu.length === 0 && <p className="text-sm text-slate-400">Kosz jest pusty.</p>}
        {wKoszu.map((w) => (
          <div key={w.id} className="flex items-center justify-between gap-3 py-2 border-t border-slate-100">
            <div className="min-w-0">
              <div className="font-medium text-slate-800 truncate">{w.title}</div>
              <div className="text-sm text-slate-400 truncate">{w.full_path ?? "— bez adresu —"}</div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                disabled={busy}
                onClick={() => wykonaj(() => przywroc(w.id), `Przywrócone: „${w.title}".`)}
                className="rounded-lg border border-emerald-300 text-emerald-700 px-3 py-1 text-sm hover:bg-emerald-50 disabled:opacity-40"
              >
                Przywróć
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  if (!confirm(`Usunąć „${w.title}" NA ZAWSZE? Tego nie da się cofnąć.`)) return;
                  wykonaj(() => usunTrwale(w.id), `Usunięte na zawsze: „${w.title}".`);
                }}
                className="rounded-lg border border-red-300 text-red-600 px-3 py-1 text-sm hover:bg-red-50 disabled:opacity-40"
              >
                Usuń na zawsze
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="text-sm text-slate-400">
        Stare zakładki <Link href="/admin/nawigacja" className="underline">Menu na górze strony</Link> i{" "}
        <Link href="/admin/strony" className="underline">Strony</Link> działają jeszcze obok tej —
        znikną, gdy ta zostanie sprawdzona w boju.
      </p>
    </div>
  );
}
