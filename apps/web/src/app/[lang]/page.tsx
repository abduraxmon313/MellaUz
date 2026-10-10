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


// Admin panelda qo'shilgan mahsulotlar: saqlanganda darhol, aks holda ko'pi bilan 60 soniyada yangilanadi.
export const revalidate = 60;

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

  const titleParts = dict.home.heroTitle.split(",");

  return (
    <>
      {/* ── Hero (to'q jigarrang, split kompozitsiya) ─────────── */}
      <section className="on-dark grain relative overflow-hidden bg-brown text-cream">
        <div
          aria-hidden
          className="pointer-events-none absolute -left-40 top-10 h-[30rem] w-[30rem] rounded-full bg-gold/12 blur-[130px]"
        />
        <div className="container-site relative grid items-center gap-12 pt-[calc(var(--header-h)+2.75rem)] pb-16 lg:grid-cols-[1.08fr_0.92fr] lg:gap-16 lg:pt-[calc(var(--header-h)+4.5rem)] lg:pb-24">
          <div className="max-w-2xl">
            <p className="animate-fade-up inline-flex items-center gap-2.5 rounded-full border border-gold/30 bg-cream/[0.04] px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.26em] text-gold">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-gold" />
              {dict.home.heroKicker}
            </p>
            <h1 className="h-hero animate-fade-up mt-6 text-cream [animation-delay:60ms]">
              {titleParts.map((part, i, arr) => (
                <span key={i}>
                  <span className={i === arr.length - 1 ? "text-gradient-gold" : ""}>
                    {part.trim()}
                  </span>
                  {i < arr.length - 1 && <br />}
                </span>
              ))}
            </h1>
            <p className="lead animate-fade-up mt-6 max-w-xl [animation-delay:120ms]">
              {dict.home.heroText}
            </p>
            <div className="animate-fade-up mt-9 flex flex-wrap items-center gap-3 [animation-delay:180ms] sm:gap-4">
              <Link href={`/${locale}/catalog`} className="btn btn-gold btn-lg">
                {dict.home.heroCtaCatalog}
                <ArrowIcon />
              </Link>
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.home.heroCtaOrder}
                variant="light"
                size="lg"
              />
            </div>

            <dl className="animate-fade-up mt-12 grid max-w-xl grid-cols-2 gap-x-6 gap-y-6 border-t border-cream/12 pt-8 [animation-delay:240ms] sm:grid-cols-4">
              {dict.home.stats.map((s) => (
                <div key={s.label} className="flex flex-col">
                  <dt className="order-2 mt-2 text-[10.5px] font-medium uppercase tracking-[0.16em] text-sand">
                    {s.label}
                  </dt>
                  <dd className="order-1 font-display text-3xl leading-none text-gold-light sm:text-[2.1rem]">
                    {s.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.75rem] ring-1 ring-gold/25 shadow-[0_40px_80px_-40px_rgba(0,0,0,0.7)]">
              <Image
                src={heroImg}
                alt=""
                fill
                priority
                placeholder="blur"
                sizes="(max-width: 1024px) 90vw, 45vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-linear-to-t from-espresso/45 via-transparent to-transparent" />
            </div>
            {/* Ramka chizig'i — nozik premium detal */}
            <div
              aria-hidden
              className="pointer-events-none absolute -inset-3 -z-0 hidden rounded-[2.1rem] border border-gold/15 sm:block"
            />
            <div className="absolute -bottom-5 left-4 flex items-center gap-3 rounded-2xl border border-line bg-cream px-4 py-3 text-brown shadow-lift sm:left-6">
              <MellaEmblem className="h-9 w-9" />
              <div className="leading-tight">
                <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-bronze">
                  MELLA
                </p>
                <p className="mt-0.5 text-sm font-medium">{dict.common.since}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Brend qadriyatlari lentasi (statik, sokin) ────────── */}
      <div className="border-b border-line bg-ivory">
        <ul className="container-site grid grid-cols-2 gap-y-4 py-6 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-10">
          {strip.map((item, i) => (
            <li key={i} className="flex items-center justify-center gap-3 text-center sm:gap-10">
              {i > 0 && (
                <MellaEmblem className="hidden h-5 w-5 opacity-80 sm:block" />
              )}
              <span className="font-display text-lg italic text-brown sm:text-xl">{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Kategoriyalar ──────────────────────────────────── */}
      <section className="container-site section-y">
        <Reveal className="mb-10 flex items-end justify-between gap-6 lg:mb-12">
          <div>
            <p className="eyebrow">{dict.home.categoriesTitle}</p>
            <h2 className="h-section mt-3 text-brown">{dict.home.categoriesSubtitle}</h2>
          </div>
          <Link href={`/${locale}/catalog`} className="btn-link hidden shrink-0 sm:inline-flex">
            {dict.common.viewAll}
            <ArrowIcon />
          </Link>
        </Reveal>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
          {categoryViews.map((category, i) => (
            <Reveal key={category.slug} delay={i * 70}>
              <CategoryCard category={category} locale={locale} />
            </Reveal>
          ))}
        </div>
        <div className="mt-8 sm:hidden">
          <Link href={`/${locale}/catalog`} className="btn btn-secondary btn-block">
            {dict.common.viewAll}
            <ArrowIcon />
          </Link>
        </div>
      </section>

      {/* ── Tanlangan mahsulotlar ──────────────────────────── */}
      <section className="border-y border-line bg-ivory">
        <div className="container-site section-y">
          <Reveal className="mb-10 text-center lg:mb-14">
            <p className="eyebrow">{dict.home.featuredTitle}</p>
            <h2 className="h-section mt-3 text-brown">{dict.home.featuredSubtitle}</h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:gap-x-5 lg:grid-cols-4 lg:gap-x-7 lg:gap-y-12">
            {featured.map((product, i) => (
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

          <div className="mt-12 text-center lg:mt-14">
            <Link href={`/${locale}/catalog`} className="btn btn-primary">
              {dict.common.viewAll}
              <ArrowIcon />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Brend hikoyasi ─────────────────────────────────── */}
      <section className="container-site section-y grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
        <Reveal className="media-frame aspect-[4/3] shadow-card lg:aspect-[5/4]">
          <Image
            src={craftImg}
            alt=""
            fill
            placeholder="blur"
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        </Reveal>
        <Reveal delay={100}>
          <p className="eyebrow">{dict.home.storyKicker}</p>
          <h2 className="h-section mt-4 text-brown">{dict.home.storyTitle}</h2>
          <p className="lead mt-6">{dict.home.storyText}</p>
          <Link href={`/${locale}/about`} className="btn btn-secondary mt-9">
            {dict.home.storyCta}
            <ArrowIcon />
          </Link>
        </Reveal>
      </section>

      {/* ── Qadriyatlar ────────────────────────────────────── */}
      <section className="border-t border-line bg-ivory">
        <div className="container-site section-y">
          <Reveal className="mb-10 text-center lg:mb-14">
            <h2 className="h-section text-brown">{dict.home.valuesTitle}</h2>
            <hr className="rule-gold mx-auto mt-6 w-24" />
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
            {values.map((value, i) => (
              <Reveal key={i} delay={i * 70} className="h-full">
                <div className="card h-full p-6 lg:p-7">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brown font-display text-lg text-gold-light">
                    0{i + 1}
                  </span>
                  <h3 className="mt-5 font-display text-[1.4rem] leading-snug text-brown">
                    {value.title}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-muted">{value.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── Yakuniy CTA ────────────────────────────────────── */}
      <section className="on-dark relative overflow-hidden bg-espresso">
        <Image
          src={leatherImg}
          alt=""
          fill
          placeholder="blur"
          sizes="100vw"
          className="object-cover opacity-40"
        />
        <div className="absolute inset-0 bg-linear-to-b from-espresso/70 via-brown/80 to-espresso/90" />
        <div className="relative mx-auto max-w-3xl px-5 py-24 text-center lg:px-8 lg:py-28">
          <Reveal>
            <MellaEmblem className="mx-auto mb-6 h-12 w-12" />
            <h2 className="h-section text-cream sm:text-5xl">{dict.home.ctaTitle}</h2>
            <p className="lead mx-auto mt-5 max-w-xl">{dict.home.ctaText}</p>
            <div className="mt-9 flex items-center justify-center">
              <OrderDialog
                dict={dict}
                locale={locale}
                label={dict.nav.order}
                variant="gold"
                size="lg"
              />
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
