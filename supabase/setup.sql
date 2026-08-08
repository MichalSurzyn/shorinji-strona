-- ============================================================================
--  Kempo - kompletny schemat bazy Supabase (PostgreSQL)
--  Plik: supabase/setup.sql
--
--  CO ROBI TEN PLIK
--  ----------------
--  Zaklada (albo uzupelnia) komplet obiektow bazy uzywanych przez aplikacje:
--
--    public.contact_messages  - wiadomosci z formularza kontaktowego
--    public.site_settings     - magazyn "klucz -> JSON" (stopka, grafik, strony)
--    public.articles          - aktualnosci (newsy) z panelu /admin/artykuly
--    public.article_overrides - nadpisania tresci podstron tematycznych
--    public.custom_pages      - wlasne podstrony serwowane pod /<slug>
--    public.nav_items         - menu gorne (drzewo dwupoziomowe)
--
--  JAK URUCHOMIC
--  -------------
--    Supabase Dashboard -> SQL Editor -> New query -> wklej calosc -> Run.
--    (REST API nie pozwala tworzyc tabel, dlatego potrzebny jest ten plik.)
--
--  IDEMPOTENTNOSC
--  --------------
--  Plik mozna uruchamiac wielokrotnie na zywej bazie z danymi. Kazdy krok
--  jest albo `if not exists`, albo opakowany w blok `do $$ ... $$` sprawdzajacy
--  stan katalogu systemowego. Nigdzie nie ma DROP, TRUNCATE, DELETE ani UPDATE
--  na danych uzytkownika.
--
--  UWAGA OGOLNA: `create table if not exists` na ISTNIEJACEJ tabeli jest
--  no-opem - NIE doklada brakujacych kolumn, defaultow ani CHECK-ow.
--  Definicje w tym pliku opisuja wiec stan docelowy dla swiezej bazy;
--  na bazie produkcyjnej ten skrypt realnie dodaje tylko brakujace tabele,
--  indeksy, klucze i wlacza RLS.
--
--  RLS - DECYZJA PROJEKTOWA
--  ------------------------
--  Na WSZYSTKICH tabelach wlaczamy Row Level Security. Ten plik CELOWO nie
--  tworzy zadnych polityk. Caly odczyt i zapis w aplikacji idzie przez klienta
--  service-role (lib/supabaseAdmin.ts, zmienna SUPABASE_SERVICE_ROLE_KEY),
--  a rola service_role omija RLS z definicji. Klucz anon
--  (NEXT_PUBLIC_SUPABASE_ANON_KEY) trafia do bundla przegladarki.
--  RLS bez polityk = tabela niedostepna dla rol anon i authenticated,
--  czyli zero furtki do podmiany tresci serwisu przez osobe, ktora odczyta
--  publiczny klucz ze zrodel strony.
--
--  STAN FAKTYCZNY BAZY (zweryfikowany empirycznie 2026-08-08):
--    * RLS jest juz wlaczony na wszystkich 5 istniejacych tabelach.
--      `enable row level security` jest idempotentne i NIE kasuje polityk,
--      wiec uruchomienie tego pliku niczego tu nie zmieni.
--    * Proba zapisu kluczem anon zostala odrzucona na KAZDEJ tabeli
--      komunikatem "new row violates row-level security policy".
--    * WYJATEK: na public.articles istnieje polityka SELECT dopuszczajaca
--      role anon do wierszy z published = true. Zweryfikowane szkicem
--      (published = false), ktorego klucz anon NIE zobaczyl - szkice nie
--      wyciekaja. Ta polityka nie zostala utworzona tym plikiem i on jej
--      nie usuwa.
--
--  PLANOWANA ZMIANA (jeszcze nie w tym pliku):
--  Docelowo odczyt publiczny ma isc kluczem anon + politykami SELECT
--  zawezonymi do tresci publicznej, a service_role ma zostac wylacznie do
--  zapisow z panelu. Polityki dodajemy DOPIERO razem ze zmiana kodu -
--  dodanie ich teraz tylko poszerzyloby dostep, nie dajac nic w zamian,
--  bo kod i tak czyta service_rolem.
--
--  PRZED URUCHOMIENIEM SPRAWDZ (jedyne dwa kroki, ktore moga sie wywalic
--  na danych, a nie na strukturze):
--    select slug, count(*) from public.articles     group by slug having count(*) > 1;
--    select slug, count(*) from public.custom_pages group by slug having count(*) > 1;
--  Jesli ktores zapytanie cos zwroci, najpierw usun duplikaty - inaczej
--  tworzenie indeksu unikalnego przerwie skrypt bledem 23505.
--
--  Wymaga PostgreSQL 13+ (gen_random_uuid() jest wtedy w rdzeniu). Supabase
--  ten warunek spelnia, wiec `create extension pgcrypto` nie jest potrzebne.
-- ============================================================================


-- ============================================================================
--  1. public.contact_messages - formularz kontaktowy
--     Uzycie: actions/contactActions.ts, components/ContactForm.tsx,
--             components/admin/MessagesManager.tsx
--     Ta tabela na dzien pisania skryptu NIE ISTNIEJE w bazie - tu powstaje.
-- ============================================================================

create table if not exists public.contact_messages (
  id         uuid        primary key default gen_random_uuid(),
  name       text        not null check (char_length(name) <= 120),
  email      text        not null check (char_length(email) <= 200),
  message    text        not null check (char_length(message) <= 4000),
  source     text,
  read       boolean     not null default false,
  created_at timestamptz not null default now()
);

-- Lista w panelu: order by created_at desc limit 200 (actions/contactActions.ts).
create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);

alter table public.contact_messages enable row level security;

-- UWAGA: limity 120/200/4000 odwzorowuja walidacje aplikacyjna
--   (actions/contactActions.ts) i sa zgodne z poprzednia wersja tego pliku.
--   Walidacja formatu e-maila jest wylacznie w kodzie - nie ma tu CHECK-a
--   z regexem, bo dopuszczamy, ze regex aplikacyjny bedzie sie zmienial.
-- UWAGA: pole honeypot `website` z formularza celowo NIE jest zapisywane -
--   nie ma dla niego kolumny.
-- UWAGA: kolumna `source` nie ma ograniczonego zbioru wartosci (kod ma
--   fallback na surowa wartosc), wiec swiadomie brak enuma i CHECK-a z lista.


-- ============================================================================
--  2. public.site_settings - magazyn "klucz -> JSON"
--     Klucze uzywane przez kod:
--       "footer"      -> obiekt  FooterData      (lib/footerTypes.ts)
--       "schedule"    -> TABLICA ScheduleSlot[]  (data/schedule.ts)
--       "page:<slug>" -> obiekt  PageContent     (lib/newsTypes.ts);
--                        starsze wiersze maja samo { blocks }
--     Dostep: wylacznie klient service-role (lib/supabaseAdmin.ts).
-- ============================================================================

create table if not exists public.site_settings (
  key        text        primary key,
  value      jsonb       not null,
  updated_at timestamptz not null default now()
);

-- Klucz glowny na (key) jest twardo wymagany przez:
--   * .upsert() BEZ onConflict -> PostgREST celuje w PRIMARY KEY
--     (actions/pageActions.ts, actions/footerActions.ts,
--      actions/scheduleActions.ts, actions/migrateActions.ts),
--   * ?on_conflict=key w scripts/seed-content.mjs,
--   * .eq("key", ...).maybeSingle() (lib/footerData.ts, lib/schedule.ts).
-- Blok ponizej jest ratunkiem na wypadek tabeli bez PK. Celowo zaklada
-- PRIMARY KEY, a nie sam unique index: PostgREST wyprowadza cel ON CONFLICT
-- z klucza glownego, wiec samo UNIQUE naprawiloby tylko seed, a upserty
-- z panelu nadal rzucalyby blad 42P10.
do $$
begin
  if not exists (
    select 1
      from pg_constraint
     where conrelid = 'public.site_settings'::regclass
       and contype  = 'p'
  ) then
    -- PK wymaga NOT NULL na kolumnie kluczowej - ADD PRIMARY KEY ustawi je sam,
    -- o ile w danych nie ma NULL-i (a nie moze byc: kod zawsze podaje key).
    alter table public.site_settings
      add constraint site_settings_pkey primary key (key);
  end if;
end
$$;

alter table public.site_settings enable row level security;

-- UWAGA: ksztalt kolumny `value` jest rozny per klucz (obiekt dla
--   "footer"/"page:*", TABLICA dla "schedule"), a historyczne wiersze
--   "page:*" maja tylko { blocks } bez title/lead/kicker. Dlatego zadnego
--   CHECK-a na strukture JSON tu nie ma i byc nie moze.
-- UWAGA: nie da sie z kodu rozstrzygnac json vs jsonb - PostgREST parsuje
--   oba typy identycznie, nigdzie nie ma JSON.parse ani operatorow jsonb.
--   Przyjeto jsonb (konwencja Supabase). Na istniejacej tabeli i tak bez zmian.
-- UWAGA: DEFAULT now() na updated_at nie wynika z kodu - kazdy zapis podaje
--   updated_at jawnie (new Date().toISOString()). Default jest tu dla
--   recznych insertow z SQL Editora.
-- UWAGA: brak CHECK-a na format `key`. Realne wartosci to "footer",
--   "schedule" i "page:<slug>", ale kod niczego nie waliduje, a CHECK
--   moglby odrzucic istniejace wiersze.
-- UWAGA: swiadomie brak indeksu pod .like("key", "page:%")
--   (lib/pageOverrides.ts). Tabela ma kilkanascie wierszy - to bylaby
--   optymalizacja bez zysku, a nie odtworzenie schematu.


-- ============================================================================
--  3. public.articles - aktualnosci (newsy)
--     Uzycie: lib/news.ts, actions/newsActions.ts,
--             app/admin/(panel)/artykuly/*, app/aktualnosci/*
-- ============================================================================

create table if not exists public.articles (
  id           uuid        primary key default gen_random_uuid(),
  slug         text        not null,
  title        text        not null,
  excerpt      text,                       -- NULL, gdy pole w edytorze puste
  cover_image  text,                       -- public_id Cloudinary, nie URL
  content      jsonb       not null,       -- tablica blokow NewsBlock[]
  published    boolean     not null default true,
  published_at timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Slug identyfikuje artykul w trasie /aktualnosci/[slug]; getNewsBySlug
-- uzywa .eq("slug", ...).eq("published", true).maybeSingle() (lib/news.ts),
-- co przy dwoch opublikowanych wierszach z tym samym slugiem konczy sie
-- bledem PGRST116. revalidatePath zaklada odwzorowanie 1:1.
create unique index if not exists articles_slug_key
  on public.articles (slug);

-- .order("published_at", { ascending: false }) - lib/news.ts,
-- app/admin/(panel)/artykuly/page.tsx, app/admin/(panel)/page.tsx
create index if not exists articles_published_at_idx
  on public.articles (published_at desc);

-- Lista publiczna: .eq("published", true) + sort po published_at (lib/news.ts)
create index if not exists articles_published_published_at_idx
  on public.articles (published, published_at desc);

alter table public.articles enable row level security;

-- UWAGA: przed uruchomieniem sprawdz duplikaty slugow (zapytanie w naglowku
--   pliku). `create unique index if not exists` chroni tylko przed powtornym
--   tworzeniem indeksu o tej nazwie, NIE przed konfliktem w danych.
-- UWAGA: RLS na tej tabeli byl dotad wylaczony - odczyt kluczem anon przez
--   REST zwracal pelne wiersze. Wlaczenie RLS nie zepsuje aplikacji: odczyt
--   publiczny idzie service-rolem (lib/supabaseAdmin.ts), a panel po zmianie
--   architektury tez korzysta z klienta service-role. Jesli jednak jakakolwiek
--   sciezka CRUD w panelu chodzi kluczem anon + sesja admina
--   (lib/supabase/server.ts), po wlaczeniu RLS trzeba dolozyc polityke:
--     create policy articles_auth_all on public.articles
--       for all to authenticated using (true) with check (true);
--   Sprawdz to PRZED uruchomieniem na produkcji.
-- UWAGA: kolumna `content` w zywej bazie jest NOT NULL, ale BEZ defaultu
--   (potwierdzone introspekcja OpenAPI). Tutaj tez nie ma defaultu - kod
--   zawsze podaje content, a rozbieznosc miedzy plikiem a baza byla
--   mylaca. Reczne inserty z SQL Editora musza podac content jawnie.
-- UWAGA: typ `id` nie jest wyprowadzalny z kodu (aplikacja widzi tylko
--   string). Przyjeto uuid przez analogie do contact_messages. Na istniejacej
--   tabeli ta linia i tak niczego nie zmienia.
-- UWAGA: brak CHECK-a na format slugu. slugify w edytorze produkuje
--   [a-z0-9-] i tnie do 80 znakow, ale tytul zlozony ze znakow spoza
--   alfabetu lacinskiego dalby pusty slug - CHECK zablokowalby zapis.
-- UWAGA: brak jakichkolwiek kluczy obcych - zadna inna tabela nie odwoluje
--   sie do articles, usuniecie artykulu to zwykly delete bez sprzatania.


-- ============================================================================
--  4. public.article_overrides - nadpisania tresci podstron tematycznych
--     (/o-shorinji/<slug>, /organizacja/<slug>, /buddyzm/<slug>)
--     Uzycie: lib/articleContent.ts, app/admin/actions.ts,
--             actions/migrateActions.ts
-- ============================================================================

create table if not exists public.article_overrides (
  topic      text        not null,
  slug       text        not null,
  title      text,
  intro      text,
  blocks     jsonb,
  body_md    text,
  updated_at timestamptz not null default now(),
  constraint article_overrides_pkey primary key (topic, slug)
);

-- Klucz (topic, slug) jest wymagany przez:
--   * upsert(..., { onConflict: "topic,slug" }) - lib/articleContent.ts,
--   * .eq("topic").eq("slug").maybeSingle()     - lib/articleContent.ts.
-- Blok ponizej zaklada go TYLKO wtedy, gdy w bazie nie ma jeszcze PK ani
-- UNIQUE dokladnie na tej parze kolumn. Rozpoznawanie jest scisle:
--   * indeks CZESCIOWY (indpred not null) NIE obsluzy ON CONFLICT -> odrzucany,
--   * indeks NIEWAZNY (indisvalid = false) tez nie -> odrzucany,
--   * indeks z kolumnami INCLUDE jest poprawnym celem -> akceptowany
--     (dlatego indnkeyatts, a nie indnatts).
do $$
declare
  has_key boolean;
  has_pk  boolean;
begin
  select
    exists (
      select 1
        from pg_constraint c
       where c.conrelid = 'public.article_overrides'::regclass
         and c.contype in ('p', 'u')
         and (
           select array_agg(a.attname::text order by a.attname)
             from pg_attribute a
            where a.attrelid = c.conrelid
              and a.attnum   = any (c.conkey)
         ) = array['slug', 'topic']
    )
    or exists (
      select 1
        from pg_index i
       where i.indrelid    = 'public.article_overrides'::regclass
         and i.indisunique
         and i.indisvalid
         and i.indpred is null
         and i.indnkeyatts = 2
         and (
           select array_agg(a.attname::text order by a.attname)
             from pg_attribute a
            where a.attrelid = i.indrelid
              and a.attnum   = any ((i.indkey::int2[])[0:i.indnkeyatts - 1])
         ) = array['slug', 'topic']
    )
    into has_key;

  if has_key then
    return;
  end if;

  select exists (
    select 1
      from pg_constraint
     where conrelid = 'public.article_overrides'::regclass
       and contype  = 'p'
  ) into has_pk;

  if has_pk then
    -- Tabela ma juz inny PK (np. legacy `id`) - dokladamy UNIQUE jako cel
    -- dla ON CONFLICT. Bez tego upsert z panelu rzucilby 42P10.
    create unique index if not exists article_overrides_topic_slug_key
      on public.article_overrides (topic, slug);
  else
    -- Brak jakiegokolwiek PK - zakladamy wlasciwy klucz naturalny.
    -- ADD PRIMARY KEY ustawi przy okazji NOT NULL na obu kolumnach.
    alter table public.article_overrides
      add constraint article_overrides_pkey primary key (topic, slug);
  end if;
end
$$;

alter table public.article_overrides enable row level security;

-- UWAGA: RLS byl tu dotad WYLACZONY, a tabela steruje trescia publicznych
--   podstron. Wlaczenie jest bezpieczne: wszystkie trzy zapytania w kodzie
--   (lib/articleContent.ts - select, select topic/slug, upsert) ida przez
--   getSupabaseAdmin(), a klient przegladarkowy (lib/supabase/client.ts)
--   sluzy wylacznie do auth i nigdy nie dotyka tej tabeli.
-- UWAGA: swiadomie brak CHECK-a na dozwolone wartosci `topic`
--   ('o-shorinji' / 'organizacja' / 'buddyzm'). Server action
--   saveTopicArticle przyjmuje topic jako zwykly string i sam go nie
--   waliduje - CHECK moglby odrzucic istniejace wiersze.
-- UWAGA: nie wiadomo, czy w zywej tabeli sa dodatkowe kolumny (np. id,
--   created_at). Jesli sa, musza miec DEFAULT albo byc nullable - upsert
--   podaje tylko siedem kolumn wymienionych wyzej.
-- UWAGA: brak indeksow dodatkowych jest zamierzony - jedyny lookup to
--   eq(topic) + eq(slug), obsluzony przez indeks klucza; nigdzie nie ma
--   .order() ani .delete() na tej tabeli.


-- ============================================================================
--  5. public.custom_pages - wlasne podstrony serwowane pod /<slug>
--     Uzycie: actions/customPageActions.ts, lib/customPages.ts,
--             app/[slug]/page.tsx, app/sitemap.ts
-- ============================================================================

create table if not exists public.custom_pages (
  id         uuid        primary key default gen_random_uuid(),
  slug       text        not null,
  title      text        not null,
  intro      text,
  blocks     jsonb       not null default '[]'::jsonb,
  published  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- UNIQUE na slug: kod tlumaczy blad 23505 na komunikat dla uzytkownika
-- (actions/customPageActions.ts - przy insercie i przy update) oraz czyta
-- strone przez .eq("slug", ...).maybeSingle() (lib/customPages.ts).
-- To JEDYNA ochrona przed duplikatem slugu - walidacja serwerowa sprawdza
-- tylko format i liste zarezerwowanych adresow.
create unique index if not exists custom_pages_slug_key
  on public.custom_pages (slug);

alter table public.custom_pages enable row level security;

-- UWAGA: swiadomie NIE ma indeksu na `title`, mimo ze listCustomPages()
--   sortuje po tytule. To select bez WHERE i bez LIMIT po calej (malej)
--   tabeli - planer i tak wybierze seq scan + sort, wiec indeks bylby
--   martwy, a kosztowalby przy kazdym zapisie.
-- UWAGA: odczyt publiczny .eq("slug").eq("published", true) jest w calosci
--   obsluzony przez indeks unikalny na slug - osobny indeks na `published`
--   nie jest potrzebny.
-- UWAGA: kolumna `created_at` nie ma ZADNEGO pokrycia w kodzie (nigdzie nie
--   jest czytana ani zapisywana; deklaracja w typie jest martwa). Zostaje
--   wylacznie dla spojnosci z pozostalymi tabelami.
-- UWAGA: brak limitow dlugosci na slug i title. slugify w edytorze tnie
--   slug do 60 znakow, ale to walidacja wylacznie kliencka - server actions
--   sa wywolywane bezposrednio i dlugosci nie sprawdzaja. Jesli chcesz
--   domknac to po stronie bazy, zweryfikuj najpierw dane i dopiero potem
--   odkomentuj ponizsze bloki (ADD CONSTRAINT nie jest no-opem i moze
--   odrzucic istniejace wiersze):
--
-- do $$
-- begin
--   alter table public.custom_pages
--     add constraint custom_pages_slug_format_chk check (slug ~ '^[a-z0-9-]+$');
-- exception when duplicate_object then null;
-- end $$;
--
-- do $$
-- begin
--   alter table public.custom_pages
--     add constraint custom_pages_title_not_blank_chk check (btrim(title) <> '');
-- exception when duplicate_object then null;
-- end $$;
--
-- UWAGA: powiazanie z menu idzie wylacznie po tekstowym href ("/<slug>"),
--   a nie po id - kod recznie sprzata pozycje w nav_items przy zmianie slugu
--   i przy usunieciu strony. Zadnego FK ani kaskady tu nie ma i byc nie musi.


-- ============================================================================
--  6. public.nav_items - menu gorne (drzewo dwupoziomowe)
--     Uzycie: lib/navigation.ts, actions/navActions.ts,
--             actions/customPageActions.ts, app/admin/(panel)/wlasne/[id]
-- ============================================================================

create table if not exists public.nav_items (
  id         uuid    primary key default gen_random_uuid(),
  parent_id  uuid    references public.nav_items (id) on delete cascade,
  label      text    not null,
  href       text,
  "position" integer not null,
  visible    boolean not null default true
);

-- Wyszukiwanie ostatniej pozycji najwyzszego poziomu oraz rozdzielanie dzieci:
-- .is("parent_id", null) + .order("position") (actions/customPageActions.ts).
-- Ten sam indeks obsluguje weryfikacje FK przy ON DELETE CASCADE.
create index if not exists nav_items_parent_position_idx
  on public.nav_items (parent_id, "position");

alter table public.nav_items enable row level security;

-- UWAGA: celowo NIE ma indeksu unikalnego na `href`. saveNavTree kasuje
--   wszystkie wiersze i wstawia je od nowa, nie waliduje duplikatow i nie
--   obsluguje bledu 23505 - UNIQUE zamienilby ciche zdublowanie w twardy
--   blad zapisu calego menu.
-- UWAGA (defekt w kodzie, nie w schemacie): syncNavItem i edytor podstrony
--   uzywaja .maybeSingle() na filtrze (href = X and parent_id is null)
--   i ignoruja `error`. Przy dwoch pozycjach z tym samym href maybeSingle
--   zwraca PGRST116, kod uznaje to za "brak pozycji" i przy kolejnym zapisie
--   dokłada trzeci duplikat. Naprawa nalezy do kodu (.limit(1) albo obsluga
--   bledu), a nie do bazy.
-- UWAGA: swiadomie brak osobnego indeksu na samo "position" i na "href" -
--   tabela ma rzad wielkosci kilkunastu wierszy, kazde zapytanie pobiera ja
--   w calosci bez LIMIT, a zapis menu to delete-all + reinsert. Indeksy
--   kosztowalyby wiecej, niz daja.
-- UWAGA: typ id/parent_id nie jest wyprowadzalny z kodu (aplikacja widzi
--   tylko string). Przyjeto uuid; zaden insert nie podaje id, wiec DEFAULT
--   generujacy wartosc musi istniec.
-- UWAGA: szerokosc typu `position` (smallint/integer/bigint) nie wynika
--   z kodu - przyjeto integer. Brak DEFAULT, bo kod zawsze podaje wartosc.
-- UWAGA: schemat nie ogranicza glebokosci drzewa, choc kod obsluguje
--   dokladnie dwa poziomy (rodzic + dziecko).


-- ============================================================================
--  KONIEC. Szybka weryfikacja po uruchomieniu:
--
--    select tablename, rowsecurity
--      from pg_tables
--     where schemaname = 'public'
--     order by tablename;
--
--    select tablename, indexname
--      from pg_indexes
--     where schemaname = 'public'
--     order by tablename, indexname;
--
--  Wszystkie szesc tabel powinno miec rowsecurity = true i zero polityk
--  (select * from pg_policies where schemaname = 'public'; -> pusto).
-- ============================================================================