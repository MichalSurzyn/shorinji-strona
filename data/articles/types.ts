// Wspólne typy dla artykułów (O Shorinji Kempo / Organizacja / Buddyzm).

export type ArticleTopic = "o-shorinji" | "organizacja" | "buddyzm";

export type ArticleParagraph =
  | string
  | { type: "list"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "quote"; text: string };

export type ArticleSection = {
  /** Slug do anchora (auto-generowany jeśli nie podany). */
  id?: string;
  /** Nagłówek sekcji wyświetlany jako H2 + kotwica w TOC. */
  heading: string;
  paragraphs: ArticleParagraph[];
};

export type Article = {
  /** Slug podstrony w URL (np. "podstawy" → /buddyzm/podstawy). */
  slug: string;
  /** Tytuł H1 strony. */
  title: string;
  /** Krótki opis – w nagłówku i na kafelku. */
  intro: string;
  /** Sekcje merytoryczne. */
  sections: ArticleSection[];
};

export type ArticleGroup = {
  topic: ArticleTopic;
  topicTitle: string;
  topicIntro: string;
  articles: Article[];
};
