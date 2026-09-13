/** Typy nawigacji - bezpieczne po stronie klienta (bez zależności serwerowych). */

/**
 * Pozycja w rozwijanym menu.
 *
 * `href` jest OPCJONALNY, bo nagłówek grupujący zagnieżdżony pod inną pozycją
 * nie ma adresu — renderuje się jako podpis nad własnymi podstronami. Dopóki
 * typ wymagał adresu, `buildNavTree` musiał taki węzeł odsiać RAZEM z jego
 * podstronami, więc cała gałąź drzewa po cichu wypadała z menu.
 *
 * `children` to trzeci poziom. Wcześniej menu renderowało dwa i trzeci poziom
 * pokazywał się wyłącznie jako kafelek na stronie rodzica — właściciel uznał to
 * za pomyłkę („nigdy nie ustalałem, że ma być ukryty"), więc trzeci poziom
 * wchodzi do rozwijanej listy jako wcięta, mniejsza pozycja.
 */
export type NavChild = { href?: string; label: string; children?: NavChild[] };

export type NavLink = {
  label: string;
  href?: string;
  dropdown?: NavChild[];
};
