import type { Metadata } from "next";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  getCatalog,
  toProductView,
} from "@/lib/catalog/provider";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);
  return {
    title: dict.catalog.title,
    description: dict.catalog.subtitle,
    alternates: { canonical: `/${locale}/catalog` },
  };
}

export default async function CatalogPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  const catalog = await getCatalog();
  const [categories, productsRaw] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts(),
  ]);
  const products = productsRaw.map((p) =>
    toProductView(
      p,
      categories.find((c) => c.slug === p.categorySlug) ?? null,
      locale,
    ),
  );

  return (
    <>
      <section className="border-b border-mocha/20 bg-dark-chocolate/40 pt-28 pb-14 lg:pt-36 lg:pb-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">
            {dict.common.brand}
          </p>
          <h1 className="mt-3 font-display text-4xl text-pearl sm:text-5xl">
            {dict.catalog.title}
          </h1>
          <p className="mt-3 text-pearl/60">{dict.catalog.subtitle}</p>

          <nav className="mt-8 flex flex-wrap gap-2.5">
            <span className="rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-wider text-espresso">
              {dict.catalog.filterAll}
            </span>
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/${locale}/catalog/${category.slug}`}
                className="rounded-full border border-mocha/50 px-5 py-2 text-xs uppercase tracking-wider text-pearl/75 transition hover:border-gold hover:text-champagne"
              >
                {category.name[locale]}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        <p className="mb-8 text-sm text-pearl/50">
          {products.length} {dict.catalog.products}
        </p>
        <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-7">
          {products.map((product, i) => (
            <Reveal key={product.slug} delay={(i % 4) * 70}>
              <ProductCard
                product={product}
                dict={dict}
                locale={locale}
                priority={i < 4}
              />
            </Reveal>
          ))}
        </div>
      </section>
    </>
  );
}
