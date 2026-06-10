# Shorinji Kempo Kraków – strona

Projekt Next.js (App Router) zastępujący starą stronę z Wix
(https://www.shorinjikempo.pl/).

## Uruchomienie

```bash
npm run dev
```

Strona dostępna pod [http://localhost:3000](http://localhost:3000).

## Paleta kolorów / motyw

Strona ma motyw ciemny z jednym, mocnym akcentem złotym (yellow).
Tła są utrzymane w skali neutralnej (czerń/grafit), a obramowania
i hover wszędzie operują na akcencie.

| Rola                       | Klasa Tailwind            | Hex      |
| -------------------------- | ------------------------- | -------- |
| Tło główne (body / strony) | `bg-neutral-900`          | `#171717` |
| Tło navbara / dropdownów   | `bg-black`                | `#000000` |
| Tło stopki                 | `bg-neutral-900`          | `#171717` |
| Akcent (złoty)             | `text-yellow-500` / `border-yellow-500` | `#eab308` |
| Akcent – hover             | `text-yellow-400`         | `#facc15` |
| Tekst główny               | `text-white`              | `#ffffff` |
| Tekst body                 | `text-neutral-300`        | `#d4d4d4` |
| Tekst pomocniczy           | `text-neutral-400`        | `#a3a3a3` |
| Tekst stopki / drobny      | `text-neutral-500`        | `#737373` |
| Obramowania panele         | `border-neutral-800`      | `#262626` |
| Obramowania karty          | `border-neutral-700`      | `#404040` |

### Zasady stosowania

- Akcent (yellow-500) używamy oszczędnie: aktywny link w navie,
  wyróżnione frazy w treści, obramowania kart/tabel, hover na linkach.
- Tła sekcji utrzymujemy ciemne lub przezroczyste; karty mają lekkie
  tło z opacity (np. `bg-yellow-500/5`) zamiast pełnych wypełnień.
- Kontener treści: szerokość `w-[80%] mx-auto`, sekcje z paddingiem
  `pt-50 pb-20` (pod ukryciem przez fixed navbar).

### Fonty

- `Inter` (Google) – font główny, body i nagłówki.
- `Yuji Mai` (Google) – pionowe kanji dekoracyjne po bokach
  (komponent `VerticalKanji`).

## Tailwind v4

Projekt używa **Tailwind v4** (`tailwindcss` ^4, `@tailwindcss/postcss`).
W v4 zamiast `@tailwind base; @tailwind components; @tailwind utilities;`
używamy:

```css
@import "tailwindcss";
```

w `app/globals.css`. Konfiguracja themu jest inline w CSS
(`@theme inline { ... }`).

## Struktura folderów (skrót)

```
app/
  layout.tsx        # globalny layout (Navbar, Footer, VerticalKanji)
  page.tsx          # strona główna (Hero + NewsSidebar)
  galeria/page.tsx  # galeria zdjęć (Cloudinary)
  cennik/page.tsx   # cennik – kilka tabel opłat + konto bankowe
components/
  Navbar.tsx
  Footer.tsx        # 4 kolumny: O nas+social (FB/IG/YT), Do pobrania, Dokumenty, Kontakt
  HeroSection.tsx
  NewsSidebar.tsx
  GalleryClient.tsx
  VerticalKanji.tsx
public/downloads/   # statyczne PDFy (deklaracje, statuty WSKO/POSK)
```

## Panel administracyjny (od 06.2026)

Panel pod `/admin` (jasny motyw, celowo inny niż strona publiczna).

- **Logowanie:** Supabase Auth (email + hasło). Konta zarządzasz w panelu
  (zakładka Administratorzy) - możesz mieć wielu adminów.
- **Podstrony:** edycja treści artykułów tematycznych (O Shorinji /
  Organizacja / Buddyzm) - nadpisania trafiają do tabeli
  `article_overrides` w Supabase; bez nadpisania strona pokazuje treść
  bazową z `data/articles/*`. Zdjęcia wstawiasz przyciskiem (wybór
  wizualny z Cloudinary albo upload z dysku).
- **Aktualności:** pełny CRUD artykułów-newsów (tabela `articles`),
  edytor blokowy (akapit / nagłówek / lista / wyróżnienie / zdjęcie /
  galeria), okładka, szkice, data publikacji. Strona główna i
  `/aktualnosci` czytają z bazy z fallbackiem do
  `content-fallback/articles.json` (gdy Supabase śpi / brak sieci).
- **Zdjęcia:** przeglądanie folderów Cloudinary (Galeria/* = zakładki
  publicznej galerii; Strona/* = zdjęcia podstron), upload bezpośrednio
  do Cloudinary (podpisany - bez limitu rozmiaru), usuwanie.
  Cloud działa w trybie dynamic folders - upload ustawia `asset_folder`,
  public_id zostaje krótkie.
- **Harmonogram:** edycja godzin zajęć (tabela `site_settings`, klucz
  `schedule`); nadpisuje `data/schedule.ts` na stronach Zajęcia i w
  pliku kalendarza `.ics`. Przycisk "Przywróć wersję bazową" usuwa
  nadpisanie.

### Zmienne środowiskowe (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...   # tylko serwer! nigdy NEXT_PUBLIC_
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

Dawne `ADMIN_PASSWORD` nie jest już używane (logowanie przez Supabase).
