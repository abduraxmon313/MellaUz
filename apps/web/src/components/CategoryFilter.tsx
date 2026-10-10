import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Category } from "@/lib/catalog/types";

/** Katalog filtrlari — "Barchasi" + kategoriyalar. Faol element aria-current bilan. */
export function CategoryFilter({
  categories,
  locale,
  active,
  allLabel,
}: {
  categories: Category[];
  locale: Locale;
  /** Faol kategoriya slug'i; undefined — "Barchasi" faol. */
  active?: string;
  allLabel: string;
}) {
  return (
    <nav aria-label={allLabel} className="-mx-5 mt-8 overflow-x-auto px-5 [scrollbar-width:none] sm:mx-0 sm:overflow-visible sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap sm:gap-2.5">
        <li>
          <Link
            href={`/${locale}/catalog`}
            aria-current={active ? undefined : "page"}
            className="chip whitespace-nowrap"
          >
            {allLabel}
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.slug}>
            <Link
              href={`/${locale}/catalog/${c.slug}`}
              aria-current={c.slug === active ? "page" : undefined}
              className="chip whitespace-nowrap"
            >
              {c.name[locale]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
