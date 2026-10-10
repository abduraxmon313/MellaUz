import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { site } from "@/lib/site";
import { OrderForm } from "@/components/OrderForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);
  return {
    title: dict.contact.title,
    description: dict.contact.subtitle,
    alternates: { canonical: `/${locale}/contact` },
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = isLocale(lang) ? lang : "uz";
  const dict = await getDictionary(locale);

  const rows: { label: string; value: string; href?: string }[] = [
    { label: dict.contact.addressLabel, value: site.address[locale] },
    { label: dict.contact.hoursLabel, value: site.hours },
  ];
  if (site.phone) {
    rows.push({
      label: dict.contact.phoneLabel,
      value: site.phone,
      href: `tel:${site.phoneHref}`,
    });
  }

  return (
    <section className="mx-auto max-w-7xl px-5 pt-28 pb-20 lg:px-8 lg:pt-36 lg:pb-28">
      <div className="max-w-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">
          {dict.common.brand}
        </p>
        <h1 className="mt-3 font-display text-4xl text-pearl sm:text-5xl">
          {dict.contact.title}
        </h1>
        <p className="mt-3 text-pearl/60">{dict.contact.subtitle}</p>
      </div>

      <div className="mt-14 grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-20">
        {/* Contact info */}
        <div className="space-y-8">
          <dl className="space-y-6">
            {rows.map((row) => (
              <div key={row.label} className="border-b border-mocha/25 pb-5">
                <dt className="text-xs uppercase tracking-wider text-pearl/45">
                  {row.label}
                </dt>
                <dd className="mt-1.5 text-lg text-pearl/90">
                  {row.href ? (
                    <a href={row.href} className="transition hover:text-champagne">
                      {row.value}
                    </a>
                  ) : (
                    row.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <div>
            <p className="text-xs uppercase tracking-wider text-pearl/45">
              {dict.contact.socialLabel}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <a
                href={site.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-mocha/50 px-5 py-2.5 text-sm text-pearl/80 transition hover:border-gold hover:text-champagne"
              >
                Instagram {site.instagramHandle}
              </a>
              {site.telegram && (
                <a
                  href={site.telegram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-mocha/50 px-5 py-2.5 text-sm text-pearl/80 transition hover:border-gold hover:text-champagne"
                >
                  Telegram
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Order form */}
        <div className="rounded-3xl border border-mocha/30 bg-dark-chocolate/50 p-6 sm:p-10">
          <h2 className="font-display text-2xl text-champagne">
            {dict.order.title}
          </h2>
          <p className="mt-1.5 mb-6 text-sm text-pearl/60">
            {dict.contact.orderHere}
          </p>
          <OrderForm dict={dict} locale={locale} />
        </div>
      </div>
    </section>
  );
}
