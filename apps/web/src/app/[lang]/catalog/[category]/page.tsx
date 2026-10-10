import type { Metadata } from "next";
import Link from "next/link";
import { ArrowIcon } from "@/components/ArrowIcon";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog, toProductView } from "@/lib/catalog/provider";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { PageHeader } from "@/components/PageHeader";
import { CategoryFilter } from "@/components/CategoryFilter";

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
      <PageHeader
        title={cat.name[locale]}
        subtitle={cat.tagline?.[locale]}
        crumbs={[
          { href: `/${locale}/catalog`, label: dict.catalog.title },
          { label: cat.name[locale] },
        ]}
      >
        <CategoryFilter
          categories={categories}
          locale={locale}
          active={category}
          allLabel={dict.catalog.filterAll}
        />
      </PageHeader>

      <section className="container-site py-12 lg:py-16">
        {products.length === 0 ? (
          <div className="card mx-auto max-w-md px-6 py-14 text-center">
            <p className="font-display text-2xl text-brown">{dict.catalog.empty}</p>
            <Link href={`/${locale}/catalog`} className="btn btn-secondary mt-6">
              {dict.catalog.filterAll}
              <ArrowIcon />
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-8 text-sm text-muted">
              <span className="font-semibold tabular-nums text-brown">{products.length}</span>{" "}
              {dict.catalog.products}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-12">
              {products.map((product, i) => (
                <Reveal key={product.slug} delay={(i % 4) * 60}>
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
