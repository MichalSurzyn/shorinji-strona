## AUDYT DOKUMENTU — WYNIKI

Sprawdzono cały kod w `G:\Workspace\Kempo`. Poniżej problemy uporządkowane od najgroźniejszych. Na końcu lista twierdzeń, które wytrzymały weryfikację, oraz błędy w samym audycie (bloki A/B).

---

## I. KRYTYCZNE — blokują publikację

### 1. „Wiadomości czytają osoby zalogowane do panelu" — panel może nie mieć żadnej listy uprawnionych

**Cytat (pkt 2):** „Wiadomości czytają osoby zalogowane do panelu administracyjnego strony." **Cytat (pkt 13):** „Panel administracyjny wymaga zalogowania".

**Błąd:** `requireUser()` w `lib/supabase/server.ts:40-46` sprawdza wyłącznie, czy istnieje *jakikolwiek* użytkownik Supabase Auth — nie ma allowlisty, roli ani sprawdzenia domeny. Nie ma też `middleware.ts` (brak w repo). Klucz `NEXT_PUBLIC_SUPABASE_ANON_KEY` trafia do bundla przeglądarki (potwierdza to sam komentarz w `supabase/setup.sql:39-40`). Jeżeli w projekcie Supabase jest włączona domyślna rejestracja e-mailem, **dowolna osoba z internetu może założyć sobie konto tym publicznym kluczem i stać się administratorem** — z dostępem do wszystkich wiadomości (w tym od rodziców o dzieciach), do listy kont (`actions/userActions.ts:14-30`), do zakładania i usuwania kont (`:32-61`) oraz do zdjęć.

**Poprawka:** przed publikacją zweryfikować w panelu Supabase, czy „Enable email signup" jest wyłączone, i niezależnie od tego dodać w `requireUser()` sprawdzenie allowlisty (tabela `admins` albo `user_metadata.role`). Do czasu naprawy zdanie z pkt 13 jest nieprawdziwe.

### 2. Dokument opisuje kod, który być może nie stoi pod shorinjikempo.pl

**Cytat:** tytuł „Polityka prywatności serwisu shorinjikempo.pl".

**Dowód:** `README.md` — „Projekt Next.js (App Router) **zastępujący starą stronę z Wix** (https://www.shorinjikempo.pl/)". `lib/site.ts:9-11` — domyślny `SITE_URL` to `https://shorinji-kempo.netlify.app`.

**Błąd:** jeśli pod domeną `shorinjikempo.pl` nadal działa Wix, to **cała sekcja 6 jest fałszywa**. Wix ustawia własne cookies (`svSession`, `hs`, `XSRF-TOKEN`, `bSession`), ma wbudowaną analitykę i ładuje zasoby z `static.parastorage.com`. Opublikowanie pod tą domeną polityki mówiącej „strona nie zakłada Ci żadnych własnych plików cookies" to twierdzenie sprzeczne z tym, co widać w narzędziach deweloperskich w 5 sekund.

**Poprawka:** potwierdzić, pod jakim adresem stoi ten kod. Do czasu przełączenia domeny polityka musi opisywać rzeczywisty serwis.

### 3. Dokument jest jednocześnie donosem na samego siebie

**Cytaty:** „Dzieje się to bez pytania Cię o zgodę i tak być nie powinno." / „Dziś, mówiąc szczerze, za długo." / „Panel nie ma dziś podziału na role, więc każda zalogowana osoba widzi wszystkie wiadomości i może zarządzać kontami. Nie prowadzimy też dziennika operacji... Nie mamy dwuskładnikowego logowania."

**Błąd:** art. 13 RODO **nie wymaga** opisywania środków bezpieczeństwa ani przyznawania się do ich braku. Te zdania robią dwie rzeczy naraz: (a) dają Prezesowi UODO gotowy dowód naruszenia art. 399 PKE i art. 5 ust. 1 lit. e, podpisany przez administratora, (b) publikują mapę słabości systemu przechowującego dane dzieci (art. 32 RODO działa tu przeciw autorowi). Blok C dokumentu sam ostrzega: „Publikacja polityki, która nie odpowiada stanowi faktycznemu, jest gorsza niż jej brak" — ale rozwiązaniem nie jest publikowanie spisu własnych naruszeń, tylko naprawa przed publikacją.

**Poprawka:** naprawić (droga B z bloku A to praca na jeden dzień), a politykę napisać w czasie teraźniejszym opisującym stan **po** naprawie. Braki i harmonogram naprawy przenieść do rejestru czynności przetwarzania i analizy ryzyka — dokumentów wewnętrznych, których się nie publikuje.

---

## II. BŁĘDY FAKTYCZNE — twierdzenia sprzeczne z kodem

### 4. Adres administratora nie zgadza się z adresem na stronie

**Cytat (pkt 1):** „| Adres podany na stronie | ul. Wysłouchów 33/5, 30-611 Kraków |" oraz „adres przy ul. Wysłouchów służy jako adres do korespondencji".

**Dowód:** `lib/site.ts:19-24` — `venue: "Szkoła Podstawowa nr 114"`, `street: "ul. Łąkowa 31"`, `postalCode: "31-443"`. `lib/footerTypes.ts:46-47` — `addressLine1: "ul. Łąkowa 31, Kraków"`. Renderowane w `components/Footer.tsx:110-118` i `components/LocationMap.tsx:51-57`. **Adresu przy ul. Wysłouchów nie ma w serwisie ani razu.**

**Skutek:** pkt 1 i pkt 10 odsyłają po realizację praw „listownie na adres podany wyżej" — na adres, którego adresat nie znajdzie na stronie, podczas gdy mapa prowadzi do szkoły podstawowej (miejsce zajęć, nie siedziba).

**Poprawka:** rozdzielić w tabeli trzy rzeczy: siedzibę z KRS, adres do korespondencji w sprawach danych i miejsce prowadzenia zajęć. Nie nazywać Wysłouchów „adresem podanym na stronie".

### 5. „Wszystkie zdjęcia na stronie pobierają się bezpośrednio z serwerów Cloudinary" — nieprawda dla części zdjęć

**Dowód:** `components/ArticleGallery.tsx:3,42-48,69-72` używa `next/image` **bez własnego loadera**, a `next.config.ts:16-23` deklaruje `images.remotePatterns` dla `res.cloudinary.com`. Przy takiej konfiguracji przeglądarka pobiera `/_next/image?url=https%3A%2F%2Fres.cloudinary.com%2F...` **z naszego serwera**, a dopiero serwer sięga po plik do Cloudinary. Dla tych zdjęć adres IP odwiedzającego do Cloudinary **nie trafia** — trafia do hostingu.

Bezpośrednio do Cloudinary idą natomiast: galeria (`app/galeria/_components/GalleryClient.tsx:99`, `CldImage` ma własny loader) i wszystkie `<img>`: `components/NewsBlocks.tsx:139-141,166-168,292-294,394-396,413-415`, `app/aktualnosci/page.tsx:58-60`, `app/aktualnosci/[slug]/page.tsx:61-63`.

**Poprawka:** „Część zdjęć pobiera się bezpośrednio z Cloudinary, część przez nasz serwer" — albo ujednolicić kod (`ArticleGallery` na `<img src={clUrl(...)}>` jak reszta serwisu).

### 6. „Wszystkie zdjęcia przechowujemy w usłudze Cloudinary" — nieprawda

**Dowód:** `public/SOEN.jpg` (logo, `components/Navbar.tsx:77-78`, `components/StructuredData.tsx:10`), `public/og.png` (`app/layout.tsx:42,53`), `app/icon.jpg`. To pliki statyczne serwowane z hostingu.

**Poprawka:** zawęzić do „zdjęcia publikowane w treści i w galerii".

### 7. „Panel administracyjny... jest wyłączony z indeksowania" — tylko połowa panelu

**Dowód:** `app/admin/(panel)/layout.tsx:6-9` ma `robots: { index: false, follow: false }` — poprawnie. Ale **strona logowania leży poza grupą `(panel)`**: `app/admin/login/page.tsx` nie ma własnych metadanych, więc dziedziczy `robots: { index: true, follow: true }` z `app/layout.tsx:55-58`. Dodatkowo `app/robots.ts:6-9` zwraca `allow: "/"` **bez żadnego `disallow`**.

**Poprawka:** `disallow: ["/admin"]` w `app/robots.ts` + `export const metadata = { robots: { index: false } }` w pliku logowania.

### 8. Opis cookie sesji — dwa przeoczenia

**Cytat (pkt 6):** „cookie sesji o nazwie zaczynającej się od `sb-` i kończącej na `-auth-token`... ma okres ważności 400 dni".

**Dowód:** `node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11` — `path: "/"`, `sameSite: "lax"`, **`httpOnly: false`**, `maxAge: 400*24*60*60`. Okres 400 dni i zakres całego serwisu — zgadza się. Ale: (a) duży token jest dzielony przez chunker `@supabase/ssr` na `...-auth-token.0`, `.1` — opisana nazwa nie zawsze pasuje; (b) ciasteczko **nie jest `httpOnly`**, czyli jest odczytywalne skryptem w przeglądarce, co jest istotne dla oceny środków bezpieczeństwa.

**Poprawka:** dopisać „oraz jego części z sufiksem `.0`, `.1`" i nie sugerować, że to ciasteczko chronione przed odczytem skryptem.

### 9. YouTube: „ładuje się razem z treścią artykułu"

**Dowód:** `components/NewsBlocks.tsx:264-272` — iframe ma `loading="lazy"`, więc ładuje się przy wejściu ramki w pole widzenia, tak samo jak mapa. Adres `https://www.youtube.com/embed/${id}` w linii 266 — zgodny z opisem.

**Dodatkowo pominięte na korzyść stowarzyszenia:** linia 270 ustawia `referrerPolicy="strict-origin-when-cross-origin"`, więc do Google idzie sam origin, a nie pełny adres podstrony. Warto to napisać. Przy mapie jest odwrotnie — `components/LocationMap.tsx:40` ustawia `referrerPolicy="no-referrer-when-downgrade"`, czyli pełny URL faktycznie leci do Google (dokument opisuje to poprawnie). Jednoliniowa poprawka: `referrerPolicy="no-referrer"`.

---

## III. OBIETNICE BEZ POKRYCIA W MECHANIZMIE

### 10. „Kasujemy plik z serwera Cloudinary... kasujemy plik, a nie tylko odnośnik do niego"

**Dowód:** `actions/imageActions.ts:118` — `cloudinary.uploader.destroy(publicId)` **bez `{ invalidate: true }`**. Bez tej flagi przekształcone wersje pliku (a więc dokładnie te, które wisiały na stronie: `f_auto,q_auto,w_1400,c_limit/...`) zostają w cache CDN Cloudinary i pozostają pobieralne pod adresem jeszcze długo po „usunięciu".

**Poprawka:** `destroy(publicId, { invalidate: true, resource_type: "image" })` plus usunięcie derived assets. Bez tego pkt 3 listy w sekcji 4 jest obietnicą nie do dotrzymania.

### 11. „Publikujemy stronę na nowo i czyścimy pamięć podręczną"

**Dowód:** `actions/imageActions.ts:115-126` — `deleteImage` **nie wywołuje `revalidatePath`** (dla porównania robią to `actions/newsActions.ts:17-21`, `actions/pageActions.ts:11-12`, `actions/footerActions.ts:20,33`). Podstrony z galeriami mają ISR: `app/o-shorinji/[slug]/page.tsx:14`, `app/organizacja/[slug]/page.tsx:14`, `app/buddyzm/[slug]/page.tsx:14` → `revalidate = 3600`; aktualności `app/aktualnosci/[slug]/page.tsx:8` → `300`.

**Poprawka:** dodać rewalidację przy usuwaniu zdjęcia albo napisać uczciwie „do godziny od usunięcia".

### 12. „Odnotowujemy cofnięcie u siebie, żeby zdjęcie nie wróciło" — a wrócić może samo

**Dowód:** `content-fallback/articles.json` to wkompilowany snapshot artykułu z fotorelacją: `cover_image: "D3S_9133_4_g4us0w"`, blok `gallery` z sześcioma `publicId`, podpis „Zdjęcia: B. Kołaczek". `lib/news.ts:3,11,20-38` — przy błędzie lub przekroczeniu 6-sekundowego timeoutu Supabase (`AbortSignal.timeout(6000)`) lista aktualności serwuje ten snapshot; `lib/news.ts:40-58` — to samo dla pojedynczego artykułu. **Usunięcie artykułu lub zdjęcia w panelu nie rusza tego pliku.** Uśpiony projekt Supabase = artykuł usunięty ze względów prywatności wraca na stronę.

**Poprawka:** procedura realizacji żądania musi obejmować wyczyszczenie `content-fallback/articles.json` i redeploy. Albo zlikwidować fallback dla treści ze zdjęciami osób.

### 13. „Usuwamy zdjęcie ze strony i z naszej bazy" — podpis i alt zostają

**Dowód:** identyfikatory zdjęć siedzą w `articles.content` (jsonb, `supabase/setup.sql:183`) i w `site_settings` (klucze `page:<slug>`, `supabase/setup.sql:114`). `deleteImage` kasuje wyłącznie zasób w Cloudinary — blok w treści zostaje razem z polem `caption` (por. `content-fallback/articles.json`: `"caption": "Pokaz Shorinji Kempo na scenie gali"`). Zostaje też alt-tekst.

**Poprawka:** przy usuwaniu zdjęcia usuwać bloki, które je referencjonują — albo napisać w polityce, że kasujemy również podpis, i faktycznie to robić.

### 14. Okresy przechowywania w tabeli w pkt 9 wyglądają jak zobowiązanie, a są planem

**Dowód:** `supabase/setup.sql:83-107` — tabela `contact_messages` bez jakiegokolwiek mechanizmu wygasania; brak `pg_cron`, brak funkcji zaplanowanej, brak `netlify.toml` w repo (sprawdzone: nie ma też `vercel.json`, `_headers`, `_redirects`). `actions/contactActions.ts:97-104` — jedyne kasowanie jest ręczne.

**Ryzyko:** art. 5 ust. 1 lit. e w związku z art. 5 ust. 2 — deklarowany okres, którego nie da się wykazać, obraca się przeciw administratorowi przy kontroli.

**Poprawka:** albo wdrożyć kasowanie przed publikacją, albo napisać prawdę („usuwamy ręcznie, przy przeglądzie kwartalnym"). Dopisek `[DO WDROŻENIA]` w tabeli nie ratuje — dla czytelnika tabela czyta się jak zobowiązanie.

### 15. Obiecane prawo do kopii danych (art. 15 ust. 3) i przeniesienia (art. 20) jest dziś nierealizowalne

**Dowód:** `actions/contactActions.ts:70-86` — jedyny odczyt to `select("*").order("created_at").limit(200)`, **bez możliwości wyszukania po adresie e-mail**. `components/admin/MessagesManager.tsx:48-99` — płaska lista, zero wyszukiwania, zero eksportu. Po przekroczeniu 200 wiadomości starsze rekordy fizycznie są w bazie, ale są niewidoczne w panelu (`actions/contactActions.ts:80`) — administrator nie może ich ani znaleźć, ani wydać, ani usunąć.

**Poprawka:** wyszukiwanie po e-mailu + eksport przed publikacją. Sekcja 10 obiecuje te prawa bez zastrzeżeń.

---

## IV. PRZEMILCZENIA I RYZYKO PRAWNE

### 16. Honeypot potwierdza wysyłkę wiadomości, której nie zapisuje

**Cytat:** „Jeśli zostanie wypełnione, wiadomość jest po cichu odrzucana i **nie zapisujemy jej wcale**."

**Dowód:** `actions/contactActions.ts:33` — `if (input.website && input.website.trim() !== "") return { ok: true as const };`. Następnie `components/ContactForm.tsx:31-35` wyświetla „Dziękujemy! Wiadomość została wysłana - odezwiemy się wkrótce." Pole nazywa się `website` (`components/ContactForm.tsx:103-112`) i mimo `autoComplete="off"` bywa wypełniane przez menedżery haseł i rozszerzenia.

**Skutek:** rodzic pytający o zapisanie dziecka może dostać komunikat o sukcesie, a wiadomość przepada bezpowrotnie. Ten sam formularz polityka wskazuje jako kanał kontaktu. To kwestia rzetelności przetwarzania (art. 5 ust. 1 lit. a) i skuteczności realizacji żądań.

**Poprawka:** zmienić logikę (odrzucenie z komunikatem albo zapis z flagą `spam`), a do czasu zmiany nie opisywać tego jako mechanizmu bezpiecznego dla użytkownika.

### 17. „Formularz kontaktowy ma prostą ochronę przed robotami" — w sekcji Bezpieczeństwo to zdanie uspokaja bez pokrycia

**Dowód:** `actions/contactActions.ts:24-67` — server action **bez `requireUser()`**, zapisuje klientem service-role (`lib/supabaseAdmin.ts:23-25`), który z definicji omija RLS (opisane w `supabase/setup.sql:34-43`). Brak limitu na IP, brak limitu globalnego, brak CAPTCHA. Akcję da się wywołać bezpośrednio, z pominięciem formularza i pola-pułapki, i wstrzykiwać do tabeli z danymi osobowymi dowolne treści, w tym cudze dane.

**Poprawka:** usunąć to zdanie z sekcji 13 do czasu wdrożenia limitu.

### 18. Parametr `_a` Cloudinary vs. zdanie „nie mamy żadnego innego narzędzia mierzącego ruch"

**Dowód:** `app/galeria/_components/GalleryClient.tsx:4,99` używa `CldImage`. W `node_modules/next-cloudinary/dist/index.js` funkcja budująca URL **zawsze** przekazuje obiekt `analytics` (`product`, `sdkCode`, `sdkSemver`, `techVersion`) do `constructCloudinaryUrl`, co dokleja do adresu każdego zdjęcia w galerii parametr `?_a=...`. Cloudinary nazywa ten mechanizm w swojej dokumentacji „SDK analytics".

**Ocena:** opis w pkt 6 („dane o oprogramowaniu, nie o Tobie") jest merytorycznie broniony — parametr koduje wersje bibliotek, nie użytkownika. Ale zestawiony ze zdaniem absolutnym „nie mamy... żadnego innego narzędzia mierzącego ruch po stronie użytkownika" tworzy niepotrzebne pole do zarzutu.

**Poprawka:** najprościej wyeliminować — zamienić `CldImage` na `<img src={clUrl(...)}>`, tak jak w całej reszcie serwisu (`components/NewsBlocks.tsx`, `app/aktualnosci/*`). Wtedy zdanie zostaje bez zastrzeżeń.

### 19. Sekcja 5: podstawą dla danych instruktorów nie powinna być zgoda

**Dowód:** `data/articles/organizacja.ts:36-55` — publikowane są: imiona i nazwiska (Dominik Chowański, Krzysztof Kmiecik), zdjęcia portretowe (`publicId`), funkcje („Shibuchō / Mistrz kierujący filią"), stopnie i „Zezwolenie ważne do 2030.03.31". Opis w dokumencie się zgadza.

**Ryzyko:** dokument mówi jednocześnie, że publikacja jest „uzasadniona", i że podstawą jest zgoda (art. 6 ust. 1 lit. a). Zgoda osoby współpracującej ze stowarzyszeniem bywa kwestionowana jako niedobrowolna, a przy tym jest odwoływalna w każdej chwili — wtedy trzeba zdjąć podstronę. **Poprawka:** dane o funkcji, stopniu i zakresie uprawnień oprzeć na art. 6 ust. 1 lit. f (informowanie rodziców, kto uczy ich dzieci), a zgodę zachować wyłącznie dla wizerunku (art. 81 ust. 1 pr. aut.).

### 20. Dokument opisuje jedną filię, serwis pokazuje dwie — a dzieci uczy ta druga

**Dowód:** `data/articles/organizacja.ts:40` — filia „Kraków" (Chowański); `:50` — filia „Wawel" (Kmiecik). `app/zajecia/dzieci/page.tsx:10-12` — „Grupa dziecięca (**Filia Wawel**)... prowadzone przez Shibucho Krzysztofa Kmiecika".

**Skutek:** pkt 1 opisuje „filię krakowską" przy ul. Wysłouchów jako kontekst całej polityki, a zajęcia dla dzieci — czyli przetwarzanie najbardziej wrażliwe — prowadzi inna filia. Wiadomości ze wszystkich trzech formularzy trafiają do jednej skrzynki panelu bez rozdziału (`components/admin/MessagesManager.tsx:10-14`). **Poprawka:** opisać strukturę zgodnie ze stanem faktycznym i wskazać, kto realnie czyta wiadomości oznaczone `zajecia-dzieci`.

### 21. Brak GitHuba w tabeli odbiorców — i pytanie o widoczność repozytorium

**Dowód:** `git remote -v` → `origin https://github.com/MichalSurzyn/shorinji-strona.git`. W repozytorium leży `content-fallback/articles.json` z treścią artykułu i identyfikatorami zdjęć z pokazu. Jeżeli repo jest publiczne, to kolejny kanał publikacji, nieujęty w pkt 7.

Osobno: `.gitignore` poprawnie wyklucza `.env*`, ale plik `.env` z `SUPABASE_SERVICE_ROLE_KEY` fizycznie leży w katalogu roboczym. **Trzeba potwierdzić, że nigdy nie trafił do historii commitów** — wyciek tego klucza to pełny dostęp do bazy z pominięciem RLS, czyli do wszystkich wiadomości od rodziców.

### 22. Braki wobec przepisów

| Zagadnienie | Stan | Poprawka |
|---|---|---|
| Art. 13 RODO — informacja **w momencie** zbierania | `components/ContactForm.tsx` — brak klauzuli i brak linku do polityki (potwierdzone) | Sama publikacja polityki obowiązku **nie wykonuje**. Klauzula musi być pod formularzem |
| Art. 21 ust. 4 RODO — prawo sprzeciwu „wyraźnie i odrębnie od wszelkich innych informacji" | Jest siódmym punktem listy w pkt 10 | Wyodrębnić do własnego, wyróżnionego bloku |
| Art. 8 RODO / art. 8 uodo | „Od 13. roku życia pytamy również samo dziecko" — w Polsce granica samodzielnej zgody w usługach społeczeństwa informacyjnego to **16 lat** | Nazwać wprost zasadą wewnętrzną, nie stawiać obok podstaw prawnych, bo sugeruje regułę prawną, której nie ma |
| Art. 97 § 2 KRO — „Pytamy oboje rodziców" | Przy sporze rodziców rozstrzyga sąd opiekuńczy; polityka obiecuje coś, czego nie da się wyegzekwować | Złagodzić do „prosimy o podpis obojga rodziców" |
| Art. 118 kc — „maksymalnie 6 lat" | Dla roszczeń o świadczenia okresowe (składki) termin to 3 lata | Dopisać rozróżnienie |
| Usunięcie z wyników Google | „Występujemy do Google o usunięcie" — brak zastrzeżenia, że to wniosek bez gwarancji rezultatu i bez wpływu na kopie pobrane przez osoby trzecie | Dopisać zastrzeżenie |
| Sekcja 8 — „Serwer stoi we Frankfurcie", sekcja 13 — „wymuszony HSTS", „cały ruch szyfrowany HTTPS" | **Nieweryfikowalne z repozytorium.** Brak `netlify.toml`, `vercel.json`, `_headers`, `_redirects`; URL Supabase nie koduje regionu | Dopisać datę i sposób weryfikacji albo przenieść do `[DO UZUPEŁNIENIA]` |
| Sekcja 6 — „Zwykły odwiedzający nie dostaje żadnego pliku cookie" | Prawda w kodzie aplikacji, ale zależy od warstwy hostingu (Netlify potrafi ustawiać `nf_ab` przy split testach), której w repo nie ma | Przed publikacją zrobić zrzut zakładki Cookies na czystym profilu i zachować jako dowód |

### 23. Najniebezpieczniejsze zdanie w całym dokumencie

**Cytat (pkt 4):** „Zdjęcia dzieci publikujemy **wyłącznie** na podstawie zgody rodzica lub opiekuna prawnego".

Zdanie jest w czasie teraźniejszym i opisuje stan faktyczny. Tymczasem blok A pkt 9 przyznaje, że rejestru zgód nie ma, a art. 7 ust. 1 RODO nakłada obowiązek **wykazania** zgody. Jeżeli rodzic zapyta „proszę o kopię zgody dotyczącej zdjęcia mojego dziecka", a stowarzyszenie nie ma czym odpowiedzieć, to opublikowane zdanie staje się dowodem przeciw niemu w dwójnasób: nie ma zgody i publicznie oświadczono, że jest. **Nie publikować tego zdania przed utworzeniem rejestru zgód.**

---

## V. ZWERYFIKOWANE POZYTYWNIE — te twierdzenia się bronią

- **Brak analityki i narzędzi reklamowych.** Przeszukane całe repo: zero `gtag`, GTM, Piksela Facebooka, Hotjar, Clarity, Plausible, Matomo, Umami, Vercel Analytics/Speed Insights. Jedyne pliki z nazwą Vercel to `public/vercel.svg` i `public/next.svg` z szablonu startowego.
- **Fonty serwowane lokalnie.** `app/layout.tsx:2,12` (`Inter` z `next/font/google`) i `components/VerticalKanji.tsx:4-6` (`Yuji_Mai`). `next/font/google` pobiera pliki przy budowaniu i serwuje z własnej domeny. W całym repo nie ma ani jednego `<link>` do `fonts.googleapis.com` / `fonts.gstatic.com` ani `@font-face`. Twierdzenie w pkt 6 — poprawne.
- **Brak `localStorage` / `sessionStorage` / `document.cookie`.** Jedyne odwołanie do ciasteczek to `lib/supabase/server.ts:6` (sesja panelu).
- **Pola formularza i limity.** `components/ContactForm.tsx:66` (`maxLength={120}`), `:80` (`200`), `:95` (`4000`); `actions/contactActions.ts:22`; `supabase/setup.sql:85-87`. Zgodne co do znaku.
- **Brak kolumny na IP i na honeypot.** `supabase/setup.sql:83-91` — dokładnie siedem kolumn: `id`, `name`, `email`, `message`, `source`, `read`, `created_at`. Komentarz w `:103-104` potwierdza, że pole `website` celowo nie ma kolumny.
- **Trzy podstrony z formularzem i wartości `source`.** `app/kontakt/page.tsx:24` (`kontakt`), `app/zajecia/dorosli/page.tsx:35` (`zajecia-dorosli`), `app/zajecia/dzieci/page.tsx:35` (`zajecia-dzieci`). Mapa na tych samych trzech: `app/kontakt/page.tsx:26`, `app/zajecia/dorosli/page.tsx:37`, `app/zajecia/dzieci/page.tsx:37`.
- **Brak reCAPTCHY.** Potwierdzone.
- **Brak profilowania i decyzji automatycznych.** Potwierdzone — sekcja 12 poprawna.
- **Adres osadzenia YouTube.** `components/NewsBlocks.tsx:266` — `https://www.youtube.com/embed/${id}`, wskazana w bloku A linia 266 się zgadza.
- **`getImagesFromFolder` jako podatność.** `actions/galleryActions.ts:21-40` — publiczna, bez `requireUser()`, wstawia ścieżkę od klienta wprost do `folder:"${folderPath}"` bez escape'owania cudzysłowu i bez whitelisty. Zarzut z bloku A pkt 8 — słuszny. Dodatkowo `getGalleryFolders` (`:11-19`) też jest nieuwierzytelnione.

---

## VI. BŁĘDY W SAMYM AUDYCIE (bloki A i B)

1. **Blok A pkt 16 — zły numer linii.** „`components/admin/AdminsManager.tsx:141` ma `type="text"`" → faktycznie **linia 142**.
2. **Blok A pkt 16 — „Dodać też ścieżkę resetu hasła, bo dziś jej nie ma".** Zmiana hasła **istnieje**: `actions/userActions.ts:63-70` (`changeOwnPassword`) plus formularz „Zmień swoje hasło" w `components/admin/AdminsManager.tsx` (~158-178). Brakuje wyłącznie ścieżki odzyskiwania dla osoby, która hasło zapomniała. Obecne sformułowanie da się przeczytać jako „nie da się zmienić hasła" — nieprawda.
3. **Blok A pkt 1 — „Struktura stopki (`lib/footerTypes.ts`) nie ma dziś pola na informacje prawne".** Nadinterpretacja: `lib/footerTypes.ts:12` ma tablicę `documents`, edytowalną z panelu — link do polityki da się dodać **bez zmiany kodu**. Nowa sekcja jest lepsza, ale nie jest konieczna.
4. **Blok A nie wychwycił pięciu rzeczy**, wszystkie opisane wyżej: brak allowlisty w `requireUser` (pkt I.1), brak `invalidate: true` przy kasowaniu z Cloudinary (III.10), `content-fallback/articles.json` jako kanał powrotu usuniętych treści (III.12), indeksowalna strona logowania i `robots.ts` bez `disallow` (II.7), proxy `/_next/image` w `ArticleGallery` (II.5).
5. **Blok B pkt 4 — „to jedyny element infrastruktury, którego lokalizacji nie udało się rozstrzygnąć".** Nieprawda: z kodu nie da się rozstrzygnąć **także** lokalizacji Supabase (deklarowany Frankfurt), hostingu (nie ma żadnej konfiguracji Netlify w repo) ani nagłówków HTTPS/HSTS.

---

## KOLEJNOŚĆ DZIAŁAŃ

1. Sprawdzić rejestrację w Supabase Auth (I.1) — to potencjalnie otwarty dostęp do danych dzieci.
2. Ustalić, co stoi pod `shorinjikempo.pl` (I.2).
3. Sprawdzić widoczność repozytorium GitHub i historię pod kątem `.env` (IV.21).
4. Usunąć z tekstu zdania samooskarżające i opis braków w zabezpieczeniach (I.3).
5. Poprawić błędy faktyczne: adres (II.4), zdjęcia (II.5, II.6), indeksowanie (II.7), cookie (II.8), YouTube (II.9).
6. Zdjąć obietnice bez pokrycia albo wdrożyć mechanizmy (III.10–III.15).
7. Nie publikować zdania o „wyłącznie za zgodą" przed utworzeniem rejestru zgód (IV.23).
8. Dopiero potem — radca prawny, zgodnie z blokiem C.