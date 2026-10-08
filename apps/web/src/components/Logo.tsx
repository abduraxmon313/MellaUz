import Link from "next/link";
import type { Locale } from "@/i18n/config";

export function Logo({
  locale,
  className = "",
}: {
  locale: Locale;
  className?: string;
}) {
  return (
    <Link
      href={`/${locale}`}
      aria-label="MELLA"
      className={`font-display text-2xl leading-none tracking-[0.42em] text-pearl transition-colors hover:text-champagne ${className}`}
    >
      MELLA
    </Link>
  );
}
