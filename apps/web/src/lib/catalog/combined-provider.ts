import "server-only";

import type { CatalogProvider } from "./provider";
import type { Category, ListProductsOptions, Product } from "./types";
import { getSettings, listManualProducts, type ManualProduct } from "@/lib/manual-catalog";

/**
 * Asosiy katalog (namuna yoki ERP) + admin panelda qo'lda kiritilgan mahsulotlar.
 * Qo'lda kiritilganlar ro'yxat boshida turadi. Baza ishlamasa — sayt yiqilmaydi,
 * faqat asosiy katalog ko'rsatiladi.
 */
export function manualToProduct(m: ManualProduct): Product {
  const stock = m.sizes.length ? m.sizes.reduce((s, x) => s + Math.max(0, x.stock), 0) : m.stock;
  return {
    slug: m.slug,
    sku: m.sku,
    name: m.name,
    description: m.description,
    material: m.material ?? undefined,
    categorySlug: m.category,
    price: m.price,
    oldPrice: m.oldPrice ?? undefined,
    stock,
    images: m.imageIds.map((id) => `/api/media/${id}`),
    featured: m.featured,
    sizes: m.sizes.map((s) => ({ label: s.label, inStock: s.stock > 0 })),
    updatedAt: m.updatedAt,
  };
}

type Loaded = { products: Product[]; hideSamples: boolean };
const EMPTY: Loaded = { products: [], hideSamples: false };

// Bir sahifa render'ida katalog bir necha marta so'raladi — natijani qisqa muddat eslab qolamiz.
const MEMO_MS = 3_000;
// Baza ishlamasa (masalan Railway build paytida ichki tarmoq yo'q) — har so'rovda kutib qolmaslik uchun
// 30 soniya bazaga murojaat qilmaymiz.
const BREAKER_MS = 30_000;
// Next.js API va sahifalarni alohida bundle qiladi — modul o'zgaruvchilari ular orasida
// umumiy emas. Kesh globalThis'da turadi, shunda admin API uni sahifalar uchun ham tozalaydi.
type CacheState = { memo: { at: number; value: Promise<Loaded> } | null; downUntil: number };
const g = globalThis as typeof globalThis & { __mellaManualCache?: CacheState };
const cache: CacheState = (g.__mellaManualCache ??= { memo: null, downUntil: 0 });

/** Admin saqlaganda chaqiriladi — keyingi render yangi ma'lumotni o'qisin. */
export function invalidateManualCache() {
  cache.memo = null;
  cache.downUntil = 0;
}

async function fetchManual(): Promise<Loaded> {
  try {
    const [rows, settings] = await Promise.all([listManualProducts({ publishedOnly: true }), getSettings()]);
    return { products: rows.map(manualToProduct), hideSamples: settings.hideSamples };
  } catch (err) {
    cache.downUntil = Date.now() + BREAKER_MS;
    console.error("[catalog] qo'lda kiritilgan mahsulotlar o'qilmadi:", (err as Error).message);
    return EMPTY;
  }
}

function loadManual(): Promise<Loaded> {
  const now = Date.now();
  if (now < cache.downUntil) return Promise.resolve(EMPTY);
  if (cache.memo && now - cache.memo.at < MEMO_MS) return cache.memo.value;
  cache.memo = { at: now, value: fetchManual() };
  return cache.memo.value;
}

export class CombinedCatalogProvider implements CatalogProvider {
  constructor(private readonly base: CatalogProvider) {}

  private async all(): Promise<Product[]> {
    const manual = await loadManual();
    const slugs = new Set(manual.products.map((p) => p.slug));
    const base = manual.hideSamples ? [] : (await this.base.listProducts()).filter((p) => !slugs.has(p.slug));
    return [...manual.products, ...base];
  }

  listCategories(): Promise<Category[]> {
    return this.base.listCategories();
  }

  getCategory(slug: string): Promise<Category | null> {
    return this.base.getCategory(slug);
  }

  async listProducts(options: ListProductsOptions = {}): Promise<Product[]> {
    let result = await this.all();
    if (options.category) result = result.filter((p) => p.categorySlug === options.category);
    if (options.featured) {
      const featured = result.filter((p) => p.featured);
      // Bosh sahifa bo'sh qolmasin: tanlanganlar yo'q bo'lsa — eng yangilari.
      result = featured.length ? featured : result;
    }
    if (options.limit && options.limit > 0) result = result.slice(0, options.limit);
    return result;
  }

  async getProduct(slug: string): Promise<Product | null> {
    return (await this.all()).find((p) => p.slug === slug) ?? null;
  }
}
