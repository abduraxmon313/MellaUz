import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store } from "../store.js";
import { syncFromBillz } from "../billz/catalog.js";
import { buildMockSnapshot } from "./mock.js";
import { categories as mockCategories } from "./mock-source.js";
import type { ManualRow } from "../store.js";
import type { CatalogSnapshot, Lang, Localized, Product, Variant } from "./types.js";

/**
 * Katalog xizmati — joriy snapshot xotirada turadi (tez javob, BILLZ
 * limitlariga tegmaydi). BILLZ ulangan bo'lsa har `BILLZ_SYNC_MINUTES`
 * daqiqada to'liq yangilanadi va oxirgi muvaffaqiyatli nusxa DB'ga saqlanadi
 * (qayta ishga tushganda darhol ko'rsatish uchun).
 */

const KV_SNAPSHOT = "catalog_snapshot";
const MANUAL_REFRESH_MS = 30_000;

/** Asosiy katalog (BILLZ yoki namuna). */
let baseSnapshot: CatalogSnapshot = buildMockSnapshot();
/** Mijozga ko'rsatiladigan katalog = qo'lda kiritilganlar + asosiy. */
let snapshot: CatalogSnapshot = baseSnapshot;
let manual: { products: Product[]; hideSamples: boolean } = { products: [], hideSamples: false };
let manualError = "";
let lastError = "";
let syncing: Promise<void> | null = null;
let timer: NodeJS.Timeout | null = null;

/** Rasm kaliti → asl URL (BILLZ CDN). Mijozga faqat /img/<kalit> beriladi. */
const imageMap = new Map<string, string>();

export function imageKey(url: string) {
  return createHash("sha1").update(url).digest("hex").slice(0, 32);
}

function rebuildImageMap() {
  imageMap.clear();
  for (const p of snapshot.products) for (const u of p.images) if (/^https?:\/\//.test(u)) imageMap.set(imageKey(u), u);
}

export function resolveImageKey(key: string) {
  return imageMap.get(key) ?? null;
}

/** Mijozga beriladigan rasm havolasi: lokal yo'l o'zgarishsiz, tashqi — proksi orqali. */
export function publicImage(url: string | undefined) {
  if (!url) return "";
  if (/^https?:\/\//.test(url)) return `/img/${imageKey(url)}`;
  return url;
}

export function loc(v: Localized, lang: Lang): string {
  if (typeof v === "string") return v;
  return v[lang] || v.uz || v.ru || v.en || "";
}

export function catalogStatus() {
  return {
    source: baseSnapshot.source,
    syncedAt: baseSnapshot.syncedAt,
    products: snapshot.products.length,
    categories: snapshot.categories.length,
    manualProducts: manual.products.length,
    hideSamples: manual.hideSamples,
    lastError,
    manualError,
  };
}

// ── Qo'lda kiritilgan mahsulotlar (sayt /admin) ────────────────
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
    attributeNames: m.sizes.length ? ["O'lcham"] : [],
    featured: m.featured,
    updatedAt: m.updatedAt,
  };
}

function rebuildSnapshot() {
  // "Namunalarni yashirish" faqat namuna katalogga tegishli; BILLZ — haqiqiy ma'lumot.
  const hideBase = manual.hideSamples && baseSnapshot.source === "mock";
  const products = [...manual.products, ...(hideBase ? [] : baseSnapshot.products)];
  const categories = [...baseSnapshot.categories];
  // Qo'lda kiritilgan kategoriya asosiy katalogda bo'lmasa (masalan BILLZ) — nomini qo'shamiz.
  for (const p of manual.products) {
    for (const id of p.categoryIds) {
      if (categories.some((c) => c.id === id)) continue;
      const mc = mockCategories.find((c) => c.slug === id);
      categories.push({ id, name: mc ? mc.name : id, order: mc ? mc.order : 99 });
    }
  }
  categories.sort((a, b) => a.order - b.order);
  snapshot = { ...baseSnapshot, categories, products };
  rebuildImageMap();
}

export async function refreshManual(): Promise<void> {
  try {
    const res = await store.listManualProducts();
    manual = { products: res.products.map(manualToProduct), hideSamples: res.hideSamples };
    manualError = "";
    rebuildSnapshot();
  } catch (e) {
    manualError = (e as Error).message;
    console.warn("[catalog] qo'lda kiritilgan mahsulotlar o'qilmadi:", manualError);
  }
}

export async function syncNow(): Promise<void> {
  if (!hasBillz) return;
  if (syncing) return syncing;
  syncing = (async () => {
    const t0 = Date.now();
    try {
      const next = await syncFromBillz();
      // Xavfsizlik: avvalgi katalog katta bo'lib, yangisi bo'sh kelsa — qo'llamaymiz.
      if (next.products.length === 0 && baseSnapshot.source === "billz" && baseSnapshot.products.length > 0) {
        throw new Error("BILLZ bo'sh katalog qaytardi — avvalgi nusxa saqlab qolindi");
      }
      baseSnapshot = next;
      rebuildSnapshot();
      lastError = "";
      await store.kvSet(KV_SNAPSHOT, next).catch((e) => console.warn("[catalog] snapshot saqlanmadi:", e.message));
      console.log(`[catalog] BILLZ: ${next.products.length} mahsulot, ${next.categories.length} kategoriya (${Date.now() - t0} ms)`);
    } catch (e) {
      lastError = (e as Error).message;
      console.error("[catalog] BILLZ sinxronlash xatosi:", lastError);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

let manualTimer: NodeJS.Timeout | null = null;

export async function initCatalog() {
  // Sayt admin panelida qo'shilgan mahsulotlar — har 30 soniyada bazadan yangilanadi.
  await refreshManual();
  manualTimer = setInterval(() => void refreshManual(), MANUAL_REFRESH_MS);
  manualTimer.unref();

  if (!hasBillz) {
    console.log("[catalog] BILLZ_SECRET_TOKEN yo'q — namuna (mock) katalog ishlatiladi.");
    rebuildSnapshot();
    return;
  }
  try {
    const saved = await store.kvGet<CatalogSnapshot>(KV_SNAPSHOT);
    if (saved && saved.source === "billz" && Array.isArray(saved.products)) {
      baseSnapshot = saved;
      rebuildSnapshot();
      console.log(`[catalog] saqlangan BILLZ nusxasi yuklandi (${saved.products.length} ta, ${saved.syncedAt})`);
    }
  } catch (e) {
    console.warn("[catalog] saqlangan nusxa o'qilmadi:", (e as Error).message);
  }
  // Birinchi sinxronlashni fonda boshlaymiz — server darhol javob bera boshlasin.
  void syncNow();
  timer = setInterval(() => void syncNow(), config.billz.syncMinutes * 60_000);
  timer.unref();
}

// ── So'rovlar ─────────────────────────────────────────────────

export function totalStock(p: Product) {
  return p.variants.reduce((s, v) => s + v.stock, 0);
}

function minPriceVariant(p: Product): Variant {
  const inStock = p.variants.filter((v) => v.stock > 0);
  const pool = inStock.length ? inStock : p.variants;
  return pool.reduce((a, b) => (b.price < a.price ? b : a));
}

function visible(p: Product) {
  return !config.billz.hideOutOfStock || totalStock(p) > 0;
}

export function listCategories(lang: Lang) {
  const counts = new Map<string, number>();
  for (const p of snapshot.products) {
    if (!visible(p)) continue;
    for (const c of p.categoryIds) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return snapshot.categories
    .filter((c) => (counts.get(c.id) ?? 0) > 0)
    .map((c) => ({ id: c.id, name: loc(c.name, lang), count: counts.get(c.id) ?? 0 }));
}

export type Sort = "popular" | "new" | "cheap" | "expensive";

export function listProducts(opts: { category?: string; q?: string; sort?: Sort; ids?: string[] }, lang: Lang) {
  let list = snapshot.products.filter(visible);
  if (opts.ids?.length) {
    const set = new Set(opts.ids);
    list = list.filter((p) => set.has(p.id));
    // Sevimlilar tartibini saqlaymiz.
    list.sort((a, b) => opts.ids!.indexOf(a.id) - opts.ids!.indexOf(b.id));
  }
  if (opts.category) list = list.filter((p) => p.categoryIds.includes(opts.category!));
  const q = (opts.q ?? "").trim().toLowerCase();
  if (q) {
    list = list.filter((p) =>
      [loc(p.name, lang), p.sku, p.brand, ...p.variants.map((v) => v.sku + " " + v.barcode)]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }
  if (!opts.ids?.length) {
    const price = (p: Product) => minPriceVariant(p).price;
    const inStockFirst = (a: Product, b: Product) => Number(totalStock(b) > 0) - Number(totalStock(a) > 0);
    switch (opts.sort) {
      case "new":
        list = [...list].sort((a, b) => inStockFirst(a, b) || b.updatedAt.localeCompare(a.updatedAt));
        break;
      case "cheap":
        list = [...list].sort((a, b) => inStockFirst(a, b) || price(a) - price(b));
        break;
      case "expensive":
        list = [...list].sort((a, b) => inStockFirst(a, b) || price(b) - price(a));
        break;
      default:
        list = [...list].sort(
          (a, b) => inStockFirst(a, b) || Number(b.featured) - Number(a.featured) || totalStock(b) - totalStock(a),
        );
    }
  }
  return list.map((p) => serializeCard(p, lang));
}

const catName = (id: string, lang: Lang) => {
  const c = snapshot.categories.find((x) => x.id === id);
  return c ? loc(c.name, lang) : "";
};

export function serializeCard(p: Product, lang: Lang) {
  const v = minPriceVariant(p);
  const stock = totalStock(p);
  return {
    id: p.id,
    name: loc(p.name, lang),
    category: catName(p.categoryIds[0] ?? "", lang),
    price: v.price,
    old_price: v.oldPrice,
    // Variantlar narxi har xil bo'lsa — "dan" (from) yozuvi uchun.
    price_from: new Set(p.variants.map((x) => x.price)).size > 1,
    image: publicImage(p.images[0]),
    in_stock: stock > 0,
    has_variants: p.variants.length > 1 || Boolean(p.variants[0]?.label),
    // Kartadagi tezkor "Savatga" tugmasi uchun (bitta variantli tovar).
    single_variant_id: p.variants.length === 1 ? p.variants[0]!.id : null,
    stock,
  };
}

export function getProductDetail(id: string, lang: Lang) {
  const p = snapshot.products.find((x) => x.id === id);
  if (!p) return null;
  return {
    ...serializeCard(p, lang),
    description: loc(p.description, lang),
    brand: p.brand,
    sku: p.sku,
    images: p.images.map((u) => publicImage(u)),
    attribute_name: p.attributeNames.join(" / "),
    variants: p.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.price,
      old_price: v.oldPrice,
      stock: v.stock,
      in_stock: v.stock > 0,
    })),
  };
}

export function findVariant(variantId: string): { product: Product; variant: Variant } | null {
  for (const p of snapshot.products) {
    const v = p.variants.find((x) => x.id === variantId);
    if (v) return { product: p, variant: v };
  }
  return null;
}
