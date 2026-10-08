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
import { MellaEmblem } from "@/components/Logo";
import heroImg from "@/assets/images/hero.jpg";
import craftImg from "@/assets/images/craft-hands.jpg";
import leatherImg from "@/assets/images/leather-texture.jpg";
import { ArrowIcon } from "@/components/ArrowIcon";

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
      <section className="grain relative flex min-h-[100svh] items-center overflow-hidden">
        <Image
          src={heroImg}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="hero-zoom object-cover object-center"
        />
        <div className="absolute inset-0 bg-linear-to-r from-espresso via-espresso/75 to-espresso/10" />
        <div className="absolute inset-0 bg-linear-to-t from-espresso via-transparent to-espresso/50" />
        <div className="absolute -left-40 top-1/3 h-[32rem] w-[32rem] rounded-full bg-gold/10 blur-[120px]" />

        <MellaEmblem className="pointer-events-none absolute -right-16 -bottom-10 hidden h-[52vh] w-[52vh] opacity-[0.06] xl:block" />

        <div className="relative mx-auto w-full max-w-7xl px-5 pt-32 pb-24 lg:px-8">
          <div className="max-w-2xl">
            <p className="animate-fade-up inline-flex items-center gap-3 rounded-full border border-gold/25 bg-espresso/40 px-4 py-1.5 text-[11px] uppercase tracking-[0.3em] text-gold backdrop-blur-sm">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" />
              {dict.home.heroKicker}
            </p>
            <h1 className="animate-fade-up mt-6 font-display text-[2.9rem] leading-[1.02] text-pearl sm:text-6xl lg:text-[5.2rem]">
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
            <div className="animate-fade-up mt-10 flex flex-wrap items-center gap-4">
              <Link href={`/${locale}/catalog`} className="btn-gold">
                {dict.home.heroCtaCatalog}
                <ArrowIcon />
              </Link>
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.home.heroCtaOrder}
                variant="outline"
              />
            </div>

            <dl className="animate-fade-up mt-14 grid max-w-xl grid-cols-2 gap-x-8 gap-y-6 border-t border-pearl/10 pt-8 sm:grid-cols-4">
              {dict.home.stats.map((s) => (
                <div key={s.label}>
                  <dt className="font-display text-3xl text-gradient-gold sm:text-4xl">{s.value}</dt>
                  <dd className="mt-1 text-[11px] uppercase tracking-[0.16em] text-pearl/55">{s.label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-6 hidden justify-center sm:flex">
          <span className="flex flex-col items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-pearl/45">
            <span className="flex h-9 w-5 justify-center rounded-full border border-pearl/25 pt-1.5">
              <span className="scroll-dot h-1.5 w-1 rounded-full bg-gold" />
            </span>
            {dict.home.scroll}
          </span>
        </div>
      </section>

      {/* ── Brend lentasi (cheksiz) ────────────────────────── */}
      <div className="overflow-hidden border-y border-gold/10 bg-dark-chocolate/60 py-5">
        <div className="marquee">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex shrink-0 items-center" aria-hidden={dup === 1}>
              {[...strip, ...strip].map((item, i) => (
                <span key={i} className="flex items-center">
                  <span className="px-8 font-display text-xl italic text-pearl/70 sm:text-2xl">
                    {item}
                  </span>
                  <MellaEmblem className="h-6 w-6 opacity-70" />
                </span>
              ))}
            </div>
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
            className="hidden shrink-0 items-center gap-2 text-sm uppercase tracking-wider text-pearl/60 transition hover:text-champagne sm:inline-flex"
          >
            {dict.common.viewAll}
            <ArrowIcon />
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
            <Link href={`/${locale}/catalog`} className="btn-ghost">
              {dict.common.viewAll}
              <ArrowIcon />
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
            {dict.home.storyCta}
            <ArrowIcon />
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
