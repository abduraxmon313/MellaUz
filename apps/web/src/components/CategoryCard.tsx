import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { CategoryView } from "@/lib/catalog/types";

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
      className={`group relative block overflow-hidden rounded-3xl ${
        large ? "aspect-[4/5] lg:aspect-auto lg:h-full" : "aspect-[4/5]"
      }`}
    >
      <Image
        src={category.image}
        alt={category.name}
        fill
        sizes="(max-width: 1024px) 50vw, 25vw"
        className="object-cover transition-transform duration-[1200ms] group-hover:scale-110"
      />
      <div className="absolute inset-0 bg-linear-to-t from-espresso via-espresso/30 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 p-6">
        <h3 className="font-display text-2xl text-pearl">{category.name}</h3>
        {category.tagline && (
          <p className="mt-1 max-w-xs text-sm text-pearl/70">{category.tagline}</p>
        )}
        <span className="mt-3 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider text-champagne opacity-0 transition group-hover:opacity-100">
          <span>→</span>
        </span>
      </div>
    </Link>
  );
}
