import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { isLocale, locales } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getCatalog, toProductView } from "@/lib/catalog/provider";
import { formatPrice } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { ProductCard } from "@/components/ProductCard";
import { OrderDialog } from "@/components/OrderDialog";
import { Reveal } from "@/components/Reveal";

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

      <section className="mx-auto max-w-7xl px-5 pt-28 lg:px-8 lg:pt-36">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-xs uppercase tracking-wider text-pearl/45">
          <Link href={`/${locale}/catalog`} className="transition hover:text-champagne">
            {dict.catalog.title}
          </Link>
          <span>/</span>
          <Link
            href={`/${locale}/catalog/${view.categorySlug}`}
            className="transition hover:text-champagne"
          >
            {view.categoryName}
          </Link>
          <span>/</span>
          <span className="text-pearl/70">{view.name}</span>
        </nav>

        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-chocolate/40">
            <Image
              src={view.images[0] ?? "/images/products/samarqand-1.jpg"}
              alt={view.name}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div className="flex flex-col">
            <p className="text-xs uppercase tracking-[0.3em] text-gold">
              {view.categoryName}
            </p>
            <h1 className="mt-3 font-display text-4xl leading-tight text-pearl sm:text-5xl">
              {view.name}
            </h1>

            <div className="mt-5 flex items-center gap-3">
              {view.price > 0 ? (
                <span className="text-2xl text-champagne">
                  {formatPrice(view.price, locale)} {dict.common.currency}
                </span>
              ) : null}
              {view.oldPrice && (
                <span className="text-lg text-pearl/40 line-through">
                  {formatPrice(view.oldPrice, locale)}
                </span>
              )}
            </div>

            <div className="mt-4">
              <span
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs uppercase tracking-wider ${
                  view.inStock
                    ? "bg-gold/15 text-champagne"
                    : "bg-mocha/30 text-pearl/60"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    view.inStock ? "bg-gold" : "bg-pearl/40"
                  }`}
                />
                {view.inStock ? dict.product.inStock : dict.product.outOfStock}
              </span>
            </div>

            <p className="mt-6 text-base leading-relaxed text-pearl/75">
              {view.description}
            </p>

            <dl className="mt-8 space-y-3 border-t border-mocha/30 pt-6 text-sm">
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 uppercase tracking-wider text-pearl/45">
                  {dict.product.article}
                </dt>
                <dd className="text-pearl/80">{view.sku}</dd>
              </div>
              {view.material && (
                <div className="flex gap-4">
                  <dt className="w-28 shrink-0 uppercase tracking-wider text-pearl/45">
                    {dict.product.materials}
                  </dt>
                  <dd className="text-pearl/80">{view.material}</dd>
                </div>
              )}
              <div className="flex gap-4">
                <dt className="w-28 shrink-0 uppercase tracking-wider text-pearl/45">
                  {dict.product.category}
                </dt>
                <dd className="text-pearl/80">{view.categoryName}</dd>
              </div>
            </dl>

            <div className="mt-9">
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.product.orderCta}
                product={`${view.name} (${view.sku})`}
                variant="solid"
              />
              <p className="mt-3 text-xs text-pearl/45">{dict.product.sizeNote}</p>
            </div>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <h2 className="mb-10 font-display text-2xl text-pearl sm:text-3xl">
            {dict.product.related}
          </h2>
          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-7">
            {related.map((p, i) => (
              <Reveal key={p.slug} delay={(i % 4) * 70}>
                <ProductCard product={p} dict={dict} locale={locale} />
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
