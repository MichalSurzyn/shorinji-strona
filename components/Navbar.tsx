"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image'; // Importujemy wbudowany komponent Next.js do zdjęć

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: '#', label: 'Grupa dziecięca', highlighted: true },
    { href: '#', label: 'Aktualności' },
    { href: '#', label: 'Cennik' },
    { href: '#', label: 'Program nauczania' },
    { href: '#', label: 'Historia' },
    { href: '#', label: 'Galeria' },
  ];

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setIsVisible(false);
      } else {
        setIsVisible(true);
      }
      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastScrollY]);

  return (
    <>
      <nav
        className={`fixed w-full top-0 z-30 transition-transform duration-300 bg-black border-b border-neutral-800 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative flex justify-center items-center h-20 gap-8 lg:gap-16">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="md:hidden absolute left-0 p-2 text-neutral-300 hover:text-white transition-colors"
              aria-label={isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">{isMobileMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}</span>
              <div className="w-6 h-5 flex flex-col justify-between">
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
                <span className="block h-0.5 w-full bg-current rounded" />
              </div>
            </button>

            <Link href="/" className="flex-shrink-0 flex items-center transition-opacity hover:opacity-80">
              <Image
                src="https://res.cloudinary.com/dyn3apjzb/image/upload/v1772052300/logo_svjia9.avif"
                alt="Shorinji Kempo Logo"
                width={300}
                height={60}
                className="h-10 md:h-12 w-auto object-contain"
                priority
              />
            </Link>

            <div className="hidden md:flex items-center space-x-6 text-sm lg:text-base">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className={
                    link.highlighted
                      ? 'text-red-500 hover:text-red-400 transition-colors'
                      : 'text-neutral-300 hover:text-white transition-colors'
                  }
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>

      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/50 transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-screen w-72 bg-black border-r border-neutral-800 transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-hidden={!isMobileMenuOpen}
      >
        <div className="relative h-20 border-b border-neutral-800">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute left-6 top-1/2 -translate-y-1/2 p-2 text-neutral-300 hover:text-white transition-colors"
            aria-label="Zamknij menu"
          >
            <span className="text-4xl leading-none">×</span>
          </button>
        </div>

        <div className="pt-8 px-6 flex flex-col space-y-6 text-base">
          {navLinks.map((link) => (
            <Link
              key={`mobile-${link.label}`}
              href={link.href}
              className={
                link.highlighted
                  ? 'text-red-500 hover:text-red-400 transition-colors'
                  : 'text-neutral-300 hover:text-white transition-colors'
              }
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </aside>
    </>
  );
}