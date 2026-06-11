/** Dane stopki - pola w stylu ACF, edytowalne w panelu. */

export type FooterLink = { label: string; href: string };

export interface FooterData {
  about: string;
  social: { facebook: string; instagram: string; youtube: string };
  downloads: FooterLink[];
  documents: FooterLink[];
  contact: {
    addressLine1: string;
    addressLine2: string;
    phone: string;
    phoneDisplay: string;
    email: string;
  };
  copyright: string;
}

/** Stopka bazowa z kodu - fallback, gdy baza nie odpowiada. */
export const DEFAULT_FOOTER: FooterData = {
  about:
    "Japońska sztuka walki łącząca skuteczną samoobronę z głębokim rozwojem osobistym.",
  social: {
    facebook: "https://www.facebook.com/shorinjikempopolska",
    instagram: "https://www.instagram.com/shorinjikempopolska/",
    youtube: "https://www.youtube.com/@Dominik_Chowanski",
  },
  downloads: [
    { label: "Deklaracja członkowska – dorośli", href: "/downloads/deklaracja-dorosli.pdf" },
    { label: "Deklaracja członkowska – do 18 lat", href: "/downloads/deklaracja-do-18.pdf" },
  ],
  documents: [
    { label: "Statut POSK", href: "/downloads/statut-posk.pdf" },
    { label: "WSKO – Statutes (kiyaku)", href: "/downloads/wsko-statutes.pdf" },
    { label: "WSKO – Bylaws", href: "/downloads/wsko-bylaws.pdf" },
    { label: "WSKO – Regulations", href: "/downloads/wsko-regulations.pdf" },
  ],
  contact: {
    addressLine1: "ul. Łąkowa 31, Kraków",
    addressLine2: "Szkoła Podstawowa nr 114",
    phone: "+48792995510",
    phoneDisplay: "+48 792 99 55 10",
    email: "pl.shorinjikempo@gmail.com",
  },
  copyright: "POLSKA ORGANIZACJA SHORINJI KEMPO.",
};
