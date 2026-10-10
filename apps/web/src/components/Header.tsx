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
      <header
        className={`fixed inset-x-0 top-0 z-50 border-b transition-[background-color,border-color,box-shadow] duration-300 ${
          solid
            ? "border-line bg-cream/95 shadow-[0_8px_30px_-22px_rgba(38,25,24,0.45)] backdrop-blur-xl"
            : "border-line/80 bg-cream/[0.97] backdrop-blur-md"
        }`}
      >
        <div className="container-site flex h-[var(--header-h)] items-center justify-between gap-4">
          <Logo locale={locale} />

          <nav aria-label={dict.nav.home} className="hidden items-center gap-1 lg:flex">
            {links.map((link) => {
              const active = isActive(link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative px-4 py-2.5 text-[12.5px] font-medium uppercase tracking-[0.14em] transition-colors ${
                    active ? "text-brown" : "text-muted hover:text-brown"
                  }`}
                >
                  {link.label}
                  <span
                    aria-hidden
                    className={`absolute inset-x-4 bottom-0.5 h-[2px] origin-center rounded-full bg-gold transition-transform duration-300 ${
                      active ? "scale-x-100" : "scale-x-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-6 lg:flex">
            <LanguageSwitcher current={locale} />
            <OrderDialog
              dict={dict}
              locale={locale}
              label={dict.nav.order}
              variant="solid"
              size="sm"
            />
          </div>

          <button
            type="button"
            className="icon-btn relative lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? dict.nav.closeMenu : dict.nav.openMenu}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            <span
              className={`absolute h-[1.5px] w-5 rounded-full bg-current transition-transform duration-300 ${
                menuOpen ? "rotate-45" : "-translate-y-1.5"
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-5 rounded-full bg-current transition-opacity duration-300 ${
                menuOpen ? "opacity-0" : ""
              }`}
            />
            <span
              className={`absolute h-[1.5px] w-5 rounded-full bg-current transition-transform duration-300 ${
                menuOpen ? "-rotate-45" : "translate-y-1.5"
              }`}
            />
          </button>
        </div>
      </header>

      {/* Mobil menyu — sarlavha ostidan to'liq ekran */}
      <div
        id="mobile-menu"
        className={`fixed inset-x-0 bottom-0 top-[var(--header-h)] z-40 flex flex-col overflow-y-auto bg-cream transition-[opacity,visibility] duration-300 lg:hidden ${
          menuOpen ? "visible opacity-100" : "invisible opacity-0"
        }`}
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <MellaEmblem className="pointer-events-none absolute -right-20 bottom-24 h-80 w-80 opacity-[0.07]" />
        <nav className="relative flex flex-col px-5 pt-4">
          {links.map((link, i) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
                style={{ transitionDelay: menuOpen ? `${60 + i * 40}ms` : "0ms" }}
                className={`flex items-center justify-between gap-4 border-b border-line py-5 font-display text-[2rem] leading-none transition-[opacity,transform] duration-400 ${
                  menuOpen ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                } ${active ? "text-brown" : "text-brown/75"}`}
              >
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden
                    className={`h-6 w-[3px] rounded-full ${active ? "bg-gold" : "bg-transparent"}`}
                  />
                  {link.label}
                </span>
                <span className="font-sans text-xs tracking-[0.2em] text-bronze">0{i + 1}</span>
              </Link>
            );
          })}
        </nav>
        <div className="relative mt-auto flex flex-wrap items-center justify-between gap-4 border-t border-line bg-ivory/60 px-5 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
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
