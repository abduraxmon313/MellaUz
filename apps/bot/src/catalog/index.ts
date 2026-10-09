import { createHash } from "node:crypto";
import { config, hasBillz } from "../config.js";
import { store } from "../store.js";
import { syncFromBillz } from "../billz/catalog.js";
import { buildMockSnapshot } from "./mock.js";
import type { CatalogSnapshot, Lang, Localized, Product, Variant } from "./types.js";

/**
 * Katalog xizmati — joriy snapshot xotirada turadi (tez javob, BILLZ
 * limitlariga tegmaydi). BILLZ ulangan bo'lsa har `BILLZ_SYNC_MINUTES`
 * daqiqada to'liq yangilanadi va oxirgi muvaffaqiyatli nusxa DB'ga saqlanadi
 * (qayta ishga tushganda darhol ko'rsatish uchun).
 */

const KV_SNAPSHOT = "catalog_snapshot";

let snapshot: CatalogSnapshot = buildMockSnapshot();
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
    source: snapshot.source,
    syncedAt: snapshot.syncedAt,
    products: snapshot.products.length,
    categories: snapshot.categories.length,
    lastError,
  };
}

export async function syncNow(): Promise<void> {
  if (!hasBillz) return;
  if (syncing) return syncing;
  syncing = (async () => {
    const t0 = Date.now();
    try {
      const next = await syncFromBillz();
      // Xavfsizlik: avvalgi katalog katta bo'lib, yangisi bo'sh kelsa — qo'llamaymiz.
      if (next.products.length === 0 && snapshot.source === "billz" && snapshot.products.length > 0) {
        throw new Error("BILLZ bo'sh katalog qaytardi — avvalgi nusxa saqlab qolindi");
      }
      snapshot = next;
      rebuildImageMap();
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

export async function initCatalog() {
  if (!hasBillz) {
    console.log("[catalog] BILLZ_SECRET_TOKEN yo'q — namuna (mock) katalog ishlatiladi.");
    rebuildImageMap();
    return;
  }
  try {
    const saved = await store.kvGet<CatalogSnapshot>(KV_SNAPSHOT);
    if (saved && saved.source === "billz" && Array.isArray(saved.products)) {
      snapshot = saved;
      rebuildImageMap();
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
