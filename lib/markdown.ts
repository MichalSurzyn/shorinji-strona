// Lekka, dwustronna konwersja między prostym Markdownem a strukturą artykułu
// (ArticleSection / ArticleParagraph). Świadomie obsługuje tylko podzbiór
// składni używany w treści strony — bez zależności zewnętrznych.
//
// Obsługiwane bloki:
//   ## Nagłówek sekcji        -> nowa sekcja (H2 + kotwica w spisie treści)
//   ### Śródtytuł             -> { type: "subheading" }
//   - punkt  /  * punkt       -> { type: "list" }
//   1. punkt                  -> { type: "ordered" }
//   > cytat                   -> { type: "quote" }
//   ![opis](public_id)        -> { type: "image" }  (opis "[portret] ..." => wąskie)
//   zwykły akapit             -> string (obsługuje **pogrubienie** i [link](url))

import type { Article, ArticleParagraph, ArticleSection } from "../data/articles/types";

const IMAGE_RE = /^!\[(.*)\]\(([^)\s]+)\)$/;
const ORDERED_RE = /^\d+\.\s+(.*)$/;
const BULLET_RE = /^[-*]\s+(.*)$/;

function classifyBlock(lines: string[]): ArticleParagraph {
  // Śródtytuł
  if (lines.length === 1) {
    const sub = lines[0].match(/^###\s+(.*)$/);
    if (sub) return { type: "subheading", text: sub[1].trim() };

    const img = lines[0].match(IMAGE_RE);
    if (img) {
      let caption = img[1].trim();
      let variant: "wide" | "portrait" = "wide";
      const portrait = caption.match(/^\[portret\]\s*(.*)$/i);
      if (portrait) {
        variant = "portrait";
        caption = portrait[1].trim();
      }
      return {
        type: "image",
        publicId: img[2].trim(),
        variant,
        ...(caption ? { caption } : {}),
      };
    }
  }

  if (lines.every((l) => BULLET_RE.test(l))) {
    return { type: "list", items: lines.map((l) => l.replace(BULLET_RE, "$1").trim()) };
  }
  if (lines.every((l) => ORDERED_RE.test(l))) {
    return { type: "ordered", items: lines.map((l) => l.replace(ORDERED_RE, "$1").trim()) };
  }
  if (lines.every((l) => l.startsWith(">"))) {
    return { type: "quote", text: lines.map((l) => l.replace(/^>\s?/, "")).join(" ").trim() };
  }

  // Zwykły akapit – łączymy zawinięte linie w jeden ciąg.
  return lines.join(" ").trim();
}

/** Dzieli surowy tekst sekcji (bez nagłówka ##) na bloki rozdzielone pustą linią. */
function paragraphsFromBody(body: string): ArticleParagraph[] {
  const blocks: string[][] = [];
  let current: string[] = [];
  for (const rawLine of body.split("\n")) {
    const line = rawLine.replace(/\s+$/, "");
    if (line.trim() === "") {
      if (current.length) {
        blocks.push(current);
        current = [];
      }
    } else {
      current.push(line.trim());
    }
  }
  if (current.length) blocks.push(current);
  return blocks.map(classifyBlock);
}

/** Markdown -> sekcje artykułu. Treść przed pierwszym `##` trafia do sekcji bez nagłówka. */
export function parseMarkdownToSections(md: string): ArticleSection[] {
  const lines = (md ?? "").replace(/\r\n/g, "\n").split("\n");
  const sections: { heading: string; body: string[] }[] = [];
  let currentHeading = "";
  let currentBody: string[] = [];
  let started = false;

  const flush = () => {
    if (started || currentBody.some((l) => l.trim() !== "")) {
      sections.push({ heading: currentHeading, body: currentBody });
    }
  };

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.*)$/);
    if (h2) {
      flush();
      currentHeading = h2[1].trim();
      currentBody = [];
      started = true;
    } else {
      currentBody.push(line);
    }
  }
  flush();

  return sections
    .map((s) => ({ heading: s.heading, paragraphs: paragraphsFromBody(s.body.join("\n")) }))
    .filter((s) => s.heading !== "" || s.paragraphs.length > 0);
}

function paragraphToMarkdown(p: ArticleParagraph): string {
  if (typeof p === "string") return p;
  switch (p.type) {
    case "subheading":
      return `### ${p.text}`;
    case "list":
      return p.items.map((i) => `- ${i}`).join("\n");
    case "ordered":
      return p.items.map((i, idx) => `${idx + 1}. ${i}`).join("\n");
    case "quote":
      return `> ${p.text}`;
    case "image": {
      const prefix = p.variant === "portrait" ? "[portret] " : "";
      return `![${prefix}${p.caption ?? ""}](${p.publicId})`;
    }
    default:
      return "";
  }
}

/** Artykuł (z kodu) -> Markdown, do wstępnego wypełnienia edytora. */
export function serializeArticleToMarkdown(article: Article): string {
  return article.sections
    .map((section) => {
      const head = section.heading ? `## ${section.heading}\n\n` : "";
      const body = section.paragraphs.map(paragraphToMarkdown).join("\n\n");
      return head + body;
    })
    .join("\n\n");
}
