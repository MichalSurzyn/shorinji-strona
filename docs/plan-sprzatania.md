# Plan sprzątania repozytorium

Stan na 2026-09-01, gałąź `drzewo-stron`. Przegląd objął 160 plików śledzonych przez
gita. Każde zgłoszenie sprawdzał osobno sceptyk z poleceniem „nie ufaj, zweryfikuj
grepem" — **38 zgłoszeń się obroniło, 21 upadło**. Poniżej są tylko te, które
przetrwały, plus jedna rzecz znaleziona poza przeglądem.

Nic z tego nie jest wykonane. To jest plan do akceptacji.

---

## Zasada, która unieważniła jedną trzecią zgłoszeń

Osiem z dwudziestu jeden odrzuconych zgłoszeń popełniło **ten sam błąd**: założyły, że
skoro migracja jest skończona, to `nav_items`, `custom_pages` i `article_overrides
już nie istnieją. **Na produkcji istnieją i mają dane.** `supabase/04-contract.sql`
uruchomiono **wyłącznie na poligonie**; na produkcji to wciąż plik do wklejenia ręcznie,
a cała gałąź `drzewo-stron` nie jest zmergowana ani wypchnięta.

Stąd twarda reguła dla całego sprzątania:

> **Dopóki produkcja nie jest przełączona, nie wolno usuwać niczego, co obsługuje stare
> tabele.** Dotyczy to `scripts/migrate-pages.mjs`, `scripts/migrate-tresc.mjs`,
> `lib/articleContent.ts`, `lib/blockConvert.ts`, `lib/markdown.ts`,
> `supabase/setup.sql` i `supabase/02-kosz-i-historia.sql`. Wszystkie wyglądają na
> martwe i wszystkie są potrzebne **do ostatniego uruchomienia migracji na produkcji**.

Ta reguła jest w planie ważniejsza od każdej pojedynczej poprawki.

---

## Grupa 0 — to nie jest sprzątanie, to luka. Zrobić pierwsze

**`scripts/dump-db.mjs` nie zrzuca `pages` ani `redirects`.**

Skrypt zrzuca siedem starych tabel. Obu nowych — tych, w których po migracji siedzi
**cała treść i wszystkie adresy** — na liście nie ma. Nagłówek pliku nazywa go „kopią
zapasową przed pierwszym zapisem do bazy" i „jedyną realną drogą odwrotu".

Po przełączeniu produkcji zrzut zrobiony tym skryptem byłby **kopią, która nie zawiera
serwisu** — i wyglądałby na kompletny, bo skrypt kończy się na „WYNIK: OK".

Poprawka: dopisać `pages` i `redirects` do listy `TABELE` (2 linie). Zrobić **przed**
przełączeniem, nie po.

---

## Grupa A — martwy kod. Jeden commit, zero ryzyka

Wszystko poniżej ma **zero wywołań** w całym repo, łącznie z `scripts/` i `docs/`
(najczęstsza pułapka w tym projekcie — skrypty uruchamiane ręcznie bywają jedynym
konsumentem modułu).

| Co | Gdzie | Uwaga |
|---|---|---|
| `getArticleImages` | `actions/articleActions.ts:11-23` | Osierocona w etapie 7. Robi dokładnie to, co ten etap zlikwidował: skleja folder Cloudinary ze sluga. Przy okazji poprawić JSDoc `getImagesFromFolder`, który zaczyna się od „Wydzielone z `getArticleImages`" — inaczej powstaje nowy kłamiący komentarz |
| `czyZapisanoOrganizacje` | `lib/organization.ts:66-76` | Komentarz obiecuje plakietkę w panelu, której nie ma |
| `listPageOverrideSlugs` | `lib/pageOverrides.ts:61-75` | |
| `FULL_ADDRESS` | `lib/site.ts:31-32` | Usunąć razem z komentarzem nad nim |
| `data/articles/index.ts` | cały plik, 4 linie | Barrel bez importera; skrypty migracyjne świadomie go omijają i ładują trzy pliki tematów wprost |
| tryb `"article"` w `BlockEditor` | `components/admin/BlockEditor.tsx` | Po skasowanym ekranie `/admin/edit`. **Cięcie kaskaduje**: `mode` jest przewleczony przez `BlockEditor` → `BlockBody` → warunki. Zrobić w całości albo wcale — połowa zostawia nowy martwy kod |
| trzy zbędne `export` | `components/NewsBlocks.tsx:11,70,411` | Zdjąć samo słowo `export`, kod zostaje. `slugifyAnchor` i eksport domyślny mają konsumentów |
| dwa warianty `RodzajTresci` | `lib/versions.ts:14,16` | `"custom_page"` i `"topic_article"` — po tabelach, których panel już nie obsługuje. Danych w `content_versions` to nie dotyka |

**Do tego trzy resztki po `create-next-app`:**

- `public/file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg` — zero
  odwołań w kodzie. **Ale**: `scripts/snapshot-tree.mjs:137-141` trzyma je na liście
  adresów, dla których oczekuje 200. Usunąć pliki **i te pięć wierszy w tym samym
  commicie**, inaczej kontrola po etapie zgłosi pięć fałszywych regresji.
  `docs/golden-master-przed.json` **zostawić bez zmian** — to zapis stanu „przed",
  ma prawo je wymieniać.
- `app/globals.css:29-32` — blok `@theme inline` wskazuje na fonty Geist, których
  w projekcie nie ma. Skutek: klasa `font-mono` rozwiązuje się do niczego.
- `eslint.config.mjs:8-15` — `globalIgnores` powtarza co do znaku domyślne wykluczenia
  `eslint-config-next`, a komentarz nazywa to „Override".
- `global.d.ts` — powtarza deklaracje, które Next dostarcza sam.

**Rozmiar całej grupy: ~120 linii mniej, 6 plików mniej.**

---

## Grupa B — komentarze, które kłamią o dzisiejszym stanie

Osobna grupa, bo to zmiany **wyłącznie w komentarzach** — zero wpływu na działanie,
a każda z nich wprowadza w błąd następną osobę czytającą ten kod.

| Gdzie | Co kłamie |
|---|---|
| `app/[...sciezka]/page.tsx:26` | Podaje `app/o-shorinji/[slug]` jako przykład trasy statycznej mającej pierwszeństwo. Ten katalog zniknął w etapie 7. Zamienić na `app/organizacja` — `app/aktualnosci/[slug]` byłoby złym zamiennikiem, bo zdanie mówi o trasach *statycznych* |
| `lib/przekierowania.ts:8-14` | Mówi o „pięciu miejscach wywołania" i wymienia cztery trasy `[slug]`. Wywołania są **dwa**: catch-all i `/aktualnosci/[slug]`. Trzy z czterech tras zniknęły w etapie 7 |
| `lib/listingi.ts:26-27` | „Ten wyjątek znika w etapie 7" — etap 7 i 8 są za nami, a zapas stoi i jest wołany z trzech tras. W tym samym pliku, 30 linii niżej, stoi już poprawne wyjaśnienie (linie 56-60) — nagłówek ma się do niego odesłać |
| `lib/pages.ts:10-12` | „Dzisiejszy wzorzec z `lib/customPages.ts`" — tego pliku nie ma od etapu 8. Sześćdziesiąt linii niżej ten sam plik robi to poprawnie („przeniesione tutaj z…") |
| `actions/pagesActions.ts:384` | Obiecuje `entity_type = 'page_node'`, a linia niżej zapisuje `"page"`. Poprawić **komentarz**, nie kod |
| `next.config.ts:29-33` | Uzasadnia regułę przekierowania plikiem `app/organizacja/[slug]`, skasowanym w etapie 7. **Reguła zostaje** — obsługuje ją routing Next bez zapytania do bazy, a adres jest zaindeksowany. Zmienić samo uzasadnienie |
| `docs/panel-ux.md:1`, `docs/polityka-weryfikacja.md:3` | Podają katalog projektu na dysku `G:`, którego nie ma (projekt jest na `C:`) |

---

## Grupa C — dokumenty opisujące stan, którego nie ma

Tu **nie proponuję kasowania**. Te pliki mają wartość, tylko przedstawiają wykonaną
pracę jako plan. Wystarczy w każdym jeden nagłówek statusowy.

| Plik | Problem | Propozycja |
|---|---|---|
| `README.md:40-41, 62-78, 80-104` | Opisuje strukturę katalogów i panel sprzed dwóch przebudów; wymienia zakładki, których nie ma | Przepisać dwie sekcje albo okroić README do uruchomienia, palety i zmiennych, a resztę oddać `docs/` |
| `docs/przekazanie-sesji.md` | **Najgorszy przypadek**: `CLAUDE.md:7` wskazuje go jako „pełny kontekst", więc czyta go każda nowa sesja. Sekcja 4 wymienia trzy skasowane tabele w czasie teraźniejszym, a rozdział 8 stawia zrobioną migrację jako „następne zadanie" | Nagłówek statusowy + poprawić listę tabel. **Nie** przenosić całego rozdziału 8 do „zrobione": podsekcja „Reszta" (Draft Mode, autozapis, historia wersji, metadane SEO) jest wciąż otwarta |
| `docs/menu-architektura.md` | Drugi odsyłacz z `CLAUDE.md`. Prezentuje w czasie przyszłym plan, którego 16 commitów jest już napisanych; linia 27 twierdzi, że `pages` i `redirects` nie istnieją | Jeden nagłówek statusowy pod linią 3: co wykonane, co zostaje żywe (§9), że §2.0 to pomiar historyczny |
| `docs/panel-ux.md` | Cała Fala 1 wdrożona, dokument odsyła do plików usuniętych w etapie 8, brak daty i statusu | Znacznik stanu przy każdej fali. Słownik terminów zostaje — jest używany |
| `docs/checklista-odbioru.md` | Każe sprawdzić zakładki panelu, które zniknęły | Nagłówek: „checklista odbioru z 09.08.2026; dla drzewa stron patrz `checklista-drzewo-stron.md`" |

---

## Grupa D — duplikacja. Osobne commity, każdy do osobnej decyzji

Uszeregowane od najlepszego stosunku zysku do ryzyka.

1. **Dwie kopie `getImagesFromFolder`** — `actions/articleActions.ts` i
   `actions/galleryActions.ts`. Po usunięciu martwego `getArticleImages` (Grupa A)
   pierwszy plik zostaje z jedną funkcją, która jest kopią drugiej. Przepiąć
   `components/ArticlePage.tsx` na `galleryActions` i skasować cały plik.
   *Zysk: plik mniej, jedna kopia `cloudinary.config` mniej.*

2. **Dwanaście kopii tego samego bloku komunikatu** w `components/admin/*` —
   ten sam `<p>` z zielonym/czerwonym tłem, przepisany dwanaście razy. Jeden komponent
   `components/admin/Komunikat.tsx` obok istniejącego `PasekAkcji.tsx`.
   *Zysk: ~115 linii netto. Ryzyko małe — wzorzec już w repo istnieje.*

3. **`TreeNodeEditor` pisze od nowa pasek zapisu**, który jest w `PasekAkcji.tsx`.
   Przy okazji dochodzi `useUnsavedChanges` (ostrzeżenie przed wyjściem z niezapisanymi
   zmianami), którego nowy edytor nie ma, a inne edytory mają.
   *Ryzyko: wymaga uwagi — to zmiana zachowania, nie tylko kształtu.*

4. **Podpisana wysyłka do Cloudinary napisana dwa razy** (`ImagePicker.tsx`,
   `ImagesManager.tsx`), przy czym **jedna kopia gubi błędy**. Wyciągnąć do
   istniejącego `lib/obrazy.ts`.
   *To nie jest tylko sprzątanie — to naprawa cichego połykania błędu.*

5. **`cloudinary.config` wklejone trzy razy**, w jednej kopii inaczej niż w dwóch
   pozostałych. `lib/cloudinary.ts` już istnieje.
   *Ryzyko: wymaga uwagi — `config()` mutuje globalny obiekt, więc kolejność importów
   ma znaczenie. Sprawdzić, zanim się ruszy.*

---

## Czego świadomie NIE robić

Te rzeczy wyglądają na warte poprawienia i **nie są**:

- **Rozbijania `ImagesManager.tsx`, `TreeManager.tsx` ani `BlockEditor.tsx`** na
  mniejsze pliki. Każdy z nich robi jedną rzecz w wielu krokach, a nie kilka rzeczy
  naraz. Rozbicie wymagałoby wymyślenia warstwy, której dziś nie ma.
- **Scalania `parseEnv`/`loadEnv` z sześciu skryptów** w jeden moduł. Duplikacja jest
  realna (~40 linii), ale skrypty są samodzielne z rozmysłem — uruchamia się je
  pojedynczo, ręcznie, czasem na innej bazie.
- **Scalania `app/zajecia/dorosli` z `app/zajecia/dzieci`.** Różnią się dwunastoma
  parami linii, nie trzema tokenami.
- **Scalania trzech stron-listingów.** Wspólna warstwa już powstała w etapie 6
  (`lib/listingi.ts`); to, co zostało w trzech plikach, to trzy różne stałe.
- **Kosza w `TreeManager` z `TrashSection`.** Obsługują różne przypadki (drzewo ma
  potomków i kolizje adresów), a scalenie łamie spisany test odbioru.
- **Niczego z `supabase/setup.sql` i `02-kosz-i-historia.sql`.** Oba opisują tabele,
  które na produkcji **żyją**, i oba są w czynnym użyciu.

---

## Kolejność

1. **Grupa 0** (dump-db) — teraz, zanim cokolwiek pójdzie na produkcję.
2. **Grupa A + B** — jeden commit „martwy kod", drugi „komentarze". Zero ryzyka,
   po nich `tsc`, `eslint` i `node Poligon/zrzut-po-etapie.mjs` muszą być zielone.
3. **Grupa C** — po Twojej checkliście, żeby nagłówki statusowe opisywały stan już
   zweryfikowany, a nie zakładany.
4. **Grupa D** — punkt po punkcie, każdy osobnym commitem, w kolejności z listy.
   Punkt 4 (gubione błędy Cloudinary) można podnieść wyżej, bo to naprawa, nie kosmetyka.
5. **Po przełączeniu produkcji** — dopiero wtedy usunięcie `lib/articleContent.ts`,
   `lib/blockConvert.ts`, `lib/markdown.ts` i obu skryptów migracyjnych. Warunek jest
   zapisany w nagłówku `supabase/04-contract.sql`.
