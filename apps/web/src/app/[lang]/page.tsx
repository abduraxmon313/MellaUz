import Image from "next/image";
import Link from "next/link";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import {
  getCatalog,
  toCategoryView,
  toProductView,
} from "@/lib/catalog/provider";
import { ProductCard } from "@/components/ProductCard";
import { CategoryCard } from "@/components/CategoryCard";
import { OrderDialog } from "@/components/OrderDialog";
import { Reveal } from "@/components/Reveal";
import heroImg from "@/assets/images/hero.jpg";
import craftImg from "@/assets/images/craft-hands.jpg";
import leatherImg from "@/assets/images/leather-texture.jpg";

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  const catalog = await getCatalog();
  const [categories, featuredRaw] = await Promise.all([
    catalog.listCategories(),
    catalog.listProducts({ featured: true, limit: 8 }),
  ]);
  const categoryViews = categories.map((c) => toCategoryView(c, locale));
  const featured = featuredRaw.map((p) =>
    toProductView(
      p,
      categories.find((c) => c.slug === p.categorySlug) ?? null,
      locale,
    ),
  );

  const strip = [
    dict.common.since,
    dict.values.naturalTitle,
    dict.values.designTitle,
    dict.common.madeIn,
  ];

  const values = [
    { title: dict.values.naturalTitle, text: dict.values.naturalText },
    { title: dict.values.designTitle, text: dict.values.designText },
    { title: dict.values.partnersTitle, text: dict.values.partnersText },
    { title: dict.values.trustTitle, text: dict.values.trustText },
  ];

  return (
    <>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden">
        <Image
          src={heroImg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-espresso via-espresso/70 to-espresso/20" />
        <div className="absolute inset-0 bg-linear-to-t from-espresso via-transparent to-espresso/40" />

        <div className="relative mx-auto w-full max-w-7xl px-5 pt-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="animate-fade-up text-xs uppercase tracking-[0.3em] text-gold">
              {dict.home.heroKicker}
            </p>
            <h1 className="animate-fade-up mt-5 font-display text-5xl leading-[1.05] text-pearl sm:text-6xl lg:text-7xl">
              {dict.home.heroTitle.split(",").map((part, i, arr) => (
                <span key={i}>
                  <span className={i === arr.length - 1 ? "text-gradient-gold" : ""}>
                    {part.trim()}
                  </span>
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-base leading-relaxed text-pearl/75 sm:text-lg">
              {dict.home.heroText}
            </p>
            <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-4">
              <Link
                href={`/${locale}/catalog`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gold px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-espresso transition hover:bg-champagne"
              >
                {dict.home.heroCtaCatalog}
              </Link>
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.home.heroCtaOrder}
                variant="outline"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Brend chizig'i ─────────────────────────────────── */}
      <div className="border-y border-mocha/25 bg-dark-chocolate/50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-5 py-5 lg:px-8">
          {strip.map((item, i) => (
            <span
              key={i}
              className="text-[11px] uppercase tracking-[0.25em] text-pearl/55"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      {/* ── Kategoriyalar ──────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
        <Reveal className="mb-12 flex items-end justify-between gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gold">
              {dict.home.categoriesTitle}
            </p>
            <h2 className="mt-3 font-display text-3xl text-pearl sm:text-4xl">
              {dict.home.categoriesSubtitle}
            </h2>
          </div>
          <Link
            href={`/${locale}/catalog`}
            className="hidden shrink-0 text-sm uppercase tracking-wider text-pearl/60 transition hover:text-champagne sm:inline"
          >
            {dict.common.viewAll} →
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 lg:gap-6">
          {categoryViews.map((category, i) => (
            <Reveal key={category.slug} delay={i * 80}>
              <CategoryCard category={category} locale={locale} />
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Tanlangan mahsulotlar ──────────────────────────── */}
      <section className="border-t border-mocha/20 bg-dark-chocolate/30">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <Reveal className="mb-12 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-gold">
              {dict.home.featuredTitle}
            </p>
            <h2 className="mt-3 font-display text-3xl text-pearl sm:text-4xl">
              {dict.home.featuredSubtitle}
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-5 lg:grid-cols-4 lg:gap-7">
            {featured.map((product, i) => (
              <Reveal key={product.slug} delay={(i % 4) * 80}>
                <ProductCard
                  product={product}
                  dict={dict}
                  locale={locale}
                  priority={i < 4}
                />
              </Reveal>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Link
              href={`/${locale}/catalog`}
              className="inline-flex items-center gap-2 rounded-full border border-pearl/25 px-8 py-3 text-sm uppercase tracking-wider text-pearl transition hover:border-gold hover:text-champagne"
            >
              {dict.common.viewAll}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Brend hikoyasi ─────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-20 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-28">
        <Reveal className="relative aspect-[4/5] overflow-hidden rounded-3xl lg:aspect-square">
          <Image
            src={craftImg}
            alt=""
            fill
            placeholder="blur"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </Reveal>
        <Reveal delay={120}>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">
            {dict.home.storyKicker}
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight text-pearl sm:text-4xl">
            {dict.home.storyTitle}
          </h2>
          <p className="mt-6 text-base leading-relaxed text-pearl/70">
            {dict.home.storyText}
          </p>
          <Link
            href={`/${locale}/about`}
            className="mt-8 inline-flex items-center gap-2 text-sm uppercase tracking-wider text-gold transition hover:text-champagne"
          >
            {dict.home.storyCta} →
          </Link>
        </Reveal>
      </section>

      {/* ── Qadriyatlar ────────────────────────────────────── */}
      <section className="border-t border-mocha/20 bg-dark-chocolate/30">
        <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8 lg:py-28">
          <Reveal className="mb-14 text-center">
            <h2 className="font-display text-3xl text-pearl sm:text-4xl">
              {dict.home.valuesTitle}
            </h2>
          </Reveal>
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <Reveal key={i} delay={i * 80}>
                <div className="flex flex-col">
                  <span className="font-display text-5xl text-gold/30">
                    0{i + 1}
                  </span>
                  <h3 className="mt-4 font-display text-xl text-champagne">
                    {value.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-pearl/65">
                    {value.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Yakuniy CTA ────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <Image
          src={leatherImg}
          alt=""
          fill
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-espresso/85" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center lg:px-8 lg:py-32">
          <Reveal>
            <h2 className="font-display text-4xl text-pearl sm:text-5xl">
              {dict.home.ctaTitle}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-base text-pearl/70">
              {dict.home.ctaText}
            </p>
            <div className="mt-9 flex items-center justify-center">
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.nav.order}
                variant="solid"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
