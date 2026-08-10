# Plan: usługi zewnętrzne i koszty w jednym miejscu w panelu

Notatka właściciela z 11.08.2026, przepisana na plan. **Nic z tego nie jest jeszcze zrobione.**
Zadanie do kolejki po scaleniu menu i stron (`docs/menu-architektura.md`).

## Po co to

Serwis stoi na czterech zewnętrznych usługach i nikt nie ma tego zestawienia w jednym miejscu.
Żeby sprawdzić, ile zostało miejsca w Cloudinary albo kiedy wygasa domena, trzeba pamiętać,
gdzie się logować i pod jakim adresem leży właściwy projekt. Panel ma to pokazać obok siebie:
odnośnik do konkretnego projektu, koszt, data odnowienia i podstawowe zużycie.

Płacimy realnie tylko za domenę. Reszta chodzi na darmowych planach, ale darmowe plany mają
limity i warto widzieć, jak blisko granicy jesteśmy, zanim usługa się zatrzyma.

## Gdzie to umieścić

Do rozstrzygnięcia przy projektowaniu, dwa warianty:

1. Sekcja na pulpicie (`/admin`), zwinięta, otwierana kliknięciem. Zaleta: widać przy każdym
   wejściu do panelu. Wada: pulpit jest dziś zbudowany wokół zadań redaktora, a to informacja
   dla właściciela, nie dla instruktora.
2. Osobna zakładka „Usługi i koszty" na końcu menu panelu, pod „Dostęp do panelu". Zaleta:
   nie zaśmieca pulpitu. Wada: trzeba o niej pamiętać.

Wariant drugi wygląda na właściwy, bo te dane oglądamy raz na kilka miesięcy, a nie co tydzień.
Na pulpicie może zostać jeden wiersz z ostrzeżeniem, gdy coś wygasa w ciągu 30 dni albo
gdy zużycie przekroczy ustalony próg.

## Cztery usługi i co da się z nich wyciągnąć

| Usługa | Do czego służy | Plan | API | Co warto pokazać |
|---|---|---|---|---|
| OVH | domena shorinjikempo.pl | płatny | tak, pełne REST | data wygaśnięcia, koszt odnowienia, ostatnia faktura |
| Netlify | hosting i wdrożenia | darmowy | tak | stan ostatniego wdrożenia, zużyty transfer, minuty budowania |
| Supabase | baza, pliki, logowanie | darmowy | tak, Management API | rozmiar bazy, zajętość magazynu plików, liczba użytkowników |
| Cloudinary | zdjęcia | darmowy | tak, Admin API | zużyte kredyty, transfer, liczba plików |

### OVH

API jest pod `api.ovh.com`, wersje `/v1` i `/v2`. Interesujące punkty:

- `GET /domain/{domena}` oraz `GET /domain/zone/...` dla danych domeny
- `GET /me/bill` dla faktur i realnie zapłaconych kwot
- `POST /order/cart` plus `GET /order/cart/{id}/domain` zwraca cenę utworzenia i odnowienia

Data wygaśnięcia i koszt odnowienia dają się odczytać automatycznie. Uwierzytelnianie idzie
przez trójkę application key, application secret i consumer key, którą trzeba raz wygenerować
w panelu OVH i wpisać do zmiennych środowiskowych Netlify.

### Netlify, Supabase, Cloudinary

Wszystkie trzy mają API zwracające zużycie. Cloudinary ma do tego dedykowany punkt `/usage`,
który podaje kredyty, transfer i liczbę plików w jednym zapytaniu. Supabase udostępnia
Management API na poziomie organizacji. Netlify zwraca stan wdrożeń i zużycie zespołu.

## Pułapka, o której trzeba pamiętać od początku

Każde z tych API wymaga tokenu z szerokimi uprawnieniami. Token do Netlify potrafi wdrożyć
kod, token do Supabase potrafi skasować projekt. Z tego wynikają trzy zasady:

1. Tokeny trzymamy wyłącznie w zmiennych środowiskowych Netlify, nigdy w repozytorium
   i nigdy w kodzie, który trafia do przeglądarki. Odczyt robi funkcja serwerowa.
2. Zakres uprawnień zawężamy tak, jak usługa pozwala. Tam, gdzie istnieje token tylko do
   odczytu, używamy go.
3. Wyniki cache'ujemy na kilka godzin. Odpytywanie czterech API przy każdym wejściu do panelu
   to wolne ładowanie i szybkie wyczerpanie limitów zapytań.

Przy okazji trzeba sprawdzić filtr kontekstu w Netlify, bo zmienne bywają niewidoczne pod
niewłaściwym filtrem i łatwo uznać, że klucza nie ma.

## Poczta @shorinjikempo.pl na OVH

Da się. OVH ma usługę MX Plan, a do domeny przysługuje darmowy plan hostingu obejmujący
100 MB miejsca na stronę i jedno konto pocztowe z 5 GB. Darmowy plan jest dostępny dla
klientów z Europy, więc nas obejmuje.

Czego jeszcze nie wiem i trzeba sprawdzić w panelu OVH, a nie zgadywać:

- czy darmowy plan jest już aktywowany na tej domenie, czy trzeba go włączyć
- ile kont pocztowych realnie potrzebujemy, bo darmowy plan daje jedno
- ile kosztuje MX Plan z większą liczbą skrzynek, jeśli jedna nie wystarczy

Uwaga niezależna od ceny: przy przenoszeniu poczty na własną domenę trzeba ustawić rekordy
SPF, DKIM i DMARC, inaczej wiadomości z klubu będą lądować w spamie. To osobne zadanie.

## Wspólne konto administratora do usług zewnętrznych

Pomysł z notatki: jedno konto, z którego można się logować do Netlify, Supabase, Cloudinary
i OVH. Technicznie da się, ale warto rozważyć wady, zanim to wprowadzimy.

Za wspólnym kontem: nie ginie dostęp, gdy jedna osoba przestaje się projektem zajmować.
Wszystko leży pod jednym adresem, który da się przekazać następnej osobie.

Przeciw: wspólne hasło znaczy brak śladu, kto co zrobił. Uwierzytelnianie dwuskładnikowe
przy wspólnym koncie robi się kłopotliwe, bo kod przychodzi na jedno urządzenie. Utrata
tego jednego konta to utrata wszystkiego naraz.

Rozwiązanie pośrednie, które zwykle wygrywa: zostają konta osobiste, a jako zabezpieczenie
ciągłości dokładamy adres techniczny na własnej domenie, ustawiony jako kontakt odzyskiwania
i właściciel rozliczeń. Wtedy dostęp da się odzyskać, a ślad kto co zrobił zostaje.
Darmowe plany ograniczają liczbę osób w zespole, więc przed decyzją trzeba sprawdzić limity.

To jest decyzja właściciela, nie techniczna. Wymaga świadomego wyboru między wygodą
a rozliczalnością.

## Kolejność wdrożenia

1. Zebranie danych ręcznie i wpisanie ich na stałe do jednej tabeli w panelu. Pół dnia,
   od razu widać wartość i wiadomo, czego naprawdę chcemy patrzeć.
2. Odnośniki do konkretnych projektów, nie do stron głównych usług. Trywialne, a oszczędza
   najwięcej klikania.
3. Odczyt z API, usługa po usłudze, zaczynając od Cloudinary, bo jedno zapytanie daje
   komplet. Każda usługa osobno, z zapasowym wyświetleniem wartości wpisanej ręcznie,
   gdy API nie odpowie.
4. Ostrzeżenia progowe i wiersz na pulpicie.

Punkty 1 i 2 dają większość korzyści przy znikomym nakładzie. Punkt 3 jest przyjemny,
ale to on wnosi tokeny i ryzyko, więc nie ma powodu robić go pierwszego.

## Sprawy do rozstrzygnięcia przez właściciela

- Gdzie to ma być, pulpit czy osobna zakładka
- Ile skrzynek pocztowych na domenie klubu
- Wspólne konto do usług zewnętrznych czy adres techniczny do odzyskiwania dostępu
