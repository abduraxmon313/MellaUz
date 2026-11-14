import "server-only";

import type { CatalogProvider } from "./provider";
import type { Category, ListProductsOptions, Localized, Product } from "./types";

/**
 * Mini App katalogi (mella-bot) — saytda ham xuddi shu mahsulotlar ko'rinadi:
 * admin botda tasdiqlangan BILLZ mahsulotlari, AI rasmlari, narx va qoldiq BILLZ'dan.
 *
 * Manba: `GET {BOT_API_URL}/api/site/catalog`.
 *  • BOT_PUBLIC_URL — bot'ning ommaviy domeni (rasmlar brauzerda shu domendan ochiladi).
 *  • BOT_API_URL    — (ixtiyoriy) server-server so'rov uchun ichki manzil; bo'sh bo'lsa BOT_PUBLIC_URL.
 * Bot javob bermasa — oxirgi muvaffaqiyatli nusxa ko'rsatiladi (sayt yiqilmaydi).
 */

interface SiteProduct {
  id: string;
  slug: string;
  sku: string;
  brand: string;
  name: Localized;
  description: Localized;
  specs: Record<string, { name: string; value: string }[]>;
  categorySlug: string;
  price: number;
  oldPrice: number | null;
  stock: number;
  images: string[];
  sizes: { label: string; inStock: boolean }[];
  featured: boolean;
  updatedAt: string;
}

interface SiteCatalog {
  categories: { id: string; slug: string; name: Localized; image: string; order: number }[];
  products: SiteProduct[];
}

const MEMO_MS = 30_000;
const TIMEOUT_MS = 8_000;

type State = { at: number; value: Promise<{ categories: Category[]; products: Product[] }> | null; last: { categories: Category[]; products: Product[] } | null };
// Next.js sahifa va API'larni alohida bundle qiladi — kesh globalThis'da umumiy bo'lsin.
const g = globalThis as typeof globalThis & { __mellaBotCatalog?: State };
const state: State = (g.__mellaBotCatalog ??= { at: 0, value: null, last: null });

const trim = (s: string | undefined) => (s ?? "").trim().replace(/\/+$/, "");

export function botPublicUrl() {
  return trim(process.env.BOT_PUBLIC_URL);
}

export function hasBotCatalog() {
  return Boolean(botPublicUrl() || trim(process.env.BOT_API_URL));
}

/** Nisbiy rasm yo'li (/media/…, /img/…) → bot domenidagi to'liq URL. */
function absImage(u: string) {
  if (!u || /^https?:\/\//.test(u)) return u;
  const base = botPublicUrl();
  return base ? `${base}${u.startsWith("/") ? "" : "/"}${u}` : u;
}

function toProduct(p: SiteProduct): Product {
  return {
    slug: p.slug,
    sku: p.sku,
    brand: p.brand,
    name: p.name,
    description: p.description,
    specs: p.specs,
    categorySlug: p.categorySlug,
    price: p.price,
    oldPrice: p.oldPrice && p.oldPrice > p.price ? p.oldPrice : undefined,
    stock: p.stock,
    images: p.images.map(absImage).filter(Boolean),
    sizes: p.sizes,
    featured: p.featured,
    updatedAt: p.updatedAt,
    botId: p.id,
  };
}

async function fetchCatalog() {
  const base = trim(process.env.BOT_API_URL) || botPublicUrl();
  const res = await fetch(`${base}/api/site/catalog`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    // Sahifalar ISR (revalidate 60) — fetch ham shu muddatda keshlanadi ("no-store" sahifani dinamikka aylantirib yiqitadi).
    next: { revalidate: 60 },
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`bot katalogi: HTTP ${res.status}`);
  const data = (await res.json()) as SiteCatalog;
  const categories: Category[] = (data.categories ?? []).map((c) => ({
    slug: c.slug,
    name: c.name,
    image: absImage(c.image),
    order: c.order,
  }));
  return { categories, products: (data.products ?? []).map(toProduct) };
}

async function load() {
  const now = Date.now();
  if (state.value && now - state.at < MEMO_MS) return state.value;
  state.at = now;
  state.value = fetchCatalog()
    .then((v) => {
      state.last = v;
      return v;
    })
    .catch((err) => {
      // Next.js ichki signallari (masalan dinamik render) — o'tkazib yuboriladi.
      if (err && typeof err === "object" && "digest" in err) {
        state.value = null;
        throw err;
      }
      console.error("[catalog] Mini App katalogi olinmadi:", (err as Error).message);
      // Keyingi so'rov qayta urinsin, hozircha oxirgi nusxa.
      state.at = 0;
      return state.last ?? { categories: [], products: [] };
    });
  return state.value;
}

export class BotCatalogProvider implements CatalogProvider {
  async listCategories(): Promise<Category[]> {
    return (await load()).categories;
  }

  async getCategory(slug: string): Promise<Category | null> {
    return (await load()).categories.find((c) => c.slug === slug) ?? null;
  }

  async listProducts(options: ListProductsOptions = {}): Promise<Product[]> {
    let result = (await load()).products;
    if (options.category) result = result.filter((p) => p.categorySlug === options.category);
    if (options.featured) {
      const featured = result.filter((p) => p.featured);
      // Tanlanganlar bo'lmasa — eng yangilari (bot ro'yxatni yangilari birinchi qilib beradi).
      result = featured.length ? featured : result;
    }
    if (options.limit && options.limit > 0) result = result.slice(0, options.limit);
    return result;
  }

  async getProduct(slug: string): Promise<Product | null> {
    const list = (await load()).products;
    return list.find((p) => p.slug === slug) ?? list.find((p) => p.botId === slug) ?? null;
  }
}

/** Katalog manbai sozlanmagan — sayt bo'sh katalog bilan ishlaydi (namuna mahsulotlar olib tashlangan). */
export class EmptyCatalogProvider implements CatalogProvider {
  async listCategories() {
    return [];
  }
  async getCategory() {
    return null;
  }
  async listProducts() {
    return [];
  }
  async getProduct() {
    return null;
  }
}
