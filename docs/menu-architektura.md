# Propozycja architektury: połączone drzewo stron i menu

Dokument wykonawczy. Każda decyzja ma uzasadnienie z researchu (R) albo z audytu kodu (A) z podaniem pliku i linii.

---

> ## ⚠ SPROSTOWANIA PO WDROŻENIU — czytać PRZED implementowaniem czegokolwiek z tego pliku
>
> Trzy decyzje właściciela z rund checklisty zmieniły model już PO napisaniu tej
> specyfikacji. Poniższy tekst w tych miejscach jest nieaktualny; stan faktyczny
> jest w kodzie i w `shorinji-notes/WORKLOG.md`.
>
> **1. Menu renderuje TRZY poziomy, nie dwa** (08.09.2026). §1 i §5 mówią
> „rozwijane menu renderuje tylko dwa [poziomy], trzeci wychodzi na stronę-hub".
> Właściciel to odwołał: „nigdy nie ustalałem, że ma być ukryty, to tylko mniejsza
> kreska i czcionka w menu". Kafelki-huby zostają, ale trzeci poziom jest też
> w menu.
>
> **2. Nagłówek MOŻE mieć własny adres** (09.09.2026, „wariant A"). §2.2 i §2.4
> zakładają `slug IS NULL` dla `kind='header'` i nagłówek przezroczysty dla ścieżki
> (patrz `pages_kind_fields_chk` i tabela w §3). Od 09.09 nagłówek ze slugiem wnosi
> swój segment do adresów podstron i działa jak folder, a kryterium w CTE
> `przodkowie_wzwyz` brzmi **„czy przodek ma własny adres"**, nie „czy przodek jest
> stroną". Nagłówek BEZ sluga zostaje przezroczysty — i to jest obowiązkowa
> zgodność wsteczna, bo `/faq` stoi pod nagłówkiem „ZAJĘCIA" i ma zostać
> jednosegmentowe. Indeksy `pages_full_path_key` i `pages_parent_slug_key` mają
> od tej zmiany predykat `kind <> 'link'`, nie `kind = 'page'`.
>
> **3. Widoczność liczy się PO GAŁĘZI** (09.09.2026). Specyfikacja opisuje
> `published` i `in_menu` jako flagi wiersza. Od 09.09 strona pod ukrytym przodkiem
> jest publicznie niewidoczna (404, brak w menu, brak w sitemapie i w prerenderze),
> mimo że jej własne flagi zostają nietknięte. Reguła mieszka w `lib/widocznosc.ts`.
> **Zakaz z §5 „panel blokuje `in_menu = true` przy `published = false`" ZOSTAJE** —
> panel dalej zdejmuje pozycję z menu przy ukrywaniu i wstawia ją z powrotem przy
> publikacji.

---

## 1. Rekomendacja w pięciu zdaniach

Zastępujemy `nav_items` i `custom_pages` **jedną tabelą `pages`** — adjacency list (`parent_id`), w której ten sam wiersz jest jednocześnie węzłem drzewa treści, źródłem adresu URL i pozycją menu, bo tylko scalenie usuwa przyczynę martwego linku typu „Test" na poziomie modelu danych (**sam wiersz `href=/test` już nie istnieje** — usunął go `actions/customPageActions.ts:153-156` przy przeniesieniu strony do kosza, a wszystkie 19 hrefów w `nav_items` prowadzi dziś do realnej trasy; mechanizm awarii jest natomiast w pełni realny i nienaprawiony, patrz test regresji nr 1 w §5.2), a nie na poziomie walidacji (R: „drzewo stron i menu powinny być JEDNYM modelem danych"; A: `syncNavItem` zna wyłącznie `parent_id IS NULL`, `actions/customPageActions.ts:33-38`). Kolumna `kind` (`page` / `link` / `header`) rozstrzyga jawnie, czym pozycja jest, a kolumna `source` (`db` / `route`) odróżnia stronę renderowaną z bazy od węzła reprezentującego istniejącą trasę w kodzie (`/kontakt`, `/zajecia/cennik`), dzięki czemu w drzewie nie powstaje ani jedna strona-placeholder. Struktura dopuszcza trzy poziomy, ale **rozwijane menu renderuje tylko dwa** — trzeci poziom wychodzi na stronę-hub z kafelkami, dokładnie jak zaproponował właściciel i jak zaleca NN/g. Adresy rozwiązuje jedna trasa catch-all `app/[...sciezka]/page.tsx` po denormalizowanej kolumnie `full_path`, a każda zmiana ścieżki zapisuje wiersz w tabeli `redirects` obsługiwanej w kodzie aplikacji, nie w `next.config.ts` (A: `next.config.ts:24-42` wymaga redeploya, którego instruktor nie zrobi). Wdrożenie idzie w ośmiu odwracalnych etapach wzorcem expand → migrate → contract, z zrzutem golden master przed pierwszą zmianą i z zasadą: **migracja nie zmienia ani jednego istniejącego adresu**.

---

## 2. Model danych

### 2.0 Stan bazy, na którym stoi ten plan (pomiar 2026-08-18)

Wszystkie liczby w tym dokumencie pochodzą z tego pomiaru. Notatka z 26.07 była nieaktualna w 5 z 6 punktów — jeśli któraś liczba niżej nie zgadza się z tym, co widzisz w SQL Editorze, **najpierw zmierz ponownie, potem koduj**.

| Tabela | Stan zmierzony 2026-08-18 |
|---|---|
| `nav_items` | **20** wierszy: 7 top-level / 13 dzieci; jeden bez `href` (ZAJĘCIA), czyli **19 hrefów**; zero ukrytych, zero duplikatów `href`, zero sierot, **zero martwych linków**. Brak kolumn `deleted_at`/`created_at`/`updated_at` |
| `custom_pages` | **0** wierszy. Trzy (`test`, `ee`, `eee` — wszystkie w koszu od 2026-08-10, zero bloków) usunięte trwale 2026-08-18 przed zrzutem golden mastera. Żywych własnych podstron: **ZERO**, w koszu też zero |
| `article_overrides` | **5** wierszy: `buddyzm/medytacja` (**`body_md` 13 131 znaków, `blocks` NULL**), `buddyzm/podstawy` (21 bloków), `o-shorinji/cele-i-wartosci` (32), `o-shorinji/wprowadzenie` (19), `organizacja/egzaminatorzy` (2 × `person`) |
| `site_settings` | **14** kluczy: 8 × `page:*` (pokrywają się 1:1 z `EDITABLE_PAGES`), 2 klucze kopii zapasowych, `footer`, `galeria:okladki`, `organization`, `schedule` |
| `articles` (aktualności) | 1 wiersz, opublikowany |
| `content_versions` | tabela istnieje, **0 wierszy**, kolumna `entity_key` |
| `pages`, `redirects` | **nie istnieją** (PGRST205) |

**Kosz podstron NIE opróżnia się sam — mimo `DNI_W_KOSZU = 30`.** `oproznijStaryKosz("custom_pages")` nigdy się nie wykonuje, bo `listTrashedCustomPages`, `restoreCustomPage` i `purgeCustomPage` nie mają w repo **ani jednego** wywołania (§8) — wiersze leżałyby w koszu bezterminowo. Kosz aktualności działa, bo `TrashSection` jest podłączony do `/admin/artykuly`; kosz podstron nie jest podłączony nigdzie. Dlatego te trzy wiersze usunięto **ręcznie i świadomie 2026-08-18**, przed zrzutem golden mastera, po zrzucie całej bazy do `shorinji-notes/db-backup-2026-08-18/`. Publicznie zero zmian: `/test`, `/ee`, `/eee` dawały 404 przed usunięciem i dają 404 po nim. Ten ruch ma być zapisany w nagłówku `docs/golden-master-przed.json` — razem z regułą, że **każda** inna zmiana danych w trakcie etapów 0–4 wymaga wyjaśnienia w tym samym nagłówku albo zrzutu od nowa.

### 2.1 Wybór reprezentacji drzewa

Adjacency list (`parent_id` + `position`), całe drzewo czytane jednym `SELECT` i składane w pamięci w Node.

Uzasadnienie: dziś realnych węzłów jest **22** — `nav_items` ma 20 wierszy (7 top-level + 13 dzieci, z czego 10 to podstrony tematyczne z `data/articles/*.ts`, a 3 to podstrony ZAJĘĆ), plus dwa węzły z `EDITABLE_PAGES` bez wiersza w menu (`/` i `/kontakt`); żywych własnych podstron jest **zero** (§2.0). Docelowo dochodzą stopnie kyu/dan, czyli kilkadziesiąt

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
  kicker       text,                          -- nadkreślenie nad H1. Treść ośmiu tras
                                              -- statycznych ma DZIŚ trzy pola nagłówka:
                                              -- title, lead, kicker (prefillHeader
                                              -- w lib/editablePages.ts). `lead` mapuje się
                                              -- na `intro`, `kicker` nie ma odpowiednika
                                              -- i bez tej kolumny cicho zniknie.
  title        text        not null,          -- H1 strony
  intro        text,                          -- lead pod H1 ORAZ opis na kafelku u rodzica
  blocks       jsonb       not null default '[]'::jsonb,

  -- WSKAŹNIKI NA ZASOBY POZA TYM WIERSZEM
  content_key  text,       -- klucz w site_settings, np. 'page:zajecia-dorosli'.
                           -- Slug NIE jest dziś kluczem treści — rozjazd jest w 4 z 8
                           -- wpisów EDITABLE_PAGES: home→/, cennik→/zajecia/cennik,
                           -- zajecia-dorosli→/zajecia/dorosli, zajecia-dzieci→/zajecia/dzieci.
                           -- Bez tej kolumny backfill nie trafi w klucz treści.
  cloudinary_folder text,  -- np. 'Strona/buddyzm/medytacja'. Folder ze zdjęciami jest dziś
                           -- kluczowany KSZTAŁTEM ADRESU, więc zmiana sluga — czyli cała
                           -- pointa tej migracji — osieroci go na zawsze i nic tego nie zgłosi.
  layout       text        not null default 'auto'
                           -- UWAGA: te trzy wartości NIE wyrażają ośmiu tras statycznych.
                           -- Czystym „nagłówek + bloki" są tylko dwie (/zajecia/cennik,
                           -- /program-nauczania). /kontakt ma formularz POMIĘDZY nagłówkiem
                           -- a treścią; /zajecia/dorosli i /zajecia/dzieci mają grafik +
                           -- formularz + mapę + trzy kafelki CTA; / ma pasek aktualności
                           -- w siatce 3/4+1/4; /galeria i /aktualnosci mają własne komponenty.
                           -- Rozstrzygnięcie: patrz §2.8.
                           -- CHECK-a NIE zamykać na trzech wartościach: siatka 3/4+1/4 strony głównej
                           -- nie mieści się w żadnej z nich, a rozszerzenie CHECK-a to druga
                           -- ręczna wizyta w SQL Editorze (PostgREST nie wykona DDL).
                           -- Walidacja dopuszczalnych wartości idzie do kodu; w bazie zostaje
                           -- `not null default 'auto'`. Zbiór na dziś: 'auto', 'article',
                           -- 'listing', 'route' (układ z pliku trasy) — patrz §9.

  -- MENU
  menu_label   text,       -- etykieta w menu; NULL = użyj title
  in_menu      boolean     not null default true,

  -- STAN
  published    boolean     not null default true,
  depth        smallint    not null default 0 check (depth between 0 and 2),
  "position"   integer     not null,

  -- ŚLAD (spójne z supabase/02-kosz-i-historia.sql)
  migrated_from text,      -- 'nav_items:<uuid>', 'custom_pages:<uuid>',
                           -- 'editable_pages:<slug>', 'article_overrides:<topic>/<slug>',
                           -- 'data_articles:<topic>/<slug>'.
                           -- Rozwiązuje dwa problemy naraz:
                           -- (1) daje cel ON CONFLICT wierszom kind='header' i kind='link',
                           --     które mają full_path NULL, więc żaden unikalny indeks
                           --     na adres ich nie obejmuje (§5.4);
                           -- (2) daje dwuzapisowi z etapu 3a stabilny klucz dopasowania —
                           --     dziś go nie ma, bo saveNavTree generuje wszystkie
                           --     nav_items.id od nowa przy każdym zapisie
                           --     (actions/navActions.ts:57-121).
  deleted_at   timestamptz,
  updated_by   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Strona główna: EDITABLE_PAGES ma wpis slug='home', route='/'
  -- (lib/editablePages.ts). Jest edytowalna z panelu i siedzi w sitemapie
  -- z priority 1, więc MUSI mieć węzeł. slug='' odpada na pages_slug_format_chk,
  -- slug='home' dałoby adres /home. Dlatego dla source='route' slug może być NULL —
  -- adres bierze się wtedy dosłownie z kolumny route (gałąź ADRES w §2.4).
  constraint pages_kind_fields_chk check (
       (kind = 'page'   and external_url is null
                        and (slug is not null or source = 'route'))
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
--
-- ŚWIADOMA ZMIANA ZACHOWANIA, nie odtworzenie stanu obecnego:
-- custom_pages_slug_key jest indeksem PEŁNYM, ten jest CZĘŚCIOWY
-- (where deleted_at is null). Skutek: slug strony leżącej w koszu przestaje być
-- zajęty. Dotyczy realnych danych — /test, /ee, /eee są dziś zarezerwowane przez
-- kosz (3 wiersze custom_pages, deleted_at 2026-08-10, §2.0).
-- Konsekwencja dla etapu 5: akcja przywracania z kosza MUSI sama sprawdzić
-- kolizję full_path, bo indeks jej wtedy nie wyłapie — przywrócenie wysypie się
-- dopiero na UPDATE albo, jeszcze gorzej, przejdzie na innym adresie.
create unique index pages_full_path_key on public.pages (full_path)
  where kind = 'page' and deleted_at is null;

-- Rodzeństwo nie może mieć dwóch takich samych slugów.
create unique index pages_parent_slug_key
  on public.pages ((coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug)
  where kind = 'page' and deleted_at is null;

-- Cel ON CONFLICT dla wierszy bez adresu (kind='header', kind='link') i klucz
-- dopasowania dla dwuzapisu z etapu 3a. Bez tego indeksu backfill nie jest
-- idempotentny dla nagłówków, bo pages_full_path_key ich nie obejmuje.
create unique index pages_migrated_from_key on public.pages (migrated_from)
  where migrated_from is not null;

-- Odczyt drzewa i weryfikacja FK.
create index pages_parent_position_idx on public.pages (parent_id, "position");
create index pages_deleted_at_idx on public.pages (deleted_at) where deleted_at is not null;

-- RLS. Cała ta baza stoi na jednej regule: „RLS włączony wszędzie, zero polityk,
-- dostęp wyłącznie kluczem service-role". `pages` ma trzymać szkice
-- (published = false) i kosz (deleted_at) — dokładnie te treści, przed którymi
-- RLS ma chronić. Bez tego ALTER-a byłyby czytelne kluczem anon, który leży
-- w bundlu przeglądarki.
--
-- NIE kopiować wzorca z supabase/setup.sql:51-55 (odziedziczona polityka SELECT
-- dla anon na `articles`) — na `pages` wyciekłyby szkice. Ani jednej `create policy`.
-- Ten ALTER musi być w tym samym pliku co `create table`, inaczej tabela
-- przez chwilę stoi otwarta.
alter table public.pages enable row level security;
```

### 2.3 `ON DELETE RESTRICT`, nie `CASCADE`

Dziś w bazie jest `parent_id uuid references public.nav_items (id) on delete cascade` (`supabase/setup.sql:411`). To zostaje **odwrócone**: `restrict`. Kasowanie poddrzewa ma być świadomą operacją w panelu — akcja liczy potomków, pokazuje ich listę i dopiero po potwierdzeniu przenosi je do kosza w jednej transakcji (R: „RESTRICT/NO ACTION jako domyślne zabezpieczenie"; pułapka: „przypadkowe usunięcie całego poddrzewa jedną nieopatrzną akcją"). Instruktor klikający „usuń" na „Program nauczania" nie może po cichu stracić „Uczniowskie" i wszystkich kyu.

### 2.4 Triggery

**Głębokość, pętle, `full_path` — jeden trigger BEFORE INSERT/UPDATE.**

```sql
create or replace function public.pages_before_write() returns trigger as $$
declare
  rodzic record;
  sciezka_rodzica text;   -- full_path najbliższego przodka typu 'page' (patrz gałąź ADRES niżej)
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

  -- ADRES — trzy rozłączne gałęzie, kolejność ma znaczenie.
  --
  -- Awaria, której to zapobiega: „ZAJĘCIA" to kind='header', a header ma
  -- full_path NULL (§2.6). Liczenie adresu z łańcucha slugów dawało dzieciom
  -- coalesce(NULL,'') || '/' || slug, czyli /cennik, /dorosli, /dzieci zamiast
  -- /zajecia/cennik, /zajecia/dorosli, /zajecia/dzieci — trzy zaindeksowane adresy
  -- złamane wbrew §5.1. Węzła /zajecia dołożyć NIE MOŻNA: app/zajecia/ nie ma
  -- page.tsx, a `zajecia` jest w RESERVED_SLUGS (lib/customPages.ts:18-33) —
  -- ten adres dziś zwraca 404 i musi taki zostać.
  if new.kind <> 'page' then
    new.full_path := null;

  elsif new.source = 'route' then
    -- Trasa istnieje w kodzie Next, więc adres jest DOSŁOWNIE tym, co Next obsługuje.
    -- Nigdy z łańcucha slugów. Ta gałąź obejmuje też stronę główną (route = '/').
    new.full_path := new.route;

  elsif new.parent_id is null then
    new.full_path := '/' || new.slug;

  else
    -- Treść z bazy: adres najbliższego przodka typu 'page'. Nagłówki grupujące
    -- i odnośniki przeskakujemy, bo nie mają adresu — bez tego dziecko nagłówka
    -- gubi prefiks i wychodzi z niego adres jednosegmentowy.
    with recursive przodkowie_wzwyz as (
      select id, parent_id, kind, full_path
        from public.pages where id = new.parent_id
      union all
      select p.id, p.parent_id, p.kind, p.full_path
        from public.pages p
        join przodkowie_wzwyz a on p.id = a.parent_id
       where a.kind <> 'page'
    )
    select full_path into sciezka_rodzica
      from przodkowie_wzwyz where kind = 'page' limit 1;

    -- nullif(...,'/') — żeby dziecko strony głównej dało '/cos', nie '//cos'
    -- sciezka_rodzica może być NULL, gdy nad węzłem stoją same nagłówki (np. dziecko
    -- nagłówka 'ZAJĘCIA' na poziomie zerowym) — wychodzi wtedy adres jednosegmentowy.
    -- Dziś to nie występuje: wszystkie trzy dzieci ZAJĘĆ mają source='route'. Panel (etap 5)
    -- musi ZABRONIĆ dodania podstrony z bazy pod nagłówkiem, który nie ma przodka typu 'page'.
    new.full_path := coalesce(nullif(sciezka_rodzica, '/'), '') || '/' || new.slug;
  end if;

  new.updated_at := now();
  return new;
end $$ language plpgsql;

-- Podłączenie. `create trigger` NIE zna „if not exists", więc drugie uruchomienie
-- pliku przerwałoby się błędem 42710 — stąd `drop trigger if exists` przed każdym.
drop trigger if exists pages_before_write_trg on public.pages;
create trigger pages_before_write_trg
  before insert or update on public.pages
  for each row execute function public.pages_before_write();
```

Limit trzech poziomów siedzi w bazie, nie tylko w kodzie Next (pułapka: „ograniczenie głębokości pilnowane TYLKO w kodzie"). Cykl sprawdzany rekurencyjnym CTE w górę od proponowanego rodzica — wzorzec z researchu.

**Przeliczenie potomków — trigger AFTER UPDATE.** Gdy zmieni się `full_path` albo `depth`, dotykamy dzieci (`update public.pages set updated_at = now() where parent_id = new.id`), co uruchamia ten sam trigger BEFORE u nich i kaskadowo dalej. Przy 22 wierszach (§2.0, §2.1) koszt jest bez znaczenia — i pozostanie bez znaczenia po dołożeniu stopni kyu/dan.

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

Wpisy `manual` służą do ręcznych poprawek i do przeniesienia **jednej** reguły z `next.config.ts:26-40`: `/cennik` → `/zajecia/cennik`, `status = 307` (realny kod, `permanent: false`; komentarz w kodzie na `next.config.ts:33-34` mówi 302 i jest nieprawdziwy). Druga reguła — `/organizacja/zalozyciel-i-wsko` → 308 — **zostaje w `next.config.ts`**: ten adres nigdy nie dotrze do catch-alla, bo `app/organizacja/[slug]/page.tsx:41` dopasuje go pierwszy i zrobi `notFound()` (§5.6).

### 2.6 Cztery przypadki z zadania — jak wyglądają w wierszu

| Przypadek | `kind` | `source` | `slug` | `full_path` | `external_url` | `in_menu` |
|---|---|---|---|---|---|---|
| Podstrona z treścią z panelu („6 kyu") | `page` | `db` | `6-kyu` | `/program-nauczania/uczniowskie/6-kyu` | NULL | dowolnie |
| Istniejąca trasa w kodzie („Cennik") | `page` | `route` (`/zajecia/cennik`) | `cennik` | `/zajecia/cennik` | NULL | `true` |
| Odnośnik zewnętrzny (np. FB klubu) | `link` | `db` | NULL | NULL | `https://…` | `true` |
| Nagłówek grupujący („ZAJĘCIA" — dziś pozycja bez `href`, `navTypes.ts:23-30`) | `header` | `db` | NULL | NULL | NULL | `true` (wymuszone CHECK-iem) |
| Strona poza menu (np. regulamin w stopce) | `page` | `db` | `regulamin` | `/regulamin` | NULL | **`false`** |
| **Strona główna** (`EDITABLE_PAGES` `slug='home'`) | `page` | `route` (`/`) | **NULL** | `/` | NULL | `true` |
| Szkic, jeszcze niewidoczny publicznie | dowolny | — | — | — | — | `published = false` |

Dwa rozłączne przełączniki: `published` („czy strona jest dostępna pod swoim adresem") i `in_menu` („czy pokazuje się w menu na górze").

**Stan faktyczny w panelu, żeby nie projektować od zera czegoś, co działa:** `CustomPageEditor.tsx:194-211` ma **oba** checkboxy — „Opublikowana" i „Pokaż w menu górnym" — i szkice działają end-to-end. Brakuje trzech rzeczy: `NavEditor.tsx` w ogóle nie renderuje kontrolki dla `visible` (A), checkbox „Pokaż w menu górnym" nie usuwa pozycji **zagnieżdżonych**, a `syncNavItem` nie zna kolumny `published`, więc szkic z zaznaczonym „Pokaż w menu górnym" **pojawia się w menu i prowadzi do 404**. Etap 5 to więc **przeniesienie dwóch przełączników, które redaktor już zna**, plus dołożenie trzeciego (`in_menu` dla pozycji menu, którego `NavEditor` nie renderuje). Oba muszą być widocznymi, osobno opisanymi polami (R: „pozycja menu musi mieć jawny, nazwany typ w formularzu").

### 2.7 Dlaczego `source='route'`, a nie „link wewnętrzny"

Serwis ma dziś **osiem** tras statycznych z treścią w `site_settings` pod kluczem `page:<slug>` — `EDITABLE_PAGES` ma 8 wpisów i 8 kluczy `page:*` w bazie pokrywa się z nimi 1:1 (§2.0). Ósma, łatwa do przeoczenia, to **strona główna** (`slug='home'`, `route='/'`) — i to właśnie ona nie mieści się w naiwnej wersji CHECK-a (§2.2). Uwaga: slug **nie jest** kluczem treści — rozjazd jest w 4 z 8 wpisów, stąd kolumna `content_key`

### 2.8 Co znika, co zostaje

| Tabela | Los |
|---|---|
| `nav_items` | usuwana w etapie contract |
| `custom_pages` | dane przenoszone do `pages`, tabela usuwana w etapie contract |
| `article_overrides` | **5** wierszy (§2.0). Dane przenoszone do `pages.blocks/title/intro` **przez `overrideToBlocks(wiersz)`, nigdy przez `wiersz.blocks`** — `buddyzm/medytacja` ma `blocks = NULL` i **13 131 znaków w `body_md`**, więc kopiowanie samej kolumny `blocks` cicho go wyzeruje (§6 pkt 6). Tabela usuwana w etapie contract, **dopiero po zapytaniu kontrolnym**
| `site_settings` klucz `page:<slug>` — **8** kluczy, 1:1 z `EDITABLE_PAGES`; wiersz `pages` wskazuje na nie kolumną `content_key` (§2.2). Poza nimi w tabeli jest 14 kluczy razem, w tym **dwa klucze kopii zapasowych** (`kopia:page:cennik-przed-migracja-konta`, `kopia:page:kontakt-przed-migracja`) — **nie sprzątać ich**, to jedyne kopie treści sprzed dwóch migracji, i filtrować **zakotwiczonym** `key like 'page:%'` (§5.4) |
| `content_versions` | zostaje bez zmian, dochodzi `entity_type = 'page_node'` — **bez DDL**, kolumna `entity_key` już jest. Uwaga: tabela ma dziś **0 wierszy**, `zapiszWersje` wołane wyłącznie dla aktualności, `historia()` bez ani jednego konsumenta. **Nie jest drogą odwrotu** (§8) |
| `articles` (aktualności) | **bez zmian** — aktualności są osobnym modelem i mają zostać osobne. To treść **trwała** (archiwum wpisów, jak w WordPressie), nie efemeryda: zmiana sluga wpisu zapisuje wiersz w `redirects`, a trasa `[slug]` sprawdza go przed `notFound()` (§5.6, rozstrzygnięcie 0b) |

**Decyzja do podjęcia świadomie, nie po cichu: sześć z ośmiu tras statycznych nie da się wyrazić w `pages.blocks`.** Czystym „nagłówek + bloki" są tylko dwie — `/zajecia/cennik` i `/program-nauczania`. `/kontakt` ma formularz **pomiędzy** nagłówkiem a treścią. `/zajecia/dorosli` i `/zajecia/dzieci` mają grafik + formularz + mapę + trzy kafelki CTA. `/` ma pasek aktualności w siatce 3/4+1/4. `/galeria` i `/aktualnosci` mają własne komponenty. Model z `layout in ('auto','article','listing')` gubi formularz, mapę i grafik.

**Wariant przyjęty:** dla tych sześciu tras `source='route'` jest **trwały** — węzeł istnieje dla struktury, menu, okruszków i sitemapy, a renderuje je dalej trasa w kodzie. Do `pages.blocks` przenoszą się tylko `/zajecia/cennik` i `/program-nauczania`. Wariant alternatywny (formularz, mapa i grafik jako nowe typy bloków w `BlockEditor`) jest osobnym zadaniem, poza tą migracją — **etap 9, §9**, z własnym zrzutem kontrolnym i kolejnością trasa-po-trasie. Cokolwiek wybierzesz — zapisz to tutaj, bo bez tego etap 7 „przy okazji" zgubi trzy komponenty.

---

## 3. Jak wygląda trzeci poziom

> **KOREKTA 2026-09-08 — właściciel odwołał to rozstrzygnięcie.** Po przejściu
> checklisty: „dlaczego 3 poziom musi być ukryty? nigdy nie ustalałem, że ma być
> ukryty, to tylko mniejsza kreska i czcionka w menu, nie powinno być trudne".
> Trzeci poziom **wchodzi do rozwijanej listy** jako wcięta pozycja mniejszym
> pismem; kafelki na stronie-hubie zostają obok, nie zamiast.
>
> Co się zmieniło w kodzie: `NavChild` ma `children?` i opcjonalny `href`,
> `buildNavTree` schodzi rekurencyjnie, `getNavTree` nie filtruje po `depth`,
> `Navbar` renderuje gałąź jedną funkcją dla obu widoków, a `sprawdzWidocznosc`
> nie odrzuca już `in_menu` przy `depth = 2`. Punkty 1–3 poniżej opisują
> uzasadnienie z 2026-08 i zostają jako zapis powodu, nie jako stan faktyczny.
>
> Cena tej zmiany jest realna i warto ją znać: kaskadowe menu jest trudniejsze
> na dotyku, a rozwijana lista rośnie. Argument NN/g nie przestał być prawdziwy —
> przegrał z tym, że reguła nigdy nie była decyzją właściciela, a jej skutek
> uboczny (żeby przenieść stronę na trzeci poziom, trzeba ją było najpierw
> ukryć) kosztował go więcej niż sam kaskadowy dropdown.

**Rozstrzygnięcie (2026-08, ODWOŁANE — patrz wyżej): pomysł właściciela jest poprawny i to on wchodzi do wdrożenia.** Menu rozwijane zostaje dwupoziomowe. Trzeci poziom hierarchii istnieje w danych (`depth = 2`), ale w interfejsie wychodzi na stronę-hub z kafelkami.

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

**Stan wyjściowy `Navbara` — dlaczego etap 3b to wymiana, nie rozbudowa.** W **całym** `components/` nie ma ani jednego `aria-expanded`, `aria-controls`, `onKeyDown` ani obsługi Escape. `Navbar.tsx` nie ma ani jednego `<ul>`/`<li>` (inne komponenty mają: 23 wystąpienia w 9 plikach). Jedyny `<nav>` **nawigacji głównej** to `Navbar.tsx:54` i obsługuje tylko desktop; menu mobilne siedzi w `<aside>` (`Navbar.tsx:173`). Pozostałe trzy `<nav>` w repo należą do innych obszarów i etap 3b ich nie dotyczy: `components/admin/AdminShell.tsx:72` oraz okruszek i nawigacja sekcji w `components/ArticlePage.tsx:51,84`. Dropdown na desktopie otwiera **czysty CSS** (`group-hover`) bez stanu w Reakcie, a `globals.css:21` zdejmuje `@media (hover:hover)`, więc reaguje też na dotyku. Trigger dla pozycji bez `href` to martwy `<button>` bez `onClick`. Mobilny dropdown jest **zawsze rozwinięty**.

**Uwaga krytyczna: `Navbar` jest właścicielem globalnej zmiennej layoutu `--nav-h`** (`Navbar.tsx:34-43`, `ResizeObserver` na **zewnętrznym** `<nav ref>`). Konsumenci: `.page-shell` (16 użyć), `scroll-padding-top`, `VerticalKanji`. Jeśli `ref` wyląduje na elemencie wewnętrznym albo na nowym `<ul>`, treść wjedzie pod przyklejone menu **na wszystkich trasach**, a skoki po kotwicach spisu treści zaczną lądować pod navbarem. Golden master ze statusów HTTP tego nie zobaczy — dopisać osobną asercję, że po renderze `--nav-h` ma wartość różną od `200px`.

**Twardy warunek w budowaniu drzewa menu: węzeł bez adresu i bez widocznych dzieci nie trafia do drzewa.** Bez tego `Navbar.tsx:148` renderuje `<Link href={undefined}>` i wywala **każdą** trasę, bo menu siedzi w layoucie. Nowy model wprost produkuje ten stan: `pages_header_visible_chk` wymusza `in_menu = true` dla nagłówka, a żaden CHECK nie ogranicza nagłówków do poziomu zerowego.

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

Zapis całego drzewa **nie może** być realizowany jako delete-all + reinsert **ani** jako insert-then-delete. Dzisiejsze `saveNavTree` jest już po naprawie: wstawia komplet nowych wierszy przed usunięciem starych, ze ścieżką wycofania (`actions/navActions.ts:57-121`, `wycofaj()` na `:71-74`) — komentarz w `supabase/setup.sql:426-439`, który mówi o „delete-all + reinsert", jest **nieaktualny i kłamie**. Powód, dla którego ten wzorzec nie przechodzi do nowego modelu, jest inny niż historyczna awaria: przez chwilę w tabeli istnieją **dwa komplety wierszy**, a `pages_full_path_key` jest indeksem unikalnym na adres, więc drugi komplet wywali się w połowie zapisu. Nowa akcja robi punktowe `UPDATE` na przeniesionym węźle i jego rodzeństwie.

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

Klik w tytuł otwiera edytor strony: tytuł (H1), wstęp, bloki — ten sam `BlockEditor`, który już działa (984 linie, 16-17 typów bloków, kontrakt `value`/`onChange` pasuje do `pages.blocks` 1:1). **Nie `PageBlocksEditor`** — ten jest kompletnym ekranem przywiązanym do `site_settings` przez `savePageContent`, z własnym paskiem zapisu. Nad edytorem pasek okruszków „Program nauczania › Uczniowskie" i informacja „Ta strona pokazuje kafelki 3 podstron pod tekstem" — żeby redaktor rozumiał, skąd biorą się kafelki, których nie wpisał.

---

## 5. Migracja bez zerwania adresów

### 5.1 Zasada nadrzędna

**Migracja modelu nie zmienia ani jednego istniejącego adresu.** Każdy dzisiejszy URL po migracji ma węzeł z dokładnie takim samym `full_path`. Zmiany adresów zdarzają się dopiero później, z inicjatywy redaktora, i wtedy trigger sam zapisuje przekierowanie. To rozdzielenie („zmiana schematu ≠ zmiana zachowania") jest istotą wzorca expand-contract i jedynym sposobem, żeby wycofać się z każdego etapu bez utraty pozycji w wyszukiwarce.

### 5.2 Etap 0a i 0b — golden master i rozstrzygnięcia (przed jakąkolwiek zmianą)

Etap 0 dzieli się na dwa, bo to dwie różne robotki z różnym ryzykiem:

- **0a — zrzut stanu.** `scripts/snapshot-tree.mjs` + `docs/golden-master-przed.json`. Skrypt musi **odmawiać zapisu bez konfiguracji env** (zrzut zrobiony na fallbackach z kodu jest gorszy od braku zrzutu) i **normalizować origin**: `NEXT_PUBLIC_SITE_URL` nie jest ustawiony, więc lokalnie wszystko leci na `https://shorinji-kempo.netlify.app` (`lib/site.ts:9-11`). Jeśli produkcja ma tę zmienną ustawioną inaczej, snapshot zrobiony lokalnie różni się **w każdym wpisie** — decyzję (produkcyjny env albo normalizacja) zapisać w nagłówku pliku.
- **0b — rozstrzygnięcia projektowe** wpisane do tej specyfikacji, bez kodu. Bez nich etap 1 wyprodukuje schemat do ręcznej poprawki, czyli drugą wizytę właściciela w SQL Editorze.

**`app/not-found.tsx` należy do etapu 4, nie do 0.** W etapie 0 nie wolno dotykać produkcji: własna strona 404 zmienia treść odpowiedzi dla **każdego** martwego adresu, czyli zmienia dokładnie to, co skrypt właśnie zapisał jako punkt odniesienia.

**Warunek ważności golden mastera:** w trakcie etapów 0–4 nie edytować treści ani slugów w panelu. Zmiana sluga nie rewaliduje **starego** adresu (`actions/customPageActions.ts:125-126` odświeża tylko nowy), więc snapshot zrobiony w ciągu 300 s po edycji pokaże dwa żywe adresy dla jednej strony.

Pliku golden mastera **nie kłaść** pod `app/` ani `components/` — Tailwind v4 ma `source(none)` + jawne `@source`, a plik będzie pełen ścieżek: materiał na powrót awarii `\1608be` z `CLAUDE.md`.

Skrypt `scripts/snapshot-tree.mjs` zapisuje `docs/golden-master-przed.json`:

```json
{
  "menu":  [ { "label": "ZAJĘCIA", "href": null,
               "dropdown": [ { "label": "GRUPA DOROSŁA", "href": "/zajecia/dorosli" } ] } ],
  "adresy": [ "/", "/aktualnosci", "/zajecia/cennik", "/o-shorinji/wprowadzenie", … ],
  "sitemap": [ … pełne wyjście app/sitemap.ts … ],
  "statusy": { "/o-shorinji/wprowadzenie": 200, "/cennik": { "status": 307, "location": "/zajecia/cennik" }, … }
}
```

**Golden master musi objąć 19 źródeł adresów.** Cztery to za mało — poza sitemapą i menu adresy powstają jeszcze w kilkunastu innych miejscach, a cztery zbiory adresów muszą pozostać **martwe**:

1. `app/sitemap.ts:12-24` — 11 adresów wpisanych na stałe.
2. `app/sitemap.ts:26-30` — 10 artykułów z `data/articles/*.ts`.
3. `app/sitemap.ts:42-50` — `getNews()` → `/aktualnosci/<slug>`. Te adresy zostają **poza** drzewem `pages` (§2.8), więc zapytanie akceptacyjne etapu 2 musi je jawnie wykluczyć — inaczej kryterium odbioru nigdy nie będzie puste.
4. `app/sitemap.ts:53-62` — `listCustomPages()` → `/<slug>`. Dziś **zero** (§2.0).
5. `nav_items` — 20 wierszy, **19 hrefów**, zapisane **po** `getNavTree()`, czyli po `normalizeNavTree`. Osobno zapisać **surowe** drzewo i udokumentować, że na dzisiejszych danych oba są identyczne.
6. `lib/editablePages.ts` — **8** tras, w tym `/`. Zapisać **pary** `(slug, route)`, nie same adresy: to jedyne miejsce w repo z tym mapowaniem, a rozjazd slug↔adres jest w 4 z 8 wpisów.
7. `next.config.ts:24-40` — dwa przekierowania z **realnymi** kodami: `/organizacja/zalozyciel-i-wsko` → **308** (`permanent: true`), `/cennik` → **307** (`permanent: false`). Komentarz w kodzie (`next.config.ts:33-34`) mówi 302 i jest **nieprawdziwy**.
8. Adresy, które **muszą zostać 404**: `/zajecia` oraz `/test`, `/ee`, `/eee`. Bez tych wpisów nikt nie zauważy, że migracja **dodała** adres — a dodanie też jest zmianą wobec §5.1.
9. Route handlery: `/downloads/<nazwa>` (są w stopce i u ludzi w zakładkach) oraz `/api/schedule/<group>/calendar.ics`.
10. Trasy metadanych: `/sitemap.xml`, `/robots.txt`, `/icon`. `icon` **brakuje** w `RESERVED_SLUGS`, więc da się dziś utworzyć kolidującą podstronę.
11. 19 adresów panelu `/admin/*` — do sprawdzenia, że etapy 5 i 8 nie wywaliły ekranu.
12. Adresy w stopce — **dwa klucze, nie jeden**. Odnośniki i pliki idą z `lib/footerTypes.ts:43-87` + `site_settings` klucz `footer` (6 wewnętrznych `/downloads/*.pdf` + 10 zewnętrznych w `links`), ale `components/Footer.tsx:131` renderuje jeszcze `<Profile social={org.social}/>` (`Footer.tsx:33-43`) — **3 adresy profili z klucza `organization`**, plus `tel:` (`Footer.tsx:94`) i `mailto:` (`Footer.tsx:102`). Pułapka: wiersz `footer` w bazie ma jeszcze klucze `social` i `contact`, ale `migrujStopke` (`lib/footerTypes.ts:104-112`) przepisuje **tylko** `links`/`downloads`/`documents` — czytanie `social` z wiersza `footer` poda wartości, które **nigdy** nie trafiają na stronę.
13. **Pliki statyczne z `public/`** — 7 plików, każdy oddaje dziś 200: `/SOEN.jpg` i `/og.png` (używane) oraz 5 resztek po `create-next-app` (`/file.svg`, `/globe.svg`, `/next.svg`, `/vercel.svg`, `/window.svg`). Albo do zrzutu, albo jawna decyzja, że są poza zakresem — z licznikiem, żeby ubytek dał się zauważyć.
14. **Zarezerwowane slugi jako adresy** — `RESERVED_SLUGS` ma **14** pozycji (`lib/customPages.ts:18-33`), nie 13. Zapisać, co dziś zwraca **każda** z nich; `/api` i `/downloads` (same, jednosegmentowe) dają dziś 404 przez `app/[slug]/page.tsx:30` i nie ma ich na żadnej innej liście.
15. **Kontrole negatywne pod prefiksami tematycznymi** — `/o-shorinji/<nieistniejacy>`, `/organizacja/<nieistniejacy>`, `/buddyzm/<nieistniejacy>` (`notFound()` w `app/{topic}/[slug]/page.tsx:41`) oraz `/zajecia/<cokolwiek>`. Wszystkie cztery dają dziś 404 i są **pierwszymi kandydatami na przypadkowe 200** z drzewa `pages` po etapie 4 — a etapy 4 i 6 przebudowują je najmocniej.
16. `/_not-found` i `/_global-error` z manifestu tras — do zapisania razem z faktem, że w repo **nie ma** ani `app/not-found.tsx`, ani `app/global-error.tsx`.
17. **Wewnętrzna reguła ukośnika końcowego** — `.next/routes-manifest.json` ma `redirects[0]` na `/:path+/` z `priority: true`, czyli **każdy** adres z ukośnikiem na końcu daje 308 na wersję bez niego (`/kontakt/` → `/kontakt`, `/zajecia/cennik/` → `/zajecia/cennik`). Zrzucić dwie próbki (jedno- i dwusegmentową), żeby zmiana routingu w etapie 4 nie ruszyła tej reguły niezauważona. Konsekwencja projektowa: `full_path` nigdy nie potrzebuje wariantu z ukośnikiem, a `redirects.old_path` można trzymać bez niego. `/Kontakt` (wielka litera) daje 404 i tak ma zostać.
18. **Odnośniki wewnętrzne w TREŚCI** — `components/NewsBlocks.tsx:36-51` renderuje `[etykieta](/adres)` z bloków jako zwykły `<a href>`: bez walidacji, bez lintera, bez testu. W kodzie 12 wystąpień / 10 unikalnych adresów (`data/articles/organizacja.ts:26`, `data/articles/buddyzm.ts:111`, `lib/editablePages.ts:35,38,41,44,246,249`), w bazie — nieznana liczba, bo redaktor wpisuje je z palca. `redirects` **nie uratuje** tych, które siedzą pod prefiksami statycznymi. Zrzucić liczbę wystąpień każdego adresu w wyrenderowanym HTML, nie sam zbiór adresów.
19. **Adresy zakute w komponentach** — 33 trafienia grepem po `href="/`, m.in. `components/Navbar.tsx:76` (`/`) i `:89` (`/kontakt`), `app/aktualnosci/page.tsx:44` (listing → `/aktualnosci/<slug>`), `app/admin/(panel)/strony/page.tsx:46` (`/admin/wlasne/<id>`), `:79` (`/admin/strona/<slug>` **budowane ze slugów `EDITABLE_PAGES`** — ta linia pęknie dokładnie wtedy, gdy etap 2 ruszy klucz treści) i 8 odnośników w `app/admin/(panel)/page.tsx:121-216`.

**Tryb serwera musi być zadeklarowany w nagłówku zrzutu.** Ten sam skrypt pod `next dev` i pod `next build && next start` daje **dwa różne golden mastery**: w produkcyjnym buildzie `/galeria`, `/sitemap.xml`, `/robots.txt`, `/icon.jpg`, `/admin/login` i `/admin/nowe-haslo` mają `initialRevalidateSeconds = false` (prerenderowane raz, nigdy nie rewalidują), 8 tras ma 300, 9 ma 3600. Konsekwencja, którą trzeba zapisać: **nowa aktualność ani nowa podstrona nie pojawi się w `/sitemap.xml` bez przebudowy**, więc kryterium odbioru etapów 2–4 nie może używać sitemapy jako dowodu na zmianę w bazie (komentarz `app/sitemap.ts:41` jest w tym sensie mylący). Zrzut robić pod **produkcyjnym** buildem — to on odpowiada produkcji.

**Dwie wartości liczone z zegara, nie jedna.** Obok `app/sitemap.ts:10,35` jest `components/Footer.tsx:147`: `&copy; {new Date().getFullYear()}` renderuje bieżący rok w stopce **każdej** strony. Widoczne tylko na przełomie roku, ale w porównaniu zrzutów zachowuje się identycznie i musi być normalizowane razem z `lastModified`.

**Zrzut NIE MOŻE chodzić z zalogowaną sesją panelu — pomiar kasowałby dane.** `/admin/artykuly` renderuje kliencki `TrashSection` (`app/admin/(panel)/artykuly/KoszAktualnosci.tsx:26`), który w `useEffect` woła `listTrashedNews` → `oproznijStaryKosz("articles")` (`actions/newsActions.ts:124`), czyli **trwale usuwa** aktualności leżące w koszu dłużej niż 30 dni. Adresy `/admin/*` sprawdzać **bez sesji** (mają oddać przekierowanie na `/admin/login`). Ta sama ścieżka dla podstron nie istnieje, bo `listTrashedCustomPages` nie ma wywołań (§2.0) — i właśnie dlatego kosz podstron trzeba było opróżnić ręcznie.

**Asercja długości tekstu wymaga jednoznacznego zakotwiczenia — `<main>` jest ZAGNIEŻDŻONY.** `app/layout.tsx:77` daje `<main className="flex-grow">` (zamknięcie `:81`), a `components/ArticlePage.tsx:74` renderuje **drugi** `<main>` w środku pierwszego (zamknięcie `:105`) — na 10 podstronach tematycznych. Wyrażenie leniwe urwie wycinek na `ArticlePage.tsx:105` i zgubi wszystko po treści artykułu; zachłanne wciągnie `<aside>` ze spisem treści (`ArticlePage.tsx:108-128`) razem z jego `<li>`, które ta sama lista każe liczyć osobno — te same elementy wpadną wtedy do dwóch asercji. Albo kotwiczyć na zewnętrznym `<main class="flex-grow">` z dopasowaniem po **ostatnim** `</main>`, albo liczyć dwie osobne strefy (ciało artykułu i spis treści). Do wycinka wpada też 8 kanji z `VerticalKanji` (`layout.tsx:78-79`) — stąd historyczne „15 znaków" na stronach bez treści.

**Liczby, które łatwo pomylić:** 13 131 znaków to `body_md` nadpisania `buddyzm/medytacja`, **nie** cennik. Dla `/zajecia/cennik` odniesieniem jest ~1840 znaków w `<main>` z bazą i 15 znaków bez bazy. Asercję na 13 131 znaków wpisać przy `/buddyzm/medytacja` — to jedyna trasa, gdzie treść idzie z `body_md`, i jedyna, gdzie etap 7 ma tyle do zgubienia.

Ten sam skrypt uruchamiany po każdym etapie; różnica musi być pusta albo świadomie wyjaśniona (R: characterization test — jedyna praktyczna siatka bezpieczeństwa przy braku frameworka testowego).

**Dla każdego adresu zapisać** (sam status nie wystarczy):

- kod HTTP **bez podążania za przekierowaniem** + nagłówek `Location` dla 3xx;
- `<link rel="canonical">` — 12 tras go ma, **trzy listingi nie mają** (`/o-shorinji`, `/organizacja`, `/buddyzm`);
- `<title>` i meta description;
- **liczbę bloków / długość tekstu w głównym kontenerze** — to jedyna asercja, która wyłapie cichą utratę 13 131 znaków w etapie 7;
- obecność galerii Cloudinary, spisu treści, odnośników poprzedni/następny i okruszka na podstronach tematycznych.

**Sitemapa:** porównywać sam posortowany zbiór `url` + `priority` + `changeFrequency`. `lastModified` **pominąć albo normalizować**, bo `app/sitemap.ts:10,35` wstawia `new Date()` — inaczej różnica nigdy nie będzie pusta, ktoś wyłączy porównanie sitemapy i migracja straci siatkę bezpieczeństwa.

**Znana, z góry wyjaśniona różnica do zapisania w nagłówku pliku:** trzy wiersze `custom_pages` z kosza (`/test`, `/ee`, `/eee`) zostały usunięte trwale **2026-08-18**, przed zrzutem, po zrzucie całej bazy do `shorinji-notes/db-backup-2026-08-18/` (§2.0). Nagłówek pliku ma podawać **datę i godzinę** pomiaru oraz **tryb serwera**, w którym go zrobiono (`next dev` i `next build` dają różne wyniki: pod produkcyjnym buildem `/galeria`, `/sitemap.xml`, `/robots.txt` i `/icon` są prerenderowane raz i nie rewalidują).

**Asercje muszą być precyzyjne.** Szukanie `iframe|youtube` w całym HTML dało już fałszywy pozytyw, bo youtube'owy odnośnik klubu siedzi w JSON-LD (`StructuredData`) **poza** `<main>`. Zawężać do konkretnego elementu i sprawdzać kontrolą negatywną (`git stash`), czy asercja nie przechodzi także przed zmianą.

**Dwa testy regresji do wpisania w golden master już teraz.** Oba są dziś odtwarzalne, oba ta specyfikacja ma naprawić — więc muszą zacząć jako czerwone, a skończyć jako zielone:

1. **Szkic z zaznaczonym „Pokaż w menu górnym" nie pojawia się w menu.** Dziś pojawia się i prowadzi do 404, bo `syncNavItem` nie zna kolumny `published` (`actions/customPageActions.ts:33-38`), a nowa podstrona startuje z `initialInMenu={true}`. To najpewniej mechanizm, który wyprodukował zgłoszonego „Testa".
2. **Pozycji menu z href nieodpowiadającym żadnej trasie nie da się zapisać.** Dziś `href` to wolne pole tekstowe bez walidacji — jedna literówka i pozycja menu prowadzi w 404.

### 5.3 Etap 1 — expand: tabela obok, nikt z niej nie czyta

`supabase/03-drzewo-stron.sql`: `pages`, `redirects`, triggery, indeksy, **RLS na obu tabelach**. Publiczna strona i panel działają bez zmian, na `nav_items` i `custom_pages`.

**Plik wkleja właściciel w Supabase SQL Editor** — klucz service-role czyta i zapisuje wiersze, ale DDL nie wykona (PostgREST nie robi `CREATE TABLE`). Dlatego plik musi być kompletny za pierwszym razem; każda pominięta kolumna to druga ręczna wizyta w SQL Editorze.

**Idempotencja — `if not exists` tu nie wystarczy.** Ten plik wnosi do bazy **pierwszy trigger i pierwszą funkcję plpgsql**; w `supabase/setup.sql` i `supabase/02-kosz-i-historia.sql` są wyłącznie anonimowe bloki `do $$`, które można puszczać wielokrotnie za darmo. Funkcje i triggery tak nie działają: drugie uruchomienie `create trigger` przerwie się błędem 42710. Wzorzec obowiązkowy: `create or replace function` dla funkcji, `drop trigger if exists` + `create trigger` dla każdego triggera, `create table if not exists` i `create unique index if not exists` dla resztu.

### 5.4 Etap 2 — backfill

Skrypt `scripts/migrate-pages.mjs`, idempotentny (reguły `ON CONFLICT` niżej — samo `on conflict (full_path) do nothing` **nie zadziała**), wypełnia `pages` z **pięciu** źródeł:

| Źródło | Co powstaje |
|---|---|
| `nav_items` (`parent_id IS NULL`, `href IS NULL`) — dziś **dokładnie jeden** taki wiersz | `kind = 'header'`, „ZAJĘCIA"; `migrated_from = 'nav_items:<uuid>'` (jedyny cel `ON CONFLICT`, bo `full_path` jest NULL) |
| `nav_items` z `href` wskazującym trasę z `EDITABLE_PAGES` albo listing tematyczny | `kind='page'`, `source='route'`, `route = href`, `slug` = ostatni segment |
| `custom_pages` — dziś **3** wiersze (`test`, `ee`, `eee`), **wszystkie w koszu**, żywych **ZERO** (§2.0) | `kind='page'`, `source='db'`, `parent_id = null`, `blocks`/`intro`/`published`/`deleted_at` 1:1; `migrated_from = 'custom_pages:<uuid>'`. Wiersze z koszu przenieść **razem z `deleted_at`** — inaczej `/test`, `/ee`, `/eee` ożyją, a to byłoby **dodanie** adresu wbrew §5.1 |
| `data/articles/*.ts` — 10 artykułów. **To ten sam zbiór adresów, co 10 wierszy `nav_items` z `href`** — skrypt musi o tym wiedzieć, inaczej wyprodukuje 10 duplikatów | `kind='page'`, `source='route'`, `route='/{topic}/{slug}'`, rodzic = węzeł listingu. Pierwszeństwo dla tytułu, w tej kolejności: `label` z `nav_items` → `pages.menu_label` (wersaliki, „MEDYTACJA"; `nav_items` **nie ma** kolumny `menu_label` — kolumny tej tabeli to `id`, `parent_id`, `label`, `href`, `position`, `visible`), potem `title` z `article_overrides`, na końcu `data/articles` („Medytacja"). `cloudinary_folder` = `Strona/{topic}/{slug}` |
| `data/articles/*.ts` — `topicTitle`/`topicIntro` × 3 | `title`/`intro` węzła listingu (`/o-shorinji`, `/organizacja`, `/buddyzm`) |
| **`EDITABLE_PAGES` (`lib/editablePages.ts`) — 8 wpisów.** Piąte źródło, bez którego `/` i `/kontakt` **nie dostają węzła** (nie mają wiersza w `nav_items`), a własne kryterium odbioru etapu 2 nigdy nie będzie puste | `kind='page'`, `source='route'`, `route` **i** `full_path` = `wpis.route`, `content_key = 'page:' + wpis.slug`, `kicker`/`title`/`intro` z `prefillHeader`; `migrated_from = 'editable_pages:<slug>'`. Dla `slug='home'` (`route='/'`) kolumna `slug` zostaje **NULL** (§2.2) |

Reguły backfillu — każda z nich broni przed konkretną, zmierzoną awarią:

- **`position` wyłącznie z `nav_items.position` (× 10), nigdy z `DEFAULT_NAV`.** Kolejność top-level w bazie **różni się** od kodu — baza: AKTUALNOŚCI, O SHORINJI, ZAJĘCIA, PROGRAM NAUCZANIA, ORGANIZACJA, BUDDYZM, GALERIA; kod ma ZAJĘCIA pierwsze (`lib/navTypes.ts:22-62`). To realna decyzja redaktora; zasianie z kodu cofnęłoby ją bez śladu.
- **Nie ma reguły „węzły spoza menu dostają `in_menu = false`".** Zbiór „artykułów tematycznych poza `DEFAULT_NAV`" jest **pusty** — wszystkie 10 siedzi w `nav_items`. Dosłowne wykonanie takiej reguły usunęłoby 10 pozycji z menu. Węzeł dostaje `in_menu = false` tylko wtedy, gdy nie ma dla niego wiersza w `nav_items`.
- **`visible → in_menu`, nigdy `visible → published`.** Dziś `visible = false` ukrywa pozycję **menu**, nie stronę. Pomyłka w tę stronę wyłącza stronę z adresu, czyli robi 404 na zaindeksowanym adresie.
- **Filtr kluczy `site_settings`: `key like 'page:%'` — zakotwiczony.** W bazie są dwa klucze kopii zapasowych (`kopia:page:cennik-przed-migracja-konta`, `kopia:page:kontakt-przed-migracja`); niezakotwiczony wzorzec zassie je jako strony. **Nie sprzątać ich** — to jedyne kopie treści sprzed dwóch migracji.
- **Czwarta reguła mapowania** — dla pozycji menu z `href` nieznanym żadnemu źródłu: `kind='link'` z `external_url`, albo raport „do decyzji redaktora" na konsolę. **Nigdy** `source='route'` (CHECK odrzuci, bo `route` musiałoby wskazywać istniejącą trasę) i **nigdy** ciche pominięcie. Dziś ten zbiór jest pusty — wszystkie 19 hrefów prowadzi do realnej trasy — ale `href` jest wolnym polem tekstowym, więc zbiór może się zapełnić między golden masterem a migracją.
- **`migrated_from` wypełnione dla każdego wiersza**, bez wyjątku — to jest klucz idempotencji i klucz dopasowania dla dwuzapisu z etapu 3a.

**Idempotencja — dwie różne reguły `ON CONFLICT`, nie jedna.** Jedyny unikalny indeks na `full_path` (`pages_full_path_key`) jest **częściowy**, a Postgres nie wywnioskuje celu `ON CONFLICT` z indeksu częściowego bez powtórzenia predykatu — dostaniesz błąd 42P10. Nagłówków i odnośników żaden indeks na adres nie obejmuje, bo mają `full_path` NULL.

```sql
-- strony (kind='page'): predykat indeksu częściowego POWTÓRZONY
insert into public.pages (...) values (...)
on conflict (full_path) where kind = 'page' and deleted_at is null do nothing;

-- nagłówki i odnośniki: po kolumnie migrated_from (§2.2)
insert into public.pages (...) values (...)
on conflict (migrated_from) do nothing;
```

Kontrola poprawności po backfillu — zapytanie musi zwrócić zero wierszy:

```sql
-- każdy adres z sitemapy ma węzeł
select p from unnest(:adresy_z_golden_master) p
 except select full_path from public.pages where kind = 'page' and deleted_at is null;
```

Dodatkowo `select full_path, count(*) from public.pages group by 1 having count(*) > 1` (duplikaty) — analogicznie do ostrzeżenia w nagłówku `setup.sql:66-69`.

Trzy zapytania obowiązkowe, każde musi zwrócić **zero wierszy**:

```sql
-- 1. Adres węzła 'route' jest DOSŁOWNIE trasą z kodu (§2.4, gałąź ADRES).
--    To test tego, że /zajecia/cennik nie zamienił się w /cennik.
select full_path, route from public.pages
 where source = 'route' and full_path is distinct from route;

-- 2. Duplikaty nagłówków i odnośników. Ich nie broni ŻADEN indeks unikalny na adres,
--    bo mają full_path NULL — jedyna ochrona to to zapytanie i pages_migrated_from_key.
select parent_id, menu_label, count(*) from public.pages
 where kind in ('header', 'link') group by 1, 2 having count(*) > 1;

-- 3. Każdy adres z golden mastera ma węzeł.
--    UWAGA: adresy /aktualnosci/<slug> zostają POZA drzewem pages (§2.8),
--    więc trzeba je jawnie wykluczyć, inaczej to kryterium nigdy nie będzie puste.
select p from unnest(:adresy_z_golden_master) p
 where p not like '/aktualnosci/%'
except select full_path from public.pages where kind = 'page' and deleted_at is null;
```

### 5.5 Etap 3a — odczyt menu z drzewa za flagą, i 3b — `Navbar` od zera

Etap 3 rozbija się na dwa **osobne** wdrożenia. 3b to nie rozbudowa `Navbara`, tylko wymiana obu jego widoków (patrz „Dostępność menu" w §3): w **całym** `components/` nie ma ani jednego `aria-expanded`, `aria-controls`, `onKeyDown` ani obsługi Escape, a `Navbar.tsx` nie ma ani jednego `<ul>`/`<li>` (pozostałe komponenty mają — 23 wystąpienia w 9 plikach, m.in. `Footer.tsx`, `ArticlePage.tsx`, `NewsBlocks.tsx`). Zmiana źródła danych i przepisanie renderera w jednym commicie sprawiają, że każdy rozjazd w diffie jest nie do przypisania — a to jest jedyny etap, na którym menu może zniknąć z layoutu na wszystkich trasach.

`lib/navigation.ts` czyta z `pages` (`in_menu and published and deleted_at is null and depth <= 1`), gdy `process.env.DRZEWO_STRON === '1'`; w przeciwnym razie stara ścieżka. Zapis nadal idzie do `nav_items`, a migracja przepisuje `nav_items → pages` przy każdym zapisie (dwuzapis, świadomie tymczasowy). **Dwuzapis robi `upsert` po `migrated_from`, nigdy insert-then-delete.** Dzisiejsze `saveNavTree` wstawia komplet nowych wierszy **przed** usunięciem starych (`actions/navActions.ts:57-121`, ścieżka wycofania `wycofaj()` na `:71-74`), więc przez chwilę w tabeli istnieją **dwa komplety** — wzorzec niekompatybilny z indeksem unikalnym na adres (`pages_full_path_key`), który wywali drugi komplet w połowie zapisu. Warto rozważyć **odwrócenie kierunku**: panel zapisuje do `pages`, a `nav_items` jest z nich odtwarzany. To usuwa problem klucza dopasowania całkowicie. Porównanie `getNavTree()` starego i nowego w jednym renderze pod flagą `DRZEWO_STRON=diff` loguje rozjazd — walidacja zgodności przed cutover, jak w opisie Strangler Fig.

Uwaga wdrożeniowa dla Netlify: zmienna musi być ustawiona dla właściwego kontekstu deployu, inaczej flaga jest niewidoczna w produkcyjnym buildzie (znane z wcześniejszego incydentu z `SUPABASE_SERVICE_ROLE_KEY`).

**Fallback menu — po migracji `DEFAULT_NAV` przestaje wystarczać.** Dziś `getNavTree` oddaje `DEFAULT_NAV` w **czterech** sytuacjach (brak konfiguracji, zero wierszy, puste drzewo, błąd albo timeout 6 s), a `Navbar` ma jeszcze własny fallback po stronie klienta. Po etapach 3 i 4 z bazy pochodzą nie tylko etykiety, ale **całe drzewo adresów**: jedna brakująca zmienna środowiskowa gasi menu w layoucie i daje 404 na wszystkich stronach z catch-alla. To nie jest hipoteza — incydent `PGRST303 „JWT issued at future"` przy zimnym starcie zdarzył się 2026-08-12 i zrzucił `getNavTree`, `getSchedule` i `getNews` na fallback z kodu.

Dwa wymogi, oba obowiązkowe:

1. **Nowa ścieżka odczytu odtwarza wszystkie cztery gałęzie fallbacku.** Trzy z nich (zero wierszy, puste drzewo, brak konfiguracji) łatwo zgubić przy przepisywaniu, bo wyglądają na „to samo co błąd".
2. **Źródłem fallbacku nie może być `DEFAULT_NAV`** — po migracji przestanie odzwierciedlać drzewo i będzie kłamał tym goręcej, im więcej redaktor zmieni. Fallbackiem ma być **statyczny zrzut drzewa w repo**, generowany **tym samym skryptem** co golden master (`scripts/snapshot-tree.mjs`), regenerowany po każdej większej zmianie struktury. Pliku zrzutu **nie kłaść** pod `app/` ani `components/` — `app/globals.css` ma `source(none)` + jawne `@source`, a plik jest pełen ścieżek, czyli materiał na powrót awarii `\1608be` opisanej w `CLAUDE.md`.

### 5.6 Etap 4 — routing

**Czego NIE trzeba obsługiwać (zmierzone, żeby nikt nie dopisywał niepotrzebnego kodu):** ukośnik końcowy i wielkość liter nie są pułapką. `/kontakt/` → **308 na `/kontakt`** (Next normalizuje przed routingiem, catch-all tego nie widzi), `/Kontakt` → **404**. Czyli `full_path` nigdy nie potrzebuje wariantu z ukośnikiem, a `redirects.old_path` można trzymać bez niego — i CHECK `old_path ~ '^/'` z §2.5 wystarcza.

Nowa trasa `app/[...sciezka]/page.tsx` (**wymagany** catch-all, nie opcjonalny — `[[...sciezka]]` kolidowałby z `app/page.tsx`). Zastępuje `app/[slug]/page.tsx`.

```
1. sciezka.join('/')  →  '/' + ...
2. select * from pages where full_path = $1 and published and deleted_at is null
3. znaleziono i source='db'   → renderuj (nagłówek + bloki + kafelki dzieci)
4. znaleziono i source='route'→ notFound()  // trasa statyczna i tak ma pierwszeństwo
0. GUARD, PRZED jakimkolwiek zapytaniem do bazy:
     pierwszy segment w RESERVED_SLUGS  → notFound()
     segment niepasujący do ^[a-z0-9-]+$ → notFound()
   Dziś /admin/typo i /api/foo dają 404 — w repo nie ma jeszcze trasy catch-all.
   Po etapie 4 bez tego guarda oba oddadzą 200 (sprawdzone w audycie na
   tymczasowej trasie catch-all).
   Bez guarda każda literówka w adresie panelu renderuje PUBLICZNY layout
   i wykonuje dwa zapytania do bazy; to samo robi każde 404 od skanera
   (/wp-login.php, /.env) na nieograniczonym zbiorze ścieżek, na uśpionym
   projekcie, z revalidate=300 na każdym śmieciu.
5. nie znaleziono            → select new_path, status from redirects
                                  where old_path = $1 limit 1
                               → permanentRedirect(new_path)  albo  notFound()
6. BŁĄD albo TIMEOUT odczytu → rzuć wyjątek (500). NIGDY notFound().
   Dzisiejszy wzorzec (lib/customPages.ts:47-52 → app/[slug]/page.tsx:30) zamienia
   timeout Supabase w 404 cache'owany przez ISR na 300 s. Po etapie 4 objęłoby to
   CAŁE drzewo treści, a taki 404 może zostać zaindeksowany. Przy 500 Google trzyma
   w indeksie poprzednią wersję i wraca później.
   Każdy `select` sprawdza `error`, nie tylko `data`.
```

Trasy statyczne (`app/kontakt`, `app/zajecia/cennik`, `app/o-shorinji/[slug]`…) mają w Next pierwszeństwo przed catch-all, więc działają dalej bez zmian.

**Ale pierwszeństwo blokuje przekierowania — i to tylko w czterech miejscach.** Catch-all przechwytuje wszystko poza **dynamicznym dzieckiem `[slug]`**; statyczny prefiks go nie zasłania. Zmierzone: `/program-nauczania/uczniowskie/6-kyu` → **200 z catch-alla**, czyli flagowa funkcja tej specyfikacji (trzeci poziom z bazy) działa, a `/zajecia/*`, `/program-nauczania/*` i `/kontakt/*` dostają przekierowania **za darmo**. Obsługę `redirects` w gałęzi `notFound()` trzeba dołożyć w **dokładnie czterech** trasach `[slug]`: `o-shorinji`, `organizacja`, `buddyzm`, `aktualnosci`. Middleware nadal odrzucone (§8).

**ROZSTRZYGNIĘTE 2026-08-18 (etap 0b): aktualności dostają przekierowania tak samo jak strony. Nie zostawiamy tego jako ograniczenia.** Właściciel: „aktualności nie są krótkotrwałe, mają działać jak wpisy na WordPressie, to taka historia".

Do rozwiania nieporozumienia, bo pytanie było zasadne: **aktualności działają i działać będą** — mają własną tabelę `articles`, własne trasy i zostają nietknięte przez tę migrację (§2.8). Jedyna dziura dotyczyła **zmiany adresu istniejącego wpisu**: po edycji sluga stary, zaindeksowany i rozesłany adres przestawał prowadzić gdziekolwiek, bo aktualności są poza drzewem `pages`, a więc poza triggerem, który zapisuje przekierowania automatycznie.

Wykonanie — dwie połowy, obie w etapie 4:

1. **Odczyt:** `app/aktualnosci/[slug]/page.tsx` przed `notFound()` sprawdza `redirects` po `old_path` (tak samo jak trzy trasy tematyczne). Tabela `redirects` jest generyczna — trzyma pary adresów, nie odwołania do `pages` — więc obsłuży wpisy bez żadnej zmiany schematu.
2. **Zapis:** akcja zapisu aktualności, gdy `slug` się zmienił, wstawia wiersz `redirects` (`/aktualnosci/<stary>` → `/aktualnosci/<nowy>`, `kind='manual'`, 308) i rewaliduje **oba** adresy. Trigger tego nie zrobi, bo dotyczy tylko `pages` — to jawne kilka linii w akcji.

Skasowany wpis to osobna sprawa i tu nic nie obiecujemy automatycznie: usunięcie treści ma dawać 404, chyba że redaktor sam wskaże adres zastępczy. Warto mu to udostępnić w tym samym ekranie — jedno pole „przekieruj stary adres na", które zapisuje wiersz `redirects`.

**Catch-all dostaje `generateStaticParams`** czytające `pages` na buildzie. Dziś `/buddyzm/[slug]`, `/o-shorinji/[slug]` i `/organizacja/[slug]` są `● SSG` z `Revalidate 1h / Expire 1y` — HTML leży w artefakcie deployu, więc przy awarii bazy Netlify podaje kompletną, przestarzałą stronę. Catch-all bez `generateStaticParams` jest `ƒ Dynamic`: pierwsze żądanie po **każdym** deployu to zimny SSR do uśpionego Supabase. To realny mechanizm odpalania incydentu `PGRST303` z zimnego startu — nie raz na rok, a po każdym wdrożeniu.

**Przekierowania rozwiązujemy w tej trasie, nie w middleware.** Middleware wykonuje się dla każdego żądania i musiałby odpytywać Supabase kluczem service-role na krawędzi; tutaj zapytanie o `redirects` leci wyłącznie dla adresów, które nie trafiły w żadną stronę, a wynik jest objęty ISR (`export const revalidate = 300`, tak jak dziś `app/[slug]/page.tsx:12`). Z dwóch reguł w `next.config.ts:26-40` do `redirects` przenosi się **wyłącznie `/cennik`** (jako `source='manual'`, `status = 307` — realny kod, bo `permanent: false`), i dopiero po potwierdzeniu, że nowa ścieżka działa.

**Reguła `/organizacja/zalozyciel-i-wsko` (308) zostaje w `next.config.ts`.** Ten adres **nigdy nie dotrze do catch-alla**: `app/organizacja/[slug]/page.tsx:41` dopasuje go pierwszy i zrobi `notFound()`. Usunięcie reguły zamienia działające 308 w twarde 404 na zaindeksowanym adresie.

Brakujący `app/not-found.tsx` (A: „w repo nie ma własnego `app/not-found.tsx`") dokładamy **w tym etapie** — nie w etapie 0, bo własna strona 404 zmienia treść odpowiedzi dla każdego martwego adresu, czyli zmienia punkt odniesienia golden mastera (§5.2). Dziś każdy martwy link kończy się domyślną stroną Next bez powrotu do serwisu.

**Indeksowanie.** `app/robots.ts` nie wyklucza **niczego** (`allow '/'`, zero `disallow`), a `app/layout.tsx:55-58` daje `index: true` site-wide. Po tym etapie catch-all obsługuje nieograniczony zbiór ścieżek, więc: dołożyć `disallow` dla `/admin`, i upewnić się, że `published = false` **nie produkuje strony indeksowalnej** (guard z algorytmu wyżej + brak wpisu w sitemapie to nie to samo co `noindex`).

### 5.7 Etap 5 — panel

Nowa zakładka „Strony i menu" pod flagą, obok starych dwóch. Po tygodniu pracy właściciela na nowej — usunięcie starych.

**Co ten etap musi objąć poza samym drzewem:**

- **Edytor treści to `BlockEditor`** (984 linie, 16-17 typów bloków, czysty kontrakt `value`/`onChange`, pasuje do `pages.blocks` 1:1) — **nie** `PageBlocksEditor`, który jest kompletnym ekranem przywiązanym do `site_settings` przez `savePageContent`, z własnym paskiem zapisu.
- **Ekran kosza drzewa stron i historii wersji.** Oba mechanizmy **istnieją w bazie i nie istnieją w panelu**: `listTrashedCustomPages` / `restoreCustomPage` / `purgeCustomPage` nie są nigdzie importowane, `TrashSection` jest podłączony tylko do aktualności, a kontrakt się nie zgadza (`{pages}` vs `{items}`), więc `oproznijStaryKosz("custom_pages")` **nigdy się nie wykonuje**. `content_versions` istnieje, ma **0 wierszy** i kolumnę `entity_key`; `zapiszWersje` wołane wyłącznie dla aktualności, `historia()` bez ani jednego konsumenta. Dobra wiadomość: `entity_type = 'page_node'` **nie wymaga DDL**.
- **Przywracanie z kosza sprawdza kolizję `full_path` samo**, bo `pages_full_path_key` jest indeksem częściowym (`where deleted_at is null`) i strony w koszu nie blokują adresu (§2.2).
- **Akcja zmieniająca `full_path` liczy wystąpienia starej ścieżki w `pages.blocks` i w `site_settings`** (stopka) i pokazuje je redaktorowi **obok** liczby dotkniętych adresów. `components/NewsBlocks.tsx:36-51` renderuje `[etykieta](/adres)` z treści jako zwykły `<a href>` — bez walidacji, bez lintera, bez testu. Istniejące wystąpienia: `data/articles/organizacja.ts:26`, `data/articles/buddyzm.ts:111`, `lib/editablePages.ts:35,38,41,44,246,249` (9 wystąpień w 6 liniach). `redirects` ich **nie uratuje** pod prefiksami statycznymi.
- **Panel blokuje kombinację `in_menu = true` + `published = false` przy zapisie**, z wyjaśnieniem — a nie tylko filtruje ją przy odczycie. To ta sama zasada, co przy `depth = 2`: system nie może po cichu nie robić tego, co redaktor ustawił.
- **Dostęp: `requireUser()` sprawdza tylko, czy ktoś jest zalogowany, bez allowlisty.** Po scaleniu tabel ta sama dziura przestaje dotyczyć etykiet menu i zaczyna dotyczyć **treści stron oraz struktury adresów** całego serwisu. **ROZSTRZYGNIĘTE 2026-08-18 (etap 0b): allowlista kont admina wchodzi jako osobne, niezależne zadanie PRZED etapem 5** — nie jako część migracji, ale też nie „kiedyś". Warunek wejścia do etapu 5: panel, który dostaje władzę nad strukturą adresów, sprawdza nie tylko „czy zalogowany", ale „czy uprawniony".

### 5.8 Etap 8 — contract

Kolejno: usunięcie `NavEditor.tsx`, `saveNavTree`, `syncNavItem`, zakładki „Menu na górze strony", potem `drop table nav_items`, `drop table custom_pages`, `drop table article_overrides`. Termin: ten sam kwartał, **wpisany w kalendarz**. Zostawienie obu ścieżek na stałe jest gorsze niż punkt startowy.

**Lista jest niepełna: `nav_items` czyta w repo sześć miejsc, nie trzy, a tabel skazanych na `drop` dotyka około dziesięciu server actions.** Cztery pominięte pozycje — każda wywala ekran w runtime, nie na buildzie:

- `app/admin/(panel)/wlasne/[id]/page.tsx:22-27` — `select nav_items` po `href` dla checkboxa, `.maybeSingle()` **bez obsługi `error`**, jedyne czytanie poza akcją z `requireUser`. `drop table` **wywali edycję każdej własnej podstrony**, a błąd wyjdzie dopiero w runtime, bo `maybeSingle` zwraca `{data: null}` i checkbox po cichu przestaje odzwierciedlać stan.
- `app/admin/(panel)/nawigacja/page.tsx:5-30` — **druga, niezależna** implementacja składania drzewa, ze ścieżką awaryjną na `getNavTree`.
- `app/admin/(panel)/edit/[topic]/[slug]/` + `EditorForm` + `saveTopicArticle` (`app/admin/actions.ts:9-33`). Po `drop table article_overrides` ten ekran **nie przestanie się renderować** (dane bazowe ma z kodu), tylko będzie **zapisywać w pustkę** — najgorszy możliwy wariant dla redaktora, który właśnie przepisał tekst.
- `actions/migrateActions.ts` (`migrateAllContent`) — zero konsumentów, robi to samo co skrypt migracji, ale do **starych** tabel (patrz §6 pkt 6).

Dwa sprzątania do tej samej listy:

- Usunąć `normalizeNavTree` (`lib/navigation.ts:17-42`) razem ze starą ścieżką odczytu i **przenieść regułę `/cennik` → `/zajecia/cennik` do `redirects`** jako `manual` 307.
- Poprawić **kłamliwe komentarze** w `supabase/setup.sql:426-439`, które twierdzą, że zapis menu to „delete-all + reinsert". Kod robi odwrotnie od dawna (insert-then-delete, `actions/navActions.ts:57-121`) — i to z tych komentarzy wzięła się fałszywa teza w pierwszej wersji tej specyfikacji.

### 5.9 Adresy już zaindeksowane — osobno

1. **Nic nie znika w migracji.** Lista adresów z `golden-master-przed.json` jest kontraktem; różnica po każdym etapie musi być pusta.
2. **Zmiana sluga przez redaktora zawsze zostawia ślad.** Trigger z 2.4 zapisuje 308 automatycznie — redaktor nie musi o tym wiedzieć ani niczego zaznaczać. Google traktuje 308 jak 301.
3. **Bez łańcuchów.** Przy drugiej zmianie tego samego adresu trigger aktualizuje istniejące wiersze zamiast dokładać kolejne ogniwo, i kasuje wiersz, który zaczął wskazywać sam na siebie.
4. **Przeniesienie węzła w drzewie zmienia adresy całego poddrzewa** — trigger AFTER UPDATE przelicza potomków, a każdy z nich generuje własny wpis w `redirects`. Panel pokazuje to przed zapisem: „Zmiana dotknie 4 adresów. Stare adresy będą przekierowane."
5. **Sitemapa idzie z drzewa — i musi się odświeżać.** `app/sitemap.ts` dostaje `export const revalidate = 300` **oraz** rewalidację w akcjach zapisu drzewa. Bez tego nowa podstrona nie pojawi się w `sitemap.xml` do następnego deployu, czyli jeden z czterech obiecanych problemów zostaje nierozwiązany. Osobna decyzja przy przepisywaniu: `content-fallback/articles.json` karmi dziś sitemapę (`app/sitemap.ts:42` → `getNews()` → `lib/news.ts:38`), więc usunięta albo wycofana aktualność **wraca** do `sitemap.xml` przy każdym nieudanym odczycie bazy.
6. **Rewalidacja — bez tagów, bo tagów w tym repo nie ma.** W repo jest **zero** trafień na `revalidateTag` i **zero** na `unstable_cache`; całe unieważnianie stoi na `revalidatePath` z literałami. „Rewalidacja poddrzewa" nie ma więc na czym stanąć jako pojęcie — akcja musi **sama wyliczyć** listę ścieżek: stare i nowe `full_path` węzła **oraz każdego potomka**, i zawołać `revalidatePath` dla każdej z osobna, plus `revalidatePath('/', 'layout')` (menu jest w layoucie). Bez tego strony z `revalidate = 300/3600` trzymają nieaktualne menu i stary adres do pięciu minut albo godziny (A: `app/buddyzm/page.tsx:9` → 3600).

---

## 6. Nagłówki stron-listingów

Problem: `topicTitle`/`topicIntro` żyją wyłącznie jako literały w `data/articles/{o-shorinji,organizacja,buddyzm}.ts`; `resolveArticleGroup` nadpisuje tylko pola pojedynczych artykułów i przepuszcza nagłówek tematu bez podmiany (`lib/articleContent.ts:95-106`), a `metadata` w `app/o-shorinji/page.tsx:11-14` czyta wprost obiekt bazowy, więc nawet SEO title jest nieedytowalny.

Rozwiązanie wynika z modelu i nie wymaga osobnego mechanizmu: **`topicTitle` to `pages.title` węzła listingu, `topicIntro` to `pages.intro`, kafelki to dzieci tego węzła.**

Kroki:

1. **Backfill** (krok 5.4) tworzy trzy węzły: `/o-shorinji`, `/organizacja`, `/buddyzm` z `title`/`intro` przepisanymi z literałów, oraz 10 węzłów-dzieci z `title`/`intro` artykułów. Wartości `title`/`intro` dzieci biorą pierwszeństwo z `article_overrides`, jeśli tam są — inaczej migracja cofnęłaby zmiany już wprowadzone przez redaktora.

2. **`components/ArticleListing.tsx`** przestaje przyjmować `ArticleGroup`, a zaczyna przyjmować `{ node, children }` z `pages`. Kod komponentu zmienia się minimalnie: `group.topicTitle → node.title`, `group.topicIntro → node.intro`, `group.articles.map → children.map`, `${baseHref}/${a.slug} → dziecko.full_path`. Dodatkowo między nagłówkiem a kafelkami wchodzi `<NewsBlocks blocks={node.blocks} />` — dzięki temu listing może mieć własną treść nad kafelkami, czego dziś nie ma wcale.

3. **`app/o-shorinji/page.tsx`, `app/organizacja/page.tsx`, `app/buddyzm/page.tsx`** czytają węzeł po `full_path` i budują metadane z jego `title`/`intro`, **plus brakujący `alternates.canonical` z `node.full_path`** — te trzy listingi go dziś nie mają (`app/o-shorinji/page.tsx:11-14` i bliźniacze). **To nie jest „po kilka linii każdy":** wszystkie trzy pliki mają **statyczny** `export const metadata`, więc wpięcie odczytu z bazy wymaga zamiany na `generateMetadata`. Oczekiwany skutek uboczny do zapisania: lista w panelu (`app/admin/(panel)/strony/page.tsx:110`) pokazuje dziś tytuły artykułów **z kodu**, nie z nadpisań, więc redaktor szuka strony po nazwie, której sam nie używa — po tym etapie zaczyna widzieć swoje. Docelowo te trzy trasy znikają i obsługuje je catch-all, ale to nie musi zdarzyć się w tym samym etapie.

4. **Panel** nie dostaje żadnego nowego ekranu — „O Shorinji Kempo" jest w drzewie zwykłym wierszem, klik w tytuł otwiera ten sam edytor co dla każdej innej strony. Znika dzisiejsza asymetria z `app/admin/(panel)/strony/page.tsx:96-123`, gdzie `topicTitle` był tylko statycznym nagłówkiem sekcji bez linku do edycji.

5. **Kolejność i zestaw kafelków** stają się edytowalne za darmo — to jest `position` i `parent_id` dzieci, przestawiane przeciąganiem. Dziś jedno i drugie jest w kodzie (`lib/articleContent.ts:89-91`: „Z kodu pochodzi nadal kolejność, slugi i zestaw artykułów").

6. **Treść samych artykułów tematycznych** (`sections` z `data/articles`, nadpisania w `article_overrides`) przenosi się do `pages.blocks` w osobnym etapie (7). To **przepisanie szablonu**, nie przeniesienie treści — cztery rzeczy, każda obowiązkowa:

   - **Backfill woła `overrideToBlocks(wiersz)`, nigdy `wiersz.blocks`.** W bazie jest `buddyzm/medytacja` z **`body_md` o długości 13 131 znaków** i `blocks = NULL` — największy pojedynczy artefakt redakcyjny w całej bazie. Kopiowanie samej kolumny `blocks` **cicho go wyzeruje**, a wyjdzie to dopiero po `drop table article_overrides`, kiedy źródła już nie ma. Zapytanie kontrolne **przed** jakimkolwiek `drop`, musi zwrócić zero wierszy po backfillu: `select topic, slug from article_overrides where blocks is null and body_md is not null;`
   - **Trasa catch-all musi odtworzyć cztery mechanizmy z `components/ArticlePage.tsx`:** galerię z Cloudinary (folder z kolumny `cloudinary_folder`, §2.2), spis treści z bloków `heading`, nawigację poprzedni/następny (zapytanie o rodzeństwo po `(parent_id, position)` — przepis z §5.6 przewiduje **jedno** `SELECT` po `full_path`, to za mało) oraz `canonical`.
   - **Ten etap przenosi 10 podstron tematycznych z grupy „zawsze mają treść" do grupy „puste bez bazy".** Dziś `lib/articleContent.ts:139` daje `overrideToBlocks(ov) ?? sectionsToBlocks(base.sections)`; przy zerowym env `/o-shorinji/wprowadzenie` oddaje 64 KB treści, `/buddyzm/medytacja` 85 KB. Zdanie, że `data/articles/*.ts` „zostaje wyłącznie jako `content-fallback`", jest **fikcją** — po usunięciu tras nikt tego pliku nie czyta. **ROZSTRZYGNIĘTE 2026-08-18 (etap 0b): zapas treści zostaje w kodzie, ale jako GENEROWANY zrzut, nie ręcznie utrzymywana druga kopia.** Właściciel: „chyba lepiej, żeby jakaś podstawa była faktycznie w kodzie, szczególnie pod Google i SEO". Konwencja projektu (`working-agreement.md`) wymaga fallbacku od zawsze, a poprawka z 2026-08-12 dodała go do ośmiu tras dokładnie dlatego, że HTTP 200 z pustym `<main>` jest gorsze od 500: przy 500 Google trzyma w indeksie poprzednią wersję i wraca później, a 200 z pustą stroną czyta jako „ta strona teraz tak wygląda".

     Wykonanie — trzy zasady, żeby nie powstały dwa źródła prawdy:

     1. **Jeden plik, generowany skryptem:** `scripts/zrzut-tresci-fallback.mjs` czyta `pages` i zapisuje `content-fallback/pages.json` (`full_path` → `title`, `kicker`, `intro`, `blocks`). Plik **wchodzi do repozytorium**, więc jedzie w artefakcie deployu i jest dostępny bez sieci.
     2. **Nikt go nie edytuje ręcznie.** Nagłówek pliku mówi, którym skryptem i kiedy powstał. Ręczna zmiana w nim to dokładnie ten sam błąd „treść w dwóch miejscach", od którego uciekamy — źródłem prawdy zostaje baza.
     3. **Odświeżanie:** skrypt w `package.json` (np. `npm run zrzut-tresci`) uruchamiany przed deployem i po większych zmianach redakcyjnych. Zrzut starszy niż zawartość bazy jest **nadal dobrym fallbackiem** — pokazuje treść z zeszłego miesiąca, nie pustą stronę.

     Trasa catch-all czyta ten plik **wyłącznie** wtedy, gdy odczyt z bazy zwrócił „brak konfiguracji" — nigdy przy błędzie odczytu (błąd → 500, §8) i nigdy przy świadomie wyczyszczonej treści. Ta sama logika, co w `components/PageContent.tsx` po poprawce z 12.08.

     Dlaczego nie `data/articles/*.ts` jako fallback: te pliki opisują **stare** trasy `{topic}/[slug]`, nie adresy z drzewa, a po etapie 7 nikt ich nie czyta. Zdanie ze §6.6, że „zostają wyłącznie jako `content-fallback`", było fikcją — dlatego zapas ma powstać z bazy, a stare pliki znikają razem z trasami.
   - **Usunąć `actions/migrateActions.ts` (`migrateAllContent`).** Nie ma w repo ani jednego konsumenta, a robi to samo co nowy skrypt migracji, tylko do **starych** tabel — zostawiona po etapie 8 jest miną, która cofnie migrację treści.

   Sama treść jest bezpieczna: publiczna strona **już dziś** renderuje `sectionsToBlocks(base.sections)`, nigdy surowych sekcji (`lib/blockConvert.ts`, używany w `lib/articleContent.ts:121,139`), więc przepisanie do `pages.blocks` nie zmieni ani piksela. Po tym etapie `source` tych 10 węzłów zmienia się z `route` na `db` i znikają katalogi `app/o-shorinji/[slug]` i bliźniacze.

---

## 7. Podział na etapy

Etapy są uporządkowane zależnościami, nie wyceną — kolumna „Punkt kontrolny" mówi, po czym poznać, że etap jest skończony. Każdy etap kończy się uruchomieniem `scripts/snapshot-tree.mjs` i porównaniem z golden masterem; różnica musi być pusta albo świadomie wyjaśniona.

**Przed pierwszym zapisem do bazy:** zrzut wszystkich tabel do JSON (`shorinji-notes/db-backup-<data>/`, wzorzec z 2026-07-30). To jedyna realna droga odwrotu — kosz i `content_versions` nią nie są (§8).

| # | Etap | Zakres | Punkt kontrolny | Wycofanie |
|---|---|---|---|---|
| 0a | **Zrzut stanu** | `scripts/snapshot-tree.mjs` (19 źródeł adresów, odmowa zapisu bez env, normalizacja origin, zrzut pod produkcyjnym buildem), `docs/golden-master-przed.json`. **Bez `app/not-found.tsx`** — przeniesiony do etapu 4 | plik istnieje, obejmuje wszystkie 19 źródeł, dwa testy regresji z §5.2 są w nim **czerwone** | nic do wycofania |
| 0b | **Rozstrzygnięcia** | poprawki §2.2, §2.4, §5.4 wpisane do tej specyfikacji, bez kodu | `supabase/03-drzewo-stron.sql` da się napisać bez ani jednego pytania otwartego | nic do wycofania |
| 1 | **Expand — schemat** | `supabase/03-drzewo-stron.sql`: `pages`, `redirects`, indeksy (w tym `pages_migrated_from_key`), trigger, **RLS na obu tabelach, zero polityk**. Idempotentny: `create or replace function` + `drop trigger if exists`. **Wkleja właściciel w SQL Editorze**, więc plik musi być kompletny za pierwszym razem. Kod nie dotyka nowych tabel | plik puszczony **dwa razy** pod rząd przechodzi bez błędu; `pages` i `redirects` mają `relrowsecurity = true` i zero polityk | `drop table` — aplikacja nic o nich nie wie |
| 2 | **Backfill** | `scripts/migrate-pages.mjs`, **5 źródeł** (§5.4), idempotentny po `full_path` i `migrated_from`, + zapytania kontrolne. Nadal nikt nie czyta | trzy zapytania kontrolne z §5.4 zwracają zero wierszy; `select ... where source='route' and full_path is distinct from route` jest puste | `truncate pages` i ponowne uruchomienie |
| 3a | **Menu z drzewa** | `lib/navigation.ts` + `lib/navTypes.ts` za flagą `DRZEWO_STRON`; dwuzapis **upsertem po `migrated_from`**; statyczny zrzut drzewa jako fallback zamiast `DEFAULT_NAV`; cztery gałęzie fallbacku odtworzone | `DRZEWO_STRON=diff` nie loguje ani jednego rozjazdu; menu działa przy zerowym env | flaga na `0` |
| 3b | **`Navbar` od zera** | oba widoki przepisane na wzorzec disclosure: `<nav>` + `<ul>/<li>`, link + **osobny** przycisk z `aria-expanded`/`aria-controls`, klik zamiast hover, Escape zamyka i oddaje fokus. Węzeł bez adresu i bez widocznych dzieci nie trafia do drzewa | po renderze `--nav-h` ≠ `200px` na wszystkich trasach; zero `<Link href={undefined}>`; menu obsługiwalne z klawiatury | rewert komponentu, dane w `pages` zostają |
| 4 | **Routing + przekierowania** | `app/[...sciezka]/page.tsx` zastępuje `app/[slug]`; **wczesny guard przed zapytaniem**; `generateStaticParams` z `pages`; obsługa `redirects` w catch-allu **i w czterech trasach `[slug]`**; błąd odczytu → 500, nigdy `notFound()`; `app/sitemap.ts` z drzewa + `revalidate = 300`; `disallow /admin` w `app/robots.ts`; `app/not-found.tsx`; przeniesienie **jednej** reguły (`/cennik`, 307) z `next.config.ts` | `/admin/typo` i `/api/foo` → nadal 404 (dziś 404; bez guarda po tym etapie dałyby 200); `/organizacja/zalozyciel-i-wsko` → nadal 308; catch-all jest `● SSG`, nie `ƒ Dynamic` | przywrócenie `app/[slug]`, reguła wraca do `next.config.ts` |
| 5 | **Panel: „Strony i menu"** | nowa zakładka za flagą: drzewo z wcięciami, przeciąganie + przyciski wyżej/niżej/wsuń/wysuń, okno dodawania z trzema typami, podgląd adresu, dwa przełączniki widoczności, dialog usuwania z listą potomków, punktowe `UPDATE` zamiast delete-all, `BlockEditor` jako edytor treści. **Plus: ekran kosza drzewa i historii wersji** (`entity_type='page_node'`, bez DDL), sprawdzanie kolizji `full_path` przy przywracaniu, liczenie wystąpień starej ścieżki w `pages.blocks` i `site_settings`, blokada `in_menu=true` + `published=false` | właściciel dodaje podstronę trzeciego poziomu, przestawia ją i przywraca z kosza bez pomocy programisty | flaga na `0`, stare zakładki wciąż działają |
| 6 | **Listingi** | `ArticleListing` na węzłach `pages`; `title`/`intro`/`blocks` listingów edytowalne; **statyczny `export const metadata` w trzech plikach zamieniony na `generateMetadata`** (inaczej odczytu z bazy nie da się wpiąć) + brakujący `alternates.canonical` | trzy listingi mają `canonical`; zmiana `topicTitle` z panelu widoczna w `<title>` | rewert komponentu, dane w `pages` zostają |
| 7 | **Treść artykułów tematycznych — przepisanie szablonu** | `article_overrides` (przez **`overrideToBlocks`**, nie `wiersz.blocks`) + `data/articles` → `pages.blocks`; `source` z `route` na `db`; catch-all odtwarza **cztery** mechanizmy `ArticlePage` (galeria Cloudinary z `cloudinary_folder`, spis treści, poprzedni/następny po `(parent_id, position)`, `canonical`); decyzja o fallbacku treści; usunięcie `app/{topic}/[slug]` i `actions/migrateActions.ts` | `select topic, slug from article_overrides where blocks is null and body_md is not null` puste; długość tekstu w `<main>` na `/buddyzm/medytacja` zgodna z golden masterem | `source` z powrotem na `route`, katalogi wracają |
| 8 | **Contract** | usunięcie `NavEditor`, `syncNavItem`, `saveNavTree`, `normalizeNavTree`, starych zakładek **oraz czterech pominiętych ekranów z §5.8** (`wlasne/[id]`, `nawigacja`, `edit/[topic]/[slug]` + `saveTopicArticle`, `migrateActions`); poprawienie kłamliwych komentarzy w `supabase/setup.sql:426-439`; `drop table nav_items, custom_pages, article_overrides`; usunięcie flagi. **Ma mieć datę w kalendarzu** | zero trafień na `nav_items`, `custom_pages`, `article_overrides` w repo **przed** `drop table`; 19 adresów `/admin/*` odpowiada tym samym kodem co w golden masterze | ostatni punkt bez łatwego odwrotu — dopiero po tygodniu pracy właściciela na nowym panelu |
| 9 | **Sekcje przesuwalne z panelu** | sześć nazwanych sekcji (formularz, mapa, grafik, pasek aktualności, galeria folderowa, kafelki CTA) jako nowe typy bloków; konwersja trasa-po-trasie w kolejności z §9.3. **Osobny zrzut kontrolny — golden master migracji zostaje nietknięty.** Ma mieć datę w kalendarzu | właściciel przestawia formularz nad mapę bez pomocy programisty; zapas treści w kodzie zachowany dla każdej konwertowanej trasy | rewert pliku trasy — dopóki stary plik układu nie został skasowany |

Etapy 0a–2 są **niewidoczne dla użytkowników** i można je wdrożyć w dowolnym momencie — nic z kodu nie czyta nowych tabel. Pierwszy widoczny efekt (trzy poziomy, dodawanie pod istniejącą pozycją) pojawia się po etapie 5. Etap 8 jest jedynym bez łatwego odwrotu i dlatego ma dostać termin: przerwana migracja jest **gorsza od punktu wyjścia**, bo trzeba utrzymywać dwie ścieżki kodu nad jedną treścią.

Etapy 6 i 7 można odłożyć w czasie bez szkody — po etapie 5 zgłoszone problemy 1, 2 i 3 są rozwiązane, problem 4 (nagłówki listingów) czeka na etap 6.

Etap 9 jest osobną pracą i **nie należy do tej migracji** — wchodzi po zamknięciu fazy contract, z własnym zrzutem kontrolnym. Uzasadnienie i zbiór sekcji: §9.

---

## 8. Ryzyka i czego nie robić

**Nie tworzyć osobnej tabeli `nav_items` synchronizowanej triggerem z `pages`.** To ten sam błąd, tylko przeniesiony z panelu do bazy — nadal dwa miejsca do aktualizacji i nadal możliwy rozjazd. Pozycja w menu ma być kolumną wiersza strony (R, krytyczna; pułapka wymieniona wprost).

**Nie tworzyć strony-placeholdera, gdy redaktor doda pozycję menu bez celu.** Pusta, żywa strona jest gorsza od martwego linku, bo trzeba ją potem wytropić i skasować. W nowym modelu problem nie występuje: pozycja bez własnej strony to jawny `kind='header'`.

**Nie zostawiać `ON DELETE CASCADE`.** Dziś jest (`supabase/setup.sql:411`) i przy scaleniu tabel przestaje dotyczyć samego menu, a zaczyna dotyczyć treści — jedno kliknięcie kasowałoby „Program nauczania" razem z „Uczniowskie" i wszystkimi kyu.

**Nie robić trzeciego poziomu jako dropdown w dropdownie.** Poza rekomendacją NN/g jest twardy koszt: `Navbar.tsx` ma dwie niezależne gałęzie renderowania (desktop `:99-160`, mobile `:189-227`), obie bez rekurencji, plus problem przekątnej i obsługa dotyku dla zagnieżdżonego panelu.

**Nie zapisywać drzewa hurtem — punktowe `UPDATE` na przeniesionym węźle i jego rodzeństwie.** Uwaga na brzmienie: `saveNavTree` **jest już naprawiony** i nie robi delete-then-insert. Robi insert-then-delete ze ścieżką wycofania (`actions/navActions.ts:57-121`, `wycofaj()` na `:71-74`), a stary komentarz opisujący „delete-all + reinsert" (`supabase/setup.sql:426-439`) jest nieaktualny i wprowadza w błąd. Zalecenie zostaje, zmienia się **uzasadnienie**: dzisiejszy wzorzec trzyma przez chwilę **dwa komplety wierszy** jednocześnie, więc jest niekompatybilny z indeksem unikalnym na adres (`pages_full_path_key`) — drugi komplet wywali się w połowie zapisu. Przy scalonej tabeli taka pomyłka dotyczy treści stron, nie tylko etykiet.

**Nie polegać na `next.config.ts` redirects dla adresów zmienianych z panelu.** Reguły są kompilowane przy buildzie; instruktor bez dewelopera nie wywoła redeploya, więc każda zmiana sluga dawałaby 404 z wyników Google.

**Nie rozwiązywać przekierowań w middleware.** Middleware biegnie dla każdego żądania i wymagałby dostępu do Supabase kluczem service-role poza środowiskiem Node; zapytanie w trasie catch-all wykonuje się wyłącznie dla nietrafionych adresów i jest objęte ISR.

**Nie używać `blocksToSections` nigdzie w migracji.** `lib/blockConvert.ts:70-127` zwija `callout` w `quote` i **wyrzuca** `gallery`, `table`, `links`, `video`, `download`, `person`, `bank` i `kontakt` przez `default: break`. W repo nie ma dziś ani jednego wołania tej funkcji i tak ma zostać — w migracji wyłącznie kierunek `sections → blocks` (`sectionsToBlocks`, `overrideToBlocks`). Konwersja w drugą stronę wygląda na symetryczną i nie jest; strata wychodzi po `drop table`, kiedy źródła już nie ma.

**Nie usuwać `article_overrides` przed przeniesieniem treści.** Tam siedzą realne zmiany wprowadzone przez redaktora (`lib/articleContent.ts:29-51`), które nie mają odpowiednika w `data/articles/*.ts`. Kolejność: backfill → weryfikacja → dopiero `drop`.

**Nie zamieniać błędu odczytu na `notFound()` w żadnej trasie czytającej `pages`.** Przy błędzie albo timeoucie rzucamy wyjątek (500). Dzisiejszy wzorzec (`lib/customPages.ts:47-52` → `app/[slug]/page.tsx:30`) zamienia timeout Supabase w 404 cache'owany przez ISR na 300 s; po etapie 4 objęłoby to **całe drzewo treści**, a taki 404 może zostać zaindeksowany. Przy 500 Google trzyma w indeksie poprzednią wersję i wraca później; 200 albo 404 to komunikat „ta strona teraz tak wygląda".

**Nie przenosić do nowego kodu wzorca `.maybeSingle()` bez obsługi `error`.** Dzisiejszy `syncNavItem` (`actions/customPageActions.ts:33-38`) przy dwóch wierszach z tym samym `href` dostaje PGRST116, uznaje to za „brak pozycji" i dokłada trzeci duplikat. W nowym modelu odpowiednikiem jest wyszukiwanie po `full_path` — chroni je indeks unikalny, ale kod i tak musi sprawdzać `error`, a nie tylko `data`.

**Nie zmieniać adresów przy okazji migracji, nawet gdy nowe wyglądałyby ładniej.** Kuszące jest przeniesienie `/wprowadzenie` pod `/o-shorinji/wprowadzenie` czy uporządkowanie `/zajecia/*` „przy okazji". Każda taka zmiana miesza dwa ryzyka (model + SEO) w jednym wdrożeniu i psuje golden master jako narzędzie kontroli. Adresy zmienia się osobno, po ustabilizowaniu modelu.

**Nie sięgać po ltree ani nested sets.** Przy 22 węzłach (§2.0) to komplikacja, którą trzeba będzie zrozumieć ponownie za dwa lata przy pierwszej awarii.

**Nie zapominać o rewalidacji poddrzewa — i nie liczyć na tagi cache, bo ich tu nie ma.** W repo jest zero `revalidateTag` i zero `unstable_cache`; całe unieważnianie stoi na `revalidatePath` z literałami. Zmiana `full_path` rodzica zmienia adresy dzieci; `revalidatePath('/', 'layout')` odświeży menu, ale nie odświeży starych ścieżek potomków. Akcja musi zebrać listę dotkniętych ścieżek (przed i po) i zrewalidować każdą.

**Nie chować nawigacji desktopowej pod hamburgerem i nie dawać `aria-expanded` na sam link.** Pierwsze pogarsza mierzalne wskaźniki wykonania zadania, drugie myli użytkowników czytników ekranu — pozycja z własną stroną i podstronami wymaga linku plus osobnego przycisku.

**Nie zakładać, że `content_versions` i kosz podstron są drogą odwrotu.** Oba istnieją w bazie i **nie istnieją w panelu**: `content_versions` ma 0 wierszy, `zapiszWersje` jest wołane wyłącznie dla aktualności, `historia()` nie ma ani jednego konsumenta; `listTrashedCustomPages` / `restoreCustomPage` / `purgeCustomPage` nie są nigdzie importowane, a `TrashSection` jest podłączony tylko do aktualności. Historia nie jest drogą odwrotu. Drogą odwrotu jest zrzut wszystkich tabel do JSON zrobiony **przed pierwszym zapisem** (`shorinji-notes/db-backup-<data>/`, wzorzec z 2026-07-30) plus wycofanie etapu (flaga na `0`, `truncate pages`).

**Nie zostawiać flagi `DRZEWO_STRON` i dwóch zakładek na stałe.** Przerwana migracja jest gorsza od punktu wyjścia, bo trzeba utrzymywać dwie ścieżki kodu nad jedną treścią. Etap 8 ma mieć datę.

**Nie zapominać, że `RESERVED_SLUGS` dalej jest potrzebny na poziomie zerowym.** Indeks unikalny na `full_path` obroni przed kolizją z trasami, które mają węzeł, ale nie przed `/admin`, `/api`, `/downloads`, `sitemap.xml` i `robots.txt` (`lib/customPages.ts:18-33`). Listę trzeba jednocześnie **okroić** (do pozycji bez węzła) i **uzupełnić** — brakuje w niej `icon` (trasa metadanych `/icon`, więc da się dziś utworzyć kolidującą podstronę) oraz `favicon.ico`. Sprawdzać wyłącznie dla `parent_id IS NULL`. Ta sama lista jest wczesnym guardem w catch-allu (§5.6): pierwszy segment zarezerwowany albo niepasujący do `^[a-z0-9-]+$` → `notFound()` **przed** jakimkolwiek zapytaniem do bazy.

**Nie zostawiać walidacji sluga bez odpytania `redirects.old_path`.** Sama lista zarezerwowanych i indeks unikalny nie bronią przed utworzeniem strony pod **starym, zaindeksowanym przekierowaniem**: adres jest wolny w `pages`, a wpis w `redirects` przestaje działać po cichu i Google dostaje inną treść, niż spodziewa się zobaczyć. Walidacja musi sprawdzać oba źródła.

---

## 9. Etap 9 — sekcje przesuwalne z panelu (po zamknięciu migracji)

Właściciel postawił wymaganie kierunkowe: **docelowo każdy tekst ma być edytowalny, a każdy element strony przesuwalny z panelu**. Ta sekcja rozstrzyga, *kiedy* to zrobić, i zapisuje, na co model danych ma zostawić miejsce. Rozstrzygnięcie podjęte w etapie 0b, 2026-08-18.

### 9.1 Co dziś jest edytowalne, a co nie — bez zaokrągleń

Rozróżnienie, które łatwo zgubić: **teksty ośmiu tras statycznych są edytowalne już dziś**. Nadtytuł, H1, wstęp i bloki treści siedzą w `site_settings` pod kluczem `page:<slug>` i mają swój ekran w panelu. Nieedytowalne jest **umeblowanie strony i jego kolejność** — te elementy renderuje plik trasy:

| Trasa | Co jest w kodzie, nie w panelu |
|---|---|
| `/` | pasek aktualności `NewsSidebar` w siatce 3/4 + 1/4 (`app/page.tsx:19-24`) |
| `/kontakt` | formularz kontaktowy **pomiędzy** nagłówkiem a treścią |
| `/zajecia/dorosli`, `/zajecia/dzieci` | `ScheduleWeek` (grafik), `ContactForm`, `LocationMap`, dwa kafelki CTA (`app/zajecia/dorosli/page.tsx:26-58`) |
| `/galeria` | `GalleryClient` — foldery z Cloudinary (`app/galeria/page.tsx:31`) |
| `/aktualnosci` | własna lista z `getNews()` (`app/aktualnosci/page.tsx:33-42`) |
| `/zajecia/cennik`, `/program-nauczania` | **nic** — te dwie są czystym „nagłówek + bloki" i już dziś w pełni składalne z panelu |

Dzisiejszy zestaw typów bloków (`lib/newsTypes.ts:9-82`, 16 typów) nie zawiera ani formularza, ani mapy, ani grafiku, ani paska aktualności, ani galerii folderowej. Trzy z sześciu tras to więc nie „przesunięcie elementu", a **budowa nowych typów bloków** razem z polami w edytorze i walidacją.

### 9.2 Rozstrzygnięcie: etap 9, po etapie 8

Praca nad układem idzie **po** zamknięciu fazy contract, jako etap 9 z terminem w kalendarzu. Cztery powody, w kolejności wagi:

1. **Golden master przestałby odróżniać zmianę zaplanowaną od cichej utraty treści.** Asercje, na których stoi kontrola — liczba bloków i długość tekstu w głównym kontenerze (§5.2) — są dokładnie tym, co zmiana układu zmienia. To jedyna siatka bezpieczeństwa w projekcie bez frameworka testowego; prawdziwa strata utonęłaby w różnicach wprowadzonych świadomie.
2. **Awarii nie dałoby się przypisać do przyczyny.** Ten sam argument, który każe rozdzielić etap 3a (źródło danych menu) od 3b (przepisanie `Navbara`): dwa rodzaje zmiany w jednym wdrożeniu dają diff, w którym nie widać, co zepsuło stronę.
3. **Zmiana układu nie ma drogi odwrotu.** Każdy etap 1–7 wycofuje się przez `drop table`, `truncate`, flagę na `0` albo rewert komponentu. Treść przepisana z kodu na bloki nie wraca po przełączeniu flagi, bo w kodzie nie ma już czego przywrócić.
4. **Do etapu 5 nie ma czym tego odebrać.** Ekran, na którym cokolwiek da się chwycić i przełożyć, powstaje właśnie w etapie 5. Wcześniejsze „przesuwalne" elementy to możliwość, której nie ma czym użyć.

Dodatkowo: etap 9 przenosi kolejne trasy z grupy „zawsze mają treść" do grupy „puste bez bazy" — ten sam mechanizm, który 2026-08-12 dał **HTTP 200 z pustym `<main>`** na ośmiu trasach. Każda trasa konwertowana w etapie 9 musi zachować odpowiednik `prefillHeader`/`basePageContent` z `lib/editablePages.ts`.

**PRZYJĘTE 2026-08-18 (etap 0b): pilot na jednej trasie zaraz po odbiorze etapu 5**, a pełna praca nad układem po etapie 8. Pilot — i tak przewidziany jest wtedy tydzień jego pracy na nowym panelu przed etapem 8. Pilotem ma być `/zajecia/dorosli`: ma najwięcej elementów w kodzie, a nie jest stroną główną. Warunki: własny, świeży zrzut kontrolny przed i po (golden master migracji zostaje **nietknięty**), zero zmian na pozostałych siedmiu trasach, zachowany zapas treści w kodzie dla tej trasy. Pilot **nie może** wejść przed etapem 5 ani równolegle z etapami 3–4, bo wtedy trafia w to samo wdrożenie co zmiana źródła menu i adresów.

### 9.3 Zamknięty zbiór sekcji, nie wolne płótno

„Wszystko przesuwalne" ma znaczyć **gotowe, nazwane klocki, które da się włączyć, wyłączyć i przestawić** — nie puste płótno z dowolnym pozycjonowaniem. Tak robi to branża (Prismic slices, Storyblok components, Sanity content modules), i tak samo działa w WordPressie wzorzec kurowania edytora (`templateLock: "contentOnly"`, Block Locking API): rama strony zablokowana, treść w środku edytowalna. Powód nie jest estetyczny, a mierzalny: redaktor postawiony przed czterdziestoma typami bloków nie wybiera najlepszego, a drobne korekty odstępów i wariantów fontu po cichu rozjeżdżają spójność wizualną. Przy jednym redaktorze bez zaplecza technicznego prostota panelu jest warta więcej niż zakres możliwości.

Zbiór sekcji do zbudowania w etapie 9 — **wypisany już teraz, żeby model danych zostawił im miejsce**:

| Sekcja | Pola | Skąd bierze dane |
|---|---|---|
| Formularz kontaktowy | tytuł, tekst wstępny, treść zgody | zapis do `contact_messages` |
| Mapa i dojazd | tytuł, adres, wysokość | `site_settings` klucz `organization` |
| Plan zajęć (grupa) | tytuł, grupa (`dorosli`/`dzieci`) | `site_settings` klucz `schedule` |
| Pasek aktualności | tytuł, liczba wpisów, szerokość kolumny | `articles` przez `getNews()` |
| Galeria z folderu | tytuł, folder Cloudinary, okładka | Cloudinary + `galeria:okladki` |
| Kafelki odnośników | 2–4 kafelki: etykieta, adres, opis | treść własna sekcji |

Wszystkie sześć to **bloki bez własnych danych**: sekcja nie przechowuje treści, tylko wskazuje, skąd ją wziąć. Ten wzorzec w tym serwisie już działa i jest sprawdzony — bloki `bank` i `kontakt` (`lib/newsTypes.ts:68-82`) nie trzymają numeru konta ani telefonu, biorą je z zakładki „Dane organizacji". Etap 9 nie wymyśla więc nowego mechanizmu, tylko powtarza istniejący.

**Kolejność konwersji, od najtańszej do najdroższej** (każda trasa to osobne wdrożenie z własnym porównaniem przed/po; plik układu w kodzie kasuje się dopiero po tygodniu działania nowej wersji): `/zajecia/dorosli` → `/zajecia/dzieci` (bliźniak, `app/zajecia/dzieci/page.tsx:26-58` jest niemal identyczny) → `/kontakt` → `/aktualnosci` → `/galeria` → `/` na końcu.

### 9.4 Co z tego trzeba zrobić WCZEŚNIEJ — koszt bliski zeru

Trzy rzeczy wchodzą do etapów, które i tak są pisane. Zostawiamy miejsce, nie budujemy funkcji.

1. **Etap 1: nie zamykać kolumny `layout` CHECK-iem na trzech wartościach** (§2.2). Siatka 3/4 + 1/4 strony głównej nie mieści się w `auto`/`article`/`listing`, a rozszerzenie CHECK-a to druga ręczna wizyta właściciela w SQL Editorze — klucz service-role nie wykona DDL. Walidacja dopuszczalnych wartości idzie do kodu.
2. **Etap 2: `content_key` i `cloudinary_folder` muszą wejść** (§2.2). Bez nich konwersja `/galeria` i ośmiu tras statycznych na sekcje wymaga później ręcznego mapowania, którego nie ma z czego odtworzyć.
3. **Etap 7: decyzja o fallbacku treści** (§6 pkt 6) determinuje, czy etap 9 ma z czego skopiować wzorzec zapasu treści dla konwertowanych tras.

### 9.5 Warunek uczciwy

Rzeczy odłożone mają w tym projekcie zwyczaj nie wracać: ekran kosza podstron i historia wersji **istnieją w bazie i nie istnieją w panelu** — `listTrashedCustomPages`, `restoreCustomPage` i `purgeCustomPage` nie mają ani jednego wywołania, a `content_versions` ma zero wierszy. Dlatego etap 9 wchodzi do planu z datą, tak samo jak etap 8. Bez daty sześć plików układu zostaje w kodzie na stałe, a każda prośba „przesuń formularz nad mapę" dalej wymaga programisty — czyli dokładnie ta zależność, którą cała przebudowa ma zlikwidować, trwa dalej.
