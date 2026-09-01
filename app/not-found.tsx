import Link from "next/link";

/**
 * Własna strona 404.
 *
 * Dlaczego dopiero w etapie 4, a nie w 0: ta strona zmienia treść odpowiedzi dla
 * KAŻDEGO martwego adresu, czyli zmienia dokładnie to, co golden master zapisał
 * jako punkt odniesienia. Wcześniej byłaby zmianą zachowania udającą pomiar.
 *
 * Dotąd każdy martwy link kończył się domyślnym ekranem Next: „404 | This page
 * could not be found", po angielsku i bez drogi powrotu do serwisu.
 */
export default function NotFound() {
  return (
    <div className="relative page-shell pb-20 min-h-screen">
      <div className="container-site z-10 relative max-w-3xl">
        <p className="text-yellow-500 text-xs uppercase tracking-[0.18em] font-semibold mb-2">
          Błąd 404
        </p>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
          Nie ma takiej strony
        </h1>
        <p className="text-neutral-300 text-lg mb-10">
          Adres jest błędny albo strona została przeniesiona. Poniżej najczęściej
          szukane miejsca — menu na górze prowadzi do reszty serwisu.
        </p>

        <ul className="flex flex-col gap-3 list-none m-0 p-0">
          {[
            { href: "/", label: "Strona główna" },
            { href: "/aktualnosci", label: "Aktualności" },
            { href: "/zajecia/dorosli", label: "Zajęcia — grupa dorosła" },
            { href: "/zajecia/dzieci", label: "Zajęcia — grupa dziecięca" },
            { href: "/zajecia/cennik", label: "Cennik" },
            { href: "/kontakt", label: "Kontakt" },
          ].map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="text-neutral-300 hover:text-yellow-500 transition-colors underline underline-offset-4 decoration-neutral-700 hover:decoration-yellow-500"
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
