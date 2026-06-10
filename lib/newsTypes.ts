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
  | { type: "links"; items: { label: string; url: string; note?: string }[] };

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
