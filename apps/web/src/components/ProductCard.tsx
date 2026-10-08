import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { ProductView } from "@/lib/catalog/types";
import { formatPrice } from "@/lib/format";
import { ArrowIcon } from "@/components/ArrowIcon";

export function ProductCard({
  product,
  dict,
  locale,
  priority = false,
}: {
  product: ProductView;
  dict: Dictionary;
  locale: Locale;
  priority?: boolean;
}) {
  const href = `/${locale}/product/${product.slug}`;
  return (
    <article className="group lift">
      <Link href={href} className="block">
        <div className="gold-ring relative aspect-[4/5] overflow-hidden rounded-[22px] bg-chocolate/40">
          <Image
            src={product.images[0] ?? "/images/products/samarqand-1.jpg"}
            alt={product.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            preload={priority}
            className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.06]"
          />
          <div className="absolute inset-0 bg-linear-to-t from-espresso/70 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <span className="absolute inset-x-3 bottom-3 flex translate-y-3 items-center justify-between rounded-full bg-pearl/90 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-espresso opacity-0 backdrop-blur transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
            {dict.common.details}
            <ArrowIcon />
          </span>
          {!product.inStock && (
            <span className="absolute left-3 top-3 rounded-full bg-espresso/80 px-3 py-1 text-[10px] uppercase tracking-wider text-pearl/80 backdrop-blur">
              {dict.catalog.outOfStock}
            </span>
          )}
          {product.oldPrice && product.inStock && (
            <span className="absolute left-3 top-3 rounded-full bg-gold px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-espresso">
              Sale
            </span>
          )}
        </div>
      </Link>

      <div className="mt-4 px-1">
        <p className="text-[11px] uppercase tracking-wider text-gold/70">
          {product.categoryName}
        </p>
        <h3 className="mt-1 font-display text-lg leading-snug text-pearl">
          <Link href={href} className="transition hover:text-champagne">
            {product.name}
          </Link>
        </h3>
        <div className="mt-1.5 flex items-baseline gap-2">
          {product.price > 0 ? (
            <>
              <span className="text-sm text-pearl/90">
                {formatPrice(product.price, locale)} {dict.common.currency}
              </span>
              {product.oldPrice && (
                <span className="text-xs text-pearl/40 line-through">
                  {formatPrice(product.oldPrice, locale)}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-pearl/60">{dict.common.details}</span>
          )}
        </div>
      </div>
    </article>
  );
}
