"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Pulpit", icon: "▦" },
  { href: "/admin/strony", label: "Podstrony", icon: "❏" },
  { href: "/admin/artykuly", label: "Aktualności", icon: "✎" },
  { href: "/admin/zdjecia", label: "Zdjęcia", icon: "▣" },
  { href: "/admin/harmonogram", label: "Harmonogram", icon: "◷" },
  { href: "/admin/admini", label: "Administratorzy", icon: "♟" },
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
        (href === "/admin/strony" && pathname.startsWith("/admin/edit"));

  const sidebar = (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-200">
        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xl font-bold select-none">
          拳
        </div>
        <div className="leading-tight">
          <div className="font-bold text-slate-900">Panel admina</div>
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
    <div className="fixed inset-0 z-[80] bg-slate-100 text-slate-900 flex flex-col lg:flex-row">
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
          <span className="font-bold">Panel admina</span>
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

      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
