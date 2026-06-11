/** Typy nawigacji - bezpieczne po stronie klienta (bez zależności serwerowych). */

export type NavChild = { href: string; label: string };

export type NavLink = {
  label: string;
  href?: string;
  dropdown?: NavChild[];
};

/** Wiersz tabeli nav_items (do edytora w panelu). */
export type NavItemRow = {
  id: string;
  parent_id: string | null;
  label: string;
  href: string | null;
  position: number;
  visible: boolean;
};

/** Menu bazowe z kodu - fallback, gdy baza nie odpowiada. */
export const DEFAULT_NAV: NavLink[] = [
  {
    label: "ZAJĘCIA",
    dropdown: [
      { href: "/zajecia/dorosli", label: "GRUPA DOROSŁA" },
      { href: "/zajecia/dzieci", label: "GRUPA DZIECIĘCA" },
    ],
  },
  { href: "/aktualnosci", label: "AKTUALNOŚCI" },
  { href: "/cennik", label: "CENNIK" },
  { href: "/program-nauczania", label: "PROGRAM NAUCZANIA" },
  { href: "/galeria", label: "GALERIA" },
  {
    label: "O SHORINJI KEMPO",
    href: "/o-shorinji",
    dropdown: [
      { href: "/o-shorinji/wprowadzenie", label: "WPROWADZENIE" },
      { href: "/o-shorinji/cele-i-wartosci", label: "CELE I WARTOŚCI" },
      { href: "/o-shorinji/symbolika-i-medytacja", label: "SYMBOLIKA I MEDYTACJA" },
      { href: "/o-shorinji/historia", label: "HISTORIA" },
    ],
  },
  {
    label: "ORGANIZACJA",
    href: "/organizacja",
    dropdown: [
      { href: "/organizacja/zalozyciel", label: "ZAŁOŻYCIEL" },
      { href: "/organizacja/egzaminatorzy", label: "EGZAMINATORZY" },
    ],
  },
  {
    label: "BUDDYZM",
    href: "/buddyzm",
    dropdown: [
      { href: "/buddyzm/podstawy", label: "PODSTAWY" },
      { href: "/buddyzm/nauki", label: "NAUKI" },
      { href: "/buddyzm/medytacja", label: "MEDYTACJA" },
      { href: "/buddyzm/etyka-i-swieta", label: "ETYKA I ŚWIĘTA" },
    ],
  },
];
