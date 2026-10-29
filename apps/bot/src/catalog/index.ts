import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store } from "../store.js";
import {
  ensureCurrentShop,
  fetchCategories,
  fetchProductsPage,
  fetchShops,
  photosOf,
  priceOf,
  stockOf,
  variantLabel,
  type BillzProductRaw,
  type BillzShop,
} from "../billz/catalog.js";
import { buildMockSnapshot } from "./mock.js";
import { categories as mockCategories } from "./mock-source.js";
import type { ManualRow } from "../store.js";
import type { CatalogSnapshot, Category, Lang, Localized, Product, Variant } from "./types.js";

/**
 * Katalog xizmati — YANGI yondashuv:
 *
 * • Kategoriyalar va do'konlar — xotirada (kam, bir marta yuklanadi).
 * • Mahsulotlar — BILLZ'dan to'g'ridan-to'g'ri sahifalab olinadi
 *   (foydalanuvchi scroll qilsa keyingisi keladi). Xotirada saqlanmaydi.
 * • Qo'lda kiritilgan mahsulotlar (admin panel) — bazadan.
 * • Mock katalog — BILLZ ulanmagan bo'lsa.
 */

const SERVICE_TYPE_ID = "5a0e556a-15f8-47ac-ae07-46972f3c6ab4";
const KV_CATEGORIES = "billz_categories";
const KV_SHOPS = "billz_shops";

let categories: Category[] = [];
let shops: BillzShop[] = [];
let manual: { products: Product[]; hideSamples: boolean } = { products: [], hideSamples: false };
let manualError = "";
let lastError = "";
let mockSnapshot: CatalogSnapshot | null = null;

/** Rasm kaliti → asl URL. */
const imageMap = new Map<string, string>();

export function imageKey(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 32);
}
export function resolveImageKey(key: string) { return imageMap.get(key) ?? null; }

export function publicImage(url: string | undefined) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) {
    const k = imageKey(url);
    imageMap.set(k, url);
    return `/img/${k}`;
  }
  return url;
}

export function loc(v: Localized, lang: Lang): string {
  if (typeof v === "string") return v;
  return v[lang] || v.uz || v.ru || v.en || "";
}

export function catalogStatus() {
  return {
    source: hasBillz ? "billz" : "mock",
    syncedAt: new Date().toISOString(),
    products: hasBillz ? "lazy (BILLZ'dan sahifalab)" : (mockSnapshot?.products.length ?? 0),
    categories: categories.length,
    shops: shops.length,
    manualProducts: manual.products.length,
    lastError,
    manualError,
  };
}

export function listShops() { return shops; }

// ── Qo'lda kiritilgan mahsulotlar ──────────────────────────

export function isManualId(id: string) { return id.startsWith("m-"); }

function manualToProduct(m: ManualRow): Product {
  const description: Record<string, string> = {};
  for (const l of ["uz", "ru", "en"] as const) {
    const d = m.description[l] || m.description.uz || "";
    const mat = m.material?.[l] || m.material?.uz || "";
    description[l] = mat ? `${d}\n\n${mat}` : d;
  }
  const variants: Variant[] = m.sizes.length
    ? m.sizes.map((s) => ({
        id: `${m.id}~${s.label}`, label: s.label, sku: `${m.sku}-${s.label}`, barcode: "",
        price: m.price, oldPrice: m.oldPrice, stock: Math.max(0, s.stock), shopStocks: [],
      }))
    : [{ id: m.id, label: "", sku: m.sku, barcode: "", price: m.price, oldPrice: m.oldPrice, stock: Math.max(0, m.stock), shopStocks: [] }];
  return {
    id: m.id, name: m.name, description, brand: "MELLA", sku: m.sku,
    categoryIds: [m.category], images: m.imageIds.map((id) => `/media/${id}`),
    variants, attributeNames: m.sizes.length ? ["O'lcham"] : [],
    featured: m.featured, updatedAt: m.updatedAt,
  };
}

export async function refreshManual(): Promise<void> {
  try {
    const res = await store.listManualProducts();
    manual = { products: res.products.map(manualToProduct), hideSamples: res.hideSamples };
    manualError = "";
  } catch (e) {
    manualError = (e as Error).message;
    console.warn("[catalog] qo'lda kiritilgan mahsulotlar o'qilmadi:", manualError);
  }
}

// ── Boshlash ────────────────────────────────────────────────

let manualTimer: NodeJS.Timeout | null = null;
let catTimer: NodeJS.Timeout | null = null;

export async function initCatalog() {
  await refreshManual();
  manualTimer = setInterval(() => void refreshManual(), 30_000);
  manualTimer.unref();

  if (!hasBillz) {
    mockSnapshot = buildMockSnapshot();
    categories = mockSnapshot.categories;
    console.log("[catalog] BILLZ yo'q — namuna katalog.");
    return;
  }

  // Saqlangan kategoriyalar va do'konlarni yuklash (tez start).
  try {
    const saved = await store.kvGet<Category[]>(KV_CATEGORIES);
    if (saved?.length) { categories = saved; console.log(`[catalog] saqlangan kategoriyalar: ${saved.length}`); }
  } catch {}
  try {
    const saved = await store.kvGet<BillzShop[]>(KV_SHOPS);
    if (saved?.length) shops = saved;
  } catch {}

  // Fonda yangilash.
  void syncMeta();
  catTimer = setInterval(() => void syncMeta(), config.billz.syncMinutes * 60_000);
  catTimer.unref();
}

/** Faqat kategoriyalar va do'konlarni yangilaydi (yengil). */
export async function syncMeta(): Promise<void> {
  try {
    await ensureCurrentShop();
    const [cats, sh] = await Promise.all([fetchCategories(), fetchShops()]);
    categories = cats;
    shops = sh;
    lastError = "";
    await store.kvSet(KV_CATEGORIES, cats).catch(() => {});
    await store.kvSet(KV_SHOPS, sh).catch(() => {});
    console.log(`[catalog] BILLZ meta: ${cats.length} kategoriya, ${sh.length} do'kon`);
  } catch (e) {
    lastError = (e as Error).message;
    console.error("[catalog] BILLZ meta xatosi:", lastError);
  }
}

/** Admin /sync buyrug'i uchun. */
export async function syncNow(): Promise<void> {
  await syncMeta();
}

// ── BILLZ mahsulotni Mini App formatiga o'girish ────────────

function billzToCard(p: BillzProductRaw, lang: Lang, shopId?: string) {
  const pr = priceOf(p, shopId);
  const stock = stockOf(p, shopId);
  const images = photosOf(p);
  const name = p.name ?? "";
  return {
    id: p.id,
    name,
    category: (p.categories?.[0]?.name) ?? "",
    price: pr.price,
    old_price: pr.oldPrice,
    price_from: false,
    image: publicImage(images[0]),
    in_stock: stock > 0,
    has_variants: Boolean(p.is_variative),
    single_variant_id: p.is_variative ? null : p.id,
    stock,
    sku: p.sku ?? "",
    brand: p.brand_name ?? "",
  };
}

function billzToDetail(p: BillzProductRaw, related: BillzProductRaw[], lang: Lang, shopId?: string) {
  const isParent = p.is_variative && !p.parent_id;
  const children = isParent ? related.filter((c) => c.parent_id === p.id) : [p];
  const baseName = p.name ?? "";
  const images = photosOf(p);
  for (const c of children) { for (const u of photosOf(c)) { if (!images.includes(u)) images.push(u); } }

  const variants = children.map((c) => {
    const pr = priceOf(c, shopId);
    const st = stockOf(c, shopId);
    return {
      id: c.id,
      label: isParent ? variantLabel(c, baseName) : "",
      price: pr.price, old_price: pr.oldPrice,
      stock: st, in_stock: st > 0,
    };
  }).filter((v) => v.price > 0).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));

  const first = variants[0];
  const totalStock = variants.reduce((s, v) => s + v.stock, 0);
  return {
    id: p.id,
    name: baseName,
    category: (p.categories?.[0]?.name) ?? "",
    price: first?.price ?? 0,
    old_price: first?.old_price ?? null,
    price_from: new Set(variants.map((v) => v.price).filter(Boolean)).size > 1,
    image: publicImage(images[0]),
    images: images.map(publicImage),
    in_stock: totalStock > 0,
    has_variants: variants.length > 1 || Boolean(variants[0]?.label),
    single_variant_id: variants.length === 1 ? variants[0]!.id : null,
    stock: totalStock,
    description: p.description ?? "",
    brand: p.brand_name ?? "",
    sku: p.sku ?? "",
    attribute_name: [...new Set(children.flatMap((c) =>
      (c.product_attributes ?? []).map((a) => String(a.attribute_name ?? "").trim())
    ))].filter(Boolean).join(" / "),
    variants,
  };
}

// ── Ommaviy so'rov funksiyalari ─────────────────────────────

export function listCategories(lang: Lang) {
  return categories.map((c) => ({ id: c.id, name: loc(c.name, lang) }));
}

export async function listProducts(
  opts: { page?: number; limit?: number; category?: string; q?: string; shopId?: string; ids?: string[] },
  lang: Lang,
) {
  // Qo'lda kiritilganlar (sahifa 1 da boshiga qo'shiladi).
  const manualCards = (opts.page ?? 1) === 1 && !opts.ids?.length
    ? manual.products
        .filter((p) => !opts.category || p.categoryIds.includes(opts.category))
        .filter((p) => {
          if (!opts.q) return true;
          const q = opts.q.toLowerCase();
          return loc(p.name, lang).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
        })
        .map((p) => ({
          id: p.id, name: loc(p.name, lang), category: "",
          price: p.variants[0]?.price ?? 0, old_price: p.variants[0]?.oldPrice ?? null,
          price_from: false, image: publicImage(p.images[0]),
          in_stock: p.variants.some((v) => v.stock > 0),
          has_variants: p.variants.length > 1 || Boolean(p.variants[0]?.label),
          single_variant_id: p.variants.length === 1 ? p.variants[0]!.id : null,
          stock: p.variants.reduce((s, v) => s + v.stock, 0),
        }))
    : [];

  if (!hasBillz) {
    // Mock katalog.
    const mock = mockSnapshot;
    if (!mock) return manualCards;
    const hideBase = manual.hideSamples;
    let list = hideBase ? [] : mock.products;
    if (opts.category) list = list.filter((p) => p.categoryIds.includes(opts.category!));
    if (opts.q) {
      const q = opts.q.toLowerCase();
      list = list.filter((p) => loc(p.name, lang).toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
    }
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;
    const start = (page - 1) * limit;
    const slice = list.slice(start, start + limit).map((p) => {
      const v = p.variants[0]!;
      const stock = p.variants.reduce((s, x) => s + x.stock, 0);
      return {
        id: p.id, name: loc(p.name, lang), category: "",
        price: v.price, old_price: v.oldPrice, price_from: false,
        image: publicImage(p.images[0]), in_stock: stock > 0,
        has_variants: p.variants.length > 1, single_variant_id: p.variants.length === 1 ? v.id : null, stock,
      };
    });
    return { products: [...manualCards, ...slice], total: list.length + manualCards.length, page, has_more: start + limit < list.length };
  }

  // BILLZ — sahifalab olish.
  const page = opts.page ?? 1;
  const limit = opts.limit ?? 20;
  try {
    const r = await fetchProductsPage({ page, limit, search: opts.q });
    const filtered = r.products
      .filter((p) => p && p.id && p.product_type_id !== SERVICE_TYPE_ID)
      .filter((p) => !p.is_variative || p.parent_id) // ota tovarni yashiramiz
      .filter((p) => {
        const pr = priceOf(p, opts.shopId);
        return pr.price > 0;
      })
      .filter((p) => {
        if (!opts.category || !p.categories?.length) return true;
        return p.categories.some((c) => c.id === opts.category || c.name === opts.category);
      });

    const cards = filtered.map((p) => billzToCard(p, lang, opts.shopId));
    return {
      products: [...manualCards, ...cards],
      total: r.total,
      page,
      has_more: page * limit < r.total,
    };
  } catch (e) {
    console.error("[catalog] BILLZ products xato:", (e as Error).message);
    return { products: manualCards, total: manualCards.length, page, has_more: false, error: (e as Error).message };
  }
}

export async function getProductDetail(id: string, lang: Lang, shopId?: string) {
  // Qo'lda kiritilgan mahsulot.
  const mp = manual.products.find((p) => p.id === id);
  if (mp) {
    return {
      id: mp.id, name: loc(mp.name, lang), category: "",
      price: mp.variants[0]?.price ?? 0, old_price: mp.variants[0]?.oldPrice ?? null,
      price_from: false, image: publicImage(mp.images[0]),
      images: mp.images.map(publicImage),
      in_stock: mp.variants.some((v) => v.stock > 0),
      has_variants: mp.variants.length > 1 || Boolean(mp.variants[0]?.label),
      single_variant_id: mp.variants.length === 1 ? mp.variants[0]!.id : null,
      stock: mp.variants.reduce((s, v) => s + v.stock, 0),
      description: loc(mp.description, lang), brand: mp.brand, sku: mp.sku,
      attribute_name: mp.attributeNames.join(" / "),
      variants: mp.variants.map((v) => ({
        id: v.id, label: v.label, price: v.price, old_price: v.oldPrice,
        stock: v.stock, in_stock: v.stock > 0,
      })),
    };
  }

  if (!hasBillz) {
    const p = mockSnapshot?.products.find((x) => x.id === id);
    if (!p) return null;
    const v = p.variants[0]!;
    return {
      id: p.id, name: loc(p.name, lang), category: "",
      price: v.price, old_price: v.oldPrice, price_from: false,
      image: publicImage(p.images[0]), images: p.images.map(publicImage),
      in_stock: v.stock > 0, has_variants: p.variants.length > 1,
      single_variant_id: p.variants.length === 1 ? v.id : null,
      stock: p.variants.reduce((s, x) => s + x.stock, 0),
      description: loc(p.description, lang), brand: p.brand, sku: p.sku,
      attribute_name: p.attributeNames.join(" / "),
      variants: p.variants.map((x) => ({
        id: x.id, label: x.label, price: x.price, old_price: x.oldPrice,
        stock: x.stock, in_stock: x.stock > 0,
      })),
    };
  }

  // BILLZ — mahsulotni va uning variatsiyalarini qidiramiz.
  try {
    const r = await fetchProductsPage({ page: 1, limit: 50, search: id });
    const all = r.products ?? [];
    let target = all.find((p) => p.id === id);
    if (!target) return null;
    // Agar bu variatsiya bo'lsa — ota tovarni topamiz.
    if (target.parent_id) {
      const parent = all.find((p) => p.id === target!.parent_id);
      if (parent) target = parent;
    }
    return billzToDetail(target, all, lang, shopId);
  } catch (e) {
    console.error("[catalog] BILLZ product detail xato:", (e as Error).message);
    return null;
  }
}

export function findVariant(variantId: string): { product: Product; variant: Variant } | null {
  // Qo'lda kiritilgan mahsulotlardan qidiramiz.
  for (const p of manual.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  // Mock katalogdan.
  if (mockSnapshot) {
    for (const p of mockSnapshot.products) {
      const v = p.variants.find((x) => x.id === variantId);
      if (v) return { product: p, variant: v };
    }
  }
  // BILLZ variant — buyurtma yaratishda serverda narx/qoldiq qayta tekshiriladi.
  return null;
}

export function totalStock(p: Product) {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}
