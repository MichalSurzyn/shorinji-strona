/**
 * Wysokość drzewa stron — jedno miejsce dla trasy, akcji panelu, menu i drzewa w panelu.
 *
 * Od 2026-10-12 drzewo ma CZTERY poziomy (depth 0..3): techniki wiszą pod stopniem,
 * np. /program-nauczania/stopnie-i-wymagania/6-kyu/kote-nuki. Baza pilnuje tego samego
 * niezależnie od kodu — CHECK `pages_depth_chk` i trigger `pages_before_write`
 * (supabase/06-czwarty-poziom.sql). Podniesienie limitu TYLKO tutaj skończy się
 * odmową zapisu z bazy, a nie cichym błędem; obniżenie — stronami, których trasa
 * nie wyrenderuje. Zmieniać razem z SQL-em.
 *
 * Bez importów: plik czyta i serwer (`lib/pages.ts`), i przeglądarka (`TreeManager`).
 */

/** `depth` najgłębszych stron — pod nimi nie da się już niczego dodać ani wsunąć. */
export const NAJGLEBSZY_POZIOM = 3;

/** Najwięcej segmentów adresu strony z drzewa (strona na poziomie 3 ma ich 4). */
export const NAJWIECEJ_SEGMENTOW = NAJGLEBSZY_POZIOM + 1;

/**
 * Menu górne pokazuje trzy poziomy (depth 0..2). Czwarty poziom do menu nie wchodzi
 * nawet z „Pokaż w menu": rozwijana lista w rozwijanej liście w rozwijanej liście
 * byłaby nieczytelna, a docelowo ma tam być ~40 technik na stopień. Strony czwartego
 * poziomu prowadzą z treści strony rodzica (lista technik na stronie 6 Kyu).
 *
 * Świadomie NIE odrzucamy `in_menu` na tym poziomie przy zapisie: stara reguła
 * „trzeci poziom nie może być w menu" kazała ukrywać stronę przed przeniesieniem,
 * a właściciel to odwołał (sprawdzWidocznosc w actions/pagesActions.ts).
 */
export const NAJGLEBSZY_POZIOM_MENU = 2;
