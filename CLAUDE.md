# Shorinji Kempo Kraków — strona klubu

Next.js 16 (App Router) + Supabase + Cloudinary, wdrażane z `master` na Netlify.
Redaktorem jest instruktor bez zaplecza technicznego — panel `/admin` jest dla niego,
nie dla programisty.

**Pełny kontekst: [`docs/przekazanie-sesji.md`](docs/przekazanie-sesji.md).**
Architektura menu: [`docs/menu-architektura.md`](docs/menu-architektura.md).

## Zasada naczelna

Każda treść widoczna na stronie ma być edytowalna z panelu i trzymana w bazie —
łącznie z etykietami pól, nazwami dni i nagłówkami kolumn stopki. Tekst wpisany
na stałe w komponencie to błąd do naprawienia, nie stan docelowy.

Komentarze i komunikaty piszemy po polsku. Komentarz tłumaczy **dlaczego**, nie co —
najlepiej przez opis awarii, której zapobiega.

## Pułapki, w które już wpadliśmy

**Tailwind v4 skanuje cały projekt, razem z `docs/`.** Ciąg `\1608be` w ścieżce
Windows został odczytany jako escape CSS i wywalił wszystkie trasy na 500. Dlatego
`app/globals.css` ma `source(none)` i jawne `@source "../app"` / `"../components"`.
Nowy katalog z kodem trzeba tam dopisać.

**Kolejność wdrożeń przy migracji danych.** Jeśli dane wymagają nowego kodu — najpierw
wdróż kod. Jeśli kod wymaga danych (np. `PageHeader` zwraca `null` bez wiersza) — najpierw
zasiej dane. Odwrotna kolejność zabrała numer konta z produkcji na kilka minut.

**PostgREST nie wykona DDL.** `CREATE TABLE`, `ALTER`, polityki RLS — tylko przez SQL
Editor w Supabase, ręcznie przez właściciela. Skrypty w `supabase/*.sql` mają być
idempotentne, bo bywają puszczane po raz drugi.

**Netlify filtruje zmienne środowiskowe kontekstem.** Klucz potrafi „nie istnieć",
bo widok stoi na „Local development". Zanim orzekniesz, że zmiennej brak — sprawdź filtr.

**Plik z `"use server"` eksportuje wyłącznie funkcje async.** Stałe i typy idą do
osobnego modułu w `lib/`.

**Tailwind steruje obrotem przez własność CSS `rotate`, nie `transform`.** Nadpisywanie
`transform` nic nie zmieni.

**`| head` przejmuje kod wyjścia.** `npm run build | head -20 && echo OK` wypisze OK
przy zepsutym buildzie. Używaj `; echo $?`.

## Testowanie

Nie ma frameworka testowego. Weryfikujemy empirycznie: build, potem `curl` na
uruchomiony serwer i sprawdzanie konkretnych fragmentów HTML.

**Asercje muszą być precyzyjne.** Szukanie `771` w całym HTML trafiło we współrzędne
ścieżki SVG, a `youtube` — w nazwę odnośnika w stopce. Zawężaj do elementu, o który
naprawdę chodzi, i sprawdzaj, czy test nie przechodzi także przed poprawką.

## Praca z repozytorium

Commity granularne, wprost na `master`, opis po polsku bez polskich znaków w tytule.
Push po akceptacji właściciela. Przed zmianą schematu bazy zrób zrzut stanu do
porównania po migracji.

Research zlecaj Sonnetem — Opus zjada limit właściciela.
