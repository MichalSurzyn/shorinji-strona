# Przekazanie sesji — 2026-08-12

> **TEN PLIK JEST DO USUNIĘCIA.** Powstał tylko po to, żeby przenieść stan pracy
> na inny komputer przez git (notatki w `C:\Workspace\Kempo\shorinji-notes\` leżą
> poza repo, więc nie jadą razem z repozytorium).
>
> **Zadanie nr 0 na nowym komputerze:** przepisać sekcję „Korekty do
> `docs/menu-architektura.md`" (niżej) do tego dokumentu — bo on jest planem
> wykonawczym, na który wskazują notatki — a potem **skasować ten plik**:
> `git rm PRZEKAZANIE-2026-08-12.md`. Dopóki korekty siedzą tylko tutaj, plan
> w `docs/` prowadzi w trzy złamane adresy i w drugą ręczną wizytę w SQL Editorze.

---

## 1. Co zrobiliśmy w tej sesji — zamknięte

### Treść stron nie znika już przy awarii bazy

**Defekt (pre-existing, niezależny od przebudowy menu).** Treść ośmiu tras
edytowalnych siedziała wyłącznie w Supabase (`site_settings`, klucz
`page:<slug>`). Gdy baza nie odpowiadała — brak zmiennej w danym kontekście
deployu na Netlify, uśpiony projekt na darmowym planie, timeout —
`getPageContent()` zwracało `null`, a `PageHeader`/`PageBody` renderowały `null`.
Efekt: **HTTP 200 z pustym `<main>`**.

Dlaczego to gorsze od 500: przy 500 Google trzyma w indeksie poprzednią wersję
i wraca później. 200 z pustą stroną to komunikat „ta strona teraz tak wygląda" —
czyli cienka treść, utrata pozycji, i żaden monitoring tego nie łapie, bo 200 to
sukces.

Reszta serwisu miała fallback do kodu od początku (`DEFAULT_NAV`, `SCHEDULE`,
`DEFAULT_FOOTER`, `DEFAULT_ORGANIZATION`, `content-fallback/articles.json`,
`data/articles`) — te osiem tras było **jedynym wyjątkiem**. Konwencja projektu
(`working-agreement.md`) wymagała fallbacku od zawsze: „odczyty z Supabase ZAWSZE
`abortSignal(6000)` + `try/catch` + `console.warn` + **fallback**". Timeout, catch
i warn były. Fallbacku nie było.

**Zmienione pliki (3):**

| Plik | Zmiana |
|---|---|
| `lib/editablePages.ts` | nowe pole `prefillHeader` (kicker/H1/lead) w 8 wpisach; nowe `basePageContent(slug)` i `basePageContentFor(page)`; poprawiony komentarz nagłówkowy, który odwoływał się do `EditableSection` — komponentu, którego w repo nie ma, czyli obiecywał fallback, którego nie było |
| `components/PageContent.tsx` | `PageHeader` i `PageBody`: `(await getPageContent(slug)) ?? basePageContent(slug)` |
| `app/admin/(panel)/strona/[slug]/page.tsx` | panel miał ten sam fallback wklejony literałem — teraz woła `basePageContentFor(page)`, więc treść bazowa ma jedną definicję |

**Dwie rzeczy, które trzeba wiedzieć o kształcie tej poprawki:**

1. Fallback wchodzi **tylko w publicznym renderze**. Panel dalej woła samo
   `getPageContent()`, więc odróżnia „brak wiersza" od „wiersz zapisany" —
   inaczej plakietki i edytor kłamałyby o stanie bazy.
2. **Świadome wyczyszczenie treści w panelu zostaje puste.** Gdy wiersz istnieje,
   ale jest opróżniony, `getPageContent()` zwraca obiekt (nie `null`), więc `??`
   nie strzela i tekst z kodu nie wraca. Fallback „na wszystko, co puste" odebrałby
   redaktorowi możliwość opróżnienia strony.

**Wartości `prefillHeader` wzięte z żywej bazy** (nie ze `scripts/seed-content.mjs`,
który jest z czerwca i nie miał nagłówków dla `aktualnosci` ani `galeria`) — żeby
fallback wyglądał jak dzisiejsza strona, nie jak stan sprzed dwóch miesięcy.

**Weryfikacja (brak frameworka testowego — empirycznie, jak każe `CLAUDE.md`):**

| | przed poprawką | po poprawce |
|---|---|---|
| `<h1>` na 8 trasach bez bazy | 0 | 1 na każdej |
| znaków w `<main>` — `/zajecia/cennik` | **15** (`拳 禅 一 如 力 愛 不 二`) | 1840 |
| znaków — `/program-nauczania` | 15 | 1192 |
| znaków — `/` | 136 | 1177 |
| z działającą bazą: blok `video` w `<main>` strony głównej | — | obecny (bez bazy: brak) |

- `npx tsc --noEmit` czysty, `npm run lint` czysty, build z bazą i bez bazy oba exit 0.
- Awaria odtworzona **bez dotykania `.env.local`**: nadpisanie
  `SUPABASE_SERVICE_ROLE_KEY` w środowisku procesu (nie ma przedrostka
  `NEXT_PUBLIC`, więc czytany jest w czasie działania). Że nadpisanie zadziałało,
  potwierdziło 8 ostrzeżeń `[pageOverrides]` w logu buildu.
- **Kontrola negatywna** przez `git stash`: ta sama asercja na stanie sprzed
  poprawki daje zero `<h1>`, więc test mierzy różnicę, a nie sam siebie.
- Uwaga na przyszłość: pierwsza wersja asercji szukała `iframe|youtube` w całym
  HTML i dała fałszywy pozytyw, bo youtube'owy odnośnik klubu siedzi w JSON-LD
  (`StructuredData`) poza `<main>`. Dokładnie pułapka opisana w `CLAUDE.md`.
  Asercje zawężać do konkretnego elementu.

---

## 2. Co jest do zrobienia — kolejność

Przebudowa menu i stron (scalenie `nav_items` + `custom_pages` w jedną tabelę
`pages`). Plan wykonawczy: `docs/menu-architektura.md`. Kontekst biznesowy:
`shorinji-notes/panel-scalenie-menu-i-stron.pdf`.

**Decyzje właściciela, już podjęte:** wariant C→B (pełne drzewo danych, prostszy
panel na start), struktura trzypoziomowa jest realnie planowana (stopnie kyu/dan
w Programie nauczania), robimy **wszystkie** etapy, nie tylko widoczne.

**Zasada nadrzędna, ważniejsza niż cokolwiek innego w tym zadaniu:**
migracja modelu **nie zmienia ani jednego istniejącego adresu URL**. Zmiany
adresów zdarzają się dopiero później, z inicjatywy redaktora, i wtedy trigger sam
zapisuje przekierowanie.

### Kolejność

0. **Wciągnąć korekty z sekcji 3 do `docs/menu-architektura.md`, skasować ten plik.**
1. **Etap 0a** — `scripts/snapshot-tree.mjs` + `docs/golden-master-przed.json`.
   Skrypt musi objąć **12 źródeł adresów** (lista w sekcji 3), odmawiać zapisu bez
   konfiguracji env, i normalizować origin (`NEXT_PUBLIC_SITE_URL` nie jest
   ustawiony, więc lokalnie wszystko leci na `shorinji-kempo.netlify.app`).
   Pliku golden mastera **nie kłaść** pod `app/` ani `components/` — Tailwind v4
   ma `source(none)` + jawne `@source`, a plik będzie pełen ścieżek, czyli materiał
   na powrót awarii `\1608be` z `CLAUDE.md`.
2. **Etap 0b** — rozstrzygnięcia projektowe wpisane do specyfikacji, bez kodu
   (sekcja 3, „Blokujące"). Bez nich etap 1 wyprodukuje schemat do ręcznej poprawki.
3. **Etap 1** — `supabase/03-drzewo-stron.sql`: `pages`, `redirects`, indeksy,
   trigger, **RLS**. Tworzy puste tabele obok starych; nic z kodu ich nie czyta,
   strona działa bez zmian. **Wkleja właściciel w Supabase SQL Editor** — klucz
   service-role czyta i zapisuje wiersze, ale nie wykona DDL. Plik ma być
   kompletny za pierwszym razem.
4. **Etap 2** — `scripts/migrate-pages.mjs`, backfill z **5 źródeł**, idempotentny,
   + zapytania kontrolne. Nadal nikt nie czyta. Wycofanie: `truncate pages`.
5. **Etap 3a** — odczyt menu z `pages` za flagą `DRZEWO_STRON` + dwuzapis.
6. **Etap 3b** — `Navbar` przepisany na wzorzec disclosure (osobny etap, patrz korekty).
7. **Etap 4** — trasa catch-all + przekierowania + sitemapa z drzewa.
8. **Etap 5** — panel: jedna zakładka „Strony i menu".
9. **Etap 6** — listingi tematyczne na węzłach `pages`.
10. **Etap 7** — treść artykułów tematycznych do `pages.blocks`.
11. **Etap 8** — contract: usunięcie starych tabel, zakładek, flagi. Ma dostać
    termin w kalendarzu; przerwana migracja jest gorsza od punktu wyjścia.

**Przed pierwszym zapisem do bazy:** zrzut wszystkich tabel do JSON
(`shorinji-notes/db-backup-<data>/`, wzorzec z 2026-07-30).

**Warunek ważności golden mastera:** w trakcie etapów 0–4 nie edytować treści ani
slugów w panelu. Zmiana sluga nie rewaliduje **starego** adresu
(`customPageActions.ts:125-126` odświeża tylko nowy), więc snapshot zrobiony w
ciągu 300 s po edycji pokaże dwa żywe adresy dla jednej strony.

---

## 3. Korekty do `docs/menu-architektura.md` (audyt 2026-08-12)

Audyt: 7 agentów, 5 obszarów kodu + pomiar żywej bazy + krytyk kompletności,
wszystko sprawdzane wobec realnego kodu i realnych danych.

**Werdykt: model danych się broni, zero podstaw do przepisania.** Jedna tabela
`pages`, adjacency list bez ltree, dwupoziomowe menu + strona-hub na trzeci
poziom, `redirects` w bazie zamiast `next.config.ts`, expand→migrate→contract,
golden master, `ON DELETE RESTRICT`, `RESERVED_SLUGS` na poziomie zerowym —
wszystkie decyzje potwierdzone, część argumentów wzmocniona. Żadna luka nie
wymusza zmiany choćby jednego adresu URL. Poprawki dotyczą **wykonania**, nie kierunku.

### 3.1 Blokujące — rozstrzygnąć PRZED napisaniem `03-drzewo-stron.sql`

1. **Trigger nie umie wyprodukować `/zajecia/*`.** „ZAJĘCIA" to `kind='header'`,
   a header ma `full_path = NULL` (§2.6). Trigger (§2.4) liczy adres z łańcucha
   slugów, więc dzieci dostają `coalesce(NULL,'') || '/' || slug` = `/cennik`,
   `/dorosli`, `/dzieci`. Trzy zaindeksowane adresy złamane sprzecznością między
   §2.4, §2.6 i §5.1. Węzła `/zajecia` nie da się dołożyć: `app/zajecia/` nie ma
   `page.tsx`, a `zajecia` jest w `RESERVED_SLUGS` — ten adres zwraca dziś 404 i
   musi taki zostać.
   **Poprawka:** dla `source='route'` → `full_path = route` **dosłownie**, nigdy
   z łańcucha slugów. Dla `source='db'` → `full_path` najbliższego przodka typu
   `page` (pomijając nagłówki) + `/` + slug. Test kontrolny etapu 2:
   `select full_path from pages where source='route' and full_path <> route`
   musi zwrócić zero wierszy.
2. **Strony głównej nie da się zapisać w tym schemacie.** `EDITABLE_PAGES` ma wpis
   `slug='home'`, `route='/'`, a CHECK wymaga dla `kind='page'` sluga pasującego
   do `^[a-z0-9-]+$`. `slug=''` odrzucone, `slug='home'` daje `/home`.
   Strona główna jest w sitemapie z `priority 1` i jest edytowalna z panelu.
   **Poprawka:** rozluźnić `pages_kind_fields_chk` — dla `source='route'` slug może
   być `NULL`; gałąź w triggerze: `parent_id IS NULL and route='/' -> full_path='/'`.
3. **Brak RLS na `pages`.** §2.2 dodaje `enable row level security` tylko dla
   `redirects`. Cała baza stoi na regule „RLS włączony wszędzie, zero polityk,
   dostęp wyłącznie kluczem service-role". `pages` ma trzymać szkice
   (`published=false`) i kosz (`deleted_at`) — dokładnie te treści, przed którymi
   RLS ma chronić; bez ALTER-a będą czytelne kluczem anon z bundla przeglądarki.
   **Poprawka:** `alter table public.pages enable row level security;` i **ani
   jednej** `create policy`, w tym samym pliku co `create table`. Nie kopiować
   wzorca z `setup.sql:51-55` (odziedziczona polityka SELECT dla anon na
   `articles`) — na `pages` wyciekłyby szkice.
4. **Cztery brakujące kolumny** — każda z nich pominięta oznacza drugą ręczną
   wizytę właściciela w SQL Editorze:
   - `content_key text` — wskaźnik na klucz `site_settings` (np. `page:zajecia-dorosli`).
     Slug **nie jest** dziś kluczem treści: rozjazd w 4 z 8 wpisów
     (`home`→`/`, `cennik`→`/zajecia/cennik`, `zajecia-dorosli`→`/zajecia/dorosli`,
     `zajecia-dzieci`→`/zajecia/dzieci`).
   - `cloudinary_folder text` — np. `Strona/buddyzm/medytacja`. Folder ze zdjęciami
     jest kluczowany **kształtem adresu**, więc zmiana sluga (cała pointa migracji)
     osieroci go na zawsze i nic tego nie zgłosi.
   - `migrated_from text` z indeksem unikalnym (np. `nav_items:<uuid>`). Rozwiązuje
     dwa problemy: daje cel `ON CONFLICT` wierszom `kind='header'`/`'link'` (mają
     `full_path NULL`, więc żaden unikalny indeks ich nie obejmuje), i daje
     dwuzapisowi z etapu 3 stabilny klucz dopasowania — dziś go nie ma, bo
     `saveNavTree` generuje wszystkie `nav_items.id` od nowa przy każdym zapisie.
   - `kicker text` — treść ośmiu tras statycznych ma dziś **trzy** pola nagłówka
     (`title`, `lead`, `kicker`). `lead → intro` jest oczywiste, `kicker` nie ma
     odpowiednika i cicho zniknie.
5. **`on conflict (full_path) do nothing` z §5.4 nie zadziała.** Jedyny unikalny
   indeks na `full_path` jest **częściowy**, a Postgres nie wywnioskuje celu
   `ON CONFLICT` z indeksu częściowego bez powtórzenia predykatu → błąd 42P10.
   **Poprawka:** dla stron `on conflict (full_path) where kind='page' and
   deleted_at is null do nothing`; dla nagłówków i odnośników `on conflict
   (migrated_from)`. Dopisać zapytanie kontrolne na duplikaty nagłówków:
   `select parent_id, menu_label, count(*) from pages where kind in
   ('header','link') group by 1,2 having count(*) > 1`.
6. **Po migracji znika fallback menu z kodu.** Dziś `getNavTree` oddaje
   `DEFAULT_NAV` w **czterech** sytuacjach (brak konfiguracji, zero wierszy, puste
   drzewo, błąd/timeout 6 s), a `Navbar` ma jeszcze własny fallback po stronie
   klienta. Po etapach 3 i 4 z bazy pochodzą nie tylko etykiety, ale **całe drzewo
   adresów** — jedna brakująca zmienna środowiskowa gasi menu w layoucie i daje 404
   na wszystkich stronach z catch-alla. Dzisiejszy incydent `PGRST303` przy zimnym
   starcie pokazuje, że to nie jest hipotetyczne.
   **Poprawka:** źródłem fallbacku nie może być `DEFAULT_NAV` (przestanie
   odzwierciedlać drzewo) — ma być statyczny zrzut drzewa w repo, generowany tym
   samym skryptem co golden master.
7. **`pages_full_path_key` to zmiana zachowania, nie odtworzenie.**
   `custom_pages_slug_key` jest indeksem **pełnym**, nowy jest **częściowy**
   (`where deleted_at is null`): slug strony w koszu przestaje być zajęty. Dotyczy
   realnych danych — `/test`, `/ee`, `/eee` są dziś zarezerwowane przez kosz.
   Udokumentować jako świadomą zmianę; etap 5 musi sprawdzać kolizje `full_path`
   przy przywracaniu z kosza.
8. **Idempotencja pliku SQL.** `03-drzewo-stron.sql` to **pierwszy** trigger i
   pierwsza funkcja plpgsql w tej bazie (w `setup.sql` i `02-kosz-i-historia.sql`
   są wyłącznie anonimowe bloki `do $$`). `if not exists` tu nie wystarczy — użyć
   `create or replace function` + `drop trigger if exists` / `create trigger`,
   inaczej drugie uruchomienie przerwie się błędem 42710.

### 3.2 Poprawki po etapach

**Etap 0** — przeszacować z 0,5 d, rozbić na 0a (skrypt) i 0b (rozstrzygnięcia).
`app/not-found.tsx` **przenieść do etapu 4**: w etapie 0 nie wolno dotykać
produkcji, bo własna strona 404 zmienia treść odpowiedzi dla każdego martwego
adresu, czyli zmienia to, co skrypt właśnie zapisał jako punkt odniesienia.

**Golden master musi objąć 12 źródeł adresów** (spec zna 4):
1. `app/sitemap.ts:12-24` — 11 adresów wpisanych na stałe.
2. `app/sitemap.ts:26-30` — 10 artykułów z `data/articles/*.ts`.
3. `app/sitemap.ts:42-50` — `getNews()` → `/aktualnosci/<slug>`. Te adresy zostają
   **poza** drzewem `pages` (§2.8), więc zapytanie akceptacyjne etapu 2 musi je
   jawnie wykluczyć — inaczej kryterium nigdy nie będzie puste.
4. `app/sitemap.ts:53-62` — `listCustomPages()` → `/<slug>`. Dziś zero.
5. `nav_items` — 19 hrefów, zapisane **po** `getNavTree()`, czyli po
   `normalizeNavTree`. Osobno zapisać surowe drzewo i udokumentować, że na
   dzisiejszych danych oba są identyczne.
6. `lib/editablePages.ts` — **8** tras (spec mówi 7), w tym `/`. Zapisać **pary**
   `(slug, route)`, nie same adresy: to jedyne miejsce z tym mapowaniem.
7. `next.config.ts:24-40` — dwa przekierowania z **realnymi** kodami:
   `/organizacja/zalozyciel-i-wsko` → **308** (`permanent:true`),
   `/cennik` → **307** (`permanent:false`). Spec zakłada 302 — błędnie, a komentarz
   w kodzie (`:33-34`) też mówi 302.
8. Adresy, które **muszą zostać 404**: `/zajecia` oraz `/test`, `/ee`, `/eee`.
   Bez tych wpisów nikt nie zauważy, że migracja **dodała** adres — a dodanie też
   jest zmianą wobec §5.1.
9. Route handlery: `/downloads/<nazwa>` (są w stopce i u ludzi) oraz
   `/api/schedule/<group>/calendar.ics`.
10. Trasy metadanych: `/sitemap.xml`, `/robots.txt`, `/icon` — `icon` **brakuje**
    w `RESERVED_SLUGS`, więc da się dziś utworzyć kolidującą podstronę.
11. 19 adresów panelu `/admin/*` — do sprawdzenia, że etapy 5 i 8 nie wywaliły ekranu.
12. Adresy w stopce (`lib/footerTypes.ts:43-87` + `site_settings` klucz `footer`) —
    drugie miejsce, gdzie redaktor wpisuje adresy z palca.

**Dla każdego adresu zapisać** (sam status nie wystarczy): kod HTTP bez podążania
za przekierowaniem + nagłówek `Location` dla 3xx; `<link rel="canonical">`
(12 tras ma, **trzy listingi nie mają**); `<title>` i meta description; liczbę
bloków / długość tekstu w głównym kontenerze (to jedyna asercja, która wyłapie
cichą utratę 13 131 znaków w etapie 7); obecność galerii Cloudinary, spisu treści,
odnośników poprzedni/następny i okruszka na podstronach tematycznych.
**Sitemapa:** porównywać sam posortowany zbiór `url` + `priority` +
`changeFrequency`; `lastModified` pominąć albo normalizować, bo `sitemap.ts:10,35`
wstawia `new Date()` — inaczej różnica nigdy nie będzie pusta i ktoś wyłączy
porównanie sitemapy, czyli zabierze siatkę bezpieczeństwa.

**Dwa testy regresji do wpisania już teraz** (oba dziś odtwarzalne, oba spec ma
naprawić): (a) szkic z zaznaczonym „Pokaż w menu górnym" **nie** pojawia się w
menu — dziś pojawia się i prowadzi do 404, bo `syncNavItem` nie zna kolumny
`published`, a nowa podstrona startuje z `initialInMenu={true}`; to najpewniej
mechanizm, który wyprodukował zgłoszonego „Test"; (b) pozycji menu z href
nieodpowiadającym żadnej trasie nie da się zapisać — dziś href to wolne pole
tekstowe bez walidacji.

**Etap 2 (backfill)** — **5 źródeł, nie 4**: dochodzi `EDITABLE_PAGES` (8 wpisów)
→ węzły `kind='page'`, `source='route'`, `route` i `full_path` = `wpis.route`,
`content_key = 'page:' + wpis.slug`. Bez tego `/` i `/kontakt` **nie dostają
węzła** (nie mają wiersza w `nav_items`), a własne kryterium odbioru etapu 2
nigdy nie będzie puste. Dalej:
- `position` **wyłącznie** z `nav_items.position`, nigdy z `DEFAULT_NAV` —
  kolejność top-level w bazie **różni się** od kodu (baza: AKTUALNOŚCI, O SHORINJI,
  ZAJĘCIA, PROGRAM NAUCZANIA, ORGANIZACJA, BUDDYZM, GALERIA; kod ma ZAJĘCIA
  pierwsze). To realna decyzja redaktora, zasianie z kodu cofnęłoby ją bez śladu.
- Usunąć regułę „węzły spoza menu dostają `in_menu=false`" w brzmieniu ze spec:
  zbiór „artykułów poza `DEFAULT_NAV`" jest **pusty**, wszystkie 10 jest w
  `nav_items`. Dosłowne wykonanie usunęłoby 10 pozycji z menu.
- Skrypt musi wiedzieć, że 10 wierszy `nav_items` i 10 wpisów z `data/articles` to
  **ten sam** zbiór adresów, inaczej wyprodukuje 10 duplikatów. Ustalić
  pierwszeństwo dla tytułu: `menu_label` z `nav_items` (wersaliki „MEDYTACJA"),
  `title` z `article_overrides`, fallback `data/articles` („Medytacja").
- `visible → in_menu`, **nigdy** `→ published` (`visible=false` ukrywa dziś pozycję
  MENU, nie stronę).
- Filtr kluczy: `key like 'page:%'` — **zakotwiczony**. W bazie są dwa klucze kopii
  zapasowych (`kopia:page:cennik-przed-migracja-konta`,
  `kopia:page:kontakt-przed-migracja`); niezakotwiczony wzorzec zassie je jako
  strony. **Nie sprzątać ich** — to jedyne kopie treści sprzed dwóch migracji.
- Czwarta reguła mapowania dla pozycji menu z href nieznanym żadnemu źródłu:
  `kind='link'` z `external_url` albo raport „do decyzji redaktora" na konsolę.
  Nigdy `source='route'` (CHECK odrzuci) i nigdy ciche pominięcie.

**Etap 3** — podzielić:
- **3a**: odczyt z `pages` za flagą + dwuzapis. Dwuzapis robi **upsert po
  `migrated_from`**, nigdy insert-then-delete: dzisiejsze `saveNavTree` wstawia
  komplet nowych wierszy **przed** usunięciem starych (`navActions.ts:57-121`),
  więc przez chwilę istnieją dwa komplety — wzorzec niekompatybilny z indeksem
  unikalnym na adres. Rozważyć odwrócenie kierunku (panel zapisuje do `pages`,
  `nav_items` jest odtwarzany) — to usuwa problem klucza dopasowania całkowicie.
- **3b**: `Navbar` od zera. W **całym** `components/` nie ma ani jednego
  `aria-expanded`, `aria-controls`, `onKeyDown`, obsługi Escape, ani jednego
  `<ul>`/`<li>`; jedyny `<nav>` to `Navbar.tsx:54` (tylko desktop), menu mobilne
  siedzi w `<aside>`; dropdown na desktopie otwiera **czysty CSS** (`group-hover`)
  bez stanu w Reakcie, a `globals.css:21` zdejmuje `@media (hover:hover)`, więc
  reaguje też na dotyku; trigger dla pozycji bez href to martwy `<button>` bez
  `onClick`; mobilny dropdown jest **zawsze rozwinięty**. To wymiana obu widoków,
  nie rozbudowa — mieszanie jej ze zmianą źródła danych sprawia, że rozjazd w
  diffie jest nie do przypisania.
  **Uwaga krytyczna do 3b:** `Navbar` jest właścicielem globalnej zmiennej
  layoutu `--nav-h` (`Navbar.tsx:34-43`, `ResizeObserver` na **zewnętrznym**
  `<nav ref>`). Konsumenci: `.page-shell` (16 użyć), `scroll-padding-top`,
  `VerticalKanji`. Jeśli `ref` wyląduje na elemencie wewnętrznym albo na `<ul>`,
  treść wjedzie pod przyklejone menu **na wszystkich trasach**, a skoki po
  kotwicach spisu treści zaczną lądować pod navbarem. Golden master ze statusów
  tego nie zobaczy — dopisać asercję, że po renderze `--nav-h` ≠ `200px`.
- Twardy warunek w budowaniu drzewa: **węzeł bez adresu i bez widocznych dzieci
  nie trafia do drzewa menu**. Bez tego `Navbar.tsx:148` renderuje
  `<Link href={undefined}>` i wywala **każdą** trasę, bo menu siedzi w layoucie.
  Nowy model wprost produkuje ten stan (`pages_header_visible_chk` wymusza
  `in_menu=true` dla nagłówka, a CHECK nie ogranicza nagłówków do poziomu 0).
- Nowa ścieżka odczytu musi odtworzyć **cztery** gałęzie fallbacku.

**Etap 4** —
- **Nie usuwać** reguły `/organizacja/zalozyciel-i-wsko` z `next.config.ts`.
  Ten adres nigdy nie dotrze do catch-alla: `app/organizacja/[slug]/page.tsx:41`
  dopasuje go pierwszy i zrobi `notFound()`. Usunięcie zamienia działające 308 w
  twarde 404 na zaindeksowanym adresie. Do `redirects` przenosi się **wyłącznie**
  `/cennik` (307).
- Dołożyć obsługę `redirects` w gałęzi `notFound()` **dokładnie czterech** tras
  `[slug]`: `o-shorinji`, `organizacja`, `buddyzm`, `aktualnosci`. Catch-all blokuje
  **dynamiczne dziecko `[slug]`**, nie statyczny prefiks — `/zajecia/*`,
  `/program-nauczania/*` i `/kontakt/*` dostają przekierowania za darmo
  (zmierzone: `/program-nauczania/uczniowskie/6-kyu` → 200 z catch-alla, czyli
  flagowa funkcja specu działa). Middleware nadal odrzucone.
- **Skasowanej albo przemianowanej aktualności nie da się przekierować, nigdy** —
  `/aktualnosci/nieistniejacy` → 404 bez dotknięcia catch-alla, a §2.8 świadomie
  zostawia aktualności poza drzewem. Zapisać jako świadome ograniczenie albo
  naprawić tą samą zmianą.
- Catch-all musi odróżniać **„brak wiersza" od „błędu odczytu"**: przy błędzie albo
  timeoucie rzucić wyjątek (500), **nigdy** `notFound()`. Dzisiejszy wzorzec
  (`customPages.ts:47-52` → `app/[slug]/page.tsx:30`) zamienia timeout Supabase w
  404 cache'owany przez ISR na 300 s; po etapie 4 objęłoby to całe drzewo treści,
  a taki 404 może zostać zaindeksowany.
- `select` po `full_path` z `limit 1` **i** z obsługą `error`, nie tylko `data`.
- **Wczesny guard w catch-allu**: zmierzone — `/admin/typo` → **200 z catch-alla**,
  `/api/foo` → **200 z catch-alla**. Dziś oba to 404. Po etapie 4 każda literówka w
  adresie panelu wyrenderuje **publiczny** layout i wykona dwa zapytania do bazy;
  to samo robi każde 404 od skanera (`/wp-login.php`, `/.env`) na nieograniczonym
  zbiorze ścieżek, na uśpionym projekcie, z `revalidate=300` na każdym śmieciu.
  Zarezerwowany pierwszy segment albo segment niepasujący do `^[a-z0-9-]+$` →
  `notFound()` **przed** jakimkolwiek zapytaniem.
- Catch-all dostaje **`generateStaticParams`** czytające `pages` na buildzie.
  Dziś `/buddyzm/[slug]`, `/o-shorinji/[slug]`, `/organizacja/[slug]` są `● SSG`
  z `Revalidate 1h / Expire 1y` — HTML leży w artefakcie deployu, więc przy awarii
  bazy Netlify podaje kompletną, przestarzałą stronę. Catch-all bez
  `generateStaticParams` jest `ƒ Dynamic`: pierwsze żądanie po **każdym** deployu
  to zimny SSR do uśpionego Supabase. To realny mechanizm odpalania poprzedniego
  punktu — nie raz na rok, a po każdym wdrożeniu.
- `app/sitemap.ts` dostaje `export const revalidate = 300` + rewalidację w akcjach
  zapisu drzewa. Bez tego nowa podstrona nie pojawi się w `sitemap.xml` do
  następnego deployu, czyli jeden z czterech obiecanych problemów zostaje nierozwiązany.
- `app/robots.ts` nie wyklucza **niczego** (`allow '/'`, zero `disallow`), a
  `app/layout.tsx:55-58` daje `index:true` site-wide. Dołożyć `disallow` dla
  `/admin` i upewnić się, że `published=false` nie produkuje strony indeksowalnej.
- `RESERVED_SLUGS`: walidacja sluga musi odpytywać **`redirects.old_path`** obok
  listy — inaczej nic nie broni utworzyć strony pod starym, zaindeksowanym
  przekierowaniem. Listę jednocześnie **okroić** (do pozycji bez węzła) i
  **uzupełnić** o `icon` oraz `favicon.ico`.

**Etap 5** —
- Przeformułować uzasadnienie: `CustomPageEditor.tsx:194-211` ma **oba** checkboxy
  („Opublikowana", „Pokaż w menu górnym") i szkice działają end-to-end. To
  przeniesienie dwóch przełączników, które redaktor **już zna**, plus dołożenie
  trzeciego (`in_menu` dla pozycji menu, którego `NavEditor` nie renderuje).
  Nie projektować od zera czegoś, co działa.
- Podłączyć **`BlockEditor`** (984 linie, 16-17 typów bloków, czysty kontrakt
  `value`/`onChange`, pasuje do `pages.blocks` 1:1), **nie** `PageBlocksEditor` —
  ten jest kompletnym ekranem przywiązanym do `site_settings` przez
  `savePageContent`, z własnym paskiem zapisu.
- Doliczyć ekran **kosza drzewa stron i historię wersji** — oba mechanizmy istnieją
  w bazie i **nie istnieją w panelu**: `listTrashedCustomPages` / `restoreCustomPage`
  / `purgeCustomPage` nie są nigdzie importowane, `TrashSection` podłączony tylko do
  aktualności, kontrakt się nie zgadza (`{pages}` vs `{items}`), więc
  `oproznijStaryKosz("custom_pages")` nigdy się nie wykonuje. `content_versions`
  istnieje, ma **0 wierszy** i kolumnę `entity_key`; `zapiszWersje` wołane wyłącznie
  dla aktualności, `historia()` bez ani jednego konsumenta. **Historia nie jest
  drogą odwrotu.** Dobra wiadomość: `entity_type='page_node'` nie wymaga DDL.
- Akcja zmieniająca `full_path` **liczy wystąpienia starej ścieżki w
  `pages.blocks` i w `site_settings`** (stopka) i pokazuje je redaktorowi obok
  liczby dotkniętych adresów. `components/NewsBlocks.tsx:36-51` renderuje
  `[etykieta](/adres)` z treści jako zwykły `<a href>` — bez walidacji, bez lintera,
  bez testu. Istniejące wystąpienia: `data/articles/organizacja.ts:26`,
  `data/articles/buddyzm.ts:111`, `lib/editablePages.ts:32,35,41`.
  `redirects` ich nie uratuje pod prefiksami statycznymi.
- Panel **blokuje** kombinację `in_menu=true` + `published=false` przy zapisie
  z wyjaśnieniem, a nie tylko filtruje ją przy odczycie.
- Jedno zdanie o dostępie: `requireUser()` sprawdza tylko, czy ktoś jest
  zalogowany, bez allowlisty. Po scaleniu tabel ta sama dziura przestaje dotyczyć
  etykiet menu i zaczyna dotyczyć treści stron oraz struktury adresów. Nie do
  naprawy w tej migracji, ale nikt nie może uznać, że nowy panel domyka temat.

**Etap 6** — `alternates.canonical` z `node.full_path` dla trzech listingów, które
go dziś nie mają (`app/o-shorinji/page.tsx:11-14`, `organizacja`, `buddyzm`).
Te trzy pliki mają **statyczny** `export const metadata`, więc wpięcie odczytu z
bazy wymaga zamiany na `generateMetadata` — „po kilka linii każdy" ze spec tego nie
obejmuje. Zapisać jako oczekiwany skutek: lista w panelu
(`app/admin/(panel)/strony/page.tsx:110`) pokazuje dziś tytuły artykułów **z kodu**,
nie z nadpisań, więc redaktor szuka strony po nazwie, której sam nie używa.

**Etap 7** — przeszacować z 1 d, opisać jako **przepisanie szablonu**, nie
przeniesienie treści:
- Backfill woła **`overrideToBlocks(wiersz)`**, nigdy `wiersz.blocks`.
  W bazie jest `buddyzm/medytacja` z **`body_md` o długości 13 131 znaków** i
  `blocks = NULL` — największy pojedynczy artefakt redakcyjny w całej bazie.
  Kopiowanie samej kolumny `blocks` **cicho go wyzeruje**, a wyjdzie to dopiero po
  `drop table article_overrides`, kiedy źródła już nie ma. Zapytanie kontrolne
  przed jakimkolwiek `drop`: `select topic, slug from article_overrides where
  blocks is null and body_md is not null`.
- Trasa catch-all musi odtworzyć **cztery mechanizmy** z `components/ArticlePage.tsx`:
  galerię z Cloudinary (folder z kolumny `cloudinary_folder`), spis treści z bloków
  `heading`, nawigację poprzedni/następny (zapytanie o rodzeństwo po
  `(parent_id, position)` — przepis z §5.6 przewiduje jedno `SELECT` po `full_path`)
  oraz `canonical`.
- **Etap 7 przenosi 10 podstron tematycznych z grupy „zawsze mają treść" do grupy
  „puste bez bazy".** Dziś `lib/articleContent.ts:139` daje
  `overrideToBlocks(ov) ?? sectionsToBlocks(base.sections)`; przy zerowym env
  `/o-shorinji/wprowadzenie` oddaje 64 KB treści, `/buddyzm/medytacja` 85 KB.
  Zdanie ze §6.6, że `data/articles/*.ts` „zostaje wyłącznie jako
  `content-fallback`", jest fikcją — po usunięciu tras **nikt tego pliku nie czyta**.
  Albo catch-all jawnie implementuje odczyt bazowy (mapowanie `full_path` → wpis
  w `data/articles`), albo zapisujemy, że migracja świadomie likwiduje ostatni
  fallback treści.
- Usunąć `actions/migrateActions.ts` (`migrateAllContent`). Nie ma w repo ani
  jednego konsumenta, a robi to samo co nowy skrypt migracji, tylko do **starych**
  tabel — zostawiona po etapie 8 jest miną, która cofnie migrację treści.
- Sama treść jest bezpieczna: publiczna strona **już dziś** renderuje
  `sectionsToBlocks(base.sections)`, nigdy surowych sekcji, więc przepisanie do
  `pages.blocks` nie zmieni ani piksela.

**Etap 8** — lista contract ma **6 miejsc czytających `nav_items`**, nie 3, i ~10
server actions dotykających tabel skazanych na `drop`. Spec pomija:
- `app/admin/(panel)/wlasne/[id]/page.tsx:22-27` — `select nav_items` po href dla
  checkboxa, `.maybeSingle()` bez obsługi `error`, jedyne czytanie poza akcją z
  `requireUser`. `drop table` **wywali edycję każdej własnej podstrony**, a błąd
  wyjdzie dopiero w runtime, bo `maybeSingle` zwraca `{data:null}` i checkbox po
  cichu przestanie odzwierciedlać stan.
- `app/admin/(panel)/nawigacja/page.tsx:5-30` — **druga, niezależna** implementacja
  składania drzewa ze ścieżką awaryjną na `getNavTree`.
- `app/admin/(panel)/edit/[topic]/[slug]/` + `EditorForm` + `saveTopicArticle`
  (`app/admin/actions.ts:9-33`). Po `drop table article_overrides` ten ekran nie
  przestanie się renderować (dane bazowe ma z kodu), tylko będzie zapisywać w
  pustkę — najgorszy możliwy wariant dla redaktora, który właśnie przepisał tekst.
- Usunąć `normalizeNavTree` (`navigation.ts:17-42`) razem ze starą ścieżką i
  przenieść regułę `/cennik` → `/zajecia/cennik` do `redirects` jako `manual` 307.
- Poprawić **kłamliwe komentarze** w `supabase/setup.sql:426-439`, które twierdzą,
  że zapis menu to „delete-all + reinsert". Kod robi odwrotnie od dawna — i to z
  tych komentarzy spec wziął fałszywą tezę.

### 3.3 Nowe zakazy do §8

- **Nie używać `blocksToSections`** nigdzie w migracji (`blockConvert.ts:70-127`):
  zwija `callout` w `quote` i wyrzuca `gallery`/`table`/`links`/`video`/`download`/
  `person`/`bank`/`kontakt` przez `default: break`. Nie ma w repo ani jednego
  wołania. W migracji wyłącznie kierunek `sections → blocks`.
- **Nie zamieniać błędu odczytu na `notFound()`** w żadnej trasie czytającej `pages`.
- **Nie zakładać, że `content_versions` i kosz podstron są drogą odwrotu** — oba
  istnieją w bazie i nie istnieją w panelu.
- Usunąć ostrzeżenie „nie zostawiać `saveNavTree` w wersji delete-then-insert"
  jako opis stanu obecnego — kod jest **już** naprawiony (insert-then-delete ze
  ścieżką wycofania, `navActions.ts:57-121`, `wycofaj()` na `:71-74`). Zalecenie
  (punktowe `UPDATE`) zostaje, zmienia się uzasadnienie: dzisiejszy wzorzec trzyma
  dwa komplety wierszy jednocześnie, więc jest niekompatybilny z indeksem
  unikalnym na adres.
- Poprawić §1 i §5.4: **martwy link „Test" już nie istnieje**. Wiersz z
  `href=/test` usunął `customPageActions.ts:153-156` przy przeniesieniu strony do
  kosza; wszystkie 19 hrefów w `nav_items` prowadzi do realnej trasy. Mechanizm
  awarii jest nadal w pełni realny i nienaprawiony, ale wdrażający, który zacznie
  od „pokażcie mi ten martwy link", nie znajdzie go i może uznać cały spec za
  nieaktualny.
- Zapisać, że w repo **nie ma ani jednego `revalidateTag` ani `unstable_cache`**
  (0 trafień). Całe unieważnianie stoi na `revalidatePath` z literałami, więc
  „rewalidacja poddrzewa" z §5.9 pkt 6 nie ma na czym stanąć: akcja musi wyliczyć
  stare i nowe ścieżki węzła **oraz każdego potomka**.
- Zapisać, że **`ukośnik końcowy i wielkość liter nie są pułapką**: `/kontakt/` →
  308 na `/kontakt` (Next normalizuje przed routingiem), `/Kontakt` → 404. Czyli
  `full_path` nigdy nie potrzebuje wariantu z ukośnikiem, a `redirects.old_path`
  można trzymać bez niego.
- `layout text check (layout in ('auto','article','listing'))` **nie wyrazi ośmiu
  tras statycznych** — tylko dwie z nich (`/zajecia/cennik`, `/program-nauczania`)
  są czystym „nagłówek + bloki". `/kontakt` ma formularz **pomiędzy** nagłówkiem a
  treścią, `/zajecia/dorosli` i `/dzieci` mają grafik + formularz + mapę + trzy
  kafelki CTA, `/` ma pasek aktualności w siatce 3/4+1/4, `/galeria` i
  `/aktualnosci` mają własne komponenty. Docelowy stan z §2.8 po cichu gubi
  formularz, mapę i grafik. Albo stają się typami bloków, albo `source='route'`
  jest dla tych sześciu **trwały** — i to trzeba zapisać jako decyzję.

### 3.4 Stan bazy — pomiar 2026-08-12 (notatka z 26.07 nieaktualna w 5 z 6 punktów)

| Tabela | Stan realny | Notatka mówiła |
|---|---|---|
| `nav_items` | **20** wierszy, 7 top-level / 13 dzieci, jeden bez href (ZAJĘCIA), zero ukrytych, zero duplikatów href, zero sierot, **zero martwych linków**. Brak kolumn `deleted_at`/`created_at`/`updated_at` | 19 |
| `custom_pages` | **3** wiersze (`test`, `ee`, `eee`), **wszystkie w koszu** (`deleted_at` 2026-08-10), zero bloków. Żywych własnych podstron: **ZERO** | 0 |
| `article_overrides` | **5** wierszy: `buddyzm/medytacja` (**body_md 13 131 znaków, blocks NULL**), `buddyzm/podstawy` (21 bloków), `o-shorinji/cele-i-wartosci` (32), `o-shorinji/wprowadzenie` (19), `organizacja/egzaminatorzy` (2 × `person`) | 4 |
| `site_settings` | **14** kluczy: 8 × `page:*` (pokrywają się 1:1 z `EDITABLE_PAGES`), 2 klucze kopii zapasowych, `footer`, `galeria:okladki`, `organization`, `schedule` | 4 |
| `articles` | 1 wiersz, opublikowany | 1 |
| `content_versions` | istnieje, **0 wierszy**, kolumna `entity_key` | — |
| `pages`, `redirects` | **nie istnieją** (PGRST205) | — |

**Kosz opróżnia się sam po 30 dniach** (`DNI_W_KOSZU`, `oproznijStaryKosz` wołane
przy wejściu na listę kosza) — te trzy wiersze wyparują **około 2026-09-09**, czyli
prawdopodobnie w trakcie wdrożenia. Liczba wierszy do backfillu zmieni się bez
niczyjej decyzji między golden masterem a migracją. Zapisać w nagłówku golden
mastera jako znaną, z góry wyjaśnioną różnicę.

---

## 4. Defekty niezależne od migracji (do osobnej decyzji)

1. **`NEXT_PUBLIC_SITE_URL` nie jest ustawiony** w `.env.local`, więc `lib/site.ts:9-11`
   spada na literał `https://shorinji-kempo.netlify.app`. Zmierzone lokalnie:
   22 × `<loc>`, 12 × canonical, `og:url`, JSON-LD `@id` i `robots.txt` wskazują na
   tę domenę. **Skutek dla golden mastera:** jeśli produkcja ma tę zmienną ustawioną
   inaczej, snapshot zrobiony lokalnie różni się **w każdym wpisie** — skrypt musi
   albo iść z produkcyjnym env, albo normalizować origin i zapisać tę decyzję
   w nagłówku pliku.
2. **`PGRST303 „JWT issued at future"` przy zimnym starcie.** Zaobserwowane dziś:
   pierwszy render po `npm run dev` — `getNavTree`, `getSchedule` i `getNews`
   spadły na fallback z kodu; kolejne żądania czytają bazę bez zarzutu, zegary
   lokalny i serwera zgodne co do sekundy, endpoint 200. Przelotne, prawdopodobnie
   synchronizacja zegara po stronie uśpionego projektu. **Dlaczego to ważne:**
   gdyby taki błąd trafił w Netlify w chwili buildu albo pierwszego renderu, wynik
   wpadłby do cache ISR na 300 s (a na `/buddyzm` na 3600 s). Dokładnie po to jest
   dzisiejsza poprawka fallbacku.
3. **`app/galeria/page.tsx` nie ma `export const revalidate`** — jest w pełni
   statyczna i woła Cloudinary **na buildzie**. Potknięcie Cloudinary w trakcie
   buildu **na stałe** (do następnego deployu) wysyła odwiedzającym komunikat
   deweloperski: „Nie znaleziono folderów w chmurze lub wystąpił błąd kluczy API…".
   Żywy defekt na zaindeksowanym adresie, 200 OK.
4. **`content-fallback/articles.json` karmi sitemapę** (`app/sitemap.ts:42` →
   `getNews()` → `lib/news.ts:38`): usunięta albo wycofana aktualność **wraca** do
   `sitemap.xml` przy każdym nieudanym odczycie bazy. Moment na decyzję przy
   przepisywaniu sitemapy (§5.9 pkt 5).
5. **`next/font/google`** (`app/layout.tsx:12`) — build pobiera fonty z sieci, więc
   odtworzenie golden mastera na maszynie bez sieci wywali się na buildzie, nie na
   snapshocie.
6. Brakujące `alternates.canonical` na `program-nauczania`, `cennik`,
   `zajecia/dorosli`, `zajecia/dzieci` i trzech listingach.
7. Sesja panelu wygasa z `Invalid Refresh Token: Refresh Token Not Found` →
   `/admin` przekierowuje na `/admin/login?powod=wygaslo`. Normalne, nie defekt.

---

## 5. Uwagi operacyjne

- **Notatki projektu leżą poza repo**: `C:\Workspace\Kempo\shorinji-notes\`
  (`INDEX.md`, `WORKLOG.md`, `architecture.md`, `modules.md`, `gotchas-security.md`,
  `working-agreement.md`, `plan-pozostale-zadania-2026-08-06.md`,
  `plan-scalenie-menu-i-stron-ogolny-2026-08-12.md`, PDF decyzyjny, backupy bazy).
  **Na nowym komputerze ich nie będzie** — jeśli mają jechać, trzeba je skopiować
  osobno. Ten plik jest po to, żeby dało się pracować bez nich.
- `master` = `origin/master`, drzewo czyste przed tą sesją, nic niewypchniętego.
- Weryfikacja zmian w tym projekcie: `npx tsc --noEmit` + `npm run lint` +
  `npm run build`, potem `curl` na uruchomiony serwer z **precyzyjnymi** asercjami.
- Po zmianach w `globals.css` albo `next.config.ts` Turbopack na Windows trzyma
  stary skompilowany CSS — usunąć `.next` przed restartem, sam restart nie wystarcza.
- Przebudowa menu domyka punkty **1, 3 i 11** z
  `plan-pozostale-zadania-2026-08-06.md` (nawigacja 3-poziomowa, zarządzanie
  Programem nauczania, scalenie zakładek „Podstrony" i „Nawigacja") i odblokowuje
  punkty **2, 5, 6** (podstrony wg oryginału — 8 dla „O Shorinji", 12 dla
  „Buddyzmu", treść już pobrana w `shorinji-notes/original-content/`, 24 strony;
  3 nowe podstrony Organizacji; FAQ jako subitem ZAJĘĆ). **Kolejność:** te nowe
  podstrony wsiać **już w nowym modelu**, nie w starym — inaczej ta sama robota
  poszłaby dwa razy, a backfill musiałby objąć dane, których dziś nie ma.
