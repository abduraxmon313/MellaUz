import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { site } from "@/lib/site";
import { OrderForm } from "@/components/OrderForm";
import { PageHeader } from "@/components/PageHeader";

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

  const social =
    "btn btn-secondary btn-sm normal-case tracking-normal text-[13px] font-medium";

  return (
    <>
      <PageHeader
        eyebrow={dict.common.brand}
        title={dict.contact.title}
        subtitle={dict.contact.subtitle}
      />

      <section className="container-site py-12 lg:py-20">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          {/* Aloqa ma'lumotlari */}
          <div className="space-y-6">
            <dl className="card divide-y divide-line px-6">
              {rows.map((row) => (
                <div key={row.label} className="py-5">
                  <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 text-lg text-brown">
                    {row.href ? (
                      <a
                        href={row.href}
                        className="tabular-nums underline decoration-gold decoration-1 underline-offset-4 transition-colors hover:text-bronze"
                      >
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {dict.contact.socialLabel}
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={social}
                >
                  Instagram {site.instagramHandle}
                </a>
                {site.telegram && (
                  <a
                    href={site.telegram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={social}
                  >
                    Telegram
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Buyurtma formasi */}
          <div className="card p-6 shadow-card sm:p-10">
            <h2 className="font-display text-3xl leading-tight text-brown">{dict.order.title}</h2>
            <p className="mt-1.5 mb-7 text-sm text-muted">{dict.contact.orderHere}</p>
            <OrderForm dict={dict} locale={locale} />
          </div>
        </div>
      </section>
    </>
  );
}
