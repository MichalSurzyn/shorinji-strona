/**
 * Pliki do pobrania - stałe i funkcje pomocnicze.
 *
 * Osobny moduł, bo plik z akcjami serwerowymi (`"use server"`) może
 * eksportować WYŁĄCZNIE funkcje asynchroniczne. Trzymanie tu stałej
 * i funkcji synchronicznej to nie kwestia porządku, a wymóg - inaczej
 * kompilacja pada z komunikatem „Only async functions are allowed to be
 * exported in a use server file".
 */

/** Kubełek w magazynie Supabase. */
export const KUBELEK = "pliki";

/** Największy dopuszczalny rozmiar pliku (bajty). */
export const MAX_ROZMIAR = 20 * 1024 * 1024;

export interface PlikDoPobrania {
  nazwa: string;
  rozmiar: number;
  typ: string | null;
  zmieniony: string;
  /** Adres do wstawiania w treść i w stopkę. */
  adres: string;
}

/**
 * Nazwa pliku bezpieczna w adresie: bez spacji, ogonków i ukośników.
 *
 * Nazwa staje się częścią publicznego adresu, więc „Deklaracja członkowska
 * (dorośli).pdf" musi zostać przepisana - inaczej odnośnik wymagałby
 * kodowania i byłby nieczytelny.
 */
export function bezpiecznaNazwa(nazwa: string): string {
  const kropka = nazwa.lastIndexOf(".");
  const trzon = kropka > 0 ? nazwa.slice(0, kropka) : nazwa;
  const rozszerzenie = kropka > 0 ? nazwa.slice(kropka).toLowerCase() : "";
  const czysty = trzon
    .toLowerCase()
    .replace(/ą/g, "a").replace(/ć/g, "c").replace(/ę/g, "e")
    .replace(/ł/g, "l").replace(/ń/g, "n").replace(/ó/g, "o")
    .replace(/ś/g, "s").replace(/ż/g, "z").replace(/ź/g, "z")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return (czysty || "plik") + rozszerzenie;
}

/** Rozmiar pliku po ludzku, np. „2,3 MB". */
export function formatRozmiar(bajty: number): string {
  if (bajty < 1024) return `${bajty} B`;
  if (bajty < 1024 * 1024) return `${Math.round(bajty / 1024)} kB`;
  return `${(bajty / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}
