"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export default function Navbar() {
  const [isVisible, setIsVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const pathname = usePathname();

  const navLinks = [
    {
      label: 'ZAJĘCIA',
      dropdown: [
        { href: '/zajecia/dorosli', label: 'GRUPA DOROSŁA' },
        { href: '/zajecia/dzieci', label: 'GRUPA DZIECIĘCA' },
      ],
    },
    { href: '/aktualnosci', label: 'AKTUALNOŚCI' },
    { href: '/cennik', label: 'CENNIK' },
    { href: '/program-nauczania', label: 'PROGRAM NAUCZANIA' },
    { href: '/historia', label: 'HISTORIA' },
    { href: '/galeria', label: 'GALERIA' },
    { href: '/o-shorinji', label: 'O SHORINJI KEMPO' },
    { href: '/organizacja', label: 'ORGANIZACJA' },
    { href: '/buddyzm', label: 'BUDDYZM' },
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

  const isActive = (href?: string, dropdown?: any[]) => {
    if (href && pathname === href) return true;
    if (dropdown && dropdown.some(item => pathname === item.href)) return true;
    return false;
  };

  return (
    <>
      <nav
        className={`fixed w-full top-0 z-50 transition-transform duration-500 bg-black border-b border-neutral-800 ${
          isVisible ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="w-[80%] mx-auto">
          
          {/* Wiersz 1: Powiększone Logo i Social Media */}
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

            {/* Powiększone logo */}
            <Link href="/" className="flex-shrink-0 transition-opacity hover:opacity-80">
              <Image
                src="https://res.cloudinary.com/dyn3apjzb/image/upload/v1772055354/Logo_pi10ya.jpg"
                alt="Shorinji Kempo Logo"
                width={320} 
                height={70} 
                className="h-12 md:h-16 w-auto object-contain" 
                priority
              />
            </Link>

            <div className="flex items-center space-x-4 md:space-x-6">
              <Link href="#" className="text-neutral-400 hover:text-yellow-500 transition-colors">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" /></svg>
              </Link>
              <Link href="#" className="text-neutral-400 hover:text-yellow-500 transition-colors">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12.315 2c2.43 0 2.784.013 3.808.06 1.064.049 1.791.218 2.427.465a4.902 4.902 0 011.772 1.153 4.902 4.902 0 011.153 1.772c.247.636.416 1.363.465 2.427.048 1.067.06 1.407.06 4.123v.08c0 2.643-.012 2.987-.06 4.043-.049 1.064-.218 1.791-.465 2.427a4.902 4.902 0 01-1.153 1.772 4.902 4.902 0 01-1.772 1.153c-.636.247-1.363.416-2.427.465-1.067.048-1.407.06-4.123.06h-.08c-2.643 0-2.987-.012-4.043-.06-1.064-.049-1.791-.218-2.427-.465a4.902 4.902 0 01-1.772-1.153 4.902 4.902 0 01-1.153-1.772c-.247-.636-.416-1.363-.465-2.427-.047-1.024-.06-1.379-.06-3.808v-.63c0-2.43.013-2.784.06-3.808.049-1.064.218-1.791.465-2.427a4.902 4.902 0 011.153-1.772A4.902 4.902 0 015.45 2.525c.636-.247 1.363-.416 2.427-.465C8.901 2.013 9.256 2 11.685 2h.63zm-.081 1.802h-.468c-2.456 0-2.784.011-3.807.058-.975.045-1.504.207-1.857.344-.467.182-.8.398-1.15.748-.35.35-.566.683-.748 1.15-.137.353-.3.882-.344 1.857-.047 1.023-.058 1.351-.058 3.807v.468c0 2.456.011 2.784.058 3.807.045.975.207 1.504.344 1.857.182.466.399.8.748 1.15.35.35.683.566 1.15.748.353.137.882.3 1.857.344 1.054.048 1.37.058 4.041.058h.08c2.597 0 2.917-.01 3.96-.058.976-.045 1.505-.207 1.858-.344.466-.182.8-.398 1.15-.748.35-.35.566-.683.748-1.15.137-.353.3-.882.344-1.857.048-1.055.058-1.37.058-4.041v-.08c0-2.597-.01-2.917-.058-3.96-.045-.976-.207-1.505-.344-1.858a3.097 3.097 0 00-.748-1.15 3.098 3.098 0 00-1.15-.748c-.353-.137-.882-.3-1.857-.344-1.023-.047-1.351-.058-3.807-.058zM12 6.865a5.135 5.135 0 110 10.27 5.135 5.135 0 010-10.27zm0 1.802a3.333 3.333 0 100 6.666 3.333 3.333 0 000-6.666zm5.338-3.205a1.2 1.2 0 110 2.4 1.2 1.2 0 010-2.4z" clipRule="evenodd" /></svg>
              </Link>
              <Link href="mailto:kontakt@kempo.pl" className="text-neutral-400 hover:text-yellow-500 transition-colors">
                <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
              </Link>
            </div>
          </div>

          {/* Wiersz 2: Linki ( wyrównanie i dropdown) */}
          <div className="hidden md:flex flex-wrap justify-between items-center text-[11px] lg:text-sm xl:text-base uppercase tracking-[0.08em]">
            {navLinks.map((link) => (
              <div key={link.label} className="relative group">
                
                {link.dropdown ? (
                  <>
                    {/* Wymuszenie równego baselinu z użyciem py-4 */}
                    <button className={`flex items-center gap-1 transition-colors py-4 border-b-2 ${
                      isActive(undefined, link.dropdown) 
                        ? 'text-yellow-500 border-yellow-500' 
                        : 'text-neutral-300 border-transparent hover:text-yellow-500'
                    }`}>
                      <span>{link.label}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </button>
                    
                    {/* Dropdown - z mostkiem żeby myszka nie zjeżdżała */}
                    <div className="absolute top-[100%] left-0 hidden group-hover:block">
                      <div className="flex flex-col bg-black border border-neutral-800 shadow-xl py-2 min-w-[200px]">
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

      {/* Tło dla mobilnego menu */}
      <div
        className={`md:hidden fixed inset-0 z-40 bg-black/80 backdrop-blur-sm transition-opacity duration-300 ${
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Boczny panel (Mobile Menu) */}
      <aside
        className={`md:hidden fixed top-0 left-0 z-50 h-screen w-72 bg-black border-r border-neutral-800 transition-transform duration-300 ${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        } overflow-y-auto`}
      >
        <div className="relative h-20 border-b border-neutral-800 flex items-center px-6">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="absolute left-16 text-neutral-300 hover:text-yellow-500 transition-colors text-5xl leading-none "
          >
            ×
          </button>
        </div>

        <div className="pt-8 px-6 flex flex-col space-y-6 text-sm uppercase tracking-[0.08em]">
          {navLinks.map((link) => (
            <div key={`mobile-${link.label}`}>
              {link.dropdown ? (
                <div className="flex flex-col space-y-4">
                  <span className="text-neutral-500 font-bold">{link.label}</span>
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