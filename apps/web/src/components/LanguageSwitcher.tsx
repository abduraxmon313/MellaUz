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
    <div className="flex items-center gap-1" role="group" aria-label="Language">
      {locales.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && <span className="px-1 text-pearl/25">·</span>}
          <Link
            href={hrefFor(l)}
            aria-current={l === current ? "true" : undefined}
            className={
              l === current
                ? "text-xs font-semibold tracking-wider text-champagne"
                : "text-xs tracking-wider text-pearl/55 transition hover:text-pearl"
            }
          >
            {localeShort[l]}
          </Link>
        </span>
      ))}
    </div>
  );
}
