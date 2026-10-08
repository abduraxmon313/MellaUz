import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { site } from "@/lib/site";

function InstagramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function TelegramIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M21.5 4.3 2.9 11.4c-.9.3-.9 1.6.1 1.9l4.6 1.4 1.8 5.5c.3.8 1.3 1 1.9.3l2.5-2.6 4.6 3.4c.7.5 1.7.1 1.9-.7L23 5.6c.2-1-.6-1.7-1.5-1.3Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Footer({ dict, locale }: { dict: Dictionary; locale: Locale }) {
  const links = [
    { href: `/${locale}`, label: dict.nav.home },
    { href: `/${locale}/catalog`, label: dict.nav.catalog },
    { href: `/${locale}/about`, label: dict.nav.about },
    { href: `/${locale}/contact`, label: dict.nav.contact },
  ];

  return (
    <footer className="border-t border-mocha/25 bg-dark-chocolate">
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
        <div>
          <span className="font-display text-3xl tracking-[0.42em] text-pearl">
            MELLA
          </span>
          <p className="mt-2 text-xs uppercase tracking-[0.3em] text-gold/80">
            {dict.meta.tagline}
          </p>
          <p className="mt-5 max-w-sm text-sm leading-relaxed text-pearl/55">
            {dict.footer.about}
          </p>
        </div>

        <div>
          <h3 className="mb-4 text-xs uppercase tracking-wider text-pearl/50">
            {dict.footer.navTitle}
          </h3>
          <ul className="space-y-2.5">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-pearl/75 transition hover:text-champagne"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-4 text-xs uppercase tracking-wider text-pearl/50">
            {dict.footer.contactTitle}
          </h3>
          <ul className="space-y-2.5 text-sm text-pearl/75">
            <li>{site.address[locale]}</li>
            {site.phone && (
              <li>
                <a href={`tel:${site.phoneHref}`} className="transition hover:text-champagne">
                  {site.phone}
                </a>
              </li>
            )}
            <li>{dict.contact.hoursLabel}: {site.hours}</li>
          </ul>

          <div className="mt-5 flex items-center gap-3">
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-mocha/50 text-pearl/70 transition hover:border-gold hover:text-champagne"
            >
              <InstagramIcon />
            </a>
            {site.telegram && (
              <a
                href={site.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className="flex h-10 w-10 items-center justify-center rounded-full border border-mocha/50 text-pearl/70 transition hover:border-gold hover:text-champagne"
              >
                <TelegramIcon />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-mocha/25">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-5 py-6 text-xs text-pearl/45 sm:flex-row lg:px-8">
          <p>
            © {new Date().getFullYear()} MELLA. {dict.footer.rights}
          </p>
          <p className="tracking-wider">{dict.footer.madeWith} 🇺🇿</p>
        </div>
      </div>
    </footer>
  );
}
