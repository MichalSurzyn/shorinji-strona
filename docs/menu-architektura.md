# Propozycja architektury: połączone drzewo stron i menu

Dokument wykonawczy. Każda decyzja ma uzasadnienie z researchu (R) albo z audytu kodu (A) z podaniem pliku i linii.

---

## 1. Rekomendacja w pięciu zdaniach

Zastępujemy `nav_items` i `custom_pages` **jedną tabelą `pages`** — adjacency list (`parent_id`), w której ten sam wiersz jest jednocześnie węzłem drzewa treści, źródłem adresu URL i pozycją menu, bo tylko scalenie usuwa przyczynę martwego linku „Test" na poziomie modelu danych, a nie na poziomie walidacji (R: „drzewo stron i menu powinny być JEDNYM modelem danych"; A: `syncNavItem` zna wyłącznie `parent_id IS NULL`, `actions/customPageActions.ts:33-38`). Kolumna `kind` (`page` / `link` / `header`) rozstrzyga jawnie, czym pozycja jest, a kolumna `source` (`db` / `route`) odróżnia stronę renderowaną z bazy od węzła reprezentującego istniejącą trasę w kodzie (`/kontakt`, `/zajecia/cennik`), dzięki czemu w drzewie nie powstaje ani jedna strona-placeholder. Struktura dopuszcza trzy poziomy, ale **rozwijane menu renderuje tylko dwa** — trzeci poziom wychodzi na stronę-hub z kafelkami, dokładnie jak zaproponował właściciel i jak zaleca NN/g. Adresy rozwiązuje jedna trasa catch-all `app/[...sciezka]/page.tsx` po denormalizowanej kolumnie `full_path`, a każda zmiana ścieżki zapisuje wiersz w tabeli `redirects` obsługiwanej w kodzie aplikacji, nie w `next.config.ts` (A: `next.config.ts:24-42` wymaga redeploya, którego instruktor nie zrobi). Wdrożenie idzie w ośmiu odwracalnych etapach wzorcem expand → migrate → contract, z zrzutem golden master przed pierwszą zmianą i z zasadą: **migracja nie zmienia ani jednego istniejącego adresu**.

---

## 2. Model danych

### 2.1 Wybór reprezentacji drzewa

Adjacency list (`parent_id` + `position`), całe drzewo czytane jednym `SELECT` i składane w pamięci w Node.

Uzasadnienie: dziś realnych węzłów jest około 28 (7 pozycji top-level + 10 podpunktów z `DEFAULT_NAV`, `lib/navTypes.ts:22-62`, 10 artykułów tematycznych z `data/articles/*.ts`, kilka własnych podstron). Przy tej skali ltree, nested sets i closure table dokładają maszynerię bez zysku, a utrudniają ręczną poprawkę w SQL Editorze przy awarii (R: „nie sięgać po ltree, nested sets ani closure table przy tej skali"). Przeniesienie węzła to jeden `UPDATE` jednego wiersza. Rekurencyjny CTE zostaje wyłącznie jako narzędzie walidacji przy zapisie (wykrywanie pętli), nie jako mechanizm renderowania menu.

`full_path` jest **denormalizacją wtórną**, przeliczaną triggerem, nigdy źródłem prawdy o strukturze (R: „nigdy jako główne źródło prawdy"). Istnieje po to, żeby trasa catch-all rozwiązała adres jednym zapytaniem, a `sitemap.ts` nie musiał składać ścieżek w kodzie.

### 2.2 Tabela `public.pages`

```sql
create table public.pages (
  id           uuid        primary key default gen_random_uuid(),
  parent_id    uuid        references public.pages (id) on delete restrict,

  -- CZYM JEST TA POZYCJA (jawny typ, widoczny w formularzu panelu)
  kind         text        not null default 'page'
                           check (kind in ('page', 'link', 'header')),

  -- SKĄD BIERZE SIĘ TREŚĆ STRONY
  --   'db'    -> treść w kolumnach title/intro/blocks tego wiersza
  --   'route' -> stronę renderuje istniejąca trasa w kodzie (route),
  --              węzeł istnieje dla struktury, menu, okruszków i sitemapy
  source       text        not null default 'db'
                           check (source in ('db', 'route')),
  route        text,       -- np. '/zajecia/cennik'; wypełnione tylko dla source='route'

  -- ADRES
  slug         text,       -- ostatni segment; NULL dla link/header
  full_path    text,       -- '/program-nauczania/uczniowskie/6-kyu'; liczone triggerem
  external_url text,       -- tylko dla kind='link'

  -- TREŚĆ (dla kind='page' and source='db')
  title        text        not null,          -- H1 strony
  intro        text,                          -- lead pod H1 ORAZ opis na kafelku u rodzica
  blocks       jsonb       not null default '[]'::jsonb,
  layout       text        not null default 'auto'
                           check (layout in ('auto', 'article', 'listing')),

  -- MENU
  menu_label   text,       -- etykieta w menu; NULL = użyj title
  in_menu      boolean     not null default true,

  -- STAN
  published    boolean     not null default true,
  depth        smallint    not null default 0 check (depth between 0 and 2),
  "position"   integer     not null,

  -- ŚLAD (spójne z supabase/02-kosz-i-historia.sql)
  deleted_at   timestamptz,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint pages_kind_fields_chk check (
       (kind = 'page'   and slug is not null and external_url is null)
    or (kind = 'link'   and slug is null     and external_url is not null)
    or (kind = 'header' and slug is null     and external_url is null)
  ),
  constraint pages_source_chk check (
       (source = 'db'    and route is null)
    or (source = 'route' and route is not null and kind = 'page')
  ),
  constraint pages_slug_format_chk check (slug is null or slug ~ '^[a-z0-9-]+$'),
  constraint pages_title_not_blank_chk check (btrim(title) <> ''),
  constraint pages_header_visible_chk check (kind <> 'header' or in_menu),
  constraint pages_external_url_chk check (
    external_url is null or external_url ~ '^https?://'
  )
);
```

Indeksy:

```sql
-- Adres jest unikalny wśród żywych stron. To jedyna ochrona przed kolizją
-- dwóch podstron pod tym samym URL-em (dziś: custom_pages_slug_key, setup.sql:362).
create unique index pages_full_path_key on public.pages (full_path)
  where kind = 'page' and deleted_at is null;

-- Rodzeństwo nie może mieć dwóch takich samych slugów.
create unique index pages_parent_slug_key
  on public.pages ((coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug)
  where kind = 'page' and deleted_at is null;

-- Odczyt drzewa i weryfikacja FK.
create index pages_parent_position_idx on public.pages (parent_id, "position");
create index pages_deleted_at_idx on public.pages (deleted_at) where deleted_at is not null;
```

### 2.3 `ON DELETE RESTRICT`, nie `CASCADE`

Dziś w bazie jest `parent_id uuid references public.nav_items (id) on delete cascade` (`supabase/setup.sql:411`). To zostaje **odwrócone**: `restrict`. Kasowanie poddrzewa ma być świadomą operacją w panelu — akcja liczy potomków, pokazuje ich listę i dopiero po potwierdzeniu przenosi je do kosza w jednej transakcji (R: „RESTRICT/NO ACTION jako domyślne zabezpieczenie"; pułapka: „przypadkowe usunięcie całego poddrzewa jedną nieopatrzną akcją"). Instruktor klikający „usuń" na „Program nauczania" nie może po cichu stracić „Uczniowskie" i wszystkich kyu.

### 2.4 Triggery

**Głębokość, pętle, `full_path` — jeden trigger BEFORE INSERT/UPDATE.**

```sql
create or replace function public.pages_before_write() returns trigger as $$
declare
  rodzic record;
begin
  if new.parent_id is not null then
    select id, depth, kind, full_path into rodzic
      from public.pages where id = new.parent_id;
    if rodzic.id is null then
      raise exception 'Rodzic nie istnieje.';
    end if;
    if rodzic.kind = 'link' then
      raise exception 'Odnośnik zewnętrzny nie może mieć podstron.';
    end if;
    if rodzic.depth >= 2 then
      raise exception 'Drzewo ma najwyżej trzy poziomy.';
    end if;
    if new.id = new.parent_id then
      raise exception 'Strona nie może być własnym rodzicem.';
    end if;
    if exists (
      with recursive przodkowie as (
        select id, parent_id from public.pages where id = new.parent_id
        union all
        select p.id, p.parent_id from public.pages p
          join przodkowie a on p.id = a.parent_id
      )
      select 1 from przodkowie where id = new.id
    ) then
      raise exception 'Ta zmiana utworzyłaby pętlę w drzewie.';
    end if;
    new.depth := rodzic.depth + 1;
  else
    new.depth := 0;
  end if;

  if new.kind = 'page' then
    new.full_path := coalesce(rodzic.full_path, '') || '/' || new.slug;
  else
    new.full_path := null;
  end if;

  new.updated_at := now();
  return new;
end $$ language plpgsql;
```

Limit trzech poziomów siedzi w bazie, nie tylko w kodzie Next (pułapka: „ograniczenie głębokości pilnowane TYLKO w kodzie"). Cykl sprawdzany rekurencyjnym CTE w górę od proponowanego rodzica — wzorzec z researchu.

**Przeliczenie potomków — trigger AFTER UPDATE.** Gdy zmieni się `full_path` albo `depth`, dotykamy dzieci (`update public.pages set updated_at = now() where parent_id = new.id`), co uruchamia ten sam trigger BEFORE u nich i kaskadowo dalej. Przy 28 wierszach koszt jest bez znaczenia.

**Przekierowanie — trigger AFTER UPDATE.**

```sql
if old.full_path is distinct from new.full_path and old.full_path is not null then
  insert into public.redirects (old_path, new_path, status, source)
       values (old.full_path, new.full_path, 308, 'auto')
  on conflict (old_path) do update set new_path = excluded.new_path;
  -- domknięcie łańcuchów: stare przekierowania celujące w poprzedni adres
  update public.redirects set new_path = new.full_path
   where new_path = old.full_path and old_path <> new.full_path;
  delete from public.redirects where old_path = new_path;
end if;
```

### 2.5 Tabela `public.redirects`

```sql
create table public.redirects (
  old_path   text        primary key check (old_path ~ '^/'),
  new_path   text        not null    check (new_path ~ '^/'),
  status     smallint    not null default 308 check (status in (301, 302, 307, 308)),
  source     text        not null default 'auto' check (source in ('auto', 'manual')),
  created_at timestamptz not null default now(),
  constraint redirects_no_self_chk check (old_path <> new_path)
);
alter table public.redirects enable row level security;
```

Wpisy `manual` służą do przeniesienia dwóch reguł z `next.config.ts:26-40` (`/organizacja/zalozyciel-i-wsko`, `/cennik`) i do ręcznych poprawek.

### 2.6 Cztery przypadki z zadania — jak wyglądają w wierszu

| Przypadek | `kind` | `source` | `slug` | `full_path` | `external_url` | `in_menu` |
|---|---|---|---|---|---|---|
| Podstrona z treścią z panelu („6 kyu") | `page` | `db` | `6-kyu` | `/program-nauczania/uczniowskie/6-kyu` | NULL | dowolnie |
| Istniejąca trasa w kodzie („Cennik") | `page` | `route` (`/zajecia/cennik`) | `cennik` | `/zajecia/cennik` | NULL | `true` |
| Odnośnik zewnętrzny (np. FB klubu) | `link` | `db` | NULL | NULL | `https://…` | `true` |
| Nagłówek grupujący („ZAJĘCIA" — dziś pozycja bez `href`, `navTypes.ts:23-30`) | `header` | `db` | NULL | NULL | NULL | `true` (wymuszone CHECK-iem) |
| Strona poza menu (np. regulamin w stopce) | `page` | `db` | `regulamin` | `/regulamin` | NULL | **`false`** |
| Szkic, jeszcze niewidoczny publicznie | dowolny | — | — | — | — | `published = false` |

Dwa rozłączne przełączniki: `published` („czy strona jest dostępna pod swoim adresem") i `in_menu` („czy pokazuje się w menu na górze"). Dziś w panelu nie ma żadnego z nich — `NavEditor.tsx` w ogóle nie renderuje kontrolki dla `visible` (A), a `CustomPageEditor.tsx:203-211` ma checkbox „Pokaż w menu górnym", który nie usuwa pozycji zagnieżdżonych. Oba muszą być widocznymi, osobno opisanymi polami (R: „pozycja menu musi mieć jawny, nazwany typ w formularzu").

### 2.7 Dlaczego `source='route'`, a nie „link wewnętrzny"

Serwis ma dziś siedem tras statycznych z treścią w `site_settings` pod kluczem `page:<slug>` (`lib/editablePages.ts:24-272`) i trzy listingi tematyczne renderowane z `data/articles/*.ts`. Gdyby te pozycje menu były typu `link` z wolnym polem URL, wracalibyśmy do modelu, w którym redaktor wpisuje adres z palca i może się pomylić. `source='route'` to zamknięty zbiór: wartość `route` jest walidowana po stronie serwera wobec rejestru `KNOWN_ROUTES` w kodzie (rozszerzony `lib/editablePages.ts`), a w panelu takie wiersze **nie są tworzone przez redaktora** — powstają w migracji i są edytowalne tylko w zakresie etykiety, kolejności i miejsca w drzewie. To jest ta sama zasada, co „Custom Links" w WordPressie odseparowane od „Pages", tylko bez ryzyka literówki w adresie.

### 2.8 Co znika, co zostaje

| Tabela | Los |
|---|---|
| `nav_items` | usuwana w etapie contract |
| `custom_pages` | dane przenoszone do `pages`, tabela usuwana w etapie contract |
| `article_overrides` | dane przenoszone do `pages.blocks/title/intro`, tabela usuwana w etapie contract |
| `site_settings` klucz `page:<slug>` | zostaje do czasu przeniesienia treści tras statycznych; docelowo też do `pages.blocks` |
| `content_versions` | zostaje bez zmian, dochodzi `entity_type = 'page_node'` |
| `articles` (aktualności) | **bez zmian** — aktualności są osobnym modelem i mają zostać osobne |

---

## 3. Jak wygląda trzeci poziom

**Rozstrzygnięcie: pomysł właściciela jest poprawny i to on wchodzi do wdrożenia.** Menu rozwijane zostaje dwupoziomowe. Trzeci poziom hierarchii istnieje w danych (`depth = 2`), ale w interfejsie wychodzi na stronę-hub z kafelkami.

Uzasadnienie:

1. NN/g o kaskadowych dropdownach: dwa poziomy już frustrują, więcej jest „highly inadvisable"; alternatywą jest mega-menu albo strona-trasa. Klub nie ma ani objętości treści, ani budżetu na mega-menu, więc zostaje strona-trasa (R, krytyczna).
2. Trzeci poziom flyoutu generuje problem przekątnej i wymaga śledzenia kierunku kursora — kod, którego nikt tu nie będzie utrzymywał (R).
3. Renderer fizycznie nie umie dziś narysować trzeciego poziomu (`components/Navbar.tsx:132-142, 205-214` — `dropdown.map` bez rekurencji), więc wariant „trzy poziomy w menu" to nie jest „dołożenie pętli", tylko przepisanie obu widoków plus obsługa klawiatury i dotyku dla zagnieżdżonego panelu.
4. Wzorzec strony-hub już w serwisie działa i jest zrozumiały — `/organizacja`, `/buddyzm`, `/o-shorinji` to dokładnie to (`components/ArticleListing.tsx:27-46`). Redaktor nie uczy się nowego pojęcia.
5. Na telefonie akordeon przy liście ośmiu stopni kyu robi się długi; NN/g rekomenduje przejście na stronę-lądowanie już od kilku pozycji (R).

**Jak to działa konkretnie.** Węzeł `page`, który ma opublikowane dzieci, dostaje `layout = 'auto'` i renderuje się jako: nagłówek (`title`) + wstęp (`intro`) + własne bloki (`blocks`, mogą być puste) + siatka kafelków dzieci (`title` + `intro` każdego dziecka). Żaden osobny „typ strony listingowej" nie jest potrzebny — bycie listingiem wynika z posiadania dzieci (R: „każdy węzeł-page z dziećmi automatycznie jest stroną-listingiem"). `layout = 'article'` wymusza brak kafelków, `layout = 'listing'` wymusza kafelki nawet przy zerze dzieci (pusty stan z komunikatem w panelu). Domyślne `auto` wystarcza w 100% dzisiejszych przypadków.

Przykład z zadania:

```
Program nauczania            depth 0, w menu, ma dropdown
├─ Uczniowskie               depth 1, w menu (widoczne w dropdownie), layout auto → kafelki
│  ├─ 6 kyu                  depth 2, in_menu = false  → widoczne jako kafelek u rodzica
│  ├─ 5 kyu                  depth 2, in_menu = false
│  └─ 4 kyu                  depth 2, in_menu = false
└─ Mistrzowskie              depth 1, w menu
   └─ 1 dan                  depth 2, in_menu = false
```

Adresy: `/program-nauczania/uczniowskie/6-kyu`. Menu pokazuje „Program nauczania" → „Uczniowskie", „Mistrzowskie". Wejście na „Uczniowskie" pokazuje kafelki stopni.

**Egzekwowanie w kodzie, nie tylko w konwencji.** `getNavTree()` filtruje `depth <= 1`. Jeśli redaktor ustawi `in_menu = true` na węźle `depth = 2`, akcja zapisu odrzuca to komunikatem: „Ta strona jest na trzecim poziomie. W menu na górze mieszczą się dwa poziomy — trzeci pokazuje się jako kafelek na stronie »Uczniowskie«." Alternatywa (ciche ignorowanie) odtwarzałaby dzisiejszą asymetrię: redaktor coś ustawia, a system po cichu tego nie robi.

**Dostępność menu** (R, dwie zasady krytyczne):
- Pozycja, która ma własną stronę **i** dzieci (np. „O Shorinji Kempo", dziś `href` + `dropdown`, `navTypes.ts:34-43`) renderuje się jako `<a>` plus **osobny sąsiedni** `<button aria-expanded aria-controls>` z ikoną strzałki. Nigdy `aria-expanded` na samym linku.
- `<nav>` + `<ul>/<li>` + wzorzec disclosure. Żadnych ról `menu`/`menubar`.
- Submenu otwierane kliknięciem (dotyk), Escape zamyka i oddaje fokus na przycisk.
- Nawigacja desktopowa zostaje widoczna, nie chowa się pod hamburgerem.

---

## 4. Ekran w panelu

### 4.1 Jedna zakładka zamiast dwóch

`components/admin/AdminShell.tsx:20` („Strony") i `:25` („Menu na górze strony") łączą się w jedną pozycję: **„Strony i menu"** (`/admin/strony`). Dwie zakładki dla jednego drzewa są źródłem zgłoszonego błędu i muszą zniknąć razem z modelem (R: „nieukończona faza contract zostawia system w stanie gorszym niż punkt startowy").

### 4.2 Co redaktor widzi

Jedna lista z wcięciami — drzewo. Każdy wiersz: uchwyt przeciągania, tytuł, plakietki stanu, adres szarym drukiem, przyciski.

```
Strony i menu

[+ Dodaj na górze]                            [Podgląd strony ↗]

⣿ ZAJĘCIA                            (nagłówek w menu)         [⋯]
   ⣿ Grupa dorosła      /zajecia/dorosli    w menu             [⋯]
   ⣿ Grupa dziecięca    /zajecia/dzieci     w menu             [⋯]
   ⣿ Cennik             /zajecia/cennik     w menu             [⋯]
⣿ Aktualności           /aktualnosci        w menu             [⋯]
⣿ Program nauczania     /program-nauczania  w menu             [⋯]
   ⣿ Uczniowskie        /program-nauczania/uczniowskie   w menu [⋯]
      ⣿ 6 kyu           …/uczniowskie/6-kyu   poza menu · kafelek [⋯]
      ⣿ 5 kyu           …/uczniowskie/5-kyu   poza menu · kafelek [⋯]
⣿ O Shorinji Kempo      /o-shorinji         w menu             [⋯]
   ⣿ Wprowadzenie       /o-shorinji/wprowadzenie   w menu      [⋯]
⣿ Regulamin             /regulamin          poza menu          [⋯]
⣿ Facebook klubu        ↗ facebook.com/…    odnośnik zewnętrzny [⋯]
⣿ Nowy tekst            /nowy-tekst         szkic · poza menu  [⋯]
```

Plakietki, każda z osobnym znaczeniem: `w menu` / `poza menu` / `szkic` / `nagłówek w menu` / `odnośnik zewnętrzny` / `kafelek` (dla `depth = 2`, z podpowiedzią po najechaniu: „Trzeci poziom nie mieści się w rozwijanym menu — ta strona pokazuje się jako kafelek na stronie »Uczniowskie«").

### 4.3 Jak dodaje stronę w wybranym miejscu

Przycisk `[⋯]` przy wierszu → „Dodaj podstronę pod »Program nauczania«". Do tego globalne `[+ Dodaj na górze]`. **Nigdzie nie ma pola „slug rodzica" ani „ID rodzica"** — miejsce w drzewie wynika z tego, który przycisk został kliknięty, dokładnie tak jak w Squarespace i Crafcie (R, krytyczna: „nigdy przez ręczne wpisywanie identyfikatora lub sluga rodzica"; A: problem nr 2 ze zgłoszenia).

Okno dodawania — trzy jawnie nazwane opcje, w tej kolejności, z opisem pod każdą:

```
Co chcesz dodać pod „Program nauczania"?

( • ) Podstronę           Nowa strona z własną treścią i własnym adresem.
(   ) Odnośnik zewnętrzny Link do innej witryny. Nie tworzy strony.
(   ) Nagłówek grupujący  Sam napis w rozwijanym menu. Nie ma adresu ani treści.

Tytuł strony:  [ Uczniowskie                            ]
Adres:         /program-nauczania/uczniowskie      [Zmień]
               ↑ liczony z tytułu, pokazany zanim redaktor kliknie „Zapisz"

[✓] Pokaż w menu na górze strony
[✓] Opublikuj od razu   (odznacz, jeśli chcesz najpierw napisać treść)
```

Trzy typy widoczne obok siebie, nie ukryte pod domysłem systemu (R, ważna). Adres pokazany na żywo przed zapisem — redaktor widzi, co powstanie, więc mechanizm przestaje być niewidoczny (pułapka: „automatyczne dodawanie musi być widoczne i przewidywalne"). Dla `depth = 2` checkbox „Pokaż w menu" jest wyszarzony z wyjaśnieniem obok, zamiast być aktywny i cicho ignorowany.

### 4.4 Jak przestawia

Przeciąganie za uchwyt `⣿`, z wcięciem w prawo = zagnieżdżenie. Po upuszczeniu system pokazuje pasek: „Przeniesiono »Uczniowskie« pod »Program nauczania«. Nowy adres: /program-nauczania/uczniowskie. Stary adres będzie przekierowany. [Cofnij]".

Obowiązkowa alternatywa dla przeciągania: w menu `[⋯]` cztery pozycje — „Wyżej", „Niżej", „Wsuń pod stronę powyżej", „Wysuń o poziom wyżej". Drag & drop bywa trudne na tablecie i niedostępne z klawiatury; przy edycji raz na kilka tygodni nie może być jedyną drogą.

Zapis kolejności: `position` co 10 (10, 20, 30…), renumeracja rodzeństwa w jednej transakcji po przeciągnięciu (R: „prosty integer z odstępami", fractional indexing to inna skala problemu).

Zapis całego drzewa **nie może** być realizowany jako delete-all + reinsert. Dzisiejsze `saveNavTree` ma na ten temat komentarz wprost (`actions/navActions.ts:37-49`): wcześniejsza wersja przy błędzie w połowie zostawiała stronę bez menu. Nowa akcja robi punktowe `UPDATE` na przeniesionym węźle i jego rodzeństwie.

### 4.5 Jak chowa i jak usuwa

Dwa osobne przełączniki w `[⋯]`, z etykietami mówiącymi o skutku:
- „Ukryj w menu" / „Pokaż w menu" — strona dalej działa pod swoim adresem, znika tylko z paska.
- „Cofnij publikację" / „Opublikuj" — strona przestaje być dostępna pod adresem (404), znika też z menu i z sitemapy.

Usuwanie: „Przenieś do kosza", spójne z istniejącym mechanizmem `deleted_at` (`supabase/02-kosz-i-historia.sql:41-56`). Gdy węzeł ma dzieci, dialog wylicza je z nazwy:

```
Strona „Uczniowskie" ma 3 podstrony:
  · 6 kyu   · 5 kyu   · 4 kyu

( • ) Przenieś do kosza razem z podstronami
(   ) Przenieś do kosza tylko „Uczniowskie", podstrony przesuń
      o poziom wyżej (pod „Program nauczania")

[Anuluj]  [Przenieś do kosza]
```

Baza (`ON DELETE RESTRICT`) gwarantuje, że nawet zapytanie z pominięciem panelu nie osieroci poddrzewa po cichu.

### 4.6 Edycja treści

Klik w tytuł otwiera edytor strony: tytuł (H1), wstęp, bloki — ten sam `PageBlocksEditor`, który już działa. Nad edytorem pasek okruszków „Program nauczania › Uczniowskie" i informacja „Ta strona pokazuje kafelki 3 podstron pod tekstem" — żeby redaktor rozumiał, skąd biorą się kafelki, których nie wpisał.

---

## 5. Migracja bez zerwania adresów

### 5.1 Zasada nadrzędna

**Migracja modelu nie zmienia ani jednego istniejącego adresu.** Każdy dzisiejszy URL po migracji ma węzeł z dokładnie takim samym `full_path`. Zmiany adresów zdarzają się dopiero później, z inicjatywy redaktora, i wtedy trigger sam zapisuje przekierowanie. To rozdzielenie („zmiana schematu ≠ zmiana zachowania") jest istotą wzorca expand-contract i jedynym sposobem, żeby wycofać się z każdego etapu bez utraty pozycji w wyszukiwarce.

### 5.2 Krok 0 — golden master (przed jakąkolwiek zmianą)

Skrypt `scripts/snapshot-tree.mjs` zapisuje `docs/golden-master-przed.json`:

```json
{
  "menu":  [ { "label": "ZAJĘCIA", "href": null,
               "dropdown": [ { "label": "GRUPA DOROSŁA", "href": "/zajecia/dorosli" } ] } ],
  "adresy": [ "/", "/aktualnosci", "/zajecia/cennik", "/o-shorinji/wprowadzenie", … ],
  "sitemap": [ … pełne wyjście app/sitemap.ts … ],
  "statusy": { "/o-shorinji/wprowadzenie": 200, "/cennik": 302, … }
}
```

Źródła: `getNavTree()`, `sitemap()` z `app/sitemap.ts`, plus przejście HEAD-em po wszystkich adresach z sitemapy i po `next.config.ts` redirects. Ten sam skrypt uruchamiany po każdym etapie; różnica musi być pusta albo świadomie wyjaśniona (R: characterization test — jedyna praktyczna siatka bezpieczeństwa przy braku frameworka testowego).

### 5.3 Krok 1 — expand: tabela obok, nikt z niej nie czyta

`supabase/03-drzewo-stron.sql`: `pages`, `redirects`, triggery, indeksy. Publiczna strona i panel działają bez zmian, na `nav_items` i `custom_pages`.

### 5.4 Krok 2 — backfill

Skrypt `scripts/migrate-pages.mjs`, idempotentny (`on conflict (full_path) do nothing`), wypełnia `pages` z czterech źródeł:

| Źródło | Co powstaje |
|---|---|
| `nav_items` (`parent_id IS NULL`, `href IS NULL`) | `kind = 'header'`, np. „ZAJĘCIA" |
| `nav_items` z `href` wskazującym trasę z `EDITABLE_PAGES` albo listing tematyczny | `kind='page'`, `source='route'`, `route = href`, `slug` = ostatni segment |
| `custom_pages` | `kind='page'`, `source='db'`, `parent_id = null`, `blocks`/`intro`/`published`/`deleted_at` 1:1 |
| `data/articles/*.ts` — 10 artykułów | `kind='page'`, `source='route'`, `route='/{topic}/{slug}'`, rodzic = węzeł listingu |
| `data/articles/*.ts` — `topicTitle`/`topicIntro` × 3 | `title`/`intro` węzła listingu (`/o-shorinji`, `/organizacja`, `/buddyzm`) |

Pozycje: `position` z `nav_items.position × 10`; węzły spoza menu (artykuły tematyczne poza `DEFAULT_NAV`, własne podstrony bez pozycji) dostają `in_menu = false` i `position` na końcu rodzeństwa.

Kontrola poprawności po backfillu — zapytanie musi zwrócić zero wierszy:

```sql
-- każdy adres z sitemapy ma węzeł
select p from unnest(:adresy_z_golden_master) p
 except select full_path from public.pages where kind = 'page' and deleted_at is null;
```

Dodatkowo `select full_path, count(*) from public.pages group by 1 having count(*) > 1` (duplikaty) — analogicznie do ostrzeżenia w nagłówku `setup.sql:66-69`.

### 5.5 Krok 3 — przełączenie odczytu menu, za flagą

`lib/navigation.ts` czyta z `pages` (`in_menu and published and deleted_at is null and depth <= 1`), gdy `process.env.DRZEWO_STRON === '1'`; w przeciwnym razie stara ścieżka. Zapis nadal idzie do `nav_items`, a migracja przepisuje `nav_items → pages` przy każdym zapisie (dwuzapis, świadomie tymczasowy). Porównanie `getNavTree()` starego i nowego w jednym renderze pod flagą `DRZEWO_STRON=diff` loguje rozjazd — walidacja zgodności przed cutover, jak w opisie Strangler Fig.

Uwaga wdrożeniowa dla Netlify: zmienna musi być ustawiona dla właściwego kontekstu deployu, inaczej flaga jest niewidoczna w produkcyjnym buildzie (znane z wcześniejszego incydentu z `SUPABASE_SERVICE_ROLE_KEY`).

### 5.6 Krok 4 — routing

Nowa trasa `app/[...sciezka]/page.tsx` (**wymagany** catch-all, nie opcjonalny — `[[...sciezka]]` kolidowałby z `app/page.tsx`). Zastępuje `app/[slug]/page.tsx`.

```
1. sciezka.join('/')  →  '/' + ...
2. select * from pages where full_path = $1 and published and deleted_at is null
3. znaleziono i source='db'   → renderuj (nagłówek + bloki + kafelki dzieci)
4. znaleziono i source='route'→ notFound()  // trasa statyczna i tak ma pierwszeństwo
5. nie znaleziono            → select new_path, status from redirects where old_path = $1
                               → permanentRedirect(new_path)  albo  notFound()
```

Trasy statyczne (`app/kontakt`, `app/zajecia/cennik`, `app/o-shorinji/[slug]`…) mają w Next pierwszeństwo przed catch-all, więc działają dalej bez zmian.

**Przekierowania rozwiązujemy w tej trasie, nie w middleware.** Middleware wykonuje się dla każdego żądania i musiałby odpytywać Supabase kluczem service-role na krawędzi; tutaj zapytanie o `redirects` leci wyłącznie dla adresów, które nie trafiły w żadną stronę, a wynik jest objęty ISR (`export const revalidate = 300`, tak jak dziś `app/[slug]/page.tsx:12`). Reguły z `next.config.ts:26-40` przenosimy do `redirects` jako `source='manual'` i usuwamy z konfiguracji dopiero po potwierdzeniu, że nowa ścieżka działa.

Brakujący `app/not-found.tsx` (A: „w repo nie ma własnego `app/not-found.tsx`") dokładamy przy okazji — dziś każdy martwy link kończy się domyślną stroną Next bez powrotu do serwisu.

### 5.7 Krok 5 — panel

Nowa zakładka „Strony i menu" pod flagą, obok starych dwóch. Po tygodniu pracy właściciela na nowej — usunięcie starych.

### 5.8 Krok 6 — contract

Kolejno: usunięcie `NavEditor.tsx`, `saveNavTree`, `syncNavItem`, zakładki „Menu na górze strony", potem `drop table nav_items`, `drop table custom_pages`, `drop table article_overrides`. Termin: ten sam kwartał. Zostawienie obu ścieżek na stałe jest gorsze niż punkt startowy.

### 5.9 Adresy już zaindeksowane — osobno

1. **Nic nie znika w migracji.** Lista adresów z `golden-master-przed.json` jest kontraktem; różnica po każdym etapie musi być pusta.
2. **Zmiana sluga przez redaktora zawsze zostawia ślad.** Trigger z 2.4 zapisuje 308 automatycznie — redaktor nie musi o tym wiedzieć ani niczego zaznaczać. Google traktuje 308 jak 301.
3. **Bez łańcuchów.** Przy drugiej zmianie tego samego adresu trigger aktualizuje istniejące wiersze zamiast dokładać kolejne ogniwo, i kasuje wiersz, który zaczął wskazywać sam na siebie.
4. **Przeniesienie węzła w drzewie zmienia adresy całego poddrzewa** — trigger AFTER UPDATE przelicza potomków, a każdy z nich generuje własny wpis w `redirects`. Panel pokazuje to przed zapisem: „Zmiana dotknie 4 adresów. Stare adresy będą przekierowane."
5. **Sitemapa idzie z drzewa.** `app/sitemap.ts` przestaje składać listę z `data/articles/*.ts` i `listCustomPages()` (A: `app/sitemap.ts:12-30, 52-62`), a zaczyna czytać `select full_path, updated_at from pages where published and kind='page' and deleted_at is null`. Adresy z `redirects` do sitemapy nie trafiają.
6. **Rewalidacja.** Każda zmiana struktury woła `revalidatePath('/', 'layout')` (menu jest w layoucie) **oraz** `revalidatePath(stary_full_path)` i `revalidatePath(nowy_full_path)` dla węzła i wszystkich potomków. Bez tego strony z `revalidate = 300/3600` trzymają nieaktualne menu i stary adres do pięciu minut albo godziny (A: `app/buddyzm/page.tsx:9` → 3600).

---

## 6. Nagłówki stron-listingów

Problem: `topicTitle`/`topicIntro` żyją wyłącznie jako literały w `data/articles/{o-shorinji,organizacja,buddyzm}.ts`; `resolveArticleGroup` nadpisuje tylko pola pojedynczych artykułów i przepuszcza nagłówek tematu bez podmiany (`lib/articleContent.ts:95-106`), a `metadata` w `app/o-shorinji/page.tsx:11-14` czyta wprost obiekt bazowy, więc nawet SEO title jest nieedytowalny.

Rozwiązanie wynika z modelu i nie wymaga osobnego mechanizmu: **`topicTitle` to `pages.title` węzła listingu, `topicIntro` to `pages.intro`, kafelki to dzieci tego węzła.**

Kroki:

1. **Backfill** (krok 5.4) tworzy trzy węzły: `/o-shorinji`, `/organizacja`, `/buddyzm` z `title`/`intro` przepisanymi z literałów, oraz 10 węzłów-dzieci z `title`/`intro` artykułów. Wartości `title`/`intro` dzieci biorą pierwszeństwo z `article_overrides`, jeśli tam są — inaczej migracja cofnęłaby zmiany już wprowadzone przez redaktora.

2. **`components/ArticleListing.tsx`** przestaje przyjmować `ArticleGroup`, a zaczyna przyjmować `{ node, children }` z `pages`. Kod komponentu zmienia się minimalnie: `group.topicTitle → node.title`, `group.topicIntro → node.intro`, `group.articles.map → children.map`, `${baseHref}/${a.slug} → dziecko.full_path`. Dodatkowo między nagłówkiem a kafelkami wchodzi `<NewsBlocks blocks={node.blocks} />` — dzięki temu listing może mieć własną treść nad kafelkami, czego dziś nie ma wcale.

3. **`app/o-shorinji/page.tsx`, `app/organizacja/page.tsx`, `app/buddyzm/page.tsx`** czytają węzeł po `full_path` i budują `metadata` z jego `title`/`intro`. Trzy pliki, po kilka linii każdy. Docelowo te trzy trasy znikają i obsługuje je catch-all, ale to nie musi zdarzyć się w tym samym etapie.

4. **Panel** nie dostaje żadnego nowego ekranu — „O Shorinji Kempo" jest w drzewie zwykłym wierszem, klik w tytuł otwiera ten sam edytor co dla każdej innej strony. Znika dzisiejsza asymetria z `app/admin/(panel)/strony/page.tsx:96-123`, gdzie `topicTitle` był tylko statycznym nagłówkiem sekcji bez linku do edycji.

5. **Kolejność i zestaw kafelków** stają się edytowalne za darmo — to jest `position` i `parent_id` dzieci, przestawiane przeciąganiem. Dziś jedno i drugie jest w kodzie (`lib/articleContent.ts:89-91`: „Z kodu pochodzi nadal kolejność, slugi i zestaw artykułów").

6. **Treść samych artykułów tematycznych** (`sections` z `data/articles`, nadpisania w `article_overrides`) przenosi się do `pages.blocks` w osobnym etapie — konwerterem `sectionsToBlocks`, który już istnieje (`lib/blockConvert.ts`, używany w `lib/articleContent.ts:121,139`). Po tym etapie `source` tych 10 węzłów zmienia się z `route` na `db`, znikają katalogi `app/o-shorinji/[slug]` i bliźniacze, a `data/articles/*.ts` zostaje wyłącznie jako `content-fallback`.

---

## 7. Podział na etapy

Nakład dla jednego programisty, dzień = 8 h. Każdy etap kończy się uruchomieniem `scripts/snapshot-tree.mjs` i porównaniem z golden masterem.

| # | Etap | Zakres | Nakład | Wycofanie |
|---|---|---|---|---|
| 0 | **Zrzut stanu** | `scripts/snapshot-tree.mjs`, `docs/golden-master-przed.json`, `app/not-found.tsx` | 0,5 d | nic do wycofania |
| 1 | **Expand — schemat** | `supabase/03-drzewo-stron.sql`: `pages`, `redirects`, triggery, indeksy. Kod nie dotyka nowych tabel | 1 d | `drop table` — aplikacja nic o nich nie wie |
| 2 | **Backfill** | `scripts/migrate-pages.mjs` + zapytania kontrolne. Nadal nikt nie czyta | 1 d | `truncate pages` i ponowne uruchomienie |
| 3 | **Menu z drzewa** | `lib/navigation.ts` + `lib/navTypes.ts` za flagą `DRZEWO_STRON`; dwuzapis `nav_items → pages` w `saveNavTree`; `Navbar.tsx` przepisany na wzorzec disclosure (link + osobny przycisk, klik zamiast hover, Escape) | 1,5 d | flaga na `0` |
| 4 | **Routing + przekierowania** | `app/[...sciezka]/page.tsx` zastępuje `app/[slug]`; obsługa `redirects`; `app/sitemap.ts` z drzewa; przeniesienie dwóch reguł z `next.config.ts` | 1,5 d | przywrócenie `app/[slug]`, reguły wracają do `next.config.ts` |
| 5 | **Panel: „Strony i menu"** | nowa zakładka za flagą: drzewo z wcięciami, przeciąganie + przyciski wyżej/niżej/wsuń/wysuń, okno dodawania z trzema typami, podgląd adresu, dwa przełączniki widoczności, dialog usuwania z listą potomków, punktowe `UPDATE` zamiast delete-all | 3 d | flaga na `0`, stare zakładki wciąż działają |
| 6 | **Listingi** | `ArticleListing` na węzłach `pages`; `title`/`intro`/`blocks` listingów edytowalne; `metadata` trzech tras z bazy | 1 d | rewert komponentu, dane w `pages` zostają |
| 7 | **Treść artykułów tematycznych** | `article_overrides` + `data/articles` → `pages.blocks`; `source` z `route` na `db`; usunięcie `app/{topic}/[slug]` | 1 d | `source` z powrotem na `route`, katalogi wracają |
| 8 | **Contract** | usunięcie `NavEditor`, `syncNavItem`, `saveNavTree`, starych zakładek; `drop table nav_items, custom_pages, article_overrides`; usunięcie flagi | 0,5 d | ostatni punkt bez łatwego odwrotu — dopiero po tygodniu pracy właściciela na nowym panelu |

**Razem 11 dni.** Etapy 0–2 są niewidoczne dla użytkowników i można je wdrożyć w dowolnym momencie. Pierwszy widoczny efekt (trzy poziomy, dodawanie pod istniejącą pozycją) pojawia się po etapie 5, czyli po około 8 dniach.

Etapy 6 i 7 można odłożyć w czasie bez szkody — po etapie 5 zgłoszone problemy 1, 2 i 3 są rozwiązane, problem 4 (nagłówki listingów) czeka na etap 6.

---

## 8. Ryzyka i czego nie robić

**Nie tworzyć osobnej tabeli `nav_items` synchronizowanej triggerem z `pages`.** To ten sam błąd, tylko przeniesiony z panelu do bazy — nadal dwa miejsca do aktualizacji i nadal możliwy rozjazd. Pozycja w menu ma być kolumną wiersza strony (R, krytyczna; pułapka wymieniona wprost).

**Nie tworzyć strony-placeholdera, gdy redaktor doda pozycję menu bez celu.** Pusta, żywa strona jest gorsza od martwego linku, bo trzeba ją potem wytropić i skasować. W nowym modelu problem nie występuje: pozycja bez własnej strony to jawny `kind='header'`.

**Nie zostawiać `ON DELETE CASCADE`.** Dziś jest (`supabase/setup.sql:411`) i przy scaleniu tabel przestaje dotyczyć samego menu, a zaczyna dotyczyć treści — jedno kliknięcie kasowałoby „Program nauczania" razem z „Uczniowskie" i wszystkimi kyu.

**Nie robić trzeciego poziomu jako dropdown w dropdownie.** Poza rekomendacją NN/g jest twardy koszt: `Navbar.tsx` ma dwie niezależne gałęzie renderowania (desktop `:99-160`, mobile `:189-227`), obie bez rekurencji, plus problem przekątnej i obsługa dotyku dla zagnieżdżonego panelu.

**Nie zostawiać `saveNavTree` w wersji delete-then-insert ani nie wracać do niej „dla prostoty".** Komentarz w `actions/navActions.ts:37-49` opisuje realną awarię: błąd w połowie zapisu zostawiał serwis bez menu. Przy scalonej tabeli ta sama pomyłka kasowałaby treść stron, nie tylko etykiety.

**Nie polegać na `next.config.ts` redirects dla adresów zmienianych z panelu.** Reguły są kompilowane przy buildzie; instruktor bez dewelopera nie wywoła redeploya, więc każda zmiana sluga dawałaby 404 z wyników Google.

**Nie rozwiązywać przekierowań w middleware.** Middleware biegnie dla każdego żądania i wymagałby dostępu do Supabase kluczem service-role poza środowiskiem Node; zapytanie w trasie catch-all wykonuje się wyłącznie dla nietrafionych adresów i jest objęte ISR.

**Nie usuwać `article_overrides` przed przeniesieniem treści.** Tam siedzą realne zmiany wprowadzone przez redaktora (`lib/articleContent.ts:29-51`), które nie mają odpowiednika w `data/articles/*.ts`. Kolejność: backfill → weryfikacja → dopiero `drop`.

**Nie przenosić do nowego kodu wzorca `.maybeSingle()` bez obsługi `error`.** Dzisiejszy `syncNavItem` (`actions/customPageActions.ts:33-38`) przy dwóch wierszach z tym samym `href` dostaje PGRST116, uznaje to za „brak pozycji" i dokłada trzeci duplikat. W nowym modelu odpowiednikiem jest wyszukiwanie po `full_path` — chroni je indeks unikalny, ale kod i tak musi sprawdzać `error`, a nie tylko `data`.

**Nie zmieniać adresów przy okazji migracji, nawet gdy nowe wyglądałyby ładniej.** Kuszące jest przeniesienie `/wprowadzenie` pod `/o-shorinji/wprowadzenie` czy uporządkowanie `/zajecia/*` „przy okazji". Każda taka zmiana miesza dwa ryzyka (model + SEO) w jednym wdrożeniu i psuje golden master jako narzędzie kontroli. Adresy zmienia się osobno, po ustabilizowaniu modelu.

**Nie sięgać po ltree ani nested sets.** Przy 28 węzłach to komplikacja, którą trzeba będzie zrozumieć ponownie za dwa lata przy pierwszej awarii.

**Nie zapominać o rewalidacji poddrzewa.** Zmiana `full_path` rodzica zmienia adresy dzieci; `revalidatePath('/', 'layout')` odświeży menu, ale nie odświeży starych ścieżek potomków. Akcja musi zebrać listę dotkniętych ścieżek (przed i po) i zrewalidować każdą.

**Nie chować nawigacji desktopowej pod hamburgerem i nie dawać `aria-expanded` na sam link.** Pierwsze pogarsza mierzalne wskaźniki wykonania zadania, drugie myli użytkowników czytników ekranu — pozycja z własną stroną i podstronami wymaga linku plus osobnego przycisku.

**Nie zostawiać flagi `DRZEWO_STRON` i dwóch zakładek na stałe.** Przerwana migracja jest gorsza od punktu wyjścia, bo trzeba utrzymywać dwie ścieżki kodu nad jedną treścią. Etap 8 ma mieć datę.

**Nie zapominać, że `RESERVED_SLUGS` dalej jest potrzebny na poziomie zerowym.** Indeks unikalny na `full_path` obroni przed kolizją z trasami, które mają węzeł, ale nie przed `/admin`, `/api`, `/downloads`, `sitemap.xml` i `robots.txt` (`lib/customPages.ts:18-33`). Listę trzeba okroić do pozycji bez węzła i sprawdzać wyłącznie dla `parent_id IS NULL`.