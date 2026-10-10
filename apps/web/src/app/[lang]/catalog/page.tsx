import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  getCatalog,
  toProductView,
} from "@/lib/catalog/provider";
import { ProductCard } from "@/components/ProductCard";
import { Reveal } from "@/components/Reveal";
import { PageHeader } from "@/components/PageHeader";
import { CategoryFilter } from "@/components/CategoryFilter";


// Admin panelda qo'shilgan mahsulotlar: saqlanganda darhol, aks holda ko'pi bilan 60 soniyada yangilanadi.
export const revalidate = 60;

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
      <PageHeader
        eyebrow={dict.common.brand}
        title={dict.catalog.title}
        subtitle={dict.catalog.subtitle}
      >
        <CategoryFilter
          categories={categories}
          locale={locale}
          allLabel={dict.catalog.filterAll}
        />
      </PageHeader>

      <section className="container-site py-12 lg:py-16">
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
      </section>
    </>
  );
}
