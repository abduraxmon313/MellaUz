import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog, toProductView } from "@/lib/catalog/provider";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";

export async function generateStaticParams() {
  const { MockCatalogProvider } = await import("@/lib/catalog/mock-provider");
  const provider = new MockCatalogProvider();
  const categories = await provider.listCategories();
  const params: { lang: string; category: string }[] = [];
  for (const lang of locales) {
    for (const category of categories) {
      params.push({ lang, category: category.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; category: string }>;
}): Promise<Metadata> {
  const { lang, category } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const catalog = await getCatalog();
  const cat = await catalog.getCategory(category);
  if (!cat) return {};
  return {
    title: cat.name[locale],
    description: cat.tagline?.[locale],
    alternates: { canonical: `/${locale}/catalog/${category}` },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ lang: string; category: string }>;
}) {
  const { lang, category } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  const catalog = await getCatalog();
  const [cat, categories] = await Promise.all([
    catalog.getCategory(category),
    catalog.listCategories(),
  ]);
  if (!cat) notFound();

  const productsRaw = await catalog.listProducts({ category });
  const products = productsRaw.map((p) => toProductView(p, cat, locale));

  return (
    <>
      <section className="border-b border-mocha/20 bg-dark-chocolate/40 pt-28 pb-14 lg:pt-36 lg:pb-16">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <nav className="mb-5 flex items-center gap-2 text-xs uppercase tracking-wider text-pearl/45">
            <Link href={`/${locale}/catalog`} className="transition hover:text-champagne">
              {dict.catalog.title}
            </Link>
            <span>/</span>
            <span className="text-pearl/70">{cat.name[locale]}</span>
          </nav>
          <h1 className="font-display text-4xl text-pearl sm:text-5xl">
            {cat.name[locale]}
          </h1>
          {cat.tagline && (
            <p className="mt-3 max-w-xl text-pearl/60">{cat.tagline[locale]}</p>
          )}

          <nav className="mt-8 flex flex-wrap gap-2.5">
            <Link
              href={`/${locale}/catalog`}
              className="rounded-full border border-mocha/50 px-5 py-2 text-xs uppercase tracking-wider text-pearl/75 transition hover:border-gold hover:text-champagne"
            >
              {dict.catalog.filterAll}
            </Link>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/${locale}/catalog/${c.slug}`}
                className={
                  c.slug === category
                    ? "rounded-full bg-gold px-5 py-2 text-xs font-semibold uppercase tracking-wider text-espresso"
                    : "rounded-full border border-mocha/50 px-5 py-2 text-xs uppercase tracking-wider text-pearl/75 transition hover:border-gold hover:text-champagne"
                }
              >
                {c.name[locale]}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 lg:px-8 lg:py-20">
        {products.length === 0 ? (
          <p className="py-20 text-center text-pearl/50">{dict.catalog.empty}</p>
        ) : (
          <>
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
          </>
        )}
      </section>
    </>
  );
}
