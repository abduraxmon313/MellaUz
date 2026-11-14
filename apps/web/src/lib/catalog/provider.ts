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
    sizes: product.sizes ?? [],
    brand: product.brand,
    specs: product.specs?.[locale] ?? product.specs?.uz ?? [],
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
 * - `BOT_PUBLIC_URL` / `BOT_API_URL` — Mini App katalogi (mella-bot): sayt va Mini App'da bir xil mahsulotlar.
 * - `ERP_API_BASE_URL` — eski ERP adapteri.
 * - Hech biri bo'lmasa — bo'sh katalog (namuna mahsulotlar olib tashlangan).
 * - `SITE_MANUAL_PRODUCTS=true` va DATABASE_URL — ustiga /admin panelda qo'lda kiritilganlar.
 */
export async function getCatalog(): Promise<CatalogProvider> {
  if (cached) return cached;

  let base: CatalogProvider;
  const { BotCatalogProvider, EmptyCatalogProvider, hasBotCatalog } = await import("./bot-provider");
  if (hasBotCatalog()) {
    base = new BotCatalogProvider();
  } else if (process.env.ERP_API_BASE_URL) {
    const { ErpCatalogProvider } = await import("./erp-provider");
    base = new ErpCatalogProvider();
  } else {
    console.warn("[catalog] BOT_PUBLIC_URL o'rnatilmagan — sayt katalogi bo'sh.");
    base = new EmptyCatalogProvider();
  }
  if (process.env.DATABASE_URL && process.env.SITE_MANUAL_PRODUCTS === "true") {
    const { CombinedCatalogProvider } = await import("./combined-provider");
    cached = new CombinedCatalogProvider(base);
  } else {
    cached = base;
  }
  return cached;
}
