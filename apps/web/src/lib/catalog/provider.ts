import "server-only";

import type { Locale } from "@/i18n/config";
import type {
  Category,
  CategoryView,
  ListProductsOptions,
  Product,
  ProductView,
} from "./types";

/**
 * Katalog manbai interfeysi.
 *
 * Hozir — MockProvider (namuna ma'lumot). ERP API tayyor bo'lganda faqat
 * `erp-provider.ts` yoziladi va `getCatalog()` uni qaytaradi — qolgan kod
 * (sahifalar, komponentlar) umuman o'zgarmaydi.
 */
export interface CatalogProvider {
  listCategories(): Promise<Category[]>;
  listProducts(options?: ListProductsOptions): Promise<Product[]>;
  getProduct(slug: string): Promise<Product | null>;
  getCategory(slug: string): Promise<Category | null>;
}

function pick<T extends { [k: string]: unknown }>(
  value: Record<Locale, string> | undefined,
  locale: Locale,
): string {
  if (!value) return "";
  return value[locale] ?? value.uz ?? "";
}

export function toProductView(
  product: Product,
  category: Category | null,
  locale: Locale,
): ProductView {
  return {
    slug: product.slug,
    sku: product.sku,
    name: pick(product.name, locale),
    description: pick(product.description, locale),
    material: product.material ? pick(product.material, locale) : undefined,
    categorySlug: product.categorySlug,
    categoryName: category ? pick(category.name, locale) : product.categorySlug,
    price: product.price,
    oldPrice: product.oldPrice,
    inStock: product.stock > 0,
    images: product.images,
  };
}

export function toCategoryView(category: Category, locale: Locale): CategoryView {
  return {
    slug: category.slug,
    name: pick(category.name, locale),
    tagline: category.tagline ? pick(category.tagline, locale) : undefined,
    image: category.image,
  };
}

let cached: CatalogProvider | null = null;

/**
 * Katalog provayderini tanlaydi.
 * - `ERP_API_BASE_URL` o'rnatilgan bo'lsa — haqiqiy ERP (HTTP) provayderi.
 * - Aks holda — namuna (mock) ma'lumot.
 */
export async function getCatalog(): Promise<CatalogProvider> {
  if (cached) return cached;

  if (process.env.ERP_API_BASE_URL) {
    const { ErpCatalogProvider } = await import("./erp-provider");
    cached = new ErpCatalogProvider();
  } else {
    const { MockCatalogProvider } = await import("./mock-provider");
    cached = new MockCatalogProvider();
  }
  return cached;
}
