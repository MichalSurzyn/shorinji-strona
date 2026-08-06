"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { DEFAULT_NAV, type NavLink } from '@/lib/navTypes';

export default function Navbar({ links }: { links?: NavLink[] }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  const pathname = usePathname();

  // Menu z bazy (przekazane przez layout); fallback - struktura z kodu.
  const navLinks: NavLink[] = links && links.length ? links : DEFAULT_NAV;

  // Chowanie navbara przy scrollu w dół (bez re-subskrypcji na każdy scroll).
  useEffect(() => {
    let lastY = window.scrollY;
    const handleScroll = () => {
      const y = window.scrollY;
      setIsVisible(!(y > lastY && y > 50));
      lastY = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Realna wysokość navbara -> zmienna CSS --nav-h. Dzięki temu treść strony
  // (padding-top w .page-shell) nigdy nie chowa się pod menu, niezależnie
  // od rozmiaru logo czy zawijania linków.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const apply = () =>
      document.documentElement.style.setProperty('--nav-h', `${el.offsetHeight}px`);
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const isActive = (href?: string, dropdown?: { href: string; label: string }[]) => {
    if (href && pathname === href) return true;
    if (href && pathname.startsWith(href + '/')) return true;
    if (dropdown && dropdown.some(item => pathname === item.href || pathname.startsWith(item.href + '/'))) return true;
    return false;
  };

  return (
    <>
      <nav
        ref={navRef}
        className={`fixed w-full top-0 z-50 transition-transform duration-500 bg-black border-b border-neutral-800 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="w-full px-4 md:px-0 md:w-[90%] md:max-w-[87.5rem] mx-auto">

          {/* Wiersz 1: Logo + Social */}
          <div className="flex justify-between items-center py-4 border-b border-neutral-900">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden p-2 text-neutral-300 hover:text-yellow-500 transition-colors"
            >
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
              </div>
            </button>

            <Link href="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
              <Image
                src="https://res.cloudinary.com/dyn3apjzb/image/upload/v1772055354/Logo_pi10ya.jpg"
                alt="Shorinji Kempo Logo"
                width={380}
                height={130}
                className="h-12 sm:h-16 md:h-24 xl:h-32 w-auto max-w-[calc(100vw-7.5rem)] object-contain object-left"
                priority
              />
            </Link>

            {/* Ikony social wyleciały z navbara (zostały w stopce) - tu tylko szybki kontakt. */}
            <div className="flex items-center">
              <Link href="/kontakt" aria-label="Kontakt" className="text-neutral-400 hover:text-yellow-500 transition-colors p-1">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Wiersz 2: Linki */}
          <div className="hidden md:flex flex-wrap justify-between items-center text-[11px] lg:text-sm xl:text-base uppercase tracking-[0.08em]">
            {navLinks.map((link) => (
              <div key={link.label} className="relative group">
                {link.dropdown ? (
                  <>
                    {link.href ? (
                      <Link
                        href={link.href}
                        className={`flex items-center gap-1 transition-colors py-4 border-b-2 ${
                          isActive(link.href, link.dropdown)
                            ? 'text-yellow-500 border-yellow-500'
                            : 'text-neutral-300 border-transparent hover:text-yellow-500'
                        }`}
                      >
                        <span>{link.label}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className={`flex items-center gap-1 transition-colors py-4 border-b-2 ${
                          isActive(undefined, link.dropdown)
                            ? 'text-yellow-500 border-yellow-500'
                            : 'text-neutral-300 border-transparent hover:text-yellow-500'
                        }`}
                      >
                        <span>{link.label}</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                      </button>
                    )}

                    {/* Dropdown - pt-2 = mostek hover */}
                    <div className="absolute top-full left-0 pt-2 hidden group-hover:block z-50">
                      <div className="flex flex-col bg-black border border-neutral-800 shadow-xl py-2 min-w-[220px]">
                        {link.dropdown.map(sublink => (
                          <Link
                            key={sublink.label}
                            href={sublink.href}
                            className={`px-4 py-3 text-sm hover:bg-neutral-900 transition-colors ${
                              pathname === sublink.href ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'
                            }`}
                          >
                            {sublink.label}
                          </Link>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  <Link
                    href={link.href!}
                    className={`block transition-colors py-4 border-b-2 ${
                      isActive(link.href)
                        ? 'text-yellow-500 border-yellow-500'
                        : 'text-neutral-300 border-transparent hover:text-yellow-500'
                    }`}
                  >
                    {link.label}
                  </Link>
                )}
              </div>
            ))}
          </div>

        </div>
      </nav>

      {/* Mobile overlay */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-screen w-72 bg-black border-r border-neutral-800 transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <div className="relative h-20 border-b border-neutral-800 flex items-center px-6">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute left-5 text-neutral-300 hover:text-yellow-500 transition-colors text-5xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="pt-8 px-6 flex flex-col space-y-6 text-sm uppercase tracking-[0.08em]">
          {navLinks.map((link) => (
            <div key={`mobile-${link.label}`}>
              {link.dropdown ? (
                <div className="flex flex-col space-y-4">
                  {link.href ? (
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="text-neutral-500 font-bold hover:text-yellow-500 transition-colors"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    <span className="text-neutral-500 font-bold">{link.label}</span>
                  )}
                  <div className="flex flex-col pl-4 space-y-4 border-l border-neutral-800">
                    {link.dropdown.map(sublink => (
                      <Link
                        key={`mobile-sub-${sublink.label}`}
                        href={sublink.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={pathname === sublink.href ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'}
                      >
                        {sublink.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link
                  href={link.href!}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={pathname === link.href ? 'text-yellow-500' : 'text-neutral-300 hover:text-yellow-500'}
                >
                  {link.label}
                </Link>
              )}
            </div>
          ))}
        </div>
      </aside>
    </>
  );
}
