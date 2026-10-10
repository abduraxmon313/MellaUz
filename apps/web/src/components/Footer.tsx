import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import { site } from "@/lib/site";
import { Logo, MellaEmblem } from "./Logo";

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

  const social =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-cream/15 text-cream/80 transition-colors hover:border-gold hover:text-gold-light";

  return (
    <footer className="on-dark grain relative overflow-hidden bg-espresso text-cream">
      <div aria-hidden className="h-px bg-linear-to-r from-transparent via-gold/60 to-transparent" />
      <MellaEmblem className="pointer-events-none absolute -right-20 -top-10 h-[28rem] w-[28rem] opacity-[0.05]" />
      <div className="container-site relative grid gap-12 py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:py-20">
        <div>
          <Logo locale={locale} size="lg" tone="dark" />
          <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-gold">
            {dict.meta.tagline}
          </p>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-sand">{dict.footer.about}</p>
        </div>

        <nav aria-label={dict.footer.navTitle}>
          <h3 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sand">
            {dict.footer.navTitle}
          </h3>
          <ul className="space-y-3">
            {links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="text-sm text-cream/85 transition-colors hover:text-gold-light"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-sand">
            {dict.footer.contactTitle}
          </h3>
          <ul className="space-y-3 text-sm text-cream/85">
            <li>{site.address[locale]}</li>
            {site.phone && (
              <li>
                <a
                  href={`tel:${site.phoneHref}`}
                  className="tabular-nums transition-colors hover:text-gold-light"
                >
                  {site.phone}
                </a>
              </li>
            )}
            <li>
              <span className="text-sand">{dict.contact.hoursLabel}:</span> {site.hours}
            </li>
          </ul>

          <div className="mt-6 flex items-center gap-3">
            <a
              href={site.instagram}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Instagram"
              className={social}
            >
              <InstagramIcon />
            </a>
            {site.telegram && (
              <a
                href={site.telegram}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Telegram"
                className={social}
              >
                <TelegramIcon />
              </a>
            )}
          </div>
        </div>
      </div>

      <div className="relative border-t border-cream/10">
        <div className="container-site flex flex-col items-center justify-between gap-2 py-6 text-xs text-sand sm:flex-row">
          <p>
            © {new Date().getFullYear()} MELLA. {dict.footer.rights}
          </p>
          <p className="tracking-wider">{dict.footer.madeWith} 🇺🇿</p>
        </div>
      </div>
    </footer>
  );
}
