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
| B4 | Dodaj stronę: rodzaj *Strona*, miejsce **PROGRAM NAUCZANIA**, nazwa `Uczniowskie`, adres `uczniowskie` | Pod polem widać na żywo `/program-nauczania/uczniowskie`. Po kliknięciu „Dodaj" pojawia się w drzewie z plakietkami **ukryta** i **poza menu** |
| B5 | Dodaj drugą: miejsce **Uczniowskie**, nazwa `6 kyu`, adres `6-kyu` | Podgląd adresu: `/program-nauczania/uczniowskie/6-kyu` — trzeci poziom |
| B6 | Przy „6 kyu" kliknij **Opublikuj** | Plakietka „ukryta" znika |
| B7 | Przy „6 kyu" kliknij **Pokaż w menu** | **Ma odmówić** komunikatem o trzecim poziomie i kafelkach. To nie błąd — menu na górze mieści dwa poziomy |
| B8 | Otwórz w drugiej karcie `/program-nauczania/uczniowskie/6-kyu` | Strona działa (na razie pusta — nie ma treści) |
| B9 | Wróć do drzewa, przy „6 kyu" kliknij **Edytuj** | Otwiera się edytor: nadkreślenie, tytuł, wstęp, etykieta w menu, adres i **Treść** |
| B10 | Dodaj kilka elementów treści, wpisz wstęp, **Zapisz** | Komunikat „Zapisane." |
| B11 | Odśwież `/program-nauczania/uczniowskie/6-kyu` | Widać wstęp i treść |
| B12 | W drzewie kliknij przy „6 kyu" strzałkę **←** (wysuń) | Adres zmienia się na `/program-nauczania/6-kyu` |
| B13 | Wpisz stary adres `/program-nauczania/uczniowskie/6-kyu` | Przerzuca na nowy — **przekierowanie zrobiło się samo** |
| B14 | Kliknij **→** (wsuń), żeby wrócić pod „Uczniowskie" | Adres wraca do trzypoziomowego |
| B15 | Przy „Uczniowskie" kliknij **Usuń** | Okno **wymienia z nazwy**, że razem z nią do kosza pójdzie „6 kyu" |
| B16 | Potwierdź, zjedź do sekcji **Kosz** | Obie pozycje są w koszu |
| B17 | Spróbuj przywrócić najpierw **6 kyu** | **Ma odmówić**: strona nadrzędna też jest w koszu |
| B18 | Przywróć **Uczniowskie**, potem **6 kyu** | Obie wracają do drzewa, adresy jak przed usunięciem |
| B19 | Usuń obie na dobre (**Usuń** → **Usuń na zawsze** w koszu) | Znikają; `/program-nauczania/uczniowskie` daje 404 |

### Rzeczy, które **mają** się nie udać

| # | Co zrobić | Co ma się stać |
|---|---|---|
| B20 | Spróbuj dodać stronę na najwyższym poziomie o adresie `galeria` | Odmowa: adres zajęty przez stałą część serwisu |
| B21 | Spróbuj dodać stronę o adresie `Moja Strona` (wielkie litery, spacja) | Odmowa z wyjaśnieniem, jak adres ma wyglądać |
| B22 | Spróbuj dodać stronę na najwyższym poziomie o adresie `cennik` | Odmowa — pod tym adresem prowadzi dziś przekierowanie |

---

## C. Panel — reszta

| # | Co zrobić | Co ma się stać |
|---|---|---|
| C1 | Zakładka **Strony o stałym układzie** | Osiem pozycji (Strona główna, Aktualności, Galeria, Cennik, Program nauczania, Kontakt, Zajęcia dorośli, Zajęcia dzieci) i ramka odsyłająca do „Strony i menu" |
| C2 | Wejdź w **Cennik**, zmień coś w treści, zapisz, otwórz `/zajecia/cennik` | Zmiana widoczna |
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
  grafik, kafelki). To osobna praca — etap 9.
- Zmiany adresu przy stronach z plakietką *stała część serwisu* — ich adresy
  siedzą w plikach tras.

## Po checkliście — co się dzieje z produkcją

Nic się nie dzieje samo. Przełączenie produkcji to osobna, świadoma operacja:
zrzut bazy, wklejenie dwóch plików SQL w SQL Editorze, uruchomienie dwóch
skryptów migracji, wypchnięcie gałęzi i deploy. Do tego czasu produkcja stoi
na starym kodzie i starych tabelach.
