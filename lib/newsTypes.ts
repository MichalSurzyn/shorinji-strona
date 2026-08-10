/**
 * Typy bloków treści używane przez edytor w panelu admina.
 * Bloki renderuje components/NewsBlocks.tsx (ciemny motyw strony).
 * Używane w: aktualnościach (tabela articles), nadpisaniach stron
 * statycznych (site_settings) i - po konwersji - w podstronach
 * tematycznych (article_overrides, format markdown).
 */

export type NewsBlock =
  | { type: "heading"; text: string }
  | { type: "subheading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "callout"; text: string }
  | { type: "quote"; text: string }
  | { type: "list"; items: string[] }
  | { type: "ordered"; items: string[] }
  | {
      type: "image";
      publicId: string;
      caption?: string | null;
      variant?: "wide" | "portrait";
    }
  | { type: "gallery"; publicIds: string[] }
  | {
      type: "table";
      headers?: [string, string];
      rows: { label: string; price: string; note?: string }[];
    }
  | { type: "links"; items: { label: string; url: string; note?: string }[] }
  /** Osadzony film YouTube (pełny player, nie link). */
  | {
      type: "video";
      /** Pełny URL filmu (watch/short/embed) albo samo ID. */
      url: string;
      caption?: string | null;
      /** Proporcje playera; domyślnie 16:9. */
      aspect?: "16:9" | "4:3";
    }
  /** Plik do pobrania z miniaturką (np. lektury, deklaracje). */
  | {
      type: "download";
      label: string;
      /** Adres pliku (np. /downloads/plik.pdf albo pełny URL). */
      url: string;
      /** Miniaturka / okładka z Cloudinary (opcjonalna). */
      imageId?: string | null;
      note?: string | null;
    }
  /** Karta osoby (instruktor, egzaminator...) — kolejne karty ustawiają się obok siebie. */
  | {
      type: "person";
      name: string;
      /** Podtytuł nad nazwiskiem, np. "Shibucho – mistrz kierujący filią". */
      role?: string | null;
      /** Dopisek pod nazwiskiem, np. "Egzaminator oraz Sędzia 2 kategorii". */
      subtitle?: string | null;
      /** Zdjęcie z Cloudinary. */
      imageId?: string | null;
      /** Pary etykieta → wartość (np. Bukai → 6 Dan). */
      facts: { label: string; value: string }[];
      /** Dodatkowa notka na dole karty (obsługuje formatowanie inline). */
      note?: string | null;
    }
  /**
   * Numer konta do wpłat. Blok NIE przechowuje danych - bierze je
   * z zakładki „Dane organizacji".
   *
   * Wcześniej numer rachunku siedział w zwykłym bloku „callout" jako tekst
   * ze znacznikami wyróżnienia. Był więc edytowany jak proza, bez żadnej
   * kontroli - a to najdroższy w skutkach ciąg znaków na stronie.
   */
  | { type: "bank" };

/**
 * Pełna treść edytowalnej strony (site_settings, klucz "page:<slug>").
 * `title`/`lead`/`kicker` to nagłówek strony — dawniej zahardkodowany w kodzie.
 * Starsze wpisy mają tylko { blocks } — pola nagłówka są wtedy undefined.
 */
export interface PageContent {
  /** Nagłówek H1 strony. */
  title?: string | null;
  /** Akapit pod nagłówkiem. */
  lead?: string | null;
  /** Mała żółta etykietka nad H1 (np. "Materiały szkoleniowe"). */
  kicker?: string | null;
  blocks: NewsBlock[];
}

export interface NewsArticle {
  id: string;
  slug: string;
  title: string;
  excerpt?: string | null;
  cover_image?: string | null;
  content: NewsBlock[];
  published: boolean;
  published_at: string;
  created_at?: string;
  updated_at?: string;
}
