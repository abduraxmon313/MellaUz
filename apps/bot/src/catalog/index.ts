import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store, type ManualRow } from "../store.js";
import {
  buildIndex,
  fetchAllProducts,
  fetchCategoryTree,
  fetchShops,
  fetchUpdatedSince,
  type BillzShop,
  type SlimProduct,
} from "../billz/catalog.js";
import { buildMockSnapshot } from "./mock.js";
import { categories as mockCategories } from "./mock-source.js";
import type { Category, Lang, Localized, Product, Variant } from "./types.js";

/**
 * Katalog xizmati.
 *
 * Mini App so'rovlari (ro'yxat, kategoriya, filial, qidiruv, mahsulot oynasi, buyurtma)
 * XOTIRADAGI indeksdan darhol javob oladi. BILLZ'ga har so'rovda murojaat qilinmaydi —
 * aks holda har sahifa 1–10 s kutardi, variatsiyalar sahifalar orasida bo'linib
 * takrorlanardi, kategoriya filtri va mahsulot oynasi ishlamasdi.
 *
 * Indeks fonda yangilanadi (DB'ga yozilmaydi):
 *  • ishga tushganda — to'liq yuklash; har 2000 tovardan keyin indeks e'lon qilinadi;
 *  • har BILLZ_SYNC_MINUTES daqiqada — faqat o'zgarganlar (last_updated_date);
 *  • har BILLZ_FULL_SYNC_MINUTES daqiqada — to'liq qayta yuklash (o'chirilganlarni olib tashlash).
 */

const FULL_SYNC_MINUTES = Math.max(30, Number(process.env.BILLZ_FULL_SYNC_MINUTES) || 180);
const MANUAL_REFRESH_MS = 30_000;

// ── Holat ───────────────────────────────────────────────────

/** BILLZ xom ma'lumoti (ixcham) — o'zgarganlarni birlashtirish uchun. */
let raw = new Map<string, SlimProduct>();
let tree: Awaited<ReturnType<typeof fetchCategoryTree>> = [];
let shops: BillzShop[] = [];

/** Asosiy katalog (BILLZ yoki namuna). */
let baseProducts: Product[] = [];
let baseCategories: Category[] = [];
let source: "billz" | "mock" = "mock";

/** Qo'lda kiritilgan mahsulotlar (sayt /admin). */
let manual: { products: Product[]; hideSamples: boolean } = { products: [], hideSamples: false };

/** Mijozga ko'rinadigan birlashgan ro'yxat va tezkor qidiruv xaritalari. */
let all: Product[] = [];
let categoriesView: Category[] = [];
let byProduct = new Map<string, Product>();
let byVariant = new Map<string, { product: Product; variant: Variant }>();

let syncedAt = "";
let lastError = "";
let manualError = "";
let loading = { active: false, loaded: 0, total: 0 };
let fullRunning: Promise<void> | null = null;
let deltaRunning: Promise<void> | null = null;
let lastFullStart = 0;
let lastDeltaFrom: Date | null = null;

// ── Rasmlar ─────────────────────────────────────────────────

const imageMap = new Map<string, string>();

export function imageKey(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 32);
}

export function resolveImageKey(key: string) {
  return imageMap.get(key) ?? null;
}

/** Tashqi rasm (BILLZ CDN) mijozga /img/<kalit> orqali beriladi. */
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

// ── Qo'lda kiritilgan mahsulotlar ───────────────────────────

/** Qo'lda kiritilgan variant ID'lari "m-" bilan boshlanadi — BILLZ'ga yuborilmaydi. */
export function isManualId(id: string) {
  return id.startsWith("m-");
}

function manualToProduct(m: ManualRow): Product {
  const description: Record<string, string> = {};
  for (const l of ["uz", "ru", "en"] as const) {
    const d = m.description[l] || m.description.uz || "";
    const mat = m.material?.[l] || m.material?.uz || "";
    description[l] = mat ? `${d}\n\n${mat}` : d;
  }
  const variants: Variant[] = m.sizes.length
    ? m.sizes.map((s) => ({
        id: `${m.id}~${s.label}`,
        label: s.label,
        sku: `${m.sku}-${s.label}`,
        barcode: "",
        price: m.price,
        oldPrice: m.oldPrice,
        stock: Math.max(0, s.stock),
      }))
    : [{ id: m.id, label: "", sku: m.sku, barcode: "", price: m.price, oldPrice: m.oldPrice, stock: Math.max(0, m.stock) }];
  return {
    id: m.id,
    name: m.name,
    description,
    brand: "MELLA",
    sku: m.sku,
    categoryIds: [m.category],
    images: m.imageIds.map((id) => `/media/${id}`),
    variants,
    attributeNames: m.sizes.length ? ["O‘lcham"] : [],
    featured: m.featured,
    updatedAt: m.updatedAt,
  };
}

export async function refreshManual(): Promise<void> {
  try {
    const res = await store.listManualProducts();
    manual = { products: res.products.map(manualToProduct), hideSamples: res.hideSamples };
    manualError = "";
    rebuildView();
  } catch (e) {
    manualError = (e as Error).message;
    console.warn("[catalog] qo'lda kiritilgan mahsulotlar o'qilmadi:", manualError);
  }
}

// ── Ko'rinishni qayta qurish ────────────────────────────────

function rebuildView() {
  const hideBase = manual.hideSamples && source === "mock";
  all = [...manual.products, ...(hideBase ? [] : baseProducts)];

  const cats = [...baseCategories];
  for (const p of manual.products) {
    for (const id of p.categoryIds) {
      if (cats.some((c) => c.id === id)) continue;
      const mc = mockCategories.find((c) => c.slug === id);
      cats.push({ id, name: mc ? mc.name : id, order: mc ? mc.order : 99 });
    }
  }
  categoriesView = cats;

  byProduct = new Map(all.map((p) => [p.id, p]));
  byVariant = new Map();
  for (const p of all) for (const v of p.variants) byVariant.set(v.id, { product: p, variant: v });
  for (const p of all) for (const u of p.images) publicImage(u);
}

function applyBillz(items: SlimProduct[]) {
  const idx = buildIndex(items, tree, shops);
  baseProducts = idx.products;
  baseCategories = idx.categories;
  source = "billz";
  rebuildView();
}

// ── Sinxronlash ─────────────────────────────────────────────

async function loadMeta() {
  const [t, s] = await Promise.all([
    fetchCategoryTree().catch((e) => {
      console.warn("[catalog] kategoriya daraxti olinmadi:", (e as Error).message);
      return tree;
    }),
    fetchShops().catch((e) => {
      console.warn("[catalog] filiallar olinmadi:", (e as Error).message);
      return shops;
    }),
  ]);
  tree = t;
  shops = s;
}

/** To'liq yuklash. Natija faqat barcha sahifalar kelganda qo'llanadi (yarim katalog e'lon qilinmaydi),
 *  bundan mustasno — birinchi ishga tushish: unda bosqichma-bosqich ko'rsatamiz. */
function fullSync(): Promise<void> {
  if (fullRunning) return fullRunning;
  fullRunning = (async () => {
    const started = new Date();
    lastFullStart = Date.now();
    const firstLoad = source !== "billz";
    loading = { active: true, loaded: 0, total: 0 };
    try {
      await loadMeta();
      const items = await fetchAllProducts((partial, loaded, total) => {
        loading = { active: true, loaded, total };
        if (firstLoad) applyBillz(partial);
      });
      raw = new Map(items.map((p) => [p.id, p]));
      applyBillz(items);
      lastDeltaFrom = new Date(started.getTime() - 60_000);
      syncedAt = new Date().toISOString();
      lastError = "";
      console.log(
        `[catalog] BILLZ: ${items.length} tovar → ${baseProducts.length} karta, ${baseCategories.length} kategoriya, ${shops.length} filial`,
      );
    } catch (e) {
      lastError = (e as Error).message;
      console.error("[catalog] BILLZ to'liq sinxron xatosi:", lastError);
    } finally {
      loading = { active: false, loaded: 0, total: 0 };
      fullRunning = null;
    }
  })();
  return fullRunning;
}

/** Faqat o'zgarganlarni olib, indeksni yangilaydi. */
function deltaSync(): Promise<void> {
  if (fullRunning) return fullRunning;
  if (deltaRunning) return deltaRunning;
  if (!lastDeltaFrom || Date.now() - lastFullStart > FULL_SYNC_MINUTES * 60_000) return fullSync();
  deltaRunning = (async () => {
    const started = new Date();
    try {
      const changed = await fetchUpdatedSince(lastDeltaFrom!);
      if (changed.length) {
        for (const p of changed) raw.set(p.id, p);
        applyBillz([...raw.values()]);
        console.log(`[catalog] BILLZ: ${changed.length} ta o'zgargan tovar yangilandi`);
      }
      lastDeltaFrom = new Date(started.getTime() - 60_000);
      syncedAt = new Date().toISOString();
      lastError = "";
    } catch (e) {
      lastError = (e as Error).message;
      console.error("[catalog] BILLZ yangilash xatosi:", lastError);
    } finally {
      deltaRunning = null;
    }
  })();
  return deltaRunning;
}

/** Faqat o'zgarganlarni yangilash (vaqt jadvali bo'yicha ham chaqiriladi). */
export function syncChanges(): Promise<void> {
  if (!hasBillz) return Promise.resolve();
  return deltaSync();
}

/** Admin /sync: to'liq qayta yuklash. */
export function syncNow(): Promise<void> {
  if (!hasBillz) return Promise.resolve();
  return fullSync();
}

export async function initCatalog() {
  await refreshManual();
  setInterval(() => void refreshManual(), MANUAL_REFRESH_MS).unref();

  if (!hasBillz) {
    const mock = buildMockSnapshot();
    baseProducts = mock.products;
    baseCategories = mock.categories;
    source = "mock";
    syncedAt = mock.syncedAt;
    rebuildView();
    console.log("[catalog] BILLZ_SECRET_TOKEN yo'q — namuna katalog ishlatiladi.");
    return;
  }
  rebuildView();
  // Server darhol javob bera boshlasin — yuklash fonda.
  void fullSync();
  setInterval(() => void deltaSync(), config.billz.syncMinutes * 60_000).unref();
}

export function catalogStatus() {
  return {
    source,
    syncedAt: syncedAt || new Date().toISOString(),
    products: all.length,
    categories: categoriesView.length,
    shops: shops.length,
    manualProducts: manual.products.length,
    loading: loading.active ? `${loading.loaded}/${loading.total || "?"}` : "",
    lastError,
    manualError,
  };
}

// ── So'rovlar ───────────────────────────────────────────────

export function listShops() {
  return shops;
}

/** Variantning tanlangan filialdagi narxi/qoldig'i. Filial yo'q bo'lsa — umumiy. */
function vs(v: Variant, shopId?: string) {
  if (!shopId || !v.shopStocks) return { price: v.price, oldPrice: v.oldPrice, stock: v.stock };
  const s = v.shopStocks.find((x) => x.shopId === shopId);
  return s ? { price: s.price, oldPrice: s.oldPrice, stock: s.stock } : { price: 0, oldPrice: null, stock: 0 };
}

export function totalStock(p: Product, shopId?: string) {
  return p.variants.reduce((s, v) => s + vs(v, shopId).stock, 0);
}

function visible(p: Product, shopId?: string) {
  if (shopId && !p.variants.some((v) => vs(v, shopId).price > 0)) return false;
  return !config.billz.hideOutOfStock || totalStock(p, shopId) > 0;
}

function bestVariant(p: Product, shopId?: string) {
  const list = p.variants.map((v) => ({ v, s: vs(v, shopId) })).filter((x) => x.s.price > 0);
  const pool = list.some((x) => x.s.stock > 0) ? list.filter((x) => x.s.stock > 0) : list;
  return pool.reduce((a, b) => (b.s.price < a.s.price ? b : a), pool[0] ?? { v: p.variants[0]!, s: vs(p.variants[0]!, shopId) });
}

const catName = (id: string, lang: Lang) => {
  const c = categoriesView.find((x) => x.id === id);
  return c ? loc(c.name, lang) : "";
};

export function listCategories(lang: Lang, shopId?: string) {
  const counts = new Map<string, number>();
  for (const p of all) {
    if (!visible(p, shopId)) continue;
    for (const c of p.categoryIds) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return categoriesView
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, name: loc(c.name, lang), count: counts.get(c.id) ?? 0 }));
}

export function serializeCard(p: Product, lang: Lang, shopId?: string) {
  const best = bestVariant(p, shopId);
  const stock = totalStock(p, shopId);
  const prices = new Set(p.variants.map((v) => vs(v, shopId).price).filter((x) => x > 0));
  return {
    id: p.id,
    name: loc(p.name, lang),
    category: catName(p.categoryIds[0] ?? "", lang),
    price: best.s.price,
    old_price: best.s.oldPrice,
    price_from: prices.size > 1,
    image: publicImage(p.images[0]),
    in_stock: stock > 0,
    has_variants: p.variants.length > 1 || Boolean(p.variants[0]?.label),
    single_variant_id: p.variants.length === 1 ? p.variants[0]!.id : null,
    stock,
  };
}

export type Sort = "popular" | "new" | "cheap" | "expensive";

export function listProducts(
  opts: { page?: number; limit?: number; category?: string; q?: string; sort?: Sort; ids?: string[]; shopId?: string },
  lang: Lang,
) {
  const shopId = opts.shopId;
  let list = all.filter((p) => visible(p, shopId));

  if (opts.ids?.length) {
    const order = new Map(opts.ids.map((id, i) => [id, i]));
    list = list.filter((p) => order.has(p.id)).sort((a, b) => order.get(a.id)! - order.get(b.id)!);
    return { products: list.map((p) => serializeCard(p, lang, shopId)), total: list.length, page: 1, has_more: false };
  }

  if (opts.category) list = list.filter((p) => p.categoryIds.includes(opts.category!));
  const q = (opts.q ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter((p) =>
      [loc(p.name, lang), p.sku, p.brand, ...p.variants.map((v) => `${v.sku} ${v.barcode}`)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }

  const price = (p: Product) => bestVariant(p, shopId).s.price;
  const stockFirst = (a: Product, b: Product) =>
    Number(totalStock(b, shopId) > 0) - Number(totalStock(a, shopId) > 0);
  switch (opts.sort) {
    case "cheap":
      list.sort((a, b) => stockFirst(a, b) || price(a) - price(b));
      break;
    case "expensive":
      list.sort((a, b) => stockFirst(a, b) || price(b) - price(a));
      break;
    case "popular":
      list.sort((a, b) => stockFirst(a, b) || totalStock(b, shopId) - totalStock(a, shopId));
      break;
    default:
      // Yangi kelganlar oldinda (qoldig'i borlar birinchi).
      list.sort((a, b) => stockFirst(a, b) || b.updatedAt.localeCompare(a.updatedAt));
  }

  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.max(1, Math.min(50, opts.limit ?? 20));
  const start = (page - 1) * limit;
  return {
    products: list.slice(start, start + limit).map((p) => serializeCard(p, lang, shopId)),
    total: list.length,
    page,
    has_more: start + limit < list.length,
    loading: loading.active,
  };
}

/** Mahsulot oynasi. ID — karta ID'si yoki variant ID'si (savatdagi eski yozuvlar uchun). */
export function getProductDetail(id: string, lang: Lang, shopId?: string) {
  const p = byProduct.get(id) ?? byVariant.get(id)?.product;
  if (!p) return null;
  return {
    ...serializeCard(p, lang, shopId),
    description: loc(p.description, lang),
    brand: p.brand,
    sku: p.sku,
    images: p.images.map((u) => publicImage(u)),
    attribute_name: p.attributeNames.join(" / "),
    variants: p.variants.map((v) => {
      const s = vs(v, shopId);
      return { id: v.id, label: v.label, price: s.price, old_price: s.oldPrice, stock: s.stock, in_stock: s.stock > 0 };
    }),
  };
}

/** Buyurtma yaratishda narx va qoldiq tekshiruvi uchun (BILLZ, namuna va qo'lda kiritilganlar). */
export function findVariant(variantId: string): { product: Product; variant: Variant } | null {
  return byVariant.get(variantId) ?? null;
}
