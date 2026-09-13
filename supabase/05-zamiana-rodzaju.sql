-- ============================================================================
-- 05-zamiana-rodzaju.sql — etap E: strona ↔ nagłówek
--
-- PO CO TO ISTNIEJE JAKO FUNKCJA W BAZIE, A NIE DWA ZAPYTANIA Z PANELU
-- --------------------------------------------------------------------
-- Zamiana STRONY w NAGŁÓWEK musi zrobić dwie rzeczy naraz:
--   1. zmienić rodzaj węzła (kind='header'), przez co jego adres przestaje
--      oddawać stronę — `getStrona` czyta wyłącznie `kind='page'`,
--   2. zapisać 308 z tego adresu na pierwszą podstronę.
--
-- PostgREST wysyła każde zapytanie w OSOBNEJ transakcji. Gdyby te dwie operacje
-- poszły z panelu jako dwa żądania i drugie padło (utracona sesja, timeout,
-- zamknięta karta), baza zostałaby w stanie, w którym zaindeksowany adres
-- rodzica po prostu NIE PROWADZI DONIKĄD — 404 dla wyszukiwarki i dla każdego,
-- kto ma ten link. Autor 03-drzewo-stron.sql nazwał tę operację jedyną w tym
-- modelu, która traci zaindeksowany adres bez śladu; ta funkcja jest odpowiedzią.
--
-- Wewnątrz funkcji obie operacje są w jednej transakcji, więc z zewnątrz nie da
-- się zobaczyć stanu przejściowego. Kierunek odwrotny (nagłówek → strona) to
-- JEDEN UPDATE i celowo NIE MA tu dla niego funkcji: robi go zwykły zapis
-- z panelu, a każda linia SQL-a mniej to jedna rzecz mniej do wklejenia
-- na produkcji.
--
-- WARIANT A (2026-09-09): NAGŁÓWEK ZATRZYMUJE SWÓJ ADRES.
--
-- Do trzeciej rundy checklisty zamiana przenosiła adres nagłówka na PIERWSZĄ
-- podstronę, a pozostałym urywała jeden segment. Właściciel: „imo powinno
-- zostać w takim przypadku `ucz` w adresie, czemu nie, czytelniej”.
--
-- Teraz nagłówek zachowuje `slug` i `full_path`, czyli działa jak folder,
-- a CTE `przodkowie_wzwyz` w 03-drzewo-stron.sql zatrzymuje się na nim, bo od
-- tej zmiany pyta „czy przodek MA ADRES”, a nie „czy przodek jest stroną”.
-- Skutek: przy zamianie ŻADNA podstrona nie zmienia adresu — ani pierwsza,
-- ani żadna dalsza — więc nie powstaje ani jedno przekierowanie dla podstron.
-- Zmienia się jedna rzecz: pod adresem nagłówka nie ma już strony, bo
-- `getStrona` czyta wyłącznie `kind='page'`. Ten jeden adres dostaje 308
-- na pierwszą podstronę i to jedyne przekierowanie, jakie tu powstaje.
--
-- KOLEJNOŚĆ JEST WARUNKIEM POPRAWNOŚCI: najpierw UPDATE rodzaju, POTEM zapis
-- 308. Odwrotnie nasz wiersz wszedłby, zanim kaskada triggerów skończy liczyć
-- adresy, i mogłaby go jeszcze przestawić albo skasować. Przy poprawnym
-- triggerze dzieci nie zmieniają adresów i to nie zajdzie — ale zabezpieczenie
-- kosztuje zero.
--
-- URUCHOMIENIE: wkleić w SQL Editorze (PostgREST nie wykona DDL).
-- Plik jest idempotentny — `create or replace` znosi drugie uruchomienie.
-- ============================================================================

create or replace function public.strona_na_naglowek(p_id uuid)
returns table (id_przejmujacego uuid, adres text)
language plpgsql
as $$
declare
  v_kind      text;
  v_source    text;
  v_sciezka   text;   -- adres, ktory naglowek ZATRZYMUJE, a ktory przestaje oddawac 200
  v_depth     int;
  v_ile       int;
  v_dziecko   uuid;
  v_cel       text;   -- adres pierwszej podstrony = cel przekierowania
begin
  -- `for update` serializuje dwie równoległe zamiany tego samego węzła.
  -- Bez tego oba wywołania przeczytałyby stan „jestem stroną" i drugie
  -- zapisałoby przekierowanie po nieaktualnym adresie.
  select kind, source, full_path, depth
    into v_kind, v_source, v_sciezka, v_depth
  from public.pages
  where pages.id = p_id and deleted_at is null
  for update;

  if not found then
    raise exception 'ZAMIANA_BRAK_WEZLA';
  end if;

  -- Sprawdzenia POWTÓRZONE po panelu, świadomie. Panel waliduje wcześniej
  -- i ma dla każdego przypadku komunikat po polsku; tu chodzi wyłącznie o to,
  -- żeby stan nie zmienił się między odczytem panelu a tym zapisem.
  if v_kind <> 'page'   then raise exception 'ZAMIANA_NIE_STRONA'; end if;
  if v_source = 'route' then raise exception 'ZAMIANA_ROUTE';      end if;
  if v_depth >= 2       then raise exception 'ZAMIANA_GLEBOKOSC';  end if;

  -- ODMOWA PRZY BRAKU PODSTRON ZOSTAJE (punkt D4 checklisty, przeklikany jako
  -- ok), ale w wariancie A ma INNE uzasadnienie niż wcześniej.
  --
  -- Wcześniej: nie ma komu oddać adresu. Teraz: adres w bazie zostaje, ale
  -- publicznie i tak przestaje oddawać 200 — a bez podstrony nie ma dokąd
  -- wystawić przekierowania, więc zaindeksowany adres stałby się twardym 404.
  -- Drugi powód, produktowy: nagłówek bez podstron wypada z menu (`buildNavTree`
  -- wyrzuca węzeł bez adresu i bez dzieci), czyli byłby wierszem, którego nie
  -- widzi nikt i nigdzie.
  select count(*) into v_ile
  from public.pages
  where parent_id = p_id and deleted_at is null
    and kind = 'page' and source = 'db';

  if v_ile = 0 then raise exception 'ZAMIANA_BRAK_DZIECKA'; end if;

  -- WIELE PODSTRON JEST DOZWOLONE (zmiana z 2026-09-08).
  -- Wcześniej stało tu 'ZAMIANA_WIELE_DZIECI': funkcja odmawiala, gdy adres
  -- mialaby przejac jedna z kilku podstron. W wariancie A pytanie „ktora
  -- przejmuje adres" w ogole nie powstaje - zadna nie przejmuje, bo naglowek
  -- adresu nie oddaje. Pierwsza podstrona jest juz tylko CELEM przekierowania.
  --
  -- Kolejnosc `position, id` musi byc ta sama, co w panelu i w buildNavTree -
  -- inaczej 308 celowalby w inna podstrone, niz zapowiedzial dialog.
  select pages.id, pages.full_path
    into v_dziecko, v_cel
  from public.pages
  where parent_id = p_id and deleted_at is null
    and kind = 'page' and source = 'db'
  order by "position", pages.id
  limit 1;

  -- 1. Zamiana rodzaju. `slug` i `full_path` ZOSTAJĄ — w tym cała różnica
  --    wariantu A. `in_menu` musi być prawdą, pilnuje tego
  --    pages_header_visible_chk.
  --
  --    `published` świadomie NIE jest tu wymuszane. Wcześniej stało tu
  --    `published = true` i przy ukrywaniu liczonym po gałęzi (punkt A6)
  --    zamiana ukrytej strony w nagłówek odkrywałaby po cichu całą gałąź pod
  --    nią. Zamiana rodzaju ma zmieniać rodzaj, nie widoczność.
  update public.pages
     set kind = 'header', in_menu = true
   where pages.id = p_id;

  -- 2. Dopiero teraz przekierowanie. Adres nagłówka istnieje dalej w bazie,
  --    ale publicznie nie oddaje już strony, więc kierujemy go na pierwszą
  --    podstronę.
  if v_sciezka is not null and v_cel is not null and v_sciezka <> v_cel then
    insert into public.redirects (old_path, new_path, status, source)
         values (v_sciezka, v_cel, 308, 'auto')
    on conflict (old_path) do update
       set new_path = excluded.new_path;

    -- Domknięcie łańcuchów, ta sama zasada co w punkcie (b) triggera
    -- pages_after_update: wpisy prowadzące na adres nagłówka mają odtąd
    -- prowadzić wprost na cel, żeby nie powstało 308 na 308.
    update public.redirects
       set new_path = v_cel
     where new_path = v_sciezka
       and old_path <> v_cel;
  end if;

  return query
    select pages.id, pages.full_path
    from public.pages
    where pages.id = v_dziecko;
end;
$$;

comment on function public.strona_na_naglowek(uuid) is
  'Etap E, wariant A (2026-09-09): zamienia stronę w nagłówek grupujący. '
  'Nagłówek ZACHOWUJE slug i full_path, więc żadna podstrona nie zmienia adresu. '
  'Adres nagłówka przestaje oddawać stronę i dostaje 308 na pierwszą żywą '
  'podstronę treściową (position, id). Zmiana rodzaju i zapis przekierowania '
  'w jednej transakcji: inaczej awaria w połowie zostawia zaindeksowany adres '
  'bez strony i bez przekierowania.';

-- ── Kontrola: czy funkcja istnieje i ma spodziewaną sygnaturę ───────────────
select
  case
    when exists (
      select 1
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
        and p.proname = 'strona_na_naglowek'
        and pg_get_function_identity_arguments(p.oid) = 'p_id uuid'
    )
    then 'OK   funkcja strona_na_naglowek(uuid) istnieje'
    else 'NIE OK   brak funkcji strona_na_naglowek(uuid)'
  end as kontrola;
