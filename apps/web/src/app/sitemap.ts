import type { MetadataRoute } from "next";
import { locales } from "@/i18n/config";
import { siteUrl } from "@/lib/site";
import { getCatalog } from "@/lib/catalog/provider";

// Mahsulotlar Mini App katalogidan — sitemap soatiga bir yangilanadi.
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const catalog = await getCatalog();
  const [categories, products] = await Promise.all([catalog.listCategories(), catalog.listProducts()]);

  const entries: MetadataRoute.Sitemap = [];

  for (const lang of locales) {
    const prefix = `${base}/${lang}`;
    entries.push(
      { url: prefix, changeFrequency: "weekly", priority: 1 },
      { url: `${prefix}/catalog`, changeFrequency: "weekly", priority: 0.9 },
      { url: `${prefix}/about`, changeFrequency: "monthly", priority: 0.6 },
      { url: `${prefix}/contact`, changeFrequency: "monthly", priority: 0.6 },
    );
    for (const category of categories) {
      entries.push({ url: `${prefix}/catalog/${category.slug}`, changeFrequency: "weekly", priority: 0.8 });
    }
    for (const product of products) {
      entries.push({ url: `${prefix}/product/${product.slug}`, changeFrequency: "weekly", priority: 0.7 });
    }
  }

  return entries;
}
