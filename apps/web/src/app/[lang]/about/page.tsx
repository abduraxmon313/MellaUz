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
      <section className="on-dark relative flex min-h-[62vh] items-end overflow-hidden bg-espresso lg:min-h-[70vh]">
        <Image
          src={aboutHero}
          alt=""
          fill
          priority
          placeholder="blur"
          sizes="100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-linear-to-t from-espresso via-espresso/60 to-espresso/25" />
        <div className="container-site relative pt-[calc(var(--header-h)+3rem)] pb-14 lg:pb-20">
          <p className="eyebrow">
            {dict.common.since} · {dict.common.madeIn}
          </p>
          <h1 className="h-hero mt-4 max-w-3xl text-cream">{dict.about.title}</h1>
        </div>
      </section>

      {/* Intro */}
      <section className="mx-auto max-w-3xl px-5 py-16 text-center lg:px-8 lg:py-24">
        <Reveal>
          <hr className="rule-gold mx-auto mb-8 w-20" />
          <p className="font-display text-2xl leading-relaxed text-brown sm:text-[1.9rem]">
            {dict.about.intro}
          </p>
        </Reveal>
      </section>

      {/* Bo'limlar — navbatma-navbat */}
      <section className="space-y-16 pb-20 lg:space-y-24 lg:pb-28">
        {dict.about.sections.map((item, i) => {
          const img = sectionImages[i % sectionImages.length]!;
          const reversed = i % 2 === 1;
          return (
            <div
              key={i}
              className="container-site grid items-center gap-8 lg:grid-cols-2 lg:gap-20"
            >
              <Reveal
                className={`media-frame aspect-[4/3] shadow-card ${reversed ? "lg:order-2" : ""}`}
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
              <Reveal delay={100} className={reversed ? "lg:order-1" : ""}>
                <span className="font-display text-sm font-semibold tracking-[0.3em] text-bronze">
                  0{i + 1}
                </span>
                <h2 className="h-section mt-3 text-brown">{item.title}</h2>
                <p className="lead mt-5">{item.text}</p>
              </Reveal>
            </div>
          );
        })}
      </section>

      {/* Kelajak */}
      <section className="on-dark grain relative overflow-hidden bg-brown">
        <div className="mx-auto max-w-3xl px-5 py-20 text-center lg:px-8 lg:py-28">
          <Reveal>
            <h2 className="h-section text-cream">{dict.about.futureTitle}</h2>
            <p className="lead mt-6">{dict.about.futureText}</p>
            <div className="mt-10 flex justify-center">
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
