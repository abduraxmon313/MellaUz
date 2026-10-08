"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { Logo } from "./Logo";
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

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

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

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled || menuOpen
          ? "border-b border-mocha/30 bg-espresso/90 backdrop-blur-md"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:h-20 lg:px-8">
        <Logo locale={locale} />

        <nav className="hidden items-center gap-8 lg:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm uppercase tracking-wider transition ${
                isActive(link.href)
                  ? "text-champagne"
                  : "text-pearl/70 hover:text-pearl"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-5 lg:flex">
          <LanguageSwitcher current={locale} />
          <OrderDialog
            dict={dict}
            locale={locale}
            label={dict.nav.order}
            variant="solid"
            className="!py-2.5 !text-xs"
          />
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center text-pearl lg:hidden"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label={menuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
          aria-expanded={menuOpen}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            {menuOpen ? (
              <path
                d="M18 6 6 18M6 6l12 12"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            ) : (
              <path
                d="M3 6h18M3 12h18M3 18h18"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Mobil menyu */}
      {menuOpen && (
        <div className="animate-fade-in border-t border-mocha/30 bg-espresso/95 px-5 py-6 lg:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3 py-3 text-base uppercase tracking-wide transition ${
                  isActive(link.href)
                    ? "bg-chocolate/50 text-champagne"
                    : "text-pearl/80 hover:bg-chocolate/40"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-5 flex items-center justify-between border-t border-mocha/30 pt-5">
            <LanguageSwitcher current={locale} />
            <OrderDialog
              dict={dict}
              locale={locale}
              label={dict.nav.order}
              variant="solid"
              className="!py-2.5 !text-xs"
            />
          </div>
        </div>
      )}
    </header>
  );
}
