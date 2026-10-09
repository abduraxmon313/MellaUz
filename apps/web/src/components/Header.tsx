"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Logo, MellaEmblem } from "./Logo";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OrderDialog } from "./OrderDialog";

export function Header({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const pathname = usePathname() || `/${locale}`;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Sahifa o'zgarsa menyuni yopamiz (render paytida — effektsiz)
  const [menuPath, setMenuPath] = useState(pathname);
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    setMenuOpen(false);
  }

  // Mobil menyu ochiqligida orqa sahifa skroll bo'lmasin
  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.documentElement.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const links = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/catalog`, label: dict.nav.catalog },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  function isActive(href: string) {
    if (href === `/${locale}`) return pathname === href;
    return pathname.startsWith(href);
  }

  const solid = scrolled || menuOpen;

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4">
        <div
          className={`mx-auto flex h-16 max-w-7xl items-center justify-between rounded-full px-4 transition-all duration-500 sm:h-[72px] sm:px-6 ${
            solid
              ? "border border-gold/15 bg-espresso/70 shadow-[0_10px_40px_-20px_rgba(94,59,32,0.35)] backdrop-blur-xl"
              : "border border-transparent bg-transparent"
          }`}
        >
          <Logo locale={locale} />

          <nav className="hidden items-center gap-1 lg:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative rounded-full px-4 py-2 text-[13px] uppercase tracking-[0.14em] transition ${
                    active ? "text-champagne" : "text-pearl/70 hover:text-pearl"
                  }`}
                >
                  {link.label}
                  <span
                    className={`absolute inset-x-4 -bottom-0.5 h-px origin-left bg-linear-to-r from-gold to-transparent transition-transform duration-500 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-5 lg:flex">
            <LanguageSwitcher current={locale} />
            <OrderDialog
              dict={dict}
              locale={locale}
              label={dict.nav.order}
              variant="solid"
              className="!px-5 !py-2.5 !text-[11px]"
            />
          </div>

          <button
            type="button"
            className="relative flex h-11 w-11 items-center justify-center rounded-full border border-pearl/10 text-pearl lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={menuOpen}
          >
            <span
              className={`absolute h-px w-5 bg-current transition-transform duration-300 ${
                menuOpen ? "rotate-45" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`absolute h-px w-5 bg-current transition-opacity duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute h-px w-5 bg-current transition-transform duration-300 ${
                menuOpen ? "-rotate-45" : "translate-y-1.5"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Mobil menyu — to'liq ekran */}
      <div
        className={`fixed inset-0 z-40 flex flex-col overflow-hidden bg-espresso/95 backdrop-blur-xl transition-all duration-500 lg:hidden ${
          menuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
        aria-hidden={!menuOpen}
      >
        <MellaEmblem className="pointer-events-none absolute -right-24 bottom-10 h-[26rem] w-[26rem] opacity-[0.06]" />
        <nav className="relative mt-28 flex flex-col px-6">
          {links.map((link, i) => (
            <Link
              key={link.href}
              href={link.href}
              tabIndex={menuOpen ? 0 : -1}
              onClick={() => setMenuOpen(false)}
              style={{ transitionDelay: menuOpen ? `${120 + i * 60}ms` : "0ms" }}
              className={`flex items-center justify-between border-b border-pearl/10 py-5 font-display text-4xl transition-all duration-500 ${
                menuOpen ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
              } ${isActive(link.href) ? "text-champagne" : "text-pearl"}`}
            >
              {link.label}
              <span className="text-base text-gold/70">0{i + 1}</span>
            </Link>
          ))}
        </nav>
        <div className="relative mt-auto flex items-center justify-between gap-4 px-6 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <LanguageSwitcher current={locale} />
          <OrderDialog
            dict={dict}
            locale={locale}
            label={dict.nav.order}
            variant="solid"
            onOpen={() => setMenuOpen(false)}
          />
        </div>
      </div>
    </>
  );
}
