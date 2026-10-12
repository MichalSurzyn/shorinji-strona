-- ============================================================================
-- 06-czwarty-poziom.sql — drzewo stron: CZTERY poziomy zamiast trzech (2026-10-12)
--
-- PO CO
-- -----
-- Właściciel: techniki (Ryūsui geri, Kote nuki, …) mają wisieć POD stopniem,
-- z adresem /program-nauczania/stopnie-i-wymagania/6-kyu/kote-nuki,
-- a docelowo ma ich być ~40 na stopień. Program nauczania → Stopnie → 6 Kyu
-- to już trzy poziomy, więc technika jest czwartym.
--
-- CO ZMIENIA (i nic więcej)
-- -------------------------
--   1. CHECK pages_depth_chk: depth 0..2 → 0..3,
--   2. trigger BEFORE pages_before_write: odrzuca dziecko rodzica o depth >= 3
--      (było >= 2) — ciało funkcji skopiowane 1:1 z 03-drzewo-stron.sql,
--   3. strona_na_naglowek: nagłówek nie powstaje na NAJGŁĘBSZYM poziomie
--      (depth >= 3, było >= 2) — ciało 1:1 z 05-zamiana-rodzaju.sql.
-- Trigger AFTER (przekierowania i przeliczanie potomków) zostaje bez zmian:
-- schodzi w dół o jeden poziom na raz i działa dla dowolnej wysokości drzewa.
-- Przeniesienie strony głębiej sam zapisuje 308 ze starego adresu na nowy.
--
-- URUCHOMIENIE: wkleić CAŁOŚĆ w Supabase → SQL Editor → Run (PostgREST nie
-- wykona DDL). Plik jest idempotentny: drugie uruchomienie daje ten sam stan.
-- Kontrola na końcu ma pokazać trzy wiersze „OK".
--
-- KOLEJNOŚĆ WDROŻENIA: kod z obsługą czwartego poziomu może wejść przed tym
-- plikiem albo po nim — w obu kolejnościach nic się nie psuje (baza bez tego
-- pliku po prostu odmówi zapisu na czwartym poziomie). Strony na czwarty
-- poziom przenosimy dopiero, gdy są OBA.
-- ============================================================================

-- 1. Wysokość drzewa
alter table public.pages drop constraint if exists pages_depth_chk;
alter table public.pages add constraint pages_depth_chk check (depth between 0 and 3);

-- 2. Trigger BEFORE (ciało z 03-drzewo-stron.sql)
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

    -- Cztery poziomy od 2026-10-12 (06-czwarty-poziom.sql): techniki pod stopniem,
    -- np. /program-nauczania/stopnie-i-wymagania/6-kyu/kote-nuki.
    if rodzic.depth >= 3 then
      raise exception 'Drzewo ma najwyżej cztery poziomy.';
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

-- 3. Zamiana strony w nagłówek (ciało z 05-zamiana-rodzaju.sql)
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
  -- Najgłębszy poziom (3 od 2026-10-12) nie ma pod sobą miejsca na podstrony,
  -- więc nagłówek nie miałby tam czego grupować.
  if v_depth >= 3       then raise exception 'ZAMIANA_GLEBOKOSC';  end if;

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


-- ── Kontrola: trzy wiersze „OK" ─────────────────────────────────────────────
select case
         when exists (select 1 from pg_constraint
                       where conname = 'pages_depth_chk'
                         and pg_get_constraintdef(oid) like '%depth >= 0%depth <= 3%')
         then 'OK   pages_depth_chk dopuszcza depth 0..3'
         else 'NIE OK   pages_depth_chk: ' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname = 'pages_depth_chk'), 'brak')
       end as kontrola
union all
select case
         when position('rodzic.depth >= 3' in pg_get_functiondef('public.pages_before_write()'::regprocedure)) > 0
         then 'OK   pages_before_write: limit czterech poziomow'
         else 'NIE OK   pages_before_write ma stary limit'
       end
union all
select case
         when position('v_depth >= 3' in pg_get_functiondef('public.strona_na_naglowek(uuid)'::regprocedure)) > 0
         then 'OK   strona_na_naglowek: limit czterech poziomow'
         else 'NIE OK   strona_na_naglowek ma stary limit'
       end;
