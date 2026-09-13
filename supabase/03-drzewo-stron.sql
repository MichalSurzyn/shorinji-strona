-- ============================================================================
--  Drzewo stron i menu - etap 1 (expand): nowe tabele obok starych
--  Plik: supabase/03-drzewo-stron.sql
--
--  CO ROBI TEN PLIK
--  ----------------
--  Zaklada dwie NOWE tabele i nic wiecej:
--
--    public.pages     - jedno drzewo stron i menu (strona, odnosnik, naglowek)
--    public.redirects - pary "stary adres -> nowy adres" dla przekierowan
--
--  plus indeksy, dwie funkcje plpgsql, dwa triggery i RLS na obu tabelach.
--
--  CZEGO TEN PLIK NIE ROBI (to jest gwarancja, nie deklaracja intencji)
--  --------------------------------------------------------------------
--  Nie ma tu ani jednego DROP TABLE, TRUNCATE, DELETE ani UPDATE na danych.
--  Nie ma ani jednego ALTER TABLE na nav_items, custom_pages, article_overrides,
--  site_settings, articles, contact_messages ani content_versions. Nowe tabele
--  sa na starcie PUSTE i zaden istniejacy kod ich nie czyta
--  (docs/menu-architektura.md par. 5.3). Publiczna strona i panel /admin po
--  uruchomieniu tego pliku dzialaja dokladnie tak samo jak przed nim - to jedyny
--  sensowny warunek odbioru etapu 1.
--
--  Jedyne wiersze, ktore ten plik moze skasowac, to wiersze w public.redirects,
--  i tylko z wnetrza triggera, dopiero gdy ktos zmieni adres strony (sekcja 8).
--  W etapie 1 obie tabele sa puste, wiec nie ma czego skasowac.
--
--  JAK URUCHOMIC
--  -------------
--    KROK 0 (trzydziesci sekund, zrob to PRZED wklejeniem calosci).
--    W SQL Editorze uruchom sama te jedna linie:
--
--      select tablename from pg_tables where schemaname = 'public' order by 1;
--
--    Na liscie NIE MOZE byc ani "pages", ani "redirects". Po co to: caly plik
--    stoi na zalozeniu, ze te dwie nazwy sa wolne, a jedyny dowod, jaki mamy
--    z zewnatrz, to blad PGRST205 z REST API - ktory mowi o zawartosci CACHE'U
--    PostgREST, nie o katalogu bazy. Gdyby tabela o tej nazwie jednak
--    istniala z jakiegos wczesniejszego eksperymentu, "create table if not
--    exists" bylby cichym no-opem, a nastepne polecenia zaczelyby przestawiac
--    CUDZA tabele: wlaczylyby na niej RLS (czyli odcielyby od niej wszystko,
--    co ja czyta kluczem anon) i podwiazalyby do niej dwa triggery.
--    Jesli ktoras z tych nazw jest na liscie - NIE uruchamiaj pliku, powiedz mi.
--
--    KROK 1. Supabase Dashboard -> SQL Editor -> New query -> wklej calosc -> Run.
--    (REST API nie pozwala tworzyc tabel: klucz service-role czyta i zapisuje
--    wiersze, ale DDL nie wykona. Dlatego ten plik musi byc kompletny za
--    pierwszym razem - kazda pominieta kolumna to druga reczna wizyta tutaj.)
--
--    Po uruchomieniu SQL Editor pokaze tabelke z ostatniego zapytania w tym
--    pliku (sekcja KONTROLA PO URUCHOMIENIU). W kolumnie "ocena" musi byc samo
--    "OK" albo "informacja". Jesli gdziekolwiek jest "BLAD" - patrz opis nad
--    tym zapytaniem, na koncu pliku.
--
--  IDEMPOTENTNOSC
--  --------------
--  Plik mozna uruchamiac wielokrotnie i mozna go uruchomic po wczesniejszej,
--  niekompletnej probie. Kazdy wzorzec jest tu po to, zeby zapobiec konkretnej
--  awarii przy DRUGIM uruchomieniu:
--
--    create table if not exists      - drugie uruchomienie nie wywali sie na 42P07
--                                      ("relation already exists"). UWAGA: na
--                                      istniejacej tabeli to CALKOWITY no-op. Nie
--                                      doklada kolumn, defaultow ani CHECK-ow.
--                                      Dlatego nizej sa osobne sekcje na kolumny
--                                      i na ograniczenia.
--    add column if not exists        - naprawia tabele zalozona wczesniej w wersji
--                                      okrojonej; przy pelnej tabeli no-op.
--    alter column ... set default    - bezwarunkowo idempotentne (ustawienie tego
--                                      samego defaultu drugi raz nie jest bledem).
--    do $$ ... exception when
--        duplicate_object then null  - jedyny sposob na "add constraint if not
--                                      exists", bo takiej skladni w Postgresie
--                                      NIE MA. Drugie uruchomienie dostaje 42710
--                                      ("constraint already exists") i my ten
--                                      blad swiadomie zjadamy. Ten sam idiom
--                                      lezy juz w projekcie jako wzorzec,
--                                      w zakomentowanych blokach setup.sql:388-402.
--    create index if not exists      - drugie uruchomienie nie wywali sie na 42P07.
--    create or replace function      - podmienia cialo funkcji w miejscu.
--    drop trigger if exists
--        przed create trigger        - CREATE TRIGGER nie zna "if not exists"
--                                      (nawet w PG 17), wiec drugie uruchomienie
--                                      przerwaloby sie bledem 42710. To wlasnie
--                                      ten plik wnosi do bazy pierwszy trigger
--                                      w calym projekcie - w setup.sql
--                                      i 02-kosz-i-historia.sql sa tylko anonimowe
--                                      bloki do $$, ktore mozna puszczac za darmo.
--
--  CZEGO IDEMPOTENCJA NIE ZALATWIA (uczciwie, zeby nie bylo zaskoczenia)
--  ADD CONSTRAINT nie jest no-opem na DANYCH: jesli tabela ma juz wiersze
--  lamiace nowy CHECK, skrypt przerwie sie bledem 23514 i nie zapisze nic.
--  W etapie 1 tabela jest pusta, wiec to nie moze sie zdarzyc; przy powtorce
--  po etapie 2 (backfill) - moze, i wtedy trzeba najpierw naprawic dane.
--
--  RLS - DECYZJA PROJEKTOWA (ta sama co w setup.sql i 02-kosz-i-historia.sql)
--  -------------------------------------------------------------------------
--  RLS wlaczony na obu tabelach, ZERO polityk. Caly odczyt i zapis idzie przez
--  klienta service-role (lib/supabaseAdmin.ts), a rola service_role omija RLS
--  z definicji. Klucz anon (NEXT_PUBLIC_SUPABASE_ANON_KEY) siedzi w bundlu
--  przegladarki, wiec kazda polityka dla anon to furtka.
--
--  NIE kopiowac wzorca z supabase/setup.sql:51-55 (odziedziczona polityka SELECT
--  dla anon na articles). Tam wypuszcza ona tylko published = true. Na pages
--  wypuscilaby SZKICE (published = false) i KOSZ (deleted_at) - dokladnie te
--  tresci, przed ktorymi RLS ma chronic. Ani jednej create policy w tym pliku.
--
--  ALTER-y wlaczajace RLS stoja bezposrednio pod swoim create table, w tym samym
--  pliku i tej samej transakcji, zeby tabela ani przez chwile nie stala otwarta.
--
--  POLSKIE ZNAKI
--  -------------
--  Komentarze celowo bez znakow diakrytycznych - tak jak setup.sql
--  i 02-kosz-i-historia.sql. Znaki diakrytyczne sa WYLACZNIE w komunikatach,
--  ktore zobaczy czlowiek: raise exception w triggerze (te teksty pokazuje panel
--  redaktorowi) i dwa raise notice na koncu. Gdyby ktos otworzyl ten plik w zlym
--  kodowaniu, zepsuje sie tylko tresc tych komunikatow - nigdy skladnia SQL,
--  bo w kodzie wykonywalnym nie ma ani jednego znaku poza ASCII.
--
--  WYMAGANIA
--  ---------
--  PostgreSQL 13+ (gen_random_uuid() jest wtedy w rdzeniu, create extension
--  pgcrypto nie jest potrzebne). Supabase ten warunek spelnia.
--
--  CO POTEM
--  --------
--  Etap 2 to skrypt scripts/migrate-pages.mjs, ktory wypelni pages danymi
--  z nav_items, custom_pages, data/articles i EDITABLE_PAGES. Ten plik zostawia
--  mu pusta, kompletna strukture i nic wiecej.
-- ============================================================================


-- ============================================================================
--  TRANSAKCJA
--
--  Cala reszta pliku idzie w jednej transakcji: albo powstaje komplet, albo
--  nie powstaje nic. Bez tego "begin" atomowosc nie jest wlasnoscia PLIKU,
--  tylko narzedzia, ktore go wysyla - a to jest roznica miedzy gwarancja
--  i nadzieja. Awaria, ktorej to zapobiega: klient w trybie autocommit
--  (psql \i, dowolne narzedzie dzielace wejscie na srednikach) wykonuje
--  "create table public.pages", a nastepne polecenie - "enable row level
--  security" - nie wykonuje sie (zerwane polaczenie, statement_timeout,
--  zamkniecie karty). W bazie zostaje tabela BEZ RLS, czyli dokladnie ten
--  stan, ktoremu par. 2.2 specyfikacji kaze zapobiec ("ten ALTER musi byc
--  w tym samym pliku co create table, inaczej tabela przez chwile stoi
--  otwarta"). Przy transakcji nieudane polecenie wycofuje rowniez create table.
--
--  Supabase SQL Editor sam owija zapytanie w transakcje, wiec zobaczysz
--  ostrzezenie "there is already a transaction in progress". To jest
--  OSTRZEZENIE, nie blad - plik dziala poprawnie w obu trybach.
-- ============================================================================

begin;

-- ============================================================================
--  1. public.pages - jedno drzewo stron i menu
--
--     Zastepuje (dopiero w etapie 8, nie tu) dwie tabele naraz: nav_items
--     i custom_pages. Dzis nikt jej nie czyta.
--
--     Trzy rodzaje pozycji w jednej tabeli, bo redaktor widzi je w jednym
--     drzewie i musi je moc przestawiac miedzy soba:
--       kind = 'page'   - strona z adresem
--       kind = 'link'   - odnosnik zewnetrzny (np. Facebook klubu)
--       kind = 'header' - naglowek grupujacy bez adresu (dzis "ZAJECIA":
--                         wiersz nav_items z href = NULL)
-- ============================================================================

create table if not exists public.pages (
  id           uuid        not null default gen_random_uuid(),
  parent_id    uuid,

  -- CZYM JEST TA POZYCJA. Jawny typ, nie domysl z tego, czy href jest puste.
  -- Awaria, ktorej to zapobiega: dzis "pozycja bez adresu" rozpoznaje sie po
  -- href = NULL, a Navbar renderuje wtedy <Link href={undefined}> i wywala
  -- KAZDA trase, bo menu siedzi w layoucie (docs/menu-architektura.md par. 3).
  kind         text        not null default 'page',

  -- SKAD BIERZE SIE TRESC STRONY
  --   'db'    -> tresc w kolumnach title/intro/blocks tego wiersza
  --   'route' -> strone renderuje istniejaca trasa w kodzie Next (kolumna route);
  --              wezel istnieje dla struktury, menu, okruszkow i sitemapy
  source       text        not null default 'db',
  route        text,       -- np. '/zajecia/cennik'; wypelnione tylko dla source='route'

  -- ADRES
  slug         text,       -- ostatni segment adresu; NULL dla link/header
  full_path    text,       -- pelny adres, LICZONY WYLACZNIE TRIGGEREM (sekcja 7).
                           -- Wartosc wpisana tu recznie zostanie nadpisana przy
                           -- najblizszym zapisie - i to jest zamierzone: dwa
                           -- zrodla prawdy o adresie to gwarancja rozjazdu.
  external_url text,       -- tylko dla kind='link'

  -- TRESC (dla kind='page' and source='db')
  kicker       text,       -- nadkreslenie nad H1. Tresc osmiu tras statycznych ma
                           -- DZIS trzy pola naglowka: title, lead, kicker
                           -- (prefillHeader w lib/editablePages.ts). "lead" mapuje
                           -- sie na "intro", a "kicker" bez tej kolumny cicho
                           -- zniknie przy backfillu i nikt tego nie zglosi.
  title        text,       -- H1 strony. NOT NULL wymuszane w sekcji 3 (patrz tam,
                           -- dlaczego nie tutaj).
  intro        text,       -- lead pod H1 ORAZ opis na kafelku u rodzica
  blocks       jsonb       not null default '[]'::jsonb,

  -- WSKAZNIKI NA ZASOBY POZA TYM WIERSZEM
  content_key  text,       -- klucz w site_settings, np. 'page:zajecia-dorosli'.
                           -- Slug NIE jest kluczem tresci: rozjazd jest w 4 z 8
                           -- wpisow EDITABLE_PAGES (home -> /, cennik ->
                           -- /zajecia/cennik, zajecia-dorosli -> /zajecia/dorosli,
                           -- zajecia-dzieci -> /zajecia/dzieci). Bez tej kolumny
                           -- backfill nie trafi w tresc.
  cloudinary_folder text,  -- np. 'Strona/buddyzm/medytacja'. Folder ze zdjeciami
                           -- jest dzis kluczowany KSZTALTEM ADRESU, wiec zmiana
                           -- sluga - czyli cala pointa tej migracji - osieroci
                           -- galerie na zawsze i nic tego nie zglosi.
  layout       text        not null default 'auto',
                           -- SWIADOMIE BEZ CHECK-a (par. 9.4 pkt 1). Kusi, zeby
                           -- zamknac zbior na 'auto'/'article'/'listing', ale
                           -- siatka 3/4 + 1/4 strony glownej nie miesci sie
                           -- w zadnej z tych wartosci, a rozszerzenie CHECK-a to
                           -- DRUGA reczna wizyta wlasciciela w SQL Editorze
                           -- (PostgREST nie wykona DDL). Walidacja dopuszczalnych
                           -- wartosci idzie do kodu. Zbior na dzis: 'auto',
                           -- 'article', 'listing', 'route'.

  -- MENU
  menu_label   text,       -- etykieta w menu (wersaliki, np. 'MEDYTACJA');
                           -- NULL = uzyj title
  in_menu      boolean     not null default true,

  -- STAN. Dwa ROZLACZNE przelaczniki:
  --   published - czy strona jest dostepna pod swoim adresem
  --   in_menu   - czy pokazuje sie w menu na gorze
  -- Pomylenie ich przy backfillu (visible -> published zamiast visible -> in_menu)
  -- robi 404 na zaindeksowanym adresie. Dzis visible = false ukrywa POZYCJE MENU,
  -- nie strone.
  published    boolean     not null default true,
  depth        smallint    not null default 0,
  "position"   integer,    -- NOT NULL wymuszane w sekcji 3. Bez DEFAULT, bo kod
                           -- zawsze podaje wartosc (ta sama konwencja co
                           -- nav_items."position", setup.sql). Nazwa w cudzyslowie,
                           -- bo position jest slowem zarezerwowanym SQL.

  -- SLAD POCHODZENIA (spojne z supabase/02-kosz-i-historia.sql)
  migrated_from text,      -- 'nav_items:<uuid>', 'custom_pages:<uuid>',
                           -- 'editable_pages:<slug>', 'article_overrides:<t>/<s>',
                           -- 'data_articles:<t>/<s>'. Rozwiazuje dwa problemy:
                           -- (1) daje cel ON CONFLICT wierszom kind='header'
                           --     i kind='link', ktore maja full_path NULL, wiec
                           --     zaden indeks na adres ich nie obejmuje;
                           -- (2) daje dwuzapisowi z etapu 3a stabilny klucz
                           --     dopasowania - dzis go nie ma, bo saveNavTree
                           --     generuje wszystkie nav_items.id od nowa przy
                           --     kazdym zapisie (actions/navActions.ts:57-121).
  deleted_at   timestamptz,
  updated_by   text,       -- adres e-mail, nie id konta: konto mozna usunac,
                           -- a informacja "kto to zmienil" ma przetrwac
                           -- (ten sam wybor co w 02-kosz-i-historia.sql).
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint pages_pkey primary key (id),

  constraint pages_parent_id_fkey foreign key (parent_id)
    references public.pages (id) on delete restrict,

  constraint pages_kind_chk          check (kind in ('page', 'link', 'header')),
  constraint pages_source_values_chk check (source in ('db', 'route')),
  constraint pages_depth_chk         check (depth between 0 and 2),

  -- Strona glowna: EDITABLE_PAGES ma wpis slug='home', route='/'
  -- (lib/editablePages.ts). Jest edytowalna z panelu i siedzi w sitemapie
  -- z priority 1, wiec MUSI miec wezel. slug='' odpadloby na
  -- pages_slug_format_chk, a slug='home' dalby adres /home. Dlatego dla
  -- source='route' slug moze byc NULL - adres bierze sie wtedy doslownie
  -- z kolumny route (galaz ADRES w sekcji 7).
  constraint pages_kind_fields_chk check (
       (kind = 'page'   and external_url is null
                        and (slug is not null or source = 'route'))
    or (kind = 'link'   and slug is null     and external_url is not null)
    -- NAGLOWEK MOZE MIEC SLUG (zmiana z 2026-09-09, decyzja D1 wlasciciela).
    -- Wczesniej bylo tu 'slug is null'. Naglowek ze slugiem wnosi swoj segment
    -- do sciezki i dziala jak folder; naglowek BEZ sluga zostaje przezroczysty,
    -- czyli dokladnie tak, jak dzialal dotad. Zgodnosc wsteczna nie jest tu
    -- ostroznoscia na wszelki wypadek: jedyny naglowek w bazie ('ZAJECIA') ma
    -- slug NULL i pod nim wisi strona /faq. Wymuszenie sluga na naglowkach
    -- przesunieteloby /faq na /zajecia/faq, czyli ZAINDEKSOWANY adres, ktorego
    -- niezmiennosc wlasciciel wlasnie potwierdzil w punkcie F4 checklisty.
    or (kind = 'header' and external_url is null)
  ),
  constraint pages_source_chk check (
       (source = 'db'    and route is null)
    or (source = 'route' and route is not null and kind = 'page')
  ),
  constraint pages_slug_format_chk     check (slug is null or slug ~ '^[a-z0-9-]+$'),
  constraint pages_title_not_blank_chk check (btrim(title) <> ''),
  constraint pages_header_visible_chk  check (kind <> 'header' or in_menu),
  constraint pages_external_url_chk    check (
    external_url is null or external_url ~ '^https?://'
  ),
  -- DOLOZONE PONAD liste z par. 2.2 (patrz UWAGA na koncu sekcji 4): trasa musi
  -- zaczynac sie ukosnikiem, bo dla source='route' trigger przepisuje route
  -- do full_path doslownie. Route 'zajecia/cennik' bez ukosnika dalby adres,
  -- ktorego catch-all z etapu 4 nigdy nie dopasuje - 404 na zaindeksowanym
  -- adresie, i to takie, ktorego NIE wylapie zapytanie kontrolne z par. 5.4
  -- (ono porownuje full_path z route, a tu obie kolumny sa rownie zle).
  constraint pages_route_format_chk check (route is null or route ~ '^/')
);

-- RLS natychmiast po create table, przed czymkolwiek innym. Uzasadnienie
-- w naglowku pliku. To NIE kasuje istniejacych polityk (gdyby ktos je dodal,
-- trzeba je usunac osobno - kontrola na koncu pliku pokaze, ze sa).
alter table public.pages enable row level security;

-- DRUGI ZAMEK, niezalezny od RLS. RLS to jedna flaga na tabeli, ktora da sie
-- zdjac jednym kliknieciem "Disable RLS" w Table Editorze Supabase, bez
-- ostrzezenia o skutkach. Nowa tabela dziedziczy uprawnienia po rolach nadanych
-- na schemat public, wiec rola "anon" - ta, ktorej klucz lezy w bundlu
-- przegladarki KAZDEGO odwiedzajacego - ma na niej GRANT-y od pierwszej sekundy.
-- Dopoki RLS stoi, nic z tego nie wynika; w chwili gdy ktos je zdejmie
-- (albo skopiuje do etapu 5 polityke dla anon z setup.sql:51-55), na zewnatrz
-- wychodza szkice (published = false) i kosz (deleted_at) - dokladnie te tresci,
-- przed ktorymi RLS mial chronic. Po odebraniu GRANT-u odslona wymaga DWOCH
-- swiadomych bledow, nie jednego.
--
-- Swiadomie NIE odbieramy roli "authenticated": setup.sql:213-217 zaznacza, ze
-- jakas sciezka zapisu w panelu moze chodzic kluczem anon z sesja admina.
-- Panel korzysta z klucza service-role, ktory omija i RLS, i GRANT-y.
-- Warunkowo, bo rola "anon" to konwencja SUPABASE, nie Postgresa. Na zwyklym
-- Postgresie (baza deweloperska, lokalny docker) tej roli nie ma i samo
-- "revoke ... from anon" przerwaloby plik bledem 42704 - a poniewaz calosc
-- idzie w jednej transakcji, wycofaloby to RAZEM Z NIA cale tworzenie tabel.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.pages from anon;
  else
    raise notice 'Rola "anon" nie istnieje (to nie jest Supabase) - pomijam revoke. RLS dziala niezaleznie.';
  end if;
end $$;


-- ============================================================================
--  2. public.pages - uzupelnienie kolumn
--
--     Po co ta sekcja, skoro wyzej jest komplet w create table:
--     "create table if not exists" na ISTNIEJACEJ tabeli jest calkowitym
--     no-opem. Jesli ktos uruchomil wczesniej okrojona wersje tego pliku
--     (albo zalozyl pages recznie), definicje z sekcji 1 nie zostana nawet
--     przeczytane. Awaria, ktorej to zapobiega: backfill z etapu 2 przerywa sie
--     komunikatem "column pages.kicker does not exist", a wlasciciel musi wrocic
--     do SQL Editora - dokladnie temu ten plik ma zapobiegac.
--
--     Kazda linijka jest bezpieczna na tabeli z danymi: kolumny z defaultem
--     wypelniaja istniejace wiersze (PG 11+ robi to bez przepisywania tabeli),
--     a kolumny bez defaultu dodaja sie jako NULL i sa uszczelniane w sekcji 3.
-- ============================================================================

alter table public.pages add column if not exists id                uuid        not null default gen_random_uuid();
alter table public.pages add column if not exists parent_id         uuid;
alter table public.pages add column if not exists kind              text        not null default 'page';
alter table public.pages add column if not exists source            text        not null default 'db';
alter table public.pages add column if not exists route             text;
alter table public.pages add column if not exists slug              text;
alter table public.pages add column if not exists full_path         text;
alter table public.pages add column if not exists external_url      text;
alter table public.pages add column if not exists kicker            text;
alter table public.pages add column if not exists title             text;
alter table public.pages add column if not exists intro             text;
alter table public.pages add column if not exists blocks            jsonb       not null default '[]'::jsonb;
alter table public.pages add column if not exists content_key       text;
alter table public.pages add column if not exists cloudinary_folder text;
alter table public.pages add column if not exists layout            text        not null default 'auto';
alter table public.pages add column if not exists menu_label        text;
alter table public.pages add column if not exists in_menu           boolean     not null default true;
alter table public.pages add column if not exists published         boolean     not null default true;
alter table public.pages add column if not exists depth             smallint    not null default 0;
alter table public.pages add column if not exists "position"        integer;
alter table public.pages add column if not exists migrated_from     text;
alter table public.pages add column if not exists deleted_at        timestamptz;
alter table public.pages add column if not exists updated_by        text;
alter table public.pages add column if not exists created_at        timestamptz not null default now();
alter table public.pages add column if not exists updated_at        timestamptz not null default now();

-- UWAGA: title i "position" sa tu SWIADOMIE bez "not null". "add column ...
--   not null" bez defaultu przerywa sie bledem 23502 na tabeli, ktora ma juz
--   wiersze - a to jest wlasnie scenariusz naprawy, wiec wiersze moga tam byc.
--   Uszczelnienie idzie w sekcji 3, warunkowo.


-- ============================================================================
--  3. public.pages - defaulty i NOT NULL
--
--     Osobna sekcja, bo "add column if not exists" z sekcji 2 jest no-opem
--     dla kolumny, ktora ISTNIEJE, ale zostala kiedys zalozona bez defaultu
--     albo bez NOT NULL. Wtedy nic by tego nie naprawilo, a insert z panelu
--     (etap 5) przewrocilby sie na braku wartosci dla kolumny, ktorej kod nie
--     podaje, bo liczy na DEFAULT.
-- ============================================================================

-- "set default" jest idempotentne z natury: ustawienie tej samej wartosci
-- drugi raz nie jest bledem, wiec te linijki moga stac bezwarunkowo.
alter table public.pages alter column id         set default gen_random_uuid();
alter table public.pages alter column kind       set default 'page';
alter table public.pages alter column source     set default 'db';
alter table public.pages alter column blocks     set default '[]'::jsonb;
alter table public.pages alter column layout     set default 'auto';
alter table public.pages alter column in_menu    set default true;
alter table public.pages alter column published  set default true;
alter table public.pages alter column depth      set default 0;
alter table public.pages alter column created_at set default now();
alter table public.pages alter column updated_at set default now();

-- NOT NULL warunkowo. "alter column ... set not null" na kolumnie, w ktorej sa
-- NULL-e, przerywa CALY skrypt bledem 23502 i nie zapisuje nic - w tym triggerow
-- z sekcji 7 i 8, czyli najwazniejszej czesci pliku. Dlatego najpierw pytamy,
-- czy sa NULL-e, i tylko gdy nie ma, domykamy kolumne. Jesli sa (tabela
-- naprawiana po nieudanym backfillu), skrypt przechodzi dalej, a kontrola na
-- koncu pliku wypisze te kolumny w wierszu "Kolumny pages, ktore powinny byc
-- NOT NULL, a nie sa".
--
-- Dynamiczny SQL jest tu po to, zeby nie powtarzac tego bloku dwanascie razy;
-- format('%I') poprawnie ocytuje tez zarezerwowana nazwe "position".
do $$
declare
  kolumna  text;
  sa_nulle boolean;
begin
  foreach kolumna in array array[
    'id', 'kind', 'source', 'title', 'blocks', 'layout',
    'in_menu', 'published', 'depth', 'position', 'created_at', 'updated_at'
  ]
  loop
    execute format('select exists (select 1 from public.pages where %I is null)', kolumna)
       into sa_nulle;
    if not sa_nulle then
      execute format('alter table public.pages alter column %I set not null', kolumna);
    end if;
  end loop;
end $$;


-- ============================================================================
--  4. public.pages - ograniczenia (PK, FK, CHECK)
--
--     Postgres NIE MA skladni "add constraint if not exists". Kazdy blok nizej
--     wyglada wiec tak samo: probuj dodac, a jesli juz jest (SQLSTATE 42710,
--     duplicate_object) - zignoruj.
--
--     Nazwy ograniczen sa te same co w sekcji 1, celowo. Gdyby sie roznily,
--     drugie uruchomienie nie zglosiloby duplikatu i dolozylo drugie,
--     rownowazne ograniczenie o innej nazwie. Tabela z dwoma kopiami tego samego
--     CHECK-a to nie awaria, ale zaciemnia diagnostyke przy pierwszym bledzie
--     zapisu z panelu, a kontrola na koncu pliku przestaje cokolwiek znaczyc.
-- ============================================================================

-- PRIMARY KEY. Tu sam "exception when duplicate_object" nie wystarcza: gdyby
-- tabela miala juz klucz glowny pod INNA nazwa, proba dodania drugiego konczy
-- sie bledem 42P16 ("multiple primary keys for table are not allowed"), ktorego
-- ten handler NIE lapie - i caly skrypt padlby. Dlatego najpierw pytamy katalog,
-- czy jakikolwiek PK juz jest. Tak samo robi supabase/setup.sql dla site_settings.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.pages'::regclass and contype = 'p'
  ) then
    alter table public.pages add constraint pages_pkey primary key (id);
  end if;
exception when duplicate_object then null;
end $$;

-- KLUCZ OBCY: ON DELETE RESTRICT, nie CASCADE. Dzis nav_items ma cascade
-- (setup.sql:411) i to zostaje SWIADOMIE ODWROCONE (par. 2.3). Awaria, ktorej
-- to zapobiega: instruktor klika "usun" na "Program nauczania" i po cichu traci
-- "Uczniowskie" oraz wszystkie stopnie kyu. Kasowanie poddrzewa ma byc swiadoma
-- operacja w panelu: policz potomkow, pokaz liste, dopiero po potwierdzeniu
-- przenies je do kosza.
do $$
begin
  alter table public.pages
    add constraint pages_parent_id_fkey foreign key (parent_id)
      references public.pages (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages
    add constraint pages_kind_chk check (kind in ('page', 'link', 'header'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages
    add constraint pages_source_values_chk check (source in ('db', 'route'));
exception when duplicate_object then null;
end $$;

-- Limit trzech poziomow siedzi w BAZIE, nie tylko w kodzie Next. Pulapka,
-- ktorej to zapobiega: glebokosc pilnowana wylacznie w kodzie przestaje byc
-- pilnowana w chwili, gdy wiersz zapisze skrypt migracji albo czlowiek z SQL
-- Editora, a renderer menu fizycznie nie umie narysowac trzeciego poziomu.
do $$
begin
  alter table public.pages
    add constraint pages_depth_chk check (depth between 0 and 2);
exception when duplicate_object then null;
end $$;

-- DROP PRZED ADD, SWIADOMIE - i to jest jedyny blok w tej sekcji, ktory tak ma.
--
-- Idiom 'exception when duplicate_object then null' uzywany nizej dopasowuje
-- ograniczenie po NAZWIE, nie po tresci. Na bazie, ktora pages_kind_fields_chk
-- juz ma - a maja go i poligon, i produkcja - wklejenie tego pliku z NOWA
-- definicja przeszloby bez bledu i zostawiloby STARA regule ('naglowek nie moze
-- miec sluga'). Plik zameldowalby sukces, kontrola 14 na koncu tez (jej wzorzec
-- to '%source%', pasujacy do obu wersji), a awaria wyszlaby dopiero przy
-- pierwszej probie zapisania naglowka ze slugiem - jako surowy blad Postgresa
-- u redaktora.
--
-- Bezpieczne na danych: nowa regula jest SLABSZA od starej (dopuszcza wiecej),
-- wiec 'add constraint' nie ma jak wywrocic sie na 23514.
alter table public.pages drop constraint if exists pages_kind_fields_chk;

do $$
begin
  alter table public.pages add constraint pages_kind_fields_chk check (
       (kind = 'page'   and external_url is null
                        and (slug is not null or source = 'route'))
    or (kind = 'link'   and slug is null     and external_url is not null)
    -- NAGLOWEK MOZE MIEC SLUG (zmiana z 2026-09-09, decyzja D1 wlasciciela).
    -- Wczesniej bylo tu 'slug is null'. Naglowek ze slugiem wnosi swoj segment
    -- do sciezki i dziala jak folder; naglowek BEZ sluga zostaje przezroczysty,
    -- czyli dokladnie tak, jak dzialal dotad. Zgodnosc wsteczna nie jest tu
    -- ostroznoscia na wszelki wypadek: jedyny naglowek w bazie ('ZAJECIA') ma
    -- slug NULL i pod nim wisi strona /faq. Wymuszenie sluga na naglowkach
    -- przesunieteloby /faq na /zajecia/faq, czyli ZAINDEKSOWANY adres, ktorego
    -- niezmiennosc wlasciciel wlasnie potwierdzil w punkcie F4 checklisty.
    or (kind = 'header' and external_url is null)
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages add constraint pages_source_chk check (
       (source = 'db'    and route is null)
    or (source = 'route' and route is not null and kind = 'page')
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages
    add constraint pages_slug_format_chk check (slug is null or slug ~ '^[a-z0-9-]+$');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages
    add constraint pages_title_not_blank_chk check (btrim(title) <> '');
exception when duplicate_object then null;
end $$;

-- Naglowek grupujacy bez adresu ma sens tylko w menu. Naglowek z in_menu=false
-- to wiersz, ktorego nie widzi nikt i nigdzie, a jego dzieci traca prefiks
-- adresu (patrz galaz ADRES w sekcji 7).
do $$
begin
  alter table public.pages
    add constraint pages_header_visible_chk check (kind <> 'header' or in_menu);
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages add constraint pages_external_url_chk check (
    external_url is null or external_url ~ '^https?://'
  );
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.pages
    add constraint pages_route_format_chk check (route is null or route ~ '^/');
exception when duplicate_object then null;
end $$;

-- UWAGA: pages_route_format_chk jest DOLOZONY ponad liste z par. 2.2 - to jedyne
--   odstepstwo od specyfikacji w tej sekcji i jest swiadome. Uzasadnienie stoi
--   przy definicji w sekcji 1. Jesli backfill z etapu 2 przerwie sie na tym
--   CHECK-u bledem 23514, to nie CHECK jest do usuniecia - to skrypt zbudowal
--   route bez wiodacego ukosnika i zaraz zlamalby adres.
-- UWAGA: kolumna layout SWIADOMIE nie ma zadnego CHECK-a (par. 9.4 pkt 1).
--   Kontrola na koncu pliku sprawdza to wprost, zeby nikt tego "nie poprawil"
--   przy okazji innej zmiany.
-- UWAGA: schemat nie broni przed parent_id wskazujacym na wiersz w koszu
--   (deleted_at nie NULL). To jest zadanie panelu z etapu 5: CHECK nie widzi
--   innych wierszy, a trigger, ktory by tego pilnowal, blokowalby rowniez
--   poprawne przenoszenie calych poddrzew.
-- UWAGA: schemat nie broni tez kombinacji in_menu = true przy published = false
--   ani in_menu = true przy depth = 2. Oba przypadki ma odrzucac PANEL,
--   z wyjasnieniem dla redaktora (par. 3, par. 5.7). W bazie zostaja legalne
--   swiadomie: backfill i przyszly dwuzapis musza moc zapisac stan przejsciowy,
--   a system, ktory po cichu nie robi tego, co redaktor ustawil, jest gorszy
--   od systemu, ktory mowi "nie moge i dlaczego".


-- ============================================================================
--  5. public.pages - indeksy
-- ============================================================================

-- Adres unikalny wsrod ZYWYCH stron. To jedyna ochrona przed dwiema podstronami
-- pod tym samym URL-em (dzis: custom_pages_slug_key, setup.sql:362).
--
-- SWIADOMA ZMIANA ZACHOWANIA, nie odtworzenie stanu obecnego: custom_pages_slug_key
-- jest indeksem PELNYM, ten jest CZESCIOWY (where deleted_at is null). Skutek:
-- slug strony lezacej w koszu przestaje byc zajety. Konsekwencja dla etapu 5:
-- akcja przywracania z kosza MUSI sama sprawdzic kolizje full_path, bo indeks
-- jej wtedy nie wylapie - przywrocenie wysypie sie dopiero na UPDATE albo,
-- jeszcze gorzej, przejdzie i zostana dwa wiersze walczace o jeden adres.
--
-- DLA AUTORA ETAPU 2: predykat tego indeksu trzeba POWTORZYC w ON CONFLICT.
-- Postgres nie wywnioskuje celu z indeksu czesciowego i oddaje blad 42P10:
--   on conflict (full_path) where kind = 'page' and deleted_at is null do nothing
-- PREDYKAT ROZSZERZONY NA NAGLOWKI (2026-09-09, decyzja D1).
--
-- Bylo 'where kind = ''page''". Odkad naglowek moze miec wlasny adres, ten
-- predykat zostawialby dziure nie do zamkniecia z panelu: naglowek /zajecia
-- i strona /zajecia moglyby istniec obok siebie, a getStrona czyta przez
-- .maybeSingle() - przy dwoch wierszach PostgREST oddaje PGRST116, ktore
-- lib/pages.ts rzuca jako 500. Czyli kolizja adresow zamienialaby sie w awarie
-- strony, a nie w komunikat dla redaktora.
--
-- Naglowek bez sluga ma full_path NULL, a w indeksie unikalnym NULL-e nie
-- koliduja - stare wiersze sa wiec objete indeksem i nic im to nie robi.
-- Slowo 'kind' MUSI zostac w predykacie: kontrola 13 na koncu tego pliku
-- dopasowuje definicje wzorcem '%WHERE%kind%deleted_at%'.
--
-- drop + create zamiast 'if not exists': to drugie dopasowuje sie po NAZWIE
-- i podmiany predykatu by nie zrobilo (ta sama pulapka co przy
-- pages_migrated_from_key nizej).
drop index if exists public.pages_full_path_key;
create unique index pages_full_path_key
  on public.pages (full_path)
  where kind <> 'link' and deleted_at is null;

-- Rodzenstwo nie moze miec dwoch takich samych slugow. coalesce zamiast samego
-- parent_id, bo w indeksie unikalnym dwa NULL-e nie koliduja - bez tego dwie
-- strony najwyzszego poziomu (parent_id IS NULL) o tym samym slugu przeszlyby
-- ten indeks i zderzylyby sie dopiero na pages_full_path_key.
-- Predykat rozszerzony na naglowki z tego samego powodu co wyzej: odkad
-- naglowek ma slug, moze zderzyc sie o slug z rodzenstwem-strona.
drop index if exists public.pages_parent_slug_key;
create unique index pages_parent_slug_key
  on public.pages ((coalesce(parent_id, '00000000-0000-0000-0000-000000000000'::uuid)), slug)
  where kind <> 'link' and deleted_at is null;

-- Cel ON CONFLICT dla wierszy BEZ adresu (kind='header', kind='link') i klucz
-- dopasowania dla dwuzapisu z etapu 3a. Bez tego indeksu backfill nie jest
-- idempotentny dla naglowkow: pages_full_path_key ich nie obejmuje, bo maja
-- full_path NULL, wiec drugie uruchomienie skryptu dolozyloby drugie "ZAJECIA".
--
-- INDEKS PELNY, NIE CZESCIOWY - poprawka wobec par. 2.2 specyfikacji, ktora
-- podaje go z predykatem "where migrated_from is not null". Ten predykat jest
-- dla unikalnosci CALKOWICIE zbedny (w indeksie unikalnym dwa NULL-e nigdy nie
-- koliduja, bo NULLS NOT DISTINCT nie jest domyslne), a odbiera indeksowi to,
-- po co powstal: Postgres nie wywnioskuje indeksu CZESCIOWEGO jako celu
-- zwyklego "on conflict (migrated_from)" i oddaje blad 42P10. Oba konsumenty
-- nazwane w specyfikacji pisza go wlasnie bez predykatu (par. 5.4 backfill,
-- par. 5.5 dwuzapis), wiec z indeksem czesciowym etap 2 nie ruszylby z miejsca.
--
-- DLA AUTORA ETAPU 2: to jest JEDYNY klucz upsertu, ktory da sie uzyc przez
-- supabase-js/PostgREST. Wariant "onConflict: 'full_path'" NIE zadziala, bo
-- pages_full_path_key jest czesciowy, a PostgREST nie umie wyslac
-- "on conflict (...) where ..." - dostaniesz 42P10. Kazdy wiersz backfillu
-- ma miec migrated_from wypelnione (par. 5.4), wiec ten jeden klucz wystarcza
-- dla wszystkich piatki zrodel. Surowy SQL z predykatem zostaw na SQL Editor.
--
-- drop przed create, bo "create index if not exists" dopasowuje sie po NAZWIE:
-- gdyby ktos zalozyl juz wersje czesciowa (np. z wczesniejszej wersji tego
-- pliku), samo "if not exists" byloby no-opem i blad 42P10 wrocilby w etapie 2,
-- a kontrola na koncu pliku pokazalaby "OK", bo nazwa jest na miejscu.
drop index if exists public.pages_migrated_from_key;
create unique index pages_migrated_from_key
  on public.pages (migrated_from);

-- Odczyt drzewa (rodzenstwo po kolejnosci) i weryfikacja klucza obcego przy
-- kasowaniu rodzica - ON DELETE RESTRICT musi sprawdzic, czy sa dzieci.
-- Odpowiednik nav_items_parent_position_idx z setup.sql.
create index if not exists pages_parent_position_idx
  on public.pages (parent_id, "position");

-- Ekran kosza (etap 5). Indeks czesciowy: obejmuje tylko wiersze w koszu, wiec
-- jest maly i nie spowalnia zwyklych odczytow, ktore filtruja deleted_at is null.
-- Ten sam wzorzec co articles_deleted_at_idx w 02-kosz-i-historia.sql.
create index if not exists pages_deleted_at_idx
  on public.pages (deleted_at)
  where deleted_at is not null;

-- UWAGA: swiadomie NIE ma indeksu na full_path bez predykatu, na slug, na
--   in_menu ani na published. Catch-all z etapu 4 pyta o (full_path, published,
--   deleted_at) i obsluguje go pages_full_path_key; menu czyta cala tabele
--   kilkudziesieciu wierszy. Kazdy dodatkowy indeks kosztowalby przy zapisie,
--   a zapisow jest tu wiecej niz jeden na wiersz - trigger z sekcji 8 dotyka
--   jeszcze potomkow.


-- ============================================================================
--  6. public.redirects - stary adres -> nowy adres
--
--     Tabela jest GENERYCZNA: trzyma pary adresow, a nie odwolania do pages.
--     Dzieki temu obsluzy tez zmiane sluga aktualnosci (articles), ktore
--     zostaja poza drzewem stron (par. 5.6) - bez zadnej zmiany schematu.
--
--     Wpisow 'manual' uzywa czlowiek i kod; 'auto' wpisuje trigger z sekcji 8.
--     W etapie 1 tabela jest PUSTA. Jedna regula z next.config.ts (/cennik ->
--     /zajecia/cennik, status 307, bo permanent: false) przenosi sie tu dopiero
--     w etapie 4 i tylko po potwierdzeniu, ze nowa sciezka dziala. Druga regula
--     (/organizacja/zalozyciel-i-wsko) ZOSTAJE w next.config.ts na zawsze: ten
--     adres nigdy nie dotrze do catch-alla, bo app/organizacja/[slug]/page.tsx:41
--     dopasuje go pierwszy i zrobi notFound().
-- ============================================================================

create table if not exists public.redirects (
  old_path   text        not null,
  new_path   text        not null,
  status     smallint    not null default 308,
  source     text        not null default 'auto',
  created_at timestamptz not null default now(),

  constraint redirects_pkey primary key (old_path),

  -- Adresy trzymamy bez ukosnika koncowego i bez domeny. Zmierzone: /kontakt/
  -- Next normalizuje na 308 do /kontakt PRZED routingiem, a /Kontakt daje 404 -
  -- czyli warianty z ukosnikiem i z wielkimi literami nie sa potrzebne (par. 5.6).
  constraint redirects_old_path_chk check (old_path ~ '^/'),
  constraint redirects_new_path_chk check (new_path ~ '^/'),
  constraint redirects_status_chk   check (status in (301, 302, 307, 308)),
  constraint redirects_source_chk   check (source in ('auto', 'manual')),

  -- Wiersz wskazujacy sam na siebie to petla przekierowan: przegladarka dostaje
  -- ERR_TOO_MANY_REDIRECTS na adresie, ktory przed chwila dzialal. Trigger
  -- z sekcji 8 ma osobny warunek, zeby takiego wiersza nawet nie probowac zapisac.
  constraint redirects_no_self_chk check (old_path <> new_path)
);

alter table public.redirects enable row level security;

-- Ten sam drugi zamek co przy pages, z tego samego powodu. Tabela przekierowan
-- jest mniej wrazliwa (pary adresow, nie tresc), ale zdradza sciezki, ktore
-- redaktor swiadomie usunal albo przeniosl - a to jest mapa serwisu dla skanera.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.redirects from anon;
  end if;
end $$;

-- Naprawa tabeli zalozonej wczesniej w wersji okrojonej - dokladnie te same
-- powody co w sekcjach 2 i 3. old_path i new_path dodaja sie tu BEZ "not null",
-- bo nie maja defaultu, a "add column ... not null" bez defaultu przerwaloby
-- skrypt bledem 23502 na tabeli, ktora ma juz wiersze. NOT NULL domyka nizej
-- ta sama warunkowa petla co dla pages - i musi ona pojsc PRZED dodaniem
-- klucza glownego, bo klucz glowny na kolumnie dopuszczajacej NULL nie powstanie.
alter table public.redirects add column if not exists old_path   text;
alter table public.redirects add column if not exists new_path   text;
alter table public.redirects add column if not exists status     smallint    not null default 308;
alter table public.redirects add column if not exists source     text        not null default 'auto';
alter table public.redirects add column if not exists created_at timestamptz not null default now();

alter table public.redirects alter column status     set default 308;
alter table public.redirects alter column source     set default 'auto';
alter table public.redirects alter column created_at set default now();

do $$
declare
  kolumna  text;
  sa_nulle boolean;
begin
  foreach kolumna in array array['old_path', 'new_path', 'status', 'source', 'created_at']
  loop
    execute format('select exists (select 1 from public.redirects where %I is null)', kolumna)
       into sa_nulle;
    if not sa_nulle then
      execute format('alter table public.redirects alter column %I set not null', kolumna);
    end if;
  end loop;
end $$;

-- Klucz glowny na old_path jest TWARDO wymagany przez trigger z sekcji 8:
-- "on conflict (old_path) do update" bez PK/UNIQUE konczy sie bledem 42P10
-- w trakcie zwyklego zapisu z panelu, czyli miesiace po uruchomieniu tego pliku
-- i w miejscu, w ktorym nikt nie bedzie szukal przyczyny. Powod uzycia warunku
-- na katalog, a nie samego handlera duplicate_object - ten sam co przy
-- pages_pkey (blad 42P16 przy drugim kluczu glownym).
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conrelid = 'public.redirects'::regclass and contype = 'p'
  ) then
    alter table public.redirects add constraint redirects_pkey primary key (old_path);
  end if;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.redirects
    add constraint redirects_old_path_chk check (old_path ~ '^/');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.redirects
    add constraint redirects_new_path_chk check (new_path ~ '^/');
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.redirects
    add constraint redirects_status_chk check (status in (301, 302, 307, 308));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.redirects
    add constraint redirects_source_chk check (source in ('auto', 'manual'));
exception when duplicate_object then null;
end $$;

do $$
begin
  alter table public.redirects
    add constraint redirects_no_self_chk check (old_path <> new_path);
exception when duplicate_object then null;
end $$;

-- UWAGA: swiadomie brak indeksu na new_path, choc trigger z sekcji 8 robi
--   "update ... where new_path = ..." przy domykaniu lancuchow. Ta tabela ma
--   rzad wielkosci kilkunastu wierszy i rosnie tylko przy zmianie adresu;
--   seq scan po kilkunastu wierszach jest tanszy niz utrzymanie indeksu.
--   Gdyby kiedys urosla do tysiecy wierszy - wtedy indeks, nie teraz.
-- UWAGA: brak licznika trafien i brak sladu, kiedy przekierowanie ostatnio
--   zadzialalo. Swiadomie: kazdy taki licznik to zapis do bazy przy ODCZYCIE
--   strony, na trasie objetej ISR - najgorszy mozliwy stosunek kosztu do zysku
--   na planie darmowym.


-- ============================================================================
--  7. Trigger BEFORE INSERT/UPDATE - glebokosc, petle, adres
--
--     Trzy rzeczy, ktorych NIE MOZNA zostawic kodowi, bo wiersze bywaja
--     zapisywane skryptem migracji i z SQL Editora, nie tylko z panelu:
--       * depth liczony z rodzica, a nie przepisany z formularza,
--       * zakaz petli w drzewie,
--       * full_path liczony w jednym miejscu.
--
--     Funkcja ma "set search_path = ''", wiec wszystkie nazwy sa w niej w pelni
--     kwalifikowane (public.pages). Awaria, ktorej to zapobiega: ktos tworzy
--     tabele "pages" w innym schemacie stojacym wczesniej w search_path
--     i trigger zaczyna po cichu czytac nie te dane. To jest tez ostrzezenie,
--     ktore zglasza linter Supabase (function_search_path_mutable).
-- ============================================================================

create or replace function public.pages_before_write()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
declare
  rodzic          record;
  sciezka_rodzica text;   -- full_path najblizszego przodka typu 'page'
begin
  if new.parent_id is not null then

    -- Sprawdzenie "sam sobie rodzicem" MUSI byc przed odczytem rodzica.
    -- W wersji z par. 2.4 stalo za odczytem i przy INSERT dawalo mylacy
    -- komunikat: wiersza o tym id nie ma jeszcze w tabeli, wiec redaktor
    -- dostawal "Rodzic nie istnieje" zamiast prawdziwej przyczyny.
    if new.parent_id = new.id then
      raise exception 'Strona nie może być własnym rodzicem.';
    end if;

    select p.id, p.depth, p.kind, p.full_path
      into rodzic
      from public.pages p
     where p.id = new.parent_id;

    -- "if not found", a NIE "if rodzic.id is null". Semantyka SELECT INTO dla
    -- zmiennej typu record przy zerowej liczbie wierszy jest w plpgsql
    -- niejednoznaczna miedzy wersjami Postgresa: bywa, ze pola sa NULL, a bywa,
    -- ze odwolanie do pola konczy sie bledem "record ... is not assigned yet.
    -- The tuple structure of a not-yet-assigned record is indeterminate".
    -- FOUND jest zdefiniowane zawsze i nie zalezy od wersji.
    --
    -- Ten test nie jest zbedny obok klucza obcego: FK sprawdza sie DOPIERO po
    -- wykonaniu wiersza, wiec bez tego testu trigger poszedlby dalej
    -- z niezainicjowanym rodzicem i policzyl depth z NULL.
    if not found then
      raise exception 'Rodzic nie istnieje (parent_id = %).', new.parent_id;
    end if;

    if rodzic.kind = 'link' then
      raise exception 'Odnośnik zewnętrzny nie może mieć podstron.';
    end if;

    if rodzic.depth >= 2 then
      raise exception 'Drzewo ma najwyżej trzy poziomy.';
    end if;

    -- Petla w drzewie. Idziemy w gore od PROPONOWANEGO rodzica po zapisanych
    -- (jeszcze niezmienionych) wartosciach parent_id; jesli natrafimy na
    -- zapisywany wiersz, ta zmiana zamknelaby cykl.
    --
    -- Przy INSERT ten test jest z natury pusty i to jest w porzadku: new.id ma
    -- juz wartosc (DEFAULT gen_random_uuid() wypelnia sie PRZED triggerem
    -- BEFORE, przy budowaniu wiersza), ale zaden istniejacy wiersz nie moze
    -- wskazywac na id, ktorego w tabeli nie ma - broni tego klucz obcy. Cykl
    -- da sie utworzyc wylacznie przez UPDATE parent_id i tam ten test dziala.
    --
    -- Licznik "poziom" nie jest ozdoba: gdyby w tabeli kiedykolwiek znalazl sie
    -- cykl (np. ktos usunal trigger, wpisal dane i przywrocil trigger tym
    -- plikiem), rekurencja bez limitu wieszalaby kazdy zapis na zawsze - baza
    -- nie oddalaby polaczenia, a panel czekalby do timeoutu. Klauzula CYCLE
    -- z SQL:1999 jest w Postgresie od wersji 14, a setup.sql deklaruje
    -- zgodnosc z 13+, wiec limit liczymy sami.
    if exists (
      with recursive przodkowie as (
        select p.id, p.parent_id, 1 as poziom
          from public.pages p
         where p.id = new.parent_id
        union all
        select p.id, p.parent_id, a.poziom + 1
          from public.pages p
          join przodkowie a on p.id = a.parent_id
         where a.poziom < 10
      )
      select 1 from przodkowie where id = new.id
    ) then
      raise exception 'Ta zmiana utworzyłaby pętlę w drzewie.';
    end if;

    new.depth := rodzic.depth + 1;
  else
    new.depth := 0;
  end if;

  -- ADRES - piec rozlacznych galezi, kolejnosc ma znaczenie.
  --
  -- KRYTERIUM ZMIENILO SIE 2026-09-09 (decyzja D1 wlasciciela): nie pytamy juz
  -- "czy przodek jest strona", tylko "czy przodek MA WLASNY ADRES". Jedna
  -- regula obsluguje wtedy trzy przypadki naraz:
  --   strona                -> ma adres  -> zatrzymuje wspinaczke,
  --   naglowek ZE slugiem   -> ma adres  -> zatrzymuje, czyli dziala jak folder
  --                                         i zadna podstrona nie rusza adresu
  --                                         przy zamianie strony w naglowek,
  --   naglowek BEZ sluga    -> adres NULL-> dalej przezroczysty, czyli
  --                                         dzisiejsze /faq pod "ZAJECIA"
  --                                         zostaje /faq.
  --
  -- Awaria, ktorej cala ta galaz zapobiega od poczatku: "ZAJECIA" to
  -- kind='header' bez sluga, wiec liczenie adresu z lancucha slugow dawalo
  -- dzieciom coalesce(NULL,'') || '/' || slug. Ich adresy /zajecia/cennik,
  -- /zajecia/dorosli i /zajecia/dzieci biora sie z kolumny route, nie z drzewa,
  -- i tak ma zostac.
  if new.kind = 'link' then
    -- Odnosnik zewnetrzny nie ma wlasnego adresu w tym serwisie. Gdyby zostawic
    -- tu stara wartosc, pages_full_path_key trzymalby zajety adres dla wiersza,
    -- ktory go nie uzywa.
    new.full_path := null;

  elsif new.kind = 'header' and new.slug is null then
    -- Naglowek zalozony jako naglowek: grupuje w menu i nie wnosi do sciezki
    -- nic. To jest zgodnosc wsteczna dla wierszy sprzed zmiany D1.
    new.full_path := null;

  elsif new.source = 'route' then
    -- Trase obsluguje plik w kodzie Next, wiec adres jest DOSLOWNIE tym, co Next
    -- obsluguje - nigdy z lancucha slugow. Ta galaz obejmuje tez strone glowna
    -- (route = '/'), ktora nie ma i nie moze miec sluga.
    new.full_path := new.route;

  elsif new.parent_id is null then
    new.full_path := '/' || new.slug;

  else
    -- Tresc z bazy: adres najblizszego przodka, KTORY MA WLASNY ADRES.
    -- Naglowki bez sluga przeskakujemy, bo do sciezki nie wnosza nic.
    --
    -- Rekurencja rozwija sie WYLACZNIE z wierszy bez adresu (a.full_path is
    -- null), wiec zatrzymuje sie na pierwszym przodku z adresem i zbior
    -- wynikowy zawiera CO NAJWYZEJ JEDEN taki wiersz. Odnosnik przodkiem byc
    -- nie moze, bo wyzej odrzucamy rodzica kind='link'.
    -- Mimo tego jest tu jawne "order by poziom": bez ORDER BY kolejnosc wierszy
    -- z CTE nie jest przez Postgresa gwarantowana, a to, ze dzis wybor jest
    -- jednoznaczny, wynika z warunku rekurencji - czyli z rzeczy, ktora ktos
    -- moze kiedys rozluznic, nie zauwazajac, ze "limit 1" zaczyna wtedy
    -- losowac przodka, a razem z nim adres calego poddrzewa.
    --
    -- PRZED D1 stalo tu 'a.kind <> ''page''' i 'pw.kind = ''page'''. Podmiana
    -- na kryterium adresu jest CALA zmiana wariantu A po stronie triggera:
    -- naglowek ze slugiem ma full_path, wiec od teraz zatrzymuje wspinaczke
    -- i jego podstrony zostaja tam, gdzie byly.
    with recursive przodkowie_wzwyz as (
      select p.id, p.parent_id, p.kind, p.full_path, 1 as poziom
        from public.pages p
       where p.id = new.parent_id
      union all
      select p.id, p.parent_id, p.kind, p.full_path, a.poziom + 1
        from public.pages p
        join przodkowie_wzwyz a on p.id = a.parent_id
       where a.full_path is null
         and a.poziom < 10
    )
    select pw.full_path
      into sciezka_rodzica
      from przodkowie_wzwyz pw
     where pw.full_path is not null
     order by pw.poziom
     limit 1;

    -- nullif(...,'/') - zeby dziecko strony glownej dalo '/cos', nie '//cos'.
    --
    -- sciezka_rodzica moze byc NULL, gdy nad wezlem stoja same naglowki BEZ
    -- slugow - wychodzi wtedy adres jednosegmentowy. To NIE jest awaria, tylko
    -- stan faktyczny serwisu: /faq stoi pod naglowkiem "ZAJECIA" i ma byc
    -- jednosegmentowe (punkt F4 checklisty, potwierdzony przez wlasciciela).
    -- Wczesniejsza wersja tego komentarza twierdzila cos przeciwnego ("wszystkie
    -- trzy dzieci ZAJEC maja source='route'") i zapowiadala zakaz w panelu -
    -- zakaz nigdy nie powstal, a twierdzenie bylo nieaktualne co najmniej od
    -- momentu, gdy /faq trafilo pod ZAJECIA.
    --
    -- Po D1 redaktor ma na to wlasciwe narzedzie: jesli chce, zeby podstrony
    -- naglowka mialy wspolny prefiks, nadaje naglowkowi slug. Wtedy naglowek
    -- ma adres i ta galaz go uzywa.
    new.full_path := coalesce(nullif(sciezka_rodzica, '/'), '') || '/' || new.slug;
  end if;

  -- Gdyby slug byl tu NULL, full_path wyszedlby NULL (konkatenacja z NULL), ale
  -- wiersz i tak nie zostanie zapisany: pages_kind_fields_chk wymaga sluga dla
  -- kind='page' przy source='db', a ograniczenia sprawdzaja sie PO triggerze
  -- BEFORE. Dlatego nie ma tu osobnego raise - komunikat z CHECK-a wskazuje
  -- dokladnie ten problem, a druga walidacja tego samego warunku rozjechalaby
  -- sie z pierwsza przy najblizszej zmianie.

  new.updated_at := now();
  return new;
end $$;

drop trigger if exists pages_before_write_trg on public.pages;
create trigger pages_before_write_trg
  before insert or update on public.pages
  for each row execute function public.pages_before_write();

-- UWAGA DLA AUTORA ETAPU 2 - to jest pulapka, ktora kosztuje dzien:
--   RODZIC I DZIECKO NIE MOGA WEJSC JEDNYM POLECENIEM INSERT. Ten trigger
--   odczytuje rodzica zapytaniem do tabeli, a wiersze wstawione wczesniej
--   przez TO SAMO polecenie nie sa jeszcze dla takiego zapytania widoczne
--   (maja ten sam numer polecenia, wiec migawka ich nie obejmuje). Dziecko
--   dostanie wiec blad "Rodzic nie istnieje", mimo ze rodzic jest w tej samej
--   paczce danych.
--   Konsekwencja praktyczna: PostgREST wysyla tablice obiektow jako JEDEN
--   insert, wiec backfill nie moze wrzucic calego drzewa jednym zapytaniem.
--   Kolejnosc obowiazkowa: najpierw wszystkie wiersze poziomu 0 (jedno
--   zapytanie), potem poziom 1 (drugie zapytanie), potem poziom 2. Rodzenstwo
--   w jednej paczce jest bezpieczne, para rodzic-dziecko nie.
--   To samo dotyczy "insert ... select" po tabeli, ktora dopiero powstaje.


-- ============================================================================
--  8. Trigger AFTER UPDATE - przekierowania i przeliczenie potomkow
--
--     Dwa mechanizmy w jednej funkcji, bo oba odpalaja sie na dokladnie ten sam
--     warunek (zmienil sie adres albo glebokosc) i oba musza widziec ten sam
--     stan wiersza. Dwa osobne triggery na tym samym zdarzeniu wykonywalyby sie
--     w kolejnosci alfabetycznej NAZW - zaleznosc, ktorej nikt nie zauwazy przy
--     zmianie nazwy triggera.
--
--     DLACZEGO TO WCHODZI JUZ W ETAPIE 1, a nie razem z panelem w etapie 5:
--     par. 2.4 opisuje oba mechanizmy jako czesc modelu, a cala obietnica
--     "migracja nie zmienia ani jednego adresu" (par. 5.1) stoi na tym, ze
--     przekierowanie zapisuje sie SAMO, od pierwszego dnia. Doklejanie triggera
--     pozniej to druga reczna wizyta w SQL Editorze, a przede wszystkim okno,
--     w ktorym zmiana sluga po cichu kasuje zaindeksowany adres.
-- ============================================================================

create or replace function public.pages_after_update()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  -- ---------------------------------------------------------------- 1. ADRES
  -- Adres sie zmienil, wiec stary trzeba przekierowac na nowy. 308 (permanent
  -- redirect) zachowuje metode zadania i mowi wyszukiwarce, ze przenosiny sa
  -- trwale.
  --
  -- Trzy dodatkowe warunki wejscia, kazdy zamyka konkretna awarie:
  --   old.full_path is not null - naglowek zamieniony na strone nie ma starego
  --       adresu, z ktorego mialoby cokolwiek prowadzic;
  --   new.full_path is not null - strona zamieniona na naglowek albo odnosnik nie
  --       ma nowego adresu; bez tego warunku insert przerwalby sie bledem 23502
  --       (new_path is not null) i redaktor dostalby w panelu nieczytelny blad
  --       bazy przy zwyklym zapisie. Skutek uboczny jest opisany w UWAGACH
  --       na koncu tej sekcji;
  --   new.deleted_at is null - dla strony w koszu nowy adres tez nie dziala, wiec
  --       przekierowanie prowadziloby na 404. Ten warunek zamyka tez drugi,
  --       rzadszy blad: strona zywa i strona w koszu MOGA dzis miec ten sam
  --       full_path (indeks jest czesciowy), a dwa wiersze z tym samym old_path
  --       w jednym poleceniu daja blad 21000 ("ON CONFLICT DO UPDATE command
  --       cannot affect row a second time").
  --   new.kind = 'page' - DOLOZONE 2026-09-09 razem z wariantem A. Odkad
  --       naglowek moze miec wlasny adres, zmiana jego sluga wchodzila w ten
  --       blok i zapisywala 308 "stary adres naglowka -> nowy adres naglowka".
  --       Naglowek publicznie nie renderuje sie w ogole (getStrona filtruje
  --       kind='page'), wiec bylo to przekierowanie prowadzace na 404 - gorsze
  --       od jego braku, bo wyglada w tabeli na sprawne. Przekierowanie ze
  --       starego adresu naglowka na jego PIERWSZA PODSTRONE zapisuje jawnie
  --       funkcja strona_na_naglowek z 05-zamiana-rodzaju.sql: ona jedna wie,
  --       ktora podstrona przejmuje ruch.
  if old.full_path is distinct from new.full_path
     and old.full_path is not null
     and new.full_path is not null
     and new.kind = 'page'
     and new.deleted_at is null then

    -- (a) Samo przekierowanie. Jesli stary adres byl juz kiedys przekierowany,
    --     przestawiamy go na nowy cel. status i source zostaja nietkniete
    --     swiadomie: regula wpisana recznie (source='manual', np. 307 dla
    --     /cennik) ma zachowac swoj kod odpowiedzi, a nie dostac po cichu 308.
    insert into public.redirects (old_path, new_path, status, source)
         values (old.full_path, new.full_path, 308, 'auto')
    on conflict (old_path) do update
       set new_path = excluded.new_path;

    -- (b) Domkniecie lancuchow. Stare przekierowania celujace w poprzedni adres
    --     tej strony przestawiamy prosto na nowy - inaczej po dwoch zmianach
    --     sluga powstaje /a -> /b -> /c, czyli dwa przeskoki dla przegladarki
    --     i rozmyta sila linku dla wyszukiwarki.
    --
    --     Warunek old_path <> new.full_path jest tu KRYTYCZNY, nie kosmetyczny:
    --     bez niego przy zmianie z powrotem (/a -> /b, a potem /b -> /a) wiersz
    --     (/a -> /b) zostalby przestawiony na (/a -> /a) i zlamal
    --     redirects_no_self_chk bledem 23514 w trakcie zapisu z panelu.
    update public.redirects
       set new_path = new.full_path
     where new_path = old.full_path
       and old_path <> new.full_path;

    -- (c) Nowy adres jest od tej chwili ZYWY, wiec nie moze byc zrodlem
    --     przekierowania. Bez tego kroku scenariusz "zmienilem slug i wrocilem
    --     na stary" konczy sie petla: /a -> /b (stary wiersz) i /b -> /a (nowy).
    --     Zaden pojedynczy wiersz nie wskazuje sam na siebie, wiec CHECK tego
    --     nie widzi - petla powstaje z dwoch osobno poprawnych wierszy.
    --
    --     KOLEJNOSC: ten DELETE nie moze usunac wiersza wstawionego w (a), bo
    --     tamten ma old_path = old.full_path, a warunek wejscia gwarantuje
    --     old.full_path <> new.full_path. Nie moze tez usunac niczego, co (b)
    --     wlasnie naprawilo, bo (b) z definicji pomija wiersze o old_path
    --     rownym new.full_path.
    delete from public.redirects
     where old_path = new.full_path;
  end if;

  -- ------------------------------------------------ 2. PRZELICZENIE POTOMKOW
  -- Zmiana adresu albo glebokosci rodzica uniewaznia adres i glebokosc calego
  -- poddrzewa. Dotykamy dzieci pustym zapisem; ich wlasny trigger BEFORE
  -- przelicza full_path i depth od nowa, a ich wlasny trigger AFTER dotyka
  -- wnukow i - co wazne - zapisuje przekierowanie dla KAZDEGO przeniesionego
  -- potomka osobno. Zmiana sluga rodzica nie gubi wiec adresow podstron.
  --
  -- DOWOD, ZE TO SIE ZATRZYMUJE (trzy niezalezne warunki stopu):
  --   1. KIERUNEK. "where parent_id = new.id" schodzi zawsze O JEDEN poziom
  --      w dol i nigdy w gore ani w bok. Zeby lancuch wrocil do wiersza, ktory
  --      juz byl dotkniety, w drzewie musialby istniec cykl - a temu zapobiega
  --      trigger BEFORE z sekcji 7, ktory jest jedyna droga zapisu do tej tabeli.
  --   2. WYSOKOSC DRZEWA. depth ma CHECK 0..2, a trigger BEFORE odrzuca dziecko
  --      rodzica o depth >= 2. Poddrzewo ma wiec najwyzej dwa poziomy pod
  --      dotknietym wierszem: rekurencja jest ograniczona z gory liczba 2,
  --      niezaleznie od czegokolwiek innego.
  --   3. BRAK ZMIANY. Dla wierszy kind='page' klauzula WHEN sprawdza, czy adres
  --      albo glebokosc FAKTYCZNIE sie zmienily; dziecko, ktore przeliczylo sie
  --      na te same wartosci (np. z source='route', gdzie adres nie zalezy od
  --      rodzica), nie odpala funkcji i lancuch gasnie. Na liscie konczy go
  --      warunek trywialny: zapytanie nie dopasowuje zadnego wiersza.
  --      UWAGA: dla naglowkow i odnosnikow ten punkt NIE dziala (patrz nizej),
  --      wiec zatrzymanie stoi wtedy wylacznie na punktach 1 i 2 - a one
  --      wystarczaja same: kierunek w dol plus depth ograniczone do 0..2 daja
  --      najwyzej dwa poziomy zejscia, niezaleznie od czegokolwiek innego.
  --
  -- CZWARTY I PIATY CZLON WARUNKU - poprawka wobec par. 2.4 specyfikacji.
  -- Awaria, ktora zamykaja (znaleziona niezaleznie przez dwie kontrole):
  -- naglowek grupujacy ma ZAWSZE full_path = NULL (galaz "kind <> 'page'"
  -- w triggerze BEFORE), wiec dla niego "old.full_path is distinct from
  -- new.full_path" jest ZAWSZE falszywe. Scenariusz: naglowek WLADZE stoi pod
  -- strona /organizacja i ma dziecko /organizacja/zarzad. Panel z etapu 5
  -- przenosi WLADZE pod strone /o-shorinji. Trigger BEFORE liczy naglowkowi
  -- depth = 1 (bez zmiany, oba rodzice sa na poziomie 0) i full_path = NULL
  -- (bez zmiany). Stary warunek jest falszywy na obu czlonach, potomkowie nie
  -- sa przeliczani i /organizacja/zarzad zostaje pod adresem rodzica, ktorego
  -- juz nie ma nad soba - adres klamie, a zadne przekierowanie nie powstaje,
  -- bo nikt nie zauwazyl zmiany. To samo dotyczy zmiany sluga strony stojacej
  -- NAD naglowkiem: rekurencja urywala sie na naglowku i wnuki nie schodzily.
  if old.full_path  is distinct from new.full_path
     or old.depth     is distinct from new.depth
     or old.parent_id is distinct from new.parent_id
     or new.kind <> 'page' then
    update public.pages set updated_at = now() where parent_id = new.id;
  end if;

  return null;   -- w triggerze AFTER wartosc zwracana jest ignorowana
end $$;

drop trigger if exists pages_after_update_trg on public.pages;
create trigger pages_after_update_trg
  after update on public.pages
  for each row
  when (old.full_path  is distinct from new.full_path
        or old.depth     is distinct from new.depth
        or old.parent_id is distinct from new.parent_id
        or new.kind <> 'page')
  execute function public.pages_after_update();

-- UWAGA: klauzula WHEN nie jest optymalizacja - jest warunkiem stopu rekurencji
--   (punkt 3 dowodu wyzej). Usuniecie jej zamienia ten trigger w mechanizm,
--   ktory przy kazdym zapisie przechodzi cale poddrzewo bez powodu, a przy
--   danych z cyklem (gdyby kiedys powstal) nie ma juz zadnego hamulca.
-- UWAGA: jedno polecenie UPDATE nie moze objac naraz RODZICA i jego DZIECKA.
--   Trigger rodzica dotyka dziecka w trakcie tego samego polecenia, a Postgres
--   odrzuca wtedy druga zmiane tego samego wiersza bledem "tuple to be updated
--   was already modified by an operation triggered by the current command".
--   Panel z etapu 5 (przestawianie poddrzew, zapis kolejnosci) musi wiec
--   zapisywac wiersze pojedynczo albo w grupach, w ktorych nie ma pary
--   rodzic-dziecko. Zapis samego rodzenstwa jednym poleceniem jest bezpieczny.
-- UWAGA: zamiana strony w naglowek albo w odnosnik (kind: 'page' -> 'header')
--   NIE zapisuje przekierowania, bo nie ma dokad. Stary adres zaczyna zwracac
--   404. Panel z etapu 5 musi to pokazac redaktorowi PRZED zapisem, a nie po -
--   to jedyna operacja w tym modelu, ktora traci zaindeksowany adres bez sladu.
--   Alternatywa (blad z bazy i brak mozliwosci zapisu) byla odrzucona: redaktor
--   nie mialby jak dokonczyc poprawnej zmiany struktury.
-- UWAGA: trwale usuniecie wiersza (DELETE) tez nie zapisuje przekierowania
--   i celowo nie ma tu triggera BEFORE/AFTER DELETE. Usuniecie tresci ma dawac
--   404, chyba ze redaktor sam wskaze adres zastepczy (par. 5.6). Wiersze
--   w redirects celujace w usuniety adres zostaja - prowadza wtedy na 404,
--   dokladnie tak jak prowadzilby sam usuniety adres.
-- UWAGA: przekierowan dla aktualnosci (articles) ten trigger NIE obsluguje -
--   aktualnosci sa poza drzewem pages. Robi to jawnie akcja zapisu artykulu
--   (etap 4, par. 5.6): wstawia wiersz /aktualnosci/<stary> -> /aktualnosci/<nowy>
--   z source='manual'. Tabela redirects jest generyczna, wiec nie wymaga to
--   zadnej zmiany schematu.
-- UWAGA: wiersz w redirects o old_path rownym adresowi ZYWEJ strony jest
--   nieszkodliwy, bo catch-all z etapu 4 pyta najpierw o pages (par. 5.6 krok 2),
--   a o redirects dopiero gdy nie znalazl strony (krok 5). Punkt (c) wyzej
--   sprzata takie wiersze przy zmianie adresu; wiersz wpisany recznie na adres,
--   ktory dopiero potem stal sie zywy, zostanie - i to jest akceptowalne,
--   bo nigdy nie zadziala.


-- ============================================================================
--  9. Komunikat dla wlasciciela
--
--     setup.sql i 02-kosz-i-historia.sql nie uzywaja raise notice ani razu -
--     caly feedback idzie tam przez zapytania SELECT. Tutaj jest jeden wyjatek,
--     swiadomy: ten plik jest dluzszy od tamtych i wprowadza obiekty, ktorych
--     wczesniej w bazie nie bylo, wiec jedna linia potwierdzenia oszczedza
--     zgadywanie, czy "Success. No rows returned" dotyczylo calosci.
--
--     Jesli SQL Editor nie pokazuje komunikatow NOTICE, nic nie szkodzi -
--     prawdziwa weryfikacja jest w tabelce z ostatniego zapytania w tym pliku.
-- ============================================================================

do $$
begin
  raise notice 'Etap 1 gotowy: tabele pages i redirects utworzone, RLS włączony, zero polityk.';
  raise notice 'Wynik kontroli jest w tabelce poniżej - w kolumnie "ocena" musi być samo OK albo informacja.';
end $$;

-- Zatwierdzenie transakcji otwartej na poczatku pliku. Od tego miejsca zmiany
-- sa trwale. Kontrola nizej jest juz tylko odczytem - musi czytac stan PO
-- zatwierdzeniu, inaczej pokazywalaby to, co jeszcze moze zostac wycofane.
-- Jesli SQL Editor sam owinal plik w transakcje, zobaczysz tu ostrzezenie
-- "there is no transaction in progress" przy jego wlasnym commicie. Nieszkodliwe.
commit;


-- ============================================================================
--  KONTROLA PO URUCHOMIENIU
--
--  To jest OSTATNIE zapytanie w pliku, wiec SQL Editor pokaze wlasnie jego
--  wynik. Nie trzeba nic kopiowac ani uruchamiac osobno.
--
--  Zapytanie sprawdza naraz wszystko, co "create table if not exists" mogloby
--  po cichu pominac:
--    * obie tabele istnieja,
--    * RLS jest wlaczony na obu (bez tego szkice i kosz byly by czytelne kluczem
--      anon z bundla przegladarki),
--    * polityk RLS jest ZERO (jedna polityka dla anon = wyciek szkicow),
--    * komplet kolumn w pages i w redirects (brakujaca kolumna = przerwany
--      backfill w etapie 2 i powrot tutaj),
--    * kolumny, ktore powinny byc NOT NULL, sa NOT NULL,
--    * komplet ograniczen, indeksow, funkcji i triggerow,
--    * dwie rzeczy, ktore latwo "poprawic" wbrew decyzji projektowej: layout
--      BEZ CHECK-a (par. 9.4 pkt 1) i klucz obcy z ON DELETE RESTRICT (par. 2.3).
--
--  DOBRY WYNIK: w kolumnie "ocena" jest samo OK, a w ostatnim wierszu
--  "informacja". W kolumnie "wynik" przy brakach zobaczysz NAZWY brakujacych
--  obiektow - wtedy uruchom ten plik jeszcze raz i sprawdz, czy SQL Editor
--  nie zglosil bledu wyzej. Jesli blad sie powtarza, przeslij tresc kolumny
--  "wynik" - nazwa obiektu wystarcza, zeby ustalic przyczyne.
-- ============================================================================

with oczekiwane(rodzaj, nazwa) as (
  select 'kolumna_pages', k from unnest(array[
    'id', 'parent_id', 'kind', 'source', 'route', 'slug', 'full_path',
    'external_url', 'kicker', 'title', 'intro', 'blocks', 'content_key',
    'cloudinary_folder', 'layout', 'menu_label', 'in_menu', 'published',
    'depth', 'position', 'migrated_from', 'deleted_at', 'updated_by',
    'created_at', 'updated_at']) as k
  union all
  select 'kolumna_redirects', k from unnest(array[
    'old_path', 'new_path', 'status', 'source', 'created_at']) as k
  union all
  select 'ograniczenie', k from unnest(array[
    'pages_pkey', 'pages_parent_id_fkey', 'pages_kind_chk',
    'pages_source_values_chk', 'pages_depth_chk', 'pages_kind_fields_chk',
    'pages_source_chk', 'pages_slug_format_chk', 'pages_title_not_blank_chk',
    'pages_header_visible_chk', 'pages_external_url_chk',
    'pages_route_format_chk', 'redirects_pkey', 'redirects_old_path_chk',
    'redirects_new_path_chk', 'redirects_status_chk', 'redirects_source_chk',
    'redirects_no_self_chk']) as k
  union all
  select 'indeks', k from unnest(array[
    'pages_full_path_key', 'pages_parent_slug_key', 'pages_migrated_from_key',
    'pages_parent_position_idx', 'pages_deleted_at_idx']) as k
  union all
  select 'trigger', k from unnest(array[
    'pages_before_write_trg', 'pages_after_update_trg']) as k
  union all
  select 'kolumna_not_null', k from unnest(array[
    'id', 'kind', 'source', 'title', 'blocks', 'layout', 'in_menu',
    'published', 'depth', 'position', 'created_at', 'updated_at']) as k
)
select nr, kontrola, wynik,
       case when wzorzec = '(informacja)' then 'informacja'
            when wynik = wzorzec          then 'OK'
            else 'BLAD - przeczytaj komentarz nad tym zapytaniem'
       end as ocena
  from (
    select 1 as nr,
           'Obie tabele istnieja (pages, redirects)' as kontrola,
           (select count(*)::text
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public'
               and c.relname in ('pages', 'redirects')
               and c.relkind = 'r') as wynik,
           '2' as wzorzec
    union all
    select 2, 'RLS wlaczony na obu tabelach',
           (select count(*)::text
              from pg_class c
              join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public'
               and c.relname in ('pages', 'redirects')
               and c.relrowsecurity), '2'
    union all
    select 3, 'Polityki RLS na tych tabelach (musi byc zero)',
           (select count(*)::text
              from pg_policies
             where schemaname = 'public'
               and tablename in ('pages', 'redirects')), '0'
    union all
    select 4, 'Brakujace kolumny w public.pages',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'kolumna_pages'
                        and not exists (select 1
                                          from information_schema.columns c
                                         where c.table_schema = 'public'
                                           and c.table_name = 'pages'
                                           and c.column_name = o.nazwa)), 'brak'), 'brak'
    union all
    select 5, 'Brakujace kolumny w public.redirects',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'kolumna_redirects'
                        and not exists (select 1
                                          from information_schema.columns c
                                         where c.table_schema = 'public'
                                           and c.table_name = 'redirects'
                                           and c.column_name = o.nazwa)), 'brak'), 'brak'
    union all
    select 6, 'Kolumny pages, ktore powinny byc NOT NULL, a nie sa',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'kolumna_not_null'
                        and exists (select 1
                                      from information_schema.columns c
                                     where c.table_schema = 'public'
                                       and c.table_name = 'pages'
                                       and c.column_name = o.nazwa
                                       and c.is_nullable = 'YES')), 'brak'), 'brak'
    union all
    select 7, 'Brakujace ograniczenia (PK, FK, CHECK)',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'ograniczenie'
                        and not exists (select 1
                                          from pg_constraint k
                                         where k.conname = o.nazwa
                                           and k.connamespace = 'public'::regnamespace)), 'brak'), 'brak'
    union all
    select 8, 'Brakujace indeksy',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'indeks'
                        and not exists (select 1
                                          from pg_indexes i
                                         where i.schemaname = 'public'
                                           and i.indexname = o.nazwa)), 'brak'), 'brak'
    union all
    select 9, 'Brakujace triggery na public.pages',
           coalesce((select string_agg(o.nazwa, ', ' order by o.nazwa)
                       from oczekiwane o
                      where o.rodzaj = 'trigger'
                        and not exists (select 1
                                          from pg_trigger t
                                         where t.tgname = o.nazwa
                                           and not t.tgisinternal)), 'brak'), 'brak'
    union all
    select 10, 'Funkcje triggerow (pages_before_write, pages_after_update)',
           (select count(*)::text
              from pg_proc p
              join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public'
               and p.proname in ('pages_before_write', 'pages_after_update')), '2'
    union all
    select 11, 'Klucz obcy parent_id ma ON DELETE RESTRICT (nie CASCADE)',
           (select case k.confdeltype when 'r' then 'restrict'
                                      when 'c' then 'cascade'
                                      when 'a' then 'no action'
                                      else k.confdeltype::text end
              from pg_constraint k
             where k.conname = 'pages_parent_id_fkey'
               and k.connamespace = 'public'::regnamespace), 'restrict'
    union all
    select 12, 'Kolumna layout swiadomie BEZ CHECK-a (par. 9.4 pkt 1)',
           (select count(*)::text
              from pg_constraint k
             where k.contype = 'c'
               and k.conrelid = (select c.oid
                                   from pg_class c
                                   join pg_namespace n on n.oid = c.relnamespace
                                  where n.nspname = 'public' and c.relname = 'pages')
               and pg_get_constraintdef(k.oid) like '%layout%'), '0'
    union all
    -- Kontrole 13 i 14 patrza na TRESC obiektow, nie na ich nazwy. Bez nich cala
    -- idempotencja tego pliku jest slepa w jednym miejscu: "create index if not
    -- exists" i handler "exception when duplicate_object" dopasowuja sie po
    -- NAZWIE, wiec obiekt o wlasciwej nazwie i zlym ksztalcie zostaje nietkniety,
    -- a kontrola po nazwach melduje "OK". Awaria, ktora to zamyka: ktos uruchomil
    -- wczesniej wersje robocza, w ktorej pages_full_path_key byl indeksem PELNYM
    -- albo pages_kind_fields_chk nie mial ucieczki "or source = 'route'" dla
    -- strony glownej. Plik naprawczy nic nie robi, tabelka pokazuje OK, a etap 2
    -- wywala sie na 42P10 albo odrzuca wiersz strony glownej.
    select 13, 'Indeksy o niewlasciwym KSZTALCIE (nie tylko nazwie)',
           coalesce((select string_agg(x.nazwa, ', ' order by x.nazwa)
                       from (values
                          ('pages_full_path_key',      'CREATE UNIQUE INDEX%WHERE%kind%deleted_at%'),
                          ('pages_parent_slug_key',    'CREATE UNIQUE INDEX%WHERE%kind%deleted_at%'),
                          ('pages_migrated_from_key',  'CREATE UNIQUE INDEX%(migrated_from)'),
                          ('pages_parent_position_idx','CREATE INDEX%parent_id%position%'),
                          ('pages_deleted_at_idx',     'CREATE INDEX%WHERE%deleted_at IS NOT NULL%')
                        ) as x(nazwa, wzor)
                      where not exists (select 1
                                          from pg_indexes i
                                         where i.schemaname = 'public'
                                           and i.indexname = x.nazwa
                                           and i.indexdef like x.wzor)), 'brak'), 'brak'
    union all
    select 14, 'Ograniczenia o niewlasciwej TRESCI (nie tylko nazwie)',
           coalesce((select string_agg(x.nazwa, ', ' order by x.nazwa)
                       from (values
                          -- musi dopuszczac slug NULL przy source='route' - inaczej
                          -- strona glowna (route='/') nie wejdzie do tabeli
                          ('pages_kind_fields_chk',   '%source%'),
                          ('pages_source_chk',        '%route%'),
                          ('pages_slug_format_chk',   '%a-z0-9%'),
                          ('pages_header_visible_chk','%in_menu%'),
                          ('pages_route_format_chk',  '%route%'),
                          ('redirects_no_self_chk',   '%<>%')
                        ) as x(nazwa, wzor)
                      where not exists (select 1
                                          from pg_constraint k
                                         where k.conname = x.nazwa
                                           and k.connamespace = 'public'::regnamespace
                                           and pg_get_constraintdef(k.oid) like x.wzor)), 'brak'), 'brak'
    union all
    select 15, 'Liczba wierszy w public.pages (po etapie 1 ma byc 0)',
           (select count(*)::text from public.pages), '(informacja)'
  ) t
 order by nr;


-- ============================================================================
--  OPCJONALNY TEST NA ZYWEJ BAZIE - CALA SEKCJA JEST ZAKOMENTOWANA
--
--  Do uruchomienia PRZEZ PROGRAMISTE, nie przez wlasciciela, i tylko po etapie 1
--  (na pustej tabeli). Sprawdza, ze triggery faktycznie licza adresy i zapisuja
--  przekierowania. Konczy sie ROLLBACK, wiec nie zostawia danych - ale zeby to
--  bylo prawda, trzeba odkomentowac i wkleic CALOSC razem z ostatnia linia.
--
--  begin;
--
--  insert into public.pages (kind, source, slug, title, "position")
--       values ('page', 'db', 'program-nauczania', 'Program nauczania', 10);
--  insert into public.pages (parent_id, kind, source, slug, title, "position")
--       select id, 'page', 'db', 'uczniowskie', 'Uczniowskie', 10
--         from public.pages where slug = 'program-nauczania';
--  insert into public.pages (parent_id, kind, source, slug, title, "position")
--       select id, 'page', 'db', '6-kyu', '6 kyu', 10
--         from public.pages where slug = 'uczniowskie';
--
--  -- Oczekiwane: /program-nauczania (depth 0), /program-nauczania/uczniowskie (1),
--  --             /program-nauczania/uczniowskie/6-kyu (2)
--  select full_path, depth from public.pages order by depth;
--
--  -- Zmiana sluga rodzica: adresy calego poddrzewa maja sie przeliczyc,
--  -- a w redirects maja pojawic sie TRZY wiersze (rodzic, dziecko, wnuk).
--  update public.pages set slug = 'program' where slug = 'program-nauczania';
--  select full_path, depth from public.pages order by depth;
--  select old_path, new_path, status, source from public.redirects order by old_path;
--
--  -- Powrot na stary slug: przekierowanie /program -> /program-nauczania ma
--  -- powstac, a wiersz /program-nauczania -> /program ma ZNIKNAC (punkt (c)
--  -- w sekcji 8). Zaden wiersz nie moze wskazywac sam na siebie ani tworzyc
--  -- pary /a -> /b i /b -> /a.
--  update public.pages set slug = 'program-nauczania' where slug = 'program';
--  select old_path, new_path from public.redirects order by old_path;
--
--  -- Czwarty poziom musi zostac odrzucony komunikatem "Drzewo ma najwyzej trzy
--  -- poziomy." SQL Editor pokaze go jako blad - to POPRAWNY wynik tego testu:
--  -- insert into public.pages (parent_id, kind, source, slug, title, "position")
--  --      select id, 'page', 'db', '5-kyu', '5 kyu', 10
--  --        from public.pages where slug = '6-kyu';
--
--  rollback;
-- ============================================================================
