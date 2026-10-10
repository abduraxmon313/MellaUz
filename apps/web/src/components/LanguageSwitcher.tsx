"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { localeShort, locales, type Locale } from "@/i18n/config";

export function LanguageSwitcher({ current }: { current: Locale }) {
  const pathname = usePathname() || `/${current}`;

  function hrefFor(target: Locale): string {
    const segments = pathname.split("/");
    // segments[0] = "", segments[1] = joriy til
    if (segments.length > 1) segments[1] = target;
    const next = segments.join("/");
    return next || `/${target}`;
  }

  return (
    <div
      className="inline-flex items-center rounded-full border border-line bg-paper p-1"
      role="group"
      aria-label="Language"
    >
      {locales.map((l) => {
        const active = l === current;
        return (
          <Link
            key={l}
            href={hrefFor(l)}
            hrefLang={l}
            aria-current={active ? "true" : undefined}
            className={`inline-flex h-8 min-w-10 items-center justify-center rounded-full px-2.5 text-[11px] tracking-[0.12em] transition-colors ${
              active
                ? "bg-brown font-semibold text-cream"
                : "font-medium text-muted hover:bg-ivory hover:text-brown"
            }`}
          >
            {localeShort[l]}
          </Link>
        );
      })}
    </div>
  );
}
