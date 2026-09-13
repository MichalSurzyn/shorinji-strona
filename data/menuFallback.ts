import type { NavLink } from "@/lib/navTypes";

/**
 * PLIK GENEROWANY — nie edytować ręcznie.
 * Wytworzony przez scripts/snapshot-menu.mjs, 2026-09-09.
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
        "label": "WPROWADZENIE",
        "href": "/o-shorinji/wprowadzenie"
      },
      {
        "label": "CELE I WARTOŚCI",
        "href": "/o-shorinji/cele-i-wartosci"
      },
      {
        "label": "SENS BUDO",
        "href": "/o-shorinji/istota-budo"
      },
      {
        "label": "MEDYTACJA / ZAZEN",
        "href": "/o-shorinji/symbolika-i-medytacja"
      },
      {
        "label": "SYMBOLE",
        "href": "/o-shorinji/symbole-shorinji-kempo"
      },
      {
        "label": "HISTORIA SZKOŁY",
        "href": "/o-shorinji/historia"
      }
    ]
  },
  {
    "label": "ZAJĘCIA",
    "dropdown": [
      {
        "label": "GRUPA DOROSŁA",
        "href": "/zajecia/dorosli"
      },
      {
        "label": "GRUPA DZIECIĘCA",
        "href": "/zajecia/dzieci"
      },
      {
        "label": "CENNIK",
        "href": "/zajecia/cennik"
      },
      {
        "label": "FAQ",
        "href": "/faq"
      }
    ]
  },
  {
    "label": "PROGRAM NAUCZANIA",
    "href": "/program-nauczania",
    "dropdown": [
      {
        "label": "Stopnie i wymagania",
        "href": "/program-nauczania/stopnie-i-wymagania"
      },
      {
        "label": "Podstawowe formy",
        "href": "/program-nauczania/podstawowe-formy"
      },
      {
        "label": "Filozofia Kaiso",
        "href": "/program-nauczania/filozofia-kaiso"
      },
      {
        "label": "Teoria i filozofia",
        "href": "/program-nauczania/teoria-i-filozofia"
      },
      {
        "label": "Biblioteka",
        "href": "/program-nauczania/biblioteka"
      },
      {
        "label": "Seminaria i szkolenia",
        "href": "/program-nauczania/seminaria-i-szkolenia"
      },
      {
        "label": "Kursy specjalistyczne",
        "href": "/program-nauczania/kursy-specjalistyczne"
      },
      {
        "label": "Trening z przyrządami",
        "href": "/program-nauczania/trening-z-przyrzadami"
      },
      {
        "label": "eq",
        "href": "/program-nauczania/eq"
      }
    ]
  },
  {
    "label": "ORGANIZACJA",
    "href": "/organizacja",
    "dropdown": [
      {
        "label": "ZAŁOŻYCIEL",
        "href": "/organizacja/zalozyciel"
      },
      {
        "label": "EGZAMINATORZY",
        "href": "/organizacja/egzaminatorzy"
      }
    ]
  },
  {
    "label": "BUDDYZM",
    "href": "/buddyzm",
    "dropdown": [
      {
        "label": "PODSTAWY",
        "href": "/buddyzm/podstawy"
      },
      {
        "label": "NAUKI",
        "href": "/buddyzm/nauki"
      },
      {
        "label": "MEDYTACJA",
        "href": "/buddyzm/medytacja"
      },
      {
        "label": "ETYKA I ŚWIĘTA",
        "href": "/buddyzm/etyka-i-swieta"
      }
    ]
  },
  {
    "label": "GALERIA",
    "href": "/galeria"
  }
];
