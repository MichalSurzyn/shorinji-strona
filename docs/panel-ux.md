Katalog główny projektu: `G:\Workspace\Kempo`. Wszystkie ścieżki poniżej podaję względem tego katalogu.

# Plan przebudowy panelu /admin

## Diagnoza

Panel został zbudowany jako cienka nakładka na bazę danych, a nie jako narzędzie pracy instruktora, i widać to na każdym ekranie: pierwsze, co redaktor napotyka na najczęściej odwiedzanej zakładce, to przycisk migracji treści do Supabase opisany słowami, których nie ma prawa rozumieć. Drugi, poważniejszy problem polega na tym, że panel nie ma ani jednej siatki bezpieczeństwa. Nie ma cofania, nie ma kosza, nie ma historii wersji, nie ma autozapisu, nie ma ostrzeżenia przy wyjściu z niezapisanymi zmianami, więc każda pomyłka jest trwała, a jedyną racjonalną strategią użytkownika, który boi się zepsuć stronę, jest nie klikać. Trzecia warstwa to milczenie panelu w sytuacjach awaryjnych: wygasła sesja zawiesza przycisk „Zapisywanie..." na zawsze, nieudany upload kończy się komunikatem „Wgrano 8 zdjęć", a błąd bazy trafia na ekran po angielsku, razem z instrukcją wklejenia pliku SQL. Czwarta to rozjazd między tym, co redaktor zmienia, a tym, co widzi odwiedzający: godziny zajęć są w dwóch miejscach, telefon w trzech, numer konta bankowego jest zwykłym akapitem, a zdjęcie okładkowe aktualności ląduje po cichu w publicznej galerii. Piąta to brak podglądu tego, co się właśnie napisało, przez co jedyną drogą do zobaczenia efektu jest opublikowanie zmiany na żywej stronie. Wszystko to składa się na jeden skutek: człowiek, który wchodzi do panelu raz na sześć tygodni, nie ma żadnego powodu ufać, że wyjdzie z niego bez szkody.

Skala nakładu w całym dokumencie: **S** to najwyżej dzień pracy, **M** to dwa do pięciu dni, **L** to tydzień i więcej albo zmiana schematu bazy.

---

## FALA 1. Usunięcie strachu i najczęstszych pomyłek

Kolejność wynika z jednej zasady: najpierw naprawiamy to, co powoduje trwałą utratę pracy albo trwałą nieufność, a dopiero potem to, co jest niewygodne. Fala 1 nie wymaga zmian w schemacie bazy poza jedną kolumną, więc da się ją wdrożyć bez migracji danych.

### 1.1 Usunięcie operacji wdrożeniowych z widoku redaktora
**Pliki:** `components/admin/MigrateButton.tsx`, `app/admin/(panel)/strony/page.tsx:25`
**Na czym polega:** Kartę migracji usuwamy z panelu. Operację przenosimy do skryptu w `scripts/` uruchamianego przy wdrożeniu albo pod niepodlinkowany adres `/admin/serwis` chroniony zmienną środowiskową.
**Dlaczego:** Audyt, waga krytyczna. Jednorazowa czynność techniczna stoi na stałe na najczęściej odwiedzanym ekranie i mówi do instruktora o Supabase, fallbacku i źródle treści. Krytyk dopisuje do tego zasadę C1: operacje serwisowe nie mieszkają w widoku redaktora.
**Nakład:** S

### 1.2 Żaden zapis nie może zawiesić przycisku
**Pliki:** `components/admin/PageBlocksEditor.tsx:36`, `components/admin/ArticleEditor.tsx:68`, `components/admin/CustomPageEditor.tsx:58`, `app/admin/(panel)/edit/[topic]/[slug]/EditorForm.tsx:35`
**Na czym polega:** Każde `handleSave` dostaje `try/catch/finally` z `finally { setSaving(false) }`. W `catch` pokazujemy zdanie: „Nie udało się zapisać, prawdopodobnie wygasło logowanie. Twój tekst jest nadal w tym oknie. Otwórz panel w nowej karcie, zaloguj się i kliknij Zapisz jeszcze raz." Znikają też wszystkie `disabled={saving}` blokujące przycisk na stałe, zostaje sam wskaźnik pracy.
**Dlaczego:** Audyt, waga krytyczna, plus zasada „nigdy nie wyłączaj przycisku Zapisz" i „powiedz, co stało się z wpisanym tekstem". To jest scenariusz, po którym redaktor przestaje ufać panelowi.
**Nakład:** S

### 1.3 Jedno miejsce, w którym błąd zamienia się w polskie zdanie
**Pliki:** nowy `lib/adminErrors.ts`, wywoływany z `actions/pageActions.ts`, `actions/newsActions.ts`, `actions/customPageActions.ts`, `actions/navActions.ts`, `actions/scheduleActions.ts`, `actions/userActions.ts`, `app/admin/(panel)/wiadomosci/page.tsx:21`, `components/admin/AdminsManager.tsx:86`
**Na czym polega:** Powstaje mapa kodów na zdania po polsku, budowane zawsze w trzech częściach: co się nie udało, dlaczego (tylko jeśli to zmienia działanie użytkownika) i co zrobić teraz. Kod 23505 dostaje własne zdanie z nazwą pola, brak sieci własne, wygasła sesja własne. Nieznany błąd trafia do logu serwera, a na ekran idzie zdanie neutralne z numerem zgłoszenia. Znika instrukcja o wklejaniu `supabase/setup.sql`.
**Dlaczego:** Audyt wskazuje to w pięciu miejscach niezależnie. Zasada zakazuje kodów, nazw tabel i angielskiego w komunikatach.
**Nakład:** S

### 1.4 Ochrona przed utratą niezapisanych zmian
**Pliki:** nowy `lib/useUnsavedChanges.ts`, podpięty w czterech edytorach oraz w `components/admin/ScheduleEditor.tsx`, `NavEditor.tsx`, `FooterEditor.tsx`, dodatkowo `components/admin/AdminShell.tsx:62-76` i `:94-99`
**Na czym polega:** Hook porównuje bieżący stan z wczytanym. Przy zmianie ustawia `beforeunload` oraz przechwytuje kliknięcia w `<Link>` menu bocznego i `popstate`, bo sam `beforeunload` w App Routerze nie zadziała przy nawigacji wewnątrz panelu. Dialog: „Wyjść bez zapisania? Masz niezapisane zmiany w Cenniku. Jeśli wyjdziesz, przepadną." z przyciskami „Wróć do edycji" i „Wyjdź i odrzuć zmiany". Do tego kopia robocza w `localStorage` co pięć sekund i pasek przy powrocie: „W przeglądarce jest nowsza, niezapisana wersja z 3 marca, 18:41. [Przywróć ją] [Zignoruj]". Przycisk „Wyloguj" dostaje potwierdzenie.
**Dlaczego:** Audyt, waga krytyczna, potwierdzone gremem po całym repozytorium. Ostrzeżenie pokazujemy wyłącznie wtedy, gdy coś się faktycznie zmieniło, bo fałszywe alarmy uczą odruchowego klikania „Wyjdź".
**Nakład:** M

### 1.5 Cofnij zamiast kasowania bez śladu
**Pliki:** `components/admin/BlockEditor.tsx:217` i `:385`, `components/admin/ScheduleEditor.tsx:166`, `components/admin/NavEditor.tsx:173`, `components/admin/MessagesManager.tsx:32`
**Na czym polega:** Każde usunięcie w obrębie edytora wykonuje się natychmiast i pokazuje pasek: „Usunięto blok Zdjęcie. [Cofnij]". Pasek nie znika sam, zamyka go krzyżyk albo następna akcja, ma `role="status"` i jest osiągalny klawiaturą. Pod spodem trzymamy ostatnie dziesięć stanów `value` w `useRef`, a w górnym pasku edytora stają widoczne przyciski „Cofnij" i „Ponów" z etykietą tekstową. Krzyżyk usuwający zdjęcie z galerii przestaje być ukryty pod hoverem, filtrowanie idzie po indeksie zamiast po wartości, a `key` dostaje sufiks indeksu.
**Dlaczego:** Audyt, waga krytyczna. Zasada mówi wprost, że domyślną siatką bezpieczeństwa jest cofnięcie, a potwierdzenie modalne zostaje tylko dla operacji nieodwracalnych. Modal przy każdym usunięciu podnosi liczbę przypadkowych skasowań, a nie obniża.
**Nakład:** M

### 1.6 Logowanie i wygasła sesja
**Pliki:** `app/admin/login/page.tsx:35-39` i `:58-99`, `app/admin/(panel)/layout.tsx:16-17`
**Na czym polega:** Błędy logowania rozdzielamy po `error.status`. Złe dane zostają przy obecnym zdaniu, brak sieci dostaje własne („Nie udało się połączyć ze stroną. Sprawdź internet i spróbuj za chwilę, hasło jest w porządku."), limit prób własne. Pod formularzem staje odsyłacz „Nie pamiętam hasła" oparty na `supabase.auth.resetPasswordForEmail` plus prosty ekran ustawienia nowego hasła. Wygaśnięcie sesji przekierowuje z parametrami `?powod=wygaslo&wroc=...`, a po zalogowaniu wracamy na zapamiętany adres.
**Dlaczego:** Audyt, dwie pozycje krytyczne. Redaktor edytujący raz na sześć tygodni zapomni hasła, to jest pewne, a dziś nie ma żadnej drogi powrotnej poza telefonem do programisty.
**Nakład:** M

### 1.7 Menu panelu i pulpit przepisane na zadania
**Pliki:** `components/admin/AdminShell.tsx:9-18`, `app/admin/(panel)/page.tsx`, `app/admin/(panel)/strony/page.tsx:19-22, 29, 76, 101`
**Na czym polega:** Menu boczne skracamy do siedmiu pozycji nazwanych rzeczami widocznymi na stronie: Pulpit, Aktualności, Strony, Grafik zajęć, Galeria, Wiadomości, Ustawienia. Administratorzy, Nawigacja i Stopka wchodzą do Ustawień. Pulpit przestaje być zestawem liczników, a staje się listą zadań: cztery kafle („Dodaj aktualność", „Zmień godziny zajęć", „Wgraj zdjęcia", „Zmień cennik"), każdy z podpisem „ostatnia zmiana: 12 marca", pod nimi „Ostatnie zmiany" i wyróżniony kafel „Nowe wiadomości: 3". Przy pozycji Wiadomości w menu pojawia się liczba nieprzeczytanych. Sekcje na ekranie Strony dostają nazwy zadaniowe zamiast „Strony serwisu" i „Własne podstrony", a zamiast surowego adresu URL każda pozycja pokazuje, gdzie mieszka na stronie („Menu: Zajęcia → Cennik") i datę ostatniej zmiany. Ikony-znaki typograficzne zastępujemy zestawem SVG albo usuwamy, dodając `aria-hidden`.
**Dlaczego:** Audyt (pięć pozycji) plus zasady o płaskim menu, o pulpicie jako liście zadań i o nazywaniu rzeczy na stronie zamiast encji w bazie. Kafel „Nowe wiadomości" rozwiązuje przy okazji problem A8 krytyka: dziś nikt nie wie, że przyszło zapytanie od rodzica.
**Nakład:** M

### 1.8 Wdrożenie słownika w całym panelu
**Pliki:** wszystkie komponenty w `components/admin/`, `lib/editablePages.ts`, `app/admin/(panel)/**`
**Na czym polega:** Przechodzimy panel pole po polu i podmieniamy etykiety zgodnie z tabelą w sekcji „Słownik". Każde pole dostaje etykietę nad polem powiązaną przez `<label for>`, osobną podpowiedź między etykietą a polem, a placeholder wyłącznie na przykład formatu. Powstaje plik `lib/glossary.ts` z jedną nazwą na jedno pojęcie, używany też w komunikatach.
**Dlaczego:** Audyt wskazuje „Adres (slug)", „Tytuł (H1)", „edytor blokowy", „checkbox", „wersja bazowa", „treści bazowe". Zasada: jedna nazwa na jedno pojęcie, prowadzona jak kod.
**Nakład:** M

### 1.9 Zdjęcia przestają milczeć i przestają trafiać w losowy folder
**Pliki:** `components/admin/ImagesManager.tsx:50, 56, 84, 140, 155, 188`, `components/admin/ImagePicker.tsx:86, 100, 196`
**Na czym polega:** Sprawdzamy `res.ok` i odpowiedź każdego uploadu, a podsumowanie mówi prawdę: „Wgrano 6 z 8 zdjęć. Nie udało się: IMG_2231.HEIC, IMG_2240.jpg." Komunikat rozdzielamy na zielony i czerwony z ikoną, liczebnik odmieniamy. Znika sztywny fallback `"Galeria/Pokazy"`, a nad przyciskiem wgrywania stoi widoczny tekst „Zdjęcia trafią do: ...". Gdy folder nie jest znany, panel pyta o niego zamiast wybierać po cichu. Przycisk usuwania przestaje być ukryty pod hoverem i przenosi się pod miniaturę jako podpisany przycisk. Na zakładce „Wszystkie" przycisk wgrywania przestaje być wyszarzony, po kliknięciu pokazuje widoczny komunikat i podświetla pasek folderów.
**Dlaczego:** Audyt, cztery pozycje krytyczne i trzy ważne. Zdjęcie okładkowe aktualności lądujące publicznie w galerii to dokładnie „coś się samo zrobiło, chyba zepsułem".
**Nakład:** M

### 1.10 Menu strony przestaje być operacją bez odwrotu
**Pliki:** `actions/navActions.ts:18, 38`, `components/admin/NavEditor.tsx:9, 98, 173, 214`, `lib/navigation.ts:60`
**Na czym polega:** Zapis menu przenosimy do funkcji RPC wykonującej kasowanie i wstawianie w jednej transakcji, a minimalnie: przed kasowaniem zapisujemy kopię poprzedniego drzewa i odtwarzamy ją przy błędzie z komunikatem „Zapis się nie udał, przywróciliśmy poprzednie menu". Walidacja blokuje puste menu i duplikaty adresów. Pole adresu zamieniamy na listę istniejących podstron z furtką „inny adres". Przy każdej pozycji staje przełącznik „Widoczna w menu", bo ukrycie jest bezpieczniejsze od usunięcia i dziś w ogóle nie ma go w interfejsie, mimo że pole `visible` istnieje w bazie.
**Dlaczego:** Audyt, cztery pozycje krytyczne. Najbardziej ryzykowny edytor w panelu jest jedynym bez jakiejkolwiek siatki bezpieczeństwa, a przy pustym zapisie panel twierdzi co innego, niż pokazuje strona.
**Nakład:** M

### 1.11 Grafik zajęć przestaje uciekać spod kursora
**Pliki:** `components/admin/ScheduleEditor.tsx:32, 77, 166, 190`, `actions/scheduleActions.ts:18`, `lib/schedule.ts:13`, `lib/editablePages.ts:196-208`
**Na czym polega:** Sortowanie wykonujemy przy wczytaniu i po zapisie, nigdy podczas edycji. Nowy termin ląduje na końcu listy, zostaje przewinięty do widoku i podświetlony. Walidacja sprawdza, czy koniec jest po początku, wykrywa duplikaty i wskazuje wiersz: „Termin nr 4 (czwartek, 18:00) nie ma wpisanego miejsca". Formaty przyjmujemy wybaczająco, czyli „18.00", „18" i „18:00" dają ten sam wynik. Przycisk „Przywróć wersję bazową" odsuwamy wizualnie od zapisu, przenosimy na dół w sekcję „Operacje awaryjne" i przemianowujemy na „Przywróć ustawienia startowe", a potwierdzenie wypisuje konkretnie, jakie godziny wrócą. Nad edytorem dopisujemy, gdzie te dane trafiają, wymieniając wszystkie trzy miejsca: podstrony Zajęcia, plik kalendarza .ics i wizytówkę Google.
**Dlaczego:** Audyt (sześć pozycji) plus punkt D4 krytyka. Podpowiedź w panelu wymienia dziś dwa z trzech miejsc docelowych.
**Nakład:** M

### 1.12 Godziny zajęć w jednym miejscu
**Pliki:** `lib/editablePages.ts:196-208`, `app/kontakt/page.tsx:21, 28`, `components/NewsBlocks.tsx`
**Na czym polega:** Ze strony Kontakt wycinamy godziny opisane słownie i wstawiamy w tym miejscu blok czytający grafik z bazy. Jeśli decyzja padnie na wariant tańszy, w edytorze Grafiku staje ostrzeżenie z linkiem: „Godziny są też opisane słownie na podstronie Kontakt, sprawdź ją tutaj".
**Dlaczego:** Audyt, waga krytyczna. To jest jedno z czterech zadań wymienionych jako typowe, a redaktor nie ma szans domyślić się, że musi poprawić drugie miejsce. Krytyk rozszerza to na zasadę C6: jeden fakt ma być edytowalny w jednym miejscu.
**Nakład:** S w wariancie z ostrzeżeniem, M w wariancie docelowym

### 1.13 Hasła w zakładce Administratorzy
**Pliki:** `components/admin/AdminsManager.tsx:141, 158`, `actions/userActions.ts:47, 59, 68`
**Na czym polega:** Formularz zmiany hasła dostaje drugie pole „Powtórz nowe hasło" z porównaniem po stronie klienta i przycisk „Pokaż hasło". Pole hasła nowego konta zmienia `type="text"` na `type="password"` z tym samym przyciskiem podglądu i przyciskiem „Generuj bezpieczne hasło". Po zmianie hasła pokazujemy zdanie o zapisaniu go w bezpiecznym miejscu, po utworzeniu konta zdanie o przekazaniu hasła nowej osobie. Komunikaty Supabase Auth tłumaczymy przez `lib/adminErrors.ts` z punktu 1.3.
**Dlaczego:** Audyt, waga krytyczna. Literówka w jednym zamaskowanym polu bez powtórzenia oznacza trwałą utratę dostępu, a reset hasła (punkt 1.6) dopiero powstaje.
**Nakład:** S

### 1.14 Fundament dostępności
**Pliki:** `app/admin/(panel)/layout.tsx`, `components/admin/AdminShell.tsx:112-139`, globalne style panelu, wszystkie komponenty z `text-xs` i `px-3 py-1.5`
**Na czym polega:** Bazowy rozmiar tekstu w panelu ustawiamy na 18 px w `rem`, interlinia 1.5. Wszystkie cele kliknięcia dochodzą do 44 na 44 piksele z odstępem minimum 8 pikseli. Znika `outline:none`, wchodzi widoczny focus o grubości 2 pikseli. Komunikaty zapisu dostają `role="status"` i `aria-live="polite"`, banery po publikacji `role="alert"`. Status treści opisujemy słowem, nie samą kropką koloru. Panel ma działać bez poziomego przewijania przy 320 pikselach, a listy na wąskich ekranach zamieniają się w karty. W pasku mobilnym pokazujemy nazwę bieżącej sekcji, szuflada dostaje widoczny przycisk „Zamknij" i obsługę klawisza Escape.
**Dlaczego:** Punkt B5 krytyka, w audycie nietknięty poza dwiema uwagami o hoverze. Panel jest dziś napisany na 12–14 pikselach i celach o wysokości 28–32 pikseli, czyli dokładnie odwrotnie, niż wymaga starszy użytkownik.
**Nakład:** M

---

## FALA 2. Realna praca: podgląd, wersja robocza, media

Fala 2 wymaga zmian w schemacie bazy i nowych tras serwerowych, dlatego idzie po fali 1. Nie ma sensu budować historii wersji, dopóki zwykły zapis potrafi zawiesić przycisk.

### 2.1 Wersja robocza rozdzielona od opublikowanej
**Pliki:** `supabase/setup.sql` (migracja), `actions/pageActions.ts`, `actions/newsActions.ts`, `actions/customPageActions.ts`, `components/admin/PageBlocksEditor.tsx:16`, `ArticleEditor.tsx:212`, `CustomPageEditor.tsx:187`
**Na czym polega:** Każdy typ treści dostaje wersję roboczą trzymaną osobno od opublikowanej (kolumna `draft_content` albo osobna tabela wersji). Strony serwisu, które dziś w ogóle nie mają szkicu, dostają go razem z resztą. W edytorze stają dwa przyciski o różnej wadze wizualnej: „Zapisz szkic" i „Opublikuj zmiany na stronie". Stan treści opisujemy słowem obok tytułu: „Szkic, widzisz tylko ty", „Opublikowane", „Opublikowane, masz niezapisane zmiany".
**Dlaczego:** Zasada krytyczna z dwóch dokumentów researchu plus audyt. Dziś każdy zapis cennika idzie prosto na produkcję, więc redaktor nie może rozłożyć pracy na dwa wieczory.
**Nakład:** L

### 2.2 Autozapis i widoczny stan zapisu
**Pliki:** cztery edytory, hook z punktu 1.4
**Na czym polega:** Autozapis co około trzydzieści sekund oraz przy utracie fokusu, wyłącznie do wersji roboczej. Obok przycisku publikacji stały wskaźnik słowny: „Niezapisane zmiany", „Zapisuję...", „Zapisano o 14:32". Stan błędu nie czyści formularza i daje przycisk „Spróbuj ponownie". Tekst zapisujemy z opóźnieniem dwóch, trzech sekund po zaprzestaniu pisania, przełączniki natychmiast.
**Dlaczego:** Zasada krytyczna. Autozapis, który po cichu publikuje, produkuje dokładnie ten strach, który mamy usunąć, dlatego punkt 2.2 ma sens dopiero po 2.1.
**Nakład:** M

### 2.3 Podgląd wersji roboczej na prawdziwej stronie
**Pliki:** nowa trasa `app/api/draft/route.ts`, `lib/news.ts:47`, `lib/customPages.ts:43`, przyciski „Podgląd" w czterech edytorach
**Na czym polega:** Wchodzi Draft Mode Next.js. Przycisk „Zobacz, jak to będzie wyglądać" otwiera `/api/draft?secret=...&slug=...` i przenosi na prawdziwy front z paskiem „Podgląd szkicu, to widzisz tylko ty. [Wróć do edycji] [Opublikuj]". Znika dzisiejszy scenariusz, w którym podgląd szkicu kończy się stroną 404.
**Dlaczego:** Punkt B3 krytyka, w `app/api` jest dziś wyłącznie trasa `.ics`. Zasada zabrania budowania własnego, „prawie takiego samego" renderera, bo rozjazd z produkcją niszczy zaufanie do podglądu na stałe.
**Nakład:** M

### 2.4 Podgląd obok formularza
**Pliki:** `components/admin/BlockEditor.tsx`, `components/NewsBlocks.tsx`, układ czterech edytorów
**Na czym polega:** Edytor przechodzi na dwie kolumny: formularz po lewej, żywy podgląd po prawej, renderowany tym samym komponentem `NewsBlocks` co strona publiczna, na tym samym ciemnym tle. Podgląd dostaje przełączniki telefon, tablet, komputer z domyślnym telefonem. Na wąskim ekranie zamiast dwóch kolumn wchodzi przełącznik „Edycja / Podgląd". Podgląd jest do patrzenia, pisanie zostaje w formularzu.
**Dlaczego:** Zasada krytyczna o modelu edycji plus audyt. Dziś jedyna droga do zobaczenia, czy pogrubienie zadziałało, prowadzi przez opublikowanie zmiany.
**Nakład:** L

### 2.5 Kosz zamiast kasowania
**Pliki:** `supabase/setup.sql` (kolumna `deleted_at` w `articles`, `custom_pages`, `site_settings`, `nav_items`, `contact_messages`), wszystkie zapytania publiczne w `lib/`, nowa sekcja „Kosz" w Ustawieniach
**Na czym polega:** Każde usunięcie treści zapisuje datę zamiast kasować wiersz, zapytania publiczne filtrują `deleted_at IS NULL`. Przycisk nazywa się „Przenieś do kosza". Kosz trzyma pozycje 30 dni, przy każdej stoi „Przywróć". Trwałe kasowanie mieszka wyłącznie w koszu i tylko tam ma mocne potwierdzenie nazywające obiekt po tytule.
**Dlaczego:** Punkt B2 krytyka. Żadna tabela nie ma dziś `deleted_at`, więc kosz to migracja pięciu tabel plus zmiana zapytań, a nie poprawka interfejsu. Odwracalność jest jedynym mechanizmem, który realnie leczy strach przed kliknięciem.
**Nakład:** L

### 2.6 Historia wersji z przywracaniem
**Pliki:** nowa tabela `content_versions`, wyzwalacz albo zapis w akcjach, nowy ekran w edytorze
**Na czym polega:** Przy każdej publikacji odkładamy wersję z autorem i czasem. W edytorze staje lista: „8 sierpnia 2026, 14:32, Jan Kowalski" z podglądem treści i przyciskiem „Przywróć tę wersję". Przywrócenie tworzy nową wersję roboczą, niczego nie kasuje i niczego samo nie publikuje. Trzymamy 10 do 20 ostatnich wersji. To zastępuje wszystkie dzisiejsze przyciski „Przywróć treść bazową", które wracają do treści z kodu, czyli do wersji nikogo i z nieokreślonego momentu.
**Dlaczego:** Zasada krytyczna w dwóch dokumentach, punkt B1 i C2 krytyka. Wymaga też dodania autora, bo dziś `articles` nie ma ani `created_by`, ani `updated_by`, więc „Ostatnie zmiany: kto, co, kiedy" z pulpitu jest dziś niewykonalne.
**Nakład:** L

### 2.7 Własna trasa uploadu zdjęć
**Pliki:** nowa trasa `app/api/upload/route.ts`, `components/admin/ImagePicker.tsx`, `components/admin/ImagesManager.tsx`, `actions/imageActions.ts`
**Na czym polega:** Upload przestaje lecieć prosto z przeglądarki do Cloudinary. Serwer skaluje do 2560 pikseli na dłuższej krawędzi, wypala obrót z EXIF w pikselach, usuwa metadane razem z GPS, konwertuje HEIC do JPEG i generuje warianty. Interfejs pokazuje listę plików z miniaturą i osobnym paskiem postępu, licznik „Wgrano 12 z 40" i przycisk „Ponów" przy pojedynczej pozycji, która padła. Atrybut `accept` zostaje bez `image/heic`, bo w Safari 17 powoduje odwrotną konwersję, a HEIC obsługujemy po stronie serwera.
**Dlaczego:** Punkt A16 krytyka. To nie jest poprawka mikrotreści, tylko nowy moduł, i trzeba to nazwać przed wyceną. Usunięcie GPS ze zdjęć dzieci ma przy okazji ciężar prawny.
**Nakład:** L

### 2.8 Opisy zdjęć dla osób niewidomych
**Pliki:** `lib/newsTypes.ts:17, 23, 46, 58`, `components/NewsBlocks.tsx:141, 168, 294`, `app/aktualnosci/page.tsx:60`, `app/aktualnosci/[slug]/page.tsx:63`, `components/admin/BlockEditor.tsx`
**Na czym polega:** Typy bloków dostają pole opisu. W panelu stoi ono bezpośrednio pod miniaturą, z etykietą „Opis zdjęcia dla osób niewidomych i wyszukiwarek" i przykładem w placeholderze. Obok przełącznik „To zdjęcie jest tylko ozdobne", zapisujący pusty atrybut. Opis zapisujemy domyślnie na poziomie pliku w bibliotece, ale pozwalamy nadpisać w miejscu użycia. Przy publikacji pokazujemy listę „Na tej stronie 3 zdjęcia nie mają opisu" z linkami i przyciskami „Uzupełnij teraz" oraz „Opublikuj mimo to".
**Dlaczego:** Punkt A15 krytyka. Dziś każdy obraz treściowy renderuje `alt=""`, a pola po prostu nie ma w typach. Research poświęca temu pięć zasad, audyt nie zauważył, że mechanizmu brak.
**Nakład:** M

### 2.9 Pliki do pobrania
**Pliki:** `components/admin/BlockEditor.tsx:437`, `components/admin/FooterEditor.tsx:140`, nowa sekcja „Dokumenty do pobrania”, trasa uploadu z punktu 2.7
**Na czym polega:** Powstaje magazyn plików innych niż obrazki (Cloudinary `resource_type: raw` albo Supabase Storage) i osobna sekcja z polami: tytuł widoczny na stronie, plik, krótki opis. Tekst linku generujemy sami w formacie „Deklaracja członkowska (PDF, 240 KB, 2 strony)". Dochodzi funkcja „Podmień plik" zachowująca adres i wszystkie miejsca użycia, bo to jest właściwa droga dla corocznej wymiany deklaracji. Z interfejsu znika instrukcja o wgrywaniu do `public/downloads`.
**Dlaczego:** Audyt (dwie pozycje ważne) plus punkt A20 krytyka. Dziś redaktor może wpisać nazwę dokumentu, ale nie ma jak dostarczyć pliku, więc link ze stopki prowadzi do 404.
**Nakład:** M

### 2.10 Cennik i numer konta jako dane, nie jako akapit
**Pliki:** `lib/editablePages.ts:46-134`, `components/admin/BlockEditor.tsx:75, 630-648`, nowy edytor cennika
**Na czym polega:** Cztery tabele cennika zamieniamy na listę rekordów z polami: nazwa pozycji, cena, okres, obowiązuje od. Front decyduje o formie (tabela na komputerze, karty na telefonie). Numer konta, nazwa stowarzyszenia i adres wychodzą z bloku `callout` do osobnych pól strukturalnych, z walidacją sumy kontrolnej IBAN i podglądem sformatowanego numeru. Przed publikacją pokazujemy ekran „Sprawdź zmiany" z listą wyłącznie zmienionych pozycji w formacie „Składka miesięczna: 180 zł → 200 zł", przy każdej link „Zmień" wracający po zapisie na ten sam ekran.
**Dlaczego:** Punkty A4 i A5 krytyka. IBAN jest najdroższym w skutkach ciągiem znaków na całej stronie i jest dziś edytowany jak zwykły akapit, razem ze znacznikami wyróżnienia `==`. Do tego zasada zabraniająca pola tekstowego dla danych strukturalnych.
**Nakład:** L

### 2.11 Dane kontaktowe w jednym miejscu
**Pliki:** `lib/site.ts`, `lib/footerTypes.ts`, `components/StructuredData.tsx`, `app/kontakt/page.tsx`, `components/admin/FooterEditor.tsx:179`
**Na czym polega:** Telefon, e-mail, adres sali i linki społecznościowe mieszkają w jednym rekordzie w bazie, z którego czytają: stopka, strona Kontakt, dane dla Google i mapa. Zostaje jedno pole telefonu, wersję do dzwonienia generujemy sami. Pola społecznościowe dostają pełne nazwy i notkę „Puste pole oznacza, że ikona nie pojawi się w stopce".
**Dlaczego:** Punkt A6 krytyka. Dziś numer żyje w trzech kopiach, a adresu sali nie da się zmienić z panelu w ogóle. Przy dwóch polach na ten sam telefon redaktor niemal na pewno poprawi tylko jedno.
**Nakład:** M

### 2.12 Wiadomości z formularza kontaktowego
**Pliki:** `actions/contactActions.ts`, `components/admin/MessagesManager.tsx:21, 32`, `components/ContactForm.tsx`
**Na czym polega:** Wchodzi powiadomienie mailowe do klubu przy nowym zgłoszeniu, bo panel jest dziś jedynym egzemplarzem korespondencji, a redaktor loguje się raz na kilka tygodni. Usuwanie zamieniamy na archiwum z możliwością przywrócenia. Obsługujemy gałąź błędu w `toggleRead` i `remove`, która dziś nie robi nic. Dochodzi wyszukiwarka i filtr „nieprzeczytane". Formularz publiczny dostaje zgodę i link do polityki prywatności, a wysyłkę ograniczamy licznikiem zgłoszeń z jednego adresu.
**Dlaczego:** Punkty A8 i A9 krytyka. Brak polityki prywatności przy zbieraniu danych osobowych, często dotyczących dziecka, to realna ekspozycja stowarzyszenia, a nie kwestia wygody.
**Nakład:** M

### 2.13 Odwołane zajęcia i wyjątki w grafiku
**Pliki:** `data/schedule.ts`, `lib/schedule.ts`, `app/api/schedule/[group]/calendar.ics/route.ts`, nowy pasek komunikatu na stronie
**Na czym polega:** Grafik dostaje wyjątki z datą i statusem „odwołane" oraz krótką notatką. Odwołany termin znika ze strony zajęć, trafia do paska komunikatu na stronie głównej i generuje `EXDATE` w pliku kalendarza. Dodatkowo pojedynczy komunikat na górze strony z datą wygaśnięcia, ustawiany jednym polem.
**Dlaczego:** Punkt A1 krytyka. To jest najczęstsza pilna zmiana w klubie, a dziś jedyna droga prowadzi przez napisanie pełnej aktualności z blokami. Kto zasubskrybował kalendarz, dostanie w telefonie trening, który się nie odbędzie.
**Nakład:** M

---

## FALA 3. Dopracowanie

### 3.1 Paleta bloków
**Pliki:** `components/admin/BlockEditor.tsx:42, 60-61, 243`
**Na czym polega:** Czternaście typów dzielimy na trzy sekcje (Tekst, Media, Dodatki) z rozwiniętą domyślnie sekcją Tekst, znaki Unicode zastępujemy ikonami SVG, każdy typ dostaje jedno zdanie „co to robi". Blok „Tabela opłat" przemianowujemy na „Tabela" i dopuszczamy od dwóch do czterech kolumn, a podpowiedzi w polach przestają mówić o złotówkach.
**Nakład:** M

### 3.2 Wstawianie i przestawianie
**Pliki:** `components/admin/BlockEditor.tsx:118, 649, 714, 568`
**Na czym polega:** Między blokami staje cienki, zawsze widoczny pasek „Wstaw tutaj". Po kliknięciu strzałki widok przewija się za blokiem. Wiersze tabeli, pozycje w blokach „Linki" i „Fakty" dostają strzałki w górę i w dół oraz „Wstaw poniżej". Przeciąganie może istnieć dodatkowo, nigdy jako jedyna droga.
**Nakład:** M

### 3.3 Edytor nie może zapisać czegoś, czego strona nie pokaże
**Pliki:** `components/NewsBlocks.tsx:11, 257`, `components/admin/BlockEditor.tsx:317, 406`
**Na czym polega:** Zagnieżdżone znaczniki albo obsługujemy parserem, albo blokujemy łączenie przycisków z podpowiedzią. Adres filmu walidujemy na bieżąco, pokazując miniaturę przy rozpoznaniu i konkretną wskazówkę przy braku. Blok zdjęcia bez wybranego pliku dostaje żółtą ramkę i napis „Niedokończony, nie pojawi się na stronie", a przed zapisem wypisujemy listę takich bloków.
**Dlaczego:** Punkt C5 krytyka. Dziś nierozpoznany adres YouTube znika bez śladu, a redaktor dostaje zielony komunikat o sukcesie.
**Nakład:** M

### 3.4 Wstawianie linków
**Pliki:** `components/admin/BlockEditor.tsx:785`
**Na czym polega:** Zamiast wstawiania składni `[tekst](/adres)` otwiera się okno z dwoma trybami: „Podstrona na naszej stronie" z listą gotowych adresów i „Adres zewnętrzny" z automatycznym `https://`. Przed zapisem ostrzegamy o niedokończonym linku prowadzącym pod `/adres`.
**Nakład:** S

### 3.5 Adresy stron i przekierowania
**Pliki:** `components/admin/ArticleEditor.tsx:189`, `actions/customPageActions.ts:28, 119`, nowa tabela przekierowań
**Na czym polega:** Myślniki przycinamy dopiero przy zapisie, żeby dało się w ogóle wpisać adres z myślnikiem. Pole chowamy pod „Ustawienia zaawansowane" i pokazujemy jako sklejony adres z nieedytowalnym prefiksem. Przy zmianie adresu istniejącej strony ostrzegamy o skutkach i domyślnie zostawiamy przekierowanie ze starego adresu. Pozycja w menu zachowuje swoje miejsce zamiast lądować na końcu.
**Nakład:** M

### 3.6 To, co widzi Google
**Pliki:** `app/sitemap.ts`, metadane stron statycznych, nowe pola w edytorach
**Na czym polega:** `sitemap.ts` dostaje `revalidate`, żeby nowa aktualność trafiała tam bez wdrożenia. Tytuł i opis w wynikach wyszukiwania stają się polami w panelu, w zwiniętej sekcji „Jak ta strona wygląda w Google", domyślnie wypełnianymi z tytułu i pierwszych zdań, z podglądem wyniku zamiast definicji. Pole `canonical` nie pojawia się w panelu.
**Dlaczego:** Punkt A14 krytyka. To, co redaktor zmienia, nie jest dziś tym, co pokazuje wyszukiwarka.
**Nakład:** M

### 3.7 Typografia polska
**Pliki:** normalizator wywoływany przy zapisie treści
**Na czym polega:** Przy zapisie zamieniamy proste cudzysłowy na drukarskie, dywizy w zakresach na półpauzy i wstawiamy spacje nierozdzielające po spójnikach jednoliterowych.
**Dlaczego:** Punkt D6 krytyka. Treść bazowa używa poprawnej typografii, edytor produkuje surową, więc po kilku edycjach strona wygląda niechlujnie.
**Nakład:** S

### 3.8 Role, właściciel i przekazanie dostępu
**Pliki:** `actions/userActions.ts`, `supabase/setup.sql` (polityki RLS)
**Na czym polega:** Wchodzą dwie role. Redaktor edytuje treść, ale nie rusza struktury menu, adresów stron ani kont. Właściciel ma pełne uprawnienia i nie może zostać usunięty przez nikogo innego. Powstają brakujące polityki RLS, bo dziś `supabase/setup.sql` celowo ich nie tworzy, a wariant `articles_auth_all` leży w komentarzu.
**Dlaczego:** Punkt A19 krytyka plus zasada o ograniczaniu uprawnieniami tego, co redaktor może zepsuć. Odejście ostatniej osoby oznacza dziś utratę strony.
**Nakład:** L

### 3.9 Kopia zapasowa treści
**Pliki:** nowa akcja w Ustawieniach, `scripts/`
**Na czym polega:** Przycisk „Pobierz kopię treści" zapisuje wszystkie teksty, grafik, cennik i listę zdjęć do jednego pliku, plus ścieżka odtworzenia. Dodatkowo cotygodniowa kopia automatyczna.
**Dlaczego:** Punkt A18 krytyka. Wszystko stoi na jednym projekcie Supabase i jednym koncie Cloudinary, a stowarzyszenie ma zmieniający się zarząd.
**Nakład:** M

### 3.10 Stan usług i cichy fallback
**Pliki:** `lib/news.ts`, `lib/schedule.ts`, `lib/footerData.ts`, nowy ekran w Ustawieniach
**Na czym polega:** Gdy publiczna strona serwuje snapshot z builda, panel mówi to wprost: „Strona pokazuje teraz starszą wersję treści, bo baza nie odpowiada". Ekran „Stan strony" pokazuje połączenie z bazą, z Cloudinary i wykorzystanie limitów. Ekran logowania rozróżnia awarię bazy od złego hasła (dokończenie punktu 1.6).
**Dlaczego:** Punkty A10, C3 i D7 krytyka. Cichy fallback jest gorszy niż błąd dla kogoś, kto właśnie zmienił cenę i widzi na stronie starą.
**Nakład:** M

### 3.11 Galeria
**Pliki:** `actions/galleryActions.ts:32`, `actions/imageActions.ts:86`, `app/galeria/page.tsx:26`, `components/admin/ImagesManager.tsx:111`
**Na czym polega:** Kolejność zdjęć i wybór okładki folderu trzymamy po naszej stronie, a nie po dacie wgrania w Cloudinary. Dochodzi stronicowanie zamiast cichego ucięcia do 50 pozycji, licznik „W tym folderze: 68 zdjęć", zmiana nazwy i usuwanie pustego folderu. Foldery rozdzielamy na dwie grupy z nagłówkami zamiast pokazywać surowe ścieżki. Komunikat techniczny na publicznej stronie galerii zamieniamy na neutralne zdanie.
**Nakład:** M

### 3.12 Filtry, wyszukiwanie i pamięć list
**Pliki:** `app/admin/(panel)/artykuly/page.tsx`, `strony/page.tsx`, `wiadomosci/page.tsx`, `zdjecia`
**Na czym polega:** Nad listami staje pole wyszukiwania i proste filtry, a stan listy (filtr, sortowanie, przewinięcie) wraca po zapisie i między sesjami. Po zapisie wracamy tam, skąd użytkownik przyszedł, z trwałym paskiem potwierdzenia i linkiem „Zobacz na stronie".
**Dlaczego:** Punkt B11 krytyka: zasada o zapamiętywaniu stanu zakłada istnienie filtrów, których w panelu nie ma nigdzie.
**Nakład:** M

### 3.13 Stany puste i trzeci stan
**Pliki:** wszystkie listy w panelu
**Na czym polega:** Każdy pusty ekran dostaje trzy elementy: co to za miejsce, co tu trafia, przycisk który to wypełnia. Rozdzielamy „pusto, bo nic jeszcze nie dodano" od „pusto, bo filtr nic nie znalazł" i od trzeciego stanu, czyli „nie udało się wczytać". Dotyczy też miejsc nietkniętych w audycie: pusty folder zdjęć, brak folderów, puste menu, pusty grafik, puste listy w stopce, brak podstron własnych, pusta lista bloków.
**Dlaczego:** Punkt A11 krytyka. Dziś awaria uprawnień renderuje przyjazne „Brak artykułów. Utwórz pierwszy!", co jest gorsze od błędu.
**Nakład:** M

### 3.14 Widoczne od kiedy do kiedy
**Pliki:** `lib/news.ts:26-30`, `components/admin/ArticleEditor.tsx:47-50`
**Na czym polega:** Publikacja z datą przyszłą albo zaczyna działać naprawdę (filtr `published_at <= now()` plus status „Zaplanowane na 3 kwietnia"), albo pole daty znika z formularza. Dochodzi opcjonalne „widoczne do", żeby informacja o naborze sama zniknęła 30 września.
**Dlaczego:** Punkty A3 i A2 krytyka. Dziś pole daty udaje, że działa: artykuł z jutrzejszą datą jest widoczny natychmiast i przykleja się na górze listy.
**Nakład:** M

---

## Słownik terminów panelu

Tabela jest gotowa do wdrożenia w punkcie 1.8. Kolumna „Podpowiedź pod etykietą" to dokładny tekst do wstawienia, jedno zdanie mówiące, po co to pole i gdzie użytkownik zobaczy efekt.

| Dziś w panelu (albo w kodzie) | Gdzie | Nowa nazwa | Podpowiedź pod etykietą |
|---|---|---|---|
| slug, „Adres (slug)" | ArticleEditor:187, CustomPageEditor:173 | Adres strony | Wypełnia się sam z tytułu. Zmieniaj tylko, jeśli adres ma być krótszy. |
| „Tytuł (H1)" | PageBlocksEditor:102 | Tytuł strony | Duży napis na samej górze strony. |
| H2, „Nagłówek" | BlockEditor:286 | Nagłówek sekcji | Dzieli długi tekst na części. |
| H3, „Podtytuł" | BlockEditor | Podtytuł | Mniejszy nagłówek wewnątrz sekcji. |
| permalink | brak w UI | przycisk „Kopiuj link" | (bez podpowiedzi, sam przycisk obok adresu) |
| kicker, „Etykietka nad tytułem" | PageBlocksEditor | Nadtytuł (opcjonalne) | Krótkie słowo nad tytułem, na przykład Zawody, Egzaminy, Obóz. |
| lead, „Akapit wprowadzający" | PageBlocksEditor | Wprowadzenie (opcjonalne) | Dwa, trzy zdania na początku, wyróżnione większą czcionką. |
| excerpt | brak w UI | Zapowiedź na liście aktualności (opcjonalne) | Ten tekst zobaczą ludzie na liście aktualności, zanim klikną. Zostaw puste, wtedy pokażemy początek tekstu. |
| SEO title | brak w UI | Tytuł w wynikach Google | (w zwiniętej sekcji „Jak ta strona wygląda w Google") |
| meta description | brak w UI | Opis w wynikach Google | Możesz to pominąć, wtedy Google weźmie tytuł i pierwsze zdania tekstu. |
| canonical | brak w UI | nie pokazywać w panelu | – |
| alt, tekst alternatywny | brak w UI | Opis zdjęcia dla osób niewidomych i wyszukiwarek | Napisz, co widać na zdjęciu, na przykład: Zawodnicy klubu na podium Mistrzostw Polski 2026. |
| blok | BlockEditor | sekcja albo element strony | – |
| „Dodaj blok" | BlockEditor:239 | Dodaj element | – |
| „Tabela opłat" | BlockEditor:75 | Tabela | – |
| „Wyróżnienie" (callout) | BlockEditor | Wyróżniona ramka | Tekst na kolorowym tle, do rzeczy najważniejszych. |
| „Żółty" (highlight) | BlockEditor:820 | Podświetlenie | Podświetla fragment tekstu na żółto. |
| „Plik do pobrania", publicId pliku | BlockEditor:437 | Dokument do pobrania | Odwiedzający zobaczy nazwę dokumentu i przycisk pobierania. |
| publicId, identyfikator Cloudinary | wszędzie | nie pokazywać, tylko miniatura | – |
| folder Cloudinary „Galeria/Pokazy" | ImagesManager:111 | Zakładka galerii: Pokazy | Zdjęcia z tego folderu zobaczą odwiedzający w zakładce Galeria. |
| folder „Strona/buddyzm/podstawy" | ImagesManager:111 | Zdjęcia podstrony: Buddyzm, podstawy | Te zdjęcia są używane tylko na tej podstronie. |
| draft, „Opublikowany" (checkbox) | ArticleEditor:212 | dwa stany słowne: „Szkic, widzisz tylko ty" oraz „Opublikowane, widoczne dla wszystkich" | – |
| publish (przycisk) | wszędzie | Opublikuj na stronie | – |
| unpublish | brak w UI | Ukryj ze strony | Strona zniknie dla odwiedzających, ale zostanie w panelu. |
| „Zapisz zmiany" (dla szkicu) | wszędzie | Zapisz szkic | Nikt tego jeszcze nie zobaczy. |
| revalidate, cache, ISR | komunikaty | nie nazywać w ogóle | zamiast tego: „Zmiany są już na stronie." plus link „Zobacz na stronie" |
| przycisk odświeżenia cache | ewentualnie w Ustawieniach | Odśwież stronę publiczną | Kliknij, jeśli po zapisie nadal widzisz starą wersję. |
| „Przenieś treści do bazy", migracja, Supabase, fallback | MigrateButton | usunąć z panelu | – |
| „Przywróć treść bazową", „wersja bazowa", „z kodu strony" | EditorForm:125, ScheduleEditor:190, FooterEditor:229 | Przywróć ustawienia startowe (docelowo zastąpione historią wersji) | Wróci pierwotna treść z dnia uruchomienia strony. Twoje zmiany zostaną skasowane. |
| „Strony serwisu" | strony/page.tsx:76 | Strony, które są na stronie klubu od początku | Tych stron nie można usunąć, można je tylko zmieniać. |
| „Własne podstrony" | strony/page.tsx:29 | Strony dodane przez Ciebie | – |
| „Podstrony" (menu) / „Wszystkie podstrony" (powrót) | AdminShell, PageBlocksEditor:52 | jedna nazwa: Strony | – |
| „Edytowalne podstrony" (kafel) | page.tsx:44 | Strony do edycji | – |
| nav item, „Nawigacja" | AdminShell:16 | Menu na górze strony | – |
| „checkbox «pokaż w menu»" | nawigacja/page.tsx:39 | Pokaż w menu górnym | dokładnie ta sama nazwa co pole w CustomPageEditor:202 |
| visible (pole w bazie) | NavEditor:9 | Widoczna w menu (przełącznik) | Wyłączenie ukryje pozycję na stronie, ale zostawi ją tutaj. |
| „Harmonogram zajęć" | AdminShell | Grafik zajęć | Zmiany zobaczysz na podstronach Zajęcia, w kalendarzu do telefonu i w wizytówce Google. |
| ScheduleSlot, „termin" | ScheduleEditor | Zajęcia (jeden wiersz to jedne zajęcia w tygodniu) | – |
| group: „dorosli" / „dzieci" | ScheduleEditor | Grupa dorosła / Grupa dziecięca | (ujednolicić ze stroną publiczną, która mówi „filia") |
| .ics, „plik kalendarza" | harmonogram | Kalendarz do telefonu | Osoby, które go dodały, zobaczą zmianę w swoim telefonie. |
| „Usuń" (w liście) | wszędzie | Przenieś do kosza | – |
| soft delete, deleted_at | baza | Kosz | Rzeczy z kosza da się przywrócić przez 30 dni. |
| rewizja, wersja | baza | Historia zmian | – |
| „Telefon (do połączenia, format +48...)" | FooterEditor:179 | usunąć, zostaje jedno pole „Telefon" | Wpisz numer tak, jak ma być widoczny. Resztą zajmiemy się sami. |
| „facebook", „instagram", „youtube" (surowe klucze) | FooterEditor:120 | Facebook, adres profilu (i tak dalej) | Puste pole oznacza, że ikona nie pojawi się w stopce. |
| „Panel admina" | AdminShell:112 | nazwa bieżącej sekcji | – |
| RLS, service_role, klucze API | komunikaty | nie pokazywać | – |
| kenshi, kyu, dan, embu, randori, kihon, dōjō, shibucho, POSK, WSKO, Hombu | treść i etykiety | zostawić bez zmian jako słownictwo klubu, ale ustalić jedną pisownię w `lib/glossary.ts` | – |

Osobno do rozstrzygnięcia z klubem: strona publiczna mówi „filia Wawel" i „filia Kraków", panel mówi „grupa dzieci" i „grupa dorosłych". Jedno z dwóch musi ustąpić, inaczej redaktor szuka w panelu słowa, które widzi na stronie, i go nie znajduje.

---

## Co jest zrobione dobrze i czego nie ruszać

**Grafik zajęć jako dane strukturalne.** `ScheduleSlot` z polami dzień, godzina od, godzina do, grupa, miejsce to dokładnie ten model, którego wymaga research. Nie zamieniać tego na blok tekstowy ani na tabelę w edytorze. Naprawiamy walidację i zachowanie listy, nie sam model.

**Brak trybu HTML i brak dostępu do wyglądu.** Panel nie daje redaktorowi kolorów, czcionek, szablonów ani edytora kodu. To jest największa zaleta obecnego rozwiązania i najczęściej łamana zasada w konkurencyjnych CMS-ach. Nie dodawać niczego z tej warstwy, nawet na prośbę.

**Fallback publicznej strony do snapshotu z builda.** Gdy baza śpi, strona klubu nadal działa. Zachować bez zmian, dołożyć tylko komunikat w panelu, że treść jest starsza (punkt 3.10).

**Podgląd otwierający prawdziwą stronę, a nie własny renderer w panelu.** Kierunek prawidłowy, brakuje wyłącznie trybu szkicu. Nie budować drugiego, „prawie takiego samego" silnika renderującego, bo rozjazd z produkcją niszczy zaufanie do podglądu bezpowrotnie.

**Kontrola dostępu w jednym miejscu.** `requireUser()` w `lib/supabase/server.ts` wywoływane z akcji serwerowych to dobry wzorzec. Zmieniamy sposób obsługi wyjątku, nie samą konstrukcję.

**Płaskie, jednopoziomowe menu boczne.** Brak rozwijanych podmenu jest zgodny z zasadą. Skracamy listę i zmieniamy nazwy, ale nie dodajemy zagnieżdżeń.

**Podpowiedzi przy części pól.** „Etykietka nad tytułem (żółta, opcjonalna, na przykład «Materiały szkoleniowe»)" i „Akapit wprowadzający (pod tytułem, opcjonalny)" to wzorzec do skopiowania na wszystkie pozostałe pola, a nie do przepisania.

**Plik kalendarza .ics.** Rzadka i wartościowa funkcja, z której korzystają członkowie klubu. Nie usuwać przy przebudowie grafiku, tylko dołożyć obsługę odwołanych zajęć.

**Cały interfejs po polsku.** Zostaje. Nie wprowadzać angielskich terminów nawet tam, gdzie „i tak wszyscy je znają".

---

## Trzy decyzje właściciela

**Decyzja 1. Podgląd obok formularza czy tylko podgląd szkicu w nowej karcie.**
Wariant pełny (punkt 2.4) to dwie kolumny z żywym podglądem i przełącznikami telefon, tablet, komputer. Kosztuje przebudowę układu czterech edytorów i wpięcie renderera do panelu, czyli nakład L. Wariant tańszy to sam Draft Mode (punkt 2.3) w nakładzie M: redaktor klika „Zobacz, jak to będzie wyglądać", dostaje prawdziwą stronę w nowej karcie z paskiem podglądu i wraca do edycji. Wariant tańszy realizuje wymóg „zobacz zanim opublikujesz", ale nie realizuje zasady „formularz po lewej, podgląd po prawej". Dla użytkownika edytującego raz na sześć tygodni różnica jest odczuwalna głównie przy dłuższych stronach, gdzie ciągłe przełączanie kart męczy. Rekomendacja: zacząć od Draft Mode, a podgląd obok formularza wdrożyć tylko dla aktualności, bo to jedyna treść pisana od zera.

**Decyzja 2. Zakres kosza i historii wersji.**
Pełny wariant to `deleted_at` w pięciu tabelach, nowa tabela wersji, kolumny autora i zmiana wszystkich zapytań publicznych, czyli dwie pozycje L i migracja danych produkcyjnych. Wariant węższy obejmuje wyłącznie aktualności i strony, czyli te treści, których utrata boli najbardziej, i zostawia grafik, menu oraz stopkę przy dzisiejszym modelu „przywróć ustawienia startowe". Wariant węższy jest tańszy mniej więcej o połowę, ale zostawia lukę: skasowana pozycja menu i skasowany termin zajęć nadal nie mają drogi powrotu poza cofnięciem w obrębie jednej sesji edycji (punkt 1.5). Rekomendacja zależy od tego, ile osób będzie miało dostęp. Przy jednej osobie węższy wariant wystarcza, przy trzech osobach z zarządu pełny robi się konieczny, bo nikt nie pamięta, kto co skasował.

**Decyzja 3. Własna trasa uploadu zdjęć czy zostawienie bezpośredniego wysyłania do Cloudinary.**
Dziś przeglądarka wysyła plik prosto do Cloudinary, więc nie ma gdzie wpiąć skalowania, obrotu z EXIF, usuwania GPS, konwersji HEIC ani sensownego postępu i ponawiania. Zbudowanie własnej trasy (punkt 2.7) to nakład L i nowy element infrastruktury do utrzymania. Wariant tańszy to poprawa samych komunikatów (punkt 1.9): redaktor przynajmniej dowie się, co się nie wgrało i dlaczego, ale nadal będzie odbijał się od zdjęć z iPhone'a, zdjęć obróconych bokiem i plików ważących osiem megabajtów, a współrzędne GPS sali treningowej nadal będą trafiać do sieci razem ze zdjęciami dzieci. Ostatni argument jest w mojej ocenie rozstrzygający, ale to jest decyzja o pieniądzach i o tym, kto będzie utrzymywał tę trasę za dwa lata.

---

# Aneks: uwagi krytyka (luki w materiale)

# LUKI — czego brakuje w researchu i audycie

## A. Realne scenariusze klubowe, których nikt nie rozważył

**A1. „Dziś zajęcia odwołane" — najczęstsza pilna zmiana w klubie, brak jakiejkolwiek ścieżki (KRYTYCZNA)**
`data/schedule.ts` + `lib/schedule.ts`: `ScheduleSlot` to `{group, day, start, end, location, note}` — czysta powtarzalność tygodniowa, bez daty, bez wyjątku, bez statusu „odwołane". Nie ma też paska komunikatu na stronie. Jedyna droga to napisanie pełnej aktualności z blokami. Dodatkowo `app/api/schedule/[group]/calendar.ics/route.ts` generuje RRULE bez EXDATE — kto zasubskrybował kalendarz, dostanie w telefonie trening, który się nie odbędzie. Ani research, ani audyt tego nie dotykają.

**A2. Sezonowość: przerwa wakacyjna, ferie, nabór we wrześniu, obóz, terminy egzaminów (WAŻNA)**
Żadna treść nie ma „widoczne od–do". `published` to boolean. Nie da się zaplanować, że informacja o naborze znika 30 września. Research wspomina „datę archiwizacji" jako pole zaawansowane — ale nikt nie sprawdził, że mechanizmu nie ma i że to jest realny rytm pracy klubu.

**A3. Publikacja z datą przyszłą UDAJE, że działa (KRYTYCZNA)**
`ArticleEditor.tsx:47-50` daje pełne pole `datetime-local` z domyślnym „teraz", a `lib/news.ts:26-30` filtruje wyłącznie `published=true` i sortuje po `published_at desc`. Artykuł z datą jutrzejszą jest widoczny natychmiast i przykleja się na stałe na górze listy. Backdate (relacja z zawodów sprzed miesiąca) po cichu chowa artykuł na dół. Research wymienia status „Zaplanowane na 3 kwietnia" — funkcji nie ma i nikt nie sprawdził, że jej nie ma. Nigdzie nie napisano, co to pole właściwie robi.

**A4. „Podbić cennik o 10 zł" — cała ścieżka nieprzemyślana (KRYTYCZNA)**
Cennik to cztery tabele wewnątrz jednej strony blokowej (`lib/editablePages.ts:46-134`, ~25 wierszy: składki, opłaty organizacyjne, 8 stopni Kyu, 8 stopni Dan, opłaty dodatkowe). Redaktor przewija długi formularz bez wyszukiwarki, bez „co się zmieni", bez historii cen, bez pola „obowiązuje od". Research wymaga historii ceny i ekranu „Cena karnetu: 180 zł → 200 zł" — audyt w ogóle nie zbadał cennika jako zadania.

**A5. Numer konta bankowego wpisywany jako zwykły tekst (KRYTYCZNA)**
`lib/editablePages.ts:118-122`: nazwa stowarzyszenia, adres i IBAN `==53 1140 2004 0000 3502 7497 1466==` siedzą w jednym bloku `callout` razem ze znacznikami wyróżnienia. To najdroższy w skutkach ciąg znaków na całej stronie (pieniądze idą na złe konto), a jest edytowany jak akapit: bez pola strukturalnego, bez walidacji sumy kontrolnej IBAN, bez potwierdzenia, bez diffa. W researchu nie ma zasady o „polach, w których pomyłka o jeden znak kosztuje" (IBAN, telefon, e-mail, adres).

**A6. Zmiana telefonu/e-maila/adresu klubu rozjeżdża się w czterech miejscach (KRYTYCZNA)**
`lib/site.ts` `CONTACT` (twardo w kodzie) zasila JSON-LD (`components/StructuredData.tsx`), mapę (`MAPS_EMBED_URL`), metadane i prefill Kontaktu; `lib/footerTypes.ts` `DEFAULT_FOOTER.contact` to druga, edytowalna kopia; strona Kontakt trzyma trzecią kopię jako bloki w bazie. Audyt znalazł tylko duplikację godzin (Harmonogram vs Kontakt). Po zmianie numeru w Stopce Google i mapa dalej pokazują stary — a adresu sali (`venue`, `street`) nie da się zmienić w panelu w ogóle.

**A7. Zmiana instruktora — brak sekcji i pułapka kasująca kartę (KRYTYCZNA)**
Research żąda pozycji menu „Instruktorzy"; takiej sekcji nie ma. Dane instruktora to blok `person` wewnątrz treści strony, a podpowiedź w panelu (`lib/editablePages.ts:221,241`, pole `scope`) twierdzi: „karta instruktora … zostaje" — i jednocześnie `prefill` dla `zajecia-dorosli`/`zajecia-dzieci` **nie zawiera bloku person**. Czyli „Przywróć treść bazową" (`EditorForm.tsx:125`) po cichu kasuje kartę instruktora, a tekst w panelu kłamie. Nikt nie sprawdził rozjazdu prefill vs. treść realna. Do tego `app/zajecia/dorosli/page.tsx:11` ma nazwisko instruktora zaszyte w `description` metadanych.

**A8. Nikt nie wie, że przyszła wiadomość (KRYTYCZNA)**
`actions/contactActions.ts:6-9` — wysyłki mailem nie ma („dojdzie później"). Panel jest jedyną kopią zgłoszenia, a użytkownik loguje się raz na kilka tygodni: rodzic pytający o zapisanie dziecka czeka trzy tygodnie. Brak powiadomienia, brak auto-odpowiedzi do nadawcy, brak statusu „odpowiedziano", brak odpowiadania z panelu (tylko `mailto:`), brak filtra/wyszukiwarki/akcji zbiorczych w `MessagesManager.tsx`, cichy limit 200 wiadomości (`contactActions.ts` `.limit(200)`). Research zakłada filtr wiadomości („Brak wiadomości pasujących do «styczeń»") — audyt nie zauważył, że filtra po prostu nie ma.

**A9. Spam i RODO w skrzynce (KRYTYCZNA, ryzyko prawne)**
Ochrona to sam honeypot, bez rate-limitingu — zalew botów robi skrzynkę bezużyteczną, a usuwanie jest po jednej sztuce z `confirm()`. Dane osobowe (imię, e-mail, treść, często dotycząca dziecka) leżą bezterminowo: brak retencji, brak eksportu, brak anonimizacji, twardy DELETE. W całym projekcie nie ma polityki prywatności ani informacji o cookies (grep po `prywatno|RODO|cookie` — zero), a `ContactForm.tsx` nie ma żadnej zgody ani linku do polityki. Dla stowarzyszenia to realna ekspozycja, poza zakresem obu dokumentów.

**A10. Uśpiony/darmowy Supabase — najbardziej prawdopodobne pierwsze doświadczenie rzadkiego użytkownika (KRYTYCZNA)**
Publiczna strona ma fallback do snapshotu z builda (`content-fallback/articles.json`, `SCHEDULE`, `DEFAULT_FOOTER`, `DEFAULT_NAV`), więc przy niedostępnej bazie **po cichu pokazuje starą treść**, a panel przestaje działać. Logowanie zamienia awarię bazy na „Nieprawidłowy email lub hasło." (`app/admin/login/page.tsx:35`). Nikt nie postawił zasady: panel dla użytkownika logującego się raz na miesiąc musi przetrwać uśpioną infrastrukturę i **powiedzieć wprost, co się dzieje** — łącznie z ostrzeżeniem „strona pokazuje teraz starą wersję".

**A11. Pusto z powodu awarii ≠ pusto z powodu braku treści (KRYTYCZNA)**
`app/admin/(panel)/artykuly/page.tsx:6-11` czyta artykuły klientem sesyjnym (anon + RLS), a `supabase/setup.sql` **celowo nie tworzy żadnych polityk** (polityka na `articles` powstała poza plikiem, wariant `articles_auth_all` jest w komentarzu ~linia 217). Wystarczy dryf konfiguracji i lista renderuje przyjazne „Brak artykułów. Utwórz pierwszy!", a zapis wywala angielski błąd RLS. To samo w liczniku pulpitu (`count` → 0). Research rozróżnia tylko „pusto" vs „pusto po filtrze" — trzeciego stanu (awaria/brak uprawnień) nie ma w żadnej zasadzie, a audyt zauważył go wyłącznie przy `AdminsManager`.

**A12. Dwie osoby edytują naraz (WAŻNA)**
Zero blokad optymistycznych: `saveNewsArticle` robi `update … eq(id)`, `savePageContent` robi `upsert` po kluczu. Instruktor i osoba z zarządu edytujący cennik nadpisują się bez śladu. Dodatkowo research chce „Ostatnie zmiany: kto, co, kiedy" — a **żadna tabela nie ma autora** (`articles` bez `created_by`/`updated_by`, `site_settings` ma tylko `updated_at`). Dziennika zmian nie da się dziś zbudować bez zmiany schematu.

**A13. Zmiana adresu aktualności zrywa linki z Facebooka (WAŻNA)**
Research ostrzega o slugu, audyt sprawdził tylko synchronizację menu dla podstron własnych. W aktualnościach zmiana slug (`ArticleEditor.tsx:189`) osiero­ca `/aktualnosci/stary-slug`: brak tabeli przekierowań, brak ostrzeżenia, a `revalidateNews()` (`newsActions.ts:17-21`) odświeża **tylko nowy** adres — stary serwuje cache, a potem 404.

**A14. Sitemap i to, co widzi Google, nie zmienia się po publikacji (WAŻNA)**
`app/sitemap.ts` nie ma `revalidate` ani `dynamic` — jest generowany przy buildzie, więc nowa aktualność i nowa podstrona własna trafiają do `sitemap.xml` dopiero po deployu. Równolegle `title`/`description` wszystkich stron statycznych są zaszyte w kodzie, a panel edytuje wyłącznie H1/lead w bazie: **to, co redaktor zmienia, nie jest tym, co pokazuje Google**. Research pisze mikrotreści dla pól SEO — audyt nie sprawdził, że tych pól w ogóle nie ma.

**A15. Zero opisów alternatywnych zdjęć w całym produkcie (KRYTYCZNA, wspólny martwy punkt)**
Grep: każdy obraz treściowy renderuje `alt=""` (`components/NewsBlocks.tsx:141,168,294`, `app/aktualnosci/page.tsx:60`, `[slug]/page.tsx:63`), galeria daje generyczne „tytuł – zdjęcie 3". Typ bloku `image` (`lib/newsTypes.ts:17`) ma tylko `caption`, `gallery` to gołe `publicIds`, `person.imageId` bez opisu. Research poświęca temu pięć zasad — audyt nie zauważył, że pola po prostu nie ma. To jednocześnie luka dostępnościowa z ciężarem prawnym.

**A16. Wgrywanie 40 zdjęć z telefonu jest architektonicznie niemożliwe do naprawy samym UI (KRYTYCZNA)**
Upload leci bezpośrednio z przeglądarki do Cloudinary (`ImagesManager.tsx:85`, `ImagePicker.tsx:101`, podpis z `imageActions.ts:129`). Nie ma serwerowego przeskalowania, korekty EXIF-orientacji, **usuwania EXIF/GPS ze zdjęć dzieci**, obsługi HEIC, limitu rozmiaru, paska postępu per plik ani ponowienia. Research opisuje pełny pipeline — nikt nie napisał, że obecna architektura wymaga dołożenia własnej trasy uploadu, czyli że to nie jest poprawka copy, tylko nowy moduł.

**A17. Kolejność zdjęć w galerii i okładka folderu — porządek żyje poza naszą bazą (WAŻNA)**
`actions/galleryActions.ts:32` sortuje po `created_at desc` i tnie do 50. Redaktor nie może ustawić kolejności, wybrać zdjęcia okładkowego, zmienić nazwy ani usunąć folderu; zdjęcia powyżej 50 znikają publicznie bez słowa. Research żąda strzałek „w górę/w dół" dla zdjęć w galerii — nikt nie zauważył, że kolejność nie jest przechowywana nigdzie po naszej stronie.

**A18. Brak kopii zapasowej i planu „programista zniknął" (WAŻNA)**
Wszystko stoi na jednym projekcie Supabase i jednym koncie Cloudinary. `content-fallback/articles.json` odświeża wyłącznie ręczny `scripts/seed-content.mjs`. Nie ma „Pobierz kopię treści" ani odtworzenia. Dla stowarzyszenia ze zmieniającym się zarządem to główne ryzyko ciągłości — i miejsce na to jest w panelu („Ustawienia → Kopia zapasowa"), nie w głowie wykonawcy.

**A19. Przekazanie dostępu i utrata konta (KRYTYCZNA)**
`actions/userActions.ts`: każdy admin jest pełnym adminem, każdy może skasować każde konto poza własnym, brak ról, brak „właściciela", brak dziennika, hasło nowej osoby wpisuje twórca jawnym tekstem (`AdminsManager.tsx:141`), reset hasła nie istnieje. Odejście ostatniej osoby = utrata strony. Jednocześnie research zakłada rolę „redaktor" egzekwowaną przez RLS — czego ta architektura (wszystko przez `service_role`, RLS bez polityk, `supabase/setup.sql`) nie potrafi wyrazić. Plan musi to nazwać wprost.

**A20. Coroczna wymiana deklaracji i statutów nie ma ścieżki (WAŻNA)**
`public/downloads/*.pdf` w repozytorium + podpowiedź w stopce każąca redaktorowi „wgrać do folderu public/downloads w projekcie". Audyt złapał podpowiedź; nikt nie wycenił, że research („Podmień plik" z zachowaniem adresu, sekcja „Dokumenty do pobrania", metryka „PDF, 240 KB, 2 strony", ostrzeżenie o skanie) wymaga nowego magazynu plików, a nie poprawki tekstu.

## B. Zasady z researchu, których nikt nie skonfrontował z panelem

**B1. Historia wersji — zasada krytyczna w dwóch dokumentach, w audycie jedno zdanie na marginesie.** Nikt nie policzył zakresu: rewizji nie ma dla ŻADNEGO typu treści (`articles`, `site_settings` — strony, harmonogram, stopka, `nav_items`, `custom_pages`), a `site_settings` jest nadpisywany `upsert`-em w miejscu, więc nie ma czego przywracać nawet ręcznie z bazy. To największa pozycja budżetowa całej przebudowy.

**B2. Kosz / soft delete.** Audyt wylicza pojedyncze brakujące potwierdzenia; nikt nie stwierdził, że **żadna tabela nie ma `deleted_at`** (`supabase/setup.sql`), więc „Kosz" to migracja pięciu tabel plus zmiana wszystkich zapytań publicznych plus nowa sekcja menu i retencja 30 dni.

**B3. Podgląd wersji roboczej przez Draft Mode.** Research prosi o `/api/draft`; w `app/api` jest wyłącznie trasa `.ics`. Nikt nie sprawdził, że trasy podglądu, tokenu i paska „PODGLĄD SZKICU" nie ma w ogóle.

**B4. Model „formularz po lewej, żywy podgląd po prawej" + przełączniki telefon/tablet/komputer.** Audyt notuje „brak podglądu bloków", ale nikt nie ocenił, że obecny jednokolumnowy edytor trzeba przebudować, i nie ma żadnej pozycji łączącej tę zasadę z konkretnym plikiem.

**B5. Cały blok dostępności /admin nie został zmierzony.** Zasady mówią: 44×44 px, tekst 18 px w `rem`, kontrast 7:1, focus 2 px, brak poziomego scrolla przy 320 px, `aria-live` dla komunikatów, pułapka fokusu w modalach. Panel jest napisany na `text-xs`/`text-sm` i przyciskach `px-3 py-1.5` (`MessagesManager.tsx:88,96`, `NavEditor`, `ArticleEditor`), czyli ~28–32 px cele i 12–14 px tekst; nigdzie nie ma `role="status"`, `aria-live` ani `aria-hidden` na ikonach-znakach. Audyt dotyka tego dwa razy przy ikonach hover. Brakuje osobnego, systematycznego przeglądu WCAG panelu.

**B6. „Ten sam typ danych = ten sam widżet".** Nikt nie zinwentaryzował niespójności: dwa różne zachowania wyboru zdjęcia (`ImagePicker` pojedynczy vs wielokrotny), osobny `ImagesManager`, trzy implementacje pola adresu (`ArticleEditor.slugify`, `CustomPageEditor.slugify`, wolne pole w `NavEditor`), dwa modele zapisu (Zapisz vs Zapisz+Opublikuj), dwa pola na ten sam telefon.

**B7. „Jeden ekran = jedna decyzja" i „kolejność pól = kolejność treści na stronie".** Nie zweryfikowane dla żadnego edytora.

**B8. Puste stany.** Audyt sprawdził dwa miejsca (artykuły, wiadomości). Nietknięte: pusty folder zdjęć, brak folderów, puste menu, pusty harmonogram, puste listy w stopce (`links: []` w `DEFAULT_FOOTER`), brak podstron własnych, pusta lista bloków.

**B9. Walidacja wybaczająca formaty.** Żadne pole nie normalizuje wejścia. `lib/schedule.ts` `TIME_RE` wymaga sztywnego `HH:MM` — „18.00", „18", „6:00 PM" kończą się ogólnym błędem bez wskazania wiersza. Research to zapowiada, audyt nie sprawdził poza harmonogramem.

**B10. „Nigdy nie wyłączaj przycisku Zapisz/Opublikuj".** Audyt złapał wyłączony „Wgraj zdjęcia"; nie sprawdził, że każdy zapis to `disabled={saving}`/`disabled={busy}`, a przy nieobsłużonym wyjątku (brak try/catch) przycisk zostaje martwy na zawsze — to ta sama usterka opisana osobno.

**B11. Zapamiętywanie stanu listy (filtr, sortowanie, przewinięcie).** Zasada zakłada istnienie filtrów i sortowania — w panelu nie ma ich nigdzie: ani w aktualnościach, ani w wiadomościach, ani w zdjęciach. Zasada jest nie do wdrożenia bez wcześniejszego dodania samych filtrów.

## C. Problemy z audytu bez zasady mówiącej, jak je naprawić

**C1. Operacje wdrożeniowe/serwisowe w panelu (MigrateButton).** Research nie ma ani słowa o tym, gdzie mieszkają jednorazowe operacje techniczne, kto je widzi i jak panel pokazuje, że są już wykonane. Potrzebna zasada: takie akcje istnieją wyłącznie za flagą środowiskową / rolą techniczną, nie w widoku redaktora.

**C2. Pięć równoległych „wersji bazowych".** `EDITABLE_PAGES.prefill`, `DEFAULT_FOOTER`, `DEFAULT_NAV`, `SCHEDULE`, `content-fallback/articles.json` — wszystkie odtwarzalne jednym kliknięciem i wszystkie już nieaktualne wobec żywej treści (dowód: brak bloku `person` w prefill zajęć). Research nie definiuje, czym dla nietechnicznego użytkownika jest „wersja bazowa" („bazowa", czyli czyja i z kiedy?) ani czy ta funkcja w ogóle ma prawo istnieć. Rekomendacja do dopisania: zastąpić wszystkie „Przywróć treść bazową" pozycją z historii („Przywróć wersję z 12 marca").

**C3. Cichy fallback publiczny.** `getNews`, `getSchedule`, `getFooter` łapią błąd i serwują snapshot. Nie ma zasady mówiącej, jak zakomunikować redaktorowi „strona pokazuje teraz starą treść, bo baza nie odpowiada" — a to gorsze niż błąd dla kogoś, kto właśnie zmienił cenę.

**C4. Destrukcyjny zapis zbiorczy menu (`navActions.ts:38`, delete-all + insert bez transakcji).** Research odpowiada na to tylko dialogiem potwierdzenia. Brakuje zasady inżynierskiej: operacje zbiorcze zamieniamy na diff/upsert w transakcji, zamiast obudowywać je ostrzeżeniem.

**C5. Kontrakt edytor ↔ renderer.** Trzy warianty tej samej usterki: zagnieżdżone znaczniki, których `NewsBlocks.tsx:11` nie umie sparsować; nierozpoznany adres YouTube (`NewsBlocks.tsx:257` `return null` — blok znika bez śladu); blok „Zdjęcie" z pustym `publicId`. Nie ma zasady: „edytor nie może pozwolić zapisać czegoś, czego strona nie pokaże; jeżeli blok nie trafi na stronę, powiedz to w miejscu bloku, przed zapisem".

**C6. Jedno pole = jedno miejsce prawdy.** Nie ma zasady zakazującej, by ten sam fakt (godziny, telefon, e-mail, adres, linki społecznościowe) był edytowalny w dwóch miejscach albo jednocześnie zaszyty w kodzie. Bez niej duplikacje z A6 wrócą przy pierwszej nowej sekcji.

**C7. Powiadomienia i retencja danych.** Skrzynka wiadomości jest jedynym egzemplarzem korespondencji o skutkach prawnych — żadna zasada nie mówi, co panel ma z tym robić.

## D. Rzeczy specyficzne dla TEGO panelu, które wypadły poza schemat

**D1. Słownik terminów klubowych nie został napisany.** Research każe „prowadzić plik słownika i traktować jak kod", ale nikt nie ustalił treści dla tego klubu: kenshi, kyu/dan, embu, randori, kihon, dōjō, shibucho, **filia Wawel / filia Kraków vs. „grupa dzieci / dorośli"** (panel mówi „grupa", strona mówi „filia"), POSK/WSKO, Hombu. Bez tego „nazewnictwo z życia klubu" jest deklaracją bez zawartości.

**D2. Koszt migracji istniejącej treści przy zwężaniu palety.** Zasady chcą 6–8 bloków i pięciu funkcji formatowania. Obecnie: 14 typów bloków i autorskie wyróżnienie `==żółty==`, którego pełno w treści bazowej (`==kihon==`, `==Kraków==`, `==5–13 lat==`, IBAN). Do tego `data/articles/*.ts` to kilkadziesiąt stron gotowej treści. Nikt nie policzył migracji: usunięcie highlightu, zamiana bloku „Tabela opłat" na strukturalny cennik, redukcja bloków — to przepisanie istniejących treści, nie zmiana UI.

**D3. Dwa formaty treści i stratny konwerter.** Podstrony tematyczne (`o-shorinji`, `organizacja`, `buddyzm`) żyją jako kod w `data/articles/*.ts`, a nadpisania w `article_overrides` w **markdownie** (`lib/blockConvert.ts`), podczas gdy reszta panelu operuje na blokach. Nikt nie zapytał, co ginie na cyklu bloki → markdown → bloki ani czy te ~20 podstron w ogóle powinny być edytowalne przez instruktora.

**D4. Niewidoczne miejsca docelowe edycji.** Harmonogram zasila jednocześnie: strony zajęć, plik `.ics` (subskrypcje w telefonach członków) i godziny otwarcia w JSON-LD dla Google (`components/StructuredData.tsx`). Podpowiedź w panelu wymienia dwa z trzech. Zasada „powiedz, gdzie to zobaczę" musi objąć także kalendarz i wizytówkę Google — inaczej redaktor nie ma szansy przewidzieć skutków.

**D5. Kanoniczny scenariusz klubu: „relacja z zawodów = tekst + 40 zdjęć" nie ma ścieżki.** Wymaga dwóch sekcji (Aktualności + Zdjęcia), ręcznego wyboru zdjęć po jednym, i nie da się powiązać artykułu z folderem galerii. Nie ma też przypinania aktualności na górze, kategorii/tagów ani wyróżnienia „ważne".

**D6. Typografia polska w edytorze.** Cała treść bazowa używa „…" i półpauz, edytor produkuje proste cudzysłowy i dywizy, nic nie normalizuje — po kilku edycjach strona wygląda niechlujnie. Brak też obsługi spacji nierozdzielających. Drobiazg, ale dokładnie ten, który widać na publicznej stronie klubu.

**D7. Brak jakiejkolwiek diagnostyki po stronie panelu.** Błędy lądują w `console.warn` na serwerze. Gdy instruktor powie „nie działa", nie ma śladu: żadnego logu zdarzeń, żadnego ekranu „stan połączenia z bazą / Cloudinary / limity", żadnej informacji o wyczerpaniu darmowego transferu Cloudinary (a `galleryActions.ts:32` wprost tnie do 50 zdjęć „żeby nie spaliło transferu"). Dla produktu, którego użytkownik nie ma kogo zapytać, to brak pierwszej kategorii.

---

# Uzupełnienia po przeglądzie panelu przez właściciela (09.08.2026)

Uwagi zgłoszone po obejrzeniu panelu na żywo, poza zakresem pierwotnego audytu.

## U1. Wgrywanie zdjęć: widok folderów zamiast rzędu przycisków

**Zgłoszenie:** „Przydałby się bardziej czytelny interfejs do wrzucania zdjęć,
np. wygląd folderów, a nie jak teraz jakieś buttony."

**Pliki:** `components/admin/ImagesManager.tsx`, `components/admin/ImagePicker.tsx`,
`actions/imageActions.ts`

**Na czym polega problem:** foldery Cloudinary są dziś listą przycisków z surowymi
ścieżkami (`Galeria/Pokazy`, `Strona/buddyzm/podstawy`). Redaktor nie widzi, ile
zdjęć jest w środku ani co to za miejsce, a ścieżka z ukośnikiem jest pojęciem
technicznym. Nie ma też podglądu zawartości przed wejściem.

**Kierunek:** siatka kafelków przypominająca eksplorator plików - miniatura
pierwszego zdjęcia jako okładka folderu, nazwa po ludzku ("Galeria: Pokazy",
"Zdjęcia podstrony: Buddyzm, podstawy" - zgodnie ze słownikiem), licznik zdjęć,
ścieżka powrotu (okruszki). Upload przez przeciągnięcie plików na kafelek folderu.
Wiąże się z punktami 1.9 (zdjęcia przestają milczeć) i 2.7 (własna trasa uploadu -
odrzucona, zostają lepsze komunikaty i zmniejszanie w przeglądarce).

**Nakład:** M

## U2. Podgląd pokazuje wersję zapisaną, nie edytowaną

**Zgłoszenie:** „Podgląd edycji nie działa, pokazuje po prostu stronę w nowej karcie,
ale i tak trzeba zapisać zmiany najpierw, by je zobaczyć."

**Stan:** zgodny z dzisiejszą implementacją - przycisk „Podgląd ↗" otwiera publiczny
adres strony, czyli wersję zapisaną. To dokładnie problem opisany w punkcie 2.3
(podgląd wersji roboczej przez Draft Mode). Właściciel wybrał wariant „podgląd szkicu
w nowej karcie" i zaznaczył, że na razie może zostać jak jest.

**Do czasu wdrożenia 2.3:** przycisk powinien nazywać się tak, jak działa - np.
„Zobacz zapisaną wersję ↗" - żeby nie obiecywał podglądu zmian, których nie pokazuje.
