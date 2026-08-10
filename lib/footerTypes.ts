/** Dane stopki - edytowalne w panelu (Stopka strony). */

export type FooterLink = { label: string; href: string };

/** Rodzaj kolumny decyduje o tym, skąd bierze treść. */
export type FooterKolumnaRodzaj =
  /** Lista odnośników wpisanych ręcznie. */
  | "linki"
  /** Adres, telefon i e-mail z zakładki „Dane organizacji". */
  | "kontakt";

export interface FooterKolumna {
  /** Stabilny identyfikator - nie zmieniać po zapisie. */
  id: string;
  /** Nagłówek kolumny widoczny na stronie. */
  tytul: string;
  rodzaj: FooterKolumnaRodzaj;
  /** Wyłączona kolumna znika ze strony, ale zostaje w panelu. */
  widoczna: boolean;
  /** Ikony profili społecznościowych pod treścią tej kolumny. */
  pokazProfile: boolean;
  /** Tylko dla rodzaju „linki". */
  pozycje: FooterLink[];
}

export interface FooterData {
  /**
   * Kolumny stopki w kolejności wyświetlania.
   *
   * Wcześniej stopka miała cztery kolumny zakute w kodzie, z nagłówkami
   * wpisanymi w JSX. Redaktor nie mógł ani zmienić ich kolejności, ani
   * ukryć jednej, ani dodać własnej.
   */
  kolumny: FooterKolumna[];
  /**
   * Zapasowa nazwa po znaku ©. Pierwszeństwo ma pole z Danych organizacji -
   * to pole zostaje wyłącznie na wypadek pustej wartości tam.
   */
  copyright: string;
}

/** Stopka bazowa z kodu - fallback, gdy baza nie odpowiada. */
export const DEFAULT_FOOTER: FooterData = {
  kolumny: [
    {
      id: "linki",
      tytul: "LINKI",
      rodzaj: "linki",
      widoczna: true,
      pokazProfile: true,
      pozycje: [],
    },
    {
      id: "do-pobrania",
      tytul: "DO POBRANIA",
      rodzaj: "linki",
      widoczna: true,
      pokazProfile: false,
      pozycje: [
        { label: "Deklaracja członkowska – od 18 lat", href: "/downloads/deklaracja-dorosli.pdf" },
        { label: "Deklaracja członkowska – do 18 lat", href: "/downloads/deklaracja-do-18.pdf" },
      ],
    },
    {
      id: "dokumenty",
      tytul: "DOKUMENTY",
      rodzaj: "linki",
      widoczna: true,
      pokazProfile: false,
      pozycje: [
        { label: "Statut POSK", href: "/downloads/statut-posk.pdf" },
        { label: "Statut WSKO (kiyaku)", href: "/downloads/wsko-statutes.pdf" },
        { label: "Regulamin WSKO (bylaws)", href: "/downloads/wsko-bylaws.pdf" },
        { label: "Przepisy WSKO (regulations)", href: "/downloads/wsko-regulations.pdf" },
      ],
    },
    {
      id: "kontakt",
      tytul: "KONTAKT",
      rodzaj: "kontakt",
      widoczna: true,
      pokazProfile: false,
      pozycje: [],
    },
  ],
  copyright: "POLSKA ORGANIZACJA SHORINJI KEMPO.",
};

/** Kształt stopki sprzed wprowadzenia kolumn - do jednorazowej migracji. */
interface StaraStopka {
  links?: FooterLink[];
  downloads?: FooterLink[];
  documents?: FooterLink[];
  copyright?: string;
}

/**
 * Przepisuje stary układ na kolumny.
 *
 * Wywoływane przy odczycie, więc wpis zapisany przed tą zmianą nie wymaga
 * migracji w bazie - stopka wygląda tak samo, dopóki redaktor niczego nie
 * zapisze, a przy pierwszym zapisie utrwala się już w nowym kształcie.
 */
export function migrujStopke(stare: StaraStopka): FooterData {
  const kolumny = DEFAULT_FOOTER.kolumny.map((k) => {
    if (k.id === "linki") return { ...k, pozycje: stare.links ?? [] };
    if (k.id === "do-pobrania") return { ...k, pozycje: stare.downloads ?? k.pozycje };
    if (k.id === "dokumenty") return { ...k, pozycje: stare.documents ?? k.pozycje };
    return { ...k };
  });
  return { kolumny, copyright: stare.copyright ?? DEFAULT_FOOTER.copyright };
}
