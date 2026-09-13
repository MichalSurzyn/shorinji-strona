"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import BlockEditor from "@/components/admin/BlockEditor";
import Komunikat, { useKomunikat } from "@/components/admin/Komunikat";
import PasekAkcji from "@/components/admin/PasekAkcji";
import { PoleTekst, PoleWieloliniowe } from "@/components/admin/Pole";
import { opiszBlad } from "@/lib/adminErrors";
import { czyZmieniono, useUnsavedChanges } from "@/lib/useUnsavedChanges";
import { zapiszWezel, type WezelPanelu } from "@/actions/pagesActions";
import { savePageContent } from "@/actions/pageActions";
import { folderSekcjiZdjec } from "@/lib/pages";
import type { NewsBlock, PageContent } from "@/lib/newsTypes";

/**
 * Edytor jednej pozycji drzewa.
 *
 * Treść edytuje `BlockEditor` — ten sam komponent co przy aktualnościach.
 * Świadomie NIE `PageBlocksEditor`: tamten jest kompletnym ekranem
 * przywiązanym do `site_settings` przez `savePageContent`, z własnym paskiem
 * zapisu. `BlockEditor` ma czysty kontrakt `value`/`onChange` i pasuje do
 * `pages.blocks` jeden do jednego.
 *
 * DWA RODZAJE POZYCJI, DWA MIEJSCA ZAPISU
 * ---------------------------------------
 * `source='db'` — cała treść jest w tym wierszu (`pages.blocks`), edytujemy
 * wszystko, razem z adresem.
 *
 * `source='route'` — układ strony siedzi w pliku trasy (formularz kontaktowy,
 * mapa, grafik zajęć), a treść w `site_settings` pod kluczem z kolumny
 * `content_key`. Ten ekran edytuje OBOJE: pozycję w drzewie i treść strony,
 * dwoma osobnymi zapisami. Adresu nie pokazujemy — pilnuje go plik trasy,
 * a pole, które nie robi tego, co obiecuje, jest gorsze od jego braku.
 *
 * Do etapu F treść tych ośmiu stron edytowała OSOBNA zakładka („Strony"),
 * bo `content_key` nie był czytany przez żaden plik w repo. Właściciel
 * zgłosił to dosłownie: „są 2 zakładki Strony i Strony i menu, bez sensu".
 */
export default function TreeNodeEditor({
  wezel,
  slugTresci = null,
  tresc = null,
}: {
  wezel: WezelPanelu;
  /** Slug treści w `site_settings` — tylko dla stron o stałym układzie. */
  slugTresci?: string | null;
  tresc?: PageContent | null;
}) {
  const router = useRouter();
  const zBazy = wezel.source === "db" && wezel.kind === "page";
  /**
   * Czy tej pozycji wolno edytować adres.
   *
   * Od wariantu A (decyzja D1) nagłówek TEŻ może mieć adres — ze slugiem
   * zachowuje się jak folder i wnosi swój segment do adresów podstron. Bez tego
   * pola nagłówek dostawał adres wyłącznie przy zamianie rodzaju i nie było go
   * jak zmienić ani zdjąć, czyli decyzja właściciela byłaby osiągalna tylko
   * z SQL Editora.
   */
  const adresEdytowalny = wezel.source === "db" && wezel.kind !== "link";
  /**
   * Czy ten węzeł ma treść po drugiej stronie pomostu `content_key`. Dla ośmiu
   * tras o stałym układzie tak — i to jest cała różnica między „edytuję nazwę
   * w drzewie" a „edytuję stronę". Nagłówki, odnośniki i trzy listingi
   * tematyczne (`/o-shorinji`, `/organizacja`, `/buddyzm`) klucza nie mają.
   */
  const maTresc = slugTresci !== null && tresc !== null;

  const [title, setTitle] = useState(wezel.title);
  const [slug, setSlug] = useState(wezel.slug ?? "");
  const [kicker, setKicker] = useState(wezel.kicker ?? "");
  const [intro, setIntro] = useState(wezel.intro ?? "");
  const [menuLabel, setMenuLabel] = useState(wezel.menu_label ?? "");
  const [blocks, setBlocks] = useState<NewsBlock[]>(wezel.blocks ?? []);

  // Treść strony o stałym układzie — osobny zestaw pól, bo trafia do innego
  // miejsca w bazie. `tTitle` to DUŻY NAGŁÓWEK NA STRONIE, a `title` wyżej to
  // nazwa w menu i w drzewie. Dwie różne rzeczy o mylnie podobnej nazwie,
  // dlatego etykiety pól niżej mówią wprost, która jest która.
  const [tKicker, setTKicker] = useState(tresc?.kicker ?? "");
  const [tTitle, setTTitle] = useState(tresc?.title ?? "");
  const [tLead, setTLead] = useState(tresc?.lead ?? "");
  const [tBlocks, setTBlocks] = useState<NewsBlock[]>(tresc?.blocks ?? []);

  const [busy, setBusy] = useState(false);
  const { msg, pokaz: pokazKomunikat, wyczysc: wyczyscKomunikat } = useKomunikat();

  const zmienionySlug = adresEdytowalny && slug.trim().toLowerCase() !== (wezel.slug ?? "");

  /**
   * Ostrzeżenie o niezapisanych zmianach — ten sam mechanizm co w edytorze
   * stron o stałym układzie. Bez tego ten ekran był jedynym w panelu, z którego
   * dało się wyjść i po cichu stracić przepisaną treść: panel nie ma autozapisu.
   *
   * Porównujemy DOKŁADNIE te pola, które lecą do `zapiszWezel` — nie cały
   * węzeł. Gdyby wchodziły tu pola, których zapis nie wysyła (pozycja,
   * widoczność zmieniana z listy), plakietka „Niezapisane zmiany" świeciłaby
   * po operacji zrobionej gdzie indziej.
   */
  const wysylane = useMemo(
    () => ({
      title,
      kicker,
      intro,
      menuLabel,
      ...(adresEdytowalny ? { slug: slug.trim().toLowerCase() } : {}),
      ...(zBazy ? { blocks } : {}),
    }),
    [title, kicker, intro, menuLabel, zBazy, adresEdytowalny, slug, blocks],
  );
  /** Treść strony o stałym układzie — drugi cel zapisu, więc drugi wzorzec. */
  const wysylanaTresc = useMemo(
    () => ({ kicker: tKicker, title: tTitle, lead: tLead, blocks: tBlocks }),
    [tKicker, tTitle, tLead, tBlocks],
  );
  const [zapisane, setZapisane] = useState(wysylane);
  const [zapisanaTresc, setZapisanaTresc] = useState(wysylanaTresc);
  const zmieniono =
    czyZmieniono(wysylane, zapisane) || (maTresc && czyZmieniono(wysylanaTresc, zapisanaTresc));
  useUnsavedChanges(zmieniono, wezel.title);

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
    wyczyscKomunikat();
    try {
      // Treść stron o stałym układzie idzie do `site_settings`, więc drugim
      // zapisem — i PIERWSZYM w kolejności. Gdyby szła po zapisie węzła,
      // a padła, redaktor zobaczyłby błąd nad już zmienioną nazwą w menu
      // i nie wiedziałby, co właściwie weszło.
      if (maTresc && slugTresci && czyZmieniono(wysylanaTresc, zapisanaTresc)) {
        const rt = await savePageContent(slugTresci, wysylanaTresc);
        if (!rt.ok) {
          pokazKomunikat(false, opiszBlad(rt.error));
          return;
        }
        setZapisanaTresc(wysylanaTresc);
      }

      const res = await zapiszWezel(wezel.id, wysylane);
      if (res.ok) {
        // Punkt odniesienia przesuwamy PRZED `router.refresh()`. Odwrotna
        // kolejność zapalałaby plakietkę „Niezapisane zmiany" zaraz po udanym
        // zapisie: odświeżenie wraca z nowymi propsami, a `zapisane` trzymałoby
        // jeszcze stan sprzed zapisu.
        setZapisane(wysylane);
        pokazKomunikat(true, "Zapisane.");
        router.refresh();
      } else {
        pokazKomunikat(false, opiszBlad(res.error));
      }
    } catch (e) {
      // Bez tego wyjątek (wygasła sesja, brak sieci) zostawiał przycisk
      // w stanie „Zapisywanie..." i redaktor nie wiedział, czy treść weszła.
      pokazKomunikat(false, opiszBlad(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Ten sam pasek co w edytorze stron o stałym układzie: przyklejony do
          góry, z plakietką niezapisanych zmian i podglądem. Wcześniej ten ekran
          miał własny nagłówek i DWA przyciski „Zapisz" (na górze i na dole),
          za to bez podglądu — stąd „czemu edycja się różni". */}
      <PasekAkcji
        powrotHref="/admin/drzewo"
        powrotEtykieta="← Strony i menu"
        tytul={wezel.title}
        opis={`${wezel.full_path ?? "— bez adresu —"}${!wezel.published ? " · ukryta" : ""}${
          !wezel.in_menu ? " · poza menu" : ""
        }`}
        zmieniono={zmieniono}
        busy={busy}
        // Podgląd TYLKO dla STRONY opublikowanej i mającej adres. Inaczej
        // przycisk prowadziłby na 404: publiczny odczyt filtruje `published`
        // ORAZ `kind='page'` — a od wariantu A nagłówek też ma `full_path`,
        // więc sam warunek „ma adres" przestał wystarczać.
        podglad={
          wezel.kind === "page" && wezel.published && wezel.full_path ? wezel.full_path : undefined
        }
        onZapisz={zapisz}
        etykietaZapisu="Zapisz"
      />

      <Komunikat msg={msg} onZamknij={wyczyscKomunikat} />

      {maTresc && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
          Ta strona ma <strong>stały układ</strong> — poniżej nagłówka stoją na niej rzeczy,
          których nie da się złożyć z elementów treści (formularz kontaktowy, mapa, grafik
          zajęć, kafelki). Ich kolejności stąd nie zmienisz, ale <strong>całą treść tej
          strony edytujesz tutaj</strong> — nie ma już potrzeby przechodzenia do osobnej
          zakładki. Adresu też nie zmienisz: pilnuje go kod serwisu.
        </p>
      )}

      {!zBazy && !maTresc && (
        <p className="text-sm text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5">
          {/* Trzy przypadki, nie dwa. Wcześniej były tu tylko „nagłówek" i reszta,
              więc STRONA-LISTING (własny adres, pod nagłówkiem kafelki podstron —
              np. /o-shorinji) dostawała komunikat „prowadzi poza serwis", czyli
              zdanie nieprawdziwe: nigdzie nie prowadzi, to jest ta właśnie strona.
              Zgłoszenie właściciela: „co znaczy że prowadzi poza serwis??? przecież
              nie prowadzi poza serwis". */}
          {wezel.kind === "header" ? (
            <>
              Ta pozycja <strong>tylko grupuje w menu</strong> — nie ma własnej strony.
              Stąd zmienisz nazwę i etykietę w menu.
            </>
          ) : wezel.kind === "link" ? (
            <>
              Ta pozycja <strong>prowadzi poza serwis</strong> — nie ma własnej treści.
              Stąd zmienisz nazwę i etykietę w menu.
            </>
          ) : (
            <>
              Ta strona <strong>pokazuje kafelki swoich podstron</strong> — własnej treści
              nie ma. Stąd zmienisz tytuł, wstęp i etykietę w menu; kafelki układają się
              same z podstron.
            </>
          )}
        </p>
      )}

      {/* Odstęp większy niż dawne `space-y-4`: etykieta jest teraz boldem
          i większa, a pod kontrolką stoi jeszcze opis. W ciasnym rytmie opis
          jednego pola siadał tuż pod etykietą następnego i pięć kratek czytało
          się jak jeden blok tekstu. */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
        <h2 className="font-bold">Nagłówek strony</h2>

        <PoleTekst
          etykieta="Nadkreślenie"
          opis="Mała żółta etykietka nad tytułem strony."
          value={kicker}
          onChange={(e) => setKicker(e.target.value)}
          placeholder="np. Zajęcia · Opłaty"
        />

        <PoleTekst
          etykieta="Tytuł"
          opis="Duży nagłówek na samej górze strony."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* Oba miejsca użycia zostają w opisie. Redaktor, który wie tylko
            o nagłówku, pisze tu zdanie pasujące pod tytuł i dziwi się potem
            urwanemu kafelkowi u strony nadrzędnej. */}
        <PoleWieloliniowe
          etykieta="Wstęp"
          opis="Pokazuje się pod tytułem tej strony ORAZ na jej kafelku u strony nadrzędnej."
          value={intro}
          onChange={(e) => setIntro(e.target.value)}
          rows={3}
        />

        <PoleTekst
          etykieta="Etykieta w menu"
          opis="Krótsza nazwa na pasek menu. Zostaw puste, żeby w menu użyć tytułu."
          value={menuLabel}
          onChange={(e) => setMenuLabel(e.target.value)}
          placeholder={wezel.title}
        />

        {adresEdytowalny && (
          // Pole i ostrzeżenie w jednym pudełku, żeby `space-y-5` kontenera nie
          // odrywało ostrzeżenia od kratki, której ono dotyczy.
          <div>
            <PoleTekst
              etykieta="Adres"
              // Nagłówek ma osobne zdanie, bo u niego adres robi co innego niż
              // u strony: jest wspólnym początkiem adresów podstron, a puste
              // pole jest poprawnym wyborem, nie brakiem do uzupełnienia.
              opis={
                wezel.kind === "header"
                  ? "Nieobowiązkowy fragment po ukośniku. Adres nagłówka staje się wspólnym początkiem adresów jego podstron. Puste pole znaczy, że nagłówek tylko grupuje w menu i do adresów nie wnosi nic."
                  : "Fragment adresu po ukośniku — końcówka adresu tej strony."
              }
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              placeholder={wezel.kind === "header" ? "puste = nagłówek tylko grupuje" : undefined}
            />
            {/* To nie jest opis pola, tylko ostrzeżenie o skutku TEJ zmiany —
                pojawia się i znika. Wepchnięte w `opis` czytałoby się jak stała
                właściwość adresu i przestałoby zwracać uwagę. */}
            {zmienionySlug && (
              <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Zmiana adresu: stary zacznie przekierowywać na nowy, a podstrony tej pozycji
                też zmienią adresy.
              </p>
            )}
          </div>
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
            // `mode="page"`, nie domyślne „news". Bez tego propa zestaw
            // elementów nie zawierał „Numer konta" ani „Dane kontaktowe"
            // (MODE_BLOCKS.news ich nie ma), więc strona z drzewa nie mogła
            // mieć sekcji, którą strona o stałym układzie miała — to była
            // druga połowa zgłoszenia „czemu edycja się różni".
            mode="page"
            defaultFolder={folderSekcjiZdjec(wezel.full_path) ?? undefined}
          />
        </div>
      )}

      {maTresc && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          <div>
            <h2 className="font-bold">Treść strony</h2>
            <p className="text-sm text-slate-500">
              To, co widać publicznie pod adresem{" "}
              {/* Adres w `rem`, nie w pikselach: panel ma własną skalę korzenia
                  (`html:has([data-panel-admina])`), więc twarde `13px` zostawało
                  w miejscu, podczas gdy otaczające `text-sm` rosło razem z nią —
                  mono-adres robił się mniejszy od zdania, w którym stoi. */}
              <span className="font-mono text-xs">{wezel.full_path}</span>. Pola wyżej
              dotyczyły nazwy w menu i w drzewie — to dwie różne rzeczy.
            </p>
          </div>

          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Nadkreślenie (mała żółta etykietka)</span>
            <input
              value={tKicker}
              onChange={(e) => setTKicker(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="np. Zajęcia · Opłaty"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">
              Tytuł NA STRONIE (duży nagłówek, nie nazwa w menu)
            </span>
            <input
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-base font-bold"
            />
          </label>

          <label className="block text-sm">
            <span className="block text-slate-500 mb-1">Wprowadzenie pod tytułem</span>
            <textarea
              value={tLead}
              onChange={(e) => setTLead(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div>
            <p className="text-sm text-slate-500 mb-3">
              Elementy treści. Formularz, mapa i grafik zajęć stoją na tej stronie
              <strong> pod</strong> nimi i na razie nie da się ich przestawić.
            </p>
            <BlockEditor
              value={tBlocks}
              onChange={setTBlocks}
              mode="page"
              defaultFolder={folderSekcjiZdjec(wezel.full_path) ?? undefined}
            />
          </div>
        </div>
      )}
    </div>
  );
}
