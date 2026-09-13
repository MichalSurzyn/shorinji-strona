"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

/**
 * Menu panelu nazwane rzeczami, które redaktor widzi na stronie klubu,
 * a nie pojęciami z kodu. „Nawigacja" nie mówi nic osobie, która szuka
 * sposobu na zmianę menu na górze strony; „Harmonogram" brzmi urzędowo
 * przy grafiku zajęć.
 *
 * Kolejność wynika z częstości użycia: aktualności i zdjęcia zmienia się
 * co tydzień, dane organizacji raz na kilka lat.
 */
const NAV = [
  { href: "/admin", label: "Pulpit", icon: "▦" },
  { href: "/admin/artykuly", label: "Aktualności", icon: "✎" },
  { href: "/admin/drzewo", label: "Strony i menu", icon: "⌗" },
  // Zakładka „Strony" zdjęta w etapie F. Treść ośmiu stron o stałym układzie
  // edytuje się teraz w „Strony i menu", przez pomost `pages.content_key` —
  // dwie zakładki nad jedną stroną zgłoszono jako „bez sensu". Same trasy
  // `/admin/strony` i `/admin/strona/<slug>` ZOSTAJĄ dostępne pod adresem:
  // ktoś mógł je mieć w zakładkach przeglądarki, a 404 zamiast działającego
  // ekranu byłby gorszy od nadmiarowej pozycji w menu.
  { href: "/admin/zdjecia", label: "Zdjęcia", icon: "▣" },
  { href: "/admin/pliki", label: "Pliki do pobrania", icon: "⬇" },
  { href: "/admin/harmonogram", label: "Grafik zajęć", icon: "◷" },
  { href: "/admin/wiadomosci", label: "Wiadomości", icon: "✉" },
  { href: "/admin/stopka", label: "Stopka strony", icon: "▁" },
  { href: "/admin/dane-organizacji", label: "Dane organizacji", icon: "🏛" },
  { href: "/admin/admini", label: "Dostęp do panelu", icon: "♟" },
];

export default function AdminShell({
  email,
  name,
  children,
}: {
  email: string;
  name: string | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  async function logout() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }

  const isActive = (href: string) =>
    href === "/admin"
      ? pathname === "/admin"
      : pathname === href || pathname.startsWith(href + "/") ||
        // „Strony i menu" podświetla się także na ekranie edycji węzła,
        // a „Strony" na edytorze tras o stałym układzie. Bez tego zakładka
        // gaśnie w chwili, w której redaktor wchodzi w cokolwiek — i wygląda
        // to, jakby wypadł z panelu.
        (href === "/admin/drzewo" && pathname.startsWith("/admin/drzewo")) ||
        (href === "/admin/strony" && pathname.startsWith("/admin/strona/"));

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold select-none">
          拳
        </div>
        <div className="leading-tight">
          <div className="font-bold text-slate-900">Panel strony</div>
          <div className="text-xs text-slate-500">Shorinji Kempo Kraków</div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive(item.href)
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <span className="w-5 text-center">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="px-3 py-4 border-t border-slate-200 space-y-1">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <span className="w-5 text-center">↗</span> Zobacz stronę
        </a>
        <div className="px-3 py-2">
          <div className="text-sm font-medium text-slate-900 truncate">
            {name ?? email}
          </div>
          <div className="text-xs text-slate-500 truncate">{email}</div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
        >
          <span className="w-5 text-center">⏻</span> Wyloguj
        </button>
      </div>
    </div>
  );

  return (
    // Atrybut nie jest ozdobą: po nim `globals.css` poznaje, że to panel, i podnosi
    // skalę korzenia (patrz `html:has([data-panel-admina])`). Usunięcie go cofa
    // panel do skali 0.8x przeznaczonej dla ciemnej strony klubu.
    <div
      data-panel-admina
      className="fixed inset-0 z-[80] bg-slate-100 text-slate-900 flex flex-col lg:flex-row"
    >
      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-64 shrink-0 bg-white border-r border-slate-200 h-full">
        {sidebar}
      </aside>

      {/* Topbar mobile */}
      <div className="lg:hidden shrink-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold select-none">
            拳
          </div>
          <span className="font-bold">Panel strony</span>
        </div>
        <button
          onClick={() => setMenuOpen(true)}
          className="p-2 text-slate-600"
          aria-label="Menu"
        >
          ☰
        </button>
      </div>

      {/* Drawer mobile */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-[90]">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-white shadow-2xl">
            {sidebar}
          </div>
        </div>
      )}

      {/* Kolumna treści była `max-w-5xl`, czyli 64rem — a korzeń serwisu ma
          `font-size: clamp(12.8px, …, 15.2px)`, więc na typowym ekranie
          wychodziło z tego ~800 px użytecznej szerokości przy oknie 1920.
          Zgłoszenie właściciela: „masz dużo miejsca, a bardzo ciasno to
          robisz”. Ta jedna liczba była powodem, dla którego rząd sześciu
          kontrolek w drzewie stron nie mieścił się obok nazwy i musiał
          zjeżdżać do własnej linii.

          `max-w-[84rem]` daje ~1150–1280 px zależnie od rozdzielczości.
          Bloki tekstowe na ekranach panelu i tak mają własne `max-w-3xl`,
          więc akapity nie rozciągają się do nieczytelnej długości — szerzej
          robi się tylko tam, gdzie treścią jest tabela albo rząd kontrolek. */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        {/* 84rem zostaje. Próba zwężenia do 64rem (żeby spełnić „na 150% jest za
            bardzo rozszerzone") skasowała układ, dla którego kolumnę w ogóle
            poszerzano: zmierzone playwrightem 0 z 36 rzędów miało przyciski
            w jednej linii z nazwą, przy 28 z 36 przed zmianą. `max-w-5xl`
            w Tailwindzie v4 to dokładnie 64rem, więc było to cofnięcie
            poprzedniej poprawki, nie „leciutkie zwężenie".

            Zwężenie robimy tam, gdzie naprawdę boli — w samym rzędzie kontrolek
            drzewa (jego `min-w-*` są liczone w `rem`, więc urosły razem ze
            skalą) — a nie na kolumnie, która trzyma cały panel. */}
        <div className="max-w-[84rem] mx-auto px-4 sm:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
