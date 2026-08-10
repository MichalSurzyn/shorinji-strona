# Przekazanie: stan projektu i zasady pracy

Dokument dla nowej sesji. Zawiera wszystko, co potrzebne, żeby kontynuować bez czytania
historii rozmowy. Stan na **09.08.2026**, wszystko poniżej jest **wdrożone na produkcji**
(shorinjikempo.pl), chyba że napisano inaczej.

---

## 1. Projekt w skrócie

Strona klubu **Shorinji Kempo Kraków**. Next.js 16 (App Router), React 19, Tailwind v4,
Supabase (baza + magazyn plików + logowanie), Cloudinary (zdjęcia), Netlify (hosting,
ciągłe wdrażanie z gałęzi `master`).

**Cel przebudowy:** każda treść widoczna na stronie ma być edytowalna z panelu `/admin`
i trzymana w bazie, żeby po zmianach wyglądała identycznie na każdym urządzeniu.
Zakres uzgodniony z właścicielem: **absolutnie wszystko**, łącznie z chrome interfejsu.

**Drugi cel:** panel ma być wygodny dla **nietechnicznego instruktora**, nie dla programisty.

---

## 2. Właściciel i styl pracy

Michał. Pracuje **bezpośrednio na `master`**, świadomie bez gałęzi i pull requestów
(„i tak da się po commitach cofać, a mniej akceptów").

- Commituj **granularnie, osobnym commitem na naprawę** — to jego siatka bezpieczeństwa.
- Nie pytaj o zgodę na rzeczy odwracalne i sprawdzone. Rób i raportuj.
- **`git push` = wdrożenie produkcyjne.** Sygnalizuj to, nawet gdy push jest zaakceptowany.
- Dał ogólną zgodę na pracę na bazie danych.
- Zgłasza uwagi zbiorczo po obejrzeniu panelu — czasem są to nieporozumienia, czasem
  realne błędy. **Zawsze weryfikuj w kodzie, zanim przyznasz albo zaprzeczysz.**
- Research prowadź **Sonnetem** (`model: 'sonnet'` w agentach workflow) — Opus zjada limit.

---

## 3. Pułapki, na które już się nadziałem

Każda kosztowała czas. Nie powtarzaj.

**Tailwind v4 skanuje CAŁY projekt.** Ścieżka Windows w dokumentacji (`...\1608beca-...`)
wyglądała jak sekwencja ucieczki CSS i **położyła całą aplikację** — wszystkie trasy 500,
z błędem wskazującym mylnie na `app/globals.css`. Naprawione przez `source(none)` +
jawne `@source "../app"` i `"../components"`. Nie dodawaj katalogów do skanowania.

**Kolejność: kod przed migracją danych** (albo odwrotnie — zależy, co od czego zależy).
Zmigrowałem treść cennika na nowy typ bloku, zanim wdrożyłem kod, który ten typ rozumie —
i na kilka minut **zniknął numer konta z produkcji**. Zasada: jeśli dane zależą od nowego
kodu, najpierw kod. Jeśli kod zależy od danych (np. `PageHeader` zwraca `null` bez wpisu),
najpierw dane.

**PostgREST nie wykonuje DDL.** Klucz `service_role` daje dostęp do wierszy i funkcji
w schemacie `public`, nic więcej. `rpc/exec_sql`, `/pg/query`, `information_schema` — wszystko
404 (sprawdzone). Zmiany schematu przygotowuj jako plik SQL do wklejenia w Supabase →
SQL Editor. **Ale magazyn plików (Storage) już TAK** — kubełki da się zakładać kluczem
`service_role`.

**Zmienne Netlify są filtrowane po kontekście.** `SUPABASE_SERVICE_ROLE_KEY` jest ustawiony
tylko dla `Production` i nie widać go pod filtrem „Local development". Straciłem na tym czas,
zanim udowodniłem, że klucz istnieje.

**Plik `"use server"` może eksportować wyłącznie funkcje asynchroniczne.** Eksport stałej
z `actions/*.ts` wywala kompilację. Stałe i funkcje synchroniczne idą do `lib/`.

**Tailwind v4 używa właściwości CSS `rotate`, nie `transform`.** `getComputedStyle().transform`
pokazuje `none` mimo działającego obrotu — prawie uznałem poprawkę za niedziałającą.

**Nie ufaj `| head` przy sprawdzaniu kodu wyjścia.** `npx eslint . | head -10 && echo OK`
wypisze OK mimo błędów, bo kod wyjścia bierze się z `head`. Sprawdzaj `; echo $?`.

---

## 4. Architektura treści — gdzie co siedzi

### Baza (Supabase, tabela `site_settings`, klucz → JSON)

| Klucz | Zawartość | Edytor w panelu |
|---|---|---|
| `page:<slug>` | nagłówek (kicker/H1/lead) + bloki treści | Strony → dana strona |
| `organization` | **jedno źródło** danych podmiotu | Dane organizacji |
| `footer` | kolumny stopki (kolejność, nazwy, odnośniki) | Stopka strony |
| `schedule` | grafik zajęć | Grafik zajęć |
| `kopia:*` | kopie sprzed migracji, do wycofania zmian | — |

### Pozostałe tabele

`articles` (aktualności, z koszem), `custom_pages` (własne podstrony, z koszem),
`article_overrides` (nadpisania podstron tematycznych), `nav_items` (menu),
`contact_messages` (formularz, retencja 12 mies.), `content_versions` (historia zmian).

DDL wszystkich tabel: `supabase/setup.sql` i `supabase/02-kosz-i-historia.sql`.

### Magazyn plików

Supabase Storage, kubełek **`pliki`** (publiczny, 20 MB/plik). PDF-y serwowane przez
trasę `/downloads/<nazwa>` — **nie** przez adres magazynu, żeby istniejące odnośniki
przetrwały ewentualną zmianę magazynu. `public/downloads` **już nie istnieje**.

### Zdjęcia

Cloudinary, tryb dynamic folders (`asset_folder`, krótkie `public_id`).
Foldery: `Galeria/*` (zakładki galerii publicznej), `Strona/<temat>/<slug>` (zdjęcia podstron).

---

## 5. Konwencje, których się trzymam

**Bloki treści bez własnych danych.** Typy `bank` i `kontakt` nie przechowują niczego —
czytają z `organization`. Tak wygląda usuwanie duplikatów: blok jest tylko widokiem.
W edytorze taki blok **celowo nie ma pól**, za to ma wyjaśnienie i odnośnik do miejsca edycji.

**Puste pole = brak elementu.** Pusty profil społecznościowy nie renderuje martwej ikony,
pusty telefon nie zostawia pustego wiersza. Nigdzie nie podstawiamy po cichu wartości z kodu
w miejsce pustego pola zapisanego przez redaktora.

**Cofanie zamiast potwierdzeń.** Modal przy każdym usunięciu uczy odruchowego klikania „tak".
Potwierdzenie zostaje **wyłącznie** dla operacji bez odwrotu („Usuń na stałe", usunięcie pliku,
odebranie dostępu) i mówi konkretnie, co się stanie.

**Komunikaty błędów przez `lib/adminErrors.ts`.** Trzy części: co się nie udało, dlaczego,
co zrobić teraz — plus informacja, że tekst nie przepadł. Zero kodów błędów i angielskiego.

**Ostrzeżenie o niezapisanych zmianach: `lib/useUnsavedChanges.ts`.** Samo `beforeunload`
nie wystarcza w App Routerze — hook przechwytuje też kliknięcia w odnośniki i przycisk wstecz.

**Pasek akcji przyklejony do góry: `components/admin/PasekAkcji.tsx`.** Wszystkie edytory
mają ten sam układ. Cofanie to pływające powiadomienie w prawym dolnym rogu.

**Słownik.** Interfejs mówi rzeczami widocznymi na stronie: „Grafik zajęć", „Menu na górze
strony", „Tytuł strony" (nie „H1"), „Wyróżniona ramka" (nie „callout"), „Dodaj element"
(nie „blok"). Pełna tabela ~60 terminów: `docs/panel-ux.md`, sekcja Słownik.

**Komentarze po polsku, wyjaśniające DLACZEGO**, nie co. Zwłaszcza tam, gdzie decyzja jest
nieoczywista albo naprawia konkretny błąd.

---

## 6. Jak testuję (bez frameworka testowego)

Projekt nie ma testów jednostkowych. Wypracowany sposób, który się sprawdza:

1. **Skrypt `.mjs` w katalogu projektu**, czytający `.env`, łączący się do Supabase kluczem
   `service_role`, wykonujący pełny cykl na **danych testowych** i **zawsze sprzątający
   w `finally`**. Na końcu kontrola, że baza wróciła do stanu wyjściowego.
2. **Weryfikacja przez `curl` na działającym serwerze** — sprawdzam wyrenderowany HTML,
   nie założenia.
3. **`npx tsc --noEmit; echo $?` i `npx eslint .; echo $?`** — po kodzie wyjścia.
4. **`npm run build`** przed każdym pushem — to jedyny test, który przewiduje, czy Netlify
   się zbuduje.
5. Po pushu: **odpytanie produkcji** o sygnał unikalny dla nowej wersji (nie o coś, co działało
   też wcześniej — na tym się raz naciąłem).

Właściciel zaakceptował testowanie na testowych podstronach i artykułach — tworzysz,
sprawdzasz, kasujesz.

---

## 7. Co jest zrobione

**Etap 0 — baza.** Pełny DDL 6 tabel. Utworzona brakująca `contact_messages` (formularz
kontaktowy do 08.08 zwracał błąd przy każdym wysłaniu).

**Etap 1 — panel przestał kłamać.** Naprawione miejsca, gdzie panel obiecywał edycję,
a strona ją ignorowała: wymuszanie CENNIKA w menu, listingi i metadane podstron tematycznych,
JSON-LD z harmonogramem, skrypt seedujący.

**Fala 1 UX panelu.** Ochrona przed utratą pracy, błędy po polsku, cofanie, odzyskiwanie hasła
(`/admin/nowe-haslo`), pulpit wokół zadań, słownik, widok folderów zdjęć z realnym raportowaniem
wysyłki, bezpieczny zapis menu, grafik przestał przestawiać wiersze pod kursorem, pasek akcji.

**Fala 2 (część).** Zakładka „Dane organizacji" z walidacją IBAN (suma kontrolna mod 97) —
stopka, mapa, dane dla Google i cennik czytają stamtąd. Kosz z historią zmian. Retencja
wiadomości. Informacja RODO przy formularzu. YouTube bez ciasteczek. Konfigurowalne kolumny
stopki. Zakładka „Pliki do pobrania". Galeria jako albumy-stosy. Nagłówki `/aktualnosci`
i `/galeria` z bazy.

**Fala 3 (część).** Usunięty martwy kod: `data/news.ts`, cztery nieużywane funkcje, dwa
adresy map, pole `about` w stopce.

---

## 8. Co zostało

### Następne zadanie: połączenie menu i stron

**Problem** (zgłoszony po testach): „Menu na górze strony" i „Strony" to dwie osobne zakładki.
Dodanie pozycji w menu tworzy **odnośnik do strony, która nie istnieje**. W drugą stronę
działa — utworzenie podstrony samo dodaje pozycję. Asymetria myli.

Nie da się też dodać podstrony pod istniejącą pozycją (np. pod „Program nauczania") bez
ręcznego wpisania sluga. Potrzebne **trzy poziomy** (dziś dwa).

**Pełna propozycja architektury: `docs/menu-architektura.md`** — 36 zasad z researchu,
model danych z DDL, ekran panelu, migracja, 8 etapów. Poniżej sedno.

### Model: jedna tabela `pages` zamiast `nav_items` + `custom_pages`

Adjacency list (`parent_id` + `position`), całe drzewo jednym `SELECT` i składane w pamięci.
Przy ~28 węzłach ltree, nested sets i closure table dokładają maszynerię bez zysku.

Ten sam wiersz jest **węzłem drzewa, źródłem adresu i pozycją menu**. To usuwa przyczynę
martwego linku na poziomie modelu, nie walidacji.

Dwie kolumny rozstrzygają, czym pozycja jest:
- `kind`: `page` (ma treść) / `link` (odnośnik zewnętrzny) / `header` (nagłówek grupujący)
- `source`: `db` (treść w tym wierszu) / `route` (renderuje ją istniejąca trasa w kodzie,
  np. `/zajecia/cennik`) — **dzięki temu nie powstaje ani jedna strona-placeholder**

`full_path` to denormalizacja liczona triggerem, nigdy źródło prawdy o strukturze.
Adresy rozwiązuje jedna trasa catch-all `app/[...sciezka]/page.tsx`.

### Trzeci poziom — pomysł właściciela zatwierdzony

Menu rozwijane zostaje **dwupoziomowe**. Trzeci poziom istnieje w danych (`depth = 2`),
a w interfejsie wychodzi na stronę-hub z kafelkami.

Kluczowe uproszczenie z researchu: **nie ma osobnego typu „strona listingowa"**. Bycie
listingiem wynika z posiadania dzieci (`layout = 'auto'`). Węzeł z opublikowanymi dziećmi
renderuje nagłówek + wstęp + własne bloki + kafelki dzieci.

```
Program nauczania        depth 0, w menu, ma dropdown
├─ Uczniowskie           depth 1, w menu, layout auto → kafelki
│  ├─ 6 kyu              depth 2, in_menu = false → kafelek u rodzica
│  └─ 5 kyu              depth 2, in_menu = false
└─ Mistrzowskie          depth 1, w menu
```

Egzekwowanie w kodzie: ustawienie `in_menu` na węźle `depth = 2` jest **odrzucane
komunikatem**, nie ignorowane po cichu — ciche ignorowanie odtwarzałoby dzisiejszą asymetrię.

### Rzeczy, które łatwo przeoczyć

- **`ON DELETE CASCADE` → `RESTRICT`.** Dziś kaskada jest na `nav_items` i dotyczy tylko
  etykiet. Po scaleniu dotyczyłaby treści — jedno kliknięcie kasowałoby całe poddrzewo.
- **Przekierowania w kodzie aplikacji, nie w `next.config.ts`.** Reguły tam są kompilowane
  przy budowaniu, a instruktor nie wywoła wdrożenia — każda zmiana sluga dawałaby 404
  z wyników Google. Tabela `redirects` + obsługa w trasie catch-all.
- **Nie w middleware** — biegłoby dla każdego żądania; w trasie catch-all wykonuje się
  wyłącznie dla nietrafionych adresów.
- **Migracja nie zmienia ani jednego istniejącego adresu.** Porządkowanie ścieżek „przy
  okazji" miesza dwa ryzyka w jednym wdrożeniu i psuje golden master jako narzędzie kontroli.
- **`article_overrides` kasować dopiero po przeniesieniu treści** — siedzą tam realne zmiany
  redaktora bez odpowiednika w `data/articles/*.ts`.
- **`RESERVED_SLUGS` nadal potrzebne** na poziomie zerowym: indeks unikalny obroni przed
  kolizją z trasami mającymi węzeł, ale nie przed `/admin`, `/api`, `/downloads`, `sitemap.xml`.

### Etapy

Wzorzec expand → migrate → contract, za flagą `DRZEWO_STRON`. Osiem etapów, ~11 dni.
Etapy 0–2 niewidoczne dla użytkowników. **Pierwszy widoczny efekt po etapie 5** (~8 dni):
trzy poziomy i dodawanie strony pod istniejącą pozycją. Etapy 6–7 (listingi, treść artykułów
tematycznych) można odłożyć. Etap 8 (`contract`) ma mieć datę — przerwana migracja jest
gorsza od punktu wyjścia, bo utrzymuje się dwie ścieżki kodu nad jedną treścią.

Przed etapem 1: zrzut stanu do `docs/golden-master-przed.json` i porównanie po każdym etapie.

### Powiązana luka

`topicTitle` i `topicIntro` dla `/organizacja`, `/buddyzm`, `/o-shorinji` siedzą w
`data/articles/*.ts` i **żaden edytor ich nie dotyka**. Opis na `/organizacja` jest sztywny.
Do naprawy przy okazji menu — strony-listingi i tak wymagają edytowalnych nagłówków.

### Reszta

- Podgląd **niezapisanej** wersji (Draft Mode) — właściciel wybrał wariant „w nowej karcie"
- Autozapis
- Ekran historii wersji (dane się zbierają od 09.08, brakuje widoku)
- Kosz własnych podstron w interfejsie (warstwa działa, brakuje sekcji)
- Metadane SEO z panelu
- Zawężenie uprawnień do bazy (odczyt publiczny idzie `service_role`, omijając RLS) — **wymaga SQL**
- Powiadomienie e-mailem o nowej wiadomości z formularza — **wymaga usługi wysyłkowej, decyzja właściciela**
- Edytor markdown → WYSIWYG. Właściciel świadomie zostawił markdown. Tańszy wariant:
  podgląd na żywo pod polem. Droższy: prawdziwy WYSIWYG + konwersja całej treści.

---

## 9. Polityka prywatności — NIE PUBLIKOWAĆ bez przeglądu

`docs/polityka-prywatnosci-DRAFT.md` + `docs/polityka-weryfikacja.md` (23 zastrzeżenia,
3 blokujące).

Kluczowa uwaga kontrolera: dokument w pierwotnej formie był **spisem własnych naruszeń**.
RODO nie wymaga opisu środków bezpieczeństwa, a publikacja takiego spisu daje organowi gotowy
dowód. Ustalona kolejność: **najpierw naprawa kodu, potem opis stanu po naprawie.**

Z blokad naprawione: retencja wiadomości, informacja przy formularzu, YouTube bez ciasteczek.
Zostaje: **dane rejestrowe klubu** (KRS, NIP, REGON, sąd — puste w zakładce Dane organizacji)
i **przegląd przez osobę z uprawnieniami prawniczymi**. Dokument dotyczy danych dzieci.

Właściciel potwierdził, że zgody na wizerunek są zbierane na piśmie przy zapisie — polityka
ma to opisać jako stan faktyczny.

---

## 10. Dokumenty w repozytorium

| Plik | Co zawiera |
|---|---|
| `docs/panel-ux.md` | plan przebudowy panelu: 150 zasad z researchu, 84 problemy, 3 fale, słownik ~60 terminów, aneks z 14 lukami |
| `docs/dane-organizacji-spec.md` | specyfikacja zakładki: 121 zmapowanych konsumentów, 53 pola |
| `docs/polityka-prywatnosci-DRAFT.md` | draft polityki — **nie publikować** |
| `docs/polityka-weryfikacja.md` | 23 zastrzeżenia do draftu |
| `docs/checklista-odbioru.md` | lista do sprawdzenia klikaniem, z opisem oczekiwanego zachowania |
| `docs/menu-architektura.md` | propozycja architektury drzewa stron (dodana na końcu tej sesji) |

---

## 11. Sprawy otwarte po stronie właściciela

- **Dane rejestrowe** klubu do zakładki Dane organizacji (odblokują politykę prywatności)
- **Trzecie konto** w Supabase Auth (`michal.goj.xii@gmail.com`) — jeśli to pozostałość
  po testach, warto skasować
- Decyzja o **powiadomieniach e-mail** z formularza kontaktowego
