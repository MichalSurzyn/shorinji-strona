-- ============================================================================
--  Drzewo stron i menu - etap 8 (contract): usuniecie starych tabel
--  Plik: supabase/04-contract.sql
--
--  ############  TO JEST JEDYNY KROK BEZ LATWEGO ODWROTU  ####################
--
--  Poprzednie etapy dalo sie wycofac: kod rewertem, dane ponownym backfillem.
--  Ten kasuje trzy tabele z trescia. Po nim jedynym zrodlem prawdy jest
--  public.pages, a jedyna kopia starego stanu - zrzut JSON zrobiony przed
--  migracja (shorinji-notes/db-backup-<data>/).
--  ##########################################################################
--
--  WARUNKI, KTORE MUSZA BYC SPELNIONE PRZED WKLEJENIEM
--  ---------------------------------------------------
--  1. Wlasciciel pracowal na nowym panelu ("Strony i menu") przez TYDZIEN
--     i nie wrocil do starych ekranow. Specyfikacja stawia ten warunek wprost:
--     "dopiero po tygodniu pracy wlasciciela na nowym panelu". Etap ma miec
--     DATE W KALENDARZU - przerwana migracja jest gorsza od punktu wyjscia,
--     bo trzeba utrzymywac dwie sciezki kodu nad jedna trescia.
--  2. scripts/migrate-pages.mjs i scripts/migrate-tresc.mjs zostaly urucho-
--     mione na produkcji PO RAZ OSTATNI i obie kontrole wyszly na zielono.
--     Ten plik zabiera im zrodlo danych - po nim nie da sie ich powtorzyc.
--  3. Swiezy zrzut wszystkich tabel: node scripts/dump-db.mjs
--     To jedyna droga odwrotu. Kosz i content_versions nia NIE SA.
--  4. W repo nie ma juz kodu czytajacego te tabele. Stan na 2026-09-01:
--     ostatnie odwolania to lib/articleContent.ts i lib/blockConvert.ts,
--     ktorych uzywa WYLACZNIE scripts/migrate-tresc.mjs. Oba pliki mozna
--     skasowac razem z wykonaniem tego SQL-a - nie wczesniej, bo do ostatniego
--     uruchomienia migracji sa potrzebne.
--
--  JAK URUCHOMIC
--  -------------
--    Supabase Dashboard -> SQL Editor -> New query -> wklej calosc -> Run.
--    Sprawdz w lewym gornym rogu, czy to wlasciwy projekt.
--
--  CZEGO TEN PLIK NIE RUSZA
--  ------------------------
--  public.pages, public.redirects, public.site_settings, public.articles,
--  public.contact_messages, public.content_versions. Tresc osmiu tras
--  o stalym ukladzie siedzi dalej w site_settings i ma tam zostac az do
--  etapu 9.
-- ============================================================================

begin;

-- ── KROK 0: kontrola przed skasowaniem ──────────────────────────────────────
--
-- Odmowa zamiast kasowania w ciemno. Jesli drzewo jest puste albo ma mniej
-- wezlow niz stare tabele mialy wierszy, to znaczy, ze backfill sie nie wykonal
-- - a wtedy ten plik zabralby jedyna kopie tresci.
do $$
declare
  wezlow      integer;
  starych     integer;
begin
  select count(*) into wezlow
    from public.pages
   where kind = 'page' and deleted_at is null;

  select coalesce((select count(*) from public.custom_pages where deleted_at is null), 0)
       + coalesce((select count(*) from public.article_overrides), 0)
    into starych;

  if wezlow < 10 then
    raise exception
      'ODMOWA: public.pages ma tylko % zywych stron. Backfill sie nie wykonal - '
      'skasowanie starych tabel zabraloby jedyna kopie tresci.', wezlow;
  end if;

  if starych > wezlow then
    raise exception
      'ODMOWA: stare tabele maja % wierszy, a drzewo % zywych stron. '
      'Cos nie zostalo przeniesione.', starych, wezlow;
  end if;

  raise notice 'Kontrola OK: % zywych stron w drzewie, % wierszy w starych tabelach.',
    wezlow, starych;
end $$;

-- ── KROK 1: kasowanie ───────────────────────────────────────────────────────
--
-- Kolejnosc bez znaczenia - miedzy tymi tabelami nie ma kluczy obcych.
-- `cascade` NIE jest tu uzywane swiadomie: gdyby ktos w miedzyczasie dopial
-- do ktorejs widok albo klucz obcy, chcemy o tym uslyszec bledem, a nie
-- stracic tamten obiekt po cichu.

drop table if exists public.nav_items;
drop table if exists public.custom_pages;
drop table if exists public.article_overrides;

commit;

-- ============================================================================
--  KONTROLA PO URUCHOMIENIU
--  Oczekiwany wynik: trzy wiersze z ocena "usunieta" i jeden z liczba wezlow.
-- ============================================================================

select 'nav_items'          as tabela,
       case when to_regclass('public.nav_items')          is null then 'usunieta' else 'NADAL ISTNIEJE' end as ocena
union all
select 'custom_pages',
       case when to_regclass('public.custom_pages')       is null then 'usunieta' else 'NADAL ISTNIEJE' end
union all
select 'article_overrides',
       case when to_regclass('public.article_overrides')  is null then 'usunieta' else 'NADAL ISTNIEJE' end
union all
select 'pages (zywe strony)', (select count(*)::text from public.pages where kind = 'page' and deleted_at is null)
