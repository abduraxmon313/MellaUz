/**
 * Brend sozlamalari. Qiymatlar env orqali o'zgartiriladi; aks holda
 * standart (default) qiymatlar ishlatiladi. Haqiqiy raqam/manzil
 * bergandan so'ng Railway env'ga qo'yiladi.
 */
export const site = {
  name: "MELLA",
  instagram:
    process.env.NEXT_PUBLIC_INSTAGRAM_URL || "https://www.instagram.com/mella_uz/",
  instagramHandle: "@mella_uz",
  telegram: process.env.NEXT_PUBLIC_TELEGRAM_URL || "",
  phone: process.env.NEXT_PUBLIC_PHONE || "",
  phoneHref: (process.env.NEXT_PUBLIC_PHONE || "").replace(/[^+\d]/g, ""),
  email: process.env.NEXT_PUBLIC_EMAIL || "",
  address: {
    uz: process.env.NEXT_PUBLIC_ADDRESS_UZ || "Toshkent, O‘zbekiston",
    ru: process.env.NEXT_PUBLIC_ADDRESS_RU || "Ташкент, Узбекистан",
    en: process.env.NEXT_PUBLIC_ADDRESS_EN || "Tashkent, Uzbekistan",
  },
  hours: process.env.NEXT_PUBLIC_HOURS || "10:00 – 20:00",
  foundedYear: 2019,
} as const;

/** Sayt bazaviy URL'i (SEO: canonical, sitemap, og). */
export function siteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railway) return `https://${railway}`;
  return "http://localhost:3000";
}
