import type { NavLink } from "@/lib/navTypes";

/**
 * PLIK GENEROWANY — nie edytować ręcznie.
 * Wytworzony przez scripts/snapshot-menu.mjs, 2026-09-01.
 *
 * Zapasowe menu na wypadek, gdy tabela `pages` jest nieosiągalna: brak
 * konfiguracji Supabase, timeout, błąd zapytania albo pusty wynik. Bez niego
 * pojedyncza awaria bazy gasi nawigację na wszystkich trasach naraz.
 *
 * Po każdej większej zmianie struktury menu uruchom ponownie:
 *   node scripts/snapshot-menu.mjs
 * Kontrola aktualności (kod 1, gdy się rozjechało):
 *   node scripts/snapshot-menu.mjs --sprawdz
 */
export const MENU_FALLBACK: NavLink[] = [
  {
    "label": "AKTUALNOŚCI",
    "href": "/aktualnosci"
  },
  {
    "label": "O SHORINJI KEMPO",
    "href": "/o-shorinji",
    "dropdown": [
      {
        "href": "/o-shorinji/wprowadzenie",
        "label": "WPROWADZENIE"
      },
      {
        "href": "/o-shorinji/cele-i-wartosci",
        "label": "CELE I WARTOŚCI"
      },
      {
        "href": "/o-shorinji/symbolika-i-medytacja",
        "label": "MEDYTACJA / ZAZEN"
      },
      {
        "href": "/o-shorinji/historia",
        "label": "HISTORIA SZKOŁY"
      }
    ]
  },
  {
    "label": "ZAJĘCIA",
    "dropdown": [
      {
        "href": "/zajecia/dorosli",
        "label": "GRUPA DOROSŁA"
      },
      {
        "href": "/zajecia/dzieci",
        "label": "GRUPA DZIECIĘCA"
      },
      {
        "href": "/zajecia/cennik",
        "label": "CENNIK"
      },
      {
        "href": "/faq",
        "label": "FAQ"
      }
    ]
  },
  {
    "label": "PROGRAM NAUCZANIA",
    "href": "/program-nauczania"
  },
  {
    "label": "ORGANIZACJA",
    "href": "/organizacja",
    "dropdown": [
      {
        "href": "/organizacja/zalozyciel",
        "label": "ZAŁOŻYCIEL"
      },
      {
        "href": "/organizacja/egzaminatorzy",
        "label": "EGZAMINATORZY"
      }
    ]
  },
  {
    "label": "BUDDYZM",
    "href": "/buddyzm",
    "dropdown": [
      {
        "href": "/buddyzm/podstawy",
        "label": "PODSTAWY"
      },
      {
        "href": "/buddyzm/nauki",
        "label": "NAUKI"
      },
      {
        "href": "/buddyzm/medytacja",
        "label": "MEDYTACJA"
      },
      {
        "href": "/buddyzm/etyka-i-swieta",
        "label": "ETYKA I ŚWIĘTA"
      }
    ]
  },
  {
    "label": "GALERIA",
    "href": "/galeria"
  },
  {
    "label": "SENS BUDO",
    "href": "/istota-budo"
  },
  {
    "label": "SYMBOLE",
    "href": "/symbole-shorinji-kempo"
  }
];
