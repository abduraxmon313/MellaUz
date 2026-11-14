import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store, type Listing, type ManualRow } from "../store.js";
import {
  buildIndex,
  fetchAllProducts,
  fetchCategoryTree,
  fetchShops,
  fetchUpdatedSince,
  fetchByCode,
  type BillzShop,
  type SlimProduct,
} from "../billz/catalog.js";
import { allowedShop, billzShopName } from "../billz/catalog.js";
import type { Category, Lang, Localized, Product, Variant } from "./types.js";

/** Sayt /admin panelidagi kategoriya slug'lari (qo'lda kiritilgan mahsulotlar yoqilganda kerak). */
const MANUAL_CATEGORIES: Record<string, { name: Localized; order: number }> = {
  poyabzal: { name: { uz: "Oyoq kiyim", ru: "Обувь", en: "Footwear" }, order: 1 },
  sumkalar: { name: { uz: "Sumkalar", ru: "Сумки", en: "Bags" }, order: 2 },
  kiyim: { name: { uz: "Kiyim-kechak", ru: "Одежда", en: "Clothing" }, order: 3 },
  aksessuarlar: { name: { uz: "Aksessuarlar", ru: "Аксессуары", en: "Accessories" }, order: 4 },
};

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

/** Asosiy katalog — BILLZ. Token bo'lmasa bo'sh (namuna katalog olib tashlangan). */
let baseProducts: Product[] = [];
let baseCategories: Category[] = [];
let source: "billz" | "none" = "none";

/** Qo'lda kiritilgan mahsulotlar (sayt /admin) — faqat MINIAPP_MANUAL_PRODUCTS=true bo'lsa. */
let manual: { products: Product[] } = { products: [] };

/** Admin botda tasdiqlangan mahsulotlar: karta ID'si va har bir BILLZ tovar ID'si → yozuv. */
let listingById = new Map<string, Listing>();
let listingCount = 0;
let listingError = "";

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

/**
 * Mijoz uchun nom: BILLZ nomidagi BIRINCHI raqamdan boshlab hammasi olib tashlanadi.
 *   «Lafiera 20» → «Lafiera», «Mella kurtka 34 J» → «Mella kurtka», «Magza284» → «Magza».
 * Nom raqam bilan boshlansa yoki raqamdan oldin harf bo'lmasa — o'zgarmaydi.
 */
export function stripModelNumber(name: string): string {
  const full = name.trim();
  if (!config.miniappStripModelNumber) return full;
  const i = full.search(/\d/);
  if (i <= 0) return full;
  const head = full.slice(0, i).replace(/[\s\-_#№/(.,:;+|]+$/u, "").trim();
  return /\p{L}/u.test(head) ? head : full;
}

const SPEC_NAMES: [RegExp, Record<Lang, string>][] = [
  [/^(цвет|rang|color|colour)$/i, { uz: "Rang", ru: "Цвет", en: "Color" }],
  [/^(материал|material|matolar?)$/i, { uz: "Material", ru: "Материал", en: "Material" }],
  [/^(материал верха|ustki material)$/i, { uz: "Ustki material", ru: "Материал верха", en: "Upper" }],
  [/^(подошва|taglik)$/i, { uz: "Taglik", ru: "Подошва", en: "Sole" }],
  [/^(сезон|mavsum|season)$/i, { uz: "Mavsum", ru: "Сезон", en: "Season" }],
  [/^(страна|страна производства|ishlab chiqaruvchi davlat|country)$/i, { uz: "Ishlab chiqarilgan", ru: "Страна", en: "Made in" }],
  [/^(высота каблука|каблук|poshna|heel)$/i, { uz: "Poshna", ru: "Каблук", en: "Heel" }],
];

/** BILLZ xususiyat nomini mijoz tiliga o'giradi (ma'lum nomlar uchun). */
function specName(name: string, lang: Lang): string {
  const hit = SPEC_NAMES.find(([re]) => re.test(name.trim()));
  return hit ? hit[1][lang] : name;
}

/** Mini App'dagi nom: admin bergan nom, bo'lmasa BILLZ nomi model raqamisiz. */
export function displayName(p: Product, lang: Lang): string {
  return p.title || stripModelNumber(loc(p.name, lang));
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
  if (!config.miniappManualProducts) return;
  try {
    const res = await store.listManualProducts();
    manual = { products: res.products.map(manualToProduct) };
    manualError = "";
    rebuildView();
  } catch (e) {
    manualError = (e as Error).message;
    console.warn("[catalog] qo'lda kiritilgan mahsulotlar o'qilmadi:", manualError);
  }
}

// ── Admin botda tasdiqlangan mahsulotlar ────────────────────

/** Rasm saqlangan, ko'rsatish yoqilgan yozuvni topadi (karta ID'si yoki variant ID'lari bo'yicha). */
export function listingFor(p: Product): Listing | null {
  const l = listingById.get(p.id) ?? p.variants.map((v) => listingById.get(v.id)).find(Boolean);
  return l ?? null;
}

export async function refreshListings(): Promise<void> {
  try {
    const rows = await store.listListings();
    const map = new Map<string, Listing>();
    for (const l of rows) {
      for (const id of l.variantIds) map.set(id, l);
      map.set(l.key, l);
    }
    listingById = map;
    listingCount = rows.filter((l) => l.published && l.imageIds.length).length;
    listingError = "";
    rebuildView();
  } catch (e) {
    listingError = (e as Error).message;
    console.warn("[catalog] tasdiqlangan mahsulotlar o'qilmadi:", listingError);
  }
}

/** BILLZ mahsulotiga tasdiqlangan rasmlarni qo'llaydi; tasdiqlash talab qilinsa — qolganlarini yashiradi. */
function applyListings(list: Product[]): Product[] {
  const strict = source === "billz" && config.billz.requireApproval;
  const out: Product[] = [];
  for (const p of list) {
    const l = listingFor(p);
    const live = l && l.published && l.imageIds.length > 0;
    if (!live) {
      if (!strict) out.push(p);
      continue;
    }
    // Yangi tasdiqlangan mahsulot "Yangi" saralashda oldinda chiqsin.
    const updatedAt = l.createdAt > p.updatedAt ? l.createdAt : p.updatedAt;
    out.push({
      ...p,
      images: l.imageIds.map((id) => `/media/${id}`),
      title: l.title || undefined,
      description: l.description || p.description,
      updatedAt,
    });
  }
  return out;
}

/**
 * Admin bot: BILLZ kodi (artikul/SKU, shtrix-kod yoki ID) bo'yicha mahsulot kartasini qidiradi.
 * Tasdiqlanmaganlar ham qidiriladi. Aniq moslik bo'lmasa — nomi bo'yicha (ko'pi bilan `limit` ta).
 */
export function findByCode(code: string, limit = 8): { exact: boolean; products: Product[] } {
  const q = code.trim().toLowerCase();
  if (!q) return { exact: false, products: [] };
  const exact = baseProducts.filter(
    (p) =>
      p.id.toLowerCase() === q ||
      p.sku.toLowerCase() === q ||
      p.variants.some((v) => v.id.toLowerCase() === q || v.sku.toLowerCase() === q || v.barcode.toLowerCase() === q),
  );
  if (exact.length) return { exact: true, products: exact.slice(0, limit) };
  if (q.length < 3) return { exact: false, products: [] };
  const byName = baseProducts.filter((p) => loc(p.name, "uz").toLowerCase().includes(q));
  return { exact: false, products: byName.slice(0, limit) };
}

/** Admin bot uchun karta (tasdiqlanmagan bo'lsa ham). */
export function getBaseProduct(id: string): Product | null {
  return baseProducts.find((p) => p.id === id) ?? null;
}

export interface ShopStockRow {
  shopId: string;
  name: string;
  stock: number;
  /** BILLZ_SHOP_IDS'ga kiradi — Mini App qoldig'iga qo'shiladi. */
  counted: boolean;
  /** Shu filialdagi o'lchamlar (qoldig'i borlari). */
  sizes: { label: string; stock: number }[];
}

export interface BillzStockReport {
  /** true — ma'lumot hozirgina BILLZ API'dan olindi; false — oxirgi sinxron nusxasi. */
  live: boolean;
  error: string;
  /** BILLZ'dagi umumiy qoldiq (barcha filiallar). */
  total: number;
  /** Mini App ko'rsatadigan qoldiq (BILLZ_SHOP_IDS filiallari). */
  counted: number;
  rows: ShopStockRow[];
  /** O'lchamlar bo'yicha umumiy qoldiq (BILLZ_SHOP_IDS filiallari). */
  sizes: { label: string; stock: number }[];
}

/**
 * Admin bot: mahsulot qoldig'ini BILLZ'dan JONLI so'raydi (SKU / shtrix-kod bo'yicha) va
 * filiallar kesimida qaytaradi. Olingan ma'lumot indeksga ham yoziladi — Mini App darhol yangilanadi.
 * BILLZ javob bermasa — oxirgi sinxron nusxasi ko'rsatiladi (`live: false`).
 */
export async function billzStock(productId: string): Promise<BillzStockReport | null> {
  const p0 = getBaseProduct(productId);
  if (!p0) return null;
  const ids = new Set(p0.variants.map((v) => v.id));
  const fresh = new Map<string, SlimProduct>();
  let error = "";

  if (hasBillz) {
    try {
      const first = p0.sku || p0.variants.find((v) => v.sku)?.sku || p0.variants.find((v) => v.barcode)?.barcode || "";
      if (first) for (const it of await fetchByCode(first)) if (ids.has(it.id)) fresh.set(it.id, it);
      // SKU bo'yicha topilmagan variantlar — shtrix-kodi bo'yicha (ko'pi bilan 10 ta so'rov).
      const missing = p0.variants.filter((v) => !fresh.has(v.id) && v.barcode).slice(0, 10);
      for (const v of missing) for (const it of await fetchByCode(v.barcode)) if (ids.has(it.id)) fresh.set(it.id, it);
    } catch (e) {
      error = (e as Error).message;
      console.warn("[catalog] BILLZ jonli qoldiq olinmadi:", error);
    }
  }

  // Indeksni yangilaymiz (to'liq yuklash tugagan bo'lsa — aks holda yarim katalog bilan qayta qurib bo'lmaydi).
  if (fresh.size && raw.size && !fullRunning) {
    for (const it of fresh.values()) raw.set(it.id, it);
    applyBillz([...raw.values()]);
  }
  const p = getBaseProduct(productId) ?? p0;

  const perShop = new Map<string, { stock: number; sizes: { label: string; stock: number }[] }>();
  for (const s of shops) perShop.set(s.id, { stock: 0, sizes: [] });
  const sizes: { label: string; stock: number }[] = [];
  for (const v of p.variants) {
    const src = fresh.get(v.id) ?? raw.get(v.id);
    const stocks: Record<string, number> = src
      ? src.stocks
      : Object.fromEntries((v.shopStocks ?? []).map((s) => [s.shopId, s.stock]));
    sizes.push({
      label: v.label,
      stock: Object.entries(stocks).reduce((s, [shopId, n]) => (allowedShop(shopId) ? s + n : s), 0),
    });
    for (const [shopId, n] of Object.entries(stocks)) {
      const row = perShop.get(shopId) ?? { stock: 0, sizes: [] };
      row.stock += n;
      if (n > 0) row.sizes.push({ label: v.label, stock: n });
      perShop.set(shopId, row);
    }
  }
  const rows: ShopStockRow[] = [...perShop.entries()]
    .map(([shopId, r]) => ({
      shopId,
      name: shops.find((s) => s.id === shopId && s.name !== s.id)?.name || billzShopName(shopId) || shopId,
      stock: r.stock,
      counted: allowedShop(shopId),
      sizes: r.sizes,
    }))
    .sort((a, b) => Number(b.counted) - Number(a.counted) || b.stock - a.stock);

  return {
    live: fresh.size > 0,
    error,
    total: rows.reduce((s, r) => s + r.stock, 0),
    counted: rows.reduce((s, r) => (r.counted ? s + r.stock : s), 0),
    rows,
    sizes,
  };
}

// ── Ko'rinishni qayta qurish ────────────────────────────────

function rebuildView() {
  all = [...manual.products, ...applyListings(baseProducts)];

  const cats = [...baseCategories];
  for (const p of manual.products) {
    for (const id of p.categoryIds) {
      if (cats.some((c) => c.id === id)) continue;
      const mc = MANUAL_CATEGORIES[id];
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
  await refreshListings();
  if (config.miniappManualProducts) setInterval(() => void refreshManual(), MANUAL_REFRESH_MS).unref();

  if (!hasBillz) {
    rebuildView();
    console.warn("[catalog] BILLZ_SECRET_TOKEN yo'q — katalog bo'sh (namuna katalog olib tashlangan).");
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
    /** Admin botda rasmi tasdiqlangan BILLZ mahsulotlari. */
    approvedProducts: listingCount,
    billzTotal: source === "billz" ? baseProducts.length : 0,
    requireApproval: source === "billz" && config.billz.requireApproval,
    loading: loading.active ? `${loading.loaded}/${loading.total || "?"}` : "",
    lastError,
    manualError,
    listingError,
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
  // Filial tanlangan bo'lsa — faqat shu filialda narxi VA qoldig'i borlar. Aks holda boshqa
  // filialda turgan tovar shu filial ko'rinishida noto'g'ri «Tugagan» bo'lib chiqardi.
  if (shopId) return p.variants.some((v) => {
    const s = vs(v, shopId);
    return s.price > 0 && s.stock > 0;
  });
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
    name: displayName(p, lang),
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
      [loc(p.name, lang), p.title ?? "", p.sku, p.brand, ...p.variants.map((v) => `${v.sku} ${v.barcode}`)]
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
    specs: (p.specs ?? []).map((x) => ({ name: specName(x.name, lang), value: x.value })),
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

// ── Brend sayti uchun katalog (apps/web shu endpoint'dan o'qiydi) ─────────────

const SITE_LANGS: Lang[] = ["uz", "ru", "en"];
const SITE_MAX_PRODUCTS = 3000;

/** Lotin harflarida URL-slug: «Mella kurtka» → «mella-kurtka», «Обувь» → «obuv». */
export function slugify(s: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
    н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ц: "ts", ч: "ch", ш: "sh", щ: "sh", ъ: "",
    ы: "i", ь: "", э: "e", ю: "yu", я: "ya", ў: "o", қ: "q", ғ: "g", ҳ: "h",
  };
  return s
    .toLowerCase()
    .replace(/[а-яёўқғҳ]/g, (c) => map[c] ?? "")
    .replace(/[‘'’`ʻ]/g, "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

let siteMemo: { at: number; value: unknown } | null = null;

/**
 * Saytga Mini App'da ko'rinayotgan mahsulotlarning to'liq ro'yxati (3 tilda), barqaror slug'lar bilan.
 * Rasmlar nisbiy (/media/…, /img/…) — sayt ularga bot domenini qo'shadi.
 */
export function siteCatalog() {
  if (siteMemo && Date.now() - siteMemo.at < 30_000) return siteMemo.value;
  const list = all.filter((p) => visible(p)).slice(0, SITE_MAX_PRODUCTS);

  const catSlug = new Map<string, string>();
  const usedCat = new Set<string>();
  const categories: { id: string; slug: string; name: Record<Lang, string>; image: string; order: number }[] = [];
  for (const c of categoriesView) {
    const name = Object.fromEntries(SITE_LANGS.map((l) => [l, loc(c.name, l)])) as Record<Lang, string>;
    let slug = slugify(name.uz) || slugify(c.id) || "c";
    if (usedCat.has(slug)) slug = `${slug}-${slugify(c.id).slice(0, 6)}`;
    usedCat.add(slug);
    catSlug.set(c.id, slug);
    const first = list.find((p) => p.categoryIds[0] === c.id && p.images[0]);
    categories.push({ id: c.id, slug, name, image: first ? publicImage(first.images[0]) : "", order: c.order });
  }

  const usedSlug = new Set<string>();
  const products = list.map((p) => {
    const name = Object.fromEntries(SITE_LANGS.map((l) => [l, displayName(p, l)])) as Record<Lang, string>;
    const base = [slugify(name.uz), slugify(p.sku)].filter(Boolean).join("-") || slugify(p.id);
    let slug = base;
    if (usedSlug.has(slug)) slug = `${base}-${slugify(p.id).slice(0, 8)}`;
    usedSlug.add(slug);
    const best = bestVariant(p);
    return {
      id: p.id,
      slug,
      sku: p.sku,
      brand: p.brand,
      name,
      description: Object.fromEntries(SITE_LANGS.map((l) => [l, loc(p.description, l)])),
      specs: Object.fromEntries(
        SITE_LANGS.map((l) => [l, (p.specs ?? []).map((x) => ({ name: specName(x.name, l), value: x.value }))]),
      ),
      categorySlug: catSlug.get(p.categoryIds[0] ?? "") ?? "",
      price: best.s.price,
      oldPrice: best.s.oldPrice,
      stock: totalStock(p),
      images: p.images.map((u) => publicImage(u)).filter(Boolean),
      sizes: p.variants.filter((v) => v.label).map((v) => ({ label: v.label, inStock: v.stock > 0 })),
      featured: p.featured,
      updatedAt: p.updatedAt,
    };
  });
  // Yangilari birinchi (sayt bosh sahifasi uchun).
  products.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const value = {
    syncedAt: syncedAt || new Date().toISOString(),
    categories: categories.filter((c) => products.some((p) => p.categorySlug === c.slug)),
    products,
  };
  siteMemo = { at: Date.now(), value };
  return value;
}
