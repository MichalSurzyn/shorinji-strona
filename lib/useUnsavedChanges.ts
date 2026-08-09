"use client";

import { useEffect } from "react";

/**
 * Ostrzega przed opuszczeniem edytora z niezapisanymi zmianami.
 *
 * Panel nie ma autozapisu ani historii wersji, więc zamknięcie karty albo
 * kliknięcie w menu boczne kasuje pracę bezpowrotnie. To najkosztowniejsza
 * pomyłka, jaką da się tu popełnić, i jedyna, której użytkownik nie może
 * cofnąć.
 *
 * Sam `beforeunload` nie wystarcza: łapie zamknięcie karty i odświeżenie,
 * ale NIE łapie nawigacji wewnątrz aplikacji (Link w menu bocznym), bo
 * App Router zmienia widok bez przeładowania strony. Dlatego przechwytujemy
 * dodatkowo kliknięcia w odnośniki oraz przycisk „wstecz" przeglądarki.
 *
 * Ostrzeżenie pojawia się WYŁĄCZNIE wtedy, gdy coś faktycznie zmieniono -
 * fałszywe alarmy uczą odruchowego klikania „wyjdź" i psują cały mechanizm.
 *
 * @param isDirty Czy w edytorze są niezapisane zmiany.
 * @param nazwa   Nazwa edytowanej rzeczy, wchodzi w treść pytania.
 */
export function useUnsavedChanges(isDirty: boolean, nazwa?: string) {
  useEffect(() => {
    if (!isDirty) return;

    const co = nazwa ? `w edytorze: ${nazwa}` : "w tym edytorze";
    const pytanie =
      `Masz niezapisane zmiany ${co}.\n\n` +
      "Jeśli teraz wyjdziesz, przepadną. Kliknij Anuluj, żeby wrócić i zapisać.";

    // 1. Zamknięcie karty, odświeżenie, wpisanie innego adresu.
    //    Przeglądarka pokazuje własny komunikat - treści nie da się podmienić.
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    // 2. Kliknięcie w odnośnik wewnątrz panelu (menu boczne, „← Wszystkie
    //    podstrony", odnośnik do pulpitu). Faza przechwytywania, żeby zdążyć
    //    przed routerem Next.js.
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const a = (e.target as HTMLElement | null)?.closest?.("a");
      if (!a) return;

      const href = a.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      // Podgląd strony publicznej otwiera się w nowej karcie - nie tracimy pracy.
      if (a.target === "_blank") return;
      // Adresy zewnętrzne obsłuży beforeunload.
      if (/^https?:\/\//i.test(href) && !href.startsWith(window.location.origin)) return;

      if (!window.confirm(pytanie)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // 3. Przycisk „wstecz". Nie da się go zablokować wprost, więc wpychamy
    //    wpis do historii i przy cofnięciu pytamy, a przy odmowie wracamy.
    const onPopState = () => {
      if (!window.confirm(pytanie)) {
        history.pushState(null, "", window.location.href);
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    history.pushState(null, "", window.location.href);
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
    };
  }, [isDirty, nazwa]);
}

/**
 * Czy stan edytora różni się od ostatnio zapisanego.
 * Porównanie po serializacji - stan edytorów to zwykłe obiekty i tablice
 * (teksty, bloki treści), bez dat, funkcji i referencji cyklicznych.
 */
export function czyZmieniono(biezacy: unknown, zapisany: unknown): boolean {
  return JSON.stringify(biezacy) !== JSON.stringify(zapisany);
}
