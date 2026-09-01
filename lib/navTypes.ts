/** Typy nawigacji - bezpieczne po stronie klienta (bez zależności serwerowych). */

export type NavChild = { href: string; label: string };

export type NavLink = {
  label: string;
  href?: string;
  dropdown?: NavChild[];
};
