import type {
  Article,
  ArticleParagraph,
  ArticleSection,
} from "@/data/articles/types";
import type { NewsBlock } from "./newsTypes";

/**
 * Konwersja dwustronna: struktura podstron tematycznych (ArticleSection[])
 * <-> bloki edytora (NewsBlock[]). Dzięki temu podstrony tematyczne
 * edytuje się tym samym edytorem blokowym co aktualności, a zapis
 * dalej trafia do article_overrides jako markdown (bez zmian w bazie).
 */

/**
 * Krótkie linie pisane wersalikami to w danych źródłowych śródtytuły
 * (konwencja ze starej strony) - tak samo traktuje je publiczny renderer.
 */
function isCapsHeading(s: string): boolean {
  const t = s.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (t.includes("**") || t.includes("](")) return false;
  if (!/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(t)) return false;
  return t === t.toUpperCase();
}

export function sectionsToBlocks(sections: ArticleSection[]): NewsBlock[] {
  const blocks: NewsBlock[] = [];
  for (const section of sections) {
    if (section.heading) blocks.push({ type: "heading", text: section.heading });
    for (const p of section.paragraphs) {
      if (typeof p === "string") {
        const hashHeading = p.match(/^#{2,6}\s+(.*)$/);
        if (hashHeading) {
          blocks.push({ type: "subheading", text: hashHeading[1].trim() });
        } else if (isCapsHeading(p)) {
          blocks.push({ type: "subheading", text: p.trim() });
        } else {
          blocks.push({ type: "paragraph", text: p });
        }
        continue;
      }
      switch (p.type) {
        case "subheading":
          blocks.push({ type: "subheading", text: p.text });
          break;
        case "list":
          blocks.push({ type: "list", items: [...p.items] });
          break;
        case "ordered":
          blocks.push({ type: "ordered", items: [...p.items] });
          break;
        case "quote":
          blocks.push({ type: "quote", text: p.text });
          break;
        case "image":
          blocks.push({
            type: "image",
            publicId: p.publicId,
            caption: p.caption ?? "",
            variant: p.variant ?? "wide",
          });
          break;
      }
    }
  }
  return blocks;
}

export function blocksToSections(blocks: NewsBlock[]): ArticleSection[] {
  const sections: { heading: string; paragraphs: ArticleParagraph[] }[] = [];
  let current: { heading: string; paragraphs: ArticleParagraph[] } | null = null;

  const ensure = () => {
    if (!current) {
      current = { heading: "", paragraphs: [] };
      sections.push(current);
    }
    return current;
  };

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        current = { heading: block.text.trim(), paragraphs: [] };
        sections.push(current);
        break;
      case "subheading":
        ensure().paragraphs.push({ type: "subheading", text: block.text });
        break;
      case "paragraph":
        if (block.text.trim()) ensure().paragraphs.push(block.text.trim());
        break;
      case "callout":
      case "quote":
        if (block.text.trim())
          ensure().paragraphs.push({ type: "quote", text: block.text.trim() });
        break;
      case "list":
        ensure().paragraphs.push({
          type: "list",
          items: block.items.filter((i) => i.trim()),
        });
        break;
      case "ordered":
        ensure().paragraphs.push({
          type: "ordered",
          items: block.items.filter((i) => i.trim()),
        });
        break;
      case "image":
        if (block.publicId)
          ensure().paragraphs.push({
            type: "image",
            publicId: block.publicId,
            ...(block.caption?.trim() ? { caption: block.caption.trim() } : {}),
            variant: block.variant === "portrait" ? "portrait" : "wide",
          });
        break;
      // gallery/table/links nie występują na podstronach tematycznych
      default:
        break;
    }
  }

  return sections.filter((s) => s.heading !== "" || s.paragraphs.length > 0);
}

/** Pomocniczo: artykuł tematyczny -> bloki (treść bazowa do edytora). */
export function articleToBlocks(article: Article): NewsBlock[] {
  return sectionsToBlocks(article.sections);
}
