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
    <article className="group flex h-full flex-col">
      <Link href={href} className="block rounded-[1.25rem]" tabIndex={-1} aria-hidden>
        <div className="media-frame aspect-[4/5] transition-shadow duration-500 group-hover:shadow-card">
          <Image
            src={product.images[0] ?? "/images/products/samarqand-1.jpg"}
            alt=""
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            preload={priority}
            className={`object-cover transition-transform duration-[900ms] ease-out group-hover:scale-[1.04] ${
              product.inStock ? "" : "opacity-75 grayscale-[35%]"
            }`}
          />
          <span className="absolute inset-x-3 bottom-3 hidden translate-y-2 items-center justify-between rounded-full bg-paper/95 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-brown opacity-0 shadow-soft backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 sm:flex">
            {dict.common.details}
            <ArrowIcon />
          </span>
          {!product.inStock && (
            <span className="badge absolute left-3 top-3 bg-paper/95 text-muted shadow-soft">
              {dict.catalog.outOfStock}
            </span>
          )}
          {product.oldPrice && product.inStock && (
            <span className="badge absolute left-3 top-3 bg-gold text-brown">Sale</span>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col px-0.5 pt-3.5">
        <p className="truncate text-[10.5px] font-semibold uppercase tracking-[0.16em] text-bronze">
          {product.categoryName}
        </p>
        <h3 className="mt-1 font-display text-[1.2rem] leading-snug text-brown">
          <Link
            href={href}
            className="rounded-sm underline-offset-4 transition-colors hover:text-bronze"
          >
            {product.name}
          </Link>
        </h3>
        <div className="mt-auto flex flex-wrap items-baseline gap-x-2 pt-1.5">
          {product.price > 0 ? (
            <>
              <span className="text-[15px] font-semibold tabular-nums text-brown">
                {formatPrice(product.price, locale)} {dict.common.currency}
              </span>
              {product.oldPrice && (
                <span className="text-xs tabular-nums text-muted line-through">
                  {formatPrice(product.oldPrice, locale)}
                </span>
              )}
            </>
          ) : (
            <span className="text-sm text-muted">{dict.common.details}</span>
          )}
        </div>
      </div>
    </article>
  );
}
