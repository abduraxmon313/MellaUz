import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog, toProductView } from "@/lib/catalog/provider";
import { formatPrice } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { ProductCard } from "@/components/ProductCard";
import { OrderDialog } from "@/components/OrderDialog";
import { Reveal } from "@/components/Reveal";
import { Breadcrumbs } from "@/components/PageHeader";


// Admin panelda qo'shilgan mahsulotlar: saqlanganda darhol, aks holda ko'pi bilan 60 soniyada yangilanadi.
export const revalidate = 60;

export async function generateStaticParams() {
  const { MockCatalogProvider } = await import("@/lib/catalog/mock-provider");
  const provider = new MockCatalogProvider();
  const products = await provider.listProducts();
  const params: { lang: string; slug: string }[] = [];
  for (const lang of locales) {
    for (const product of products) {
      params.push({ lang, slug: product.slug });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const catalog = await getCatalog();
  const product = await catalog.getProduct(slug);
  if (!product) return {};
  return {
    title: product.name[locale],
    description: product.description[locale],
    alternates: { canonical: `/${locale}/product/${slug}` },
    openGraph: {
      title: product.name[locale],
      description: product.description[locale],
      images: product.images[0] ? [product.images[0]] : undefined,
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  const catalog = await getCatalog();
  const product = await catalog.getProduct(slug);
  if (!product) notFound();

  const [category, categories] = await Promise.all([
    catalog.getCategory(product.categorySlug),
    catalog.listCategories(),
  ]);
  const view = toProductView(product, category, locale);

  const relatedRaw = await catalog.listProducts({
    category: product.categorySlug,
    limit: 5,
  });
  const related = relatedRaw
    .filter((p) => p.slug !== product.slug)
    .slice(0, 4)
    .map((p) =>
      toProductView(
        p,
        categories.find((c) => c.slug === p.categorySlug) ?? null,
        locale,
      ),
    );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: view.name,
    description: view.description,
    sku: view.sku,
    brand: { "@type": "Brand", name: "MELLA" },
    image: view.images.map((img) =>
      img.startsWith("http") ? img : `${siteUrl()}${img}`,
    ),
    ...(view.price > 0
      ? {
          offers: {
            "@type": "Offer",
            price: view.price,
            priceCurrency: "UZS",
            availability: view.inStock
              ? "https://schema.org/InStock"
              : "https://schema.org/OutOfStock",
          },
        }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="container-site pt-[calc(var(--header-h)+2rem)] lg:pt-[calc(var(--header-h)+3rem)]">
        <Breadcrumbs
          className="mb-8"
          items={[
            { href: `/${locale}/catalog`, label: dict.catalog.title },
            { href: `/${locale}/catalog/${view.categorySlug}`, label: view.categoryName },
            { label: view.name },
          ]}
        />

        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div className="media-frame aspect-[4/5] shadow-card">
            <Image
              src={view.images[0] ?? "/images/products/samarqand-1.jpg"}
              alt={view.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start">
            <p className="eyebrow">{view.categoryName}</p>
            <h1 className="h-page mt-3 text-brown">{view.name}</h1>

            <div className="mt-5 flex flex-wrap items-baseline gap-3">
              {view.price > 0 ? (
                <span className="text-2xl font-semibold tabular-nums text-brown">
                  {formatPrice(view.price, locale)} {dict.common.currency}
                </span>
              ) : null}
              {view.oldPrice && (
                <span className="text-lg tabular-nums text-muted line-through">
                  {formatPrice(view.oldPrice, locale)}
                </span>
              )}
            </div>

            <div className="mt-4">
              <span
                className={`badge ${
                  view.inStock
                    ? "bg-success/10 text-success ring-1 ring-success/20"
                    : "bg-brown/[0.06] text-muted ring-1 ring-line-strong"
                }`}
              >
                <span
                  aria-hidden
                  className={`h-1.5 w-1.5 rounded-full ${view.inStock ? "bg-success" : "bg-muted"}`}
                />
                {view.inStock ? dict.product.inStock : dict.product.outOfStock}
              </span>
            </div>

            <p className="mt-6 whitespace-pre-line text-base leading-relaxed text-muted">{view.description}</p>

            {view.sizes.length > 0 && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {dict.product.sizes}
                </p>
                <ul className="mt-2.5 flex flex-wrap gap-2">
                  {view.sizes.map((s) => (
                    <li
                      key={s.label}
                      className={`inline-flex h-10 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-semibold tabular-nums ${
                        s.inStock
                          ? "border-line-strong bg-paper text-brown"
                          : "border-line bg-ivory text-muted line-through"
                      }`}
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="card mt-8 divide-y divide-line px-5 text-sm">
              <div className="flex gap-4 py-3.5">
                <dt className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {dict.product.article}
                </dt>
                <dd className="text-brown">{view.sku}</dd>
              </div>
              {view.material && (
                <div className="flex gap-4 py-3.5">
                  <dt className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                    {dict.product.materials}
                  </dt>
                  <dd className="text-brown">{view.material}</dd>
                </div>
              )}
              <div className="flex gap-4 py-3.5">
                <dt className="w-28 shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">
                  {dict.product.category}
                </dt>
                <dd className="text-brown">{view.categoryName}</dd>
              </div>
            </dl>

            <div className="mt-8">
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.product.orderCta}
                product={`${view.name} (${view.sku})`}
                variant="solid"
                size="lg"
                className="w-full sm:w-auto"
              />
              <p className="mt-3 text-xs leading-relaxed text-muted">{dict.product.sizeNote}</p>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="container-site pt-16 pb-20 lg:pt-24 lg:pb-28">
          <div className="mb-10 flex items-end justify-between gap-4 border-t border-line pt-12 lg:pt-16">
            <h2 className="h-section text-brown">{dict.product.related}</h2>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-7">
            {related.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 4) * 60}>
                <ProductCard product={p} dict={dict} locale={locale} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
