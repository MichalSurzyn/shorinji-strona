"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BlockEditor from "@/components/admin/BlockEditor";
import { zapiszWezel, type WezelPanelu } from "@/actions/pagesActions";
import type { NewsBlock } from "@/lib/newsTypes";

/**
 * Edytor jednej pozycji drzewa.
 *
 * Treść edytuje `BlockEditor` — ten sam komponent co przy aktualnościach.
 * Świadomie NIE `PageBlocksEditor`: tamten jest kompletnym ekranem
 * przywiązanym do `site_settings` przez `savePageContent`, z własnym paskiem
 * zapisu. `BlockEditor` ma czysty kontrakt `value`/`onChange` i pasuje do
 * `pages.blocks` jeden do jednego.
 *
 * DWA RODZAJE POZYCJI, DWA ZESTAWY PÓL
 * ------------------------------------
 * `source='db'` — cała treść jest w tym wierszu, więc edytujemy wszystko.
 * `source='route'` — układ strony siedzi w pliku trasy (formularz kontaktowy,
 * mapa, grafik zajęć), a jej treść w `site_settings`. Adresu i bloków NIE
 * pokazujemy: pola, które nie robią tego, co obiecują, są gorsze od ich braku.
 * Zostaje nazwa, wstęp i etykieta w menu — to działa i dla takich węzłów.
 */
export default function TreeNodeEditor({ wezel }: { wezel: WezelPanelu }) {
  const router = useRouter();
  const zBazy = wezel.source === "db" && wezel.kind === "page";

  const [title, setTitle] = useState(wezel.title);
  const [slug, setSlug] = useState(wezel.slug ?? "");
  const [kicker, setKicker] = useState(wezel.kicker ?? "");
  const [intro, setIntro] = useState(wezel.intro ?? "");
  const [menuLabel, setMenuLabel] = useState(wezel.menu_label ?? "");
  const [blocks, setBlocks] = useState<NewsBlock[]>(wezel.blocks ?? []);

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const zmienionySlug = zBazy && slug.trim().toLowerCase() !== (wezel.slug ?? "");

  async function zapisz() {
    // Zmiana adresu to nie jest ta sama operacja co poprawka literówki
    // w tytule — dotyka wyszukiwarki i wszystkich podstron. Redaktor ma to
    // usłyszeć ZANIM kliknie, a nie zobaczyć w liście przekierowań potem.
    if (zmienionySlug) {
      const stary = wezel.full_path ?? "";
      if (
        !confirm(
          `Zmieniasz adres strony.\n\nStary: ${stary}\nNowy: …/${slug.trim().toLowerCase()}\n\n` +
            "Stary adres zacznie przekierowywać na nowy, więc linki nie umrą — ale " +
            "podstrony tej strony też zmienią adresy.\n\nZapisać?",
        )
      )
        return;
    }

    setBusy(true);
    setMsg(null);
    try {
      const res = await zapiszWezel(wezel.id, {
        title,
        kicker,
        intro,
        menuLabel,
        ...(zBazy ? { slug: slug.trim().toLowerCase(), blocks } : {}),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Zapisane." });
        router.refresh();
      } else {
        setMsg({ ok: false, text: res.error });
      }
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Nie udało się zapisać." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/drzewo" className="text-sm text-slate-500 hover:text-slate-800">
            ← Strony i menu
          </Link>
          <h1 className="text-2xl font-bold mt-1">{wezel.title}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {wezel.full_path ?? "— bez adresu —"}
            {!wezel.published && " · ukryta"}
            {!wezel.in_menu && " · poza menu"}
          </p>
        </div>
        <button
          onClick={zapisz}
          disabled={busy}
          className="shrink-0 rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
        >
          Zapisz
        </button>
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

      {!zBazy && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
          Układ tej strony jest częścią serwisu — ma na sobie rzeczy, których nie da się
          złożyć z bloków (formularz, mapa, grafik zajęć). Stąd zmienisz nazwę, wstęp
          i etykietę w menu; treść pod nagłówkiem edytujesz w zakładce{" "}
          <Link href="/admin/strony" className="underline">
            Strony
          </Link>
          .
        </p>
      )}

      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <h2 className="font-bold">Nagłówek strony</h2>

        <label className="block text-sm">
          <span className="block text-slate-500 mb-1">Nadkreślenie (mała żółta etykietka)</span>
          <input
            value={kicker}
            onChange={(e) => setKicker(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder="np. Zajęcia · Opłaty"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-slate-500 mb-1">Tytuł (duży nagłówek na stronie)</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-slate-500 mb-1">
            Wstęp — pokazuje się pod tytułem ORAZ na kafelku u strony nadrzędnej
          </span>
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm">
          <span className="block text-slate-500 mb-1">
            Etykieta w menu — zostaw puste, żeby użyć tytułu
          </span>
          <input
            value={menuLabel}
            onChange={(e) => setMenuLabel(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            placeholder={wezel.title}
          />
        </label>

        {zBazy && (
          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Adres (fragment po ukośniku)</span>
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            {zmienionySlug && (
              <span className="block mt-1 text-amber-700">
                Zmiana adresu: stary zacznie przekierowywać na nowy, a podstrony tej strony
                też zmienią adresy.
              </span>
            )}
          </label>
        )}
      </div>

      {zBazy && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-bold mb-1">Treść</h2>
          <p className="text-sm text-slate-500 mb-4">
            Elementy układasz w kolejności, w jakiej mają się pokazać. Jeśli ta strona ma
            podstrony, ich kafelki pojawią się pod treścią automatycznie.
          </p>
          <BlockEditor
            value={blocks}
            onChange={setBlocks}
            defaultFolder={`Strona${wezel.full_path ?? ""}`}
          />
        </div>
      )}

      <button
        onClick={zapisz}
        disabled={busy}
        className="rounded-lg bg-indigo-600 text-white px-4 py-2 text-sm font-medium hover:bg-indigo-700 disabled:opacity-40"
      >
        Zapisz
      </button>
    </div>
  );
}
