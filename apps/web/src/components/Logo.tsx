import Link from "next/link";
import { useId } from "react";
import type { Locale } from "@/i18n/config";

/**
 * MELLA emblemasi — oltin chiziqli "stiletto" tufli (brend logotipi asosida).
 * Vektor (SVG) bo'lgani uchun har qanday o'lchamda tiniq ko'rinadi.
 */
export function MellaEmblem({
  className = "",
  title,
}: {
  className?: string;
  title?: string;
}) {
  const id = useId().replace(/:/g, "");
  const grad = `mella-gold-${id}`;
  return (
    <svg
      viewBox="300 160 440 490"
      className={className}
      fill="none"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
    >
      <defs>
        <linearGradient id={grad} x1="300" y1="160" x2="740" y2="650" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#d9b06c" />
          <stop offset="0.45" stopColor="#a86f37" />
          <stop offset="0.75" stopColor="#e2bd7c" />
          <stop offset="1" stopColor="#6e4520" />
        </linearGradient>
      </defs>
      <g stroke={`url(#${grad})`} strokeLinecap="round" strokeLinejoin="round">
        {/* Bog'ichlar (to'lqinsimon tasmalar) */}
        <path d="M412 178c18 22 52 40 98 52 48 13 72 36 62 64-6 17-20 25-34 27" strokeWidth="13" />
        <path d="M424 292c30-14 76-8 114 12 30 16 40 40 26 66" strokeWidth="11" />
        <path d="M336 306c56-12 118 6 170 36 38 22 46 56 42 122" strokeWidth="8" />
        {/* Tovon-kamar (asosiy egri chiziq) */}
        <path d="M318 300c84 18 136 74 162 166 20 72 28 128 50 164" strokeWidth="15" />
        <path d="M352 318c66 26 104 84 124 168" strokeWidth="3.5" opacity=".75" />
        {/* Stiletto poshna */}
        <path d="M368 352c8 70 16 150 22 250" strokeWidth="8" />
        <path d="M390 602l-2 16" strokeWidth="4" opacity=".7" />
        {/* Taglik va uchi */}
        <path d="M530 630c64-2 128-12 194-28" strokeWidth="9" />
        <path d="M546 616c56-2 108-8 156-14" strokeWidth="3" opacity=".7" />
      </g>
    </svg>
  );
}

/** "Mella" so'z belgisi — oltin gradientli serif yozuv. */
export function MellaWordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display text-gradient-gold leading-none tracking-[0.04em] ${className}`}
      style={{ fontWeight: 500 }}
    >
      Mella
    </span>
  );
}

/** Sarlavhadagi logotip: emblema + so'z belgisi. */
export function Logo({
  locale,
  className = "",
  size = "md",
}: {
  locale: Locale;
  className?: string;
  size?: "md" | "lg";
}) {
  const emblem = size === "lg" ? "h-14 w-14" : "h-9 w-9 sm:h-10 sm:w-10";
  const word = size === "lg" ? "text-4xl" : "text-[1.7rem] sm:text-3xl";
  return (
    <Link
      href={`/${locale}`}
      aria-label="MELLA — bosh sahifa"
      className={`group inline-flex items-end gap-1.5 ${className}`}
    >
      <MellaEmblem className={`${emblem} transition-transform duration-500 group-hover:-rotate-6`} />
      <MellaWordmark className={word} />
    </Link>
  );
}
