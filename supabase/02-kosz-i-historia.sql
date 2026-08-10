-- ============================================================================
--  Kosz i historia zmian
--  Plik: supabase/02-kosz-i-historia.sql
--
--  JAK URUCHOMIC
--  -------------
--    Supabase Dashboard -> SQL Editor -> New query -> wklej calosc -> Run.
--
--  PO CO TO
--  --------
--  Panel nie ma dzis zadnej drogi powrotu. Usuniecie artykulu albo podstrony
--  jest natychmiastowe i nieodwracalne, a przy 2-3 osobach z dostepem nikt
--  nie pamieta, kto co skasowal i jak tresc wygladala wczoraj.
--
--  Ten plik dokłada:
--    1. KOSZ  - kolumna deleted_at w articles i custom_pages. Usuniecie
--               oznacza wiersz zamiast go kasowac; wraca jednym kliknieciem
--               przez 30 dni.
--    2. HISTORIE - tabela content_versions z migawkami tresci i informacja,
--               kto zapisal. Pozwala przywrocic wersje sprzed zmiany.
--    3. AUTORA - kolumny updated_by w articles i custom_pages.
--
--  IDEMPOTENTNOSC
--  --------------
--  Plik mozna uruchamiac wielokrotnie. Wszystko jest `if not exists`.
--  Nigdzie nie ma DROP, TRUNCATE ani DELETE na danych uzytkownika.
--
--  MIEJSCE W BAZIE
--  ---------------
--  Cala tresc serwisu wazy dzis okolo 55 kB. Historia z limitem 20 wersji
--  na element to okolo 0,8 MB przy limicie 500 MB planu darmowego. Limit
--  20 wersji i czyszczenie kosza po 30 dniach pilnuje KOD - bez nich tabela
--  rosnie bez ograniczen i to jest jedyne realne ryzyko dla planu darmowego.
-- ============================================================================


-- ============================================================================
--  1. KOSZ
-- ============================================================================

-- Pusta wartosc = wiersz widoczny. Data = wiersz w koszu od tego momentu.
alter table public.articles
  add column if not exists deleted_at timestamptz;

alter table public.custom_pages
  add column if not exists deleted_at timestamptz;

-- Indeksy czesciowe: obejmuja tylko wiersze w koszu, wiec sa male i nie
-- spowalniaja zwyklych odczytow, ktore i tak filtruja `deleted_at is null`.
create index if not exists articles_deleted_at_idx
  on public.articles (deleted_at)
  where deleted_at is not null;

create index if not exists custom_pages_deleted_at_idx
  on public.custom_pages (deleted_at)
  where deleted_at is not null;

-- UWAGA: od tej chwili KAZDE zapytanie publiczne musi dodac
--   .is("deleted_at", null)
-- inaczej rzeczy z kosza wroca na strone. Zmiana w kodzie idzie osobno.


-- ============================================================================
--  2. AUTOR OSTATNIEJ ZMIANY
-- ============================================================================

-- Trzymamy adres e-mail, a nie identyfikator uzytkownika: konto moze zostac
-- usuniete, a informacja "kto to zmienil" ma przetrwac. To swiadomy wybor
-- prostoty nad normalizacja - panel obsluguje kilka osob, nie tysiace.
alter table public.articles
  add column if not exists updated_by text;

alter table public.custom_pages
  add column if not exists updated_by text;


-- ============================================================================
--  3. HISTORIA ZMIAN
-- ============================================================================

create table if not exists public.content_versions (
  id          uuid        primary key default gen_random_uuid(),

  -- Czego dotyczy migawka. Wartosci uzywane przez kod:
  --   'article'        -> articles.id
  --   'custom_page'    -> custom_pages.id
  --   'page'           -> site_settings.key, np. "page:cennik"
  --   'topic_article'  -> "temat/slug", np. "buddyzm/medytacja"
  --   'footer'         -> "footer"
  --   'schedule'       -> "schedule"
  --   'organization'   -> "organization"
  entity_type text        not null check (char_length(entity_type) <= 40),
  entity_key  text        not null check (char_length(entity_key) <= 200),

  -- Pelna migawka tresci sprzed zapisu. Przywrocenie to zapisanie tego
  -- z powrotem tam, skad pochodzi.
  value       jsonb       not null,

  -- Kto zapisal. Puste dla migawek zrobionych skryptem.
  author      text,

  created_at  timestamptz not null default now()
);

-- Glowne zapytanie: "pokaz historie tego elementu, od najnowszej".
create index if not exists content_versions_entity_idx
  on public.content_versions (entity_type, entity_key, created_at desc);

-- Do czyszczenia najstarszych wpisow ponad limit.
create index if not exists content_versions_created_at_idx
  on public.content_versions (created_at desc);


-- ============================================================================
--  4. RLS
-- ============================================================================

-- Ta sama zasada co w setup.sql: RLS wlaczony, zero polityk. Dostep wylacznie
-- przez klienta service-role, ktory RLS omija. Historia zmian i kosz zawieraja
-- tresci przed publikacja, wiec nie moga byc czytelne kluczem publicznym.
alter table public.content_versions enable row level security;


-- ============================================================================
--  KONTROLA PO URUCHOMIENIU
-- ============================================================================
--
--  select column_name from information_schema.columns
--   where table_name = 'articles' and column_name in ('deleted_at','updated_by');
--   -> powinny byc dwa wiersze
--
--  select count(*) from public.content_versions;
--   -> 0 (tabela istnieje i jest pusta)
--
--  select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' order by tablename;
--   -> content_versions ma rowsecurity = true
-- ============================================================================
