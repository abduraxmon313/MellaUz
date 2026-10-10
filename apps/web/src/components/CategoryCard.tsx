import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { CategoryView } from "@/lib/catalog/types";
import { ArrowIcon } from "@/components/ArrowIcon";

export function CategoryCard({
  category,
  locale,
  large = false,
}: {
  category: CategoryView;
  locale: Locale;
  large?: boolean;
}) {
  return (
    <Link
      href={`/${locale}/catalog/${category.slug}`}
      className={`group relative block overflow-hidden rounded-[1.25rem] bg-brown shadow-soft transition-shadow duration-500 hover:shadow-lift ${
        large ? "aspect-[4/5] lg:aspect-auto lg:h-full" : "aspect-[4/5]"
      }`}
    >
      <Image
        src={category.image}
        alt=""
        fill
        sizes="(max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-[1100ms] ease-out group-hover:scale-[1.06]"
      />
      <div className="absolute inset-0 bg-linear-to-t from-espresso/90 via-espresso/25 to-transparent" />
      <div className="on-dark absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-6">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight text-cream sm:text-2xl">{category.name}</h3>
          {category.tagline && (
            <p className="mt-1 line-clamp-2 max-w-xs text-xs leading-relaxed text-cream/75 sm:text-sm">
              {category.tagline}
            </p>
          )}
        </div>
        <span
          aria-hidden
          className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream/35 text-cream transition-colors duration-300 group-hover:border-gold group-hover:bg-gold group-hover:text-brown sm:inline-flex"
        >
          <ArrowIcon />
        </span>
      </div>
    </Link>
  );
}
