import type { Metadata } from "next";
import Image from "next/image";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OrderDialog } from "@/components/OrderDialog";
import { Reveal } from "@/components/Reveal";
import aboutHero from "@/assets/images/atelier.jpg";
import craftStitch from "@/assets/images/craft-stitch.jpg";
import runway from "@/assets/images/runway.jpg";
import designStudio from "@/assets/images/design-studio.jpg";
import editorialHeels from "@/assets/images/editorial-heels.jpg";
import boutique from "@/assets/images/boutique.jpg";

const sectionImages = [craftStitch, designStudio, boutique, editorialHeels, runway];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);
  return {
    title: dict.nav.about,
    description: dict.about.intro,
    alternates: { canonical: `/${locale}/about` },
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  return (
    <>
      {/* Hero */}
      <section className="relative flex min-h-[70vh] items-end overflow-hidden">
        <Image
          src={aboutHero}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-espresso via-espresso/50 to-espresso/20" />
        <div className="relative mx-auto w-full max-w-5xl px-5 pb-16 lg:px-8 lg:pb-24">
          <p className="text-xs uppercase tracking-[0.3em] text-gold">
            {dict.common.since} · {dict.common.madeIn}
          </p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-pearl sm:text-6xl">
            {dict.about.title}
          </h1>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8 lg:py-28">
        <Reveal>
          <p className="font-display text-2xl leading-relaxed text-pearl/90 sm:text-3xl">
            {dict.about.intro}
          </p>
        </Reveal>
      </section>

      {/* Sections — alternating */}
      <section className="space-y-20 pb-24 lg:space-y-28">
        {dict.about.sections.map((item, i) => {
          const img = sectionImages[i % sectionImages.length]!;
          const reversed = i % 2 === 1;
          return (
            <div
              key={i}
              className="mx-auto grid max-w-7xl items-center gap-10 px-5 lg:grid-cols-2 lg:gap-16 lg:px-8"
            >
              <Reveal
                className={`relative aspect-[4/3] overflow-hidden rounded-3xl ${
                  reversed ? "lg:order-2" : ""
                }`}
              >
                <Image
                  src={img}
                  alt=""
                  fill
                  placeholder="blur"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                />
              </Reveal>
              <Reveal delay={120} className={reversed ? "lg:order-1" : ""}>
                <span className="font-display text-5xl text-gold/25">
                  0{i + 1}
                </span>
                <h2 className="mt-3 font-display text-3xl leading-tight text-pearl sm:text-4xl">
                  {item.title}
                </h2>
                <p className="mt-5 text-base leading-relaxed text-pearl/70">
                  {item.text}
                </p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* Future */}
      <section className="border-t border-mocha/20 bg-dark-chocolate/40">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8 lg:py-28">
          <Reveal>
            <h2 className="font-display text-3xl text-champagne sm:text-4xl">
              {dict.about.futureTitle}
            </h2>
            <p className="mt-6 text-base leading-relaxed text-pearl/75">
              {dict.about.futureText}
            </p>
            <div className="mt-10 flex justify-center">
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
