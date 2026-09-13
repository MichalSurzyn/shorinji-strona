# Checklista do wyklikania — drzewo stron i menu

Wszystko poniżej klikasz **na poligonie**, czyli na kopii bazy. Produkcja jest
nietknięta; cokolwiek tu zepsujesz, zostaje na kopii. O to chodzi — klikaj bez
zastanawiania się.

## Jak uruchomić

W terminalu, z katalogu `C:\Workspace\Kempo`:

```
node Poligon/podglad.mjs
```

Po minucie wypisze adres i dane logowania. Strona: `http://localhost:3000`,
panel: `http://localhost:3000/admin`. Zatrzymanie: `Ctrl+C`.

Jeśli coś nie zadziała, **nie naprawiaj** — zapisz numer punktu i co zobaczyłeś.

---

## A. Strona publiczna — czy nic nie zniknęło

| # | Co zrobić | Co ma się stać |
|---|---|---|
| A1 | Otwórz `http://localhost:3000` | Strona główna jak dotąd: film, kanji po bokach, menu na górze |
| A2 | Rozwiń w menu **O SHORINJI KEMPO** | Sześć pozycji: Wprowadzenie, Cele i wartości, **Sens Budo**, Medytacja / Zazen, **Symbole**, Historia szkoły |
| A3 | Kliknij **Sens Budo** | Otwiera się strona, adres to `/o-shorinji/istota-budo` |
| A4 | Wpisz z palca stary adres `http://localhost:3000/istota-budo` | Przerzuca na `/o-shorinji/istota-budo` — **stary link nie umarł** |
| A5 | To samo dla `http://localhost:3000/symbole-shorinji-kempo` | Przerzuca na `/o-shorinji/symbole-shorinji-kempo` |
| A6 | Rozwiń **ZAJĘCIA**, kliknij **FAQ** | Otwiera się pod adresem `/faq` (bez zmian — wisi pod nagłówkiem, nie pod stroną) |
| A7 | Wejdź na `/buddyzm/medytacja` | Pełna treść, spis treści „Na tej stronie" po prawej, na dole poprzednia/następna |
| A8 | Wejdź na `/o-shorinji` | Kafelki **sześciu** podstron, w tym Sens Budo i Symbole |
| A9 | Wpisz adres, którego nie ma: `/nie-ma-takiej-strony` | Własna strona 404 po polsku, z menu i odnośnikami powrotu — **nie** angielski ekran Next |
| A10 | Wejdź na `/cennik` | Przerzuca na `/zajecia/cennik` |

**Na telefonie** (albo w przeglądarce zwężonej do ~390 px):

| # | Co zrobić | Co ma się stać |
|---|---|---|
| A11 | Kliknij hamburger | Wysuwa się szuflada z menu |
| A12 | Popatrz na listę | Podstrony są **zwinięte**; przy pozycjach z podstronami jest strzałka |
| A13 | Kliknij strzałkę przy O SHORINJI | Rozwija się lista podstron |
| A14 | Naciśnij `Esc` | Szuflada się zamyka |

---

## B. Panel — drzewo stron i menu

Zaloguj się danymi z terminala, wejdź w zakładkę **Strony i menu**.

| # | Co zrobić | Co ma się stać |
|---|---|---|
| B1 | Popatrz na listę | Jedno drzewo z wcięciami. Przy każdej pozycji etykieta: *strona*, *nagłówek* albo *odnośnik* |
| B2 | Znajdź **ZAJĘCIA** | Ma etykietę *nagłówek* i napis „— bez adresu —". To pozycja, która tylko grupuje |
| B3 | Znajdź pozycje z plakietką **stała część serwisu** | Np. Cennik, Kontakt. Nie mają przycisku „Usuń" — i tak ma być |
| B4 | Dodaj stronę: rodzaj *Strona*, miejsce **PROGRAM NAUCZANIA**, nazwa `Uczniowskie`, adres `uczniowskie` | Pod polem widać na żywo `/program-nauczania/uczniowskie`. Po kliknięciu „Dodaj" pojawia się w drzewie **od razu opublikowana i w menu** — bez plakietek „ukryta" i „poza menu" |
| B4a | Rozwiń jeszcze raz listę **Miejsce w drzewie** | „Uczniowskie" jest na liście **zaraz pod** „PROGRAM NAUCZANIA", z wcięciem — a nie na końcu listy przy obcej pozycji |
| B5 | Dodaj drugą: miejsce **Uczniowskie**, nazwa `6 kyu`, adres `6-kyu` | Podgląd adresu: `/program-nauczania/uczniowskie/6-kyu`. Pod polem miejsca uwaga, że to poziom najgłębszy — wejdzie do menu jako wcięta pozycja mniejszym pismem (zmiana z 08.09: wcześniej wchodził poza menu) |
| B6 | Przy „6 kyu" kliknij **Ukryj**, potem **Opublikuj** | Plakietka „ukryta" pojawia się i znika. Komunikaty wyskakują w **prawym dolnym rogu** i gasną same |
| B7 | Przy „6 kyu" kliknij **Pokaż w menu** | **Ma odmówić** komunikatem o trzecim poziomie i kafelkach. To nie błąd — menu na górze mieści dwa poziomy |
| B8 | Otwórz w drugiej karcie `/program-nauczania/uczniowskie/6-kyu` | Strona działa (na razie pusta — nie ma treści) |
| B9 | Wróć do drzewa, przy „6 kyu" kliknij **Edytuj** | Otwiera się edytor: nadkreślenie, tytuł, wstęp, etykieta w menu, adres i **Treść**. U góry **przyklejony pasek** z powrotem, przyciskiem „Zapisz" i — bo strona jest opublikowana — przyciskiem **„Zobacz zapisaną wersję ↗"**. Na dole **nie ma** już drugiego „Zapisz" |
| B9a | Zmień coś w tytule, nie zapisuj, kliknij „← Strony i menu" | Pyta, czy wyjść z niezapisanymi zmianami. Plakietka **„Niezapisane zmiany"** świeci w pasku od pierwszego znaku |
| B10 | Dodaj kilka elementów treści, wpisz wstęp, **Zapisz** | Komunikat „Zapisane." w prawym dolnym rogu, gaśnie sam. Plakietka niezapisanych zmian znika |
| B10a | W nagłówku któregoś elementu kliknij **„+ Wstaw tutaj"**, wybierz „Tekst" | Nowy akapit staje **pod tym elementem**, nie na końcu listy |
| B10b | W palecie elementów poszukaj **„Numer konta"** i **„Dane kontaktowe"** | Są na liście. Wstaw „Numer konta", zapisz i otwórz stronę — sekcja z numerem konta **widać** (dotąd zapisywała się, a na stronie nie było nic) |
| B11 | Odśwież `/program-nauczania/uczniowskie/6-kyu` | Widać wstęp i treść |
| B12 | W drzewie kliknij przy „6 kyu" strzałkę **←** (wysuń) | Adres zmienia się na `/program-nauczania/6-kyu`, a pozycja staje **zaraz pod** „Uczniowskie", nie na końcu listy |
| B13 | Wpisz stary adres `/program-nauczania/uczniowskie/6-kyu` | Przerzuca na nowy — **przekierowanie zrobiło się samo** |
| B14 | Kliknij **→** (wsuń), żeby wrócić pod „Uczniowskie" | Adres wraca do trzypoziomowego |
| B14a | Poklikaj ↑ ↓ → ← po kilka razy z rzędu na różnych pozycjach | Za **każdym** razem lista rusza się zgodnie z komunikatem. Nie ma „Przesunięte niżej." bez efektu ani odmowy „nad tą pozycją nie ma innej", gdy coś nad nią wyraźnie jest |
| B15 | Przy „Uczniowskie" kliknij **Usuń** | Okno **wymienia z nazwy**, że razem z nią do kosza pójdzie „6 kyu" |
| B16 | Potwierdź, zjedź do sekcji **Kosz** | Obie pozycje są w koszu |
| B17 | Spróbuj przywrócić najpierw **6 kyu** | **Ma odmówić**: strona nadrzędna też jest w koszu |
| B18 | Przywróć **Uczniowskie**, potem **6 kyu** | Obie wracają do drzewa, adresy jak przed usunięciem |
| B19 | Usuń obie na dobre (**Usuń** → **Usuń na zawsze** w koszu) | Znikają; `/program-nauczania/uczniowskie` daje 404 |

### Zamiana rodzaju pozycji (nowe — etap E)

| # | Co zrobić | Co ma się stać |
|---|---|---|
| B23 | Przy **ZAJĘCIA** kliknij **Zamień na stronę**, w okienku zostaw adres `zajecia` | Dialog **wylicza skutki**: że dostanie adres `/zajecia`, że `/faq` zmieni się na `/zajecia/faq` i zacznie przekierowywać, oraz że Grupa dorosła, dziecięca i Cennik **zostaną bez zmian**. Na razie kliknij **Anuluj** |
| B24 | Sprawdź, że ZAJĘCIA są nadal nagłówkiem | Tak — anulowanie niczego nie zapisało |
| B25 | Dodaj stronę `Proba` (adres `proba`) na najwyższym poziomie, a pod nią podstronę `Wnetrze` (adres `wnetrze`) | Obie w drzewie, adresy `/proba` i `/proba/wnetrze` |
| B26 | Przy „Proba" kliknij **Zamień na nagłówek**, przeczytaj dialog, potwierdź | Dialog mówi, że adres `/proba` **zostaje przy Probie**, przestaje otwierać treść i zacznie przerzucać na „Wnetrze", oraz że adres podstrony **nie zmieni się**. Po zapisie „Proba" jest nagłówkiem, ale adres ma dalej |
| B27 | Wejdź na `/proba` | **Przerzuca na `/proba/wnetrze`** (308). Zaindeksowany adres nie umiera — ale też nie udaje, że jest stroną |
| B28 | Wejdź na `/proba/wnetrze` | Otwiera się normalnie, kod 200. Adres podstrony **nie ruszył się ani o znak** — to jest cała zmiana z trzeciej rundy |
| B29 | Przy „Proba" (już nagłówek) kliknij **Zamień na stronę** | **Nie pyta o adres** — ma go zapisany. Wraca jako strona pod `/proba`, „Wnetrze" dalej pod `/proba/wnetrze`, a dialog wypisuje, że zniknie przekierowanie |
| B30 | Usuń „Proba" razem z podstroną (kosz → Usuń na zawsze) | Sprzątnięte |

### Rzeczy, które **mają** się nie udać

| # | Co zrobić | Co ma się stać |
|---|---|---|
| B20 | Spróbuj dodać stronę na najwyższym poziomie o adresie `galeria` | Odmowa: adres zajęty przez stałą część serwisu |
| B21 | Spróbuj dodać stronę o adresie `Moja Strona` (wielkie litery, spacja) | Odmowa z wyjaśnieniem, jak adres ma wyglądać |
| B22 | Spróbuj dodać stronę na najwyższym poziomie o adresie `cennik` | Odmowa — pod tym adresem prowadzi dziś przekierowanie |
| B31 | Utwórz stronę `Sierotka` (adres `sierotka`) **bez** podstron i kliknij przy niej **Zamień na nagłówek** | **Odmowa**: nie ma podstrony, która przejęłaby adres — zamiana skasowałaby go bez śladu |
| B32 | Dodaj „Sierotce" **dwie** podstrony i spróbuj ponownie | **Przechodzi** (odmowa zdjęta 08.09). Dialog wypisuje, że obie podstrony zostają pod swoimi adresami, a adres „Sierotki" zacznie przerzucać na pierwszą z nich |
| B33 | Popatrz na pozycję z plakietką **stała część serwisu** (np. Cennik) | Przycisku „Zamień na…" **w ogóle nie ma** — baza takiej zamiany nie przepuści, a przycisk, który zawsze odmawia, jest gorszy od jego braku |

---

## C. Panel — reszta

| # | Co zrobić | Co ma się stać |
|---|---|---|
| C1 | Popatrz na menu panelu po lewej | Zakładki **„Strony"** już **nie ma** — została jedna: „Strony i menu". To była Twoja uwaga „są 2 zakładki, bez sensu" |
| C2 | W drzewie znajdź **Cennik** i kliknij **Edytuj** | Jeden ekran z **dwiema** kartami: „Nagłówek strony" (nazwa w menu i w drzewie) oraz **„Treść strony"** — nadkreślenie, tytuł na stronie, wprowadzenie i elementy treści. Ramka u góry wyjaśnia, że układ jest stały, a adresu stąd nie zmienisz |
| C2a | Zmień „Wprowadzenie pod tytułem", zapisz, otwórz `/zajecia/cennik` | Zmiana widoczna na stronie. Plakietka „Niezapisane zmiany" łapie też edycję **treści**, nie tylko nazwy w drzewie |
| C2b | Porównaj z edytorem zwykłej podstrony (B9) | Ten sam pasek, ten sam podgląd, ta sama paleta z „+ Wstaw tutaj". **Jedno wejście do wszystkiego** |
| C2c | Zwróć uwagę na dwa pola o podobnej nazwie | „Nazwa" w górnej karcie to etykieta w menu i w drzewie; **„Tytuł NA STRONIE"** w dolnej to duży nagłówek, który widzi odwiedzający. Sprawdź, czy etykiety mówią to dość jasno |
| C3 | Zakładka **Dostęp do panelu** | Lista kont; przy Twoim „to Ty". Konta bez uprawnień mają czerwoną plakietkę **bez dostępu do panelu** |
| C4 | Spróbuj odebrać dostęp samemu sobie | Nie ma takiego przycisku przy własnym koncie |
| C5 | Sprawdź, że w menu po lewej **nie ma** już zakładki „Menu na górze strony" | Zgadza się — menu edytuje się w „Strony i menu" |
| C6 | Zakładki Aktualności, Zdjęcia, Pliki, Grafik, Wiadomości, Stopka, Dane organizacji | Otwierają się i działają jak dotąd |

---

## D. Czego ta migracja **nie** zmieniła — warto potwierdzić

| # | Co sprawdzić |
|---|---|
| D1 | Aktualności: `/aktualnosci` i wejście w wpis — bez zmian |
| D2 | Galeria: `/galeria`, albumy się rozwijają |
| D3 | Formularz kontaktowy na `/kontakt` i na stronach zajęć — wysyła się |
| D4 | Grafik zajęć na `/zajecia/dorosli` |
| D5 | Pliki do pobrania w stopce (`/downloads/statut-posk.pdf`) — otwierają się |

---

## Co zapisać

Przy każdym punkcie, który **nie** zachował się jak w kolumnie obok:

- numer punktu,
- co zobaczyłeś zamiast tego,
- zrzut ekranu, jeśli to coś wizualnego.

Nie trzeba niczego naprawiać ani cofać — poligon jest do wyrzucenia.

---

## Czego jeszcze NIE ma (świadomie, nie do zgłaszania)

- **Przeciągania myszą** w drzewie. Są przyciski ↑ ↓ → ←; robią to samo,
  działają z klawiatury i na telefonie.
- **Ekranu historii wersji.** Migawki zapisują się przy każdej zmianie, ale nie
  ma jeszcze ekranu, na którym dałoby się je obejrzeć i przywrócić.
- **Przestawiania sekcji** na ośmiu stronach o stałym układzie (formularz, mapa,
  grafik, kafelki). Treść tych stron edytujesz już z „Strony i menu", ale
  kolejności tych czterech rzeczy stąd nie zmienisz — to osobna praca (etap F2).
- **Ekranu przekierowań.** Stare adresy dalej działają i dopisują się same, ale
  listy, na której dałoby się je obejrzeć albo skasować, w panelu nie ma.
  Jeden przypadek, w którym była potrzebna — powrót nagłówka na stary adres —
  panel załatwia dziś sam (punkt F13).
- Zmiany adresu przy stronach z plakietką *stała część serwisu* — ich adresy
  siedzą w plikach tras.

## Po checkliście — co się dzieje z produkcją

Nic się nie dzieje samo. Przełączenie produkcji to osobna, świadoma operacja:
zrzut bazy, wklejenie dwóch plików SQL w SQL Editorze, uruchomienie dwóch
skryptów migracji, wypchnięcie gałęzi i deploy. Do tego czasu produkcja stoi
na starym kodzie i starych tabelach.

---

## E. Uwagi klienta z 07.09.2026

| # | Co zrobić | Co ma się stać |
|---|---|---|
| E1 | Panel → **Zdjęcia**, strefa „Zdjęcia użyte na podstronach" | **Sześć** kafelków (było dziesięć): AKTUALNOŚCI, O SHORINJI KEMPO, ZAJĘCIA, PROGRAM NAUCZANIA, ORGANIZACJA, BUDDYZM. Jeden na sekcję menu, nie na podstronę |
| E2 | Popatrz na kafelek **BUDDYZM** | Liczy zdjęcia z **całej sekcji** — te wgrane pierwotnie pod różne podstrony są teraz razem. Nie „pusta" |
| E3 | Poszukaj krzyżyka „usuń" na kafelku sekcji | **Nie ma go** — to nie albumy galerii, są powiązane z treścią stron |
| E4 | Zmień nazwę sekcji: „Strony i menu" → etykieta w menu → wróć do Zdjęć | Nazwa kafelka **idzie za etykietą w menu**. To była uwaga „nie widzę możliwości zmiany ich nazw" |
| E5 | Strefa „Galeria na stronie" → **+ Nowa zakładka**, dowolna nazwa | Nowy album jest **PIERWSZY** na liście, nie w kolejności alfabetycznej. Pozostałe nie zmieniają miejsc |
| E6 | Otwórz `/galeria` | Nowy album też jest **pierwszy** i widać go **od razu**, bez czekania na wdrożenie |
| E7 | Wejdź w kafelek **AKTUALNOŚCI** (nie miał folderu w Cloudinary) i wgraj zdjęcie | Wgrywa się; folder powstaje sam. To odpowiedź na „jak dodawać zdjęcia na podstrony, dla których nie ma foldera" |
| E8 | Otwórz `/program-nauczania` | **Osiem kafelków** podstron: Stopnie i wymagania, Podstawowe formy, Filozofia Kaiso, Teoria i filozofia, Biblioteka, Seminaria i szkolenia, Kursy specjalistyczne, Trening z przyrządami |
| E9 | Kliknij którykolwiek | Otwiera się (kod 200) z tytułem. **Wstęp jest pusty** — opisy klienta nie były w pliku z uwagami, trzeba je wkleić |
| E10 | Rozwiń w menu **PROGRAM NAUCZANIA** | Osiem podstron w rozwijanej liście |

**Do uzupełnienia po tej sekcji:** krótkie opisy (wstępy) ośmiu podstron Programu nauczania.
Klient pisze, że je napisał, ale w pliku `Uwagi_07.09.2026.txt` ich nie ma — świadomie
nie zostały wymyślone.

---

## F. Poprawki z drugiej rundy checklisty (08.09.2026)

Punkty z Twojego zgłoszenia po pierwszym przejściu. Klikać w tej kolejności —
kilka z nich zmienia stan drzewa i następne na tym stoją.

> **Wersja do klikania (40 punktów, z zapisem odpowiedzi):**
> <https://claude.ai/code/artifact/b7587a36-d9e4-4a4c-a5db-3d8e6b25b33e>
> Ma to samo, co poniżej, plus grupę regresji („czy przy okazji nic nie zniknęło”).
> Ten plik zostaje jako wersja tekstowa — do czytania, gdy nie ma dostępu do sieci.

### F. Panel „Strony i menu"

| # | Co zrobić | Co ma się stać |
|---|---|---|
| F1 | Otwórz **Strony i menu** | Podstrony leżą **wewnątrz kart** rodziców, na szarym tle. Nie jest to już jedna płaska lista z wcięciem |
| F2 | Przesuń cokolwiek ↑ ↓ ← → | Ekran **nie skacze do góry**, kursor zostaje tam, gdzie był. To była uwaga „myszka ląduje u góry" |
| F3 | Pod dowolną kartą kliknij **+ Podstrona** | Ekran przewija się do formularza, a „Miejsce w drzewie" ma **już wybraną** tę pozycję |
| F4 | W polu **Nazwa** wpisz „Coś Tam” | Adres uzupełnia się sam na `cos-tam`, w trakcie pisania. Polskie znaki zamienione (ą→a, ł→l) |
| F5 | Popraw adres ręcznie na `inny-adres`, dopisz coś w nazwie | Adres **przestaje** się podpowiadać — od pierwszej ręcznej zmiany należy do Ciebie |
| F6 | Dodaj tę stronę i sprawdź podpowiedź pod „Miejsce w drzewie" na trzecim poziomie | Nie ma już ostrzeżenia o „poza rozwijanym menu". Trzeci poziom wchodzi do menu normalnie |
| F7 | Weź podstronę drugiego poziomu i kliknij **→** (wsuń) | Wsuwa się na trzeci poziom **bez** wcześniejszego ukrywania. Wcześniej trzeba było ją najpierw ukryć |
| F8 | Rozwiń tę sekcję w menu na stronie | Trzeci poziom widać: wcięty, mniejszym pismem, przy pionowej kresce |
| F9 | Na telefonie (~390 px) rozwiń **ZAJĘCIA** | Napis **ZAJĘCIA nie jest wyszarzony** — ten sam kolor co sąsiednie pozycje |
| F10 | Wejdź na stronę trzeciego poziomu | Podświetla się i jej rodzic w rozwijanej liście, i sekcja na górze |

### F. Zamiana strony w nagłówek

| # | Co zrobić | Co ma się stać |
|---|---|---|
| F11 | Weź stronę, która ma **kilka** podstron, i kliknij **Zamień na nagłówek** | Dialog wypisuje, że **żaden adres podstrony się nie zmieni**, a adres samej strony zacznie przerzucać na pierwszą podstronę. Nie ma odmowy „ma kilka podstron treściowych" |
| F12 | Zatwierdź | Wszystkie podstrony zostają pod swoimi adresami. Wpisz adres zamienionej strony — przerzuca na pierwszą podstronę |
| F13 | Ten sam nagłówek → **Zamień na stronę** | Da się i **nie pyta o adres**. Dialog dopisuje linijkę „ZNIKNĄ przekierowania" — bo adres znów jest prawdziwą stroną |

### F. Aktualności i numer konta

| # | Co zrobić | Co ma się stać |
|---|---|---|
| F14 | Panel → **Aktualności** | Lista artykułów **nie jest pusta**. To był powód „nie ok" w C6 i D1 — panel czytał tabelę kluczem, który jej nie widzi |
| F15 | Otwórz `/aktualnosci` | Jedna aktualność = **jeden wiersz** na całą szerokość, zdjęcie po lewej. Najnowsza na górze |
| F16 | Panel → **Dane organizacji** → „Numer konta do wpłat" | Jest pole **„Zdanie o tytule przelewu"**. Zmień je, zapisz, otwórz `/zajecia/cennik` — zmiana widoczna pod numerem konta |
| F17 | Wyczyść to pole i zapisz | Zdanie znika ze strony w całości, sam numer konta zostaje |

### F. Galeria

| # | Co zrobić | Co ma się stać |
|---|---|---|
| F18 | Panel → **Zdjęcia** → usuń album z „Galeria na stronie" | Album znika, a komunikat mówi o **sukcesie**. Wcześniej pokazywał „Nie udało się usunąć zakładki", choć album był usunięty |

---

## G. Poprawki z trzeciej rundy checklisty (09.09.2026)

Trzy zgłoszenia z rundy trzeciej plus wygląd zakładki. Wynik rundy: 35 × ok,
3 × nie ok (A6, D1, E3), dwa punkty nieklikane (D2, D3 — do przeklikania tutaj).

> **Czwarta runda klikania (12.09.2026) — 17 punktów, z zapisem odpowiedzi:**
> <https://claude.ai/code/artifact/99b915c5-6ecf-4a73-ba3b-c95322aa86a0>
> Decyzją właściciela wchodzi tam TYLKO to, czego nie ocenia maszyna: wygląd
> zakładki (G20–G25), zwijanie (G31–G36) i treść dialogów przy zamianie
> rodzaju (G13, G16–G19). Reszta grupy G — zapis aktualności, ukrywanie po
> gałęzi, niezmienność adresów — zostaje przy testach odbioru
> (`test-aktualnosci-zapis.mjs`, `test-ukrywanie-galezi.mjs`,
> `test-zamiana-rodzaju.mjs`), bo czytają stan bazy i kody odpowiedzi,
> a nie komunikaty w panelu.

### G. Aktualności — zapis (było E3)

To zgłoszenie okazało się dużo większe od objawu. Tabela `articles` ma włączone
RLS bez ani jednej polityki, a panel pisał do niej kluczem sesyjnym. Tworzenie
artykułu **odmawiało z komunikatem** — i to zobaczyłeś — ale zapis zmian, kosz,
przywracanie i kasowanie na stałe kończyły się napisem „Zapisano" i **nie
robiły nic**. Zmierzone końcem-do-końca: tytuł przed zapisem i po zapisie ten sam.

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G1 | Panel → Aktualności → **+ Nowy artykuł**, wpisz tytuł, zapisz | Tworzy się. Żadnego „nie ma uprawnień" |
| G2 | Otwórz istniejący artykuł, zmień tytuł, **Zapisz zmiany**, odśwież stronę (F5) | Nowy tytuł **został**. Wcześniej wracał stary, mimo komunikatu o sukcesie |
| G3 | W artykule zmień **adres (slug)** i zapisz, potem wpisz z palca **stary** adres `/aktualnosci/<stary>` | Przerzuca na nowy. Wcześniej stary adres umierał na 404 |
| G4 | W artykule kliknij **Usuń** | Pyta o **przeniesienie do kosza** i mówi o 30 dniach — nie o „operacji, której nie można cofnąć". Artykuł znika z listy i ze strony |
| G5 | Kosz aktualności → **Przywróć** | Wraca na listę i na stronę. Wcześniej kosz „działał" i nie robił nic |
| G6 | Kosz → **Usuń na stałe** | Znika naprawdę |

### G. Ukrywanie po gałęzi (było A6)

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G7 | Weź podstronę **2. poziomu, która ma pod sobą podstronę**, i kliknij **Ukryj** | Przy tej **pod nią** pojawia się plakietka **„niewidoczna — rodzic ukryty"**. To było dokładnie Twoje zgłoszenie |
| G8 | Wpisz z palca adres tej **ukrytej wnuczki** | **404.** Wcześniej oddawała 200 — czyli „ukryta" gałąź zostawiała w serwisie żywe, zaindeksowane strony |
| G9 | Popatrz na menu na stronie klubu | Ani rodzica, ani wnuczki. Bez zmian względem poprzedniej rundy |
| G10 | Wróć do panelu i kliknij przy rodzicu **Opublikuj** | Wraca **cała gałąź**, razem z wnuczką — bez klikania czegokolwiek na niej. Jej własne ustawienia nie były ruszane |
| G11 | Sprawdź plakietki na wnuczce po odkryciu | Plakietka o rodzicu znika. Wnuczka **nie ma** plakietki „ukryta" — bo sama ukryta nigdy nie była |

### G. Nagłówek zatrzymuje adres (było D1)

Twoja uwaga: „imo powinno zostać w takim przypadku `ucz` w adresie, czemu nie,
czytelniej". Wdrożone. Nagłówek działa teraz jak folder: trzyma swój adres
i wnosi go do adresów podstron. **Żadna podstrona nie zmienia adresu przy
zamianie.** Zmienia się jedna rzecz — pod adresem nagłówka nie ma już treści,
więc ten adres zaczyna przerzucać na pierwszą podstronę.

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G12 | Zrób stronę `Ucz` (adres `ucz`) pod „Program nauczania", a pod nią dwie podstrony `WW` i `J` | Adresy `/program-nauczania/ucz`, `/program-nauczania/ucz/ww`, `/program-nauczania/ucz/j` |
| G13 | Przy „Ucz" kliknij **Zamień na nagłówek** i przeczytaj dialog | Dialog mówi: adres zostaje przy „Ucz", przestanie otwierać treść i zacznie przerzucać na „WW". Pod spodem lista **BEZ ZMIAN** z obiema podstronami |
| G14 | Zatwierdź i sprawdź adresy obu podstron | `/program-nauczania/ucz/ww` i `/program-nauczania/ucz/j` — **co do znaku te same**. To jest sedno tej zmiany |
| G15 | Wejdź na `/program-nauczania/ucz` | Przerzuca (308) na `/program-nauczania/ucz/ww` |
| G16 | Przy „Ucz" (już nagłówek) kliknij **Zamień na stronę** | **Nie pyta o adres.** Wraca jako strona pod tym samym adresem, obie podstrony bez zmian, dialog wypisuje znikające przekierowanie |
| G17 | Edytuj **ZAJĘCIA** (nagłówek założony jako nagłówek) | W edycji jest pole **„Adres — nieobowiązkowy"**, puste. Puste znaczy: nagłówek tylko grupuje i do adresów nie wnosi nic — dlatego FAQ dalej stoi pod `/faq` |
| G18 | Dodaj nową pozycję rodzaju **Nagłówek** i zostaw adres pusty | Wchodzi. Podgląd nad przyciskiem mówi „(bez adresu — nagłówek tylko grupuje)" |
| G19 | Strona **bez** podstron → **Zamień na nagłówek** | Dalej odmowa, ale z nowym uzasadnieniem: nie ma dokąd przerzucić adresu |

### G. Wygląd zakładki „Strony i menu"

Twoja uwaga: „bardziej to rozdzielić, większe wcięcia, większy kontrast, nie
musi to być tak do porzygu białe, masz dużo miejsca a bardzo ciasno to robisz".

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G20 | Otwórz **Strony i menu** na dużym ekranie | Kolumna treści jest **szersza** (~1150–1280 px zamiast ~800). Przyciski stoją **w jednej linii z nazwą**, nie pod nią |
| G21 | Popatrz na zagnieżdżenie | Podstrona jest **wyraźnie wcięta**, przy pionowej prowadnicy, na **ciemniejszym** tle niż karta rodzica. Każdy poziom ma inne tło i inną wagę pisma |
| G22 | Popatrz na kolumnę rodzaju po lewej | „STRONA / NAGŁÓWEK / ODNOŚNIK" to teraz **kolorowe plakietki**, nie ledwo widoczny szary napis |
| G23 | Policz pasy „+ Podstrona" | Jest **jeden wąski** na dole każdej karty, nie osobny gruby pas pod każdą pozycją. Zakładka jest przez to sporo krótsza |
| G24 | Zwęź okno do ~1100 px | Przyciski **wracają do własnej linii** i dalej trzymają równy pion. Nic nie wystaje poza kolumnę |
| G25 | Obejrzyj inne zakładki panelu (Aktualności, Dane organizacji, Stopka) | Też są szersze i nic się nie rozjechało |

### G. Sekcje osobno i zwijanie (zgłoszenie z 09.09 po południu)

Twoja uwaga: „po co ten jeden wielki zgrupowany div? lepiej żeby był widoczny
odstęp pomiędzy elementami 1 stopnia nav oraz większy odstęp i by można było
zwijać i rozwijać, wtedy to ładnie wygląda".

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G31 | Otwórz **Strony i menu** i popatrz na całość | Sekcje menu głównego stoją **osobno**, każda jako własna karta z odstępem. Nie ma jednej wielkiej szarej ramki wokół wszystkiego |
| G32 | Kliknij **strzałkę** przy lewej krawędzi karty, która ma podstrony | Podstrony się schowały, a przy nazwie pojawiła się plakietka **„6 podstron"** — widzisz, ile jest w środku, nie zgadujesz |
| G33 | Kliknij tę samą strzałkę jeszcze raz | Podstrony wracają. Pozycja bez podstron **nie ma** strzałki — nie ma tam czego zwijać |
| G34 | **Zwiń wszystkie** (przycisk nad drzewem) | Całe drzewo schodzi do listy samych sekcji — mieści się na jednym ekranie. Napis zmienia się na **Rozwiń wszystkie** |
| G35 | Zwiń jedną sekcję i naciśnij **F5** | Po odświeżeniu jest **nadal zwinięta** — i tylko ona. Przeglądarka pamięta Twój układ |
| G36 | Zwiń coś, potem przesuń pozycję strzałką ↑ | Zwinięcie **zostaje** — zapis nie rozwija drzewa z powrotem |

### G. Regresja — czy przy okazji nic nie zniknęło

| # | Co zrobić | Co ma się stać |
|---|---|---|
| G26 | Menu na górze strony | Siedem sekcji, trzeci poziom dalej widać. ZAJĘCIA nie są wyszarzone na telefonie |
| G27 | `/faq` | Otwiera się pod `/faq`, bez zmian. **To jest kontrola, że nagłówek bez adresu dalej jest przezroczysty** |
| G28 | `/istota-budo` i `/cennik` | Przerzucają na `/o-shorinji/istota-budo` i `/zajecia/cennik` |
| G29 | `/aktualnosci`, `/galeria`, `/kontakt` | Bez zmian |
| G30 | `/nie-ma-takiej-strony` | Własna, polska strona 404 |
